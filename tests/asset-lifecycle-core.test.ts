import { describe, expect, it } from 'vitest'

import { createSeedState, createStoredAssetExportPlan, executeOperation } from '@programkit/core'

const eventOwner = {
  type: 'staff' as const,
  id: 'usr_owner',
  name: 'Event Owner',
  scopes: ['assets:delete'],
}

const cleanupService = {
  type: 'system' as const,
  id: 'asset-storage-cleanup',
  name: 'Asset storage cleanup',
  scopes: ['assets:purge'],
}

describe('asset lifecycle operations', () => {
  it('tombstones a file, restores the previous version, and retains an audit trail', () => {
    const state = createSeedState()
    const current = state.assets.find((asset) => asset.id === 'ast_headshot_robin_v2')!
    const previous = state.assets.find((asset) => asset.id === 'ast_headshot_robin_v1')!
    const requirement = state.requirementInstances.find(
      (instance) => instance.id === current.owner.id,
    )!

    const deleted = executeOperation(state, 'asset.delete', {
      input: { assetId: current.id, reason: 'The speaker uploaded this by mistake.' },
      expectedVersions: { [current.id]: current.version ?? 1 },
      actor: eventOwner,
    })

    expect(deleted.response.ok).toBe(true)
    expect(deleted.state.assets.find((asset) => asset.id === current.id)).toMatchObject({
      deletedAt: expect.any(String),
      deletedBy: { type: 'staff', id: eventOwner.id, name: eventOwner.name },
      deletionReason: 'The speaker uploaded this by mistake.',
      deletionStatus: 'pending',
      purgedAt: null,
      isLatest: false,
    })
    expect(deleted.state.assets.find((asset) => asset.id === previous.id)?.isLatest).toBe(true)
    expect(
      deleted.state.requirementInstances.find((instance) => instance.id === requirement.id),
    ).toMatchObject({
      value: previous.id,
      status: 'submitted',
      reviewedAt: null,
    })
    expect(deleted.state.domainEvents.slice(-2).map((event) => event.type)).toEqual([
      'requirement.status-changed',
      'asset.deleted',
    ])
    expect(
      createStoredAssetExportPlan(deleted.state, new Set([current.id])).some(
        (entry) => entry.assetId === current.id,
      ),
    ).toBe(false)
  })

  it('records storage cleanup only for the trusted system actor', () => {
    const state = createSeedState()
    const current = state.assets.find((asset) => asset.id === 'ast_slides_cameron_v1')!
    const deleted = executeOperation(state, 'asset.delete', {
      input: { assetId: current.id },
      actor: eventOwner,
    })
    expect(deleted.response.ok).toBe(true)

    const denied = executeOperation(deleted.state, 'asset.confirm-deletion', {
      input: { assetId: current.id },
      actor: { ...eventOwner, scopes: ['*'] },
    })
    expect(denied.response.error?.code).toBe('FORBIDDEN')

    const confirmed = executeOperation(deleted.state, 'asset.confirm-deletion', {
      input: { assetId: current.id },
      actor: cleanupService,
    })
    expect(confirmed.response.ok).toBe(true)
    expect(confirmed.state.assets.find((asset) => asset.id === current.id)).toMatchObject({
      deletionStatus: 'purged',
      purgedAt: expect.any(String),
    })
    expect(confirmed.state.domainEvents.at(-1)?.type).toBe('asset.storage-purged')
  })

  it('blocks participants, stale deletion requests, and comments on tombstones', () => {
    const state = createSeedState()
    const current = state.assets.find((asset) => asset.id === 'ast_headshot_robin_v2')!

    const participant = executeOperation(state, 'asset.delete', {
      input: { assetId: current.id },
      actor: {
        type: 'participant',
        id: 'par_001',
        name: 'Robin Sloan',
        scopes: ['assets:delete'],
      },
    })
    expect(participant.response.error?.code).toBe('FORBIDDEN')

    const stale = executeOperation(state, 'asset.delete', {
      input: { assetId: current.id },
      expectedVersions: { [current.id]: (current.version ?? 1) + 1 },
      actor: eventOwner,
    })
    expect(stale.response.error?.code).toBe('STALE_WRITE')

    const deleted = executeOperation(state, 'asset.delete', {
      input: { assetId: current.id },
      actor: eventOwner,
    })
    const comment = executeOperation(deleted.state, 'asset.comment', {
      input: { assetId: current.id, body: 'Should not be accepted.' },
      actor: {
        type: 'participant',
        id: 'par_001',
        name: 'Robin Sloan',
        scopes: ['assets:write'],
      },
    })
    expect(comment.response.error?.code).toBe('INVALID_TRANSITION')
  })

  it('refuses to register metadata that could expose another event object key', () => {
    const state = createSeedState()
    const result = executeOperation(state, 'asset.register', {
      input: {
        ownerType: 'person',
        ownerId: 'per_003',
        kind: 'headshot',
        filename: 'cross-event.png',
        contentType: 'image/png',
        sizeBytes: 1_024,
        storageKey: 'evt_someone_else/people/per_003/cross-event.png',
      },
      actor: {
        type: 'staff',
        id: 'usr_owner',
        name: 'Event Owner',
        scopes: ['assets:write'],
      },
    })

    expect(result.response.error?.code).toBe('FORBIDDEN')
    expect(result.state).toBe(state)
  })
})
