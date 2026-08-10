import { createFileRoute } from '@tanstack/react-router'

import { AccessView } from '../views/AccessView.tsx'

export const Route = createFileRoute('/access')({
  component: AccessView,
})
