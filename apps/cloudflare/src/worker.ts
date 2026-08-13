import { handleMcpRequest } from '@programkit/agent'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'
import {
  createAirtableOAuthAuthorization,
  createStoredAssetExportPlan,
  createStoredZip,
  exchangeAirtableAuthorizationCode,
  listAirtableBases,
  readinessSummary,
  scheduleConflicts,
  submissionAnswerByPurpose,
  verifyAirtableWebhookMac,
  type OperationRequest,
  type OperationResponse,
  type Asset,
  type WorkspaceState,
} from '@programkit/core'
import {
  AuthDurableObject,
  normalizeEmail,
  type AuthAccount,
  type AuthEventSummary,
  type AuthMembershipProjection,
  type AuthSessionSummary,
  type InstanceAccessState,
  type InstanceSignupPolicy,
} from './auth.ts'
import { mergeOrganizationCrmState } from './organization-crm.ts'
import {
  createDemoId,
  demoCookieName,
  demoExpiresAt,
  demoIdFromPath,
  demoIdFromWorkspaceKey,
  demoWorkspaceKey,
  isDemoId,
} from './demo.ts'
import {
  EventAccessDurableObject,
  type EventApiKey,
  type EventAccessActor,
  type EventAccessEvent,
  type EventInvitation,
  type EventMembership,
} from './event-access.ts'
import { actionEmail } from './email.ts'
import { createAgentPluginBundle } from './agent-plugin.ts'

export { AuthDurableObject, EventAccessDurableObject, WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  PROGRAMKIT_FILES?: R2Bucket
  PROGRAMKIT_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
  PROGRAMKIT_AUTH?: DurableObjectNamespace<AuthDurableObject>
  PROGRAMKIT_EVENT_ACCESS?: DurableObjectNamespace<EventAccessDurableObject>
  PROGRAMKIT_DEPLOYMENT_PROFILE?: 'single-workspace' | 'hosted-site' | 'hosted-demo' | 'hosted-app'
  PROGRAMKIT_APP_ORIGIN?: string
  PROGRAMKIT_DEMO_ORIGIN?: string
  PROGRAMKIT_EMAIL_FROM?: string
  PROGRAMKIT_SUPPORT_EMAIL?: string
  PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL?: string
  PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP?: string
  PROGRAMKIT_SIGNUP_MODE?: 'open' | 'bootstrap'
  PROGRAMKIT_BOOTSTRAP_TOKEN?: string
  EMAIL?: {
    send(message: {
      to: string | string[]
      from: string
      subject: string
      html?: string
      text?: string
      replyTo?: string
      attachments?: Array<{
        disposition: 'attachment'
        filename: string
        type: string
        content: string
      }>
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
const invitationCookieName = 'programkit_invitation'
const externalSessionCookieName = 'programkit_external_session'
const publicEventCookieName = 'programkit_public_event'
const workspaceKeyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/u
const hostedEventIdPattern = /^evt_[a-f0-9]{24}$/u
const invitationTokenPattern = /^(evt_[a-f0-9]{24})\.([a-f0-9]{64})$/u
const externalSessionPattern = /^(evt_[a-f0-9]{24})\.([a-f0-9]{64})$/u
const apiKeyTokenPattern = /^pk_live_(evt_[a-f0-9]{24})_(key_[a-f0-9]{16})_([a-f0-9]{64})$/u
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
    pathname === '/sitemap.xml' ||
    pathname === '/llms.txt' ||
    pathname === '/llms-full.txt' ||
    pathname === '/docs.md' ||
    pathname.startsWith('/assets/')
  )
}

export function isHostedSiteDocument(pathname: string) {
  return isStaticOrLegalPath(pathname) || pathname === '/docs' || pathname.startsWith('/docs/')
}

export function docsMarkdownPathname(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/u, '') : pathname
  if (normalized === '/docs') return '/docs.md'
  if (!normalized.startsWith('/docs/') || normalized.endsWith('.md')) return null
  return `${normalized}.md`
}

function acceptPreference(accept: string, target: 'text/html' | 'text/markdown') {
  const [targetType, targetSubtype] = target.split('/')
  let best = { q: 0, specificity: -1, index: Number.POSITIVE_INFINITY }
  for (const [index, rawEntry] of accept.split(',').entries()) {
    const [rawMediaRange, ...parameters] = rawEntry.trim().toLowerCase().split(';')
    const [type, subtype] = rawMediaRange.split('/')
    if (!type || !subtype) continue
    const specificity =
      type === targetType && subtype === targetSubtype
        ? 2
        : type === targetType && subtype === '*'
          ? 1
          : type === '*' && subtype === '*'
            ? 0
            : -1
    if (specificity < 0) continue
    const qParameter = parameters.find((parameter) => parameter.trim().startsWith('q='))
    const q = qParameter ? Number(qParameter.trim().slice(2)) : 1
    if (!Number.isFinite(q) || q < 0 || q > 1) continue
    if (
      specificity > best.specificity ||
      (specificity === best.specificity && q > best.q) ||
      (specificity === best.specificity && q === best.q && index < best.index)
    ) {
      best = { q, specificity, index }
    }
  }
  return best
}

export function prefersMarkdown(request: Request) {
  const accept = request.headers.get('accept')
  if (!accept) return false
  const markdown = acceptPreference(accept, 'text/markdown')
  const html = acceptPreference(accept, 'text/html')
  if (markdown.q === 0) return false
  if (markdown.q !== html.q) return markdown.q > html.q
  if (markdown.specificity !== html.specificity) return markdown.specificity > html.specificity
  if (markdown.index !== html.index) return markdown.index < html.index
  return false
}

export function isApiKeyAccessiblePath(pathname: string) {
  return (
    pathname === '/mcp' ||
    pathname === '/api/v1/health' ||
    pathname === '/api/v1/manifest' ||
    pathname === '/api/v1/domain-events' ||
    pathname === '/api/v1/events' ||
    /^\/api\/v1\/events\/[^/]+(?:\/(?:sessions|speakers|submissions))?$/u.test(pathname) ||
    pathname === '/api/v1/export' ||
    pathname === '/api/v1/export.json' ||
    /^\/api\/v1\/operations\/[^/]+$/u.test(pathname)
  )
}

export function isHostedRecoveryPath(method: string, pathname: string) {
  return (
    (method === 'GET' && pathname === '/api/v1/recovery') ||
    (method === 'POST' && pathname === '/api/v1/recovery/bookmark')
  )
}

export function canDeleteStoredAssets(profile: string, role?: string | null) {
  return profile !== 'hosted-app' || role === 'owner'
}

export function isApiKeyCredentialPath(pathname: string) {
  return pathname.startsWith('/api/') || pathname === '/mcp'
}

interface RuntimeIntegrationCapabilities {
  email: boolean
  storage: boolean
}

export function runtimeIntegrations(
  integrations: WorkspaceState['integrations'],
  capabilities: RuntimeIntegrationCapabilities,
) {
  return integrations.map((integration) => {
    if (integration.kind === 'email') {
      return {
        ...integration,
        status: capabilities.email ? ('connected' as const) : ('not_configured' as const),
        detail: capabilities.email
          ? 'Cloudflare Email Service sends notifications and calendar attachments.'
          : 'Connect an email service before sending real notifications.',
      }
    }
    if (integration.kind === 'storage') {
      return {
        ...integration,
        status: capabilities.storage ? ('connected' as const) : ('not_configured' as const),
        detail: capabilities.storage
          ? 'Cloudflare R2 stores headshots and speaker deliverables.'
          : 'Connect object storage before accepting file uploads.',
      }
    }
    if (integration.kind === 'calendar') {
      return {
        ...integration,
        name: 'Calendar delivery',
        status: 'connected' as const,
        detail:
          'iCal feeds, attendee downloads, and speaker calendar attachments work with Google Calendar, Outlook, and Apple Calendar.',
      }
    }
    return { ...integration }
  })
}

export function browserSecurityHeaders(
  input: HeadersInit,
  url: URL,
  options: { allowEmbedding?: boolean } = {},
) {
  const headers = new Headers(input)
  headers.set('permissions-policy', 'camera=(), geolocation=(), microphone=()')
  headers.set('referrer-policy', 'strict-origin-when-cross-origin')
  headers.set('x-content-type-options', 'nosniff')
  if (!options.allowEmbedding) {
    headers.set('content-security-policy', "frame-ancestors 'none'")
    headers.set('x-frame-options', 'DENY')
  }
  if (url.protocol === 'https:') {
    headers.set('strict-transport-security', 'max-age=31536000')
  }
  return headers
}

export function publicOperationalResponse(
  request: Request,
  url: URL,
  profile: NonNullable<Env['PROGRAMKIT_DEPLOYMENT_PROFILE']> = 'single-workspace',
) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const body = request.method === 'HEAD' ? null : undefined

  if (url.pathname === '/agent-plugin.zip') {
    const bundle = createAgentPluginBundle(url.origin)
    return new Response(body === null ? null : bundle.archive, {
      headers: browserSecurityHeaders(
        {
          'cache-control': 'public, max-age=300',
          'content-disposition': `attachment; filename="${bundle.filename}"`,
          'content-length': String(bundle.archive.byteLength),
          'content-type': 'application/zip',
        },
        url,
      ),
    })
  }

  if (url.pathname === '/api/health' || url.pathname === '/healthz') {
    return new Response(
      body === null ? null : JSON.stringify({ ok: true, service: 'programkit', status: 'ready' }),
      {
        headers: browserSecurityHeaders(
          {
            'cache-control': 'no-store',
            'content-type': 'application/json; charset=utf-8',
          },
          url,
        ),
      },
    )
  }

  if (url.pathname === '/robots.txt') {
    const text =
      profile === 'hosted-site'
        ? [
            'User-agent: *',
            'Allow: /',
            'Disallow: /api/',
            `Sitemap: ${url.origin}/sitemap.xml`,
            '',
          ].join('\n')
        : ['User-agent: *', 'Disallow: /', ''].join('\n')
    return new Response(body === null ? null : text, {
      headers: browserSecurityHeaders(
        {
          'cache-control': 'public, max-age=86400',
          'content-type': 'text/plain; charset=utf-8',
        },
        url,
      ),
    })
  }

  if (url.pathname === '/.well-known/security.txt') {
    const text = [
      'Contact: mailto:support@programkit.dev',
      `Expires: ${new Date(Date.UTC(new Date().getUTCFullYear() + 1, 11, 31)).toISOString()}`,
      `Canonical: ${url.origin}/.well-known/security.txt`,
      '',
    ].join('\n')
    return new Response(body === null ? null : text, {
      headers: browserSecurityHeaders(
        {
          'cache-control': 'public, max-age=3600',
          'content-type': 'text/plain; charset=utf-8',
        },
        url,
      ),
    })
  }

  if (url.pathname.startsWith('/.well-known/')) {
    return new Response(body === null ? null : 'Not found.\n', {
      status: 404,
      headers: browserSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }, url),
    })
  }

  return null
}

function appendVary(headers: Headers, value: string) {
  const entries = (headers.get('vary') ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (!entries.some((entry) => entry.toLowerCase() === value.toLowerCase())) entries.push(value)
  headers.set('vary', entries.join(', '))
}

async function hostedDocsMarkdownResponse(request: Request, env: Env, url: URL) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return null
  const explicitMarkdown =
    url.pathname === '/docs.md' ||
    (url.pathname.startsWith('/docs/') && url.pathname.endsWith('.md'))
  const assetPath = explicitMarkdown ? url.pathname : docsMarkdownPathname(url.pathname)
  if (!assetPath || (!explicitMarkdown && !prefersMarkdown(request))) return null

  const assetUrl = new URL(url)
  assetUrl.pathname = assetPath
  assetUrl.search = ''
  const assetResponse = await env.ASSETS.fetch(
    new Request(assetUrl, { method: request.method, headers: request.headers }),
  )
  if (
    !assetResponse.ok ||
    assetResponse.headers.get('content-type')?.includes('text/html') === true
  ) {
    return new Response(request.method === 'HEAD' ? null : 'Documentation page not found.\n', {
      status: 404,
      headers: browserSecurityHeaders({ 'content-type': 'text/plain; charset=utf-8' }, url),
    })
  }

  const canonicalPath = assetPath === '/docs.md' ? '/docs' : assetPath.slice(0, -'.md'.length)
  const headers = browserSecurityHeaders(assetResponse.headers, url)
  headers.set('cache-control', 'public, max-age=300')
  headers.set('content-location', assetPath)
  headers.set('content-type', 'text/markdown; charset=utf-8')
  headers.set('link', `<${canonicalPath}>; rel="canonical"; type="text/html"`)
  appendVary(headers, 'Accept')
  return new Response(request.method === 'HEAD' ? null : assetResponse.body, {
    status: assetResponse.status,
    headers,
  })
}

