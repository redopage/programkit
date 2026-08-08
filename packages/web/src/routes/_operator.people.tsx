import { createFileRoute } from '@tanstack/react-router'

import { PeopleView } from '../views/PeopleView.tsx'

export interface PeopleSearch {
  person?: string
}

export const Route = createFileRoute('/_operator/people')({
  validateSearch: (search: Record<string, unknown>): PeopleSearch => ({
    person: typeof search.person === 'string' ? search.person : undefined,
  }),
  component: PeopleRoute,
})

function PeopleRoute() {
  const { person } = Route.useSearch()
  return <PeopleView initialPersonId={person} />
}
