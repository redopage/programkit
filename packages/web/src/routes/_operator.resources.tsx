import { createFileRoute } from '@tanstack/react-router'

import { ResourcesView } from '../views/ResourcesView.tsx'

export const Route = createFileRoute('/_operator/resources')({ component: ResourcesView })
