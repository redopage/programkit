import { createFileRoute } from '@tanstack/react-router'

import { CrmView } from '../views/CrmView.tsx'

export const Route = createFileRoute('/_operator/crm')({
  component: CrmView,
})
