import { createFileRoute } from '@tanstack/react-router'

import { ItineraryEmbedView } from '../views/ItineraryEmbedView.tsx'

export const Route = createFileRoute('/embed/itinerary')({ component: ItineraryEmbedView })
