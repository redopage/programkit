import { createFileRoute } from '@tanstack/react-router'

import { useProgramNavigate } from '../lib/navigation.ts'
import { ReviewsView } from '../views/ReviewsView.tsx'

export const Route = createFileRoute('/_operator/reviews')({ component: ReviewsRoute })

function ReviewsRoute() {
  return <ReviewsView navigate={useProgramNavigate()} />
}
