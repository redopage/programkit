import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import {
  SubmissionsView,
  type SubmissionFilter,
  type SubmissionsViewSearch,
} from '../views/SubmissionsView.tsx'

const submissionFilters = new Set<SubmissionFilter>([
  'all',
  'draft',
  'submitted',
  'in_review',
  'waitlisted',
  'accepted',
  'rejected',
  'withdrawn',
])

export const Route = createFileRoute('/_operator/submissions')({
  validateSearch: (search: Record<string, unknown>): SubmissionsViewSearch => ({
    submission: typeof search.submission === 'string' ? search.submission : undefined,
    status:
      typeof search.status === 'string' && submissionFilters.has(search.status as SubmissionFilter)
        ? (search.status as SubmissionFilter)
        : undefined,
    q: typeof search.q === 'string' && search.q.length > 0 ? search.q : undefined,
  }),
  component: SubmissionsRoute,
})

function SubmissionsRoute() {
  const search = Route.useSearch()
  const routeNavigate = Route.useNavigate()
  return (
    <SubmissionsView
      navigate={useProgramNavigate()}
      search={search}
      onSearchChange={(next) => void routeNavigate({ search: next, replace: true })}
    />
  )
}
