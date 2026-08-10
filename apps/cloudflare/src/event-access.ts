import { DurableObject } from 'cloudflare:workers'

import { normalizeEmail } from './auth.ts'

const invitationLifetimeMs = 7 * 24 * 60 * 60 * 1_000
const externalSessionLifetimeMs = 30 * 24 * 60 * 60 * 1_000
const externalRateWindowMs = 60 * 60 * 1_000
const externalPasswordIterations = 210_000
const minimumPasswordLength = 10
const maximumPasswordLength = 128
const maximumPendingInvitations = 200
const maximumApiKeys = 50
const eventIdPattern = /^[a-z][a-z0-9_-]{2,79}$/u
const eventSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u
const tokenPattern = /^([a-z][a-z0-9_-]{2,79})\.([a-f0-9]{64})$/u

export type EventRole = 'owner' | 'admin' | 'member'
export type EventMembershipStatus = 'active' | 'revoked'
export type EventInvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired'

export const apiKeyScopes = [
  'workspace:read',
  'workspace:export',
  'events:read',
  'events:write',
  'submission-forms:write',
  'submission-forms:publish',
  'submissions:write',
  'submissions:submit',
  'reviews:configure',
  'reviews:write',
  'reviews:decide',
  'sessions:write',
  'schedule:draft',
  'schedule:publish',
  'people:write',
  'participations:write',
  'requirements:write',
  'assets:write',
  'portal:write',
  'communications:write',
  'communications:draft',
  'communications:approve',
  'communications:send',
] as const

export type ApiKeyScope = (typeof apiKeyScopes)[number]

export interface EventAccessEvent {
  id: string
  name: string
  slug: string
  createdAt: string
}

export interface EventAccessActor {
  userId: string
  email: string
}

export interface EventMembership {
  id: string
  eventId: string
  userId: string
  email: string
  role: EventRole
  status: EventMembershipStatus
  invitedByUserId: string | null
  joinedAt: string
  updatedAt: string
  version: number
}

export interface EventInvitation {
  id: string
  eventId: string
  email: string
  role: Exclude<EventRole, 'owner'>
  invitedByUserId: string
  createdAt: string
  expiresAt: string
  acceptedAt: string | null
  acceptedByUserId: string | null
  revokedAt: string | null
  status: EventInvitationStatus
}

interface StoredEventInvitation extends Omit<EventInvitation, 'status'> {
  tokenHash: string
}

interface ExternalIdentity {
  id: string
  eventId: string
  email: string
  passwordSalt: string
  passwordHash: string
  passwordIterations: number
  createdAt: string
  lastSignedInAt: string
}

interface ExternalSession {
  identityId: string
  createdAt: string
  expiresAt: string
}

interface ExternalRateRecord {
  attempts: number[]
}

