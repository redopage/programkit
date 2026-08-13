import { describe, expect, it, vi } from 'vitest'

import { handleHostedAuthRequest } from '../apps/cloudflare/src/worker.ts'

const shard = 'a'.repeat(32)
const secret = 'b'.repeat(64)
const cookie = `programkit_session=${shard}.${secret}`

type HostedAuthEnv = Parameters<typeof handleHostedAuthRequest>[1]

function authEnv(fetch: (request: Request) => Promise<Response>) {
  const stub = { fetch: vi.fn(fetch) }
  const namespace = {
    idFromName: vi.fn((name: string) => name),
    get: vi.fn(() => stub),
  }
  return {
    env: { PROGRAMKIT_AUTH: namespace } as unknown as HostedAuthEnv,
    stub,
    namespace,
  }
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://app.programkit.dev${path}`, {
    ...init,
    headers: { cookie, ...init.headers },
  })
}

describe('hosted account security boundary', () => {
  it('reports whether email sign-in is available before rendering login actions', async () => {
    const { env } = authEnv(async (request) => {
      expect(new URL(request.url).pathname).toBe('/internal/instance/access')
      return Response.json({
        ok: true,
        managed: true,
        initialized: true,
        policy: 'invite_only',
        signupAvailable: false,
      })
    })
    env.PROGRAMKIT_EMAIL_FROM = 'notifications@example.com'
    env.EMAIL = { send: vi.fn(async () => ({ messageId: 'message_1' })) }

    const configured = request('/api/v1/auth/config')
    const configuredResponse = await handleHostedAuthRequest(
      configured,
      env,
      new URL(configured.url),
    )
    await expect(configuredResponse?.json()).resolves.toMatchObject({
      ok: true,
      emailConfigured: true,
    })

    delete env.EMAIL
    const unavailable = request('/api/v1/auth/config')
    const unavailableResponse = await handleHostedAuthRequest(
      unavailable,
      env,
      new URL(unavailable.url),
    )
    await expect(unavailableResponse?.json()).resolves.toMatchObject({
      ok: true,
      emailConfigured: false,
    })
  })

  it('forwards password-recovery intent and sends reset-specific email copy', async () => {
    const { env, stub } = authEnv(async (request) => {
      expect(new URL(request.url).pathname).toBe('/internal/auth/request')
      return Response.json({
        ok: true,
        deliver: true,
        token: secret,
        email: 'owner@example.com',
      })
    })
    const send = vi.fn(async () => ({ messageId: 'message_1' }))
    env.PROGRAMKIT_EMAIL_FROM = 'notifications@example.com'
    env.EMAIL = { send }

    const incoming = request('/api/v1/auth/magic-link', {
      method: 'POST',
      headers: {
        origin: 'https://app.programkit.dev',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'owner@example.com',
        intent: 'signin',
        recoverPassword: true,
      }),
    })
    const response = await handleHostedAuthRequest(incoming, env, new URL(incoming.url))

    expect(response?.status).toBe(202)
    const forwarded = stub.fetch.mock.calls[0]?.[0]
    await expect(forwarded!.json()).resolves.toMatchObject({
      email: 'owner@example.com',
      intent: 'signin',
      recoverPassword: true,
    })
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: 'Reset your password',
        text: expect.stringContaining('Choose a new password'),
        html: expect.stringContaining('Choose a new password'),
      }),
    )
  })

  it('validates the first-owner setup code before forwarding a signup', async () => {
    const forwarded: Array<Record<string, unknown>> = []
    const { env } = authEnv(async (request) => {
      const input = (await request.json()) as Record<string, unknown>
      forwarded.push(input)
      return Response.json(
        {
          ok: false,
          code:
            input.bootstrapAuthorized === true ? 'SIGNUP_UNAVAILABLE' : 'BOOTSTRAP_TOKEN_INVALID',
        },
        { status: 409 },
      )
    })
    env.PROGRAMKIT_DEPLOYMENT_PROFILE = 'hosted-app'
    env.PROGRAMKIT_SIGNUP_MODE = 'bootstrap'
    env.PROGRAMKIT_BOOTSTRAP_TOKEN = 'correct-private-setup-code'

    const invalid = request('/api/v1/auth/password', {
      method: 'POST',
      headers: {
        origin: 'https://app.programkit.dev',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
        intent: 'signup',
        name: 'Owner',
        bootstrapToken: 'wrong-private-setup-code',
      }),
    })
    const invalidResponse = await handleHostedAuthRequest(invalid, env, new URL(invalid.url))
    expect(invalidResponse?.status).toBe(403)
    expect(forwarded.at(-1)).toMatchObject({
      bootstrapConfigured: true,
      bootstrapAuthorized: false,
    })
    expect(forwarded.at(-1)).not.toHaveProperty('bootstrapToken')

    const valid = request('/api/v1/auth/password', {
      method: 'POST',
      headers: {
        origin: 'https://app.programkit.dev',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: 'owner@example.com',
        password: 'correct horse battery staple',
        intent: 'signup',
        name: 'Owner',
        bootstrapToken: 'correct-private-setup-code',
      }),
    })
    const validResponse = await handleHostedAuthRequest(valid, env, new URL(valid.url))
    expect(validResponse?.status).toBe(403)
    expect(forwarded.at(-1)).toMatchObject({
      bootstrapConfigured: true,
      bootstrapAuthorized: true,
    })
    expect(forwarded.at(-1)).not.toHaveProperty('bootstrapToken')
  })

  it('reads security state with only the current opaque session token', async () => {
    const { env, stub, namespace } = authEnv(async () =>
      Response.json({
        ok: true,
        email: 'owner@example.com',
        passwordConfigured: true,
        sessions: [
          {
            id: `ses_${'c'.repeat(24)}`,
            createdAt: '2026-08-12T10:00:00.000Z',
            expiresAt: '2026-09-11T10:00:00.000Z',
            current: true,
          },
        ],
      }),
    )
    const incoming = request('/api/v1/auth/security')
    const response = await handleHostedAuthRequest(incoming, env, new URL(incoming.url))

    expect(response?.status).toBe(200)
    expect(response?.headers.get('cache-control')).toBe('no-store')
    await expect(response?.json()).resolves.toMatchObject({
      ok: true,
      email: 'owner@example.com',
      passwordConfigured: true,
    })
    expect(namespace.idFromName).toHaveBeenCalledWith(`account_${shard}`)
    const forwarded = stub.fetch.mock.calls[0]?.[0]
    expect(new URL(forwarded!.url).pathname).toBe('/internal/auth/security')
    await expect(forwarded!.json()).resolves.toEqual({ token: secret })
  })

  it('requires same-origin password and session mutations', async () => {
    const { env, stub } = authEnv(async () => Response.json({ ok: true }))
    const incoming = request('/api/v1/auth/password/change', {
      method: 'POST',
      headers: { origin: 'https://attacker.example' },
      body: JSON.stringify({
        currentPassword: 'correct horse battery staple',
        newPassword: 'a different secure password',
      }),
    })
    const response = await handleHostedAuthRequest(incoming, env, new URL(incoming.url))

    expect(response?.status).toBe(403)
    expect(stub.fetch).not.toHaveBeenCalled()
  })

  it('changes the password through the authenticated shard and maps safe errors', async () => {
    const { env, stub } = authEnv(async () =>
      Response.json({ ok: false, code: 'CURRENT_PASSWORD_INVALID' }, { status: 401 }),
    )
    const incoming = request('/api/v1/auth/password/change', {
      method: 'POST',
      headers: { origin: 'https://app.programkit.dev' },
      body: JSON.stringify({
        currentPassword: 'the current password',
        newPassword: 'a different secure password',
      }),
    })
    const response = await handleHostedAuthRequest(incoming, env, new URL(incoming.url))

    expect(response?.status).toBe(401)
    await expect(response?.json()).resolves.toEqual({
      ok: false,
      error: 'The current password is incorrect.',
    })
    const forwarded = stub.fetch.mock.calls[0]?.[0]
    expect(new URL(forwarded!.url).pathname).toBe('/internal/auth/password/change')
    await expect(forwarded!.json()).resolves.toMatchObject({
      token: secret,
      currentPassword: 'the current password',
      newPassword: 'a different secure password',
    })
  })

  it('revokes only a well-formed named session and never accepts cross-origin deletion', async () => {
    const sessionId = `ses_${'d'.repeat(24)}`
    const { env, stub } = authEnv(async () => Response.json({ ok: true, revokedSessions: 1 }))
    const incoming = request(`/api/v1/auth/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { origin: 'https://app.programkit.dev' },
    })
    const response = await handleHostedAuthRequest(incoming, env, new URL(incoming.url))

    expect(response?.status).toBe(200)
    const forwarded = stub.fetch.mock.calls[0]?.[0]
    await expect(forwarded!.json()).resolves.toEqual({ token: secret, sessionId })

    const invalid = request('/api/v1/auth/sessions/not-a-session', {
      method: 'DELETE',
      headers: { origin: 'https://app.programkit.dev' },
    })
    const invalidResponse = await handleHostedAuthRequest(invalid, env, new URL(invalid.url))
    expect(invalidResponse?.status).toBe(404)
    expect(stub.fetch).toHaveBeenCalledTimes(1)
  })
})
