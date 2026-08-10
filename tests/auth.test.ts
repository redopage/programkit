import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthDurableObject, cloudflarePasswordIterations } from '../apps/cloudflare/src/auth.ts'
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

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'))
    auth = new AuthDurableObject(
      { storage: new MemoryStorage() } as unknown as DurableObjectState,
      {} as Cloudflare.Env,
    )
  })

  afterEach(() => vi.useRealTimers())

  it('keeps password derivation within the Cloudflare Workers PBKDF2 limit', () => {
    expect(cloudflarePasswordIterations).toBe(100_000)
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
          role: 'admin',
          membershipId: 'mem_abcdefabcdefabcdefabcdef',
          membershipVersion: 1,
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
})
