import type { OperationResponse } from '@programkit/core'

import type {
  ProgramKitClient,
  ProgramKitHttpClientOptions,
  ProgramKitSurface,
  WorkspacePayload,
} from './types.ts'

const surfaceOperationAllowlist: Record<ProgramKitSurface['kind'], ReadonlySet<string> | null> = {
  operator: null,
  submission: new Set(['submission.create', 'submission.submit']),
  reviewer: new Set(['review.submit-scorecard']),
  speaker: new Set(['participation.set-status', 'requirement.set-status', 'portal.update-profile']),
  'public-program': new Set(),
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

function stateEndpoint(surface: ProgramKitSurface) {
  switch (surface.kind) {
    case 'submission':
      return `/public/v1/submission-forms/${encodeURIComponent(surface.formSlug)}/state`
    case 'reviewer':
      return `/api/v1/reviewers/${encodeURIComponent(surface.reviewerId)}/state`
    case 'speaker':
      return `/api/v1/portal/${encodeURIComponent(surface.participationId)}/state`
    case 'public-program':
      return '/public/v1/program/state'
    case 'operator':
      return '/api/v1/state'
  }
}

function operationEndpoint(surface: ProgramKitSurface, operation: string) {
  const encodedOperation = encodeURIComponent(operation)
  switch (surface.kind) {
    case 'submission':
      return `/public/v1/submission-forms/${encodeURIComponent(surface.formSlug)}/operations/${encodedOperation}`
    case 'reviewer':
      return `/api/v1/reviewers/${encodeURIComponent(surface.reviewerId)}/operations/${encodedOperation}`
    case 'speaker':
      return `/api/v1/portal/${encodeURIComponent(surface.participationId)}/operations/${encodedOperation}`
    case 'operator':
      return `/api/v1/operations/${encodedOperation}`
    case 'public-program':
      throw new Error('The public program is read-only.')
  }
}

export function createProgramKitHttpClient(
  options: ProgramKitHttpClientOptions = {},
): ProgramKitClient {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
  const resolveUrl = (endpoint: string) =>
    options.baseUrl ? new URL(endpoint, options.baseUrl).toString() : endpoint
  const requestHeaders = (headers?: HeadersInit) => {
    const result = new Headers(options.headers)
    new Headers(headers).forEach((value, key) => result.set(key, value))
    return result
  }

  return {
    async readSurface(surface, signal) {
      return parseJson<WorkspacePayload>(
        await fetcher(resolveUrl(stateEndpoint(surface)), {
          headers: requestHeaders({ accept: 'application/json' }),
          signal,
        }),
      )
    },

    async execute(surface, operation, input, operationOptions) {
      const allowlist = surfaceOperationAllowlist[surface.kind]
      if (allowlist && !allowlist.has(operation)) {
        throw new Error(`${operation} is not available on the ${surface.kind} surface.`)
      }
      const { actor: _untrustedActor, ...publicOptions } = operationOptions ?? {}
      return parseJson<OperationResponse>(
        await fetcher(resolveUrl(operationEndpoint(surface, operation)), {
          method: 'POST',
          headers: requestHeaders({ 'content-type': 'application/json' }),
          body: JSON.stringify({
            input,
            idempotencyKey: crypto.randomUUID(),
            ...publicOptions,
          }),
        }),
      )
    },
  }
}
