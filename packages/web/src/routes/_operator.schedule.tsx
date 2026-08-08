import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { ScheduleView } from '../views/ScheduleView.tsx'

export const Route = createFileRoute('/_operator/schedule')({ component: ScheduleRoute })

function ScheduleRoute() {
  return <ScheduleView navigate={useProgramNavigate()} />
}
