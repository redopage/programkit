import { createRootRoute, Outlet } from '@tanstack/react-router'

import { WorkspaceBoundary } from '../components/WorkspaceBoundary.tsx'
import { Button, ToastViewport } from '../components/ui.tsx'
import { useProgramNavigate } from '../lib/navigation.ts'
import { WorkspaceProvider } from '../lib/workspace.tsx'

export const Route = createRootRoute({
  component: RootRoute,
  notFoundComponent: NotFound,
})

function RootRoute() {
  return (
    <WorkspaceProvider>
      <WorkspaceBoundary>
        <Outlet />
        <ToastViewport />
      </WorkspaceBoundary>
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
