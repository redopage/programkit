import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type { OperationRequest, OperationResponse } from '@crm-library/core'

import { getWorkspace, runOperation, type WorkspacePayload } from './api.ts'

interface Toast {
  id: string
  tone: 'success' | 'error' | 'info'
  message: string
}

interface WorkspaceContextValue {
  payload: WorkspacePayload | null
  loading: boolean
  mutating: boolean
  error: string | null
  toast: Toast | null
  refresh: () => Promise<void>
  execute: (
    operation: string,
    input: Record<string, unknown>,
    options?: Omit<OperationRequest, 'input'>,
    successMessage?: string,
  ) => Promise<OperationResponse>
  dismissToast: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [payload, setPayload] = useState<WorkspacePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setError(null)
      const next = await getWorkspace()
      setPayload(next)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The workspace could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const execute = useCallback(
    async (
      operation: string,
      input: Record<string, unknown>,
      options?: Omit<OperationRequest, 'input'>,
      successMessage?: string,
    ) => {
      setMutating(true)
      try {
        const response = await runOperation(operation, input, options)
        if (!response.ok) {
          setToast({
            id: crypto.randomUUID(),
            tone: 'error',
            message: response.error?.message ?? 'The action failed.',
          })
          return response
        }
        await refresh()
        setToast({
          id: crypto.randomUUID(),
          tone: 'success',
          message:
            successMessage ??
            (response.approvalRequired ? 'Proposal created for review.' : 'Changes saved.'),
        })
        return response
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The action failed.'
        setToast({ id: crypto.randomUUID(), tone: 'error', message })
        return {
          ok: false,
          error: { code: 'REQUEST_FAILED', message },
          eventIds: [],
          warnings: [],
          approvalRequired: false,
          stateRevision: payload?.state.revision ?? 0,
          traceId: crypto.randomUUID(),
        }
      } finally {
        setMutating(false)
      }
    },
    [payload?.state.revision, refresh],
  )

  const value = useMemo(
    () => ({
      payload,
      loading,
      mutating,
      error,
      toast,
      refresh,
      execute,
      dismissToast: () => setToast(null),
    }),
    [payload, loading, mutating, error, toast, refresh, execute],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider.')
  return value
}
