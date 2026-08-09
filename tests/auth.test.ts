import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AuthDurableObject } from '../apps/cloudflare/src/auth.ts'
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
      user: { id: string; email: string }
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
})
