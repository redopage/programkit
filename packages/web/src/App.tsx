import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { useState } from 'react'

import { ProgramKitClientProvider } from './client/context.tsx'
import { createProgramKitHttpClient } from './client/http.ts'
import type { ProgramKitClient } from './client/types.ts'
import { routeTree } from './routeTree.gen.ts'
import { DemoView } from './views/DemoView.tsx'

const defaultClient = createProgramKitHttpClient()

function createProgramKitQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 10_000,
      },
      mutations: {
        retry: false,
      },
    },
  })
}

function createProgramKitRouter() {
  return createRouter({
    routeTree,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createProgramKitRouter>
  }
}

export function ProgramKitApp({
  client = defaultClient,
  deploymentProfile = 'single-workspace',
}: {
  client?: ProgramKitClient
  deploymentProfile?: 'single-workspace' | 'hosted-demo' | 'hosted-demo-entry' | 'hosted-app'
}) {
  const [queryClient] = useState(createProgramKitQueryClient)
  const [router] = useState(createProgramKitRouter)
  if (deploymentProfile === 'hosted-demo-entry' && window.location.pathname === '/') {
    return <DemoView />
  }
  return (
    <ProgramKitClientProvider client={client}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ProgramKitClientProvider>
  )
}

export { ProgramKitApp as App }
