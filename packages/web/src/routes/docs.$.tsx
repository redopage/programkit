import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/docs/$')({
  component: DocsCatchAllRoute,
})

function DocsCatchAllRoute() {
  return null
}
