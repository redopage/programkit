import { handleMcpRequest } from '@programkit/agent'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'
import {
  createAirtableOAuthAuthorization,
  exchangeAirtableAuthorizationCode,
  listAirtableBases,
  verifyAirtableWebhookMac,
  type OperationRequest,
  type OperationResponse,
  type WorkspaceState,
} from '@programkit/core'
import {
  AuthDurableObject,
  normalizeEmail,
  type AuthAccount,
  type AuthEventSummary,
} from './auth.ts'
import {
  createDemoId,
  demoCookieName,
  demoExpiresAt,
  demoIdFromPath,
  demoIdFromWorkspaceKey,
  demoWorkspaceKey,
  isDemoId,
} from './demo.ts'

export { AuthDurableObject, WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  PROGRAMKIT_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
  PROGRAMKIT_AUTH?: DurableObjectNamespace<AuthDurableObject>
  PROGRAMKIT_DEPLOYMENT_PROFILE?: 'hosted-site' | 'hosted-demo' | 'hosted-app'
  PROGRAMKIT_APP_ORIGIN?: string
  PROGRAMKIT_DEMO_ORIGIN?: string
  PROGRAMKIT_EMAIL_FROM?: string
  PROGRAMKIT_SUPPORT_EMAIL?: string
  EMAIL?: {
    send(message: {
      to: string | string[]
      from: string
      subject: string
      html?: string
      text?: string
      replyTo?: string
    }): Promise<{ messageId: string }>
  }
  AIRTABLE_TOKEN?: string
  AIRTABLE_BASE_ID?: string
  AIRTABLE_WEBHOOK_MAC_SECRET?: string
  AIRTABLE_OAUTH_CLIENT_ID?: string
  AIRTABLE_OAUTH_CLIENT_SECRET?: string
}

const workspaceCookieName = 'programkit_workspace'
const eventCookieName = 'programkit_event'
const sessionCookieName = 'programkit_session'
const workspaceKeyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/u
const airtableCallbackPath = '/api/v1/integrations/airtable/oauth/callback'

function deploymentProfile(env: Env) {
  return env.PROGRAMKIT_DEPLOYMENT_PROFILE ?? 'single-workspace'
}

function isStaticOrLegalPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/demo' ||
    pathname === '/privacy' ||
    pathname === '/terms' ||
    pathname === '/favicon.svg' ||
    pathname === '/robots.txt' ||
    pathname.startsWith('/assets/')
  )
}

function isDocumentNavigation(request: Request) {
  return (
    request.headers.get('sec-fetch-dest') === 'document' ||
    request.headers.get('accept')?.includes('text/html') === true
  )
}

function redirect(url: URL, pathname: string, headers?: HeadersInit) {
  return new Response(null, {
    status: 302,
    headers: { location: new URL(pathname, url.origin).toString(), ...headers },
  })
}

const demoStaffActor = {
  type: 'staff' as const,
  id: 'usr_demo_operator',
  name: 'Demo Operator',
  scopes: ['*'],
}

const agentReaderActor = {
  type: 'agent' as const,
  id: 'agent_programkit',
  name: 'ProgramKit Agent',
  scopes: ['workspace:read'],
}

const publicReaderActor = {
  type: 'service' as const,
  id: 'public_web',
  name: 'Public web',
  scopes: [],
}

function cookie(request: Request, name: string) {
  for (const entry of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...parts] = entry.trim().split('=')
    if (key === name) return decodeURIComponent(parts.join('='))
  }
  return null
}

function workspaceKey(env: Env, request: Request) {
  const demoId = cookie(request, demoCookieName)
  if (isDemoId(demoId)) return demoWorkspaceKey(demoId)
  if (env.AIRTABLE_BASE_ID) return 'demo'
  const headerKey = request.headers.get('x-programkit-workspace-key')
  const requested = headerKey ?? cookie(request, workspaceCookieName) ?? 'demo'
  if (demoIdFromWorkspaceKey(requested)) return 'demo'
  return workspaceKeyPattern.test(requested) ? requested : 'demo'
}

