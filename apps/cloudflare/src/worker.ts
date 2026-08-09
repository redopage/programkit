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

export { WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  PROGRAMKIT_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
  AIRTABLE_TOKEN?: string
  AIRTABLE_BASE_ID?: string
  AIRTABLE_WEBHOOK_MAC_SECRET?: string
  AIRTABLE_OAUTH_CLIENT_ID?: string
  AIRTABLE_OAUTH_CLIENT_SECRET?: string
}

const workspaceCookieName = 'programkit_workspace'
const workspaceKeyPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/u
const airtableCallbackPath = '/api/v1/integrations/airtable/oauth/callback'

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
  if (env.AIRTABLE_BASE_ID) return 'demo'
  const requested =
    request.headers.get('x-programkit-workspace-key') ??
    cookie(request, workspaceCookieName) ??
    'demo'
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
    let key = workspaceKey(env, request)
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
      const actor = portalMatch
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

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
