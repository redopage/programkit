const standaloneRoutes = new Set(['/access', '/demo', '/privacy', '/terms'])
const operatorRouteSegments = new Set([
  'agent',
  'changes',
  'communications',
  'crm',
  'files',
  'forms',
  'integrations',
  'people',
  'readiness',
  'reviews',
  'schedule',
  'sessions',
  'settings',
  'submissions',
])

/**
 * Routes that read their own public or legal data must not wait for the
 * organizer workspace query. This keeps participant recovery usable before an
 * organizer session exists.
 */
export function routeUsesWorkspaceShell(pathname: string) {
  return !standaloneRoutes.has(pathname)
}

export function routeUsesOperatorShell(pathname: string) {
  if (pathname === '/') return true
  const segment = pathname.split('/').filter(Boolean)[0]
  return Boolean(segment && operatorRouteSegments.has(segment))
}