async function withRuntimeIntegrations(response: Response, env: Env) {
  if (!response.ok) return response
  const body = (await response.json()) as {
    state?: WorkspaceState
    derived?: unknown
  }
  if (!body.state) return response
  body.state.integrations = runtimeIntegrations(body.state.integrations, {
    email: Boolean(env.EMAIL && env.PROGRAMKIT_EMAIL_FROM),
    storage: Boolean(env.PROGRAMKIT_FILES),
  })
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  headers.set('content-type', 'application/json; charset=utf-8')
  return new Response(JSON.stringify(body), { status: response.status, headers })
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

function hostedPublicEventCookie(value: string, url: URL) {
  return [
    `${publicEventCookieName}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=2592000',
    url.protocol === 'https:' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

function authStub(env: Env, shard: string) {
  if (!env.PROGRAMKIT_AUTH) return null
  return env.PROGRAMKIT_AUTH.get(env.PROGRAMKIT_AUTH.idFromName(`account_${shard}`))
}

function instanceControlStub(env: Env) {
  return authStub(env, 'instance-control')
}

function instanceSignupMode(env: Env) {
  return env.PROGRAMKIT_SIGNUP_MODE === 'open' ? 'open' : 'bootstrap'
}

function bootstrapTokenConfigured(env: Env) {
  return (
    env.PROGRAMKIT_DEPLOYMENT_PROFILE === 'single-workspace' ||
    (typeof env.PROGRAMKIT_BOOTSTRAP_TOKEN === 'string' &&
      env.PROGRAMKIT_BOOTSTRAP_TOKEN.length >= 16)
  )
}

async function bootstrapTokenAuthorized(env: Env, value: unknown) {
  if (env.PROGRAMKIT_DEPLOYMENT_PROFILE === 'single-workspace' && !env.PROGRAMKIT_BOOTSTRAP_TOKEN) {
    return true
  }
  if (
    typeof env.PROGRAMKIT_BOOTSTRAP_TOKEN !== 'string' ||
    env.PROGRAMKIT_BOOTSTRAP_TOKEN.length < 16 ||
    typeof value !== 'string' ||
    value.length > 256
  ) {
    return false
  }
  const [expected, candidate] = await Promise.all([
    hashValue(`programkit-bootstrap:${env.PROGRAMKIT_BOOTSTRAP_TOKEN}`),
    hashValue(`programkit-bootstrap:${value}`),
  ])
  let difference = 0
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ candidate.charCodeAt(index)
  }
  return difference === 0
}

interface InstanceAccessResponse extends Partial<InstanceAccessState> {
  ok: boolean
  code?: string
  claimInstanceOwner?: boolean
}

async function instanceAccessRequest(
  env: Env,
  input: Record<string, unknown>,
): Promise<InstanceAccessResponse> {
  const stub = instanceControlStub(env)
  if (!stub) return { ok: false, code: 'INSTANCE_ACCESS_UNAVAILABLE' }
  const { bootstrapToken, ...publicInput } = input
  const response = await stub.fetch(
    new Request('http://auth.internal/internal/instance/access', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        defaultMode: instanceSignupMode(env),
        bootstrapConfigured: bootstrapTokenConfigured(env),
        bootstrapAuthorized: await bootstrapTokenAuthorized(env, bootstrapToken),
        ...publicInput,
      }),
    }),
  )
  return (await response.json()) as InstanceAccessResponse
}

function externalDirectoryStub(env: Env) {
  if (!env.PROGRAMKIT_AUTH) return null
  return env.PROGRAMKIT_AUTH.get(env.PROGRAMKIT_AUTH.idFromName('external-directory'))
}

function eventAccessStub(env: Env, eventId: string) {
  if (!env.PROGRAMKIT_EVENT_ACCESS) return null
  return env.PROGRAMKIT_EVENT_ACCESS.get(env.PROGRAMKIT_EVENT_ACCESS.idFromName(eventId))
}

function eventWorkspaceKey(eventId: string) {
  return `event_${eventId}`
}

async function syncHostedEventSummary(
  env: Env,
  principal: Pick<HostedPrincipal, 'authShard' | 'sessionToken'>,
  event: Pick<AuthEventSummary, 'id' | 'name' | 'slug'>,
) {
  const response = await authStub(env, principal.authShard)?.fetch(
    new Request('http://auth.internal/internal/events/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: principal.sessionToken,
        eventId: event.id,
        name: event.name,
        slug: event.slug,
      }),
    }),
  )
  return response?.ok === true
}

async function hostedActiveEventSummary(stub: DurableObjectStub<WorkspaceDurableObject>) {
  const state = await readWorkspace(stub)
  return state.events.find((candidate) => candidate.id === state.activeEventId) ?? null
}

async function syncHostedActiveEventSummary(
  env: Env,
  principal: Pick<HostedPrincipal, 'authShard' | 'sessionToken' | 'account'>,
  stub: DurableObjectStub<WorkspaceDurableObject>,
) {
  const event = await hostedActiveEventSummary(stub)
  if (!event) return null
  await syncHostedEventSummary(env, principal, event)
  return event
}

async function currentHostedAccount(env: Env, principal: HostedPrincipal): Promise<AuthAccount> {
  const account = principal.account
  const active = account.events.find((event) => event.id === account.activeEventId)
  if (!active) return account
  try {
    const current = await hostedActiveEventSummary(workspaceStub(env, eventWorkspaceKey(active.id)))
    if (!current || (current.name === active.name && current.slug === active.slug)) return account
    await syncHostedEventSummary(env, principal, current)
    return {
      ...account,
      events: account.events.map((event) =>
        event.id === current.id ? { ...event, name: current.name, slug: current.slug } : event,
      ),
    }
  } catch {
    return account
  }
}

async function hashValue(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (entry) => entry.toString(16).padStart(2, '0')).join('')
}

interface HostedPrincipal {
  authShard: string
  sessionToken: string
  account: AuthAccount
  membership: EventMembership | null
  scopes: string[]
}

interface ApiKeyPrincipal {
  eventId: string
  apiKey: EventApiKey
  actor: NonNullable<OperationRequest['actor']>
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

export function parseApiKeyToken(value: string | null) {
  const match = value?.match(apiKeyTokenPattern)
  if (!match) return null
  return { token: value!, eventId: match[1], apiKeyId: match[2] }
}

function bearerToken(request: Request) {
  const value = request.headers.get('authorization')
  const match = value?.match(/^Bearer\s+(.+)$/iu)
  return match?.[1]?.trim() ?? null
}

async function resolveApiKeyPrincipal(env: Env, request: Request) {
  const parsed = parseApiKeyToken(bearerToken(request))
  if (!parsed) return null
  const access = eventAccessStub(env, parsed.eventId)
  if (!access) return null
  const response = await access.fetch(
    new Request('http://event-access.internal/internal/event-access/api-keys/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(parsed),
    }),
  )
  const body = (await response.json()) as EventAccessResponse
  if (!response.ok || !body.apiKey || !body.scopes) return null
  return {
    eventId: parsed.eventId,
    apiKey: body.apiKey,
    actor: {
      type: 'service',
      id: body.apiKey.id,
      name: body.apiKey.name,
      scopes: body.scopes,
    },
  } satisfies ApiKeyPrincipal
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
  if (!body.ok || !body.account) return null
  const activeEvent = body.account.events.find((event) => event.id === body.account!.activeEventId)
  if (!activeEvent) return null
  const access = await resolveHostedEventAccess(
    env,
    {
      authShard: session.shard,
      sessionToken: session.secret,
      account: body.account,
    },
    activeEvent,
  )
  return {
    authShard: session.shard,
    sessionToken: session.secret,
    account: body.account,
    membership: access?.membership ?? null,
    scopes: access?.scopes ?? [],
  }
}

function hostedStaffActor(principal: HostedPrincipal) {
  return {
    type: 'staff' as const,
    id: principal.account.user.id,
    name: principal.account.user.name,
    scopes: principal.scopes,
  }
}

function isHostedAlwaysPublicPage(pathname: string) {
  return pathname === '/login' || pathname === '/privacy' || pathname === '/terms'
}

function isHostedPublicDocument(pathname: string) {
  return (
    pathname === '/agenda' ||
    pathname === '/access' ||
    pathname.startsWith('/submit/') ||
    /^\/reviewer\/[^/]+\/[^/]+\/?$/u.test(pathname) ||
    /^\/portal\/[^/]+\/[^/]+\/?$/u.test(pathname)
  )
}

export function hostedPublicEventId(request: Request, url: URL) {
  if (isDocumentNavigation(request) && isHostedPublicDocument(url.pathname)) {
    const requested = url.searchParams.get('event')
    if (requested && hostedEventIdPattern.test(requested)) return requested
    const selected = cookie(request, publicEventCookieName)
    return selected && hostedEventIdPattern.test(selected) ? selected : null
  }
  if (url.pathname.startsWith('/public/')) {
    const requested = url.searchParams.get('event')
    if (requested && hostedEventIdPattern.test(requested)) return requested
    const selected = cookie(request, publicEventCookieName)
    return selected && hostedEventIdPattern.test(selected) ? selected : null
  }
  return null
}

export function isHostedDemoReset(profile: string, method: string, pathname: string) {
  return (
    profile === 'hosted-app' &&
    method === 'POST' &&
    pathname === '/api/v1/operations/workspace.reset-demo'
  )
}

interface ExternalAccessIdentity {
  id: string
  name: string
  email: string
}

interface ExternalAccessDestination {
  id: string
  kind: 'submissions' | 'reviewer' | 'speaker'
  label: string
  detail: string
  href: string
}

interface ExternalAccessResponse {
  ok: boolean
  code?: string
  error?: string
  identity?: ExternalAccessIdentity
  sessionToken?: string
  sessionExpiresAt?: string
}

interface ExternalDirectoryEvent {
  id: string
  name: string
  slug: string
  updatedAt: string
}

function externalSessionCookie(eventId: string, token: string, url: URL, expiresAt: string) {
  const maxAge = Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1_000))
  return authCookie(externalSessionCookieName, `${eventId}.${token}`, url, maxAge)
}

function parseExternalSession(value: string | null, eventId: string) {
  const match = value?.match(externalSessionPattern)
  return match?.[1] === eventId ? match[2] : null
}

function parseAnyExternalSession(value: string | null) {
  const match = value?.match(externalSessionPattern)
  return match ? { eventId: match[1], token: match[2] } : null
}

function externalAccessHref(pathname: string, eventId: string) {
  const search = new URLSearchParams({ event: eventId })
  return `${pathname}?${search}`
}

function externalAccessDestinations(
  state: WorkspaceState,
  email: string,
  eventId: string,
): ExternalAccessDestination[] {
  const normalizedEmail = normalizeEmail(email)
  if (!normalizedEmail) return []
  const destinations: ExternalAccessDestination[] = []
  const seenSubmissionKeys = new Set<string>()

  for (const submission of state.submissions) {
    const submissionEmail = normalizeEmail(submissionAnswerByPurpose(state, submission, 'email'))
    if (submission.eventId !== eventId || submissionEmail !== normalizedEmail) continue
    const form = state.submissionForms.find((entry) => entry.id === submission.formId)
    if (!form) continue
    const key = `${form.id}:${submission.speakerAccessKey}`
    if (seenSubmissionKeys.has(key)) continue
    seenSubmissionKeys.add(key)
    destinations.push({
      id: `submissions:${key}`,
      kind: 'submissions',
      label: form.title,
      detail: 'Your proposals and decisions',
      href: externalAccessHref(
        `/submit/${encodeURIComponent(form.slug)}/mine/${encodeURIComponent(submission.speakerAccessKey)}`,
        eventId,
      ),
    })
  }

  for (const reviewer of state.reviewers) {
    if (
      reviewer.eventId !== eventId ||
      reviewer.status === 'inactive' ||
      normalizeEmail(reviewer.email) !== normalizedEmail
    ) {
      continue
    }
    destinations.push({
      id: `reviewer:${reviewer.id}`,
      kind: 'reviewer',
      label: 'Reviewer workspace',
      detail: reviewer.name,
      href: externalAccessHref(
        `/reviewer/${encodeURIComponent(reviewer.id)}/${encodeURIComponent(reviewer.accessKey)}`,
        eventId,
      ),
    })
  }

  for (const participation of state.participations) {
    if (participation.eventId !== eventId) continue
    const person = state.people.find((entry) => entry.id === participation.personId)
    if (!person || normalizeEmail(person.email) !== normalizedEmail) continue
    destinations.push({
      id: `speaker:${participation.id}`,
      kind: 'speaker',
      label: 'Speaker portal',
      detail: `${person.firstName} ${person.lastName}`,
      href: externalAccessHref(
        `/portal/${encodeURIComponent(participation.id)}/${encodeURIComponent(participation.portalAccessKey)}`,
        eventId,
      ),
    })
  }

  return destinations.sort((left, right) => left.label.localeCompare(right.label))
}

async function externalAccessPayload(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  identity: ExternalAccessIdentity,
  eventId: string,
  formSlug?: string | null,
) {
  const state = await readWorkspace(stub)
  const event = state.events.find((entry) => entry.id === eventId)
  const destinations = externalAccessDestinations(state, identity.email, eventId)
  const submissionDestination = formSlug
    ? destinations.find((destination) => {
        if (destination.kind !== 'submissions') return false
        const pathname = new URL(destination.href, 'https://programkit.invalid').pathname
        return pathname.startsWith(`/submit/${encodeURIComponent(formSlug)}/mine/`)
      })
    : null
  const accessKey = submissionDestination
    ? decodeURIComponent(
        new URL(submissionDestination.href, 'https://programkit.invalid').pathname
          .split('/')
          .at(-1) ?? '',
      )
    : null
  return {
    eventName: event?.name ?? 'Event',
    eventLogoUrl: event?.logoUrl ?? '',
    identity,
    destinations,
    submissionAccessKey: accessKey || null,
  }
}

async function externalEventBranding(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  eventId: string,
) {
  const state = await readWorkspace(stub)
  const event = state.events.find((entry) => entry.id === eventId)
  return { eventName: event?.name ?? 'Event', eventLogoUrl: event?.logoUrl ?? '' }
}

function workspaceExternalEmails(state: WorkspaceState) {
  const emails = new Set<string>()
  for (const reviewer of state.reviewers) {
    if (reviewer.eventId === state.activeEventId && reviewer.status !== 'inactive') {
      const email = normalizeEmail(reviewer.email)
      if (email) emails.add(email)
    }
  }
  for (const participation of state.participations) {
    if (participation.eventId !== state.activeEventId) continue
    const person = state.people.find((entry) => entry.id === participation.personId)
    const email = normalizeEmail(person?.email)
    if (email) emails.add(email)
  }
  for (const submission of state.submissions) {
    if (submission.eventId !== state.activeEventId) continue
    const email = normalizeEmail(submissionAnswerByPurpose(state, submission, 'email'))
    if (email) emails.add(email)
  }
  return [...emails]
}

async function syncExternalAccessDirectory(
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
) {
  const directory = externalDirectoryStub(env)
  if (!directory) return
  const state = await readWorkspace(stub)
  const event = state.events.find((entry) => entry.id === state.activeEventId)
  if (!event) return
  const response = await directory.fetch(
    new Request('http://auth.internal/internal/external-directory/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId: event.id,
        name: event.name,
        slug: event.slug,
        emails: workspaceExternalEmails(state),
      }),
    }),
  )
  if (!response.ok) throw new Error('Participant access directory could not be updated.')
}

async function externalDirectoryEvents(env: Env, email: string) {
  const directory = externalDirectoryStub(env)
  if (!directory) return []
  const response = await directory.fetch(
    new Request('http://auth.internal/internal/external-directory/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email }),
    }),
  )
  if (!response.ok) return []
  const body = (await response.json()) as { ok?: boolean; events?: ExternalDirectoryEvent[] }
  return body.ok ? (body.events ?? []) : []
}

async function externalSessionPayload(
  env: Env,
  eventId: string,
  token: string,
  formSlug?: string | null,
) {
  const access = eventAccessStub(env, eventId)
  if (!access) return null
  const response = await access.fetch(
    new Request('http://event-access.internal/internal/event-access/external/session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId, token }),
    }),
  )
  const body = (await response.json()) as ExternalAccessResponse
  if (!response.ok || !body.identity) return null
  const workspace = workspaceStub(env, eventWorkspaceKey(eventId))
  return {
    eventId,
    ...(await externalAccessPayload(workspace, body.identity, eventId, formSlug)),
  }
}

async function handleExternalAccessDiscovery(request: Request, env: Env, url: URL) {
  const savedSession = parseAnyExternalSession(cookie(request, externalSessionCookieName))

  if (request.method === 'GET' && url.pathname === '/public/v1/access/discover/session') {
    if (!savedSession) {
      return Response.json(
        { ok: true, authenticated: false },
        { headers: { 'cache-control': 'no-store' } },
      )
    }
    const payload = await externalSessionPayload(env, savedSession.eventId, savedSession.token)
    if (payload) {
      return Response.json(
        { ok: true, authenticated: true, ...payload },
        { headers: { 'cache-control': 'no-store' } },
      )
    }
    return Response.json(
      { ok: true, authenticated: false },
      {
        headers: {
          'cache-control': 'no-store',
          'set-cookie': clearAuthCookie(externalSessionCookieName, url),
        },
      },
    )
  }

  if (request.method === 'POST' && url.pathname === '/public/v1/access/discover/password') {
    if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
    const input = (await request.json()) as Record<string, unknown>
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    const intent = input.intent === 'signup' ? 'signup' : 'signin'
    const name = typeof input.name === 'string' ? input.name : ''
    if (!email || password.length < 10 || password.length > 128) {
      return Response.json(
        { ok: false, error: 'Enter a valid email and a password with at least 10 characters.' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }
    const events = await externalDirectoryEvents(env, email)
    const candidates = intent === 'signup' ? events.slice(0, 1) : events
    const ipHash = await hashValue(request.headers.get('cf-connecting-ip') ?? 'local')
    for (const event of candidates) {
      const access = eventAccessStub(env, event.id)
      if (!access) continue
      const authenticatedResponse = await access.fetch(
        new Request('http://event-access.internal/internal/event-access/external/password', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            eventId: event.id,
            email,
            password,
            intent,
            name,
            ipHash,
          }),
        }),
      )
      const authenticated = (await authenticatedResponse.json()) as ExternalAccessResponse
      if (
        !authenticatedResponse.ok ||
        !authenticated.identity ||
        !authenticated.sessionToken ||
        !authenticated.sessionExpiresAt
      ) {
        continue
      }
      const payload = await externalSessionPayload(env, event.id, authenticated.sessionToken)
      if (!payload) continue
      return Response.json(
        { ok: true, authenticated: true, ...payload },
        {
          status: intent === 'signup' ? 201 : 200,
          headers: {
            'cache-control': 'no-store',
            'set-cookie': externalSessionCookie(
              event.id,
              authenticated.sessionToken,
              url,
              authenticated.sessionExpiresAt,
            ),
          },
        },
      )
    }
    return Response.json(
      {
        ok: false,
        error:
          intent === 'signup'
            ? 'No event invitation was found for this email.'
            : 'The email or password is incorrect.',
      },
      { status: 401, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (request.method === 'POST' && url.pathname === '/public/v1/access/discover/logout') {
    if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
    if (savedSession) {
      const access = eventAccessStub(env, savedSession.eventId)
      await access?.fetch(
        new Request('http://event-access.internal/internal/event-access/external/logout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId: savedSession.eventId, token: savedSession.token }),
        }),
      )
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          'cache-control': 'no-store',
          'set-cookie': clearAuthCookie(externalSessionCookieName, url),
        },
      },
    )
  }

  return null
}

async function handleExternalAccessRequest(request: Request, env: Env, url: URL, eventId: string) {
  const access = eventAccessStub(env, eventId)
  if (!access) {
    return Response.json(
      { ok: false, error: 'Participant access is unavailable.' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
  const workspace = workspaceStub(env, eventWorkspaceKey(eventId))
  const formSlug = url.searchParams.get('form')
  const sessionToken = parseExternalSession(cookie(request, externalSessionCookieName), eventId)

  if (request.method === 'GET' && url.pathname === '/public/v1/access/session') {
    const branding = await externalEventBranding(workspace, eventId)
    if (!sessionToken) {
      return Response.json(
        { ok: true, authenticated: false, eventId, ...branding },
        { headers: { 'cache-control': 'no-store' } },
      )
    }
    const response = await access.fetch(
      new Request('http://event-access.internal/internal/event-access/external/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, token: sessionToken }),
      }),
    )
    const body = (await response.json()) as ExternalAccessResponse
    if (!response.ok || !body.identity) {
      return Response.json(
        { ok: true, authenticated: false, eventId, ...branding },
        {
          headers: {
            'cache-control': 'no-store',
            'set-cookie': clearAuthCookie(externalSessionCookieName, url),
          },
        },
      )
    }
    return Response.json(
      {
        ok: true,
        authenticated: true,
        eventId,
        ...(await externalAccessPayload(workspace, body.identity, eventId, formSlug)),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  if (request.method === 'POST' && url.pathname === '/public/v1/access/password') {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      )
    }
    const input = (await request.json()) as Record<string, unknown>
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    const intent = input.intent === 'signup' ? 'signup' : 'signin'
    const name = typeof input.name === 'string' ? input.name : ''
    if (!email || password.length < 10 || password.length > 128) {
      return Response.json(
        { ok: false, error: 'Enter a valid email and a password with at least 10 characters.' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }
    const ipHash = await hashValue(request.headers.get('cf-connecting-ip') ?? 'local')
    const authenticatedResponse = await access.fetch(
      new Request('http://event-access.internal/internal/event-access/external/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId, email, password, intent, name, ipHash }),
      }),
    )
    const authenticated = (await authenticatedResponse.json()) as ExternalAccessResponse
    if (
      !authenticatedResponse.ok ||
      !authenticated.identity ||
      !authenticated.sessionToken ||
      !authenticated.sessionExpiresAt
    ) {
      return Response.json(
        {
          ok: false,
          code: authenticated.code,
          error:
            authenticated.error ??
            (intent === 'signup'
              ? 'That account already exists. Sign in instead.'
              : 'The email or password is incorrect.'),
        },
        {
          status: authenticatedResponse.status,
          headers: { 'cache-control': 'no-store' },
        },
      )
    }
    const payload = await externalAccessPayload(
      workspace,
      authenticated.identity,
      eventId,
      formSlug,
    )
    return Response.json(
      { ok: true, authenticated: true, eventId, ...payload },
      {
        status: intent === 'signup' ? 201 : 200,
        headers: {
          'cache-control': 'no-store',
          'set-cookie': externalSessionCookie(
            eventId,
            authenticated.sessionToken,
            url,
            authenticated.sessionExpiresAt,
          ),
        },
      },
    )
  }

  if (request.method === 'POST' && url.pathname === '/public/v1/access/logout') {
    if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
    if (sessionToken) {
      await access.fetch(
        new Request('http://event-access.internal/internal/event-access/external/logout', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ eventId, token: sessionToken }),
        }),
      )
    }
    return Response.json(
      { ok: true },
      {
        headers: {
          'cache-control': 'no-store',
          'set-cookie': clearAuthCookie(externalSessionCookieName, url),
        },
      },
    )
  }

  return null
}

export function configuredAppOrigin(env: Pick<Env, 'PROGRAMKIT_APP_ORIGIN'>, requestUrl: URL) {
  if (requestUrl.hostname === 'localhost' || requestUrl.hostname === '127.0.0.1') {
    return requestUrl.origin
  }
  return env.PROGRAMKIT_APP_ORIGIN ?? requestUrl.origin
}

async function initializeHostedEvent(
  env: Env,
  event: AuthEventSummary,
  createdAt = event.createdAt,
  settings?: Omit<NormalizedHostedEventCreateInput, 'name'>,
) {
  const response = await workspaceStub(env, eventWorkspaceKey(event.id)).fetch(
    new Request('http://workspace.internal/internal/event/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        id: event.id,
        name: event.name,
        slug: event.slug,
        createdAt,
        ...settings,
      }),
    }),
  )
  if (!response.ok && response.status !== 409) {
    throw new Error('The event workspace could not be initialized.')
  }
}

interface NormalizedHostedEventCreateInput {
  name: string
  startsAt?: string
  endsAt?: string
  timezone: string
  venue: string
  city: string
}

function optionalEventText(value: unknown, field: string, maximumLength: number) {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error(`${field} must be text.`)
  const normalized = value.trim()
  if (normalized.length > maximumLength) {
    throw new Error(`${field} must be ${maximumLength} characters or fewer.`)
  }
  return normalized
}

export function normalizeHostedEventCreateInput(input: unknown): NormalizedHostedEventCreateInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Enter the event details.')
  }
  const candidate = input as Record<string, unknown>
  const name = optionalEventText(candidate.name, 'Event name', 120)
  if (name.length < 2) throw new Error('Enter an event name with at least 2 characters.')
  const venue = optionalEventText(candidate.venue, 'Venue', 200)
  const city = optionalEventText(candidate.city, 'City', 120)
  const timezone = optionalEventText(candidate.timezone, 'Timezone', 100) || 'UTC'
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format()
  } catch {
    throw new Error('Choose a valid timezone.')
  }

  const hasStartsAt = candidate.startsAt !== undefined && candidate.startsAt !== null
  const hasEndsAt = candidate.endsAt !== undefined && candidate.endsAt !== null
  if (hasStartsAt !== hasEndsAt) throw new Error('Choose both a start date and an end date.')
  if (!hasStartsAt) return { name, timezone, venue, city }
  if (typeof candidate.startsAt !== 'string' || typeof candidate.endsAt !== 'string') {
    throw new Error('Choose valid event dates.')
  }
  const startsAt = candidate.startsAt.trim()
  const endsAt = candidate.endsAt.trim()
  if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))) {
    throw new Error('Choose valid event dates.')
  }
  if (Date.parse(startsAt) >= Date.parse(endsAt)) {
    throw new Error('The event end must be after its start.')
  }
  return { name, startsAt, endsAt, timezone, venue, city }
}

type HostedSessionPrincipal = Pick<HostedPrincipal, 'authShard' | 'sessionToken' | 'account'>

interface EventAccessResponse {
  ok: boolean
  code?: string
  error?: string
  event?: EventAccessEvent
  membership?: EventMembership
  memberships?: EventMembership[]
  invitation?: EventInvitation
  invitations?: EventInvitation[]
  apiKey?: EventApiKey
  apiKeys?: EventApiKey[]
  token?: string
  scopes?: string[]
}

function eventAccessActor(principal: HostedSessionPrincipal): EventAccessActor {
  return {
    userId: principal.account.user.id,
    email: principal.account.user.email,
  }
}

async function initializeHostedEventAccess(
  env: Env,
  event: AuthEventSummary,
  owner: EventAccessActor,
) {
  const stub = eventAccessStub(env, event.id)
  if (!stub) throw new Error('Event access is not configured.')
  const response = await stub.fetch(
    new Request('http://event-access.internal/internal/event-access/initialize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ event, owner }),
    }),
  )
  const body = (await response.json()) as EventAccessResponse
  if (!response.ok || !body.membership) {
    throw new Error(body.error ?? 'Event access could not be initialized.')
  }
  return body.membership
}

function membershipProjection(
  event: AuthEventSummary,
  membership: EventMembership,
): AuthMembershipProjection {
  return {
    id: event.id,
    organizationId: event.organizationId,
    name: event.name,
    slug: event.slug,
    role: membership.role,
    createdAt: event.createdAt,
    membershipId: membership.id,
    membershipVersion: membership.version,
    joinedAt: membership.joinedAt,
  }
}

async function linkHostedMembership(
  env: Env,
  principal: HostedSessionPrincipal,
  event: AuthEventSummary,
  membership: EventMembership,
) {
  const projection = membershipProjection(event, membership)
  const response = await authStub(env, principal.authShard)!.fetch(
    new Request('http://auth.internal/internal/memberships/link', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: principal.sessionToken, eventId: event.id, ...projection }),
    }),
  )
  if (!response.ok) return false
  Object.assign(event, projection)
  return true
}

async function resolveHostedEventAccess(
  env: Env,
  principal: HostedSessionPrincipal,
  event: AuthEventSummary,
) {
  const stub = eventAccessStub(env, event.id)
  if (!stub) return null
  const actor = eventAccessActor(principal)
  let response = await stub.fetch(
    new Request('http://event-access.internal/internal/event-access/memberships/lookup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ eventId: event.id, ...actor }),
    }),
  )
  let body = (await response.json()) as EventAccessResponse

  if (!response.ok && body.code === 'EVENT_NOT_INITIALIZED' && event.role === 'owner') {
    const membership = await initializeHostedEventAccess(env, event, actor)
    body = {
      ok: true,
      event: {
        id: event.id,
        organizationId: event.organizationId,
        name: event.name,
        slug: event.slug,
        createdAt: event.createdAt,
      },
      membership,
      scopes: ['*'],
    }
    response = new Response(null, { status: 200 })
  }
  if (!response.ok || !body.event || !body.membership || !body.scopes) return null

  if (
    event.organizationId !== body.event.organizationId ||
    event.membershipId !== body.membership.id ||
    event.membershipVersion !== body.membership.version ||
    event.role !== body.membership.role
  ) {
    event.organizationId = body.event.organizationId
    if (!(await linkHostedMembership(env, principal, event, body.membership))) return null
  }
  return { membership: body.membership, scopes: body.scopes }
}

async function hostedEventExists(stub: DurableObjectStub<WorkspaceDurableObject>, eventId: string) {
  const response = await stub.fetch(new Request('http://workspace.internal/internal/event/status'))
  if (!response.ok) return false
  const body = (await response.json()) as { ok?: boolean; event?: { id?: string } }
  return body.ok === true && body.event?.id === eventId
}

function unavailablePublicEvent(request: Request) {
  if (!isDocumentNavigation(request)) {
    return Response.json(
      { ok: false, error: 'This public event link is no longer available.' },
      { status: 404, headers: { 'cache-control': 'no-store' } },
    )
  }
  return new Response(
    '<!doctype html><meta name="viewport" content="width=device-width"><title>Event unavailable</title><main style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:24px"><h1>This event link is not available.</h1><p>Ask the organizer for a current ProgramKit link.</p><a href="https://programkit.dev">About ProgramKit</a></main>',
    {
      status: 404,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    },
  )
}

interface HostedAuthenticationResult {
  ok: boolean
  sessionToken?: string
  sessionExpiresAt?: string
  account?: AuthAccount
  claimInstanceOwner?: boolean
}

interface HostedAccountSecurityResult {
  ok: boolean
  email?: string
  passwordConfigured?: boolean
  sessions?: AuthSessionSummary[]
  revokedSessions?: number
  code?:
    | 'SESSION_INVALID'
    | 'PASSWORD_INVALID'
    | 'CURRENT_PASSWORD_INVALID'
    | 'PASSWORD_REUSED'
    | 'TOO_MANY_ATTEMPTS'
    | 'SESSION_NOT_FOUND'
}

function accountSecurityError(result: HostedAccountSecurityResult) {
  if (result.code === 'PASSWORD_INVALID') return 'Use between 10 and 128 characters.'
  if (result.code === 'CURRENT_PASSWORD_INVALID') return 'The current password is incorrect.'
  if (result.code === 'PASSWORD_REUSED') return 'Choose a password you are not already using.'
  if (result.code === 'TOO_MANY_ATTEMPTS') return 'Too many attempts. Try again later.'
  if (result.code === 'SESSION_NOT_FOUND') return 'That session is no longer active.'
  return 'Sign in again to manage account security.'
}

function hostedAccountSession(request: Request, env: Env) {
  const session = parseScopedAuthToken(cookie(request, sessionCookieName))
  const stub = session ? authStub(env, session.shard) : null
  return session && stub ? { session, stub } : null
}

function accountSecurityJson(
  result: HostedAccountSecurityResult,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return Response.json(
    result.ok ? { ...result, ...extra } : { ok: false, error: accountSecurityError(result) },
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

async function establishHostedSession(
  env: Env,
  url: URL,
  authShard: string,
  authenticated: HostedAuthenticationResult,
  response: { destination?: string; status?: number } = {},
) {
  if (!authenticated.ok || !authenticated.sessionToken || !authenticated.account) return null
  const firstEvent = authenticated.account.events.find(
    (event) => event.id === authenticated.account!.activeEventId,
  )
  if (!firstEvent) return null
  await initializeHostedEvent(env, firstEvent)
  const principal: HostedSessionPrincipal = {
    authShard,
    sessionToken: authenticated.sessionToken,
    account: authenticated.account,
  }
  const access = await resolveHostedEventAccess(env, principal, firstEvent)
  if (!access) throw new Error('Event access could not be resolved.')
  const maxAge = Math.max(
    0,
    Math.floor((Date.parse(authenticated.sessionExpiresAt ?? '') - Date.now()) / 1_000),
  )
  const headers = new Headers({ 'cache-control': 'no-store' })
  headers.append(
    'set-cookie',
    authCookie(
      sessionCookieName,
      scopedAuthToken(authShard, authenticated.sessionToken),
      url,
      maxAge,
    ),
  )
  headers.append(
    'set-cookie',
    authCookie(eventCookieName, authenticated.account.activeEventId, url, maxAge),
  )
  if (response.destination) {
    headers.set('location', response.destination)
    return new Response(null, { status: 302, headers })
  }
  return Response.json(
    {
      ok: true,
      account: {
        user: authenticated.account.user,
        activeEventId: authenticated.account.activeEventId,
      },
    },
    { status: response.status ?? 200, headers },
  )
}

export async function handleHostedAuthRequest(request: Request, env: Env, url: URL) {
  if (!env.PROGRAMKIT_AUTH)
    return Response.json({ ok: false, error: 'Authentication is unavailable.' }, { status: 503 })

  if (request.method === 'GET' && url.pathname === '/api/v1/auth/config') {
    const invitation = cookie(request, invitationCookieName)
    const invited = invitationTokenPattern.test(invitation ?? '')
    const access = await instanceAccessRequest(env, { action: 'status', invited })
    return Response.json(
      {
        ok: access.ok,
        invited,
        managed: access.managed ?? false,
        initialized: access.initialized ?? false,
        policy: access.policy ?? 'invite_only',
        signupAvailable: access.signupAvailable ?? invited,
        bootstrapRequired: access.managed === true && access.initialized === false,
        bootstrapConfigured: bootstrapTokenConfigured(env),
        emailConfigured: Boolean(env.EMAIL && env.PROGRAMKIT_EMAIL_FROM),
      },
      { status: access.ok ? 200 : 503, headers: { 'cache-control': 'no-store' } },
    )
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/auth/security') {
    const accountSession = hostedAccountSession(request, env)
    if (!accountSession) {
      return accountSecurityJson({ ok: false, code: 'SESSION_INVALID' }, 401)
    }
    const response = await accountSession.stub.fetch(
      new Request('http://auth.internal/internal/auth/security', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: accountSession.session.secret }),
      }),
    )
    const result = (await response.json()) as HostedAccountSecurityResult
    return accountSecurityJson(result, response.status)
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/password/change') {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      )
    }
    const accountSession = hostedAccountSession(request, env)
    if (!accountSession) {
      return accountSecurityJson({ ok: false, code: 'SESSION_INVALID' }, 401)
    }
    const input = (await request.json().catch(() => ({}))) as {
      currentPassword?: unknown
      newPassword?: unknown
    }
    const ipHash = await hashValue(request.headers.get('cf-connecting-ip') ?? 'local')
    const response = await accountSession.stub.fetch(
      new Request('http://auth.internal/internal/auth/password/change', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          token: accountSession.session.secret,
          currentPassword: input.currentPassword,
          newPassword: input.newPassword,
          ipHash,
        }),
      }),
    )
    const result = (await response.json()) as HostedAccountSecurityResult
    return accountSecurityJson(result, response.status, {
      message: result.passwordConfigured ? 'Password updated.' : undefined,
    })
  }

  const sessionMatch = url.pathname.match(/^\/api\/v1\/auth\/sessions(?:\/([^/]+))?$/u)
  if (request.method === 'DELETE' && sessionMatch) {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      )
    }
    const accountSession = hostedAccountSession(request, env)
    if (!accountSession) {
      return accountSecurityJson({ ok: false, code: 'SESSION_INVALID' }, 401)
    }
    let sessionId: string | undefined
    try {
      sessionId = sessionMatch[1] ? decodeURIComponent(sessionMatch[1]) : undefined
    } catch {
      return Response.json(
        { ok: false, error: 'That session is no longer active.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }
    if (sessionId && !/^ses_[a-f0-9]{24}$/u.test(sessionId)) {
      return Response.json(
        { ok: false, error: 'That session is no longer active.' },
        { status: 404, headers: { 'cache-control': 'no-store' } },
      )
    }
    const response = await accountSession.stub.fetch(
      new Request('http://auth.internal/internal/auth/sessions/revoke', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: accountSession.session.secret, sessionId }),
      }),
    )
    const result = (await response.json()) as HostedAccountSecurityResult
    return accountSecurityJson(result, response.status)
  }

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/magic-link') {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      )
    }
    const input = (await request.json()) as {
      email?: unknown
      intent?: unknown
      name?: unknown
      bootstrapToken?: unknown
    }
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
    const intent = input.intent === 'signup' ? 'signup' : 'signin'
    const invited = invitationTokenPattern.test(cookie(request, invitationCookieName) ?? '')
    const signupAccess =
      intent === 'signup'
        ? await instanceAccessRequest(env, {
            action: 'begin_signup',
            email,
            invited,
            bootstrapToken: input.bootstrapToken,
          })
        : null
    const issuedResponse = await stub.fetch(
      new Request('http://auth.internal/internal/auth/request', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email,
          ipHash,
          intent,
          name: input.name,
          allowSignup: signupAccess?.ok === true,
          claimInstanceOwner: signupAccess?.claimInstanceOwner === true,
        }),
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
      const emailContent = actionEmail({
        title: 'Sign in',
        intro: 'Use this link to continue.',
        actionLabel: 'Sign in',
        actionUrl: callback.toString(),
        footnote: 'This link expires in 15 minutes and can be used once.',
      })
      try {
        await env.EMAIL.send({
          to: issued.email ?? email,
          from: env.PROGRAMKIT_EMAIL_FROM,
          replyTo: env.PROGRAMKIT_SUPPORT_EMAIL,
          subject: 'Your sign-in link',
          ...emailContent,
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

  if (request.method === 'POST' && url.pathname === '/api/v1/auth/password') {
    if (!sameOrigin(request, url)) {
      return Response.json(
        { ok: false, error: 'Cross-origin requests are not allowed.' },
        { status: 403 },
      )
    }
    const input = (await request.json()) as {
      email?: unknown
      password?: unknown
      intent?: unknown
      name?: unknown
      bootstrapToken?: unknown
    }
    const email = normalizeEmail(input.email)
    const password = typeof input.password === 'string' ? input.password : ''
    const intent = input.intent === 'signup' ? 'signup' : 'signin'
    const name =
      typeof input.name === 'string' ? input.name.trim().replace(/\s+/gu, ' ').slice(0, 80) : ''
    if (!email || password.length < 10 || password.length > 128) {
      return Response.json(
        { ok: false, error: 'Enter a valid email and a password with at least 10 characters.' },
        { status: 400, headers: { 'cache-control': 'no-store' } },
      )
    }
    const invited = invitationTokenPattern.test(cookie(request, invitationCookieName) ?? '')
    const signupAccess =
      intent === 'signup'
        ? await instanceAccessRequest(env, {
            action: 'begin_signup',
            email,
            invited,
            bootstrapToken: input.bootstrapToken,
          })
        : null
    if (signupAccess && !signupAccess.ok) {
      return Response.json(
        {
          ok: false,
          code: signupAccess.code,
          error:
            signupAccess.code === 'SIGNUP_IN_PROGRESS'
              ? 'The first owner account is already being created. Try again in a few minutes.'
              : signupAccess.code === 'BOOTSTRAP_NOT_CONFIGURED'
                ? 'This installation still needs a setup code configured in Cloudflare.'
                : signupAccess.code === 'BOOTSTRAP_TOKEN_INVALID'
                  ? 'The installation setup code is incorrect.'
                  : 'New organizer accounts are invite-only on this ProgramKit installation.',
        },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      )
    }
    const shard = (await hashValue(email)).slice(0, 32)
    const ipHash = await hashValue(request.headers.get('cf-connecting-ip') ?? 'local')
    const authenticatedResponse = await authStub(env, shard)!.fetch(
      new Request('http://auth.internal/internal/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, intent, ipHash, name }),
      }),
    )
    const authenticated = (await authenticatedResponse.json()) as HostedAuthenticationResult
    if (!authenticatedResponse.ok || !authenticated.ok) {
      return Response.json(
        {
          ok: false,
          error:
            intent === 'signup'
              ? 'That account already exists. Sign in or use an email link.'
              : 'The email or password is incorrect.',
        },
        { status: 401, headers: { 'cache-control': 'no-store' } },
      )
    }
    if (signupAccess?.claimInstanceOwner && authenticated.account) {
      const completed = await instanceAccessRequest(env, {
        action: 'complete_signup',
        email: authenticated.account.user.email,
        userId: authenticated.account.user.id,
      })
      if (!completed.ok) {
        return Response.json(
          { ok: false, error: 'The first owner account could not be claimed. Try again.' },
          { status: 409, headers: { 'cache-control': 'no-store' } },
        )
      }
    }
    const sessionResponse = await establishHostedSession(env, url, shard, authenticated, {
      status: intent === 'signup' ? 201 : 200,
    })
    return (
      sessionResponse ??
      Response.json(
        { ok: false, error: 'That account could not be opened.' },
        { status: 500, headers: { 'cache-control': 'no-store' } },
      )
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
    const consumed = (await consumedResponse.json()) as HostedAuthenticationResult
    if (consumed.claimInstanceOwner && consumed.account) {
      const completed = await instanceAccessRequest(env, {
        action: 'complete_signup',
        email: consumed.account.user.email,
        userId: consumed.account.user.id,
      })
      if (!completed.ok) return redirect(url, '/login?error=account')
    }
    const sessionResponse = await establishHostedSession(env, url, token.shard, consumed, {
      destination: '/',
    })
    return sessionResponse ?? redirect(url, '/login?error=expired')
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
    headers.append('set-cookie', clearAuthCookie(externalSessionCookieName, url))
    return Response.json({ ok: true }, { headers })
  }

  return null
}

async function acceptHostedInvitation(
  env: Env,
  principal: HostedPrincipal,
  token: string,
  url: URL,
) {
  const match = token.match(invitationTokenPattern)
  if (!match) {
    const headers = new Headers({
      location: '/login?error=invitation',
      'cache-control': 'no-store',
    })
    headers.append('set-cookie', clearAuthCookie(invitationCookieName, url))
    return new Response(null, { status: 302, headers })
  }
  const eventId = match[1]
  const stub = eventAccessStub(env, eventId)
  if (!stub)
    return Response.json({ ok: false, error: 'Event access is unavailable.' }, { status: 503 })
  const response = await stub.fetch(
    new Request('http://event-access.internal/internal/event-access/invitations/consume', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        eventId,
        token,
        userId: principal.account.user.id,
        email: principal.account.user.email,
      }),
    }),
  )
  const body = (await response.json()) as EventAccessResponse
  if (!response.ok || !body.membership || !body.event) {
    const headers = new Headers({
      location: '/login?error=invitation',
      'cache-control': 'no-store',
    })
    headers.append('set-cookie', clearAuthCookie(invitationCookieName, url))
    headers.append('set-cookie', clearAuthCookie(sessionCookieName, url))
    headers.append('set-cookie', clearAuthCookie(eventCookieName, url))
    return new Response(null, { status: 302, headers })
  }
  await linkHostedMembership(
    env,
    principal,
    {
      id: body.event.id,
      organizationId: body.event.organizationId,
      name: body.event.name,
      slug: body.event.slug,
      createdAt: body.event.createdAt,
      role: body.membership.role,
    },
    body.membership,
  )
  const headers = new Headers({ location: '/', 'cache-control': 'no-store' })
  headers.append('set-cookie', clearAuthCookie(invitationCookieName, url))
  headers.append('set-cookie', authCookie(eventCookieName, body.event.id, url, 30 * 24 * 60 * 60))
  return new Response(null, { status: 302, headers })
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

interface OrganizationWorkspace {
  event: AuthEventSummary
  state: WorkspaceState
  stub: DurableObjectStub<WorkspaceDurableObject>
  scopes: string[]
}

async function organizationWorkspaces(env: Env, principal: HostedPrincipal) {
  const activeEvent = principal.account.events.find(
    (event) => event.id === principal.account.activeEventId,
  )
  if (!activeEvent) return []
  const events = principal.account.events.filter(
    (event) => event.organizationId === activeEvent.organizationId,
  )
  const ordered = [activeEvent, ...events.filter((event) => event.id !== activeEvent.id)]
  const workspaces = await Promise.all(
    ordered.map(async (event): Promise<OrganizationWorkspace | null> => {
      const access =
        event.id === principal.account.activeEventId
          ? { scopes: principal.scopes }
          : await resolveHostedEventAccess(env, principal, event)
      if (!access) return null
      const stub = workspaceStub(env, eventWorkspaceKey(event.id))
      return { event, state: await readWorkspace(stub), stub, scopes: access.scopes }
    }),
  )
  return workspaces.filter((entry): entry is OrganizationWorkspace => Boolean(entry))
}

function workspaceContainingPerson(workspaces: OrganizationWorkspace[], personId: string) {
  return workspaces.find((workspace) =>
    workspace.state.people.some((person) => person.id === personId),
  )
}

function workspaceForCrmOperation(
  workspaces: OrganizationWorkspace[],
  operation: string,
  input: Record<string, unknown>,
) {
  if (
    operation === 'person.update' ||
    operation === 'person.add-note' ||
    operation === 'crm.pipeline.enroll'
  ) {
    return typeof input.personId === 'string'
      ? workspaceContainingPerson(workspaces, input.personId)
      : null
  }
  if (operation === 'person.merge') {
    if (typeof input.primaryPersonId !== 'string' || typeof input.duplicatePersonId !== 'string') {
      return null
    }
    const primary = workspaceContainingPerson(workspaces, input.primaryPersonId)
    return primary?.state.people.some((person) => person.id === input.duplicatePersonId)
      ? primary
      : null
  }
  if (operation === 'crm.pipeline.move' || operation === 'crm.pipeline.add-note') {
    return typeof input.entryId === 'string'
      ? workspaces.find((workspace) =>
          workspace.state.speakerPipeline.some((entry) => entry.id === input.entryId),
        )
      : null
  }
  return workspaces[0]
}

async function copyOrganizationHeadshot(
  env: Env,
  source: OrganizationWorkspace,
  sourcePersonId: string,
  target: OrganizationWorkspace,
  targetPersonId: string,
  actor: OperationRequest['actor'],
) {
  if (!env.PROGRAMKIT_FILES) return null
  const sourceAsset = source.state.assets.find(
    (asset) =>
      asset.kind === 'headshot' &&
      asset.owner.type === 'person' &&
      asset.owner.id === sourcePersonId,
  )
  if (!sourceAsset) return null
  if (
    target.state.assets.some(
      (asset) =>
        asset.kind === 'headshot' &&
        asset.owner.type === 'person' &&
        asset.owner.id === targetPersonId,
    )
  ) {
    return null
  }
  const object = await env.PROGRAMKIT_FILES.get(sourceAsset.storageKey)
  if (!object) return null
  const storageKey = `${target.event.id}/people/${targetPersonId}/${crypto.randomUUID().replaceAll('-', '')}-${safeAssetFilename(sourceAsset.filename)}`
  await env.PROGRAMKIT_FILES.put(storageKey, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: {
      eventId: target.event.id,
      personId: targetPersonId,
      copiedFromEventId: source.event.id,
    },
  })
  const registered = await executeWorkspaceOperation(target.stub, 'asset.register', {
    input: {
      ownerType: 'person',
      ownerId: targetPersonId,
      kind: 'headshot',
      filename: sourceAsset.filename,
      contentType: sourceAsset.contentType,
      sizeBytes: sourceAsset.sizeBytes,
      storageKey,
    },
    actor,
    idempotencyKey: `organization-headshot:${sourceAsset.id}:${target.event.id}`,
  })
  if (!registered.ok) await env.PROGRAMKIT_FILES.delete(storageKey)
  return registered
}

async function handleAccountCrmRequest(
  request: Request,
  env: Env,
  url: URL,
  principal: HostedPrincipal,
) {
  const workspaces = await organizationWorkspaces(env, principal)
  if (request.method === 'GET' && url.pathname === '/api/v1/crm/state') {
    const state = mergeOrganizationCrmState(workspaces)
    if (!state) {
      return Response.json(
        { ok: false, error: 'The organization CRM could not be loaded.' },
        { status: 404 },
      )
    }
    return Response.json(
      {
        state,
        derived: {
          readiness: readinessSummary(workspaces[0].state),
          scheduleConflicts: scheduleConflicts(workspaces[0].state),
        },
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  const match = url.pathname.match(/^\/api\/v1\/crm\/operations\/([^/]+)$/u)
  if (request.method !== 'POST' || !match) return null
  if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
  const operation = decodeURIComponent(match[1])
  const operationRequest = (await request.json()) as OperationRequest

  if (operation === 'person.add-to-event') {
    const personId = operationRequest.input.personId
    const eventId = operationRequest.input.eventId
    if (typeof personId !== 'string' || typeof eventId !== 'string') {
      return Response.json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'Choose a contact and event.' } },
        { status: 400 },
      )
    }
    const source = workspaceContainingPerson(workspaces, personId)
    const target = workspaces.find((workspace) => workspace.event.id === eventId)
    const person = source?.state.people.find((entry) => entry.id === personId)
    if (!source || !target || !person) {
      return Response.json(
        {
          ok: false,
          error: {
            code: 'NOT_FOUND',
            message: 'That organization contact or event was not found.',
          },
        },
        { status: 404 },
      )
    }
    const actor = { ...hostedStaffActor(principal), scopes: target.scopes }
    const reused = await executeWorkspaceOperation(target.stub, 'person.reuse-in-event', {
      ...operationRequest,
      input: {
        personId: person.id,
        firstName: person.firstName,
        lastName: person.lastName,
        email: person.email,
        company: person.company,
        title: person.title,
        city: person.city,
        timezone: person.timezone,
        bio: person.bio,
        avatarUrl: person.avatarUrl,
        tags: person.tags,
      },
      actor,
    })
    if (!reused.ok) return Response.json(reused, { status: 400 })
    const targetPersonId = (reused.data as { person?: { id?: string } } | undefined)?.person?.id
    const registered = targetPersonId
      ? await copyOrganizationHeadshot(env, source, person.id, target, targetPersonId, actor)
      : null
    return Response.json(
      registered?.ok
        ? {
            ...reused,
            eventIds: [...reused.eventIds, ...registered.eventIds],
            stateRevision: registered.stateRevision,
          }
        : reused,
      { status: 201, headers: { 'cache-control': 'no-store' } },
    )
  }

  const target = workspaceForCrmOperation(workspaces, operation, operationRequest.input)
  if (!target) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'CROSS_EVENT_OPERATION_UNAVAILABLE',
          message: 'Open the event that owns both records before making this change.',
        },
      },
      { status: 409 },
    )
  }
  const response = await executeWorkspaceOperation(target.stub, operation, {
    ...operationRequest,
    actor: { ...hostedStaffActor(principal), scopes: target.scopes },
  })
  return Response.json(response, {
    status: response.ok ? 200 : 400,
    headers: { 'cache-control': 'no-store' },
  })
}

export function isWorkspaceCrmPath(profile: string, pathname: string) {
  return (
    profile !== 'hosted-app' &&
    (pathname === '/api/v1/crm/state' || pathname.startsWith('/api/v1/crm/operations/'))
  )
}

async function handleWorkspaceCrmRequest(
  request: Request,
  env: Env,
  url: URL,
  stub: DurableObjectStub<WorkspaceDurableObject>,
) {
  if (request.method === 'GET' && url.pathname === '/api/v1/crm/state') {
    const response = await stub.fetch(
      withActor(new Request('http://workspace.internal/api/v1/state'), demoStaffActor),
    )
    return withRuntimeIntegrations(response, env)
  }

  const match = url.pathname.match(/^\/api\/v1\/crm\/operations\/([^/]+)$/u)
  if (request.method !== 'POST' || !match) return null
  if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
  const operation = encodeURIComponent(decodeURIComponent(match[1]))
  return stub.fetch(
    withActor(
      new Request(`http://workspace.internal/api/v1/operations/${operation}`, {
        method: 'POST',
        headers: {
          'content-type': request.headers.get('content-type') ?? 'application/json',
        },
        body: await request.arrayBuffer(),
      }),
      demoStaffActor,
    ),
  )
}

