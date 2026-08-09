import type {
  OperationRequest,
  OperationResponse,
  ScheduleConflict,
  WorkspaceState,
} from '@programkit/core'

export type ProgramKitSurface =
  | { kind: 'operator' }
  | { kind: 'submission'; formSlug: string; speakerAccessKey?: string }
  | { kind: 'reviewer'; reviewerId: string }
  | { kind: 'speaker'; participationId: string }
  | { kind: 'public-program' }

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

export interface ProgramKitClient {
  readSurface(surface: ProgramKitSurface, signal?: AbortSignal): Promise<WorkspacePayload>
  execute(
    surface: ProgramKitSurface,
    operation: string,
    input: Record<string, unknown>,
    options?: Omit<OperationRequest, 'input'>,
  ): Promise<OperationResponse>
}

export interface ProgramKitHttpClientOptions {
  baseUrl?: string | URL
  fetch?: typeof globalThis.fetch
  headers?: HeadersInit
}
