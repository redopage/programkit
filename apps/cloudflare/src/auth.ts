import { DurableObject } from 'cloudflare:workers'

const magicLinkLifetimeMs = 15 * 60 * 1_000
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000
const requestWindowMs = 60 * 60 * 1_000
// Cloudflare Workers currently rejects PBKDF2 iteration counts above 100,000.
// Keep the organizer and participant derivations on the same edge-compatible bound.
export const cloudflarePasswordIterations = 100_000
const minimumPasswordLength = 10
const maximumPasswordLength = 128

interface AuthUser {
  id: string
  name: string
  email: string
  eventIds: string[]
  createdAt: string
  lastSignedInAt: string
}

export interface AuthEventSummary {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
  createdAt: string
  membershipId?: string
  membershipVersion?: number
  joinedAt?: string
}

export interface AuthMembershipProjection extends AuthEventSummary {
  membershipId: string
  membershipVersion: number
  joinedAt: string
}

interface MagicLinkRecord {
  email: string
  createdAt: string
  expiresAt: string
}

interface SessionRecord {
  userId: string
  createdAt: string
  expiresAt: string
}

interface PasswordRecord {
  userId: string
  salt: string
  hash: string
  iterations: number
  createdAt: string
}

interface RateRecord {
  attempts: number[]
}

export interface AuthAccount {
  user: Pick<AuthUser, 'id' | 'name' | 'email'>
  events: AuthEventSummary[]
  activeEventId: string
}

function randomHex(bytes: number) {
  const value = new Uint8Array(bytes)
  crypto.getRandomValues(value)
  return Array.from(value, (entry) => entry.toString(16).padStart(2, '0')).join('')
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (entry) => entry.toString(16).padStart(2, '0')).join('')
}

function bytesToHex(value: Uint8Array) {
  return Array.from(value, (entry) => entry.toString(16).padStart(2, '0')).join('')
}

async function passwordHash(password: string, salt: string, iterations: number) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new TextEncoder().encode(salt),
      iterations,
    },
    key,
    256,
  )
  return bytesToHex(new Uint8Array(derived))
}

function equalHex(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

function validPassword(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= minimumPasswordLength &&
    value.length <= maximumPasswordLength
  )
}

export function normalizeEmail(value: unknown) {
  if (typeof value !== 'string') return null
  const email = value.trim().toLocaleLowerCase('en-US')
  if (email.length < 3 || email.length > 254) return null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return null
  return email
}

function fallbackName(email: string) {
  const localPart = email.split('@')[0] ?? ''
  const words = localPart
    .replace(/[^a-z0-9]+/giu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
  const name = words
    .slice(0, 4)
    .map((word) => `${word[0]?.toLocaleUpperCase('en-US') ?? ''}${word.slice(1)}`)
    .join(' ')
  return name || 'Organizer'
}

function normalizeName(value: unknown, email: string) {
  if (typeof value !== 'string') return fallbackName(email)
  const name = value.trim().replace(/\s+/gu, ' ').slice(0, 80)
  return name || fallbackName(email)
}

function eventSlug(name: string) {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 48)
  return slug || 'event'
}

