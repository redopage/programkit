import { createFileRoute } from '@tanstack/react-router'

import { SpeakerGalleryEmbedView } from '../views/SpeakerGalleryEmbedView.tsx'

export const Route = createFileRoute('/embed/speakers')({ component: SpeakerGalleryEmbedView })
