import { createFileRoute } from '@tanstack/react-router'

import { CommunicationsView } from '../views/CommunicationsView.tsx'

export const Route = createFileRoute('/_operator/communications')({
  component: CommunicationsView,
})
