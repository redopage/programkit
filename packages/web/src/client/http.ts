import type { OperationResponse } from '@programkit/core'

import type {
  ProgramKitClient,
  ProgramKitHttpClientOptions,
  ProgramKitSurface,
  WorkspacePayload,
} from './types.ts'

const surfaceOperationAllowlist: Record<ProgramKitSurface['kind'], ReadonlySet<string> | null> = {
  operator: null,
  crm: null,
  submission: new Set(['submission.create', 'submission.submit', 'submission.update']),
  reviewer: new Set(['review.submit-scorecard', 'review.recuse', 'review.restore-recusal']),
  speaker: new Set([
    'participation.set-status',
    'requirement.set-status',
    'portal.update-profile',
    'asset.comment',
  ]),
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

async function parseOperationResponse(response: Response) {
  const body = (await response.json()) as
    OperationResponse | { error?: string | { message?: string } }
  if (typeof (body as OperationResponse).ok === 'boolean') {
    return body as OperationResponse
  }
  if (!response.ok) {
    const error = body.error
    const message =
      typeof error === 'string'
        ? error
        : (error?.message ?? `Request failed with ${response.status}.`)
    throw new Error(message)
  }
  throw new Error('The operation returned an invalid response.')
}

function stateEndpoint(surface: ProgramKitSurface) {
  switch (surface.kind) {
    case 'submission':
      return `/public/v1/submission-forms/${encodeURIComponent(surface.formSlug)}/state${
        surface.speakerAccessKey
          ? `?speakerAccessKey=${encodeURIComponent(surface.speakerAccessKey)}`
          : ''
      }`
    case 'reviewer':
      return `/public/v1/reviewers/${encodeURIComponent(surface.reviewerId)}/state`
    case 'speaker':
      return `/public/v1/portal/${encodeURIComponent(surface.participationId)}/state`
    case 'public-program':
      return '/public/v1/program/state'
    case 'operator':
      return '/api/v1/state'
    case 'crm':
      return '/api/v1/crm/state'
  }
}

function operationEndpoint(surface: ProgramKitSurface, operation: string) {
  const encodedOperation = encodeURIComponent(operation)
  switch (surface.kind) {
    case 'submission':
      return `/public/v1/submission-forms/${encodeURIComponent(surface.formSlug)}/operations/${encodedOperation}`
    case 'reviewer':
      return `/public/v1/reviewers/${encodeURIComponent(surface.reviewerId)}/operations/${encodedOperation}`
    case 'speaker':
      return `/public/v1/portal/${encodeURIComponent(surface.participationId)}/operations/${encodedOperation}`
    case 'operator':
      return `/api/v1/operations/${encodedOperation}`
    case 'crm':
      return `/api/v1/crm/operations/${encodedOperation}`
    case 'public-program':
      throw new Error('The public program is read-only.')
  }
}

export function withPublicEventScope(endpoint: string, eventId: string | null) {
  if (!eventId) return endpoint
  const url = new URL(endpoint, 'https://programkit.local')
  url.searchParams.set('event', eventId)
  return `${url.pathname}${url.search}`
}

function currentPublicEventId() {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('event')
}

function scopedEndpoint(surface: ProgramKitSurface, endpoint: string) {
  return surface.kind === 'operator' || surface.kind === 'crm'
    ? endpoint
    : withPublicEventScope(endpoint, currentPublicEventId())
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
  const surfaceHeaders = (surface: ProgramKitSurface, headers?: HeadersInit) => {
    const result = requestHeaders(headers)
    if (surface.kind === 'reviewer' && surface.reviewerAccessKey) {
      result.set('x-programkit-reviewer-key', surface.reviewerAccessKey)
    }
    if (surface.kind === 'speaker' && surface.portalAccessKey) {
      result.set('x-programkit-portal-key', surface.portalAccessKey)
    }
    return result
  }

  return {
    async readSurface(surface, signal) {
      return parseJson<WorkspacePayload>(
        await fetcher(resolveUrl(scopedEndpoint(surface, stateEndpoint(surface))), {
          cache: 'no-store',
          headers: surfaceHeaders(surface, { accept: 'application/json' }),
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
      return parseOperationResponse(
        await fetcher(resolveUrl(scopedEndpoint(surface, operationEndpoint(surface, operation))), {
          method: 'POST',
          headers: surfaceHeaders(surface, { 'content-type': 'application/json' }),
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
