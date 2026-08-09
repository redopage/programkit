import { createFileRoute } from '@tanstack/react-router'

import { DemoView } from '../views/DemoView.tsx'

export const Route = createFileRoute('/demo')({ component: DemoView })