function workspaceStub(env: Env, key: string) {
  return env.PROGRAMKIT_WORKSPACES.get(env.PROGRAMKIT_WORKSPACES.idFromName(key))
}

function workspaceCookie(value: string, url: URL) {
  return [
    `${workspaceCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=31536000',
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function demoCookie(value: string, url: URL, expiresAt: string) {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1_000))
  return [
    `${demoCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    `Expires=${new Date(expiresAt).toUTCString()}`,
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function clearDemoCookie(url: URL) {
  return [
    `${demoCookieName}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function authCookie(name: string, value: string, url: URL, maxAge: number) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function clearAuthCookie(name: string, url: URL) {
  return [
    `${name}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function authStub(env: Env, shard: string) {
  if (!env.PROGRAMKIT_AUTH) return null
  return env.PROGRAMKIT_AUTH.get(env.PROGRAMKIT_AUTH.idFromName(`account_${shard}`))
}

function eventWorkspaceKey(eventId: string) {
  return `event_${eventId}`
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (entry) => entry.toString(16).padStart(2, '0')).join('')
}

interface HostedPrincipal {
  authShard: string
  sessionToken: string
  account: AuthAccount
}

const authShardPattern = /^[a-f0-9]{32}$/u
const authSecretPattern = /^[a-f0-9]{64}$/u

function scopedAuthToken(shard: string, secret: string) {
  return `${shard}.${secret}`
}

function parseScopedAuthToken(value: string | null) {
  if (!value) return null
  const [shard, secret, ...rest] = value.split('.')
  if (rest.length > 0 || !authShardPattern.test(shard) || !authSecretPattern.test(secret)) {
    return null
  }
  return { shard, secret }
}

async function resolveHostedPrincipal(env: Env, request: Request) {
  const session = parseScopedAuthToken(cookie(request, sessionCookieName))
  if (!session) return null
  const stub = authStub(env, session.shard)
  if (!stub) return null
  const response = await stub.fetch(
    new Request('http://auth.internal/internal/auth/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: session.secret,
        preferredEventId: cookie(request, eventCookieName),
      }),
    }),
  )
  if (!response.ok) return null
  const body = (await response.json()) as { ok: boolean; account?: AuthAccount }
  return body.ok && body.account
    ? { authShard: session.shard, sessionToken: session.secret, account: body.account }
    : null
}

function hostedStaffActor(principal: HostedPrincipal) {
  return {
    type: 'staff' as const,
    id: principal.account.user.id,
    name: principal.account.user.email,
    scopes: ['*'],
  }
}

function isHostedPublicPage(pathname: string) {
  return pathname === '/login' || pathname === '/privacy' || pathname === '/terms'
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function configuredAppOrigin(env: Env, requestUrl: URL) {
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    return requestUrl.origin
  }
  return env.PROGRAMKIT_APP_ORIGIN ?? 'https://app.programkit.dev'
}

async function initializeHostedEvent(
  env: Env,
  event: AuthEventSummary,
  createdAt = event.createdAt,
) {
  const response = await workspaceStub(env, eventWorkspaceKey(event.id)).fetch(
    new Request('http://workspace.internal/internal/event/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: event.id, name: event.name, slug: event.slug, createdAt }),
    }),
  )
  if (!response.ok && response.status !== 409) {
    throw new Error('The event workspace could not be initialized.')
  }
}

