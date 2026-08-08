import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { OverviewView } from '../views/OverviewView.tsx'

export const Route = createFileRoute('/_operator/')({
  component: OverviewRoute,
})

function OverviewRoute() {
  return <OverviewView navigate={useProgramNavigate()} />
}
