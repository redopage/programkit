import { describe, expect, it } from 'vitest'

import { WorkspaceDurableObject } from '@programkit/core/cloudflare'

import {
  createDemoId,
  demoExpiresAt,
  demoIdFromPath,
  demoIdFromWorkspaceKey,
  demoLifetimeMs,
  demoWorkspaceKey,
  isDemoId,
} from '../apps/cloudflare/src/demo.ts'
import { MemoryStorage } from './support/cloudflare-workers.ts'

describe('demo capabilities', () => {
  it('creates an unguessable path-safe identifier', () => {
    const id = createDemoId()
    expect(id).toMatch(/^[a-f0-9]{48}$/u)
    expect(createDemoId()).not.toBe(id)
    expect(demoWorkspaceKey(id)).toBe(`demo_${id}`)
    expect(demoIdFromWorkspaceKey(`demo_${id}`)).toBe(id)
  })

  it('accepts only exact demo paths and identifiers', () => {
    const id = 'a'.repeat(48)
    expect(isDemoId(id)).toBe(true)
    expect(demoIdFromPath(`/demo/${id}`)).toBe(id)
    expect(demoIdFromPath(`/demo/${id}/`)).toBe(id)
    expect(demoIdFromPath(`/demo/${id}/settings`)).toBeNull()
    expect(isDemoId('demo')).toBe(false)
    expect(demoIdFromWorkspaceKey('demo_not-a-capability')).toBeNull()
  })

  it('uses a seven-day lifetime', () => {
    const now = Date.UTC(2026, 7, 9, 12)
    expect(Date.parse(demoExpiresAt(now)) - now).toBe(demoLifetimeMs)
  })
})

describe('demo response caching', () => {
  it('prevents an expired workspace response from becoming a sticky browser error', async () => {
    const storage = new MemoryStorage()
    storage.values.set('programkit-demo:metadata', {
      id: 'a'.repeat(48),
      createdAt: '2000-01-01T00:00:00.000Z',
      expiresAt: '2000-01-08T00:00:00.000Z',
    })
    const workspace = new WorkspaceDurableObject(
      { storage } as unknown as DurableObjectState,
      {} as Cloudflare.Env,
    )

    const response = await workspace.fetch(new Request('http://workspace.internal/api/v1/state'))

    expect(response.status).toBe(410)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
