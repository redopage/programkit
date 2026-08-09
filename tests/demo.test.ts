import { describe, expect, it } from 'vitest'

import {
  createDemoId,
  demoExpiresAt,
  demoIdFromPath,
  demoIdFromWorkspaceKey,
  demoLifetimeMs,
  demoWorkspaceKey,
  isDemoId,
} from '../apps/cloudflare/src/demo.ts'

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
