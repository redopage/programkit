import { describe, expect, it } from 'vitest'

import {
  createSeedState,
  handleCoreRequest,
  MemoryWorkspaceRepository,
  type OperationResponse,
  type WorkspaceState,
} from '@programkit/core'

describe('operation HTTP surface', () => {
  it('serves state, manifest, public agenda, and a portable export', async () => {
    const repository = new MemoryWorkspaceRepository()
    const stateResponse = await handleCoreRequest(
      new Request('http://local/api/v1/state'),
      repository,
    )
    expect(stateResponse?.status).toBe(200)
    const stateBody = (await stateResponse?.json()) as { state: { people: unknown[] } }
    expect(stateBody.state.people).toHaveLength(16)

    const manifestResponse = await handleCoreRequest(
      new Request('http://local/api/v1/manifest'),
      repository,
    )
    const manifestBody = (await manifestResponse?.json()) as { operations: unknown[] }
    expect(manifestBody.operations.length).toBeGreaterThan(10)

    const agendaResponse = await handleCoreRequest(
      new Request('http://local/public/agenda.json'),
      repository,
    )
    const agendaBody = (await agendaResponse?.json()) as { agenda: unknown[] }
    expect(agendaBody.agenda).toHaveLength(10)

    const exportResponse = await handleCoreRequest(
      new Request('http://local/api/v1/export'),
      repository,
    )
    expect(exportResponse?.headers.get('content-disposition')).toContain('aie-export-')
    expect(exportResponse?.headers.get('content-type')).toBe('application/zip')
    expect(new Uint8Array(await exportResponse!.arrayBuffer()).slice(0, 4)).toEqual(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]),
    )

    const jsonExportResponse = await handleCoreRequest(
      new Request('http://local/api/v1/export.json'),
      repository,
    )
    expect(jsonExportResponse?.headers.get('content-disposition')).toContain('aie-export.json')
  })

  it('serves portable public program feeds with filters and field visibility', async () => {
    const repository = new MemoryWorkspaceRepository()
    const jsonResponse = await handleCoreRequest(
      new Request('http://local/public/v1/program.json'),
      repository,
    )
    expect(jsonResponse?.status).toBe(200)
    expect(jsonResponse?.headers.get('content-type')).toBe('application/json; charset=utf-8')
    expect(jsonResponse?.headers.get('access-control-allow-origin')).toBe('*')
    const jsonBody = (await jsonResponse?.json()) as {
      event: { id: string; publishedScheduleVersion: number }
      sessions: Array<{
        id: string
        description?: string
        room: { id: string } | null
        track: { id: string } | null
      }>
    }
    expect(jsonBody.event).toMatchObject({ id: 'evt_nyc_2026', publishedScheduleVersion: 3 })
    expect(jsonBody.sessions).toHaveLength(10)
    expect(jsonBody.sessions.every((session) => session.description)).toBe(true)

    const sample = jsonBody.sessions.find((session) => session.track && session.room)!

    const filteredResponse = await handleCoreRequest(
      new Request(
        `http://local/public/v1/program.json?track=${sample.track!.id}&room=${sample.room!.id}&descriptions=hide`,
      ),
      repository,
    )
    const filteredBody = (await filteredResponse?.json()) as typeof jsonBody
    expect(filteredBody.sessions.length).toBeGreaterThan(0)
    expect(filteredBody.sessions.every((session) => session.track?.id === sample.track!.id)).toBe(
      true,
    )
    expect(filteredBody.sessions.every((session) => session.room?.id === sample.room!.id)).toBe(
      true,
    )
    expect(filteredBody.sessions.every((session) => !('description' in session))).toBe(true)

    const xmlResponse = await handleCoreRequest(
      new Request('http://local/public/v1/program.xml?track=trk_build'),
      repository,
    )
    expect(xmlResponse?.headers.get('content-type')).toBe('application/xml; charset=utf-8')
    const xml = await xmlResponse!.text()
    expect(xml).toContain('<program eventId="evt_nyc_2026" version="3">')
    expect(xml).toContain('<track id="trk_build"')
    expect(xml).toContain('<speakers>')

    const calendarResponse = await handleCoreRequest(
      new Request('http://local/public/v1/program.ics'),
      repository,
    )
    expect(calendarResponse?.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(calendarResponse?.headers.get('content-disposition')).toContain(
      'aie-nyc-2026-program.ics',
    )
    const calendar = await calendarResponse!.text()
    expect(calendar).toContain('BEGIN:VCALENDAR\r\n')
    expect(calendar.match(/BEGIN:VEVENT/gu)).toHaveLength(10)
    expect(calendar).toContain('LOCATION:')

    const optionsResponse = await handleCoreRequest(
      new Request('http://local/public/v1/program.json', { method: 'OPTIONS' }),
      repository,
    )
    expect(optionsResponse?.status).toBe(204)
    expect(optionsResponse?.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('serves event-scoped, paginated integration resources', async () => {
    const repository = new MemoryWorkspaceRepository()

    const eventsResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events?pageSize=1'),
      repository,
    )
    expect(eventsResponse?.status).toBe(200)
    expect(await eventsResponse?.json()).toMatchObject({
      data: [{ id: 'evt_nyc_2026' }],
      pagination: { currentPage: 1, pageSize: 1, totalPages: 1, totalResults: 1 },
    })

    const sessionsResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events/evt_nyc_2026/sessions?status=ready&pageSize=3'),
      repository,
    )
    expect(sessionsResponse?.status).toBe(200)
    const sessionsBody = (await sessionsResponse?.json()) as {
      data: Array<{ eventId: string; status: string }>
      pagination: { pageSize: number; totalResults: number }
    }
    expect(sessionsBody.data).toHaveLength(3)
    expect(sessionsBody.data.every((entry) => entry.eventId === 'evt_nyc_2026')).toBe(true)
    expect(sessionsBody.data.every((entry) => entry.status === 'ready')).toBe(true)
    expect(sessionsBody.pagination.pageSize).toBe(3)
    expect(sessionsBody.pagination.totalResults).toBeGreaterThan(3)

    const speakersResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events/evt_nyc_2026/speakers?q=jordan'),
      repository,
    )
    const speakersBody = (await speakersResponse?.json()) as {
      data: Array<{ firstName: string; email: string }>
      pagination: { totalResults: number }
    }
    expect(speakersBody.pagination.totalResults).toBe(1)
    expect(speakersBody.data[0]).toMatchObject({
      firstName: 'Jordan',
      email: 'jordan@commonthread.org',
    })

    const submissionsResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events/evt_nyc_2026/submissions?status=accepted'),
      repository,
    )
    const submissionsBody = (await submissionsResponse?.json()) as {
      data: Array<{ eventId: string; status: string }>
    }
    expect(submissionsBody.data.length).toBeGreaterThan(0)
    expect(submissionsBody.data.every((entry) => entry.status === 'accepted')).toBe(true)

    const domainEventsResponse = await handleCoreRequest(
      new Request('http://local/api/v1/domain-events?limit=2'),
      repository,
    )
    const domainEventsBody = (await domainEventsResponse?.json()) as { events: unknown[] }
    expect(domainEventsBody.events.length).toBeLessThanOrEqual(2)

    const deniedResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events/evt_nyc_2026/sessions'),
      repository,
      { actor: { type: 'service', id: 'limited', name: 'Limited integration', scopes: [] } },
    )
    expect(deniedResponse?.status).toBe(403)

    const missingEventResponse = await handleCoreRequest(
      new Request('http://local/api/v1/events/missing/sessions'),
      repository,
    )
    expect(missingEventResponse?.status).toBe(404)
  })

  it('returns a participant-specific projection without operator-only records', async () => {
    const initial = createSeedState()
    initial.portalResourcePages.push({
      id: 'res_draft_only',
      eventId: initial.activeEventId,
      title: 'Internal draft',
      slug: 'internal-draft',
      summary: 'Not ready for speakers.',
      body: '',
      embedUrl: '',
      linkUrl: '',
      status: 'draft',
      sortOrder: 99,
      updatedAt: '2026-08-09T12:00:00.000Z',
      version: 1,
    })
    const repository = new MemoryWorkspaceRepository(initial)
    const actor = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['participations:write', 'requirements:write', 'portal:write'],
    }
    const response = await handleCoreRequest(
      new Request('http://local/public/v1/portal/par_003/state', {
        headers: { 'x-programkit-portal-key': 'portal_003_per_003' },
      }),
      repository,
      { actor },
    )
    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    expect(body.state.people).toHaveLength(1)
    expect(body.state.participations).toHaveLength(1)
    expect(body.state.participations[0].internalNotes).toBe('')
    expect(body.state.campaigns).toHaveLength(0)
    expect(body.state.outboundMessages).toHaveLength(0)
    expect(body.state.integrations).toHaveLength(0)
    expect(body.state.changeSets).toHaveLength(0)
    expect(body.state.domainEvents).toHaveLength(0)
    expect(body.state.submissions).toHaveLength(0)
    expect(body.state.sessions.length).toBeGreaterThan(0)
    expect(body.state.sessions.every((session) => session.participantIds.includes('par_003'))).toBe(
      true,
    )
    expect(body.state.reviewers).toHaveLength(0)
    expect(body.state.reviewerAssignments).toHaveLength(0)
    expect(body.state.scorecards).toHaveLength(0)
    expect(body.state.reviewDecisions).toHaveLength(0)
    expect(body.state.portalResourcePages.map((resource) => resource.id)).toEqual([
      'res_speaker_guide',
      'res_venue_guide',
    ])

    const denied = await handleCoreRequest(
      new Request('http://local/public/v1/portal/par_003/state', {
        headers: { 'x-programkit-portal-key': 'wrong-key' },
      }),
      repository,
      { actor },
    )
    expect(denied?.status).toBe(403)
  })

  it('serves distinct public and reviewer projections without operator records', async () => {
    const repository = new MemoryWorkspaceRepository()

    const formResponse = await handleCoreRequest(
      new Request('http://local/public/v1/submission-forms/aie-nyc-2026-cfp/state'),
      repository,
    )
    expect(formResponse?.status).toBe(200)
    const formBody = (await formResponse?.json()) as { state: WorkspaceState }
    expect(formBody.state.submissionForms.map((entry) => entry.id)).toEqual(['frm_cfp_2026'])
    expect(formBody.state.submissionFormFields.length).toBeGreaterThan(5)
    expect(formBody.state.tracks.map((entry) => entry.name)).toEqual([
      'Frontier',
      'Build',
      'Operate',
      'Society',
    ])
    expect(formBody.state.people).toHaveLength(0)
    expect(formBody.state.submissions).toHaveLength(0)
    expect(formBody.state.reviewerAssignments).toHaveLength(0)
    expect(formBody.state.domainEvents).toHaveLength(0)

    const closedState = createSeedState()
    closedState.submissionForms.find((entry) => entry.id === 'frm_cfp_2026')!.status = 'closed'
    const closedFormResponse = await handleCoreRequest(
      new Request('http://local/public/v1/submission-forms/aie-nyc-2026-cfp/state'),
      new MemoryWorkspaceRepository(closedState),
    )
    expect(closedFormResponse?.status).toBe(200)
    const closedFormBody = (await closedFormResponse?.json()) as { state: WorkspaceState }
    expect(closedFormBody.state.submissionForms).toEqual([
      expect.objectContaining({ id: 'frm_cfp_2026', status: 'closed' }),
    ])

    const programResponse = await handleCoreRequest(
      new Request('http://local/public/v1/program/state'),
      repository,
    )
    expect(programResponse?.status).toBe(200)
    const programBody = (await programResponse?.json()) as { state: WorkspaceState }
    expect(programBody.state.scheduleReleases).toHaveLength(1)
    expect(programBody.state.placements).toHaveLength(0)
    expect(programBody.state.submissions).toHaveLength(0)
    expect(programBody.state.campaigns).toHaveLength(0)
    expect(programBody.state.outboundMessages).toHaveLength(0)
    expect(programBody.state.people.every((entry) => entry.email === '')).toBe(true)
    expect(programBody.state.participations.every((entry) => entry.internalNotes === '')).toBe(true)

    const reviewerResponse = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/state', {
        headers: { 'x-programkit-reviewer-key': 'reviewer_elena_vasquez' },
      }),
      repository,
      {
        actor: {
          type: 'reviewer',
          id: 'rev_001',
          name: 'Elena Vasquez',
          scopes: ['reviews:write'],
        },
      },
    )
    expect(reviewerResponse?.status).toBe(200)
    const reviewerBody = (await reviewerResponse?.json()) as { state: WorkspaceState }
    expect(reviewerBody.state.reviewers.map((entry) => entry.id)).toEqual(['rev_001'])
    expect(
      reviewerBody.state.reviewerAssignments.every((entry) => entry.reviewerId === 'rev_001'),
    ).toBe(true)
    expect(reviewerBody.state.people).toHaveLength(0)
    expect(reviewerBody.state.participations).toHaveLength(0)
    expect(reviewerBody.state.reviewDecisions).toHaveLength(0)
    expect(reviewerBody.state.campaigns).toHaveLength(0)
    expect(reviewerBody.state.outboundMessages).toHaveLength(0)
    expect(reviewerBody.state.domainEvents).toHaveLength(0)
  })

  it('redacts identity-purpose answers from blind reviewer projections', async () => {
    const state = createSeedState()
    state.evaluationPlans = state.evaluationPlans.map((plan) => ({
      ...plan,
      blindReview: true,
    }))
    const repository = new MemoryWorkspaceRepository(state)
    const response = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/state', {
        headers: { 'x-programkit-reviewer-key': 'reviewer_elena_vasquez' },
      }),
      repository,
      {
        actor: {
          type: 'reviewer',
          id: 'rev_001',
          name: 'Elena Vasquez',
          scopes: ['reviews:write'],
        },
      },
    )
    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    expect(body.state.submissions.length).toBeGreaterThan(0)
    for (const submission of body.state.submissions) {
      expect(submission.answers.first_name).toBeUndefined()
      expect(submission.answers.last_name).toBeUndefined()
      expect(submission.answers.email).toBeUndefined()
      expect(submission.answers.biography).toBeUndefined()
      expect(submission.answers.proposal_title).toBeTruthy()
      expect(submission.contributors).toEqual([])
    }
  })

  it('reveals identity when the same reviewer has a non-blind round for the proposal', async () => {
    const state = createSeedState()
    const plan = state.evaluationPlans[0]!
    plan.blindReview = true
    plan.rounds[0] = { ...plan.rounds[0]!, blindReview: true }
    plan.rounds.push({
      ...plan.rounds[0]!,
      id: 'rnd_final_review',
      name: 'Final review',
      order: 2,
      blindReview: false,
    })
    const initialAssignment = state.reviewerAssignments.find(
      (entry) => entry.reviewerId === 'rev_001' && entry.submissionId === 'sub_002',
    )!
    state.reviewerAssignments.push({
      ...initialAssignment,
      id: 'rva_final_visible',
      roundId: 'rnd_final_review',
      status: 'assigned',
      version: 1,
    })

    const response = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/state', {
        headers: { 'x-programkit-reviewer-key': 'reviewer_elena_vasquez' },
      }),
      new MemoryWorkspaceRepository(state),
      {
        actor: {
          type: 'reviewer',
          id: 'rev_001',
          name: 'Elena Vasquez',
          scopes: ['reviews:write'],
        },
      },
    )

    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    const submission = body.state.submissions.find((entry) => entry.id === 'sub_002')!
    expect(submission.answers.first_name).toBeTruthy()
    expect(submission.answers.last_name).toBeTruthy()
    expect(submission.answers.email).toBeTruthy()
  })

  it('requires a reviewer capability and permits conflict handling', async () => {
    const repository = new MemoryWorkspaceRepository()
    const actor = {
      type: 'reviewer' as const,
      id: 'rev_001',
      name: 'Elena Vasquez',
      scopes: ['reviews:write'],
    }
    const denied = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/state', {
        headers: { 'x-programkit-reviewer-key': 'wrong-key' },
      }),
      repository,
      { actor },
    )
    expect(denied?.status).toBe(403)

    const assignment = (await repository.read()).reviewerAssignments.find(
      (entry) => entry.id === 'rva_007',
    )!
    const recused = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/operations/review.recuse', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-programkit-reviewer-key': 'reviewer_elena_vasquez',
        },
        body: JSON.stringify({
          input: { assignmentId: assignment.id, reason: 'I work with the submitter.' },
          expectedVersions: { [assignment.id]: assignment.version },
        }),
      }),
      repository,
      { actor },
    )
    expect(recused?.status).toBe(200)
    expect((await repository.read()).reviewerAssignments).toContainEqual(
      expect.objectContaining({
        id: assignment.id,
        status: 'recused',
        conflictReason: 'I work with the submitter.',
      }),
    )
  })

  it('serves a private speaker submission history without exposing another speaker', async () => {
    const repository = new MemoryWorkspaceRepository()
    const response = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/state?speakerAccessKey=speaker_priya_raman',
      ),
      repository,
    )
    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    expect(body.state.submissions.map((entry) => entry.id)).toEqual(['sub_005'])
    expect(body.state.submissions[0]).toMatchObject({
      speakerAccessKey: 'speaker_priya_raman',
      contributors: [
        expect.objectContaining({
          firstName: 'Marcus',
          lastName: 'Okafor',
          role: 'co_speaker',
        }),
      ],
    })
    expect(body.state.assets).toEqual([])
    expect(body.state.people).toEqual([])
  })

  it('creates and resumes a title-only draft through the public submission boundary', async () => {
    const repository = new MemoryWorkspaceRepository()
    const actor = {
      type: 'submitter' as const,
      id: 'aie-nyc-2026-cfp',
      name: 'Public submitter',
      scopes: ['submissions:write', 'submissions:submit'],
    }
    const created = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations/submission.create',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: {
              formId: 'frm_cfp_2026',
              kind: 'abstract',
              answers: { proposal_title: 'A private title-only draft' },
              contributors: [],
              speakerAccessKey: 'speaker_priya_raman',
            },
          }),
        },
      ),
      repository,
      { actor },
    )
    expect(created?.status).toBe(200)
    const createdBody = (await created?.json()) as OperationResponse
    const draft = (createdBody.data as { submission: { id: string; speakerAccessKey: string } })
      .submission

    const privateState = await handleCoreRequest(
      new Request(
        `http://local/public/v1/submission-forms/aie-nyc-2026-cfp/state?speakerAccessKey=${draft.speakerAccessKey}`,
      ),
      repository,
    )
    const privateBody = (await privateState?.json()) as { state: WorkspaceState }
    expect(privateBody.state.submissions).toContainEqual(
      expect.objectContaining({
        id: draft.id,
        status: 'draft',
        answers: { proposal_title: 'A private title-only draft' },
      }),
    )

    const persistedDraft = (await repository.read()).submissions.find(
      (entry) => entry.id === draft.id,
    )!
    const updated = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations/submission.update',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: {
              submissionId: draft.id,
              speakerAccessKey: draft.speakerAccessKey,
              answers: {
                ...persistedDraft.answers,
                email: 'priya@craftwork.dev',
              },
            },
            expectedVersions: { [draft.id]: persistedDraft.version },
          }),
        },
      ),
      repository,
      { actor },
    )
    expect(updated?.status).toBe(200)
    expect(
      (await repository.read()).submissions.find((entry) => entry.id === draft.id)?.answers,
    ).toMatchObject({ email: 'priya@craftwork.dev' })
  })

  it('enforces public-form and reviewer operation boundaries', async () => {
    const repository = new MemoryWorkspaceRepository()
    const submitter = {
      type: 'submitter' as const,
      id: 'aie-nyc-2026-cfp',
      name: 'Public submitter',
      scopes: ['submissions:write', 'submissions:submit'],
    }
    const crossFormResponse = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations/submission.create',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: { formId: 'frm_guaranteed_2026', kind: 'guaranteed_session', answers: {} },
          }),
        },
      ),
      repository,
      { actor: submitter },
    )
    expect(crossFormResponse?.status).toBe(400)

    const current = await repository.read()
    const priya = current.submissions.find((entry) => entry.id === 'sub_005')!
    const wrongSpeakerResponse = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations/submission.update',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            input: {
              submissionId: priya.id,
              speakerAccessKey: 'wrong-speaker-key',
              contributors: [],
            },
            expectedVersions: { [priya.id]: priya.version },
          }),
        },
      ),
      repository,
      { actor: submitter },
    )
    expect(wrongSpeakerResponse?.status).toBe(400)
    expect(await wrongSpeakerResponse?.json()).toEqual({
      error: 'This speaker link cannot update that submission.',
    })

    const disallowedResponse = await handleCoreRequest(
      new Request(
        'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations/person.create',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: {} }),
        },
      ),
      repository,
      { actor: submitter },
    )
    expect(disallowedResponse?.status).toBe(403)

    const state = await repository.read()
    const foreignAssignment = state.reviewerAssignments.find(
      (entry) => entry.reviewerId !== 'rev_001',
    )!
    const plan = state.evaluationPlans.find(
      (entry) => entry.id === foreignAssignment.evaluationPlanId,
    )!
    const reviewerResponse = await handleCoreRequest(
      new Request('http://local/public/v1/reviewers/rev_001/operations/review.submit-scorecard', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-programkit-reviewer-key': 'reviewer_elena_vasquez',
        },
        body: JSON.stringify({
          input: {
            assignmentId: foreignAssignment.id,
            scores: Object.fromEntries(plan.criteria.map((entry) => [entry.id, entry.maximum])),
            recommendation: 'accept',
          },
        }),
      }),
      repository,
      {
        actor: {
          type: 'reviewer',
          id: 'rev_001',
          name: 'Elena Vasquez',
          scopes: ['reviews:write'],
        },
      },
    )
    expect(reviewerResponse?.status).toBe(400)
    const reviewerBody = (await reviewerResponse?.json()) as OperationResponse
    expect(reviewerBody.error?.code).toBe('FORBIDDEN')
  })

  it('ignores caller-supplied actors and uses the trusted request context', async () => {
    const repository = new MemoryWorkspaceRepository()
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/operations/workspace.reset-demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: {},
          actor: { type: 'staff', id: 'forged', name: 'Forged', scopes: ['*'] },
        }),
      }),
      repository,
      {
        actor: {
          type: 'participant',
          id: 'par_003',
          name: 'Participant',
          scopes: ['portal:write'],
        },
      },
    )
    expect(response?.status).toBe(403)
    expect(await response?.json()).toMatchObject({
      error: 'This actor cannot use operator operations.',
    })
    expect((await repository.read()).workspace.slug).toBe('aie')
  })

  it('serializes concurrent mutations through the repository boundary', async () => {
    const repository = new MemoryWorkspaceRepository()
    const create = (firstName: string, email: string) =>
      handleCoreRequest(
        new Request('http://local/api/v1/operations/person.create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: { firstName, lastName: 'Concurrent', email } }),
        }),
        repository,
      )
    await Promise.all([
      create('First', 'first.concurrent@example.com'),
      create('Second', 'second.concurrent@example.com'),
    ])
    const state = await repository.read()
    expect(state.people.some((person) => person.email === 'first.concurrent@example.com')).toBe(
      true,
    )
    expect(state.people.some((person) => person.email === 'second.concurrent@example.com')).toBe(
      true,
    )
  })

  it('rejects declared oversized requests before buffering them', async () => {
    const repository = new MemoryWorkspaceRepository()
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/operations/person.create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '200000',
        },
        body: JSON.stringify({ input: {} }),
      }),
      repository,
    )
    expect(response?.status).toBe(400)
    expect(await response?.json()).toMatchObject({ error: 'Request body is too large.' })
  })
})
