import { createRootRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { WorkspaceBoundary } from '../components/WorkspaceBoundary.tsx'
import { Button, ToastViewport } from '../components/ui.tsx'
import { useProgramNavigate } from '../lib/navigation.ts'
import { routeUsesOperatorShell, routeUsesWorkspaceShell } from '../lib/route-shell.ts'
import { WorkspaceProvider } from '../lib/workspace.tsx'

export const Route = createRootRoute({
  component: RootRoute,
  notFoundComponent: NotFound,
})

function RootRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  if (!routeUsesWorkspaceShell(pathname)) return <Outlet />
  const content = (
    <>
      <Outlet />
      <ToastViewport />
    </>
  )
  return (
    <WorkspaceProvider>
      {routeUsesOperatorShell(pathname) ? (
        content
      ) : (
        <WorkspaceBoundary>{content}</WorkspaceBoundary>
      )}
    </WorkspaceProvider>
  )
}

function NotFound() {
  const navigate = useProgramNavigate()
  return (
    <div className="grid min-h-dvh place-items-center bg-white p-6 text-center">
      <div>
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
          Page not found
        </h1>
        <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
          This route is not part of the reference workspace.
        </p>
        <div className="flex justify-center pt-5">
          <Button variant="primary" onClick={() => navigate('/')}>
            Return to overview
          </Button>
        </div>
      </div>
    </div>
  )
}
