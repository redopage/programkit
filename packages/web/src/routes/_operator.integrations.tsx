import { createFileRoute } from '@tanstack/react-router'

import { IntegrationsView } from '../views/IntegrationsView.tsx'

export const Route = createFileRoute('/_operator/integrations')({ component: IntegrationsView })
