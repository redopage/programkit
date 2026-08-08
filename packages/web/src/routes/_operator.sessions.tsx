import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { SessionsView } from '../views/SessionsView.tsx'

export const Route = createFileRoute('/_operator/sessions')({ component: SessionsRoute })

function SessionsRoute() {
  return <SessionsView navigate={useProgramNavigate()} />
}
