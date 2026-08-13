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

  it('reserves the first self-host signup, closes it after owner bootstrap, and lets the owner choose open signup', async () => {
    const initial = await auth.fetch(
      request('/internal/instance/access', {
        action: 'status',
        defaultMode: 'bootstrap',
        bootstrapConfigured: true,
      }),
    )
    await expect(initial.json()).resolves.toMatchObject({
      ok: true,
      managed: true,
      initialized: false,
      policy: 'invite_only',
      signupAvailable: true,
    })

    const missingSetupCode = await auth.fetch(
      request('/internal/instance/access', {
        action: 'begin_signup',
        defaultMode: 'bootstrap',
        bootstrapConfigured: true,
        bootstrapAuthorized: false,
        email: 'first-owner@example.com',
      }),
    )
    expect(missingSetupCode.status).toBe(409)
    await expect(missingSetupCode.json()).resolves.toMatchObject({
      ok: false,
      code: 'BOOTSTRAP_TOKEN_INVALID',
    })

    const reservation = await auth.fetch(
      request('/internal/instance/access', {
        action: 'begin_signup',
        defaultMode: 'bootstrap',
        bootstrapConfigured: true,
        bootstrapAuthorized: true,
        email: 'first-owner@example.com',
      }),
    )
    await expect(reservation.json()).resolves.toMatchObject({
      ok: true,
      claimInstanceOwner: true,
    })
    const competing = await auth.fetch(
      request('/internal/instance/access', {
        action: 'begin_signup',
        defaultMode: 'bootstrap',
        bootstrapConfigured: true,
        bootstrapAuthorized: true,
        email: 'other-owner@example.com',
      }),
    )
    expect(competing.status).toBe(409)
    await expect(competing.json()).resolves.toMatchObject({ code: 'SIGNUP_IN_PROGRESS' })

    const ownerUserId = 'usr_abcdefabcdefabcdefabcdef'
    const completed = await auth.fetch(
      request('/internal/instance/access', {
        action: 'complete_signup',
        defaultMode: 'bootstrap',
        email: 'first-owner@example.com',
        userId: ownerUserId,
      }),
    )
    await expect(completed.json()).resolves.toMatchObject({
      ok: true,
      initialized: true,
      policy: 'invite_only',
      signupAvailable: false,
    })

    const ownerStatus = await auth.fetch(
      request('/internal/instance/access', {
        action: 'status',
        defaultMode: 'bootstrap',
        email: 'first-owner@example.com',
        userId: ownerUserId,
      }),
    )
    await expect(ownerStatus.json()).resolves.toMatchObject({
      isInstanceOwner: true,
      signupAvailable: false,
    })

    const opened = await auth.fetch(
      request('/internal/instance/access', {
        action: 'update',
        defaultMode: 'bootstrap',
        email: 'first-owner@example.com',
        userId: ownerUserId,
        policy: 'open',
      }),
    )
    await expect(opened.json()).resolves.toMatchObject({
      ok: true,
      policy: 'open',
      signupAvailable: true,
    })
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

  it('changes an authenticated password and revokes every other session and pending sign-in link', async () => {
    const email = 'security@example.com'
    const originalPassword = 'correct horse battery staple'
    const newPassword = 'a newly chosen secure password'
    const signupResponse = await auth.fetch(
      request('/internal/auth/password', {
        email,
        name: 'Security Owner',
        password: originalPassword,
        intent: 'signup',
        ipHash: 'security-signup',
      }),
    )
    const signup = (await signupResponse.json()) as { sessionToken: string }
    vi.advanceTimersByTime(1_000)
    const signinResponse = await auth.fetch(
      request('/internal/auth/password', {
        email,
        password: originalPassword,
        intent: 'signin',
        ipHash: 'security-signin',
      }),
    )
    const signin = (await signinResponse.json()) as { sessionToken: string }
    const pendingLink = await body(
      await auth.fetch(
        request('/internal/auth/request', { email, ipHash: 'security-link-request' }),
      ),
    )
    const otherPendingLink = await body(
      await auth.fetch(
        request('/internal/auth/request', {
          email: 'another-owner@example.com',
          ipHash: 'another-security-link-request',
        }),
      ),
    )

    const beforeResponse = await auth.fetch(
      request('/internal/auth/security', { token: signin.sessionToken }),
    )
    const before = (await beforeResponse.json()) as {
      ok: boolean
      email: string
      passwordConfigured: boolean
      sessions: Array<{ id: string; current: boolean; createdAt: string; expiresAt: string }>
    }
    expect(before).toMatchObject({
      ok: true,
      email,
      passwordConfigured: true,
    })
    expect(before.sessions).toHaveLength(2)
    expect(before.sessions.filter((session) => session.current)).toHaveLength(1)
    expect(before.sessions.every((session) => /^ses_[a-f0-9]{24}$/u.test(session.id))).toBe(true)
    expect(JSON.stringify(before)).not.toContain(signin.sessionToken)

    const changedResponse = await auth.fetch(
      request('/internal/auth/password/change', {
        token: signin.sessionToken,
        currentPassword: originalPassword,
        newPassword,
        ipHash: 'security-change',
      }),
    )
    expect(changedResponse.status).toBe(200)
    await expect(changedResponse.json()).resolves.toMatchObject({
      ok: true,
      passwordConfigured: true,
      revokedSessions: 1,
    })

    expect(
      (await auth.fetch(request('/internal/auth/session', { token: signup.sessionToken }))).status,
    ).toBe(401)
    expect(
      (await auth.fetch(request('/internal/auth/session', { token: signin.sessionToken }))).status,
    ).toBe(200)
    await expect(
      auth
        .fetch(request('/internal/auth/consume', { token: pendingLink.token }))
        .then((response) => response.json()),
    ).resolves.toEqual({ ok: false })
    await expect(
      auth
        .fetch(request('/internal/auth/consume', { token: otherPendingLink.token }))
        .then((response) => response.json()),
    ).resolves.toMatchObject({ ok: true })

    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', {
            email,
            password: originalPassword,
            intent: 'signin',
            ipHash: 'old-password-signin',
          }),
        )
      ).status,
    ).toBe(401)
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', {
            email,
            password: newPassword,
            intent: 'signin',
            ipHash: 'new-password-signin',
          }),
        )
      ).status,
    ).toBe(200)
  })

  it('lets an authenticated passwordless account set its first password', async () => {
    const email = 'passwordless-owner@example.com'
    const issued = await body(
      await auth.fetch(request('/internal/auth/request', { email, ipHash: 'passwordless-link' })),
    )
    const consumed = await body(
      await auth.fetch(request('/internal/auth/consume', { token: issued.token })),
    )

    await expect(
      auth
        .fetch(request('/internal/auth/security', { token: consumed.sessionToken }))
        .then((response) => response.json()),
    ).resolves.toMatchObject({ ok: true, email, passwordConfigured: false })

    const changedResponse = await auth.fetch(
      request('/internal/auth/password/change', {
        token: consumed.sessionToken,
        newPassword: 'passwordless account now secured',
        ipHash: 'passwordless-change',
      }),
    )
    expect(changedResponse.status).toBe(200)
    await expect(changedResponse.json()).resolves.toMatchObject({
      ok: true,
      passwordConfigured: true,
      revokedSessions: 0,
    })
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', {
            email,
            password: 'passwordless account now secured',
            intent: 'signin',
            ipHash: 'passwordless-signin',
          }),
        )
      ).status,
    ).toBe(200)
  })

  it('rejects an incorrect current password without changing credentials or sessions', async () => {
    const email = 'protected-change@example.com'
    const password = 'correct horse battery staple'
    const signup = (await (
      await auth.fetch(
        request('/internal/auth/password', {
          email,
          password,
          intent: 'signup',
          ipHash: 'protected-signup',
        }),
      )
    ).json()) as { sessionToken: string }
    const signin = (await (
      await auth.fetch(
        request('/internal/auth/password', {
          email,
          password,
          intent: 'signin',
          ipHash: 'protected-signin',
        }),
      )
    ).json()) as { sessionToken: string }

    const rejected = await auth.fetch(
      request('/internal/auth/password/change', {
        token: signin.sessionToken,
        currentPassword: 'this password is not right',
        newPassword: 'a different secure password',
        ipHash: 'protected-change',
      }),
    )
    expect(rejected.status).toBe(401)
    await expect(rejected.json()).resolves.toEqual({
      ok: false,
      code: 'CURRENT_PASSWORD_INVALID',
    })
    expect(
      (await auth.fetch(request('/internal/auth/session', { token: signup.sessionToken }))).status,
    ).toBe(200)
    expect(
      (
        await auth.fetch(
          request('/internal/auth/password', {
            email,
            password,
            intent: 'signin',
            ipHash: 'protected-original-signin',
          }),
        )
      ).status,
    ).toBe(200)
  })

  it('revokes one named session or all other sessions without revoking the current one', async () => {
    const email = 'sessions@example.com'
    const password = 'correct horse battery staple'
    const tokens: string[] = []
    for (const [index, intent] of ['signup', 'signin', 'signin'].entries()) {
      vi.advanceTimersByTime(1_000)
      const response = await auth.fetch(
        request('/internal/auth/password', {
          email,
          password,
          intent,
          ipHash: `session-${index}`,
        }),
      )
      tokens.push(((await response.json()) as { sessionToken: string }).sessionToken)
    }
    const currentToken = tokens[2]!
    const security = (await (
      await auth.fetch(request('/internal/auth/security', { token: currentToken }))
    ).json()) as {
      sessions: Array<{ id: string; current: boolean }>
    }
    const currentId = security.sessions.find((session) => session.current)!.id
    const currentRevocation = await auth.fetch(
      request('/internal/auth/sessions/revoke', {
        token: currentToken,
        sessionId: currentId,
      }),
    )
    expect(currentRevocation.status).toBe(404)
    await expect(currentRevocation.json()).resolves.toEqual({
      ok: false,
      code: 'SESSION_NOT_FOUND',
    })

    const firstOtherId = security.sessions.find((session) => !session.current)!.id
    const revokedOne = await auth.fetch(
      request('/internal/auth/sessions/revoke', {
        token: currentToken,
        sessionId: firstOtherId,
      }),
    )
    await expect(revokedOne.json()).resolves.toEqual({ ok: true, revokedSessions: 1 })

    const revokedOthers = await auth.fetch(
      request('/internal/auth/sessions/revoke', { token: currentToken }),
    )
    await expect(revokedOthers.json()).resolves.toEqual({ ok: true, revokedSessions: 1 })
    expect(
      (await auth.fetch(request('/internal/auth/session', { token: currentToken }))).status,
    ).toBe(200)
    expect((await auth.fetch(request('/internal/auth/session', { token: tokens[0] }))).status).toBe(
      401,
    )
    expect((await auth.fetch(request('/internal/auth/session', { token: tokens[1] }))).status).toBe(
      401,
    )
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
