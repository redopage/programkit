import type {
  OperationRequest,
  OperationResponse,
  ScheduleConflict,
  WorkspaceState,
} from '@crm-library/core'

export interface WorkspacePayload {
  state: WorkspaceState
  derived: {
    readiness: {
      participants: number
      confirmed: number
      ready: number
      readinessPercent: number
      awaitingReview: number
      blockers: number
      unconfirmed: number
    }
    scheduleConflicts: ScheduleConflict[]
  }
}

async function parseJson<T>(response: Response) {
  const body = (await response.json()) as T & { error?: string | { message?: string } }
  if (!response.ok) {
    const message =
      typeof body.error === 'string'
        ? body.error
        : (body.error?.message ?? `Request failed with ${response.status}.`)
    throw new Error(message)
  }
  return body
}

function portalParticipationId() {
  if (typeof window === 'undefined') return null
  const match = window.location.pathname.match(/^\/portal\/([^/]+)/u)
  return match ? decodeURIComponent(match[1]) : null
}

export async function getWorkspace() {
  const participationId = portalParticipationId()
  const endpoint = participationId
    ? `/api/v1/portal/${encodeURIComponent(participationId)}/state`
    : '/api/v1/state'
  return parseJson<WorkspacePayload>(
    await fetch(endpoint, { headers: { accept: 'application/json' } }),
  )
}

export async function runOperation(
  operation: string,
  input: Record<string, unknown>,
  options?: Omit<OperationRequest, 'input'>,
) {
  const participationId = portalParticipationId()
  const endpoint = participationId
    ? `/api/v1/portal/${encodeURIComponent(participationId)}/operations/${encodeURIComponent(operation)}`
    : `/api/v1/operations/${encodeURIComponent(operation)}`
  const { actor: _untrustedActor, ...publicOptions } = options ?? {}
  return parseJson<OperationResponse>(
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input,
        idempotencyKey: crypto.randomUUID(),
        ...publicOptions,
      }),
    }),
  )
}