async function executePortalOperation(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  participationId: string,
  portalAccessKey: string,
  operation: string,
  request: OperationRequest,
) {
  const { actor, ...publicRequest } = request
  const response = await stub.fetch(
    withActor(
      new Request(
        `http://workspace.internal/public/v1/portal/${encodeURIComponent(participationId)}/operations/${encodeURIComponent(operation)}`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-programkit-portal-key': portalAccessKey,
          },
          body: JSON.stringify(publicRequest),
        },
      ),
      actor,
    ),
  )
  return (await response.json()) as OperationResponse
}

function safeAssetFilename(value: string) {
  const normalized = value.normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/gu, '-')
  return normalized.replace(/^-+|-+$/gu, '').slice(0, 120) || 'upload'
}

function eventLogoStorageKey(eventId: string, assetId: string) {
  return `${eventId}/branding/logo-${assetId}`
}

export function eventLogoStorageKeyFromUrl(value: string | undefined, eventId: string) {
  if (!value?.startsWith('/')) return null
  try {
    const url = new URL(value, 'https://programkit.local')
    const match = url.pathname.match(
      /^\/public\/v1\/events\/([a-z0-9][a-z0-9_-]{0,63})\/logo\/([a-f0-9]{32})$/u,
    )
    if (!match || match[1] !== eventId || url.searchParams.get('event') !== eventId) return null
    return eventLogoStorageKey(eventId, match[2])
  } catch {
    return null
  }
}

