const standaloneRoutes = new Set(['/access', '/demo', '/privacy', '/terms'])

/**
 * Routes that read their own public or legal data must not wait for the
 * organizer workspace query. This keeps participant recovery usable before an
 * organizer session exists.
 */
export function routeUsesWorkspaceShell(pathname: string) {
  return !standaloneRoutes.has(pathname)
}
