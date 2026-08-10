import { describe, expect, it, vi } from 'vitest'

import {
  createProgramKitHttpClient,
  externalAccessPath,
  parseSpeakerCsv,
  publicProgramPath,
  publicSubmissionPath,
  reviewerAccessPath,
  speakerPortalPath,
  speakerSubmissionsPath,
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
  it('adds the event capability to public links only on the hosted app', () => {
    const eventId = 'evt_1234567890abcdef12345678'
    expect(publicProgramPath(eventId, 'hosted-app')).toBe(
      '/agenda?event=evt_1234567890abcdef12345678',
    )
    expect(publicSubmissionPath(eventId, 'summer/cfp', 'hosted-app')).toBe(
      '/submit/summer%2Fcfp?event=evt_1234567890abcdef12345678',
    )
    expect(publicProgramPath(eventId, 'hosted-demo')).toBe('/agenda')
    expect(publicSubmissionPath(eventId, 'summer-cfp', 'single-workspace')).toBe(
      '/submit/summer-cfp',
    )
    expect(reviewerAccessPath(eventId, 'rev/1', 'key/1', 'hosted-app')).toBe(
      '/reviewer/rev%2F1/key%2F1?event=evt_1234567890abcdef12345678',
    )
    expect(speakerPortalPath(eventId, 'par/1', 'portal/1', 'hosted-app')).toBe(
      '/portal/par%2F1/portal%2F1?event=evt_1234567890abcdef12345678',
    )
    expect(speakerSubmissionsPath(eventId, 'summer/cfp', 'speaker/1', 'hosted-app')).toBe(
      '/submit/summer%2Fcfp/mine/speaker%2F1?event=evt_1234567890abcdef12345678',
    )
    expect(externalAccessPath(eventId, 'summer/cfp', 'hosted-app')).toBe(
      '/access?event=evt_1234567890abcdef12345678&form=summer%2Fcfp',
    )
    expect(externalAccessPath(eventId, undefined, 'single-workspace')).toBeNull()
  })

  it('maps deep links to explicit surfaces', () => {
    expect(surfaceFromPathname('/forms')).toEqual({ kind: 'operator' })
    expect(surfaceFromPathname('/submit/aie-nyc-2026-cfp')).toEqual({
      kind: 'submission',
      formSlug: 'aie-nyc-2026-cfp',
    })
    expect(surfaceFromPathname('/reviewer/rev_001/reviewer_elena')).toEqual({
      kind: 'reviewer',
      reviewerId: 'rev_001',
      reviewerAccessKey: 'reviewer_elena',
    })
    expect(surfaceFromPathname('/portal/par_003/portal_123')).toEqual({
      kind: 'speaker',
      participationId: 'par_003',
      portalAccessKey: 'portal_123',
    })
    expect(surfaceKey(surfaceFromPathname('/agenda'))).toBe('public-program')
  })

  it('parses the speaker fixture shape including quoted biographies', () => {
    expect(
      parseSpeakerCsv(
        'name,email,title,company,bio\nDana Kowalski,dana@example.com,Manager,Substrate,"Runs DX; ex-CI lead."',
      ),
    ).toEqual([
      {
        firstName: 'Dana',
        lastName: 'Kowalski',
        email: 'dana@example.com',
        title: 'Manager',
        company: 'Substrate',
        bio: 'Runs DX; ex-CI lead.',
      },
    ])
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

    await client.readSurface(
      { kind: 'reviewer', reviewerId: 'rev_001', reviewerAccessKey: 'reviewer_elena' },
      signal,
    )

    expect(fetch).toHaveBeenCalledOnce()
    expect(receivedInput).toBe('/public/v1/reviewers/rev_001/state')
    expect(receivedInit).toMatchObject({ signal })
    expect(new Headers(receivedInit?.headers).get('x-programkit-reviewer-key')).toBe(
      'reviewer_elena',
    )

    await client.readSurface(
      { kind: 'speaker', participationId: 'par_003', portalAccessKey: 'portal_123' },
      signal,
    )
    expect(receivedInput).toBe('/public/v1/portal/par_003/state')
    expect(new Headers(receivedInit?.headers).get('x-programkit-portal-key')).toBe('portal_123')
  })

  it('rejects operations that do not belong to a surface before fetching', async () => {
    const fetch = vi.fn(async () => Response.json({ ok: true }))
    const client = createProgramKitHttpClient({ fetch })

    await expect(
      client.execute({ kind: 'public-program' }, 'schedule.publish', {}),
    ).rejects.toThrow('is not available')
    await expect(
      client.execute(
        { kind: 'reviewer', reviewerId: 'rev_001', reviewerAccessKey: 'reviewer_elena' },
        'person.create',
        {},
      ),
    ).rejects.toThrow('is not available')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('preserves structured operation errors for field-level recovery', async () => {
    const response = {
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: 'Check the form and try again.',
        fields: { abstract: 'Abstract is required.' },
      },
      eventIds: [],
      warnings: [],
      approvalRequired: false,
      stateRevision: 1,
      traceId: 'trace_invalid_submission',
    }
    const fetch = vi.fn(async () => Response.json(response, { status: 400 }))
    const client = createProgramKitHttpClient({ fetch })

    await expect(
      client.execute({ kind: 'submission', formSlug: 'aie-nyc-2026-cfp' }, 'submission.create', {}),
    ).resolves.toEqual(response)
  })
})
