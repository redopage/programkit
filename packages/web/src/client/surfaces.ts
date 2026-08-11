import type { ProgramKitSurface } from './types.ts'

function decodedSegment(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function surfaceFromPathname(pathname: string): ProgramKitSurface {
  if (pathname === '/crm' || pathname.startsWith('/crm/')) return { kind: 'crm' }

  const speakerSubmissions = pathname.match(/^\/submit\/([^/]+)\/mine\/([^/]+)(?:\/|$)/u)
  if (speakerSubmissions) {
    return {
      kind: 'submission',
      formSlug: decodedSegment(speakerSubmissions[1]),
      speakerAccessKey: decodedSegment(speakerSubmissions[2]),
    }
  }
  const submission = pathname.match(/^\/submit\/([^/]+)(?:\/|$)/u)
  if (submission) return { kind: 'submission', formSlug: decodedSegment(submission[1]) }

  const reviewer = pathname.match(/^\/reviewer\/([^/]+)(?:\/([^/]+))?(?:\/|$)/u)
  if (reviewer) {
    return {
      kind: 'reviewer',
      reviewerId: decodedSegment(reviewer[1]),
      ...(reviewer[2] ? { reviewerAccessKey: decodedSegment(reviewer[2]) } : {}),
    }
  }

  const speaker = pathname.match(/^\/portal\/([^/]+)(?:\/([^/]+))?(?:\/|$)/u)
  if (speaker) {
    return {
      kind: 'speaker',
      participationId: decodedSegment(speaker[1]),
      ...(speaker[2] ? { portalAccessKey: decodedSegment(speaker[2]) } : {}),
    }
  }

  if (pathname === '/agenda' || pathname.startsWith('/agenda/')) {
    return { kind: 'public-program' }
  }

  return { kind: 'operator' }
}

export function surfaceKey(surface: ProgramKitSurface) {
  switch (surface.kind) {
    case 'submission':
      return `submission:${surface.formSlug}:${surface.speakerAccessKey ?? 'public'}`
    case 'reviewer':
      return `reviewer:${surface.reviewerId}:${surface.reviewerAccessKey ?? 'unavailable'}`
    case 'speaker':
      return `speaker:${surface.participationId}:${surface.portalAccessKey ?? 'unavailable'}`
    default:
      return surface.kind
  }
}
