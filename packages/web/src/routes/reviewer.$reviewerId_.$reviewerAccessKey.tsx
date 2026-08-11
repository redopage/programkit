import { createFileRoute } from '@tanstack/react-router'

import { ReviewerPortalView } from '../views/ReviewerPortalView.tsx'

export const Route = createFileRoute('/reviewer/$reviewerId_/$reviewerAccessKey')({
  validateSearch: (search: Record<string, unknown>) => ({
    assignment: typeof search.assignment === 'string' ? search.assignment : undefined,
    event: typeof search.event === 'string' ? search.event : undefined,
  }),
  component: ReviewerAccessRoute,
})

function ReviewerAccessRoute() {
  const { reviewerId, reviewerAccessKey } = Route.useParams()
  const { assignment, event } = Route.useSearch()
  const navigate = Route.useNavigate()
  return (
    <ReviewerPortalView
      reviewerId={reviewerId}
      selectedAssignmentId={assignment}
      onSelectionChange={(nextAssignment) =>
        void navigate({
          to: '/reviewer/$reviewerId/$reviewerAccessKey',
          params: { reviewerId, reviewerAccessKey },
          search: { assignment: nextAssignment, event },
          replace: true,
        })
      }
    />
  )
}
