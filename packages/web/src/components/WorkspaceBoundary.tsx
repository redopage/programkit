import type { ReactNode } from 'react'

import { useWorkspace } from '../lib/workspace.tsx'
import { ErrorState, LoadingScreen } from './ui.tsx'

export function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const { payload, loading, refreshing, error, refresh } = useWorkspace()

  if (loading) return <LoadingScreen />
  if (error || !payload) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <ErrorState
          title="The workspace could not be loaded"
          description={error ?? 'The API did not return a workspace.'}
          retrying={refreshing}
          onRetry={() => void refresh()}
        />
      </div>
    )
  }

  return children
}
