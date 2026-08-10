import { createFileRoute } from '@tanstack/react-router'

import { CommunicationsView } from '../views/CommunicationsView.tsx'

export const Route = createFileRoute('/_operator/communications')({
  validateSearch: (search: Record<string, unknown>) => ({
    compose: search.compose === 'reminder' ? ('reminder' as const) : undefined,
  }),
  component: CommunicationsRoute,
})

function CommunicationsRoute() {
  const { compose } = Route.useSearch()
  return <CommunicationsView initialCompose={compose === 'reminder' ? 'reminder' : null} />
}
