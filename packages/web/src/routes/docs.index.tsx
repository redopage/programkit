import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/docs/')({
  component: DocsIndexRoute,
})

function DocsIndexRoute() {
  return null
}