async function publicEventLogo(
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  eventId: string,
  assetId: string,
) {
  if (!env.PROGRAMKIT_FILES) return new Response(null, { status: 404 })
  const state = await readWorkspace(stub)
  const event = state.events.find(
    (candidate) => candidate.id === eventId && candidate.id === state.activeEventId,
  )
  const storageKey = eventLogoStorageKey(eventId, assetId)
  if (!event || eventLogoStorageKeyFromUrl(event.logoUrl, eventId) !== storageKey) {
    return new Response(null, { status: 404 })
  }
  const object = await env.PROGRAMKIT_FILES.get(storageKey)
  if (!object) return new Response(null, { status: 404 })
  const headers = new Headers({
    'cache-control': 'public, max-age=31536000, immutable',
    'content-security-policy': "default-src 'none'; sandbox",
    'x-content-type-options': 'nosniff',
  })
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

async function updateEventLogo(
  request: Request,
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  eventId: string,
  actor: OperationRequest['actor'],
) {
  const state = await readWorkspace(stub)
  const event = state.events.find(
    (candidate) => candidate.id === eventId && candidate.id === state.activeEventId,
  )
  if (!event) {
    return Response.json({ ok: false, error: 'This event was not found.' }, { status: 404 })
  }
  const previousStorageKey = eventLogoStorageKeyFromUrl(event.logoUrl, eventId)

  if (request.method === 'DELETE') {
    const operation = await executeWorkspaceOperation(stub, 'event.update', {
      input: { eventId, logoUrl: '' },
      expectedVersions: { [eventId]: event.version ?? 1 },
      actor,
    })
    if (!operation.ok) return Response.json(operation, { status: 400 })
    if (previousStorageKey && env.PROGRAMKIT_FILES) {
      await env.PROGRAMKIT_FILES.delete(previousStorageKey)
    }
    return Response.json(
      { ok: true, logoUrl: '', operation },
      { headers: { 'cache-control': 'no-store' } },
    )
  }

  if (!env.PROGRAMKIT_FILES) {
    return Response.json({ ok: false, error: 'File storage is not configured.' }, { status: 503 })
  }
  const form = await request.formData()
  const value = form.get('file')
  if (!(value instanceof File) || value.size === 0) {
    return Response.json({ ok: false, error: 'Choose a logo image to upload.' }, { status: 400 })
  }
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(value.type)) {
    return Response.json(
      { ok: false, error: 'Logos must be JPEG, PNG, or WebP images.' },
      { status: 415 },
    )
  }
  if (value.size > 4_000_000) {
    return Response.json(
      { ok: false, error: 'Choose a logo image smaller than 4 MB.' },
      { status: 413 },
    )
  }

  const assetId = crypto.randomUUID().replaceAll('-', '')
  const storageKey = eventLogoStorageKey(eventId, assetId)
  await env.PROGRAMKIT_FILES.put(storageKey, value.stream(), {
    httpMetadata: { contentType: value.type },
    customMetadata: { eventId, kind: 'event-logo', filename: safeAssetFilename(value.name) },
  })
  const logoUrl = `/public/v1/events/${encodeURIComponent(eventId)}/logo/${assetId}?event=${encodeURIComponent(eventId)}`
  const operation = await executeWorkspaceOperation(stub, 'event.update', {
    input: { eventId, logoUrl },
    expectedVersions: { [eventId]: event.version ?? 1 },
    actor,
  })
  if (!operation.ok) {
    await env.PROGRAMKIT_FILES.delete(storageKey)
    return Response.json(operation, { status: 400 })
  }
  if (previousStorageKey && previousStorageKey !== storageKey) {
    await env.PROGRAMKIT_FILES.delete(previousStorageKey)
  }
  return Response.json(
    { ok: true, logoUrl, operation },
    { status: 201, headers: { 'cache-control': 'no-store' } },
  )
}