export interface EventApiKey {
  id: string
  eventId: string
  name: string
  prefix: string
  scopes: ApiKeyScope[]
  createdByUserId: string
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

interface StoredEventApiKey extends EventApiKey {
  secretHash: string
}

interface InitializeInput {
  event?: Partial<EventAccessEvent>
  owner?: Partial<EventAccessActor>
}

interface ActorInput {
  eventId?: unknown
  actor?: Partial<EventAccessActor>
}

interface InvitationCreateInput extends ActorInput {
  email?: unknown
  role?: unknown
}

interface InvitationMutationInput extends ActorInput {
  invitationId?: unknown
}

interface InvitationConsumeInput {
  eventId?: unknown
  token?: unknown
  userId?: unknown
  email?: unknown
}

interface MembershipLookupInput {
  eventId?: unknown
  userId?: unknown
  email?: unknown
}

interface MembershipMutationInput extends ActorInput {
  membershipId?: unknown
}

interface ApiKeyCreateInput extends ActorInput {
  name?: unknown
  scopes?: unknown
  expiresAt?: unknown
}

interface ApiKeyMutationInput extends ActorInput {
  apiKeyId?: unknown
}

class EventAccessError extends Error {
  readonly code: string
  readonly status: number

  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

const roleScopes = {
  owner: ['*'],
  admin: ['*'],
  member: ['workspace:read', 'events:read'],
} as const satisfies Record<EventRole, readonly string[]>

export function eventScopesForRole(role: EventRole): string[] {
  return [...roleScopes[role]]
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

function cleanPassword(value: unknown) {
  if (
    typeof value !== 'string' ||
    value.length < minimumPasswordLength ||
    value.length > maximumPasswordLength
  ) {
    throw new EventAccessError(
      'INVALID_INPUT',
      `Password must be between ${minimumPasswordLength} and ${maximumPasswordLength} characters.`,
      400,
    )
  }
  return value
}

function cleanIdentifier(value: unknown, field: string) {
  if (typeof value !== 'string') {
    throw new EventAccessError('INVALID_INPUT', `${field} is required.`, 400)
  }
  const cleaned = value.trim()
  const hasControlCharacter = [...cleaned].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
  if (cleaned.length < 3 || cleaned.length > 128 || hasControlCharacter) {
    throw new EventAccessError('INVALID_INPUT', `${field} is invalid.`, 400)
  }
  return cleaned
}

function cleanEvent(input: InitializeInput['event']): EventAccessEvent {
  const id = cleanIdentifier(input?.id, 'event.id')
  if (!eventIdPattern.test(id)) {
    throw new EventAccessError('INVALID_INPUT', 'event.id is invalid.', 400)
  }
  const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/gu, ' ') : ''
  if (name.length < 2 || name.length > 80) {
    throw new EventAccessError('INVALID_INPUT', 'event.name is invalid.', 400)
  }
  const slug = typeof input?.slug === 'string' ? input.slug.trim() : ''
  if (slug.length > 64 || !eventSlugPattern.test(slug)) {
    throw new EventAccessError('INVALID_INPUT', 'event.slug is invalid.', 400)
  }
  const createdAt = typeof input?.createdAt === 'string' ? input.createdAt : ''
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) {
    throw new EventAccessError('INVALID_INPUT', 'event.createdAt must be an ISO date.', 400)
  }
  return { id, name, slug, createdAt }
}

function cleanActor(input: Partial<EventAccessActor> | undefined): EventAccessActor {
  const userId = cleanIdentifier(input?.userId, 'actor.userId')
  const email = normalizeEmail(input?.email)
  if (!email) throw new EventAccessError('INVALID_INPUT', 'actor.email is invalid.', 400)
  return { userId, email }
}

function cleanEventId(value: unknown) {
  const eventId = cleanIdentifier(value, 'eventId')
  if (!eventIdPattern.test(eventId)) {
    throw new EventAccessError('INVALID_INPUT', 'eventId is invalid.', 400)
  }
  return eventId
}

function invitationStatus(
  invitation: Pick<StoredEventInvitation, 'acceptedAt' | 'revokedAt' | 'expiresAt'>,
  now = Date.now(),
): EventInvitationStatus {
  if (invitation.acceptedAt) return 'accepted'
  if (invitation.revokedAt) return 'revoked'
  if (Date.parse(invitation.expiresAt) <= now) return 'expired'
  return 'pending'
}

function publicInvitation(invitation: StoredEventInvitation): EventInvitation {
  const { tokenHash: _, ...publicRecord } = invitation
  return { ...publicRecord, status: invitationStatus(invitation) }
}

function publicApiKey(apiKey: StoredEventApiKey): EventApiKey {
  const { secretHash: _, ...publicRecord } = apiKey
  return publicRecord
}

function cleanApiKeyScopes(value: unknown): ApiKeyScope[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new EventAccessError('INVALID_INPUT', 'Choose at least one API scope.', 400)
  }
  const allowed = new Set<string>(apiKeyScopes)
  const scopes = [...new Set(value)]
  if (scopes.some((scope) => typeof scope !== 'string' || !allowed.has(scope))) {
    throw new EventAccessError('INVALID_INPUT', 'One or more API scopes are invalid.', 400)
  }
  return (scopes as ApiKeyScope[]).sort()
}

function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { 'cache-control': 'no-store', ...init?.headers },
  })
}

function sameEvent(left: EventAccessEvent, right: EventAccessEvent) {
  return left.id === right.id && left.name === right.name && left.slug === right.slug
}

