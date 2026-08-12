import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthDurableObject, cloudflarePasswordIterations } from '../apps/cloudflare/src/auth.ts'
import {
  defaultPasswordFailureRateLimits,
  passwordFailureRateLimits,
} from '../apps/cloudflare/src/password-rate-limit.ts'
import { MemoryStorage } from './support/cloudflare-workers.ts'

function request(path: string, input: Record<string, unknown>) {
  return new Request(`http://auth.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
}

async function body(response: Response) {
  return (await response.json()) as {
    ok: boolean
    token?: string
    sessionToken?: string
    account?: {
      user: { id: string; name: string; email: string }
      events: Array<{
        id: string
        organizationId: string
        name: string
        slug: string
        membershipId?: string
        membershipVersion?: number
        role: string
      }>
      activeEventId: string
    }
  }
}

describe('AuthDurableObject membership projections', () => {
  let auth: AuthDurableObject
  let storage: MemoryStorage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'))
    storage = new MemoryStorage()
    auth = new AuthDurableObject({ storage } as unknown as DurableObjectState, {} as Cloudflare.Env)
  })

  afterEach(() => vi.useRealTimers())

  it('keeps password derivation within the Cloudflare Workers PBKDF2 limit', () => {
    expect(cloudflarePasswordIterations).toBe(100_000)
  })

  it('keeps password failure limits conservative and permits bounded self-host overrides', () => {
    expect(passwordFailureRateLimits({})).toEqual(defaultPasswordFailureRateLimits)
    expect(
      passwordFailureRateLimits({
        PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '25',
        PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: 80,
      }),
    ).toEqual({ email: 25, ip: 80 })
    expect(
      passwordFailureRateLimits({
        PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '0',
        PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: 'not-a-number',
      }),
    ).toEqual(defaultPasswordFailureRateLimits)
  })

  it('links and unlinks event membership projections from the account switcher', async () => {
    const issuedResponse = await auth.fetch(
      request('/internal/auth/request', {
        email: 'owner@example.com',
        ipHash: 'ip-hash',
      }),
    )
    const issued = await body(issuedResponse)
    expect(issued.token).toBeTruthy()

    const consumedResponse = await auth.fetch(
      request('/internal/auth/consume', { token: issued.token }),
    )
    const consumed = await body(consumedResponse)
    const sessionToken = consumed.sessionToken!
    const userId = consumed.account!.user.id
    expect(consumed.account!.events).toHaveLength(1)

    const eventId = 'evt_abcdefabcdefabcdefabcdef'
    const linkedResponse = await auth.fetch(
      request('/internal/memberships/link', {
        token: sessionToken,
        eventId,
        organizationId: 'org_abcdefabcdefabcdefabcdef',
        membershipId: 'mem_abcdefabcdefabcdefabcdef',
        membershipVersion: 1,
        name: 'Shared conference',
        slug: 'shared-conference',
        role: 'admin',
        createdAt: '2026-08-09T12:00:00.000Z',
        joinedAt: '2026-08-09T12:01:00.000Z',
      }),
    )
    expect(linkedResponse.status).toBe(200)

    const sessionResponse = await auth.fetch(
      request('/internal/auth/session', { token: sessionToken, preferredEventId: eventId }),
    )
    const session = await body(sessionResponse)
    expect(session.account).toMatchObject({ activeEventId: eventId })
    expect(session.account!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: eventId,
          organizationId: 'org_abcdefabcdefabcdefabcdef',
          role: 'admin',
          membershipId: 'mem_abcdefabcdefabcdefabcdef',
          membershipVersion: 1,
        }),
      ]),
    )

    const syncedResponse = await auth.fetch(
      request('/internal/events/sync', {
        token: sessionToken,
        eventId,
        name: 'Shared conference 2027',
        slug: 'shared-conference-2027',
      }),
    )
    expect(syncedResponse.status).toBe(200)
    const syncedSession = await body(
      await auth.fetch(
        request('/internal/auth/session', { token: sessionToken, preferredEventId: eventId }),
      ),
    )
    expect(syncedSession.account!.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: eventId,
          name: 'Shared conference 2027',
          slug: 'shared-conference-2027',
        }),
      ]),
    )

    const unlinkedResponse = await auth.fetch(
      request('/internal/memberships/unlink', {
        userId,
        eventId,
        membershipId: 'mem_abcdefabcdefabcdefabcdef',
      }),
    )
    expect(unlinkedResponse.status).toBe(200)

    const afterResponse = await auth.fetch(
      request('/internal/auth/session', { token: sessionToken, preferredEventId: eventId }),
    )
    const after = await body(afterResponse)
    expect(after.account!.events).toHaveLength(1)
    expect(after.account!.events[0].id).not.toBe(eventId)
  })

  it('creates and returns to a password account without exposing password state', async () => {
    const signupResponse = await auth.fetch(
      request('/internal/auth/password', {
        email: 'jordan@example.com',
        name: 'Jordan Alvarez',
        password: 'correct horse battery staple',
        intent: 'signup',
        ipHash: 'local-test',
      }),
    )
    expect(signupResponse.status).toBe(201)
    const signup = (await signupResponse.json()) as {
      ok: boolean
      sessionToken: string
      account: { user: { name: string; email: string }; events: unknown[] }
    }
    expect(signup.ok).toBe(true)
    expect(signup.sessionToken).toMatch(/^[a-f0-9]{64}$/u)
    expect(signup.account.user.email).toBe('jordan@example.com')
    expect(signup.account.user.name).toBe('Jordan Alvarez')
    expect(signup.account.events).toHaveLength(1)
    expect(JSON.stringify(signup)).not.toContain('correct horse')

    vi.advanceTimersByTime(1_000)
    const signinResponse = await auth.fetch(
      request('/internal/auth/password', {
        email: 'JORDAN@example.com',
        password: 'correct horse battery staple',
        intent: 'signin',
        ipHash: 'second-test',
      }),
    )
    expect(signinResponse.status).toBe(200)
    const signin = (await signinResponse.json()) as { ok: boolean; sessionToken: string }
    expect(signin.ok).toBe(true)
    expect(signin.sessionToken).not.toBe(signup.sessionToken)

    const invalidResponse = await auth.fetch(
      request('/internal/auth/password', {
        email: 'jordan@example.com',
        password: 'incorrect password',
        intent: 'signin',
        ipHash: 'third-test',
      }),
    )
    expect(invalidResponse.status).toBe(401)
    await expect(invalidResponse.json()).resolves.toEqual({ ok: false })
  })

  it('counts password failures, not successful organizer sign-ins', async () => {
    const email = 'repeat-organizer@example.com'
    const password = 'correct horse battery staple'
    const ipHash = 'repeat-organizer-ip'
    const signup = await auth.fetch(
      request('/internal/auth/password', {
        email,
        name: 'Repeat Organizer',
        password,
        intent: 'signup',
        ipHash,
      }),
    )
    expect(signup.status).toBe(201)

    for (let index = 0; index < 12; index += 1) {
      const response = await auth.fetch(
        request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
      )
      expect(response.status).toBe(200)
    }

    for (let index = 0; index < 12; index += 1) {
      const response = await auth.fetch(
        request('/internal/auth/password', {
          email,
          name: 'Repeat Organizer',
          password,
          intent: 'signup',
          ipHash,
        }),
      )
      expect(response.status).toBe(401)
    }
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
        )
      ).status,
    ).toBe(200)

    for (let index = 0; index < 9; index += 1) {
      const response = await auth.fetch(
        request('/internal/auth/password', {
          email,
          password: 'incorrect password',
          intent: 'signin',
          ipHash,
        }),
      )
      expect(response.status).toBe(401)
    }
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
        )
      ).status,
    ).toBe(200)

    for (let index = 0; index < 9; index += 1) {
      await auth.fetch(
        request('/internal/auth/password', {
          email,
          password: 'incorrect password',
          intent: 'signin',
          ipHash,
        }),
      )
    }
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
        )
      ).status,
    ).toBe(200)
  })

  it('blocks an organizer account after the default ten password failures', async () => {
    const email = 'limited-organizer@example.com'
    const password = 'correct horse battery staple'
    const ipHash = 'limited-organizer-ip'
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', {
            email,
            name: 'Limited Organizer',
            password,
            intent: 'signup',
            ipHash,
          }),
        )
      ).status,
    ).toBe(201)

    for (let index = 0; index < defaultPasswordFailureRateLimits.email; index += 1) {
      await auth.fetch(
        request('/internal/auth/password', {
          email,
          password: 'incorrect password',
          intent: 'signin',
          ipHash,
        }),
      )
    }

    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
        )
      ).status,
    ).toBe(401)

    vi.advanceTimersByTime(60 * 60 * 1_000 + 1)
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', { email, password, intent: 'signin', ipHash }),
        )
      ).status,
    ).toBe(200)
  })

  it('creates multiple events and honors the selected event on the next request', async () => {
    const signupResponse = await auth.fetch(
      request('/internal/auth/password', {
        email: 'multi-event@example.com',
        name: 'Jordan Alvarez',
        password: 'correct horse battery staple',
        intent: 'signup',
        ipHash: 'multi-event-test',
      }),
    )
    const signup = await body(signupResponse)
    const sessionToken = signup.sessionToken!
    const firstEventId = signup.account!.activeEventId

    const createdResponse = await auth.fetch(
      request('/internal/events/create', {
        token: sessionToken,
        name: 'DevFlow Conf 2027',
      }),
    )
    expect(createdResponse.status).toBe(201)
    const created = (await createdResponse.json()) as {
      ok: boolean
      event: { id: string; name: string; slug: string; role: string }
    }
    expect(created).toMatchObject({
      ok: true,
      event: { name: 'DevFlow Conf 2027', slug: 'devflow-conf-2027', role: 'owner' },
    })
    expect(created.event.id).toMatch(/^evt_[a-f0-9]{24}$/u)

    const duplicateResponse = await auth.fetch(
      request('/internal/events/create', {
        token: sessionToken,
        name: 'DevFlow Conf 2027',
      }),
    )
    const duplicate = (await duplicateResponse.json()) as {
      ok: boolean
      event: { id: string; slug: string }
    }
    expect(duplicateResponse.status).toBe(201)
    expect(duplicate.event).toMatchObject({ slug: 'devflow-conf-2027-2' })

    const selectedResponse = await auth.fetch(
      request('/internal/auth/session', {
        token: sessionToken,
        preferredEventId: created.event.id,
      }),
    )
    const selected = await body(selectedResponse)
    expect(selected.account!.activeEventId).toBe(created.event.id)
    expect(selected.account!.events).toHaveLength(3)
    expect(new Set(selected.account!.events.map((event) => event.organizationId))).toHaveLength(1)
    expect(selected.account!.events.map((event) => event.id)).toEqual(
      expect.arrayContaining([firstEventId, created.event.id, duplicate.event.id]),
    )
  })

  it('does not let password signup claim an existing passwordless account', async () => {
    const issuedResponse = await auth.fetch(
      request('/internal/auth/request', {
        email: 'existing@example.com',
        ipHash: 'existing-test',
      }),
    )
    const issued = await body(issuedResponse)
    await auth.fetch(request('/internal/auth/consume', { token: issued.token }))

    const response = await auth.fetch(
      request('/internal/auth/password', {
        email: 'existing@example.com',
        password: 'correct horse battery staple',
        intent: 'signup',
        ipHash: 'claim-test',
      }),
    )
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({ ok: false })
  })

  it('indexes participant emails without leaking them into the directory keys', async () => {
    const eventId = 'evt_abcdefabcdefabcdefabcdef'
    const registration = await auth.fetch(
      request('/internal/external-directory/register', {
        eventId,
        name: 'Shared conference',
        slug: 'shared-conference',
        emails: ['Speaker@Example.com', 'speaker@example.com', 'reviewer@example.com'],
      }),
    )
    expect(registration.status).toBe(200)
    await expect(registration.json()).resolves.toMatchObject({ ok: true, indexed: 2 })

    const lookup = await auth.fetch(
      request('/internal/external-directory/lookup', { email: 'SPEAKER@example.com' }),
    )
    await expect(lookup.json()).resolves.toMatchObject({
      ok: true,
      events: [
        {
          id: eventId,
          name: 'Shared conference',
          slug: 'shared-conference',
        },
      ],
    })

    expect([...storage.values.keys()].some((key) => key.includes('speaker@example.com'))).toBe(
      false,
    )
  })

  it('removes stale participant access when an event roster changes', async () => {
    const eventId = 'evt_abcdefabcdefabcdefabcdef'
    await auth.fetch(
      request('/internal/external-directory/register', {
        eventId,
        name: 'Shared conference',
        slug: 'shared-conference',
        emails: ['former@example.com', 'current@example.com'],
      }),
    )
    await auth.fetch(
      request('/internal/external-directory/register', {
        eventId,
        name: 'Shared conference',
        slug: 'shared-conference',
        emails: ['current@example.com'],
      }),
    )

    const former = await auth.fetch(
      request('/internal/external-directory/lookup', { email: 'former@example.com' }),
    )
    await expect(former.json()).resolves.toEqual({ ok: true, events: [] })

    const current = await auth.fetch(
      request('/internal/external-directory/lookup', { email: 'current@example.com' }),
    )
    await expect(current.json()).resolves.toMatchObject({
      ok: true,
      events: [expect.objectContaining({ id: eventId })],
    })
  })

  it('rejects malformed participant directory registrations', async () => {
    const response = await auth.fetch(
      request('/internal/external-directory/register', {
        eventId: 'default',
        name: 'Shared conference',
        slug: 'shared-conference',
        emails: ['speaker@example.com'],
      }),
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ ok: false })
  })
})
