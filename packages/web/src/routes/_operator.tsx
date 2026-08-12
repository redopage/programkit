import { createFileRoute, Outlet, useRouterState } from '@tanstack/react-router'

import { Shell } from '../components/Shell.tsx'
import { WorkspaceBoundary } from '../components/WorkspaceBoundary.tsx'
import { useProgramNavigate } from '../lib/navigation.ts'

export const Route = createFileRoute('/_operator')({
  component: OperatorLayout,
})

function OperatorLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const navigate = useProgramNavigate()
  return (
    <Shell pathname={pathname} navigate={navigate}>
      <WorkspaceBoundary embedded>
        <Outlet />
      </WorkspaceBoundary>
    </Shell>
  )
}
