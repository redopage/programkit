import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { ReadinessView } from '../views/ReadinessView.tsx'

export const Route = createFileRoute('/_operator/readiness')({ component: ReadinessRoute })

function ReadinessRoute() {
  return <ReadinessView navigate={useProgramNavigate()} />
}
