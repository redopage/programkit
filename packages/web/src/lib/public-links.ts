type DeploymentProfile =
  | 'single-workspace'
  | 'hosted-site'
  | 'hosted-site-entry'
  | 'hosted-demo'
  | 'hosted-demo-entry'
  | 'hosted-app'
  | 'hosted-app-entry'

function currentDeploymentProfile(): DeploymentProfile {
  if (typeof document === 'undefined') return 'single-workspace'
  const profile = document.querySelector<HTMLMetaElement>(
    'meta[name="programkit-deployment-profile"]',
  )?.content
  return profile === 'hosted-app' ? profile : 'single-workspace'
}

function withHostedEvent(pathname: string, eventId: string, profile: DeploymentProfile) {
  if (profile !== 'hosted-app') return pathname
  const search = new URLSearchParams({ event: eventId })
  return `${pathname}?${search}`
}

export function publicProgramPath(
  eventId: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  return withHostedEvent('/agenda', eventId, profile)
}

export function publicSubmissionPath(
  eventId: string,
  formSlug: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  return withHostedEvent(`/submit/${encodeURIComponent(formSlug)}`, eventId, profile)
}

export function externalAccessPath(
  eventId: string,
  formSlug?: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  if (profile !== 'hosted-app') return null
  const search = new URLSearchParams({ event: eventId })
  if (formSlug) search.set('form', formSlug)
  return `/access?${search}`
}

export function speakerSubmissionsPath(
  eventId: string,
  formSlug: string,
  speakerAccessKey: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  return withHostedEvent(
    `/submit/${encodeURIComponent(formSlug)}/mine/${encodeURIComponent(speakerAccessKey)}`,
    eventId,
    profile,
  )
}

export function reviewerAccessPath(
  eventId: string,
  reviewerId: string,
  accessKey: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  return withHostedEvent(
    `/reviewer/${encodeURIComponent(reviewerId)}/${encodeURIComponent(accessKey)}`,
    eventId,
    profile,
  )
}

export function speakerPortalPath(
  eventId: string,
  participationId: string,
  portalAccessKey: string,
  profile: DeploymentProfile = currentDeploymentProfile(),
) {
  return withHostedEvent(
    `/portal/${encodeURIComponent(participationId)}/${encodeURIComponent(portalAccessKey)}`,
    eventId,
    profile,
  )
}
