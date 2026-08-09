import { createFileRoute } from '@tanstack/react-router'

import { SpeakerSubmissionsView } from '../views/SpeakerSubmissionsView.tsx'

export const Route = createFileRoute('/submit/$formSlug_/mine/$speakerAccessKey')({
  component: SpeakerSubmissionsRoute,
})

function SpeakerSubmissionsRoute() {
  const { formSlug, speakerAccessKey } = Route.useParams()
  return <SpeakerSubmissionsView formSlug={formSlug} speakerAccessKey={speakerAccessKey} />
}
