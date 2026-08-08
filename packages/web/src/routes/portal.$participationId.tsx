import { createFileRoute } from '@tanstack/react-router'

import { PortalView } from '../views/PortalView.tsx'

export const Route = createFileRoute('/portal/$participationId')({ component: PortalView })
