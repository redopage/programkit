import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouterState } from '@tanstack/react-router'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { OperationRequest, OperationResponse } from '@programkit/core'

import { useProgramKitClient } from '../client/context.tsx'
import { surfaceFromPathname, surfaceKey } from '../client/surfaces.ts'
import type { WorkspacePayload } from '../client/types.ts'

interface Toast {
  id: string
  tone: 'success' | 'error' | 'info'
  message: string
}

interface ExecuteInput {
  operation: string
  input: Record<string, unknown>
  options?: Omit<OperationRequest, 'input'>
}

interface WorkspaceContextValue {
  payload: WorkspacePayload | null
  loading: boolean
  refreshing: boolean
  mutating: boolean
  error: string | null
  toast: Toast | null
  refresh: (options?: { silent?: boolean }) => Promise<void>
  execute: (
    operation: string,
    input: Record<string, unknown>,
    options?: Omit<OperationRequest, 'input'>,
    successMessage?: string,
  ) => Promise<OperationResponse>
  uploadRequirementFile: (
    requirementInstanceId: string,
    file: File,
    successMessage?: string,
  ) => Promise<OperationResponse>
  assetUrl: (assetId: string) => string
  dismissToast: () => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const client = useProgramKitClient()
  const surface = useMemo(() => surfaceFromPathname(pathname), [pathname])
  const workspaceScope = surfaceKey(surface)
  const workspaceQueryKey = useMemo(() => ['workspace', workspaceScope] as const, [workspaceScope])
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<Toast | null>(null)

  const workspaceQuery = useQuery({
    queryKey: workspaceQueryKey,
    queryFn: ({ signal }) => client.readSurface(surface, signal),
  })
  const {
    data: workspacePayload,
    error: workspaceError,
    isFetching: workspaceRefreshing,
    isPending: workspaceLoading,
    refetch,
  } = workspaceQuery

  const operationMutation = useMutation({
    mutationFn: ({ operation, input, options }: ExecuteInput) =>
      client.execute(surface, operation, input, options),
  })
  const { isPending: workspaceMutating, mutateAsync } = operationMutation
  const assetMutation = useMutation({
    mutationFn: ({ requirementInstanceId, file }: { requirementInstanceId: string; file: File }) =>
      client.uploadRequirementFile(surface, requirementInstanceId, file),
  })
  const { isPending: assetUploading, mutateAsync: uploadAsync } = assetMutation

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const refresh = useCallback(async () => {
    await refetch()
  }, [refetch])

  const execute = useCallback(
    async (
      operation: string,
      input: Record<string, unknown>,
      options?: Omit<OperationRequest, 'input'>,
      successMessage?: string,
    ) => {
      try {
        const response = await mutateAsync({ operation, input, options })
        if (!response.ok) {
          setToast({
            id: crypto.randomUUID(),
            tone: 'error',
            message: response.error?.message ?? 'The action failed.',
          })
          return response
        }
        await queryClient.invalidateQueries({ queryKey: workspaceQueryKey, exact: true })
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
          stateRevision: workspacePayload?.state.revision ?? 0,
          traceId: crypto.randomUUID(),
        }
      }
    },
    [mutateAsync, queryClient, workspacePayload?.state.revision, workspaceQueryKey],
  )

  const uploadRequirementFile = useCallback(
    async (requirementInstanceId: string, file: File, successMessage?: string) => {
      try {
        const response = await uploadAsync({ requirementInstanceId, file })
        if (!response.ok) {
          setToast({
            id: crypto.randomUUID(),
            tone: 'error',
            message: response.error?.message ?? 'The file could not be uploaded.',
          })
          return response
        }
        await queryClient.invalidateQueries({ queryKey: workspaceQueryKey, exact: true })
        setToast({
          id: crypto.randomUUID(),
          tone: 'success',
          message: successMessage ?? 'File submitted for review.',
        })
        return response
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : 'The file could not be uploaded.'
        setToast({ id: crypto.randomUUID(), tone: 'error', message })
        return {
          ok: false,
          error: { code: 'REQUEST_FAILED', message },
          eventIds: [],
          warnings: [],
          approvalRequired: false,
          stateRevision: workspacePayload?.state.revision ?? 0,
          traceId: crypto.randomUUID(),
        }
      }
    },
    [queryClient, uploadAsync, workspacePayload?.state.revision, workspaceQueryKey],
  )

  const assetUrl = useCallback(
    (assetId: string) => client.assetUrl(surface, assetId),
    [client, surface],
  )

  const error = workspaceError
    ? workspaceError instanceof Error
      ? workspaceError.message
      : 'The workspace could not be loaded.'
    : null
  const value = useMemo(
    () => ({
      payload: workspacePayload ?? null,
      loading: workspaceLoading,
      refreshing: workspaceRefreshing,
      mutating: workspaceMutating || assetUploading,
      error,
      toast,
      refresh,
      execute,
      uploadRequirementFile,
      assetUrl,
      dismissToast: () => setToast(null),
    }),
    [
      workspacePayload,
      workspaceLoading,
      workspaceRefreshing,
      workspaceMutating,
      assetUploading,
      error,
      toast,
      refresh,
      execute,
      uploadRequirementFile,
      assetUrl,
    ],
  )

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace must be used inside WorkspaceProvider.')
  return value
}
