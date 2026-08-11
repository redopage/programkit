import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { EventAccessDurableObject } from '../apps/cloudflare/src/event-access.ts'
import { agentApiKeyScopes } from '@programkit/core'
import { MemoryStorage } from './support/cloudflare-workers.ts'

const event = {
  id: 'evt_0123456789abcdef01234567',
  organizationId: 'org_0123456789abcdef01234567',
  name: 'AIE NYC 2027',
  slug: 'aie-nyc-2027',
  createdAt: '2026-08-09T12:00:00.000Z',
}

const owner = { userId: 'usr_owner_123', email: 'owner@example.com' }
const member = { userId: 'usr_member_123', email: 'member@example.com' }
const admin = { userId: 'usr_admin_123', email: 'admin@example.com' }

function request(path: string, body: Record<string, unknown>) {
  return new Request(`http://event-access.internal${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function body(response: Response) {
  return (await response.json()) as {
    ok?: boolean
    code?: string
    scopes?: string[]
    token?: string
    event?: typeof event
    membership?: {
      id: string
      email: string
      role: string
      status: string
      version: number
    }
    invitation?: { id: string; status: string }
    identity?: { id: string; email: string }
    sessionToken?: string
    sessionExpiresAt?: string
    apiKey?: {
      id: string
      name: string
      prefix: string
      scopes: string[]
      expiresAt: string | null
      revokedAt: string | null
      lastUsedAt: string | null
    }
    apiKeys?: Array<{
      id: string
      name: string
      prefix: string
      scopes: string[]
      expiresAt: string | null
      revokedAt: string | null
      lastUsedAt: string | null
    }>
  }
}

describe('EventAccessDurableObject', () => {
  let access: EventAccessDurableObject
  let storage: MemoryStorage

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-09T12:00:00.000Z'))
    storage = new MemoryStorage()
    access = new EventAccessDurableObject(
      { storage } as unknown as DurableObjectState,
      {} as Cloudflare.Env,
    )
  })

  afterEach(() => vi.useRealTimers())

  async function initialize() {
    const response = await access.fetch(
      request('/internal/event-access/initialize', { event, owner }),
    )
    expect(response.status).toBe(201)
    return body(response)
  }

  async function invite(actor: typeof owner, email: string, role: 'admin' | 'member' = 'member') {
    const response = await access.fetch(
      request('/internal/event-access/invitations/create', {
        eventId: event.id,
        actor,
        email,
        role,
      }),
    )
    return { response, result: await body(response) }
  }

  async function consume(token: string, actor: typeof member) {
    const response = await access.fetch(
      request('/internal/event-access/invitations/consume', {
        eventId: event.id,
        token,
        ...actor,
      }),
    )
    return { response, result: await body(response) }
  }

  it('initializes one owner and returns role scopes from a live lookup', async () => {
    const initialized = await initialize()
    expect(initialized.membership).toMatchObject({ role: 'owner', status: 'active', version: 1 })

    const response = await access.fetch(
      request('/internal/event-access/memberships/lookup', {
        eventId: event.id,
        ...owner,
      }),
    )
    expect(await body(response)).toMatchObject({
      ok: true,
      event: { id: event.id, organizationId: event.organizationId },
      scopes: ['*'],
    })
  })

  it('repairs a legacy organization id while preserving event access', async () => {
    const legacyMembership = {
      id: 'mem_legacy_owner',
      eventId: event.id,
      userId: owner.userId,
      email: owner.email,
      role: 'owner' as const,
      status: 'active' as const,
      invitedByUserId: null,
      joinedAt: event.createdAt,
      updatedAt: event.createdAt,
      version: 1,
    }
    await storage.put('event', { ...event, organizationId: 'org_legacy' })
    await storage.put(`membership:${legacyMembership.id}`, legacyMembership)
    await storage.put(`membership-user:${owner.userId}`, legacyMembership.id)

    const response = await access.fetch(
      request('/internal/event-access/initialize', { event, owner }),
    )

    expect(response.status).toBe(201)
    expect(await body(response)).toMatchObject({
      event: { id: event.id, organizationId: event.organizationId },
      membership: { id: legacyMembership.id, role: 'owner' },
    })
    expect(await storage.get<typeof event>('event')).toMatchObject({
      organizationId: event.organizationId,
    })
  })

  it('keeps invitation tokens hashed and enforces email-bound single use', async () => {
    await initialize()
    const created = await invite(owner, member.email)
    expect(created.response.status).toBe(201)
    expect(created.result.token).toMatch(new RegExp(`^${event.id}\\.[a-f0-9]{64}$`, 'u'))
    expect(created.result.invitation).not.toHaveProperty('tokenHash')
    const token = created.result.token!

    const wrongEmail = await consume(token, {
      ...member,
      email: 'someone-else@example.com',
    })
    expect(wrongEmail.response.status).toBe(403)
    expect(wrongEmail.result.code).toBe('INVITATION_EMAIL_MISMATCH')

    const accepted = await consume(token, member)
    expect(accepted.response.status).toBe(201)
    expect(accepted.result).toMatchObject({
      event,
      membership: { email: member.email, role: 'member', status: 'active' },
      invitation: { status: 'accepted' },
    })

    const replayed = await consume(token, member)
    expect(replayed.response.status).toBe(404)
    expect(replayed.result.code).toBe('INVITATION_INVALID')
  })

  it('limits administrator invitations and management to owners', async () => {
    await initialize()
    const adminInvitation = await invite(owner, admin.email, 'admin')
    const accepted = await consume(adminInvitation.result.token!, admin)
    expect(accepted.response.status).toBe(201)

    const forbidden = await invite(admin, 'another-admin@example.com', 'admin')
    expect(forbidden.response.status).toBe(403)
    expect(forbidden.result.code).toBe('FORBIDDEN')

    const allowed = await invite(admin, 'viewer@example.com', 'member')
    expect(allowed.response.status).toBe(201)
  })

  it('applies revocation immediately and prevents self-removal', async () => {
    const initialized = await initialize()
    const created = await invite(owner, member.email)
    const accepted = await consume(created.result.token!, member)

    const revokedResponse = await access.fetch(
      request('/internal/event-access/memberships/revoke', {
        eventId: event.id,
        actor: owner,
        membershipId: accepted.result.membership!.id,
      }),
    )
    expect(revokedResponse.status).toBe(200)

    const lookup = await access.fetch(
      request('/internal/event-access/memberships/lookup', {
        eventId: event.id,
        ...member,
      }),
    )
    expect(lookup.status).toBe(404)

    const selfRemoval = await access.fetch(
      request('/internal/event-access/memberships/revoke', {
        eventId: event.id,
        actor: owner,
        membershipId: initialized.membership!.id,
      }),
    )
    expect(selfRemoval.status).toBe(409)
    expect(await body(selfRemoval)).toMatchObject({ code: 'SELF_REMOVAL' })
  })

  it('expires pending invitations after seven days', async () => {
    await initialize()
    const created = await invite(owner, member.email)
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000 + 1)

    const expired = await consume(created.result.token!, member)
    expect(expired.response.status).toBe(410)
    expect(expired.result.code).toBe('INVITATION_EXPIRED')
  })

  it('creates isolated participant credentials and restores an event-scoped session', async () => {
    await initialize()
    const signup = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email: 'Priya@example.com',
        password: 'a-long-test-password',
        intent: 'signup',
        ipHash: 'ip-one',
      }),
    )
    const signedUp = await body(signup)
    expect(signup.status).toBe(201)
    expect(signedUp.identity).toMatchObject({ email: 'priya@example.com' })
    expect(signedUp.sessionToken).toMatch(/^[a-f0-9]{64}$/u)

    const restored = await access.fetch(
      request('/internal/event-access/external/session', {
        eventId: event.id,
        token: signedUp.sessionToken,
      }),
    )
    expect(await body(restored)).toMatchObject({
      ok: true,
      event,
      identity: { email: 'priya@example.com' },
    })

    vi.advanceTimersByTime(1_000)

    const duplicate = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email: 'priya@example.com',
        password: 'another-long-password',
        intent: 'signup',
        ipHash: 'ip-two',
      }),
    )
    expect(duplicate.status).toBe(409)
    expect(await body(duplicate)).toMatchObject({ code: 'ACCOUNT_EXISTS' })
  })

  it('counts participant password failures without throttling successful sign-ins', async () => {
    await initialize()
    const email = 'repeat-speaker@example.com'
    const password = 'speaker-password'
    const ipHash = 'repeat-speaker-ip'
    const signup = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email,
        password,
        intent: 'signup',
        ipHash,
      }),
    )
    expect(signup.status).toBe(201)

    for (let index = 0; index < 12; index += 1) {
      const response = await access.fetch(
        request('/internal/event-access/external/password', {
          eventId: event.id,
          email,
          password,
          intent: 'signin',
          ipHash,
        }),
      )
      expect(response.status).toBe(200)
    }

    for (let index = 0; index < 12; index += 1) {
      const response = await access.fetch(
        request('/internal/event-access/external/password', {
          eventId: event.id,
          email,
          password,
          intent: 'signup',
          ipHash,
        }),
      )
      expect(response.status).toBe(409)
    }
    expect(
      (
        await access.fetch(
          request('/internal/event-access/external/password', {
            eventId: event.id,
            email,
            password,
            intent: 'signin',
            ipHash,
          }),
        )
      ).status,
    ).toBe(200)

    const wrongPassword = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email,
        password: 'incorrect-password',
        intent: 'signin',
        ipHash,
      }),
    )
    expect(wrongPassword.status).toBe(401)
    expect(
      (
        await access.fetch(
          request('/internal/event-access/external/password', {
            eventId: event.id,
            email,
            password,
            intent: 'signin',
            ipHash,
          }),
        )
      ).status,
    ).toBe(200)
  })

  it('creates copy-once event API keys, verifies scopes, and revokes access', async () => {
    await initialize()
    const createdResponse = await access.fetch(
      request('/internal/event-access/api-keys/create', {
        eventId: event.id,
        actor: owner,
        name: 'Website sync',
        scopes: ['workspace:read', 'events:read'],
        expiresAt: '2026-09-01T00:00:00.000Z',
      }),
    )
    const created = await body(createdResponse)
    expect(createdResponse.status).toBe(201)
    expect(created.token).toMatch(/^pk_live_evt_[a-f0-9]{24}_key_[a-f0-9]{16}_[a-f0-9]{64}$/u)
    expect(created.apiKey).toMatchObject({
      name: 'Website sync',
      scopes: ['events:read', 'workspace:read'],
      expiresAt: '2026-09-01T00:00:00.000Z',
      lastUsedAt: null,
    })
    expect(created.apiKey).not.toHaveProperty('secretHash')

    const listed = await access.fetch(
      request('/internal/event-access/api-keys/list', { eventId: event.id, actor: owner }),
    )
    const list = await body(listed)
    expect(list.apiKeys).toHaveLength(1)
    expect(list.apiKeys?.[0]).not.toHaveProperty('token')

    const verified = await access.fetch(
      request('/internal/event-access/api-keys/verify', {
        eventId: event.id,
        apiKeyId: created.apiKey!.id,
        token: created.token,
      }),
    )
    expect(await body(verified)).toMatchObject({
      ok: true,
      scopes: ['events:read', 'workspace:read'],
      apiKey: { lastUsedAt: '2026-08-09T12:00:00.000Z' },
    })

    const invalid = await access.fetch(
      request('/internal/event-access/api-keys/verify', {
        eventId: event.id,
        apiKeyId: created.apiKey!.id,
        token: `${created.token}bad`,
      }),
    )
    expect(invalid.status).toBe(401)

    const revoked = await access.fetch(
      request('/internal/event-access/api-keys/revoke', {
        eventId: event.id,
        actor: owner,
        apiKeyId: created.apiKey!.id,
      }),
    )
    expect(await body(revoked)).toMatchObject({ apiKey: { revokedAt: expect.any(String) } })

    const afterRevocation = await access.fetch(
      request('/internal/event-access/api-keys/verify', {
        eventId: event.id,
        apiKeyId: created.apiKey!.id,
        token: created.token,
      }),
    )
    expect(afterRevocation.status).toBe(401)
  })

  it('accepts the complete least-privilege Agent Plugin scope preset', async () => {
    await initialize()
    const createdResponse = await access.fetch(
      request('/internal/event-access/api-keys/create', {
        eventId: event.id,
        actor: owner,
        name: 'ProgramKit agent',
        scopes: agentApiKeyScopes,
      }),
    )
    const created = await body(createdResponse)

    expect(createdResponse.status).toBe(201)
    expect(created.apiKey?.scopes).toEqual([...agentApiKeyScopes].sort())

    const verified = await access.fetch(
      request('/internal/event-access/api-keys/verify', {
        eventId: event.id,
        apiKeyId: created.apiKey!.id,
        token: created.token,
      }),
    )
    expect(await body(verified)).toMatchObject({
      ok: true,
      scopes: [...agentApiKeyScopes].sort(),
    })
  })

  it('rejects the wrong participant password and invalidates logout immediately', async () => {
    await initialize()
    const signup = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email: 'speaker@example.com',
        password: 'speaker-password',
        intent: 'signup',
        ipHash: 'ip-three',
      }),
    )
    const signedUp = await body(signup)
    vi.advanceTimersByTime(1_000)

    const wrongPassword = await access.fetch(
      request('/internal/event-access/external/password', {
        eventId: event.id,
        email: 'speaker@example.com',
        password: 'incorrect-password',
        intent: 'signin',
        ipHash: 'ip-three',
      }),
    )
    expect(wrongPassword.status).toBe(401)
    expect(await body(wrongPassword)).toMatchObject({ code: 'INVALID_CREDENTIALS' })

    expect(
      (
        await access.fetch(
          request('/internal/event-access/external/logout', {
            eventId: event.id,
            token: signedUp.sessionToken,
          }),
        )
      ).status,
    ).toBe(200)
    const afterLogout = await access.fetch(
      request('/internal/event-access/external/session', {
        eventId: event.id,
        token: signedUp.sessionToken,
      }),
    )
    expect(afterLogout.status).toBe(401)
  })
})