async function uploadSpeakerHeadshot(
  request: Request,
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  participationId: string,
) {
  if (!env.PROGRAMKIT_FILES) {
    return Response.json({ ok: false, error: 'File storage is not configured.' }, { status: 503 })
  }
  const state = await readWorkspace(stub)
  const participation = state.participations.find(
    (entry) =>
      entry.id === participationId &&
      entry.eventId === state.activeEventId &&
      entry.portalAccessKey === request.headers.get('x-programkit-portal-key'),
  )
  if (!participation) {
    return Response.json({ ok: false, error: 'This speaker link is unavailable.' }, { status: 403 })
  }
  const form = await request.formData()
  const value = form.get('file')
  if (!(value instanceof File)) {
    return Response.json({ ok: false, error: 'Choose an image to upload.' }, { status: 400 })
  }
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(value.type)) {
    return Response.json(
      { ok: false, error: 'Headshots must be JPEG, PNG, or WebP images.' },
      { status: 415 },
    )
  }
  if (value.size < 1 || value.size > 8_000_000) {
    return Response.json(
      { ok: false, error: 'Choose a non-empty image smaller than 8 MB.' },
      { status: 413 },
    )
  }
  const filename = safeAssetFilename(value.name)
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const storageKey = `${state.activeEventId}/people/${participation.personId}/${nonce}-${filename}`
  await env.PROGRAMKIT_FILES.put(storageKey, value.stream(), {
    httpMetadata: { contentType: value.type },
    customMetadata: {
      eventId: state.activeEventId,
      participationId,
      personId: participation.personId,
    },
  })
  const portalPerson = state.people.find((entry) => entry.id === participation.personId)
  const actor = {
    type: 'participant' as const,
    id: participation.id,
    name: portalPerson
      ? `${portalPerson.firstName} ${portalPerson.lastName}`
      : 'Portal participant',
    scopes: ['assets:write'],
  }
  const operation = await executePortalOperation(
    stub,
    participation.id,
    participation.portalAccessKey,
    'asset.register',
    {
      input: {
        ownerType: 'person',
        ownerId: participation.personId,
        kind: 'headshot',
        filename,
        contentType: value.type,
        sizeBytes: value.size,
        storageKey,
      },
      actor,
      idempotencyKey: `headshot:${storageKey}`,
    },
  )
  if (!operation.ok) {
    await env.PROGRAMKIT_FILES.delete(storageKey)
    return Response.json(operation, { status: 400 })
  }
  return Response.json(operation, { status: 201 })
}

async function uploadOrganizerHeadshot(
  request: Request,
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  personId: string,
  actor: OperationRequest['actor'],
) {
  if (!env.PROGRAMKIT_FILES) {
    return Response.json({ ok: false, error: 'File storage is not configured.' }, { status: 503 })
  }
  const state = await readWorkspace(stub)
  const participation = state.participations.find(
    (entry) => entry.eventId === state.activeEventId && entry.personId === personId,
  )
  if (!participation || !state.people.some((entry) => entry.id === personId)) {
    return Response.json({ ok: false, error: 'This speaker was not found.' }, { status: 404 })
  }
  const form = await request.formData()
  const value = form.get('file')
  if (!(value instanceof File)) {
    return Response.json({ ok: false, error: 'Choose an image to upload.' }, { status: 400 })
  }
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
  if (!allowedTypes.has(value.type)) {
    return Response.json(
      { ok: false, error: 'Headshots must be JPEG, PNG, or WebP images.' },
      { status: 415 },
    )
  }
  if (value.size < 1 || value.size > 8_000_000) {
    return Response.json(
      { ok: false, error: 'Choose a non-empty image smaller than 8 MB.' },
      { status: 413 },
    )
  }
  const filename = safeAssetFilename(value.name)
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const storageKey = `${state.activeEventId}/people/${personId}/${nonce}-${filename}`
  await env.PROGRAMKIT_FILES.put(storageKey, value.stream(), {
    httpMetadata: { contentType: value.type },
    customMetadata: {
      eventId: state.activeEventId,
      participationId: participation.id,
      personId,
    },
  })
  const operation = await executeWorkspaceOperation(stub, 'asset.register', {
    input: {
      ownerType: 'person',
      ownerId: personId,
      kind: 'headshot',
      filename,
      contentType: value.type,
      sizeBytes: value.size,
      storageKey,
    },
    actor,
    idempotencyKey: `headshot:${storageKey}`,
  })
  if (!operation.ok) {
    await env.PROGRAMKIT_FILES.delete(storageKey)
    return Response.json(operation, { status: 400 })
  }
  return Response.json(operation, { status: 201 })
}

