import { createHash } from 'node:crypto'

import { describe, expect, it, vi } from 'vitest'

import {
  airtableOAuthScopes,
  createAirtableOAuthAuthorization,
  exchangeAirtableAuthorizationCode,
  listAirtableBases,
  refreshAirtableOAuthToken,
} from '@programkit/core'

describe('Airtable OAuth', () => {
  it('creates a state-bound PKCE authorization request', async () => {
    const authorization = await createAirtableOAuthAuthorization({
      clientId: 'client_test',
      redirectUri: 'https://programkit.dev/api/v1/integrations/airtable/oauth/callback',
      state: 'state_test',
    })
    const url = new URL(authorization.authorizationUrl)
    expect(url.origin + url.pathname).toBe('https://airtable.com/oauth2/v1/authorize')
    expect(url.searchParams.get('state')).toBe('state_test')
    expect(url.searchParams.get('scope')).toBe(airtableOAuthScopes.join(' '))
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    const expectedChallenge = createHash('sha256')
      .update(authorization.codeVerifier)
      .digest('base64url')
    expect(url.searchParams.get('code_challenge')).toBe(expectedChallenge)
    expect(authorization.codeVerifier.length).toBeGreaterThanOrEqual(43)
  })

  it('exchanges and refreshes rotating token sets without exposing a client secret in the body', async () => {
    const fetch = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body)
      expect(body).not.toContain('secret_test')
      return Response.json({
        access_token: `access_${fetch.mock.calls.length}`,
        refresh_token: `refresh_${fetch.mock.calls.length}`,
        expires_in: 3600,
        refresh_expires_in: 5_184_000,
        scope: airtableOAuthScopes.join(' '),
      })
    })
    const client = { clientId: 'client_test', clientSecret: 'secret_test', fetch }

    const first = await exchangeAirtableAuthorizationCode(
      { code: 'code_test', codeVerifier: 'verifier_test', redirectUri: 'https://example.test/cb' },
      client,
    )
    const second = await refreshAirtableOAuthToken(first.refreshToken, client)

    expect(first.accessToken).toBe('access_1')
    expect(second.accessToken).toBe('access_2')
    expect(second.refreshToken).toBe('refresh_2')
    const headers = fetch.mock.calls[0]?.[1]?.headers
    expect(headers).toBeInstanceOf(Headers)
    expect((headers as Headers).get('authorization')).toMatch(/^Basic /u)
  })

  it('paginates the bases the user granted to ProgramKit', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          bases: [{ id: 'app_one', name: 'Conference 2026', permissionLevel: 'create' }],
          offset: 'next',
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          bases: [{ id: 'app_two', name: 'Team Ops', permissionLevel: 'edit' }],
        }),
      )

    await expect(listAirtableBases('access_test', { fetch })).resolves.toEqual([
      { id: 'app_one', name: 'Conference 2026', permissionLevel: 'create' },
      { id: 'app_two', name: 'Team Ops', permissionLevel: 'edit' },
    ])
    expect(String(fetch.mock.calls[1]?.[0])).toContain('offset=next')
  })
})
