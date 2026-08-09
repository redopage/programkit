import { describe, expect, it } from 'vitest'

import {
  createSeedState,
  executeOperation,
  handleCoreRequest,
  MemoryWorkspaceRepository,
  type OperationResponse,
  type WorkspaceState,
} from '@programkit/core'

describe('operation HTTP surface', () => {
  it('normalizes a persisted pre-outbox workspace before serving it', async () => {
    const legacy = createSeedState()
    legacy.schemaVersion = 4
    delete (legacy as Partial<WorkspaceState>).campaignDeliveries
    delete (legacy as Partial<WorkspaceState>).submissionReceiptDeliveries
    delete (legacy as Partial<WorkspaceState>).acceleventsExports
    delete (legacy as Partial<WorkspaceState>).portalResources
    for (const campaign of legacy.campaigns) {
      delete (campaign as Partial<typeof campaign>).includeEventInvite
      delete (campaign as Partial<typeof campaign>).queuedAt
    }
    const state = await new MemoryWorkspaceRepository(legacy).read()
    expect(state.schemaVersion).toBe(8)
    expect(state.campaignDeliveries).toEqual([])
    expect(state.submissionReceiptDeliveries).toEqual([])
    expect(state.acceleventsExports).toEqual([])
    expect(state.portalResources).toEqual([])
    expect(state.campaigns.every((campaign) => campaign.includeEventInvite === false)).toBe(true)
    expect(state.campaigns.every((campaign) => campaign.queuedAt === null)).toBe(true)
  })

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

    const calendarResponse = await handleCoreRequest(
      new Request('http://local/public/v1/events/evt_nyc_2026/calendar.ics'),
      repository,
    )
    expect(calendarResponse?.status).toBe(200)
    expect(calendarResponse?.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(calendarResponse?.headers.get('content-disposition')).toContain(
      'aie-nyc-2026-invite.ics',
    )
    expect(await calendarResponse?.text()).toContain('BEGIN:VEVENT\r\n')

    const exportResponse = await handleCoreRequest(
      new Request('http://local/api/v1/export'),
      repository,
    )
    expect(exportResponse?.headers.get('content-disposition')).toContain('aie-export.json')
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
    const state = createSeedState()
    state.assets.push({
      id: 'ast_private_portal',
      eventId: state.activeEventId,
      owner: { type: 'participation', id: 'par_003' },
      kind: 'headshot',
      filename: 'private-headshot.png',
      contentType: 'image/png',
      sizeBytes: 1_024,
      storageKey: 'workspaces/wrk_aie/participants/par_003/private/private-headshot.png',
      createdAt: '2026-08-08T12:00:00.000Z',
    })
    const prepared = executeOperation(state, 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
    }).state
    const repository = new MemoryWorkspaceRepository(prepared)
    const actor = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['participations:write', 'requirements:write', 'portal:write'],
    }
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/portal/par_003/state'),
      repository,
      { actor },
    )
    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    expect(body.state.people).toHaveLength(1)
    expect(body.state.participations).toHaveLength(1)
    expect(body.state.participations[0].internalNotes).toBe('')
    expect(body.state.campaigns).toHaveLength(0)
    expect(body.state.campaignDeliveries).toHaveLength(0)
    expect(body.state.submissionReceiptDeliveries).toHaveLength(0)
    expect(body.state.integrations).toHaveLength(0)
    expect(body.state.acceleventsExports).toHaveLength(0)
    expect(body.state.changeSets).toHaveLength(0)
    expect(body.state.domainEvents).toHaveLength(0)
    expect(body.state.submissions).toHaveLength(0)
    expect(body.state.reviewers).toHaveLength(0)
    expect(body.state.reviewerAssignments).toHaveLength(0)
    expect(body.state.scorecards).toHaveLength(0)
    expect(body.state.reviewDecisions).toHaveLength(0)
    expect(body.state.assets).toEqual([
      expect.objectContaining({ id: 'ast_private_portal', storageKey: '' }),
    ])
    expect(body.state.portalResources.map((entry) => entry.id)).toEqual([
      'por_speaker_guide',
      'por_venue_card',
    ])
  })

  it('serves distinct public and reviewer projections without operator records', async () => {
    const prepared = executeOperation(createSeedState(), 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
    }).state
    const repository = new MemoryWorkspaceRepository(prepared)

    const formResponse = await handleCoreRequest(
      new Request('http://local/public/v1/submission-forms/aie-nyc-2026-cfp/state'),
      repository,
    )
    expect(formResponse?.status).toBe(200)
    const formBody = (await formResponse?.json()) as { state: WorkspaceState }
    expect(formBody.state.submissionForms.map((entry) => entry.id)).toEqual(['frm_cfp_2026'])
    expect(formBody.state.submissionFormFields.length).toBeGreaterThan(5)
    expect(formBody.state.people).toHaveLength(0)
    expect(formBody.state.submissions).toHaveLength(0)
    expect(formBody.state.submissionReceiptDeliveries).toHaveLength(0)
    expect(formBody.state.reviewerAssignments).toHaveLength(0)
    expect(formBody.state.domainEvents).toHaveLength(0)
    expect(formBody.state.acceleventsExports).toHaveLength(0)
    expect(formBody.state.portalResources).toHaveLength(0)

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
    expect(programBody.state.campaignDeliveries).toHaveLength(0)
    expect(programBody.state.submissionReceiptDeliveries).toHaveLength(0)
    expect(programBody.state.acceleventsExports).toHaveLength(0)
    expect(programBody.state.portalResources).toHaveLength(0)
    expect(programBody.state.people.every((entry) => entry.email === '')).toBe(true)
    expect(programBody.state.participations.every((entry) => entry.internalNotes === '')).toBe(true)

    const reviewerResponse = await handleCoreRequest(
      new Request('http://local/api/v1/reviewers/rev_001/state'),
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
    expect(reviewerBody.state.campaignDeliveries).toHaveLength(0)
    expect(reviewerBody.state.submissionReceiptDeliveries).toHaveLength(0)
    expect(reviewerBody.state.acceleventsExports).toHaveLength(0)
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
      new Request('http://local/api/v1/reviewers/rev_001/state'),
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
    }
  })

  it('returns the submitter-owned frozen receipt created with a public submission', async () => {
    const repository = new MemoryWorkspaceRepository()
    const submitter = {
      type: 'submitter' as const,
      id: 'aie-nyc-2026-cfp',
      name: 'Public submitter',
      scopes: ['submissions:write', 'submissions:submit'],
    }
    const operationUrl = 'http://local/public/v1/submission-forms/aie-nyc-2026-cfp/operations'
    const answers = {
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      job_title: 'Programmer',
      biography: 'Ada writes precise notes about programmable systems.',
      proposal_title: 'Useful engines',
      abstract: 'A practical session about systems people can inspect and understand.',
      session_format: 'talk',
      track: 'trk_build',
    }
    const createResponse = await handleCoreRequest(
      new Request(`${operationUrl}/submission.create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { formId: 'frm_cfp_2026', kind: 'abstract', answers } }),
      }),
      repository,
      { actor: submitter },
    )
    const createBody = (await createResponse?.json()) as OperationResponse<{
      submission: { id: string }
    }>
    expect(createBody.ok).toBe(true)

    const submitResponse = await handleCoreRequest(
      new Request(`${operationUrl}/submission.submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: { submissionId: createBody.data?.submission.id } }),
      }),
      repository,
      { actor: submitter },
    )
    const submitBody = (await submitResponse?.json()) as OperationResponse<{
      receiptDelivery: {
        id: string
        submissionId: string
        recipientEmail: string
        status: string
        body: string
      }
    }>
    expect(submitBody.ok).toBe(true)
    expect(submitBody.data?.receiptDelivery).toMatchObject({
      submissionId: createBody.data?.submission.id,
      recipientEmail: 'ada@example.com',
      status: 'pending_provider',
    })
    expect(submitBody.data?.receiptDelivery.body).toContain(
      `Reference: ${createBody.data?.submission.id}`,
    )
    expect((await repository.read()).submissionReceiptDeliveries).toHaveLength(2)
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
      new Request('http://local/api/v1/reviewers/rev_001/operations/review.submit-scorecard', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
