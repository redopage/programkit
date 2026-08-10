import { useState, type ReactNode } from 'react'

import { createDemo, leaveCurrentDemo } from '../lib/demo.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { Button, ErrorState, LoadingScreen } from './ui.tsx'

export function WorkspaceBoundary({ children }: { children: ReactNode }) {
  const { payload, loading, refreshing, error, refresh } = useWorkspace()
  const [recovering, setRecovering] = useState<'create' | 'leave' | null>(null)
  const [recoveryError, setRecoveryError] = useState<string | null>(null)
  const hostedDemo =
    document.querySelector<HTMLMetaElement>('meta[name="programkit-deployment-profile"]')
      ?.content === 'hosted-demo'

  const startNewDemo = async () => {
    setRecovering('create')
    setRecoveryError(null)
    try {
      const demo = await createDemo()
      window.location.assign(demo.url)
    } catch (caught) {
      setRecoveryError(
        caught instanceof Error ? caught.message : 'A new demo could not be created.',
      )
      setRecovering(null)
    }
  }

  const leaveDemo = async () => {
    setRecovering('leave')
    setRecoveryError(null)
    try {
      await leaveCurrentDemo()
      window.location.assign('/')
    } catch (caught) {
      setRecoveryError(caught instanceof Error ? caught.message : 'The demo could not be left.')
      setRecovering(null)
    }
  }

  if (loading) return <LoadingScreen />
  if (error || !payload) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <ErrorState
          title="The workspace could not be loaded"
          description={recoveryError ?? error ?? 'The API did not return a workspace.'}
          retrying={refreshing}
          onRetry={hostedDemo ? undefined : () => void refresh()}
          action={
            hostedDemo ? (
              <div className="flex flex-wrap justify-center gap-2">
                <Button
                  variant="primary"
                  size="compact"
                  onClick={() => void startNewDemo()}
                  disabled={recovering !== null}
                >
                  {recovering === 'create' ? 'Creating…' : 'Create new demo'}
                </Button>
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={() => void leaveDemo()}
                  disabled={recovering !== null}
                >
                  {recovering === 'leave' ? 'Leaving…' : 'Leave demo'}
                </Button>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => void refresh()}
                  disabled={refreshing || recovering !== null}
                >
                  {refreshing ? 'Trying again…' : 'Try again'}
                </Button>
              </div>
            ) : undefined
          }
        />
      </div>
    )
  }

  return children
}