async function uploadSpeakerDeliverable(
  request: Request,
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  participationId: string,
  requirementInstanceId: string,
) {
  if (!env.PROGRAMKIT_FILES) {
    return Response.json({ ok: false, error: 'File storage is not configured.' }, { status: 503 })
  }
  const state = await readWorkspace(stub)
  const participation = state.participations.find(
    (entry) =>
      entry.id === participationId &&
      entry.eventId === state.activeEventId &&
      entry.portalAccessKey === request.headers.get('x-programkit-portal-key'),
  )
  const instance = state.requirementInstances.find(
    (entry) => entry.id === requirementInstanceId && entry.participationId === participation?.id,
  )
  const definition = instance
    ? state.requirementDefinitions.find(
        (entry) => entry.id === instance.definitionId && entry.kind === 'file',
      )
    : null
  if (!participation || !instance || !definition) {
    return Response.json({ ok: false, error: 'This file task is unavailable.' }, { status: 403 })
  }
  const form = await request.formData()
  const value = form.get('file')
  if (!(value instanceof File)) {
    return Response.json({ ok: false, error: 'Choose a file to upload.' }, { status: 400 })
  }
  const acceptedTypes = definition.acceptedContentTypes ?? []
  if (acceptedTypes.length > 0 && !acceptedTypes.includes(value.type)) {
    return Response.json(
      { ok: false, error: 'This file type is not accepted for the task.' },
      { status: 415 },
    )
  }
  const maximum = definition.maxSizeBytes ?? 50_000_000
  if (value.size < 1 || value.size > maximum) {
    return Response.json(
      {
        ok: false,
        error: `Choose a non-empty file smaller than ${Math.round(maximum / 1_000_000)} MB.`,
      },
      { status: 413 },
    )
  }
  const filename = safeAssetFilename(value.name)
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const storageKey = `${state.activeEventId}/deliverables/${instance.id}/${nonce}-${filename}`
  await env.PROGRAMKIT_FILES.put(storageKey, value.stream(), {
    httpMetadata: { contentType: value.type },
    customMetadata: {
      eventId: state.activeEventId,
      participationId,
      requirementInstanceId: instance.id,
      definitionId: definition.id,
    },
  })
  const person = state.people.find((entry) => entry.id === participation.personId)
  const operation = await executePortalOperation(
    stub,
    participation.id,
    participation.portalAccessKey,
    'asset.register',
    {
      input: {
        ownerType: 'requirement',
        ownerId: instance.id,
        kind:
          definition.systemKey === 'final_slides' ||
          /slides|deck|presentation/iu.test(definition.label)
            ? 'slides'
            : 'supporting_document',
        filename,
        contentType: value.type,
        sizeBytes: value.size,
        storageKey,
      },
      actor: {
        type: 'participant' as const,
        id: participation.id,
        name: person ? `${person.firstName} ${person.lastName}` : 'Portal participant',
        scopes: ['assets:write'],
      },
      idempotencyKey: `deliverable:${storageKey}`,
    },
  )
  if (!operation.ok) {
    await env.PROGRAMKIT_FILES.delete(storageKey)
    return Response.json(operation, { status: 400 })
  }
  return Response.json(operation, { status: 201 })
}