async function handleHostedAuthRequest(request: Request, env: Env, url: URL) {
  if (!env.PROGRAMKIT_AUTH)
    return Response.json({ ok: false, error: 'Authentication is unavailable.' }, { status: 503 })

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/magic-link') {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      )
    }
    const input = (await request.json()) as { email?: unknown }
    const email = normalizeEmail(input.email)
    if (!email) {
      return Response.json(
        { ok: true, message: 'If the address can receive mail, a sign-in link is on its way.' },
        { status: 202, headers: { 'cache-control': 'no-store' } },
      )
    }
    const shard = (await hashValue(email)).slice(0, 32)
    const stub = authStub(env, shard)!
    const ipHash = await hashValue(request.headers.get('cf-connecting-ip') ?? 'local')
    const issuedResponse = await stub.fetch(
      new Request('http://auth.internal/internal/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, ipHash }),
      }),
    )
    const issued = (await issuedResponse.json()) as {
      ok: boolean
      deliver?: boolean
      token?: string
      expiresAt?: string
      email?: string
    }
    if (issued.deliver && issued.token) {
      if (!env.EMAIL || !env.PROGRAMKIT_EMAIL_FROM) {
        return Response.json(
          { ok: false, error: 'Email sign-in is not configured on this deployment.' },
          { status: 503 },
        )
      }
      const callback = new URL('/auth/verify', configuredAppOrigin(env, url))
      callback.searchParams.set('token', scopedAuthToken(shard, issued.token))
      const safeCallback = escapeHtml(callback.toString())
      try {
        await env.EMAIL.send({
          to: issued.email ?? email,
          from: env.PROGRAMKIT_EMAIL_FROM,
          replyTo: env.PROGRAMKIT_SUPPORT_EMAIL,
          subject: 'Sign in to ProgramKit',
          text: `Sign in to ProgramKit: ${callback.toString()}\n\nThis link expires in 15 minutes and can be used once.`,
          html: `<div style="font-family:Inter,system-ui,sans-serif;color:#18181b;line-height:1.5"><h1 style="font-size:22px">Sign in to ProgramKit</h1><p>Use this secure link to continue:</p><p><a href="${safeCallback}" style="display:inline-block;border-radius:10px;background:#2563eb;color:white;padding:10px 16px;text-decoration:none">Sign in</a></p><p style="color:#71717a;font-size:14px">This link expires in 15 minutes and can be used once.</p></div>`,
        })
      } catch {
        return Response.json(
          { ok: false, error: 'The sign-in email could not be sent. Try again.' },
          { status: 503, headers: { 'cache-control': 'no-store' } },
        )
      }
    }
    return Response.json(
      { ok: true, message: 'If the address can receive mail, a sign-in link is on its way.' },
      { status: 202, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (request.method === 'GET' && url.pathname === '/auth/verify') {
    const token = parseScopedAuthToken(url.searchParams.get('token'))
    if (!token) return redirect(url, '/login?error=expired')
    const stub = authStub(env, token.shard)!
    const consumedResponse = await stub.fetch(
      new Request('http://auth.internal/internal/auth/consume', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: token.secret }),
      }),
    )
    const consumed = (await consumedResponse.json()) as {
      ok: boolean
      sessionToken?: string
      sessionExpiresAt?: string
      account?: AuthAccount
    }
    if (!consumed.ok || !consumed.sessionToken || !consumed.account) {
      return redirect(url, '/login?error=expired')
    }
    const firstEvent = consumed.account.events.find(
      (event) => event.id === consumed.account!.activeEventId,
    )
    if (!firstEvent) return redirect(url, '/login?error=account')
    await initializeHostedEvent(env, firstEvent)
    const maxAge = Math.max(
      0,
      Math.floor((Date.parse(consumed.sessionExpiresAt ?? '') - Date.now()) / 1_000),
    )
    const headers = new Headers({ location: '/', 'cache-control': 'no-store' })
    headers.append(
      'set-cookie',
      authCookie(
        sessionCookieName,
        scopedAuthToken(token.shard, consumed.sessionToken),
        url,
        maxAge,
      ),
    )
    headers.append(
      'set-cookie',
      authCookie(eventCookieName, consumed.account.activeEventId, url, maxAge),
    )
    return new Response(null, { status: 302, headers })
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/logout') {
    if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
    const session = parseScopedAuthToken(cookie(request, sessionCookieName))
    if (session) {
      await authStub(env, session.shard)!.fetch(
        new Request('http://auth.internal/internal/auth/logout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token: session.secret }),
        }),
      )
    }
    const headers = new Headers({ 'cache-control': 'no-store' })
    headers.append('set-cookie', clearAuthCookie(sessionCookieName, url))
    headers.append('set-cookie', clearAuthCookie(eventCookieName, url))
    return Response.json({ ok: true }, { headers })
  }

  return null
}

