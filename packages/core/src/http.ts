import { executeOperation } from './engine.ts'
import { operationManifest } from './manifest.ts'
import { publicAgenda, readinessSummary, scheduleConflicts } from './selectors.ts'
import { defaultActor } from './utils.ts'
import type { WorkspaceRepository } from './repository.ts'
import type { Actor, OperationRequest, WorkspaceState } from './types.ts'

const maximumJsonBytes = 128_000

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type must be application/json.')
  }
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumJsonBytes) {
    throw new Error('Request body is too large.')
  }
  if (!request.body) throw new Error('The request body is empty.')
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let body = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > maximumJsonBytes) {
      await reader.cancel()
      throw new Error('Request body is too large.')
    }
    body += decoder.decode(chunk.value, { stream: true })
  }
  body += decoder.decode()
  return JSON.parse(body) as unknown
}

function publicState(state: WorkspaceState) {
  const clone = structuredClone(state)
  clone.recentCommandResults = []
  return clone
}

function participantState(state: WorkspaceState, participationId: string) {
  const participation = state.participations.find((entry) => entry.id === participationId)
  if (!participation) return null
  const person = state.people.find((entry) => entry.id === participation.personId)
  if (!person) return null
  const event = state.events.find((entry) => entry.id === participation.eventId)
  const clone = structuredClone(state)
  clone.events = event ? [event] : []
  clone.people = [person]
  clone.participations = [{ ...participation, internalNotes: '' }]
  clone.requirementDefinitions = state.requirementDefinitions.filter(
    (entry) => entry.eventId === participation.eventId,
  )
  clone.requirementInstances = state.requirementInstances.filter(
    (entry) => entry.participationId === participationId,
  )
  clone.tracks = []
  clone.rooms = []
  clone.sessions = []
  clone.placements = []
  clone.scheduleReleases = []
  clone.campaigns = []
  clone.changeSets = []
  clone.integrations = []
  clone.domainEvents = []
  clone.recentCommandResults = []
  return clone
}

function hasScope(actor: Actor, scope: string) {
  return actor.scopes.includes('*') || actor.scopes.includes(scope)
}

function forbidden(scope: string) {
  return json({ error: `The current actor is missing ${scope}.` }, { status: 403 })
}

export interface CoreRequestContext {
  actor?: Actor
}

export async function handleCoreRequest(
  request: Request,
  repository: WorkspaceRepository,
  context: CoreRequestContext = {},
) {
  const url = new URL(request.url)
  const path = url.pathname
  const actor = context.actor ?? defaultActor

  if (request.method === 'GET' && path === '/api/v1/health') {
    const state = await repository.read()
    return json({ ok: true, schemaVersion: state.schemaVersion, revision: state.revision })
  }

  if (request.method === 'GET' && path === '/api/v1/state') {
    if (!hasScope(actor, 'workspace:read')) return forbidden('workspace:read')
    const state = await repository.read()
    return json({
      state: publicState(state),
      derived: {
        readiness: readinessSummary(state),
        scheduleConflicts: scheduleConflicts(state),
      },
    })
  }

  if (request.method === 'GET' && path === '/api/v1/manifest') {
    return json({ operations: operationManifest })
  }

  if (request.method === 'GET' && path === '/api/v1/events') {
    if (!hasScope(actor, 'events:read')) return forbidden('events:read')
    const state = await repository.read()
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 50), 1), 200)
    return json({ events: state.domainEvents.slice(-limit).reverse() })
  }

  if (request.method === 'GET' && path === '/api/v1/export') {
    if (!hasScope(actor, 'workspace:export')) return forbidden('workspace:export')
    const state = await repository.read()
    return json(
      {
        exportedAt: new Date().toISOString(),
        format: 'crm-library.workspace.v1',
        state: publicState(state),
      },
      {
        headers: {
          'content-disposition': `attachment; filename="${state.workspace.slug}-export.json"`,
        },
      },
    )
  }

  if (request.method === 'GET' && path === '/public/agenda.json') {
    const state = await repository.read()
    return json(
      {
        event: state.events.find((event) => event.id === state.activeEventId),
        agenda: publicAgenda(state),
      },
      {
        headers: { 'cache-control': 'public, max-age=60' },
      },
    )
  }

  const portalStateMatch = path.match(/^\/api\/v1\/portal\/([^/]+)\/state$/u)
  if (request.method === 'GET' && portalStateMatch) {
    const participationId = decodeURIComponent(portalStateMatch[1])
    if (actor.type !== 'participant' || actor.id !== participationId) {
      return json({ error: 'The participant session does not match this portal.' }, { status: 403 })
    }
    const state = await repository.read()
    const projected = participantState(state, participationId)
    if (!projected) return json({ error: 'Participant not found.' }, { status: 404 })
    return json({
      state: projected,
      derived: {
        readiness: readinessSummary(projected),
        scheduleConflicts: [],
      },
    })
  }

  const operatorOperation = path.startsWith('/api/v1/operations/')
    ? decodeURIComponent(path.slice('/api/v1/operations/'.length))
    : null
  const portalOperationMatch = path.match(/^\/api\/v1\/portal\/([^/]+)\/operations\/(.+)$/u)
  if (request.method === 'POST' && (operatorOperation || portalOperationMatch)) {
    const participationId = portalOperationMatch
      ? decodeURIComponent(portalOperationMatch[1])
      : null
    if (participationId && (actor.type !== 'participant' || actor.id !== participationId)) {
      return json({ error: 'The participant session does not match this portal.' }, { status: 403 })
    }
    const operation = operatorOperation ?? decodeURIComponent(portalOperationMatch?.[2] ?? '')
    try {
      const body = (await readJson(request)) as OperationRequest
      if (!body || typeof body !== 'object' || !body.input || typeof body.input !== 'object') {
        return json({ error: 'The request must include an input object.' }, { status: 400 })
      }
      const response = await repository.mutate((state) => {
        const result = executeOperation(state, operation, { ...body, actor })
        return { state: result.state, result: result.response }
      })
      return json(response, { status: response.ok ? 200 : 400 })
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'The request could not be processed.' },
        { status: 400 },
      )
    }
  }

  if (path.startsWith('/api/') || path.startsWith('/public/')) {
    return json({ error: 'Not found.' }, { status: 404 })
  }

  return null
}
