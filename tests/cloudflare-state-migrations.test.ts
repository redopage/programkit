import { describe, expect, it } from 'vitest'

import { WorkspaceDurableObject } from '@programkit/core/cloudflare'

import { createSeedState } from '../packages/core/src/seed.ts'
import type { WorkspaceState } from '../packages/core/src/types.ts'
import { MemoryStorage } from './support/cloudflare-workers.ts'

describe('Durable Object workspace migrations', () => {
  it('normalizes an older persisted workspace before serving it', async () => {
    const storage = new MemoryStorage()
    const legacy = createSeedState() as Partial<WorkspaceState>
    delete legacy.crmSegments
    delete legacy.speakerPipeline
    legacy.events![0]!.logoUrl = ''
    legacy.schemaVersion = 13
    storage.values.set('workspace-state', legacy)
    storage.values.set('workspace-state:normalized-version', 1)

    const workspace = new WorkspaceDurableObject(
      { storage } as unknown as DurableObjectState,
      {} as Cloudflare.Env,
    )
    const response = await workspace.fetch(
      new Request('http://workspace.internal/api/v1/state', {
        headers: {
          'x-programkit-internal-actor-type': 'staff',
          'x-programkit-internal-actor-id': 'staff_test',
          'x-programkit-internal-actor-name': 'Test organizer',
          'x-programkit-internal-actor-scopes': 'workspace:read',
        },
      }),
    )

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { state: WorkspaceState }
    expect(payload.state.schemaVersion).toBe(15)
    expect(payload.state.crmSegments).toEqual([])
    expect(payload.state.speakerPipeline).toEqual([])
    expect(payload.state.events[0]?.logoUrl).toBe('/assets/events/aie-monogram-black.svg')
    expect(storage.values.get('workspace-state:normalized-version')).toBe(2)
    expect(storage.values.has('workspace-state')).toBe(false)
  })
})
