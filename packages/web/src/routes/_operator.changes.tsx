import { createFileRoute } from '@tanstack/react-router'

import { ChangesView } from '../views/ChangesView.tsx'

export const Route = createFileRoute('/_operator/changes')({ component: ChangesView })