function demoPdf(title: string) {
  const safeTitle = title.replaceAll(/[^\x20-\x7e]/gu, '').replaceAll(/[()\\]/gu, '')
  const stream = `BT /F1 18 Tf 72 720 Td (${safeTitle}) Tj 0 -30 Td /F1 11 Tf (ProgramKit demo file) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((object, index) => {
    offsets.push(body.length)
    body += `${index + 1} 0 obj\n${object}\nendobj\n`
  })
  const xref = body.length
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  body += offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('')
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(body)
}

function seededDemoAssetBytes(asset: Asset) {
  if (!asset.storageKey.startsWith('demo/deliverables/')) return null
  if (asset.contentType === 'application/pdf') return demoPdf(asset.filename)
  if (asset.contentType === 'image/png') {
    const encoded =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl3dCoAAAAASUVORK5CYII='
    return Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
  }
  return null
}

type AssetStorageDisposition = 'r2' | 'virtual-demo' | 'unsafe'

/**
 * Never turn mutable workspace metadata into an arbitrary R2 delete primitive.
 * Live objects are always rooted below their event id. The deterministic demo
 * assets are generated in memory and therefore have no R2 bytes to remove.
 */
export function assetStorageDisposition(
  asset: Pick<Asset, 'eventId' | 'storageKey'>,
): AssetStorageDisposition {
  if (asset.storageKey.startsWith(`${asset.eventId}/`)) return 'r2'
  if (asset.storageKey.startsWith('demo/')) return 'virtual-demo'
  return 'unsafe'
}

function assetIsDeleted(asset: Asset) {
  return Boolean(asset.deletedAt)
}

function operationErrorResponse(
  status: number,
  code: string,
  message: string,
  stateRevision: number,
  data?: Record<string, unknown>,
) {
  return Response.json(
    {
      ok: false,
      ...(data ? { data } : {}),
      error: { code, message },
      eventIds: [],
      warnings: [],
      approvalRequired: false,
      stateRevision,
      traceId: crypto.randomUUID(),
    } satisfies OperationResponse,
    { status, headers: { 'cache-control': 'no-store' } },
  )
}

function operationHttpStatus(response: OperationResponse) {
  switch (response.error?.code) {
    case 'FORBIDDEN':
      return 403
    case 'NOT_FOUND':
      return 404
    case 'STALE_WRITE':
    case 'CONFLICT':
      return 409
    default:
      return 400
  }
}

const assetCleanupActor: NonNullable<OperationRequest['actor']> = {
  type: 'system',
  id: 'asset-storage-cleanup',
  name: 'Asset storage cleanup',
  scopes: ['assets:purge'],
}

/**
 * Coordinate the transactional workspace tombstone with the non-transactional
 * R2 side effect. Repeating the request is safe: an existing pending tombstone
 * skips the first transition, retries the idempotent R2 delete, and confirms it.
 */
export async function deleteStoredAsset(
  request: Request,
  env: Pick<Env, 'PROGRAMKIT_FILES'>,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  actor: NonNullable<OperationRequest['actor']>,
) {
  let requested: OperationRequest
  try {
    requested = (await request.json()) as OperationRequest
  } catch {
    return operationErrorResponse(400, 'INVALID_INPUT', 'The deletion request is invalid.', 0)
  }
  const assetId = typeof requested.input?.assetId === 'string' ? requested.input.assetId : ''
  if (!assetId) {
    return operationErrorResponse(400, 'INVALID_INPUT', 'Choose a file version to delete.', 0)
  }

  const state = await readWorkspace(stub)
  const asset = state.assets.find(
    (entry) => entry.id === assetId && entry.eventId === state.activeEventId,
  )
  if (!asset) {
    return operationErrorResponse(
      404,
      'NOT_FOUND',
      'This file version was not found.',
      state.revision,
    )
  }
  const storage = assetStorageDisposition(asset)
  if (storage === 'unsafe') {
    return operationErrorResponse(
      409,
      'UNSAFE_STORAGE_KEY',
      'This legacy file cannot be deleted automatically because its storage key is outside the event boundary.',
      state.revision,
    )
  }
  if (storage === 'r2' && !env.PROGRAMKIT_FILES) {
    return operationErrorResponse(
      503,
      'STORAGE_UNAVAILABLE',
      'File storage is unavailable, so ProgramKit left the file unchanged.',
      state.revision,
    )
  }

  let deletion: OperationResponse | null = null
  if (!assetIsDeleted(asset)) {
    deletion = await executeWorkspaceOperation(stub, 'asset.delete', {
      input: {
        assetId,
        reason:
          typeof requested.input.reason === 'string' && requested.input.reason.trim()
            ? requested.input.reason.trim()
            : 'Removed by the event owner.',
      },
      expectedVersions: requested.expectedVersions,
      idempotencyKey: requested.idempotencyKey,
      actor,
    })
    if (!deletion.ok) {
      return Response.json(deletion, {
        status: operationHttpStatus(deletion),
        headers: { 'cache-control': 'no-store' },
      })
    }
  }

  try {
    if (storage === 'r2') await env.PROGRAMKIT_FILES!.delete(asset.storageKey)
  } catch {
    return operationErrorResponse(
      503,
      'ASSET_CLEANUP_PENDING',
      'The file is no longer available in ProgramKit, but its stored bytes still need cleanup. Retry from Files.',
      deletion?.stateRevision ?? state.revision,
      { assetId, cleanupPending: true },
    )
  }

  const confirmation = await executeWorkspaceOperation(stub, 'asset.confirm-deletion', {
    input: { assetId },
    idempotencyKey: `asset-purge:${assetId}`,
    actor: assetCleanupActor,
  })
  if (!confirmation.ok) {
    return operationErrorResponse(
      503,
      'ASSET_CLEANUP_CONFIRMATION_PENDING',
      'The stored bytes were deleted, but ProgramKit still needs to confirm cleanup. Retry from Files.',
      confirmation.stateRevision,
      { assetId, cleanupPending: true },
    )
  }

  return Response.json(
    {
      ...(deletion ?? confirmation),
      data: {
        ...((deletion?.data ?? confirmation.data ?? {}) as Record<string, unknown>),
        assetId,
        cleanupPending: false,
      },
      eventIds: [...(deletion?.eventIds ?? []), ...confirmation.eventIds],
      stateRevision: confirmation.stateRevision,
    } satisfies OperationResponse,
    { headers: { 'cache-control': 'no-store' } },
  )
}

async function downloadStoredAsset(
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  assetId: string,
  allowed: (state: Awaited<ReturnType<typeof readWorkspace>>, assetId: string) => boolean,
) {
  if (!env.PROGRAMKIT_FILES) return new Response(null, { status: 404 })
  const state = await readWorkspace(stub)
  if (!allowed(state, assetId)) return new Response(null, { status: 404 })
  const asset = state.assets.find(
    (entry) =>
      entry.id === assetId && entry.eventId === state.activeEventId && !assetIsDeleted(entry),
  )
  if (!asset) return new Response(null, { status: 404 })
  const object = await env.PROGRAMKIT_FILES.get(asset.storageKey)
  const seededBytes = object ? null : seededDemoAssetBytes(asset)
  if (!object && !seededBytes) return new Response(null, { status: 404 })
  const headers = new Headers({
    'cache-control': 'private, no-store',
    'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
  })
  if (object) {
    object.writeHttpMetadata(headers)
    headers.set('etag', object.httpEtag)
    return new Response(object.body, { headers })
  }
  headers.set('content-type', asset.contentType)
  headers.set('content-length', String(seededBytes!.byteLength))
  return new Response(seededBytes, { headers })
}

async function exportStoredAssets(
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  requestedIds: ReadonlySet<string>,
) {
  if (!env.PROGRAMKIT_FILES) {
    return Response.json({ ok: false, error: 'File storage is not configured.' }, { status: 503 })
  }
  const state = await readWorkspace(stub)
  const plan = createStoredAssetExportPlan(state, requestedIds)
  if (plan.length === 0) {
    return Response.json(
      { ok: false, error: 'Choose at least one uploaded file.' },
      { status: 400 },
    )
  }
  let totalBytes = 0
  const files: Array<{ name: string; data: Uint8Array }> = []
  for (const entry of plan) {
    const object = await env.PROGRAMKIT_FILES.get(entry.storageKey)
    const asset = state.assets.find((candidate) => candidate.id === entry.assetId)
    const seededBytes = object || !asset ? null : seededDemoAssetBytes(asset)
    if (!object && !seededBytes) continue
    totalBytes += object?.size ?? seededBytes!.byteLength
    if (totalBytes > 100_000_000) {
      return Response.json(
        { ok: false, error: 'The selected files exceed the 100 MB export limit.' },
        { status: 413 },
      )
    }
    files.push({
      name: entry.path,
      data: object ? new Uint8Array(await object.arrayBuffer()) : seededBytes!,
    })
  }
  if (files.length === 0) {
    return Response.json(
      { ok: false, error: 'The selected files are no longer available.' },
      { status: 404 },
    )
  }
  const archive = createStoredZip(files, new Date())
  return new Response(archive, {
    headers: {
      'cache-control': 'private, no-store',
      'content-disposition': `attachment; filename="programkit-latest-files-${new Date().toISOString().slice(0, 10)}.zip"`,
      'content-length': String(archive.byteLength),
      'content-type': 'application/zip',
    },
  })
}

async function publicHeadshot(
  env: Env,
  stub: DurableObjectStub<WorkspaceDurableObject>,
  assetId: string,
) {
  if (!env.PROGRAMKIT_FILES) return new Response(null, { status: 404 })
  const state = await readWorkspace(stub)
  const asset = state.assets.find(
    (entry) =>
      entry.id === assetId &&
      entry.eventId === state.activeEventId &&
      entry.kind === 'headshot' &&
      !assetIsDeleted(entry),
  )
  if (!asset) return new Response(null, { status: 404 })
  const object = await env.PROGRAMKIT_FILES.get(asset.storageKey)
  if (!object) return new Response(null, { status: 404 })
  const headers = new Headers({
    'cache-control': 'public, max-age=31536000, immutable',
    'content-disposition': `inline; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
  })
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  return new Response(object.body, { headers })
}

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext) {
    const url = new URL(request.url)
    const profile = deploymentProfile(env)
    const operationalResponse = publicOperationalResponse(request, url, profile)
    if (operationalResponse) return operationalResponse
    if (profile === 'hosted-site') {
      const markdownResponse = await hostedDocsMarkdownResponse(request, env, url)
      if (markdownResponse) return markdownResponse
    }
    let hostedPrincipal: HostedPrincipal | null = null
    let apiKeyPrincipal: ApiKeyPrincipal | null = null
    const publicEventId = profile === 'hosted-app' ? hostedPublicEventId(request, url) : null
    const hostedPublicDocument =
      isDocumentNavigation(request) &&
      isHostedPublicDocument(url.pathname) &&
      (Boolean(publicEventId) || url.pathname === '/access')
    const hostedPublicApi = Boolean(publicEventId) && url.pathname.startsWith('/public/')

    if (profile === 'hosted-app' && url.pathname.startsWith('/public/v1/access/discover/')) {
      const discoveryResponse = await handleExternalAccessDiscovery(request, env, url)
      if (discoveryResponse) return discoveryResponse
    }

    if (
      profile === 'hosted-app' &&
      publicEventId &&
      url.pathname.startsWith('/public/v1/access/')
    ) {
      const accessResponse = await handleExternalAccessRequest(request, env, url, publicEventId)
      if (accessResponse) return accessResponse
    }

    const presentedBearer = bearerToken(request)
    if (
      profile === 'hosted-app' &&
      isApiKeyCredentialPath(url.pathname) &&
      presentedBearer?.startsWith('pk_live_')
    ) {
      apiKeyPrincipal = await resolveApiKeyPrincipal(env, request)
      if (!apiKeyPrincipal) {
        return Response.json(
          { ok: false, error: 'API key is invalid or inactive.' },
          { status: 401, headers: { 'cache-control': 'no-store' } },
        )
      }
    }

    if (profile === 'hosted-app' && request.method === 'GET' && url.pathname === '/auth/invite') {
      const token = url.searchParams.get('token') ?? ''
      if (!invitationTokenPattern.test(token)) return redirect(url, '/login?error=invitation')
      const headers = new Headers({ location: '/login?invite=1', 'cache-control': 'no-store' })
      headers.append('set-cookie', authCookie(invitationCookieName, token, url, 7 * 24 * 60 * 60))
      return new Response(null, { status: 302, headers })
    }

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
      if (needsIdentity && !apiKeyPrincipal)
        hostedPrincipal = await resolveHostedPrincipal(env, request)

      const pendingInvitation = cookie(request, invitationCookieName)
      if (hostedPrincipal && pendingInvitation) {
        return acceptHostedInvitation(env, hostedPrincipal, pendingInvitation, url)
      }

      if (hostedPrincipal && !hostedPrincipal.membership) {
        if (request.method === 'GET' && isDocumentNavigation(request)) {
          const headers = new Headers({
            location: '/login?error=access',
            'cache-control': 'no-store',
          })
          headers.append('set-cookie', clearAuthCookie(sessionCookieName, url))
          headers.append('set-cookie', clearAuthCookie(eventCookieName, url))
          return new Response(null, { status: 302, headers })
        }
        return Response.json(
          { ok: false, error: 'Event access was not found.' },
          { status: 403, headers: { 'cache-control': 'no-store' } },
        )
      }

      if (request.method === 'GET' && url.pathname === '/login' && hostedPrincipal) {
        return redirect(url, '/')
      }
      if (
        request.method === 'GET' &&
        isDocumentNavigation(request) &&
        !isHostedAlwaysPublicPage(url.pathname) &&
        !hostedPublicDocument &&
        !hostedPrincipal
      ) {
        return redirect(url, '/login')
      }
      if (
        !hostedPrincipal &&
        !apiKeyPrincipal &&
        (url.pathname.startsWith('/api/') || url.pathname === '/mcp')
      ) {
        return Response.json(
          { ok: false, error: 'Sign in to continue.' },
          { status: 401, headers: { 'cache-control': 'no-store' } },
        )
      }
      if (!hostedPrincipal && url.pathname.startsWith('/public/') && !hostedPublicApi) {
        return Response.json(
          { ok: false, error: 'Open this page from an event-specific public link.' },
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
        !isHostedSiteDocument(url.pathname)
      ) {
        return redirect(url, '/')
      }
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
        const headers = new Headers({
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-store',
        })
        headers.append('set-cookie', clearDemoCookie(url))
        return new Response(
          '<!doctype html><meta name="viewport" content="width=device-width"><title>Demo unavailable</title><main style="font:16px system-ui;max-width:32rem;margin:20vh auto;padding:24px"><h1>This demo is no longer available.</h1><p>ProgramKit demos expire after seven days.</p><a href="/">Create a new demo</a></main>',
          {
            status: response.status === 404 ? 404 : 410,
            headers,
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
        return Response.json(
          { ok: true, active: false },
          {
            headers: { 'cache-control': 'no-store', 'set-cookie': clearDemoCookie(url) },
          },
        )
      }
      return new Response(null, { status: 405, headers: { allow: 'GET, POST' } })
    }

    if (profile === 'hosted-app' && hostedPrincipal) {
      if (request.method === 'GET' && url.pathname === '/api/v1/account') {
        return Response.json(
          { ok: true, account: await currentHostedAccount(env, hostedPrincipal) },
          { headers: { 'cache-control': 'no-store' } },
        )
      }

      if (url.pathname === '/api/v1/instance/access') {
        const actor = {
          userId: hostedPrincipal.account.user.id,
          email: hostedPrincipal.account.user.email,
        }
        if (request.method === 'GET') {
          const access = await instanceAccessRequest(env, { action: 'status', ...actor })
          return Response.json(access, {
            status: access.ok ? 200 : 503,
            headers: { 'cache-control': 'no-store' },
          })
        }
        if (request.method === 'PATCH') {
          if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
          const input = (await request.json().catch(() => ({}))) as { policy?: unknown }
          const policy: InstanceSignupPolicy | null =
            input.policy === 'open' || input.policy === 'invite_only' ? input.policy : null
          if (!policy) {
            return Response.json(
              { ok: false, error: 'Choose open or invite-only organizer signup.' },
              { status: 400, headers: { 'cache-control': 'no-store' } },
            )
          }
          const access = await instanceAccessRequest(env, {
            action: 'update',
            policy,
            ...actor,
          })
          return Response.json(
            access.ok
              ? access
              : { ok: false, error: 'Only the first instance owner can change signup access.' },
            {
              status: access.ok ? 200 : 403,
              headers: { 'cache-control': 'no-store' },
            },
          )
        }
        return new Response(null, { status: 405, headers: { allow: 'GET, PATCH' } })
      }

      if (
        url.pathname === '/api/v1/crm/state' ||
        url.pathname.startsWith('/api/v1/crm/operations/')
      ) {
        const crmResponse = await handleAccountCrmRequest(request, env, url, hostedPrincipal)
        if (crmResponse) return crmResponse
      }

      const apiKeysMatch = url.pathname.match(
        /^\/api\/v1\/events\/([^/]+)\/api-keys(?:\/([^/]+))?$/u,
      )
      if (apiKeysMatch) {
        const eventId = decodeURIComponent(apiKeysMatch[1])
        if (eventId !== hostedPrincipal.membership!.eventId) {
          return Response.json({ ok: false, error: 'Event access was not found.' }, { status: 403 })
        }
        const access = eventAccessStub(env, eventId)!
        const actor = eventAccessActor(hostedPrincipal)

        if (request.method === 'GET' && !apiKeysMatch[2]) {
          const listedResponse = await access.fetch(
            new Request('http://event-access.internal/internal/event-access/api-keys/list', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ eventId, actor }),
            }),
          )
          const listed = (await listedResponse.json()) as EventAccessResponse
          return listedResponse.ok
            ? Response.json(
                { ok: true, apiKeys: listed.apiKeys ?? [] },
                { headers: { 'cache-control': 'no-store' } },
              )
            : Response.json(
                { ok: false, error: listed.error ?? 'API keys could not be loaded.' },
                { status: listedResponse.status },
              )
        }

        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        if (request.method === 'POST' && !apiKeysMatch[2]) {
          const input = (await request.json()) as {
            name?: unknown
            scopes?: unknown
            expiresAt?: unknown
          }
          const createdResponse = await access.fetch(
            new Request('http://event-access.internal/internal/event-access/api-keys/create', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ ...input, eventId, actor }),
            }),
          )
          const created = (await createdResponse.json()) as EventAccessResponse
          return createdResponse.ok && created.apiKey && created.token
            ? Response.json(
                { ok: true, apiKey: created.apiKey, token: created.token },
                { status: 201, headers: { 'cache-control': 'no-store' } },
              )
            : Response.json(
                { ok: false, error: created.error ?? 'API key could not be created.' },
                { status: createdResponse.status },
              )
        }

        if (request.method === 'DELETE' && apiKeysMatch[2]) {
          const revokedResponse = await access.fetch(
            new Request('http://event-access.internal/internal/event-access/api-keys/revoke', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                eventId,
                actor,
                apiKeyId: decodeURIComponent(apiKeysMatch[2]),
              }),
            }),
          )
          const revoked = (await revokedResponse.json()) as EventAccessResponse
          return revokedResponse.ok
            ? Response.json(
                { ok: true, apiKey: revoked.apiKey },
                { headers: { 'cache-control': 'no-store' } },
              )
            : Response.json(
                { ok: false, error: revoked.error ?? 'API key could not be revoked.' },
                { status: revokedResponse.status },
              )
        }
      }

      const teamMatch = url.pathname.match(/^\/api\/v1\/events\/([^/]+)\/team$/u)
      if (request.method === 'GET' && teamMatch) {
        const eventId = decodeURIComponent(teamMatch[1])
        if (eventId !== hostedPrincipal.membership!.eventId) {
          return Response.json({ ok: false, error: 'Event access was not found.' }, { status: 403 })
        }
        const membership = hostedPrincipal.membership!
        if (membership.role === 'member') {
          return Response.json(
            {
              ok: true,
              team: {
                currentMembershipId: membership.id,
                currentRole: membership.role,
                members: [membership],
                invitations: [],
              },
            },
            { headers: { 'cache-control': 'no-store' } },
          )
        }
        const access = eventAccessStub(env, eventId)!
        const actor = eventAccessActor(hostedPrincipal)
        const [membersResponse, invitationsResponse] = await Promise.all([
          access.fetch(
            new Request('http://event-access.internal/internal/event-access/memberships/list', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ eventId, actor }),
            }),
          ),
          access.fetch(
            new Request('http://event-access.internal/internal/event-access/invitations/list', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ eventId, actor }),
            }),
          ),
        ])
        const membersBody = (await membersResponse.json()) as EventAccessResponse
        const invitationsBody = (await invitationsResponse.json()) as EventAccessResponse
        if (!membersResponse.ok || !invitationsResponse.ok) {
          return Response.json(
            {
              ok: false,
              error:
                membersBody.error ?? invitationsBody.error ?? 'Team access could not be loaded.',
            },
            { status: Math.max(membersResponse.status, invitationsResponse.status) },
          )
        }
        return Response.json(
          {
            ok: true,
            team: {
              currentMembershipId: membership.id,
              currentRole: membership.role,
              members: membersBody.memberships ?? [],
              invitations: (invitationsBody.invitations ?? []).filter(
                (invitation) => invitation.status === 'pending',
              ),
            },
          },
          { headers: { 'cache-control': 'no-store' } },
        )
      }

      const invitationsMatch = url.pathname.match(
        /^\/api\/v1\/events\/([^/]+)\/invitations(?:\/([^/]+))?$/u,
      )
      if (invitationsMatch) {
        const eventId = decodeURIComponent(invitationsMatch[1])
        if (eventId !== hostedPrincipal.membership!.eventId) {
          return Response.json({ ok: false, error: 'Event access was not found.' }, { status: 403 })
        }
        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        const access = eventAccessStub(env, eventId)!
        const actor = eventAccessActor(hostedPrincipal)

        if (request.method === 'POST' && !invitationsMatch[2]) {
          if (!env.EMAIL || !env.PROGRAMKIT_EMAIL_FROM) {
            return Response.json(
              { ok: false, error: 'Invitation email is not configured.' },
              { status: 503 },
            )
          }
          const input = (await request.json()) as { email?: unknown; role?: unknown }
          const createdResponse = await access.fetch(
            new Request('http://event-access.internal/internal/event-access/invitations/create', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ eventId, actor, email: input.email, role: input.role }),
            }),
          )
          const created = (await createdResponse.json()) as EventAccessResponse
          if (!createdResponse.ok || !created.invitation || !created.token) {
            return Response.json(
              { ok: false, error: created.error ?? 'The invitation could not be created.' },
              { status: createdResponse.status },
            )
          }
          const event = hostedPrincipal.account.events.find(
            (candidate) => candidate.id === eventId,
          )!
          const invitationUrl = new URL('/auth/invite', configuredAppOrigin(env, url))
          invitationUrl.searchParams.set('token', created.token)
          const inviterName = hostedPrincipal.account.user.name
          const emailContent = actionEmail({
            title: `Join ${event.name}`,
            intro: `${inviterName} invited you to help manage this event.`,
            actionLabel: 'Accept invitation',
            actionUrl: invitationUrl.toString(),
            footnote: 'This invitation expires in seven days.',
          })
          try {
            await env.EMAIL.send({
              to: created.invitation.email,
              from: env.PROGRAMKIT_EMAIL_FROM,
              replyTo: env.PROGRAMKIT_SUPPORT_EMAIL,
              subject: `You’re invited to ${event.name}`,
              ...emailContent,
            })
          } catch {
            await access.fetch(
              new Request('http://event-access.internal/internal/event-access/invitations/revoke', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  eventId,
                  actor,
                  invitationId: created.invitation.id,
                }),
              }),
            )
            return Response.json(
              { ok: false, error: 'The invitation email could not be sent. Try again.' },
              { status: 503 },
            )
          }
          return Response.json(
            { ok: true, invitation: created.invitation },
            { status: 201, headers: { 'cache-control': 'no-store' } },
          )
        }

        if (request.method === 'DELETE' && invitationsMatch[2]) {
          const revokedResponse = await access.fetch(
            new Request('http://event-access.internal/internal/event-access/invitations/revoke', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({
                eventId,
                actor,
                invitationId: decodeURIComponent(invitationsMatch[2]),
              }),
            }),
          )
          const revoked = (await revokedResponse.json()) as EventAccessResponse
          return revokedResponse.ok
            ? Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
            : Response.json(
                { ok: false, error: revoked.error ?? 'The invitation could not be canceled.' },
                { status: revokedResponse.status },
              )
        }
      }

      const memberMatch = url.pathname.match(/^\/api\/v1\/events\/([^/]+)\/members\/([^/]+)$/u)
      if (request.method === 'DELETE' && memberMatch) {
        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        const eventId = decodeURIComponent(memberMatch[1])
        if (eventId !== hostedPrincipal.membership!.eventId) {
          return Response.json({ ok: false, error: 'Event access was not found.' }, { status: 403 })
        }
        const access = eventAccessStub(env, eventId)!
        const revokedResponse = await access.fetch(
          new Request('http://event-access.internal/internal/event-access/memberships/revoke', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              eventId,
              actor: eventAccessActor(hostedPrincipal),
              membershipId: decodeURIComponent(memberMatch[2]),
            }),
          }),
        )
        const revoked = (await revokedResponse.json()) as EventAccessResponse
        if (!revokedResponse.ok || !revoked.membership) {
          return Response.json(
            { ok: false, error: revoked.error ?? 'Team access could not be removed.' },
            { status: revokedResponse.status },
          )
        }
        const targetShard = (await hashValue(revoked.membership.email)).slice(0, 32)
        await authStub(env, targetShard)?.fetch(
          new Request('http://auth.internal/internal/memberships/unlink', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              userId: revoked.membership.userId,
              eventId,
              membershipId: revoked.membership.id,
            }),
          }),
        )
        return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } })
      }

      if (request.method === 'POST' && url.pathname === '/api/v1/events') {
        if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
        let input: NormalizedHostedEventCreateInput
        try {
          input = normalizeHostedEventCreateInput(await request.json())
        } catch (caught) {
          return Response.json(
            {
              ok: false,
              error: caught instanceof Error ? caught.message : 'Enter valid event details.',
            },
            { status: 400, headers: { 'cache-control': 'no-store' } },
          )
        }
        const stub = authStub(env, hostedPrincipal.authShard)!
        const createdResponse = await stub.fetch(
          new Request('http://auth.internal/internal/events/create', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              token: hostedPrincipal.sessionToken,
              name: input.name,
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
        const settings = {
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          timezone: input.timezone,
          venue: input.venue,
          city: input.city,
        }
        await initializeHostedEvent(env, created.event, created.event.createdAt, settings)
        const membership = await initializeHostedEventAccess(
          env,
          created.event,
          eventAccessActor(hostedPrincipal),
        )
        await linkHostedMembership(env, hostedPrincipal, created.event, membership)
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
        const access = await resolveHostedEventAccess(env, hostedPrincipal, event)
        if (!access) {
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
    let key = publicEventId
      ? eventWorkspaceKey(publicEventId)
      : apiKeyPrincipal
        ? eventWorkspaceKey(apiKeyPrincipal.eventId)
        : hostedPrincipal
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

    if (profile === 'hosted-app' && hostedPrincipal && isDocumentNavigation(request)) {
      context.waitUntil(syncExternalAccessDirectory(env, stub).catch(() => undefined))
    }

    if (apiKeyPrincipal && !isApiKeyAccessiblePath(url.pathname)) {
      return Response.json(
        { ok: false, error: 'This endpoint is not available to API keys.' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      )
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/agent-plugin.zip') {
      const bundle = createAgentPluginBundle(url.origin)
      return new Response(bundle.archive, {
        headers: {
          'cache-control': 'private, no-store',
          'content-disposition': `attachment; filename="${bundle.filename}"`,
          'content-length': String(bundle.archive.byteLength),
          'content-type': 'application/zip',
        },
      })
    }

    const publicEventLogoMatch = url.pathname.match(
      /^\/public\/v1\/events\/([a-z0-9][a-z0-9_-]{0,63})\/logo\/([a-f0-9]{32})$/u,
    )
    if (request.method === 'GET' && publicEventLogoMatch) {
      return publicEventLogo(env, stub, publicEventLogoMatch[1], publicEventLogoMatch[2])
    }

    const eventLogoMatch = url.pathname.match(
      /^\/api\/v1\/events\/([a-z0-9][a-z0-9_-]{0,63})\/logo$/u,
    )
    if ((request.method === 'POST' || request.method === 'DELETE') && eventLogoMatch) {
      if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
      if (profile === 'hosted-app' && !hostedPrincipal?.scopes.includes('*')) {
        return Response.json(
          { ok: false, error: 'Administrator access is required.' },
          { status: 403, headers: { 'cache-control': 'no-store' } },
        )
      }
      return updateEventLogo(
        request,
        env,
        stub,
        eventLogoMatch[1],
        profile === 'hosted-app' && hostedPrincipal
          ? hostedStaffActor(hostedPrincipal)
          : demoStaffActor,
      )
    }

    if (profile === 'hosted-app' && isHostedRecoveryPath(request.method, url.pathname)) {
      if (!hostedPrincipal?.membership || hostedPrincipal.membership.role !== 'owner') {
        return Response.json(
          { ok: false, error: 'Event owner access is required.' },
          { status: 403, headers: { 'cache-control': 'no-store' } },
        )
      }
      if (request.method === 'POST' && !sameOrigin(request, url)) {
        return new Response(null, { status: 403, headers: { 'cache-control': 'no-store' } })
      }
      const internalPath =
        request.method === 'GET' ? '/internal/recovery/status' : '/internal/recovery/bookmark'
      return stub.fetch(
        new Request(`http://workspace.internal${internalPath}`, {
          method: request.method,
          headers: { 'content-type': 'application/json' },
          ...(request.method === 'POST' ? { body: await request.arrayBuffer() } : {}),
        }),
      )
    }

    if (
      profile === 'hosted-app' &&
      publicEventId &&
      (hostedPublicDocument || hostedPublicApi) &&
      !(await hostedEventExists(stub, publicEventId))
    ) {
      return unavailablePublicEvent(request)
    }

    const requiresDemoWorkspace =
      profile === 'hosted-demo' &&
      isDemoId(cookie(request, demoCookieName)) &&
      (isDocumentNavigation(request) ||
        url.pathname.startsWith('/api/') ||
        url.pathname.startsWith('/public/') ||
        url.pathname === '/mcp')
    if (requiresDemoWorkspace) {
      const { response, body } = await demoStatus(stub)
      if (!response.ok || !body.active || !body.demo) {
        const headers = new Headers({
          'cache-control': 'no-store',
          'set-cookie': clearDemoCookie(url),
        })
        if (request.method === 'GET' && isDocumentNavigation(request)) {
          headers.set('location', new URL('/', url.origin).toString())
          return new Response(null, { status: 302, headers })
        }
        return Response.json(
          { ok: false, error: 'This demo is no longer available.' },
          { status: 410, headers },
        )
      }
    }

    if (isWorkspaceCrmPath(profile, url.pathname)) {
      const response = await handleWorkspaceCrmRequest(request, env, url, stub)
      if (response) return response
    }

    if (url.pathname.startsWith('/api/v1/integrations/airtable/')) {
      if (profile === 'hosted-app' && hostedPrincipal && !hostedPrincipal.scopes.includes('*')) {
        return Response.json(
          { ok: false, error: 'Administrator access is required.' },
          { status: 403 },
        )
      }
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

    if (request.method === 'POST' && url.pathname === '/api/v1/operations/asset.delete') {
      if (!sameOrigin(request, url)) {
        return operationErrorResponse(
          403,
          'FORBIDDEN',
          'Cross-origin file deletion requests are not allowed.',
          0,
        )
      }
      if (!canDeleteStoredAssets(profile, hostedPrincipal?.membership?.role)) {
        return operationErrorResponse(
          403,
          'FORBIDDEN',
          'Event owner access is required to delete stored files.',
          0,
        )
      }
      return deleteStoredAsset(
        request,
        env,
        stub,
        profile === 'hosted-app' && hostedPrincipal
          ? hostedStaffActor(hostedPrincipal)
          : demoStaffActor,
      )
    }

    const speakerDeliverableMatch = url.pathname.match(
      /^\/public\/v1\/portal\/([^/]+)\/requirements\/([^/]+)\/assets$/u,
    )
    if (request.method === 'POST' && speakerDeliverableMatch) {
      if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
      return uploadSpeakerDeliverable(
        request,
        env,
        stub,
        decodeURIComponent(speakerDeliverableMatch[1]),
        decodeURIComponent(speakerDeliverableMatch[2]),
      )
    }

    const speakerAssetMatch = url.pathname.match(
      /^\/public\/v1\/portal\/([^/]+)\/assets\/([^/]+)$/u,
    )
    if (request.method === 'GET' && speakerAssetMatch) {
      const participationId = decodeURIComponent(speakerAssetMatch[1])
      const portalKey = request.headers.get('x-programkit-portal-key')
      return downloadStoredAsset(
        env,
        stub,
        decodeURIComponent(speakerAssetMatch[2]),
        (state, assetId) => {
          const participation = state.participations.find(
            (entry) => entry.id === participationId && entry.portalAccessKey === portalKey,
          )
          const asset = state.assets.find((entry) => entry.id === assetId)
          if (!participation || !asset) return false
          if (asset.owner.type === 'person') return asset.owner.id === participation.personId
          if (asset.owner.type === 'participation') return asset.owner.id === participation.id
          if (asset.owner.type !== 'requirement') return false
          return state.requirementInstances.some(
            (entry) => entry.id === asset.owner.id && entry.participationId === participation.id,
          )
        },
      )
    }

    if (request.method === 'GET' && url.pathname === '/api/v1/assets/export') {
      const requestedIds = new Set(
        (url.searchParams.get('ids') ?? '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
      return exportStoredAssets(env, stub, requestedIds)
    }

    const operatorAssetMatch = url.pathname.match(/^\/api\/v1\/assets\/([^/]+)$/u)
    if (request.method === 'GET' && operatorAssetMatch) {
      return downloadStoredAsset(
        env,
        stub,
        decodeURIComponent(operatorAssetMatch[1]),
        (state, assetId) =>
          state.assets.some(
            (entry) => entry.id === assetId && entry.eventId === state.activeEventId,
          ),
      )
    }

    const organizerHeadshotMatch = url.pathname.match(
      /^\/api\/v1\/people\/([^/]+)\/assets\/headshot$/u,
    )
    if (request.method === 'POST' && organizerHeadshotMatch) {
      if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
      return uploadOrganizerHeadshot(
        request,
        env,
        stub,
        decodeURIComponent(organizerHeadshotMatch[1]),
        profile === 'hosted-app' && hostedPrincipal
          ? hostedStaffActor(hostedPrincipal)
          : demoStaffActor,
      )
    }

    const speakerHeadshotMatch = url.pathname.match(
      /^\/public\/v1\/portal\/([^/]+)\/assets\/headshot$/u,
    )
    if (request.method === 'POST' && speakerHeadshotMatch) {
      if (!sameOrigin(request, url)) return new Response(null, { status: 403 })
      return uploadSpeakerHeadshot(request, env, stub, decodeURIComponent(speakerHeadshotMatch[1]))
    }

    const publicHeadshotMatch = url.pathname.match(/^\/public\/v1\/assets\/([^/]+)$/u)
    if (request.method === 'GET' && publicHeadshotMatch) {
      return publicHeadshot(env, stub, decodeURIComponent(publicHeadshotMatch[1]))
    }

    if (url.pathname === '/mcp') {
      if (profile === 'hosted-app' && hostedPrincipal && !hostedPrincipal.scopes.includes('*')) {
        return Response.json(
          { ok: false, error: 'Administrator access is required.' },
          { status: 403 },
        )
      }
      return handleMcpRequest(request, {
        readState: () => readWorkspace(stub),
        execute: (operation, operationRequest) =>
          executeWorkspaceOperation(stub, operation, operationRequest),
        actor: apiKeyPrincipal
          ? { ...apiKeyPrincipal.actor, type: 'agent', name: 'ProgramKit API agent' }
          : undefined,
      })
    }

    if (isHostedDemoReset(profile, request.method, url.pathname)) {
      return Response.json(
        { ok: false, error: 'The demonstration reset is not available for hosted events.' },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      )
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) {
      const portalMatch = url.pathname.match(/^\/(?:api|public)\/v1\/portal\/([^/]+)\//u)
      const reviewerMatch = url.pathname.match(/^\/(?:api|public)\/v1\/reviewers\/([^/]+)\//u)
      const publicSubmissionMatch = url.pathname.match(
        /^\/public\/v1\/submission-forms\/([^/]+)\//u,
      )
      const portalActorName = portalMatch
        ? await readWorkspace(stub).then((state) => {
            const participation = state.participations.find(
              (entry) => entry.id === decodeURIComponent(portalMatch[1]),
            )
            const person = participation
              ? state.people.find((entry) => entry.id === participation.personId)
              : null
            return person ? `${person.firstName} ${person.lastName}` : 'Portal participant'
          })
        : null
      const actor = portalMatch
        ? ({
            type: 'participant' as const,
            id: decodeURIComponent(portalMatch[1]),
            name: portalActorName ?? 'Portal participant',
            scopes: ['participations:write', 'requirements:write', 'portal:write', 'assets:write'],
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
            : profile === 'hosted-app' && hostedPrincipal
              ? hostedStaffActor(hostedPrincipal)
              : profile === 'hosted-app' && apiKeyPrincipal
                ? apiKeyPrincipal.actor
                : url.pathname.startsWith('/public/')
                  ? publicReaderActor
                  : demoStaffActor
      const proxiedResponse = await stub.fetch(withActor(request, actor))
      if (request.method === 'GET' && url.pathname === '/api/v1/state') {
        return withRuntimeIntegrations(proxiedResponse, env)
      }
      if (
        profile === 'hosted-app' &&
        request.method === 'POST' &&
        proxiedResponse.ok &&
        url.pathname.includes('/operations/')
      ) {
        context.waitUntil(syncExternalAccessDirectory(env, stub).catch(() => undefined))
      }
      if (
        profile === 'hosted-app' &&
        hostedPrincipal &&
        request.method === 'POST' &&
        proxiedResponse.ok &&
        url.pathname === '/api/v1/operations/event.update'
      ) {
        context.waitUntil(
          syncHostedActiveEventSummary(env, hostedPrincipal, stub).catch(() => null),
        )
      }
      return proxiedResponse
    }

    const assetResponse = await env.ASSETS.fetch(request)
    if (!assetResponse.headers.get('content-type')?.includes('text/html')) return assetResponse

    const renderedProfile =
      profile === 'hosted-site'
        ? 'hosted-site-entry'
        : profile === 'hosted-demo' && !isDemoId(cookie(request, demoCookieName))
          ? 'hosted-demo-entry'
          : profile === 'hosted-app' && !hostedPrincipal && !hostedPublicDocument
            ? 'hosted-app-entry'
            : profile
    const headers = browserSecurityHeaders(assetResponse.headers, url, {
      allowEmbedding: isHostedPublicDocument(url.pathname),
    })
    headers.set('cache-control', 'no-store')
    const alternateMarkdown = profile === 'hosted-site' ? docsMarkdownPathname(url.pathname) : null
    if (alternateMarkdown) {
      headers.append('link', `<${alternateMarkdown}>; rel="alternate"; type="text/markdown"`)
      appendVary(headers, 'Accept')
    }
    if (profile === 'hosted-app' && hostedPublicDocument && publicEventId) {
      headers.append('set-cookie', hostedPublicEventCookie(publicEventId, url))
    }
    const response = new Response(assetResponse.body, assetResponse)
    for (const [name, value] of headers) response.headers.set(name, value)
    // Only the workspace itself is worth installing to a home screen, so the
    // manifest and the iOS standalone tags are withheld from the marketing site
    // and the demo. Without them iOS never enters standalone mode, which also
    // keeps `black-translucent`, and the safe-area padding it demands, off
    // pages that were never laid out for it.
    const installable =
      renderedProfile === 'single-workspace' ||
      renderedProfile === 'hosted-app' ||
      renderedProfile === 'hosted-app-entry'
    return new HTMLRewriter()
      .on('head', {
        element(element) {
          element.append(
            `<meta name="programkit-deployment-profile" content="${renderedProfile}">`,
            { html: true },
          )
          if (alternateMarkdown) {
            element.append(
              `<link rel="alternate" type="text/markdown" href="${alternateMarkdown}" title="Markdown version">`,
              { html: true },
            )
          }
          if (!installable) return
          element.append(
            [
              '<link rel="manifest" href="/site.webmanifest">',
              '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">',
              '<meta name="apple-mobile-web-app-capable" content="yes">',
              '<meta name="mobile-web-app-capable" content="yes">',
              '<meta name="apple-mobile-web-app-title" content="ProgramKit">',
              // Translucent hands us the status bar strip: the workspace header
              // paints white behind the clock instead of iOS drawing its own bar.
              '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">',
            ].join(''),
            { html: true },
          )
        },
      })
      .transform(response)
  },
} satisfies ExportedHandler<Env>
