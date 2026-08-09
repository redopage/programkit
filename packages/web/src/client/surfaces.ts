import type { ProgramKitSurface } from './types.ts'

function decodedSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function surfaceFromPathname(pathname: string): ProgramKitSurface {
  const submission = pathname.match(/^\/submit\/([^/]+)(?:\/|$)/u)
  if (submission) return { kind: 'submission', formSlug: decodedSegment(submission[1]) }

  const reviewer = pathname.match(/^\/reviewer\/([^/]+)(?:\/|$)/u)
  if (reviewer) return { kind: 'reviewer', reviewerId: decodedSegment(reviewer[1]) }

  const speaker = pathname.match(/^\/portal\/([^/]+)(?:\/|$)/u)
  if (speaker) return { kind: 'speaker', participationId: decodedSegment(speaker[1]) }

  if (
    pathname === '/agenda' ||
    pathname.startsWith('/agenda/') ||
    pathname === '/embed/speakers' ||
    pathname === '/embed/itinerary'
  ) {
    return { kind: 'public-program' }
  }

  return { kind: 'operator' }
}

export function surfaceKey(surface: ProgramKitSurface) {
  switch (surface.kind) {
    case 'submission':
      return `submission:${surface.formSlug}`
    case 'reviewer':
      return `reviewer:${surface.reviewerId}`
    case 'speaker':
      return `speaker:${surface.participationId}`
    default:
      return surface.kind
  }
}

export function surfaceRefreshInterval(surface: ProgramKitSurface) {
  return surface.kind === 'operator' ? 5_000 : 15_000
}
