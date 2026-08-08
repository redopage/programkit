import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { AgendaView } from '../views/AgendaView.tsx'

export const Route = createFileRoute('/agenda')({ component: AgendaRoute })

function AgendaRoute() {
  return <AgendaView navigate={useProgramNavigate()} />
}
