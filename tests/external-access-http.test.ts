import { describe, expect, it, vi } from 'vitest'

import {
  consumeExternalMagicLink,
  handleExternalAccessRequest,
} from '../apps/cloudflare/src/worker.ts'

const eventId = 'evt_0123456789abcdef01234567'
const token = 'a'.repeat(64)

type ExternalAccessEnv = Parameters<typeof handleExternalAccessRequest>[1]

function namespace(fetch: (request: Request) => Promise<Response>) {
  const stub = { fetch: vi.fn(fetch) }
  return {
    stub,
    namespace: {
      idFromName: vi.fn((name: string) => name),
      get: vi.fn(() => stub),
    },
  }
}

function environment(fetch: (request: Request) => Promise<Response>) {
  const access = namespace(fetch)
  const workspace = namespace(async () => Response.json({ ok: true }))
  const send = vi.fn(async (_message: { to: string | string[]; text?: string }) => ({
    messageId: 'message_1',
  }))
  return {
    env: {
      PROGRAMKIT_EVENT_ACCESS: access.namespace,
      PROGRAMKIT_WORKSPACES: workspace.namespace,
      PROGRAMKIT_EMAIL_FROM: 'events@example.com',
      PROGRAMKIT_SUPPORT_EMAIL: 'support@example.com',
      PROGRAMKIT_APP_ORIGIN: 'https://app.programkit.dev',
      EMAIL: { send },
    } as unknown as ExternalAccessEnv,
    access,
    send,
  }
}

describe('participant email sign-in HTTP boundary', () => {
  it('sends an event-scoped, one-time sign-in callback without exposing the token in JSON', async () => {
    const { env, access, send } = environment(async (request) => {
      expect(new URL(request.url).pathname).toBe(
        '/internal/event-access/external/magic-link/request',
      )
      return Response.json({
        ok: true,
        deliver: true,
        token,
        email: 'speaker@example.com',
        event: {
          id: eventId,
          name: 'AIE NYC 2027',
          slug: 'aie-nyc-2027',
        },
      })
    })
    const incoming = new Request(
      `https://app.programkit.dev/public/v1/access/magic-link?event=${eventId}`,
      {
        method: 'POST',
        headers: {
          origin: 'https://app.programkit.dev',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: 'Speaker@example.com' }),
      },
    )

    const response = await handleExternalAccessRequest(
      incoming,
      env,
      new URL(incoming.url),
      eventId,
    )

    expect(response?.status).toBe(202)
    await expect(response?.json()).resolves.toEqual({
      ok: true,
      message: 'If the address can receive mail, a sign-in link is on its way.',
    })
    expect(access.stub.fetch).toHaveBeenCalledTimes(1)
    const message = send.mock.calls[0]?.[0]
    expect(message?.to).toBe('speaker@example.com')
    expect(message?.text).toContain(
      `https://app.programkit.dev/access/verify?event=${eventId}&token=${token}`,
    )
  })

  it('exchanges a valid callback for an HTTP-only participant session cookie', async () => {
    const sessionToken = 'b'.repeat(64)
    const { env } = environment(async (request) => {
      expect(new URL(request.url).pathname).toBe(
        '/internal/event-access/external/magic-link/consume',
      )
      return Response.json({
        ok: true,
        identity: { id: 'ext_123', name: 'Speaker', email: 'speaker@example.com' },
        sessionToken,
        sessionExpiresAt: '2026-09-12T12:00:00.000Z',
      })
    })
    const url = new URL(`https://app.programkit.dev/access/verify?event=${eventId}&token=${token}`)

    const response = await consumeExternalMagicLink(env, url)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      `https://app.programkit.dev/access?event=${eventId}`,
    )
    expect(response.headers.get('set-cookie')).toContain(
      `programkit_external_session=${eventId}.${sessionToken}`,
    )
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax')
  })

  it('keeps unknown participant accounts indistinguishable and sends no email', async () => {
    const { env, send } = environment(async () =>
      Response.json({ ok: true, deliver: false, event: { id: eventId, name: 'AIE NYC 2027' } }),
    )
    const incoming = new Request(
      `https://app.programkit.dev/public/v1/access/magic-link?event=${eventId}`,
      {
        method: 'POST',
        headers: {
          origin: 'https://app.programkit.dev',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ email: 'unknown@example.com' }),
      },
    )

    const response = await handleExternalAccessRequest(
      incoming,
      env,
      new URL(incoming.url),
      eventId,
    )

    expect(response?.status).toBe(202)
    expect(send).not.toHaveBeenCalled()
  })
})
