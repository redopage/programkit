import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { AgentView } from '../views/AgentView.tsx'

export const Route = createFileRoute('/_operator/agent')({ component: AgentRoute })

function AgentRoute() {
  return <AgentView navigate={useProgramNavigate()} />
}