async function demoStatus(stub: DurableObjectStub<WorkspaceDurableObject>) {
  const response = await stub.fetch(new Request('http://workspace.internal/internal/demo/status'))
  const body = (await response.json()) as {
    active?: boolean
    demo?: { id: string; createdAt: string; expiresAt: string; deletedAt?: string }
  }
  return { response, body }
}

function redirectToIntegrations(url: URL, status: string, message?: string) {
  const target = new URL('/integrations', url.origin)
  target.searchParams.set('airtable', status)
  if (message) target.searchParams.set('message', message.slice(0, 180))
  return Response.redirect(target, 302)
}

function sameOrigin(request: Request, url: URL) {
  const origin = request.headers.get('origin')
  return origin === url.origin
}

async function handleAirtableIntegration(
  request: Request,
  env: Env,
  url: URL,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  workspaceKey: string,
  newWorkspaceCookie?: string,
) {
  if (request.method === 'GET' && url.pathname === '/api/v1/integrations/airtable/status') {
    return stub.fetch(new Request('http://workspace.internal/internal/airtable/status'))
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/integrations/airtable/oauth/start') {
    if (!env.AIRTABLE_OAUTH_CLIENT_ID) {
      return redirectToIntegrations(url, 'unavailable', 'Airtable OAuth is not configured.')
    }
    const redirectUri = new URL(airtableCallbackPath, url.origin).toString()
    const authorization = await createAirtableOAuthAuthorization({
      clientId: env.AIRTABLE_OAUTH_CLIENT_ID,
      redirectUri,
    })
    const persisted = await stub.fetch(
      new Request('http://workspace.internal/internal/airtable/oauth/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          state: authorization.state,
          codeVerifier: authorization.codeVerifier,
          redirectUri,
          expiresAt: new Date(Date.now() + 10 * 60 * 1_000).toISOString(),
        }),
      }),
    )
    if (!persisted.ok) return redirectToIntegrations(url, 'error', 'OAuth setup could not start.')
    const headers = new Headers({ location: authorization.authorizationUrl })
    if (newWorkspaceCookie) headers.set('set-cookie', workspaceCookie(newWorkspaceCookie, url))
    return new Response(null, { status: 302, headers })
  }

  if (request.method === 'GET' && url.pathname === airtableCallbackPath) {
    const providerError = url.searchParams.get('error')
    if (providerError) {
      return redirectToIntegrations(
        url,
        'error',
        url.searchParams.get('error_description') ?? providerError,
      )
    }
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (!code || !state || !env.AIRTABLE_OAUTH_CLIENT_ID) {
      return redirectToIntegrations(url, 'error', 'Airtable returned an incomplete authorization.')
    }
    try {
      const consumedResponse = await stub.fetch(
        new Request('http://workspace.internal/internal/airtable/oauth/consume', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ state }),
        }),
      )
      const consumed = (await consumedResponse.json()) as {
        ok: boolean
        error?: string
        authorization?: { codeVerifier: string; redirectUri: string }
      }
      if (!consumedResponse.ok || !consumed.authorization) {
        throw new Error(consumed.error ?? 'The OAuth state expired.')
      }
      const token = await exchangeAirtableAuthorizationCode(
        {
          code,
          codeVerifier: consumed.authorization.codeVerifier,
          redirectUri: consumed.authorization.redirectUri,
        },
        {
          clientId: env.AIRTABLE_OAUTH_CLIENT_ID,
          clientSecret: env.AIRTABLE_OAUTH_CLIENT_SECRET,
        },
      )
      const bases = await listAirtableBases(token.accessToken)
      if (bases.length === 0) {
        throw new Error('No Airtable bases were granted to ProgramKit.')
      }
      const pendingResponse = await stub.fetch(
        new Request('http://workspace.internal/internal/airtable/oauth/pending', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...token, bases, authorizedAt: new Date().toISOString() }),
        }),
      )
      if (!pendingResponse.ok) throw new Error('The Airtable authorization could not be saved.')
      return redirectToIntegrations(url, 'choose-base')
    } catch (error) {
      return redirectToIntegrations(
        url,
        'error',
        error instanceof Error ? error.message : 'Airtable authorization failed.',
      )
    }
  }

  if (
    request.method === 'POST' &&
    (url.pathname === '/api/v1/integrations/airtable/connect' ||
      url.pathname === '/api/v1/integrations/airtable/disconnect')
  ) {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin setup requests are not allowed.' },
        { status: 403 },
      )
    }
    const internalPath = url.pathname.endsWith('/disconnect')
      ? '/internal/airtable/disconnect'
      : '/internal/airtable/connect'
    const input = internalPath.endsWith('/connect')
      ? ((await request.json()) as { baseId?: string })
      : null
    return stub.fetch(
      new Request(`http://workspace.internal${internalPath}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: input
          ? JSON.stringify({
              ...input,
              webhookUrl:
                url.protocol === 'https:'
                  ? new URL(
                      `/api/v1/integrations/airtable/webhook/${encodeURIComponent(workspaceKey)}`,
                      url.origin,
                    ).toString()
                  : undefined,
            })
          : undefined,
      }),
    )
  }

  return null
}

function withActor(request: Request, actor: OperationRequest['actor']) {
  const headers = new Headers(request.headers)
  for (const name of [
    'x-programkit-internal-actor-type',
    'x-programkit-internal-actor-id',
    'x-programkit-internal-actor-name',
    'x-programkit-internal-actor-scopes',
  ]) {
    headers.delete(name)
  }
  if (actor) {
    headers.set('x-programkit-internal-actor-type', actor.type)
    headers.set('x-programkit-internal-actor-id', actor.id)
    headers.set('x-programkit-internal-actor-name', actor.name)
    headers.set('x-programkit-internal-actor-scopes', actor.scopes.join(' '))
  }
  return new Request(request, { headers })
}

async function readWorkspace(stub: DurableObjectStub<WorkspaceDurableObject>) {
  const response = await stub.fetch(
    withActor(new Request('http://workspace.internal/api/v1/state'), agentReaderActor),
  )
  if (!response.ok) throw new Error('The workspace could not be loaded for MCP.')
  const body = (await response.json()) as { state: WorkspaceState }
  return body.state
}

async function executeWorkspaceOperation(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  operation: string,
  request: OperationRequest,
) {
  const { actor, ...publicRequest } = request
  const response = await stub.fetch(
    withActor(
      new Request(`http://workspace.internal/api/v1/operations/${encodeURIComponent(operation)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(publicRequest),
      }),
      actor,
    ),
  )
  return (await response.json()) as OperationResponse
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const url = new URL(request.url)
    const profile = deploymentProfile(env)
    let hostedPrincipal: HostedPrincipal | null = null

    if (
      profile === 'hosted-app' &&
      (url.pathname === '/auth/verify' || url.pathname.startsWith('/api/v1/auth/'))
    ) {
      const authResponse = await handleHostedAuthRequest(request, env, url)
      if (authResponse) return authResponse
    }

    if (profile === 'hosted-app') {
      const needsIdentity =
        (request.method === 'GET' && isDocumentNavigation(request)) ||
        url.pathname.startsWith('/api/') ||
        url.pathname === '/mcp'
      if (needsIdentity) hostedPrincipal = await resolveHostedPrincipal(env, request)

      if (request.method === 'GET' && url.pathname === '/login' && hostedPrincipal) {
        return redirect(url, '/')
      }
      if (
        request.method === 'GET' &&
        isDocumentNavigation(request) &&
        !isHostedPublicPage(url.pathname) &&
        !hostedPrincipal
      ) {
        return redirect(url, '/login')
      }
      if (
        !hostedPrincipal &&
        (url.pathname.startsWith('/api/') ||
          url.pathname.startsWith('/public/') ||
          url.pathname === '/mcp')
      ) {
        return Response.json(
          { ok: false, error: 'Sign in to continue.' },
          { status: 401, headers: { 'cache-control': 'no-store' } },
        )
      }
    }

    if (profile === 'hosted-site') {
      if (url.pathname === '/demo') {
        return Response.redirect(env.PROGRAMKIT_DEMO_ORIGIN ?? new URL('/', url), 302)
      }
      if (
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/public/') ||
        url.pathname === '/mcp'
      ) {
        return new Response(null, { status: 404 })
      }
      if (
        request.method === 'GET' &&
        isDocumentNavigation(request) &&
        !isStaticOrLegalPath(url.pathname)
      ) {
        return redirect(url, '/')
      }
    }

    if (profile === 'hosted-demo' && url.pathname === '/demo') {
      return redirect(url, '/')
    }

    if (profile === 'hosted-app' && (url.pathname === '/demo' || demoIdFromPath(url.pathname))) {
      return redirect(url, '/')
    }

    if (
      profile === 'hosted-demo' &&
      request.method === 'GET' &&
      isDocumentNavigation(request) &&
      !isStaticOrLegalPath(url.pathname) &&
      !demoIdFromPath(url.pathname) &&
      !url.pathname.startsWith('/api/') &&
      !url.pathname.startsWith('/public/') &&
      url.pathname !== '/mcp' &&
      !isDemoId(cookie(request, demoCookieName))
    ) {
      return redirect(url, '/')
    }

    if (
      profile === 'hosted-demo' &&
      !isDemoId(cookie(request, demoCookieName)) &&
      (url.pathname === '/mcp' ||
        ((url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) &&
          url.pathname !== '/api/v1/demos' &&
          url.pathname !== '/api/v1/demos/current'))
    ) {
      return Response.json(
        { ok: false, error: 'Create or open a private demo first.' },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      )
    }

    if (request.method === 'POST' && url.pathname === '/api/v1/demos') {
      if (profile === 'hosted-app') return new Response(null, { status: 404 })
      if (!sameOrigin(request, url)) {
        return Response.json(
          { ok: false, error: 'Cross-origin demo requests are not allowed.' },
          { status: 403 },
        )
      }
      const id = createDemoId()
      const createdAt = new Date().toISOString()
      const expiresAt = demoExpiresAt()
      const stub = workspaceStub(env, demoWorkspaceKey(id))
      const initialized = await stub.fetch(
        new Request('http://workspace.internal/internal/demo/initialize', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, createdAt, expiresAt }),
        }),
      )
      if (!initialized.ok) {
        return Response.json(
          { ok: false, error: 'The demo workspace could not be created.' },
          { status: 500 },
        )
      }
      return Response.json(
        {
          ok: true,
          demo: {
            createdAt,
            expiresAt,
            url: new URL(`/demo/${id}`, url.origin).toString(),
          },
        },
        { status: 201, headers: { 'cache-control': 'no-store' } },
      )
    }

    const capabilityId = demoIdFromPath(url.pathname)
    if (request.method === 'GET' && capabilityId) {
      const { response, body } = await demoStatus(
        workspaceStub(env, demoWorkspaceKey(capabilityId)),
      )
      if (!response.ok || !body.active || !body.demo) {
        return new Response(
          '<!doctype html><meta name="viewport" content="width=device-width"><title>Demo unavailable</title><main style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:24px"><h1>This demo is no longer available.</h1><p>ProgramKit demos expire after seven days or can be deleted early.</p><a href="/demo">Create a new demo</a></main>',
          {
            status: response.status === 404 ? 404 : 410,
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
          },
        )
      }
      const headers = new Headers({ location: '/', 'cache-control': 'no-store' })
      headers.append('set-cookie', demoCookie(capabilityId, url, body.demo.expiresAt))
      return new Response(null, { status: 302, headers })
    }

    if (url.pathname === '/api/v1/demos/current') {
      const id = cookie(request, demoCookieName)
      if (!isDemoId(id)) {
        return Response.json(
          { ok: true, active: false },
          { headers: { 'cache-control': 'no-store' } },
        )
      }
      const stub = workspaceStub(env, demoWorkspaceKey(id))
      if (request.method === 'GET') {
        const { response, body } = await demoStatus(stub)
        if (!response.ok || !body.active || !body.demo) {
          return Response.json(
            { ok: true, active: false },
            {
              headers: {
                'cache-control': 'no-store',
                'set-cookie': clearDemoCookie(url),
              },
            },
          )
        }
        return Response.json(
          {
            ok: true,
            active: true,
            demo: {
              createdAt: body.demo.createdAt,
              expiresAt: body.demo.expiresAt,
              url: new URL(`/demo/${id}`, url.origin).toString(),
            },
          },
          { headers: { 'cache-control': 'no-store' } },
        )
      }
      if (request.method === 'POST') {
        if (!sameOrigin(request, url)) {
          return Response.json(
            { ok: false, error: 'Cross-origin demo requests are not allowed.' },
            { status: 403 },
          )
        }
        const deleted = await stub.fetch(
          new Request('http://workspace.internal/internal/demo/delete', { method: 'POST' }),
        )
        return Response.json(
          { ok: deleted.ok, active: false },
          {
            status: deleted.ok ? 200 : deleted.status,
            headers: { 'cache-control': 'no-store', 'set-cookie': clearDemoCookie(url) },
          },
        )
      }
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } })
    }

    if (profile === 'hosted-app' && hostedPrincipal) {
      if (request.method === 'GET' && url.pathname === '/api/v1/account') {
        return Response.json(
          { ok: true, account: hostedPrincipal.account },
          { headers: { 'cache-control': 'no-store' } },
        )
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/events') {
        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        const input = (await request.json()) as { name?: unknown }
        const stub = authStub(env, hostedPrincipal.authShard)!
        const createdResponse = await stub.fetch(
          new Request('http://auth.internal/internal/events/create', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              token: hostedPrincipal.sessionToken,
              name: typeof input.name === 'string' ? input.name : '',
            }),
          }),
        )
        const created = (await createdResponse.json()) as {
          ok: boolean
          event?: AuthEventSummary
          error?: string
        }
        if (!createdResponse.ok || !created.event) {
          return Response.json(
            { ok: false, error: created.error ?? 'The event could not be created.' },
            { status: createdResponse.status },
          )
        }
        await initializeHostedEvent(env, created.event)
        const headers = new Headers({ 'cache-control': 'no-store' })
        headers.append(
          'set-cookie',
          authCookie(eventCookieName, created.event.id, url, 30 * 24 * 60 * 60),
        )
        return Response.json({ ok: true, event: created.event }, { status: 201, headers })
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/account/active-event') {
        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        const input = (await request.json()) as { eventId?: unknown }
        const event = hostedPrincipal.account.events.find(
          (candidate) => candidate.id === input.eventId,
        )
        if (!event) {
          return Response.json({ ok: false, error: 'Event access was not found.' }, { status: 403 })
        }
        const headers = new Headers({ 'cache-control': 'no-store' })
        headers.append('set-cookie', authCookie(eventCookieName, event.id, url, 30 * 24 * 60 * 60))
        return Response.json({ ok: true, activeEventId: event.id }, { headers })
      }
    }

    const oauthWebhookMatch = url.pathname.match(
      /^\/api\/v1\/integrations\/airtable\/webhook\/([^/]+)$/u,
    )
    if (request.method === 'POST' && oauthWebhookMatch) {
      const webhookWorkspaceKey = decodeURIComponent(oauthWebhookMatch[1])
      if (!workspaceKeyPattern.test(webhookWorkspaceKey)) return new Response(null, { status: 404 })
      return workspaceStub(env, webhookWorkspaceKey).fetch(
        new Request('http://workspace.internal/internal/airtable/webhook', {
          method: 'POST',
          headers: {
            'content-type': request.headers.get('content-type') ?? 'application/json',
            'x-airtable-content-mac': request.headers.get('x-airtable-content-mac') ?? '',
          },
          body: await request.arrayBuffer(),
        }),
      )
    }
    let key = hostedPrincipal
      ? eventWorkspaceKey(hostedPrincipal.account.activeEventId)
      : workspaceKey(env, request)
    let newWorkspaceCookie: string | undefined
    if (
      !env.AIRTABLE_BASE_ID &&
      key === 'demo' &&
      url.pathname === '/api/v1/integrations/airtable/oauth/start'
    ) {
      key = `try_${crypto.randomUUID().replaceAll('-', '')}`
      newWorkspaceCookie = key
    }
    const stub = workspaceStub(env, key)

    if (url.pathname.startsWith('/api/v1/integrations/airtable/')) {
      const integrationResponse = await handleAirtableIntegration(
        request,
        env,
        url,
        stub,
        key,
        newWorkspaceCookie,
      )
      if (integrationResponse) return integrationResponse
    }

    if (request.method === 'POST' && url.pathname === '/webhooks/airtable') {
      if (!env.AIRTABLE_WEBHOOK_MAC_SECRET || !env.AIRTABLE_BASE_ID) {
        return new Response(null, { status: 404 })
      }
      if (
        !(await verifyAirtableWebhookMac(
          await request.clone().arrayBuffer(),
          request.headers.get('x-airtable-content-mac'),
          env.AIRTABLE_WEBHOOK_MAC_SECRET,
        ))
      ) {
        return new Response(null, { status: 401 })
      }
      const body = (await request.json()) as { base?: { id?: string } }
      if (body.base?.id !== env.AIRTABLE_BASE_ID) return new Response(null, { status: 403 })
      context.waitUntil(
        stub.fetch(
          new Request('http://workspace.internal/internal/airtable/refresh', { method: 'POST' }),
        ),
      )
      return new Response(null, { status: 204 })
    }

    if (url.pathname === '/mcp') {
      return handleMcpRequest(request, {
        readState: () => readWorkspace(stub),
        execute: (operation, operationRequest) =>
          executeWorkspaceOperation(stub, operation, operationRequest),
      })
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) {
      const portalMatch = url.pathname.match(/^\/api\/v1\/portal\/([^/]+)\//u)
      const reviewerMatch = url.pathname.match(/^\/api\/v1\/reviewers\/([^/]+)\//u)
      const publicSubmissionMatch = url.pathname.match(
        /^\/public\/v1\/submission-forms\/([^/]+)\//u,
      )
      const actor =
        profile === 'hosted-app' && hostedPrincipal
          ? hostedStaffActor(hostedPrincipal)
          : portalMatch
            ? ({
                type: 'participant' as const,
                id: decodeURIComponent(portalMatch[1]),
                name: 'Portal participant',
                scopes: ['participations:write', 'requirements:write', 'portal:write'],
              } satisfies OperationRequest['actor'])
            : reviewerMatch
              ? ({
                  type: 'reviewer' as const,
                  id: decodeURIComponent(reviewerMatch[1]),
                  name: 'Program reviewer',
                  scopes: ['reviews:write'],
                } satisfies OperationRequest['actor'])
              : publicSubmissionMatch
                ? ({
                    type: 'submitter' as const,
                    id: decodeURIComponent(publicSubmissionMatch[1]),
                    name: 'Public submitter',
                    scopes: ['submissions:write', 'submissions:submit'],
                  } satisfies OperationRequest['actor'])
                : url.pathname.startsWith('/public/')
                  ? publicReaderActor
                  : demoStaffActor
      return stub.fetch(withActor(request, actor))
    }

    const assetResponse = await env.ASSETS.fetch(request)
    if (!assetResponse.headers.get('content-type')?.includes('text/html')) return assetResponse

    const renderedProfile =
      profile === 'hosted-site'
        ? 'hosted-site-entry'
        : profile === 'hosted-demo' && !isDemoId(cookie(request, demoCookieName))
          ? 'hosted-demo-entry'
          : profile === 'hosted-app' && !hostedPrincipal
            ? 'hosted-app-entry'
            : profile
    const headers = new Headers(assetResponse.headers)
    headers.set('cache-control', 'no-store')
    const response = new Response(assetResponse.body, assetResponse)
    for (const [name, value] of headers) response.headers.set(name, value)
    return new HTMLRewriter()
      .on('head', {
        element(element) {
          element.append(
            `<meta name="programkit-deployment-profile" content="${renderedProfile}">`,
            { html: true },
          )
        },
      })
      .transform(response)
  },
} satisfies ExportedHandler<Env>
