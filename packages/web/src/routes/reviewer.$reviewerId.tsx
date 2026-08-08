import { createFileRoute } from '@tanstack/react-router'

import { ReviewerPortalView } from '../views/ReviewerPortalView.tsx'

export const Route = createFileRoute('/reviewer/$reviewerId')({
  validateSearch: (search: Record<string, unknown>) => ({
    assignment: typeof search.assignment === 'string' ? search.assignment : undefined,
  }),
  component: ReviewerRoute,
})

function ReviewerRoute() {
  const { reviewerId } = Route.useParams()
  const { assignment } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ReviewerPortalView
      reviewerId={reviewerId}
      selectedAssignmentId={assignment}
      onSelectionChange={(nextAssignment) =>
        void navigate({ search: { assignment: nextAssignment }, replace: true })
      }
    />
  )
}