export class AuthDurableObject extends DurableObject {
  readonly #ctx: DurableObjectState

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.#ctx = ctx
  }

  async #rateAllows(key: string, limit: number, cooldownMs = 0) {
    const now = Date.now()
    const stored = (await this.#ctx.storage.get<RateRecord>(`rate:${key}`)) ?? { attempts: [] }
    const attempts = stored.attempts.filter((attempt) => attempt > now - requestWindowMs)
    const last = attempts.at(-1)
    const allowed = attempts.length < limit && (last == null || now - last >= cooldownMs)
    attempts.push(now)
    await this.#ctx.storage.put(`rate:${key}`, { attempts: attempts.slice(-limit * 2) })
    return allowed
  }

  async #requestMagicLink(email: string, ipHash: string) {
    const emailHash = await sha256(email)
    const emailAllowed = await this.#rateAllows(`email:${emailHash}`, 5, 45_000)
    const ipAllowed = await this.#rateAllows(`ip:${ipHash}`, 20)
    if (!emailAllowed || !ipAllowed) return { ok: true, deliver: false as const }

    const previousLinks = await this.#ctx.storage.list({ prefix: 'magic:' })
    if (previousLinks.size > 0) await this.#ctx.storage.delete([...previousLinks.keys()])
    const token = randomHex(32)
    const tokenHash = await sha256(token)
    const createdAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + magicLinkLifetimeMs).toISOString()
    await this.#ctx.storage.put(`magic:${tokenHash}`, { email, createdAt, expiresAt })
    await this.#scheduleCleanup()
    return { ok: true, deliver: true as const, token, expiresAt, email }
  }

  async #userForEmail(email: string, name?: string) {
    const emailHash = await sha256(email)
    const existingId = await this.#ctx.storage.get<string>(`email:${emailHash}`)
    if (existingId) {
      const existing = await this.#ctx.storage.get<AuthUser>(`user:${existingId}`)
      if (existing) return existing
    }

    const now = new Date().toISOString()
    const userId = `usr_${randomHex(12)}`
    const eventId = `evt_${randomHex(12)}`
    const event: AuthEventSummary = {
      id: eventId,
      name: 'My first event',
      slug: 'my-first-event',
      role: 'owner',
      createdAt: now,
    }
    const user: AuthUser = {
      id: userId,
      name: normalizeName(name, email),
      email,
      eventIds: [eventId],
      createdAt: now,
      lastSignedInAt: now,
    }
    await this.#ctx.storage.put(`email:${emailHash}`, userId)
    await this.#ctx.storage.put(`user:${userId}`, user)
    await this.#ctx.storage.put(`event:${eventId}`, event)
    return user
  }

  async #existingUserForEmail(email: string) {
    const emailHash = await sha256(email)
    const existingId = await this.#ctx.storage.get<string>(`email:${emailHash}`)
    return existingId
      ? ((await this.#ctx.storage.get<AuthUser>(`user:${existingId}`)) ?? null)
      : null
  }

  async #account(user: AuthUser, preferredEventId?: string | null): Promise<AuthAccount> {
    const events = (
      await Promise.all(
        user.eventIds.map((eventId) => this.#ctx.storage.get<AuthEventSummary>(`event:${eventId}`)),
      )
    ).filter((event): event is AuthEventSummary => Boolean(event))
    if (events.length === 0) throw new Error('This account does not have an event.')
    const activeEventId = events.some((event) => event.id === preferredEventId)
      ? preferredEventId!
      : events[0].id
    return {
      user: { id: user.id, name: user.name || fallbackName(user.email), email: user.email },
      events,
      activeEventId,
    }
  }

  async #consumeMagicLink(token: string) {
    const tokenHash = await sha256(token)
    const record = await this.#ctx.storage.get<MagicLinkRecord>(`magic:${tokenHash}`)
    if (!record || Date.parse(record.expiresAt) <= Date.now()) {
      if (record) await this.#ctx.storage.delete(`magic:${tokenHash}`)
      return { ok: false as const }
    }
    await this.#ctx.storage.delete(`magic:${tokenHash}`)

    const user = await this.#userForEmail(record.email)
    const updatedUser = { ...user, lastSignedInAt: new Date().toISOString() }
    await this.#ctx.storage.put(`user:${user.id}`, updatedUser)
    const session = await this.#createSession(updatedUser)
    return {
      ok: true as const,
      sessionToken: session.token,
      sessionExpiresAt: session.record.expiresAt,
      account: await this.#account(updatedUser),
    }
  }

  async #createSession(user: AuthUser) {
    const token = randomHex(32)
    const tokenHash = await sha256(token)
    const record: SessionRecord = {
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + sessionLifetimeMs).toISOString(),
    }
    await this.#ctx.storage.put(`session:${tokenHash}`, record)
    await this.#scheduleCleanup()
    return { token, record }
  }

  async #authenticatePassword(
    email: string,
    password: string,
    intent: 'signin' | 'signup',
    ipHash: string,
    name?: string,
  ) {
    const emailHash = await sha256(email)
    const emailAllowed = await this.#rateAllows(`password-email:${emailHash}`, 10, 750)
    const ipAllowed = await this.#rateAllows(`password-ip:${ipHash}`, 40)
    if (!emailAllowed || !ipAllowed) return { ok: false as const }

    let user = await this.#existingUserForEmail(email)
    const existingPassword = user
      ? await this.#ctx.storage.get<PasswordRecord>(`password:${user.id}`)
      : null

    if (intent === 'signup') {
      if (user || existingPassword) return { ok: false as const }
      const salt = randomHex(16)
      const hash = await passwordHash(password, salt, cloudflarePasswordIterations)
      user = await this.#userForEmail(email, name)
      const passwordRecord: PasswordRecord = {
        userId: user.id,
        salt,
        hash,
        iterations: cloudflarePasswordIterations,
        createdAt: new Date().toISOString(),
      }
      await this.#ctx.storage.put(`password:${user.id}`, passwordRecord)
    } else {
      if (!user || !existingPassword) return { ok: false as const }
      const candidate = await passwordHash(
        password,
        existingPassword.salt,
        existingPassword.iterations,
      )
      if (!equalHex(candidate, existingPassword.hash)) return { ok: false as const }
    }

    const updatedUser = {
      ...user,
      name: user.name || fallbackName(user.email),
      lastSignedInAt: new Date().toISOString(),
    }
    await this.#ctx.storage.put(`user:${updatedUser.id}`, updatedUser)
    const session = await this.#createSession(updatedUser)
    return {
      ok: true as const,
      sessionToken: session.token,
      sessionExpiresAt: session.record.expiresAt,
      account: await this.#account(updatedUser),
    }
  }

  async #session(token: string, preferredEventId?: string | null) {
    if (!/^[a-f0-9]{64}$/u.test(token)) return null
    const sessionHash = await sha256(token)
    const session = await this.#ctx.storage.get<SessionRecord>(`session:${sessionHash}`)
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (session) await this.#ctx.storage.delete(`session:${sessionHash}`)
      return null
    }
    const user = await this.#ctx.storage.get<AuthUser>(`user:${session.userId}`)
    if (!user) return null
    return { sessionHash, session, account: await this.#account(user, preferredEventId) }
  }

  async #createEvent(sessionToken: string, name: string) {
    const resolved = await this.#session(sessionToken)
    if (!resolved) return null
    const cleanName = name.trim().replace(/\s+/gu, ' ').slice(0, 80)
    if (cleanName.length < 2) throw new Error('Enter an event name.')
    if (resolved.account.events.length >= 50) throw new Error('This account has too many events.')

    const eventId = `evt_${randomHex(12)}`
    const baseSlug = eventSlug(cleanName)
    let slug = baseSlug
    let suffix = 2
    while (resolved.account.events.some((event) => event.slug === slug)) {
      slug = `${baseSlug.slice(0, Math.max(1, 48 - String(suffix).length - 1))}-${suffix}`
      suffix += 1
    }
    const event: AuthEventSummary = {
      id: eventId,
      name: cleanName,
      slug,
      role: 'owner',
      createdAt: new Date().toISOString(),
    }
    const user = await this.#ctx.storage.get<AuthUser>(`user:${resolved.account.user.id}`)
    if (!user) return null
    await this.#ctx.storage.put(`event:${eventId}`, event)
    await this.#ctx.storage.put(`user:${user.id}`, {
      ...user,
      eventIds: [...user.eventIds, eventId],
    } satisfies AuthUser)
    return event
  }

  async #linkMembership(sessionToken: string, projection: AuthMembershipProjection) {
    const resolved = await this.#session(sessionToken)
    if (!resolved) return null
    const user = await this.#ctx.storage.get<AuthUser>(`user:${resolved.account.user.id}`)
    if (!user) return null
    const existing = await this.#ctx.storage.get<AuthEventSummary>(`event:${projection.id}`)
    if (
      existing?.membershipId === projection.membershipId &&
      existing.membershipVersion === projection.membershipVersion &&
      user.eventIds.includes(projection.id)
    ) {
      return projection
    }
    await this.#ctx.storage.put(`event:${projection.id}`, projection)
    if (!user.eventIds.includes(projection.id)) {
      await this.#ctx.storage.put(`user:${user.id}`, {
        ...user,
        eventIds: [...user.eventIds, projection.id],
      } satisfies AuthUser)
    }
    return projection
  }

  async #unlinkMembership(userId: string, eventId: string, membershipId: string) {
    const user = await this.#ctx.storage.get<AuthUser>(`user:${userId}`)
    if (!user) return true
    const event = await this.#ctx.storage.get<AuthEventSummary>(`event:${eventId}`)
    if (event?.membershipId && event.membershipId !== membershipId) return false
    await this.#ctx.storage.delete(`event:${eventId}`)
    if (user.eventIds.includes(eventId)) {
      await this.#ctx.storage.put(`user:${user.id}`, {
        ...user,
        eventIds: user.eventIds.filter((candidate) => candidate !== eventId),
      } satisfies AuthUser)
    }
    return true
  }

  async #scheduleCleanup() {
    const current = await this.#ctx.storage.getAlarm()
    const next = Date.now() + magicLinkLifetimeMs
    if (current == null || current > next) await this.#ctx.storage.setAlarm(next)
  }

  async alarm() {
    const now = Date.now()
    let next: number | null = null
    for (const [key, value] of await this.#ctx.storage.list<MagicLinkRecord>({
      prefix: 'magic:',
    })) {
      const expiresAt = Date.parse(value.expiresAt)
      if (expiresAt <= now) await this.#ctx.storage.delete(key)
      else next = next == null ? expiresAt : Math.min(next, expiresAt)
    }
    for (const [key, value] of await this.#ctx.storage.list<SessionRecord>({
      prefix: 'session:',
    })) {
      const expiresAt = Date.parse(value.expiresAt)
      if (expiresAt <= now) await this.#ctx.storage.delete(key)
      else next = next == null ? expiresAt : Math.min(next, expiresAt)
    }
    for (const [key, value] of await this.#ctx.storage.list<RateRecord>({ prefix: 'rate:' })) {
      if (value.attempts.every((attempt) => attempt <= now - requestWindowMs)) {
        await this.#ctx.storage.delete(key)
      }
    }
    if (next == null) await this.#ctx.storage.deleteAlarm()
    else await this.#ctx.storage.setAlarm(next)
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method !== 'POST') return new Response(null, { status: 405 })
    const input = (await request.json()) as Record<string, unknown>

    if (url.pathname === '/internal/auth/request') {
      const email = normalizeEmail(input.email)
      const ipHash = typeof input.ipHash === 'string' ? input.ipHash : 'unknown'
      if (!email) return Response.json({ ok: true, deliver: false })
      return Response.json(await this.#requestMagicLink(email, ipHash))
    }

    if (url.pathname === '/internal/auth/consume') {
      const token = typeof input.token === 'string' ? input.token : ''
      return Response.json(await this.#consumeMagicLink(token))
    }

    if (url.pathname === '/internal/auth/password') {
      const email = normalizeEmail(input.email)
      const password = input.password
      const intent = input.intent === 'signup' ? 'signup' : 'signin'
      const ipHash = typeof input.ipHash === 'string' ? input.ipHash : 'unknown'
      const name = intent === 'signup' ? normalizeName(input.name, email ?? '') : undefined
      if (!email || !validPassword(password)) {
        return Response.json({ ok: false }, { status: 401 })
      }
      const authenticated = await this.#authenticatePassword(email, password, intent, ipHash, name)
      return authenticated.ok
        ? Response.json(authenticated, { status: intent === 'signup' ? 201 : 200 })
        : Response.json({ ok: false }, { status: 401 })
    }

    if (url.pathname === '/internal/auth/session') {
      const token = typeof input.token === 'string' ? input.token : ''
      const preferredEventId =
        typeof input.preferredEventId === 'string' ? input.preferredEventId : null
      const resolved = await this.#session(token, preferredEventId)
      return resolved
        ? Response.json({ ok: true, account: resolved.account })
        : Response.json({ ok: false }, { status: 401 })
    }

    if (url.pathname === '/internal/auth/logout') {
      const token = typeof input.token === 'string' ? input.token : ''
      if (/^[a-f0-9]{64}$/u.test(token)) {
        await this.#ctx.storage.delete(`session:${await sha256(token)}`)
      }
      return Response.json({ ok: true })
    }

    if (url.pathname === '/internal/events/create') {
      const token = typeof input.token === 'string' ? input.token : ''
      const name = typeof input.name === 'string' ? input.name : ''
      try {
        const event = await this.#createEvent(token, name)
        return event
          ? Response.json({ ok: true, event }, { status: 201 })
          : Response.json({ ok: false }, { status: 401 })
      } catch (error) {
        return Response.json(
          { ok: false, error: error instanceof Error ? error.message : 'Event creation failed.' },
          { status: 400 },
        )
      }
    }

    if (url.pathname === '/internal/memberships/link') {
      const token = typeof input.token === 'string' ? input.token : ''
      const role =
        input.role === 'owner' || input.role === 'admin' || input.role === 'member'
          ? input.role
          : null
      const projection =
        typeof input.eventId === 'string' &&
        typeof input.membershipId === 'string' &&
        typeof input.membershipVersion === 'number' &&
        typeof input.name === 'string' &&
        typeof input.slug === 'string' &&
        role &&
        typeof input.createdAt === 'string' &&
        typeof input.joinedAt === 'string'
          ? ({
              id: input.eventId,
              membershipId: input.membershipId,
              membershipVersion: input.membershipVersion,
              name: input.name,
              slug: input.slug,
              role,
              createdAt: input.createdAt,
              joinedAt: input.joinedAt,
            } satisfies AuthMembershipProjection)
          : null
      if (!projection) {
        return Response.json(
          { ok: false, error: 'Invalid membership projection.' },
          { status: 400 },
        )
      }
      const linked = await this.#linkMembership(token, projection)
      return linked
        ? Response.json({ ok: true, event: linked })
        : Response.json({ ok: false }, { status: 401 })
    }

    if (url.pathname === '/internal/memberships/unlink') {
      const userId = typeof input.userId === 'string' ? input.userId : ''
      const eventId = typeof input.eventId === 'string' ? input.eventId : ''
      const membershipId = typeof input.membershipId === 'string' ? input.membershipId : ''
      if (!userId || !eventId || !membershipId) {
        return Response.json(
          { ok: false, error: 'Invalid membership unlink request.' },
          { status: 400 },
        )
      }
      const unlinked = await this.#unlinkMembership(userId, eventId, membershipId)
      return unlinked
        ? Response.json({ ok: true })
        : Response.json({ ok: false, error: 'Membership projection changed.' }, { status: 409 })
    }

    return new Response(null, { status: 404 })
  }
}