export class EventAccessDurableObject extends DurableObject {
  readonly #ctx: DurableObjectState

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.#ctx = ctx
  }

  async #externalRateAllows(key: string, limit: number, cooldownMs = 0) {
    const now = Date.now()
    const storageKey = `external-rate:${key}`
    const stored = (await this.#ctx.storage.get<ExternalRateRecord>(storageKey)) ?? {
      attempts: [],
    }
    const attempts = stored.attempts.filter((attempt) => attempt > now - externalRateWindowMs)
    const last = attempts.at(-1)
    const allowed = attempts.length < limit && (last == null || now - last >= cooldownMs)
    attempts.push(now)
    await this.#ctx.storage.put(storageKey, { attempts: attempts.slice(-limit * 2) })
    return allowed
  }

  async #authenticateExternal(input: Record<string, unknown>) {
    const event = await this.#event(input.eventId)
    const email = normalizeEmail(input.email)
    if (!email) throw new EventAccessError('INVALID_INPUT', 'Email is invalid.', 400)
    const password = cleanPassword(input.password)
    const intent = input.intent === 'signup' ? 'signup' : 'signin'
    const ipHash = typeof input.ipHash === 'string' ? input.ipHash : 'unknown'
    const emailHash = await sha256(email)
    const emailAllowed = await this.#externalRateAllows(`email:${emailHash}`, 10, 750)
    const ipAllowed = await this.#externalRateAllows(`ip:${ipHash}`, 40)
    if (!emailAllowed || !ipAllowed) {
      throw new EventAccessError('RATE_LIMITED', 'Too many sign-in attempts. Try again later.', 429)
    }

    const identityId = await this.#ctx.storage.get<string>(`external-email:${emailHash}`)
    let identity = identityId
      ? await this.#ctx.storage.get<ExternalIdentity>(`external-identity:${identityId}`)
      : null

    if (intent === 'signup') {
      if (identity) {
        throw new EventAccessError(
          'ACCOUNT_EXISTS',
          'That account already exists. Sign in instead.',
          409,
        )
      }
      const salt = randomHex(16)
      const now = new Date().toISOString()
      identity = {
        id: `ext_${randomHex(12)}`,
        eventId: event.id,
        email,
        passwordSalt: salt,
        passwordHash: await passwordHash(password, salt, externalPasswordIterations),
        passwordIterations: externalPasswordIterations,
        createdAt: now,
        lastSignedInAt: now,
      }
      await this.#ctx.storage.transaction(async (transaction) => {
        const racedIdentity = await transaction.get<string>(`external-email:${emailHash}`)
        if (racedIdentity) {
          throw new EventAccessError(
            'ACCOUNT_EXISTS',
            'That account already exists. Sign in instead.',
            409,
          )
        }
        await transaction.put(`external-email:${emailHash}`, identity!.id)
        await transaction.put(`external-identity:${identity!.id}`, identity!)
      })
    } else {
      if (!identity) {
        throw new EventAccessError(
          'INVALID_CREDENTIALS',
          'The email or password is incorrect.',
          401,
        )
      }
      const candidate = await passwordHash(
        password,
        identity.passwordSalt,
        identity.passwordIterations,
      )
      if (!equalHex(candidate, identity.passwordHash)) {
        throw new EventAccessError(
          'INVALID_CREDENTIALS',
          'The email or password is incorrect.',
          401,
        )
      }
      identity = { ...identity, lastSignedInAt: new Date().toISOString() }
      await this.#ctx.storage.put(`external-identity:${identity.id}`, identity)
    }

    const token = randomHex(32)
    const tokenHash = await sha256(token)
    const session: ExternalSession = {
      identityId: identity.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + externalSessionLifetimeMs).toISOString(),
    }
    await this.#ctx.storage.put(`external-session:${tokenHash}`, session)
    await this.#scheduleCleanup(Date.parse(session.expiresAt))
    return {
      event,
      identity: { id: identity.id, email: identity.email },
      sessionToken: token,
      sessionExpiresAt: session.expiresAt,
    }
  }

  async #externalSession(input: Record<string, unknown>) {
    const event = await this.#event(input.eventId)
    const token = typeof input.token === 'string' ? input.token : ''
    if (!/^[a-f0-9]{64}$/u.test(token)) {
      throw new EventAccessError('SESSION_INVALID', 'Session is invalid.', 401)
    }
    const tokenHash = await sha256(token)
    const session = await this.#ctx.storage.get<ExternalSession>(`external-session:${tokenHash}`)
    if (!session || Date.parse(session.expiresAt) <= Date.now()) {
      if (session) await this.#ctx.storage.delete(`external-session:${tokenHash}`)
      throw new EventAccessError('SESSION_INVALID', 'Session is invalid.', 401)
    }
    const identity = await this.#ctx.storage.get<ExternalIdentity>(
      `external-identity:${session.identityId}`,
    )
    if (!identity || identity.eventId !== event.id) {
      throw new EventAccessError('SESSION_INVALID', 'Session is invalid.', 401)
    }
    return { event, identity: { id: identity.id, email: identity.email } }
  }

  async #logoutExternal(input: Record<string, unknown>) {
    await this.#event(input.eventId)
    const token = typeof input.token === 'string' ? input.token : ''
    if (/^[a-f0-9]{64}$/u.test(token)) {
      await this.#ctx.storage.delete(`external-session:${await sha256(token)}`)
    }
  }

  async #listApiKeys(input: ActorInput) {
    await this.#authorizedActor(input, ['owner', 'admin'])
    const apiKeys = [
      ...(await this.#ctx.storage.list<StoredEventApiKey>({ prefix: 'api-key:' })).values(),
    ]
      .map(publicApiKey)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return { apiKeys }
  }

  async #createApiKey(input: ApiKeyCreateInput) {
    const { event, actor } = await this.#authorizedActor(input, ['owner', 'admin'])
    const name = typeof input.name === 'string' ? input.name.trim().replace(/\s+/gu, ' ') : ''
    if (name.length < 2 || name.length > 60) {
      throw new EventAccessError('INVALID_INPUT', 'API key name must be 2 to 60 characters.', 400)
    }
    const scopes = cleanApiKeyScopes(input.scopes)
    let expiresAt: string | null = null
    if (input.expiresAt !== undefined && input.expiresAt !== null && input.expiresAt !== '') {
      if (typeof input.expiresAt !== 'string' || !Number.isFinite(Date.parse(input.expiresAt))) {
        throw new EventAccessError('INVALID_INPUT', 'API key expiry must be an ISO date.', 400)
      }
      expiresAt = new Date(input.expiresAt).toISOString()
      if (Date.parse(expiresAt) <= Date.now()) {
        throw new EventAccessError('INVALID_INPUT', 'API key expiry must be in the future.', 400)
      }
    }

    const existing = await this.#ctx.storage.list<StoredEventApiKey>({ prefix: 'api-key:' })
    const activeCount = [...existing.values()].filter(
      (apiKey) =>
        apiKey.revokedAt === null &&
        (apiKey.expiresAt === null || Date.parse(apiKey.expiresAt) > Date.now()),
    ).length
    if (activeCount >= maximumApiKeys) {
      throw new EventAccessError(
        'API_KEY_LIMIT',
        `An event can have at most ${maximumApiKeys} API keys. Revoke an old key first.`,
        409,
      )
    }

    const id = `key_${randomHex(8)}`
    const secret = randomHex(32)
    const token = `pk_live_${event.id}_${id}_${secret}`
    const now = new Date().toISOString()
    const apiKey: StoredEventApiKey = {
      id,
      eventId: event.id,
      name,
      prefix: `${token.slice(0, -secret.length)}${secret.slice(0, 8)}`,
      scopes,
      createdByUserId: actor.userId,
      createdAt: now,
      expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      secretHash: await sha256(token),
    }
    await this.#ctx.storage.put(`api-key:${id}`, apiKey)
    if (expiresAt) await this.#scheduleCleanup(Date.parse(expiresAt))
    return { apiKey: publicApiKey(apiKey), token }
  }

  async #revokeApiKey(input: ApiKeyMutationInput) {
    await this.#authorizedActor(input, ['owner', 'admin'])
    const apiKeyId = cleanIdentifier(input.apiKeyId, 'apiKeyId')
    const apiKey = await this.#ctx.storage.get<StoredEventApiKey>(`api-key:${apiKeyId}`)
    if (!apiKey) throw new EventAccessError('API_KEY_NOT_FOUND', 'API key was not found.', 404)
    if (apiKey.revokedAt) return { apiKey: publicApiKey(apiKey) }
    const revoked = { ...apiKey, revokedAt: new Date().toISOString() }
    await this.#ctx.storage.put(`api-key:${apiKey.id}`, revoked)
    return { apiKey: publicApiKey(revoked) }
  }

  async #verifyApiKey(input: Record<string, unknown>) {
    const event = await this.#event(input.eventId)
    const apiKeyId = cleanIdentifier(input.apiKeyId, 'apiKeyId')
    const token = typeof input.token === 'string' ? input.token : ''
    const apiKey = await this.#ctx.storage.get<StoredEventApiKey>(`api-key:${apiKeyId}`)
    const invalid =
      !apiKey ||
      apiKey.eventId !== event.id ||
      apiKey.revokedAt !== null ||
      (apiKey.expiresAt !== null && Date.parse(apiKey.expiresAt) <= Date.now()) ||
      !equalHex(apiKey.secretHash, await sha256(token))
    if (invalid || !apiKey) {
      throw new EventAccessError('API_KEY_INVALID', 'API key is invalid or inactive.', 401)
    }
    const used = { ...apiKey, lastUsedAt: new Date().toISOString() }
    await this.#ctx.storage.put(`api-key:${apiKey.id}`, used)
    return { apiKey: publicApiKey(used), scopes: used.scopes }
  }

  async #event(eventId?: unknown) {
    const event = await this.#ctx.storage.get<EventAccessEvent>('event')
    if (!event)
      throw new EventAccessError('EVENT_NOT_INITIALIZED', 'Event access is unavailable.', 404)
    if (eventId !== undefined && cleanEventId(eventId) !== event.id) {
      throw new EventAccessError('EVENT_MISMATCH', 'Event access does not match this object.', 409)
    }
    return event
  }

  async #activeMembership(userId: string, email: string) {
    const membershipId = await this.#ctx.storage.get<string>(`membership-user:${userId}`)
    if (!membershipId) return null
    const membership = await this.#ctx.storage.get<EventMembership>(`membership:${membershipId}`)
    return membership?.status === 'active' && membership.email === email ? membership : null
  }

  async #authorizedActor(input: ActorInput, roles: readonly EventRole[]) {
    const event = await this.#event(input.eventId)
    const actor = cleanActor(input.actor)
    const membership = await this.#activeMembership(actor.userId, actor.email)
    if (!membership || membership.eventId !== event.id || !roles.includes(membership.role)) {
      throw new EventAccessError(
        'FORBIDDEN',
        'The current account cannot manage this event access.',
        403,
      )
    }
    return { event, actor, membership }
  }

  async #initialize(input: InitializeInput) {
    const requestedEvent = cleanEvent(input.event)
    const owner = cleanActor(input.owner)
    const existingEvent = await this.#ctx.storage.get<EventAccessEvent>('event')
    if (existingEvent) {
      if (!sameEvent(existingEvent, requestedEvent)) {
        throw new EventAccessError(
          'EVENT_ALREADY_INITIALIZED',
          'This access object already belongs to another event.',
          409,
        )
      }
      const membership = await this.#activeMembership(owner.userId, owner.email)
      if (!membership || membership.role !== 'owner') {
        throw new EventAccessError(
          'OWNER_MISMATCH',
          'This event was initialized by another owner.',
          409,
        )
      }
      return { event: existingEvent, membership }
    }

    const now = new Date().toISOString()
    const membership: EventMembership = {
      id: `mem_${randomHex(12)}`,
      eventId: requestedEvent.id,
      userId: owner.userId,
      email: owner.email,
      role: 'owner',
      status: 'active',
      invitedByUserId: null,
      joinedAt: now,
      updatedAt: now,
      version: 1,
    }
    const emailHash = await sha256(owner.email)
    await this.#ctx.storage.transaction(async (transaction) => {
      const racedEvent = await transaction.get<EventAccessEvent>('event')
      if (racedEvent) {
        throw new EventAccessError(
          'EVENT_ALREADY_INITIALIZED',
          'This access object is already initialized.',
          409,
        )
      }
      await transaction.put('event', requestedEvent)
      await transaction.put(`membership:${membership.id}`, membership)
      await transaction.put(`membership-user:${membership.userId}`, membership.id)
      await transaction.put(`membership-email:${emailHash}`, membership.id)
    })
    return { event: requestedEvent, membership }
  }

  async #lookupMembership(input: MembershipLookupInput) {
    const event = await this.#event(input.eventId)
    const userId = cleanIdentifier(input.userId, 'userId')
    const email = normalizeEmail(input.email)
    if (!email) throw new EventAccessError('INVALID_INPUT', 'email is invalid.', 400)
    const membership = await this.#activeMembership(userId, email)
    if (!membership || membership.eventId !== event.id) {
      throw new EventAccessError('MEMBERSHIP_NOT_FOUND', 'Event membership was not found.', 404)
    }
    return { membership, scopes: eventScopesForRole(membership.role) }
  }

  async #listMemberships(input: ActorInput) {
    await this.#authorizedActor(input, ['owner', 'admin'])
    const memberships = [
      ...(await this.#ctx.storage.list<EventMembership>({ prefix: 'membership:' })).values(),
    ]
      .filter((membership) => membership.status === 'active')
      .sort((left, right) => left.joinedAt.localeCompare(right.joinedAt))
    return { memberships }
  }

  async #createInvitation(input: InvitationCreateInput) {
    const {
      event,
      actor,
      membership: actorMembership,
    } = await this.#authorizedActor(input, ['owner', 'admin'])
    const email = normalizeEmail(input.email)
    if (!email) throw new EventAccessError('INVALID_INPUT', 'email is invalid.', 400)
    const role = input.role
    if (role !== 'admin' && role !== 'member') {
      throw new EventAccessError('INVALID_INPUT', 'role must be admin or member.', 400)
    }
    if (role === 'admin' && actorMembership.role !== 'owner') {
      throw new EventAccessError('FORBIDDEN', 'Only an owner can invite an administrator.', 403)
    }

    const now = new Date()
    const nowIso = now.toISOString()
    const emailHash = await sha256(email)
    const existingMembershipId = await this.#ctx.storage.get<string>(
      `membership-email:${emailHash}`,
    )
    const existingMembership = existingMembershipId
      ? await this.#ctx.storage.get<EventMembership>(`membership:${existingMembershipId}`)
      : null
    if (existingMembership?.status === 'active') {
      throw new EventAccessError(
        'MEMBERSHIP_EXISTS',
        'That email already has access to this event.',
        409,
      )
    }

    const secret = randomHex(32)
    const token = `${event.id}.${secret}`
    const tokenHash = await sha256(token)
    const invitation: StoredEventInvitation = {
      id: `inv_${randomHex(12)}`,
      eventId: event.id,
      email,
      role,
      tokenHash,
      invitedByUserId: actor.userId,
      createdAt: nowIso,
      expiresAt: new Date(now.getTime() + invitationLifetimeMs).toISOString(),
      acceptedAt: null,
      acceptedByUserId: null,
      revokedAt: null,
    }

    await this.#ctx.storage.transaction(async (transaction) => {
      const invitations = [
        ...(await transaction.list<StoredEventInvitation>({ prefix: 'invitation:' })).values(),
      ]
      const pendingForEmail = invitations.find(
        (candidate) =>
          candidate.email === email && invitationStatus(candidate, now.getTime()) === 'pending',
      )
      const pendingCount = invitations.filter(
        (candidate) => invitationStatus(candidate, now.getTime()) === 'pending',
      ).length
      if (pendingCount - (pendingForEmail ? 1 : 0) >= maximumPendingInvitations) {
        throw new EventAccessError(
          'INVITATION_LIMIT',
          'This event has too many pending invitations.',
          429,
        )
      }
      if (pendingForEmail) {
        await transaction.put(`invitation:${pendingForEmail.id}`, {
          ...pendingForEmail,
          revokedAt: nowIso,
        } satisfies StoredEventInvitation)
        await transaction.delete(`invite-token:${pendingForEmail.tokenHash}`)
      }
      await transaction.put(`invitation:${invitation.id}`, invitation)
      await transaction.put(`invite-token:${tokenHash}`, invitation.id)
    })
    await this.#scheduleCleanup(Date.parse(invitation.expiresAt))
    return { invitation: publicInvitation(invitation), token }
  }

  async #listInvitations(input: ActorInput) {
    await this.#authorizedActor(input, ['owner', 'admin'])
    const invitations = [
      ...(await this.#ctx.storage.list<StoredEventInvitation>({ prefix: 'invitation:' })).values(),
    ]
      .map(publicInvitation)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    return { invitations }
  }

  async #revokeInvitation(input: InvitationMutationInput) {
    const { membership: actorMembership } = await this.#authorizedActor(input, ['owner', 'admin'])
    const invitationId = cleanIdentifier(input.invitationId, 'invitationId')
    const invitation = await this.#ctx.storage.get<StoredEventInvitation>(
      `invitation:${invitationId}`,
    )
    if (!invitation) {
      throw new EventAccessError('INVITATION_NOT_FOUND', 'Invitation was not found.', 404)
    }
    if (actorMembership.role !== 'owner' && invitation.role !== 'member') {
      throw new EventAccessError(
        'FORBIDDEN',
        'Only an owner can manage administrator invitations.',
        403,
      )
    }
    const status = invitationStatus(invitation)
    if (status === 'accepted') {
      throw new EventAccessError(
        'INVITATION_ACCEPTED',
        'Accepted invitations cannot be revoked.',
        409,
      )
    }
    if (status === 'expired') {
      throw new EventAccessError('INVITATION_EXPIRED', 'This invitation has expired.', 409)
    }
    if (status === 'revoked') return { invitation: publicInvitation(invitation) }

    const revoked = { ...invitation, revokedAt: new Date().toISOString() }
    await this.#ctx.storage.transaction(async (transaction) => {
      await transaction.put(`invitation:${invitation.id}`, revoked)
      await transaction.delete(`invite-token:${invitation.tokenHash}`)
    })
    return { invitation: publicInvitation(revoked) }
  }

  async #consumeInvitation(input: InvitationConsumeInput) {
    const event = await this.#event(input.eventId)
    const token = typeof input.token === 'string' ? input.token.trim() : ''
    const tokenMatch = token.match(tokenPattern)
    if (!tokenMatch || tokenMatch[1] !== event.id) {
      throw new EventAccessError('INVITATION_INVALID', 'Invitation token is invalid.', 400)
    }
    const userId = cleanIdentifier(input.userId, 'userId')
    const email = normalizeEmail(input.email)
    if (!email) throw new EventAccessError('INVALID_INPUT', 'email is invalid.', 400)
    const tokenHash = await sha256(token)
    const emailHash = await sha256(email)
    const nowIso = new Date().toISOString()

    const result = await this.#ctx.storage.transaction(async (transaction) => {
      const invitationId = await transaction.get<string>(`invite-token:${tokenHash}`)
      if (!invitationId) {
        throw new EventAccessError(
          'INVITATION_INVALID',
          'Invitation is invalid or has already been used.',
          404,
        )
      }
      const invitation = await transaction.get<StoredEventInvitation>(`invitation:${invitationId}`)
      if (!invitation || invitation.tokenHash !== tokenHash || invitation.eventId !== event.id) {
        throw new EventAccessError('INVITATION_INVALID', 'Invitation is invalid.', 404)
      }
      const status = invitationStatus(invitation)
      if (status !== 'pending') {
        throw new EventAccessError(
          status === 'expired' ? 'INVITATION_EXPIRED' : 'INVITATION_INVALID',
          status === 'expired' ? 'This invitation has expired.' : 'Invitation is no longer active.',
          status === 'expired' ? 410 : 409,
        )
      }
      if (invitation.email !== email) {
        throw new EventAccessError(
          'INVITATION_EMAIL_MISMATCH',
          'Sign in with the email address that received this invitation.',
          403,
        )
      }

      const existingUserMembershipId = await transaction.get<string>(`membership-user:${userId}`)
      const existingEmailMembershipId = await transaction.get<string>(
        `membership-email:${emailHash}`,
      )
      for (const existingId of new Set(
        [existingUserMembershipId, existingEmailMembershipId].filter((value): value is string =>
          Boolean(value),
        ),
      )) {
        const existing = await transaction.get<EventMembership>(`membership:${existingId}`)
        if (existing?.status === 'active') {
          throw new EventAccessError(
            'MEMBERSHIP_EXISTS',
            'This account already has access to the event.',
            409,
          )
        }
      }

      const membership: EventMembership = {
        id: `mem_${randomHex(12)}`,
        eventId: event.id,
        userId,
        email,
        role: invitation.role,
        status: 'active',
        invitedByUserId: invitation.invitedByUserId,
        joinedAt: nowIso,
        updatedAt: nowIso,
        version: 1,
      }
      const accepted: StoredEventInvitation = {
        ...invitation,
        acceptedAt: nowIso,
        acceptedByUserId: userId,
      }
      await transaction.put(`membership:${membership.id}`, membership)
      await transaction.put(`membership-user:${userId}`, membership.id)
      await transaction.put(`membership-email:${emailHash}`, membership.id)
      await transaction.put(`invitation:${invitation.id}`, accepted)
      await transaction.delete(`invite-token:${tokenHash}`)
      return { membership, invitation: publicInvitation(accepted) }
    })
    return { ...result, event }
  }

  async #revokeMembership(input: MembershipMutationInput) {
    const { membership: actorMembership } = await this.#authorizedActor(input, ['owner', 'admin'])
    const membershipId = cleanIdentifier(input.membershipId, 'membershipId')
    const target = await this.#ctx.storage.get<EventMembership>(`membership:${membershipId}`)
    if (!target) {
      throw new EventAccessError('MEMBERSHIP_NOT_FOUND', 'Event membership was not found.', 404)
    }
    if (target.status === 'revoked') return { membership: target }
    if (target.id === actorMembership.id) {
      throw new EventAccessError('SELF_REMOVAL', 'You cannot remove your own access here.', 409)
    }
    if (actorMembership.role !== 'owner' && target.role !== 'member') {
      throw new EventAccessError('FORBIDDEN', 'Only an owner can revoke administrator access.', 403)
    }

    const revoked = await this.#ctx.storage.transaction(async (transaction) => {
      const current = await transaction.get<EventMembership>(`membership:${membershipId}`)
      if (!current) {
        throw new EventAccessError('MEMBERSHIP_NOT_FOUND', 'Event membership was not found.', 404)
      }
      if (current.status === 'revoked') return current
      if (current.role === 'owner') {
        const memberships = [
          ...(await transaction.list<EventMembership>({ prefix: 'membership:' })).values(),
        ]
        const activeOwners = memberships.filter(
          (membership) => membership.status === 'active' && membership.role === 'owner',
        )
        if (activeOwners.length <= 1) {
          throw new EventAccessError(
            'LAST_OWNER',
            'The last owner cannot be removed from an event.',
            409,
          )
        }
      }
      const updated: EventMembership = {
        ...current,
        status: 'revoked',
        updatedAt: new Date().toISOString(),
        version: current.version + 1,
      }
      await transaction.put(`membership:${current.id}`, updated)
      return updated
    })
    return { membership: revoked }
  }

  async #scheduleCleanup(expiresAt: number) {
    const current = await this.#ctx.storage.getAlarm()
    if (current == null || current > expiresAt) await this.#ctx.storage.setAlarm(expiresAt)
  }

  async alarm() {
    const now = Date.now()
    let next: number | null = null
    const invitations = await this.#ctx.storage.list<StoredEventInvitation>({
      prefix: 'invitation:',
    })
    for (const invitation of invitations.values()) {
      if (invitationStatus(invitation, now) !== 'pending') {
        await this.#ctx.storage.delete(`invite-token:${invitation.tokenHash}`)
        continue
      }
      const expiresAt = Date.parse(invitation.expiresAt)
      next = next == null ? expiresAt : Math.min(next, expiresAt)
    }
    const sessions = await this.#ctx.storage.list<ExternalSession>({
      prefix: 'external-session:',
    })
    for (const [key, session] of sessions) {
      const expiresAt = Date.parse(session.expiresAt)
      if (expiresAt <= now) await this.#ctx.storage.delete(key)
      else next = next == null ? expiresAt : Math.min(next, expiresAt)
    }
    for (const [key, record] of await this.#ctx.storage.list<ExternalRateRecord>({
      prefix: 'external-rate:',
    })) {
      if (record.attempts.every((attempt) => attempt <= now - externalRateWindowMs)) {
        await this.#ctx.storage.delete(key)
      }
    }
    if (next == null) await this.#ctx.storage.deleteAlarm()
    else await this.#ctx.storage.setAlarm(next)
  }

  async fetch(request: Request) {
    if (request.method !== 'POST') return new Response(null, { status: 405 })
    try {
      const input = (await request.json()) as Record<string, unknown>
      const path = new URL(request.url).pathname

      if (path === '/internal/event-access/initialize') {
        return json({ ok: true, ...(await this.#initialize(input)) }, { status: 201 })
      }
      if (path === '/internal/event-access/memberships/lookup') {
        return json({ ok: true, ...(await this.#lookupMembership(input)) })
      }
      if (path === '/internal/event-access/memberships/list') {
        return json({ ok: true, ...(await this.#listMemberships(input)) })
      }
      if (path === '/internal/event-access/memberships/revoke') {
        return json({ ok: true, ...(await this.#revokeMembership(input)) })
      }
      if (path === '/internal/event-access/invitations/create') {
        return json({ ok: true, ...(await this.#createInvitation(input)) }, { status: 201 })
      }
      if (path === '/internal/event-access/invitations/list') {
        return json({ ok: true, ...(await this.#listInvitations(input)) })
      }
      if (path === '/internal/event-access/invitations/revoke') {
        return json({ ok: true, ...(await this.#revokeInvitation(input)) })
      }
      if (path === '/internal/event-access/invitations/consume') {
        return json({ ok: true, ...(await this.#consumeInvitation(input)) }, { status: 201 })
      }
      if (path === '/internal/event-access/external/password') {
        return json(
          { ok: true, ...(await this.#authenticateExternal(input)) },
          { status: input.intent === 'signup' ? 201 : 200 },
        )
      }
      if (path === '/internal/event-access/external/session') {
        return json({ ok: true, ...(await this.#externalSession(input)) })
      }
      if (path === '/internal/event-access/external/logout') {
        await this.#logoutExternal(input)
        return json({ ok: true })
      }
      if (path === '/internal/event-access/api-keys/list') {
        return json({ ok: true, ...(await this.#listApiKeys(input)) })
      }
      if (path === '/internal/event-access/api-keys/create') {
        return json({ ok: true, ...(await this.#createApiKey(input)) }, { status: 201 })
      }
      if (path === '/internal/event-access/api-keys/revoke') {
        return json({ ok: true, ...(await this.#revokeApiKey(input)) })
      }
      if (path === '/internal/event-access/api-keys/verify') {
        return json({ ok: true, ...(await this.#verifyApiKey(input)) })
      }
      return new Response(null, { status: 404 })
    } catch (error) {
      if (error instanceof EventAccessError) {
        return json({ ok: false, code: error.code, error: error.message }, { status: error.status })
      }
      return json(
        { ok: false, code: 'INTERNAL_ERROR', error: 'Event access could not be updated.' },
        { status: 500 },
      )
    }
  }
}
