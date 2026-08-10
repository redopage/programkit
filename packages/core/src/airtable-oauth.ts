const AIRTABLE_AUTHORIZATION_URL = 'https://airtable.com/oauth2/v1/authorize'
const AIRTABLE_TOKEN_URL = 'https://airtable.com/oauth2/v1/token'
const AIRTABLE_API_ORIGIN = 'https://api.airtable.com'

export const airtableOAuthScopes = [
  'data.records:read',
  'data.records:write',
  'schema.bases:read',
  'schema.bases:write',
  'webhook:manage',
] as const

export interface AirtableOAuthTokenSet {
  accessToken: string
  refreshToken: string
  expiresAt: string
  refreshExpiresAt: string
  scopes: string[]
}

export interface AirtableBaseSummary {
  id: string
  name: string
  permissionLevel: string
}

interface AirtableOAuthClientOptions {
  clientId: string
  clientSecret?: string
  fetch?: typeof globalThis.fetch
  tokenUrl?: string
}

interface AirtableTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_expires_in?: number
  scope?: string
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '')
}

function stringToBase64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function randomBase64Url(byteLength: number) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)))
}

async function sha256Base64Url(value: string) {
  return bytesToBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))),
  )
}

export async function createAirtableOAuthAuthorization(options: {
  clientId: string
  redirectUri: string
  state?: string
  scopes?: readonly string[]
}) {
  const state = options.state ?? randomBase64Url(24)
  const codeVerifier = randomBase64Url(48)
  const codeChallenge = await sha256Base64Url(codeVerifier)
  const parameters = new URLSearchParams({
    client_id: options.clientId,
    redirect_uri: options.redirectUri,
    response_type: 'code',
    scope: (options.scopes ?? airtableOAuthScopes).join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  })
  return {
    state,
    codeVerifier,
    authorizationUrl: `${AIRTABLE_AUTHORIZATION_URL}?${parameters}`,
  }
}

function tokenSet(body: AirtableTokenResponse, now = new Date()): AirtableOAuthTokenSet {
  const expiresAt = new Date(now.getTime() + body.expires_in * 1_000)
  const refreshExpiresAt = new Date(
    now.getTime() + (body.refresh_expires_in ?? 60 * 24 * 60 * 60) * 1_000,
  )
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: expiresAt.toISOString(),
    refreshExpiresAt: refreshExpiresAt.toISOString(),
    scopes: (body.scope ?? '').split(' ').filter(Boolean),
  }
}

async function requestToken(
  parameters: URLSearchParams,
  options: AirtableOAuthClientOptions,
): Promise<AirtableOAuthTokenSet> {
  const headers = new Headers({ 'content-type': 'application/x-www-form-urlencoded' })
  if (options.clientSecret) {
    headers.set(
      'authorization',
      `Basic ${stringToBase64(`${options.clientId}:${options.clientSecret}`)}`,
    )
  } else {
    parameters.set('client_id', options.clientId)
  }
  const response = await (options.fetch ?? globalThis.fetch)(
    options.tokenUrl ?? AIRTABLE_TOKEN_URL,
    { method: 'POST', headers, body: parameters },
  )
  const text = await response.text()
  const body = text ? (JSON.parse(text) as AirtableTokenResponse & { error?: string }) : null
  if (!response.ok || !body?.access_token || !body.refresh_token) {
    throw new Error(body?.error ?? `Airtable token exchange failed with ${response.status}.`)
  }
  return tokenSet(body)
}

export function exchangeAirtableAuthorizationCode(
  input: { code: string; codeVerifier: string; redirectUri: string },
  options: AirtableOAuthClientOptions,
) {
  return requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      code_verifier: input.codeVerifier,
      redirect_uri: input.redirectUri,
    }),
    options,
  )
}

export function refreshAirtableOAuthToken(
  refreshToken: string,
  options: AirtableOAuthClientOptions,
) {
  return requestToken(
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    options,
  )
}

export async function listAirtableBases(
  accessToken: string,
  options: { fetch?: typeof globalThis.fetch; apiOrigin?: string } = {},
) {
  const fetcher = options.fetch ?? globalThis.fetch
  const bases: AirtableBaseSummary[] = []
  let offset: string | undefined
  do {
    const parameters = new URLSearchParams()
    if (offset) parameters.set('offset', offset)
    const query = parameters.size ? `?${parameters}` : ''
    const response = await fetcher(
      `${options.apiOrigin ?? AIRTABLE_API_ORIGIN}/v0/meta/bases${query}`,
      {
        headers: { authorization: `Bearer ${accessToken}` },
      },
    )
    const body = (await response.json()) as {
      bases?: Array<{ id: string; name: string; permissionLevel?: string }>
      offset?: string
      error?: { message?: string }
    }
    if (!response.ok || !body.bases) {
      throw new Error(body.error?.message ?? `Airtable base lookup failed with ${response.status}.`)
    }
    bases.push(
      ...body.bases.map((base) => ({
        id: base.id,
        name: base.name,
        permissionLevel: base.permissionLevel ?? 'unknown',
      })),
    )
    offset = body.offset
  } while (offset)
  return bases
}
