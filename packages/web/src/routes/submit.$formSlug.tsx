import { createFileRoute } from '@tanstack/react-router'

import { PublicSubmissionView } from '../views/PublicSubmissionView.tsx'

export const Route = createFileRoute('/submit/$formSlug')({ component: SubmissionRoute })

function SubmissionRoute() {
  const { formSlug } = Route.useParams()
  return <PublicSubmissionView slug={formSlug} />
}
