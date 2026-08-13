import { createFileRoute, Outlet } from '@tanstack/react-router'

import { DocsView } from '../views/DocsView.tsx'

export const Route = createFileRoute('/docs')({
  component: DocsLayout,
})

function DocsLayout() {
  return (
    <>
      <DocsView />
      <Outlet />
    </>
  )
}
