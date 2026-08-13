import { describe, expect, it } from 'vitest'

import { createSeedState, type OperationResponse, type WorkspaceState } from '@programkit/core'

import { assetStorageDisposition, deleteStoredAsset } from '../apps/cloudflare/src/worker.ts'

type LifecycleAsset = WorkspaceState['assets'][number]

function operationResponse(
  state: WorkspaceState,
  data: Record<string, unknown>,
): OperationResponse {
  return {
    ok: true,
    data,
    eventIds: [`dev_${state.revision}`],
    warnings: [],
    approvalRequired: false,
    stateRevision: state.revision,
    traceId: `trace_${state.revision}`,
  }
}

function lifecycleHarness(options: { unsafeKey?: boolean; failDeleteOnce?: boolean } = {}) {
  const state = createSeedState()
  const asset = state.assets.find((entry) => entry.id === 'ast_headshot_robin_v2') as LifecycleAsset
  asset.storageKey = options.unsafeKey
    ? 'another-event/private/file.png'
    : `${state.activeEventId}/deliverables/${asset.owner.id}/${asset.filename}`
  const operations: string[] = []
  const actors: Array<{ type: string | null; id: string | null }> = []
  const deletedKeys: string[] = []
  let failDelete = options.failDeleteOnce ?? false

  const stub = {
    async fetch(request: Request) {
      const url = new URL(request.url)
      if (request.method === 'GET' && url.pathname === '/api/v1/state') {
        return Response.json({ state })
      }
      const operation = decodeURIComponent(url.pathname.split('/').at(-1) ?? '')
      operations.push(operation)
      actors.push({
        type: request.headers.get('x-programkit-internal-actor-type'),
        id: request.headers.get('x-programkit-internal-actor-id'),
      })
      if (operation === 'asset.delete') {
        const body = (await request.json()) as { input: { reason: string } }
        asset.deletedAt = '2026-08-12T12:00:00.000Z'
        asset.deletedBy = { type: 'staff', id: 'owner_1', name: 'Event Owner' }
        asset.deletionReason = body.input.reason
        asset.deletionStatus = 'pending'
        asset.version = (asset.version ?? 1) + 1
        state.revision += 1
        return Response.json(operationResponse(state, { asset }))
      }
      if (operation === 'asset.confirm-deletion') {
        asset.deletionStatus = 'purged'
        asset.version = (asset.version ?? 1) + 1
        state.revision += 1
        return Response.json(operationResponse(state, { asset }))
      }
      return Response.json(
        { ok: false, error: { code: 'UNKNOWN', message: operation } },
        { status: 400 },
      )
    },
  }
  const bucket = {
    async delete(key: string) {
      if (failDelete) {
        failDelete = false
        throw new Error('R2 unavailable')
      }
      deletedKeys.push(key)
    },
  }
  const request = (reason = 'Uploaded by mistake.') =>
    new Request('https://app.programkit.dev/api/v1/operations/asset.delete', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        input: { assetId: asset.id, reason },
        expectedVersions: { [asset.id]: asset.version ?? 1 },
        idempotencyKey: 'delete-asset-once',
      }),
    })

  return { state, asset, operations, actors, deletedKeys, stub, bucket, request }
}

const owner = {
  type: 'staff' as const,
  id: 'owner_1',
  name: 'Event Owner',
  scopes: ['*'],
}

describe('asset storage lifecycle', () => {
  it('classifies only event-rooted keys as safe R2 deletion targets', () => {
    expect(assetStorageDisposition({ eventId: 'evt_a', storageKey: 'evt_a/files/one.pdf' })).toBe(
      'r2',
    )
    expect(
      assetStorageDisposition({ eventId: 'evt_a', storageKey: 'demo/deliverables/one.pdf' }),
    ).toBe('virtual-demo')
    expect(assetStorageDisposition({ eventId: 'evt_a', storageKey: 'evt_b/files/one.pdf' })).toBe(
      'unsafe',
    )
  })

  it('tombstones metadata, deletes R2 bytes, and durably confirms cleanup', async () => {
    const harness = lifecycleHarness()
    const response = await deleteStoredAsset(
      harness.request(),
      { PROGRAMKIT_FILES: harness.bucket as unknown as R2Bucket },
      harness.stub as never,
      owner,
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      data: { assetId: harness.asset.id, cleanupPending: false },
    })
    expect(harness.operations).toEqual(['asset.delete', 'asset.confirm-deletion'])
    expect(harness.deletedKeys).toEqual([harness.asset.storageKey])
    expect(harness.asset).toMatchObject({
      deletedBy: { id: 'owner_1', name: 'Event Owner' },
      deletionReason: 'Uploaded by mistake.',
      deletionStatus: 'purged',
    })
    expect(harness.actors).toEqual([
      { type: 'staff', id: 'owner_1' },
      { type: 'system', id: 'asset-storage-cleanup' },
    ])
  })

  it('keeps a hidden cleanup-pending tombstone when R2 is unavailable, then converges on retry', async () => {
    const harness = lifecycleHarness({ failDeleteOnce: true })
    const first = await deleteStoredAsset(
      harness.request(),
      { PROGRAMKIT_FILES: harness.bucket as unknown as R2Bucket },
      harness.stub as never,
      owner,
    )

    expect(first.status).toBe(503)
    await expect(first.json()).resolves.toMatchObject({
      ok: false,
      data: { assetId: harness.asset.id, cleanupPending: true },
      error: { code: 'ASSET_CLEANUP_PENDING' },
    })
    expect(harness.asset).toMatchObject({ deletionStatus: 'pending' })
    expect(harness.operations).toEqual(['asset.delete'])

    const retry = await deleteStoredAsset(
      harness.request(),
      { PROGRAMKIT_FILES: harness.bucket as unknown as R2Bucket },
      harness.stub as never,
      owner,
    )
    expect(retry.status).toBe(200)
    expect(harness.operations).toEqual(['asset.delete', 'asset.confirm-deletion'])
    expect(harness.deletedKeys).toEqual([harness.asset.storageKey])
    expect(harness.asset.deletionStatus).toBe('purged')
  })

  it('refuses an out-of-event storage key without mutating metadata or R2', async () => {
    const harness = lifecycleHarness({ unsafeKey: true })
    const response = await deleteStoredAsset(
      harness.request(),
      { PROGRAMKIT_FILES: harness.bucket as unknown as R2Bucket },
      harness.stub as never,
      owner,
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNSAFE_STORAGE_KEY' },
    })
    expect(harness.operations).toEqual([])
    expect(harness.deletedKeys).toEqual([])
    expect(harness.asset.deletedAt).toBeUndefined()
  })

  it('leaves an R2-backed file active when storage is not configured', async () => {
    const harness = lifecycleHarness()
    const response = await deleteStoredAsset(harness.request(), {}, harness.stub as never, owner)

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'STORAGE_UNAVAILABLE' },
    })
    expect(harness.operations).toEqual([])
    expect(harness.asset.deletedAt).toBeUndefined()
  })
})
