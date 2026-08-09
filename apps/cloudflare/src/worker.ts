import { handleMcpRequest } from '@programkit/agent'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'
import type { OperationRequest, OperationResponse, WorkspaceState } from '@programkit/core'

import { verifyAirtableWebhookMac } from './airtable-webhook.ts'

export { WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  PROGRAMKIT_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
  AIRTABLE_TOKEN?: string
  AIRTABLE_BASE_ID?: string
  AIRTABLE_WEBHOOK_MAC_SECRET?: string
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

function workspaceStub(env: Env, request: Request) {
  const requested = env.AIRTABLE_BASE_ID
    ? 'demo'
    : (request.headers.get('x-programkit-workspace-key') ?? 'demo')
  const workspaceKey = /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(requested) ? requested : 'demo'
  return env.PROGRAMKIT_WORKSPACES.get(env.PROGRAMKIT_WORKSPACES.idFromName(workspaceKey))
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
    const stub = workspaceStub(env, request)

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
