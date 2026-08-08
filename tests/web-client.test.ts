import { describe, expect, it, vi } from 'vitest'

import {
  createProgramKitHttpClient,
  surfaceFromPathname,
  surfaceKey,
  type WorkspacePayload,
} from '@programkit/web'

const emptyPayload = {
  state: {},
  derived: {
    readiness: {
      participants: 0,
      confirmed: 0,
      ready: 0,
      readinessPercent: 0,
      awaitingReview: 0,
      blockers: 0,
      unconfirmed: 0,
    },
    scheduleConflicts: [],
  },
} as unknown as WorkspacePayload

describe('ProgramKit web client', () => {
  it('maps deep links to explicit surfaces', () => {
    expect(surfaceFromPathname('/forms')).toEqual({ kind: 'operator' })
    expect(surfaceFromPathname('/submit/aie-nyc-2026-cfp')).toEqual({
      kind: 'submission',
      formSlug: 'aie-nyc-2026-cfp',
    })
    expect(surfaceFromPathname('/reviewer/rev_001')).toEqual({
      kind: 'reviewer',
      reviewerId: 'rev_001',
    })
    expect(surfaceFromPathname('/portal/par_003')).toEqual({
      kind: 'speaker',
      participationId: 'par_003',
    })
    expect(surfaceKey(surfaceFromPathname('/agenda'))).toBe('public-program')
  })

  it('uses the scoped endpoint selected by the surface', async () => {
    let receivedInput: RequestInfo | URL | undefined
    let receivedInit: RequestInit | undefined
    const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      receivedInput = input
      receivedInit = init
      return Response.json(emptyPayload)
    })
    const client = createProgramKitHttpClient({ fetch })
    const signal = new AbortController().signal

    await client.readSurface({ kind: 'reviewer', reviewerId: 'rev_001' }, signal)

    expect(fetch).toHaveBeenCalledOnce()
    expect(receivedInput).toBe('/api/v1/reviewers/rev_001/state')
    expect(receivedInit).toMatchObject({ signal })
  })

  it('rejects operations that do not belong to a surface before fetching', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true }))
    const client = createProgramKitHttpClient({ fetch })

    await expect(
      client.execute({ kind: 'public-program' }, 'schedule.publish', {}),
    ).rejects.toThrow('is not available')
    await expect(
      client.execute({ kind: 'reviewer', reviewerId: 'rev_001' }, 'person.create', {}),
    ).rejects.toThrow('is not available')
    expect(fetch).not.toHaveBeenCalled()
  })
})
