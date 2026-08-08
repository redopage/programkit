import { handleMcpRequest } from '@crm-library/agent'
import { WorkspaceDurableObject } from '@crm-library/core/cloudflare'
import type { OperationRequest, OperationResponse, WorkspaceState } from '@crm-library/core'

export { WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  CRM_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
}

const demoStaffActor = {
  type: 'staff' as const,
  id: 'usr_demo_operator',
  name: 'Demo Operator',
  scopes: ['*'],
}

const agentReaderActor = {
  type: 'agent' as const,
  id: 'agent_program_ops',
  name: 'Program Ops Agent',
  scopes: ['workspace:read'],
}

function workspaceStub(env: Env, request: Request) {
  const requested = request.headers.get('x-crm-workspace-key') ?? 'demo'
  const workspaceKey = /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(requested) ? requested : 'demo'
  return env.CRM_WORKSPACES.get(env.CRM_WORKSPACES.idFromName(workspaceKey))
}

function withActor(request: Request, actor: OperationRequest['actor']) {
  const headers = new Headers(request.headers)
  for (const name of [
    'x-crm-internal-actor-type',
    'x-crm-internal-actor-id',
    'x-crm-internal-actor-name',
    'x-crm-internal-actor-scopes',
  ]) {
    headers.delete(name)
  }
  if (actor) {
    headers.set('x-crm-internal-actor-type', actor.type)
    headers.set('x-crm-internal-actor-id', actor.id)
    headers.set('x-crm-internal-actor-name', actor.name)
    headers.set('x-crm-internal-actor-scopes', actor.scopes.join(' '))
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
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url)
    const stub = workspaceStub(env, request)

    if (url.pathname === '/mcp') {
      return handleMcpRequest(request, {
        readState: () => readWorkspace(stub),
        execute: (operation, operationRequest) =>
          executeWorkspaceOperation(stub, operation, operationRequest),
      })
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) {
      const portalMatch = url.pathname.match(/^\/api\/v1\/portal\/([^/]+)\//u)
      const actor = portalMatch
        ? {
            type: 'participant' as const,
            id: decodeURIComponent(portalMatch[1]),
            name: 'Portal participant',
            scopes: ['participations:write', 'requirements:write', 'portal:write'],
          }
        : demoStaffActor
      return stub.fetch(withActor(request, actor))
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
