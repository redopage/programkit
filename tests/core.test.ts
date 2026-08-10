import { describe, expect, it } from 'vitest'

import {
  calendarAttachmentForParticipation,
  createEmptyWorkspaceState,
  createSeedState,
  campaignPreview,
  executeOperation,
  nextActions,
  publicAgenda,
  readinessRows,
  readinessSummary,
  reviewerQueue,
  scheduleConflicts,
  submissionPipelineSummary,
  submissionFormAvailability,
  submissionFormPublishReadiness,
  submissionDecisionReadiness,
  submissionAnswerDisplayByPurpose,
  submissionReviewSummary,
  visibleSubmissionFormFields,
} from '@programkit/core'

describe('ProgramKit operation engine', () => {
  it('creates an isolated empty workspace for a new hosted event', () => {
    const state = createEmptyWorkspaceState({
      eventId: 'evt_new_event',
      eventName: 'Open Source Summit',
      eventSlug: 'open-source-summit',
      createdAt: '2026-08-09T12:00:00.000Z',
    })

    expect(state.activeEventId).toBe('evt_new_event')
    expect(state.workspace).toMatchObject({
      id: 'wrk_new_event',
      name: 'Open Source Summit team',
      slug: 'open-source-summit',
    })
    expect(state.events).toEqual([
      expect.objectContaining({
        id: 'evt_new_event',
        name: 'Open Source Summit',
        status: 'planning',
        publishedScheduleVersion: null,
      }),
    ])
    expect(state.people).toEqual([])
    expect(state.submissions).toEqual([])
    expect(state.sessions).toEqual([])
    expect(state.changeSets).toEqual([])
    expect(state.domainEvents).toEqual([
      expect.objectContaining({ type: 'workspace.created', data: { eventId: 'evt_new_event' } }),
    ])
  })

  it('provisions a hosted event with its chosen dates and location', () => {
    const state = createEmptyWorkspaceState({
      eventId: 'evt_devflow_2027',
      eventName: 'DevFlow Conf 2027',
      eventSlug: 'devflow-conf-2027',
      createdAt: '2026-08-10T12:00:00.000Z',
      startsAt: '2027-05-12T16:00:00.000Z',
      endsAt: '2027-05-15T00:00:00.000Z',
      timezone: 'America/Los_Angeles',
      venue: 'Moscone West',
      city: 'San Francisco',
    })

    expect(state.workspace.timezone).toBe('America/Los_Angeles')
    expect(state.events[0]).toMatchObject({
      name: 'DevFlow Conf 2027',
      startsAt: '2027-05-12T16:00:00.000Z',
      endsAt: '2027-05-15T00:00:00.000Z',
      timezone: 'America/Los_Angeles',
      venue: 'Moscone West',
      city: 'San Francisco',
    })
  })

  it('creates a useful deterministic workspace', () => {
    const state = createSeedState()
    expect(state.people).toHaveLength(16)
    expect(state.participations).toHaveLength(16)
    expect(state.sessions).toHaveLength(10)
    expect(state.scheduleReleases).toHaveLength(1)
    expect(state.events[0].publishedScheduleVersion).toBe(3)
    expect(state.events[0].version).toBe(1)
    expect(publicAgenda(state)).toHaveLength(10)
    expect(
      new Set(publicAgenda(state).map((item) => item.placement.startsAt.slice(0, 10))),
    ).toEqual(new Set(['2026-10-04', '2026-10-05']))
    expect(readinessSummary(state).blockers).toBeGreaterThan(0)
    expect(state.submissionForms).toHaveLength(2)
    expect(state.submissions).toHaveLength(6)
    expect(submissionPipelineSummary(state)).toMatchObject({
      total: 6,
      draft: 1,
      submitted: 2,
      inReview: 1,
      accepted: 1,
      rejected: 1,
    })
    expect(submissionReviewSummary(state, 'sub_002')).toMatchObject({
      assigned: 2,
      completed: 2,
      averageScore: 4.67,
    })
    expect(reviewerQueue(state, 'rev_001')).toHaveLength(3)
    expect(
      submissionFormPublishReadiness(
        state.submissionFormFields.filter((field) => field.formId === 'frm_cfp_2026'),
      ),
    ).toMatchObject({ ready: true, completedCount: 8, requiredCount: 8 })
    expect(
      scheduleConflicts(state).filter((conflict) => conflict.severity === 'error'),
    ).toHaveLength(0)
  })

  it('normalizes mixed review scales into one five-point aggregate', () => {
    const state = createSeedState()
    const plan = state.evaluationPlans[0]!
    plan.rounds.push({
      id: 'rnd_final_review',
      name: 'Final review',
      order: 2,
      reviewersPerSubmission: 2,
      minimumCompletedReviews: 2,
      criteria: [
        {
          id: 'crt_final_score',
          label: 'Final score',
          description: 'Overall final-round assessment.',
          kind: 'numeric',
          minimum: 1,
          maximum: 10,
          weight: 1,
        },
      ],
    })
    const sourceAssignment = state.reviewerAssignments.find(
      (entry) => entry.submissionId === 'sub_002',
    )!
    for (const [index, score] of [8, 10].entries()) {
      const assignmentId = `rva_final_${index}`
      state.reviewerAssignments.push({
        ...sourceAssignment,
        id: assignmentId,
        roundId: 'rnd_final_review',
        reviewerId: state.reviewers[index]!.id,
        status: 'completed',
      })
      state.scorecards.push({
        id: `sco_final_${index}`,
        assignmentId,
        answers: { crt_final_score: score },
        scores: { crt_final_score: score },
        recommendation: 'accept',
        comments: '',
        submittedAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
        version: 1,
      })
    }

    expect(submissionReviewSummary(state, 'sub_002').averageScore).toBe(4.58)
  })

  it('updates event settings with validation and version checks', () => {
    const state = createSeedState()
    const event = state.events[0]
    const updated = executeOperation(state, 'event.update', {
      input: {
        eventId: event.id,
        name: 'AIE Brooklyn 2026',
        slug: 'aie-brooklyn-2026',
        venue: 'Building 77',
        city: 'Brooklyn, New York',
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: 'America/New_York',
        status: 'active',
      },
      expectedVersions: { [event.id]: event.version },
    })
    expect(updated.response.ok).toBe(true)
    expect(updated.state.events[0]).toMatchObject({
      name: 'AIE Brooklyn 2026',
      slug: 'aie-brooklyn-2026',
      venue: 'Building 77',
      version: 2,
    })
    expect(updated.state.domainEvents.at(-1)?.type).toBe('event.updated')

    const stale = executeOperation(updated.state, 'event.update', {
      input: { eventId: event.id, name: 'Stale name' },
      expectedVersions: { [event.id]: 1 },
    })
    expect(stale.response.error?.code).toBe('STALE_WRITE')

    const invalid = executeOperation(updated.state, 'event.update', {
      input: { eventId: event.id, timezone: 'New York-ish' },
      expectedVersions: { [event.id]: 2 },
    })
    expect(invalid.response.error?.code).toBe('INVALID_INPUT')
    expect(invalid.response.error?.fields?.timezone).toBeTruthy()
  })

  it('creates and publishes speaker portal resources with safe embed URLs', () => {
    const state = createSeedState()
    const created = executeOperation(state, 'portal-resource.create', {
      input: {
        title: 'Slide template',
        summary: 'Use this deck for every breakout session.',
        body: 'Duplicate the template and keep the closing slide intact.',
        embedUrl: 'https://docs.google.com/presentation/d/example/embed',
        linkUrl: 'https://docs.google.com/presentation/d/example/copy',
        status: 'draft',
      },
    })
    expect(created.response.ok).toBe(true)
    const resource = (
      created.response.data as { resource: { id: string; slug: string; version: number } }
    ).resource
    expect(resource).toMatchObject({ slug: 'slide-template', version: 1 })

    const published = executeOperation(created.state, 'portal-resource.update', {
      input: { resourceId: resource.id, status: 'published' },
      expectedVersions: { [resource.id]: 1 },
    })
    expect(published.response.ok).toBe(true)
    expect(published.state.portalResourcePages).toContainEqual(
      expect.objectContaining({ id: resource.id, status: 'published', version: 2 }),
    )
    expect(published.state.domainEvents.at(-1)?.type).toBe('portal-resource.updated')

    const insecure = executeOperation(state, 'portal-resource.create', {
      input: { title: 'Unsafe', body: 'Nope', embedUrl: 'http://example.com/embed' },
    })
    expect(insecure.response.error?.code).toBe('INVALID_INPUT')
  })

  it('builds program inventory and sessions from an empty event', () => {
    let state = createEmptyWorkspaceState({
      eventId: 'evt_summit',
      eventName: 'Open Source Summit',
      eventSlug: 'open-source-summit',
      createdAt: '2026-08-09T12:00:00.000Z',
    })
    const trackResult = executeOperation(state, 'track.create', {
      input: { name: 'Engineering', color: 'sky' },
    })
    expect(trackResult.response.ok).toBe(true)
    state = trackResult.state
    const track = state.tracks[0]

    const roomResult = executeOperation(state, 'room.create', {
      input: { name: 'Main stage', capacity: 450 },
    })
    expect(roomResult.response.ok).toBe(true)
    state = roomResult.state
    expect(state.rooms[0]).toMatchObject({ name: 'Main stage', capacity: 450 })

    const personResult = executeOperation(state, 'person.create', {
      input: {
        firstName: 'Samira',
        lastName: 'Wiley',
        email: 'samira@example.com',
        roles: ['speaker'],
      },
    })
    expect(personResult.response.ok).toBe(true)
    state = personResult.state
    const participation = state.participations[0]

    const sessionResult = executeOperation(state, 'session.create', {
      input: {
        title: 'The small web wins',
        summary: 'A practical tour of portable web primitives.',
        format: 'lightning',
        trackId: track.id,
        participantIds: [participation.id],
        durationMinutes: 10,
        expectedAttendance: 180,
        status: 'draft',
      },
    })
    expect(sessionResult.response.ok).toBe(true)
    state = sessionResult.state
    const session = state.sessions[0]
    expect(session).toMatchObject({
      title: 'The small web wins',
      format: 'lightning',
      durationMinutes: 10,
      status: 'draft',
    })
    expect(state.participations[0].sessionIds).toContain(session.id)

    const updateResult = executeOperation(state, 'session.update', {
      input: {
        sessionId: session.id,
        title: 'The small web keeps winning',
        status: 'ready',
      },
      expectedVersions: { [session.id]: session.version },
    })
    expect(updateResult.response.ok).toBe(true)
    expect(updateResult.state.sessions[0]).toMatchObject({
      title: 'The small web keeps winning',
      status: 'ready',
      version: 2,
    })
    expect(updateResult.state.domainEvents.at(-1)?.type).toBe('session.updated')
  })

  it('records attributed session revisions, restores one, and publishes only approved content', () => {
    let state = createEmptyWorkspaceState({
      eventId: 'evt_content',
      eventName: 'Content Test',
      eventSlug: 'content-test',
      createdAt: '2026-08-09T12:00:00.000Z',
    })
    state = executeOperation(state, 'track.create', { input: { name: 'Platform' } }).state
    state = executeOperation(state, 'room.create', {
      input: { name: 'Main stage', capacity: 200 },
    }).state
    const jordan = {
      type: 'staff' as const,
      id: 'usr_jordan',
      name: 'Jordan Alvarez',
      scopes: ['*'],
    }
    for (const [title, status] of [
      ['Taming 40-Minute CI', 'ready'],
      ['Lightning: Agents in Production Q&A', 'draft'],
    ] as const) {
      state = executeOperation(state, 'session.create', {
        input: {
          title,
          summary: `${title} original abstract.`,
          format: status === 'ready' ? 'talk' : 'lightning',
          trackId: state.tracks[0].id,
          durationMinutes: status === 'ready' ? 40 : 10,
          expectedAttendance: 100,
          status,
        },
        actor: jordan,
      }).state
    }
    const approvedSession = state.sessions[0]
    const firstEdit = executeOperation(state, 'session.update', {
      input: {
        sessionId: approvedSession.id,
        summary: `${approvedSession.summary} This session now includes a live demo of remote build caching.`,
      },
      expectedVersions: { [approvedSession.id]: approvedSession.version },
      actor: jordan,
    })
    expect(firstEdit.response.ok).toBe(true)
    state = firstEdit.state
    const afterFirstEdit = state.sessions[0]
    const secondEdit = executeOperation(state, 'session.update', {
      input: {
        sessionId: afterFirstEdit.id,
        summary: `${afterFirstEdit.summary} Attendees should bring a laptop.`,
      },
      expectedVersions: { [afterFirstEdit.id]: afterFirstEdit.version },
      actor: jordan,
    })
    expect(secondEdit.response.ok).toBe(true)
    state = secondEdit.state
    const secondEditEvent = state.domainEvents.at(-1)!
    expect(secondEditEvent).toMatchObject({
      type: 'session.updated',
      actor: { name: 'Jordan Alvarez' },
    })
    const restored = executeOperation(state, 'session.restore', {
      input: { sessionId: approvedSession.id, eventId: secondEditEvent.id },
      expectedVersions: { [approvedSession.id]: state.sessions[0].version },
      actor: jordan,
    })
    expect(restored.response.ok).toBe(true)
    expect(restored.state.sessions[0].summary).toContain('live demo of remote build caching')
    expect(restored.state.sessions[0].summary).not.toContain('bring a laptop')
    expect(restored.state.domainEvents.at(-1)).toMatchObject({
      type: 'session.restored',
      actor: { name: 'Jordan Alvarez' },
    })
    state = restored.state

    for (let index = 0; index < state.sessions.length; index += 1) {
      state = executeOperation(state, 'schedule.place-session', {
        input: {
          sessionId: state.sessions[index].id,
          roomId: state.rooms[0].id,
          startsAt: new Date(
            Date.parse(state.events[0].startsAt) + index * 60 * 60_000,
          ).toISOString(),
        },
        actor: jordan,
      }).state
    }
    const published = executeOperation(state, 'schedule.publish', { input: {}, actor: jordan })
    expect(published.response.ok).toBe(true)
    expect(published.state.scheduleReleases.at(-1)?.placements).toHaveLength(1)
    expect(publicAgenda(published.state).map((entry) => entry.session?.title)).toEqual([
      'Taming 40-Minute CI',
    ])
  })

  it('places unscheduled sessions, reports speaker conflicts, and blocks room overlaps', () => {
    let state = createEmptyWorkspaceState({
      eventId: 'evt_agenda',
      eventName: 'Agenda Test',
      eventSlug: 'agenda-test',
      createdAt: '2026-08-09T12:00:00.000Z',
    })
    state = executeOperation(state, 'track.create', { input: { name: 'Platform' } }).state
    state = executeOperation(state, 'room.create', {
      input: { name: 'Room A', capacity: 100 },
    }).state
    state = executeOperation(state, 'room.create', {
      input: { name: 'Room B', capacity: 100 },
    }).state
    state = executeOperation(state, 'person.create', {
      input: { firstName: 'Priya', lastName: 'Raman', email: 'priya@example.com' },
    }).state
    const participantId = state.participations[0].id
    for (const title of ['CI in forty minutes', 'An honest pair programmer', 'Docs answer back']) {
      state = executeOperation(state, 'session.create', {
        input: {
          title,
          summary: `${title} session abstract.`,
          format: 'talk',
          trackId: state.tracks[0].id,
          participantIds: title === 'Docs answer back' ? [] : [participantId],
          durationMinutes: 30,
          expectedAttendance: 80,
          status: 'ready',
        },
      }).state
    }
    const startsAt = state.events[0].startsAt
    const first = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: state.sessions[0].id,
        roomId: state.rooms[0].id,
        startsAt,
      },
    })
    expect(first.response.ok).toBe(true)
    state = first.state
    const second = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: state.sessions[1].id,
        roomId: state.rooms[1].id,
        startsAt,
      },
    })
    expect(second.response.ok).toBe(true)
    expect(scheduleConflicts(second.state)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'person_overlap',
          message: expect.stringContaining('Priya Raman'),
        }),
      ]),
    )

    const roomConflict = executeOperation(second.state, 'schedule.place-session', {
      input: {
        sessionId: second.state.sessions[2].id,
        roomId: second.state.rooms[0].id,
        startsAt,
      },
    })
    expect(roomConflict.response).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CONFLICT' },
    })
    expect(roomConflict.state.placements).toHaveLength(2)

    const overlappingPlacement = second.state.placements.find(
      (placement) => placement.sessionId === second.state.sessions[1].id,
    )!
    const firstPlacement = second.state.placements.find(
      (placement) => placement.sessionId === second.state.sessions[0].id,
    )!
    const rejectedMove = executeOperation(second.state, 'schedule.move-session', {
      input: {
        placementId: overlappingPlacement.id,
        roomId: firstPlacement.roomId,
        startsAt: firstPlacement.startsAt,
      },
      expectedVersions: { [overlappingPlacement.id]: overlappingPlacement.version },
    })
    expect(rejectedMove.response).toMatchObject({
      ok: false,
      error: { code: 'ROOM_CONFLICT' },
    })
    expect(
      rejectedMove.state.placements.find((placement) => placement.id === overlappingPlacement.id),
    ).toEqual(overlappingPlacement)

    const moved = executeOperation(second.state, 'schedule.move-session', {
      input: {
        placementId: overlappingPlacement.id,
        roomId: second.state.rooms[1].id,
        startsAt: new Date(Date.parse(startsAt) + 60 * 60_000).toISOString(),
      },
      expectedVersions: { [overlappingPlacement.id]: overlappingPlacement.version },
    })
    expect(moved.response.ok).toBe(true)
    expect(
      scheduleConflicts(moved.state).filter((conflict) => conflict.type === 'person_overlap'),
    ).toHaveLength(0)

    const autoPlaced = executeOperation(moved.state, 'schedule.auto-place', { input: {} })
    expect(autoPlaced.response.ok).toBe(true)
    expect(autoPlaced.state.placements).toHaveLength(3)
    expect(
      scheduleConflicts(autoPlaced.state).filter((conflict) => conflict.type === 'room_overlap'),
    ).toHaveLength(0)

    const published = executeOperation(autoPlaced.state, 'schedule.publish', { input: {} })
    expect(published.response.ok).toBe(true)
    expect(published.state.scheduleReleases).toHaveLength(1)
    expect(publicAgenda(published.state).map((entry) => entry.session?.title)).toEqual(
      expect.arrayContaining([
        'CI in forty minutes',
        'An honest pair programmer',
        'Docs answer back',
      ]),
    )
  })

  it('finds schedule boundary, duration, and missing-record failures deterministically', () => {
    const state = createSeedState()
    const placement = state.placements[0]
    const session = state.sessions.find((entry) => entry.id === placement.sessionId)!

    placement.startsAt = '2026-10-04T12:00:00.000Z'
    placement.endsAt = '2026-10-04T12:30:00.000Z'
    placement.roomId = 'rom_missing'
    session.trackId = 'trk_missing'
    session.participantIds.push('par_missing')

    const types = scheduleConflicts(state).map((conflict) => conflict.type)
    expect(types).toContain('event_boundary')
    expect(types).toContain('duration_mismatch')
    expect(types).toContain('missing_room')
    expect(types).toContain('missing_track')
    expect(types).toContain('missing_participant')
  })

  it('enforces idempotency keys', () => {
    const state = createSeedState()
    const request = {
      input: { firstName: 'Alex', lastName: 'River', email: 'alex@example.com' },
      idempotencyKey: 'create-alex-once',
    }
    const first = executeOperation(state, 'person.create', request)
    const second = executeOperation(first.state, 'person.create', request)
    expect(first.response.ok).toBe(true)
    expect(second.response).toEqual(first.response)
    expect(
      second.state.people.filter((person) => person.email === 'alex@example.com'),
    ).toHaveLength(1)
  })

  it('binds idempotency keys to the actor, operation, and request', () => {
    const state = createSeedState()
    const first = executeOperation(state, 'person.create', {
      input: { firstName: 'Alex', lastName: 'River', email: 'alex@example.com' },
      idempotencyKey: 'bound-command',
    })
    const conflicting = executeOperation(first.state, 'person.create', {
      input: { firstName: 'Different', lastName: 'Person', email: 'other@example.com' },
      idempotencyKey: 'bound-command',
    })
    expect(conflicting.response.ok).toBe(false)
    expect(conflicting.response.error?.code).toBe('IDEMPOTENCY_CONFLICT')
    expect(conflicting.state.people.some((person) => person.email === 'other@example.com')).toBe(
      false,
    )
  })

  it('validates speaker profiles and preserves biographies', () => {
    const state = createSeedState()
    const created = executeOperation(state, 'person.create', {
      input: {
        firstName: 'Dana',
        lastName: 'Kowalski',
        email: 'DANA@EXAMPLE.COM',
        timezone: 'America/Los_Angeles',
        bio: 'Runs the developer-experience organization.',
      },
    })
    expect(created.response.ok).toBe(true)
    expect(created.state.people.at(-1)).toMatchObject({
      email: 'dana@example.com',
      timezone: 'America/Los_Angeles',
      bio: 'Runs the developer-experience organization.',
    })
    expect(created.state.participations.at(-1)?.portalAccessKey).toMatch(/^portal_/u)

    const invalid = executeOperation(created.state, 'person.create', {
      input: {
        firstName: 'Bad',
        lastName: 'Zone',
        email: 'bad@example.com',
        timezone: 'Central-ish',
      },
    })
    expect(invalid.response.error).toMatchObject({ code: 'INVALID_INPUT' })
    expect(invalid.response.error?.fields?.timezone).toBeTruthy()
  })

  it('imports speaker rows atomically and skips existing email addresses', () => {
    const state = createSeedState()
    const imported = executeOperation(state, 'person.import', {
      input: {
        people: [
          {
            firstName: 'Dana',
            lastName: 'Kowalski',
            email: 'dana@example.com',
            company: 'Substrate',
            bio: 'Runs developer experience.',
          },
          {
            firstName: 'Jordan',
            lastName: 'Bell',
            email: 'jordan@commonthread.org',
          },
        ],
      },
    })
    expect(imported.response.ok).toBe(true)
    expect(imported.response.data).toMatchObject({
      imported: [expect.objectContaining({ email: 'dana@example.com' })],
      skipped: ['jordan@commonthread.org'],
    })
    expect(imported.state.people).toContainEqual(
      expect.objectContaining({
        firstName: 'Dana',
        company: 'Substrate',
        bio: 'Runs developer experience.',
      }),
    )
    const dana = imported.state.people.find((person) => person.email === 'dana@example.com')!
    expect(imported.state.participations.find((entry) => entry.personId === dana.id)).toMatchObject(
      { roles: ['speaker'], status: 'prospect' },
    )
  })

  it('keeps participant portal access scoped to the matching participation', () => {
    const state = createSeedState()
    const target = state.requirementInstances.find((entry) => entry.participationId === 'par_004')!
    const result = executeOperation(state, 'requirement.set-status', {
      input: { requirementInstanceId: target.id, status: 'submitted' },
      actor: {
        type: 'participant',
        id: 'par_003',
        name: 'Jordan Bell',
        scopes: ['requirements:write'],
      },
    })
    expect(result.response.ok).toBe(false)
    expect(result.response.error?.code).toBe('FORBIDDEN')
    expect(result.state).toBe(state)
  })

  it('keeps participant submission and lifecycle actions separate from staff review', () => {
    const state = createSeedState()
    const ownRequirement = state.requirementInstances.find(
      (entry) => entry.participationId === 'par_003' && entry.status !== 'approved',
    )!
    const participant = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['participations:write', 'requirements:write'],
    }
    const selfApproval = executeOperation(state, 'requirement.set-status', {
      input: { requirementInstanceId: ownRequirement.id, status: 'approved' },
      actor: participant,
    })
    expect(selfApproval.response.error?.code).toBe('FORBIDDEN')

    const declinedState = structuredClone(state)
    const participation = declinedState.participations.find((entry) => entry.id === 'par_003')!
    participation.status = 'declined'
    const selfReactivation = executeOperation(declinedState, 'participation.set-status', {
      input: { participationId: participation.id, status: 'invited' },
      actor: participant,
    })
    expect(selfReactivation.response.error?.code).toBe('FORBIDDEN')
  })

  it('records the latest handoff time when a requested revision is resubmitted', () => {
    const state = createSeedState()
    const target = state.requirementInstances.find(
      (entry) => entry.participationId === 'par_003' && entry.submittedAt,
    )!
    const originalSubmittedAt = target.submittedAt
    target.status = 'revision_requested'

    const resubmitted = executeOperation(state, 'requirement.set-status', {
      input: { requirementInstanceId: target.id, status: 'submitted' },
      actor: {
        type: 'participant',
        id: target.participationId,
        name: 'Jordan Bell',
        scopes: ['requirements:write'],
      },
    })

    expect(resubmitted.response.ok).toBe(true)
    expect(
      resubmitted.state.requirementInstances.find((entry) => entry.id === target.id)?.submittedAt,
    ).not.toBe(originalSubmittedAt)
  })

  it('creates one reusable task and lets each assigned speaker complete their own instance', () => {
    const state = createSeedState()
    const unassignedBefore = readinessRows(state).find(
      (entry) => entry.participationId === 'par_005',
    )!
    const created = executeOperation(state, 'requirement.create', {
      input: {
        label: 'Confirm travel plans',
        description: 'Add your arrival and departure details.',
        dueAt: '2026-09-15T23:59:59.000Z',
        participationIds: ['par_003', 'par_004'],
      },
    })
    expect(created.response.ok).toBe(true)
    expect(created.response.data).toMatchObject({
      requirementDefinition: {
        label: 'Confirm travel plans',
        selfCompletable: true,
        systemKey: null,
      },
      requirementInstances: [
        expect.objectContaining({ participationId: 'par_003', status: 'not_started' }),
        expect.objectContaining({ participationId: 'par_004', status: 'not_started' }),
      ],
    })
    expect(
      readinessRows(created.state).find((entry) => entry.participationId === 'par_005'),
    ).toMatchObject({
      total: unassignedBefore.total,
      percent: unassignedBefore.percent,
      blockers: unassignedBefore.blockers,
    })
    const ownTask = created.state.requirementInstances.find(
      (entry) =>
        entry.participationId === 'par_003' &&
        created.state.requirementDefinitions.find(
          (definition) => definition.id === entry.definitionId,
        )?.label === 'Confirm travel plans',
    )!
    const completed = executeOperation(created.state, 'requirement.set-status', {
      input: {
        requirementInstanceId: ownTask.id,
        status: 'approved',
        value: 'Completed through participant portal.',
      },
      expectedVersions: { [ownTask.id]: ownTask.version },
      actor: {
        type: 'participant',
        id: 'par_003',
        name: 'Jordan Bell',
        scopes: ['requirements:write'],
      },
    })
    expect(completed.response.ok).toBe(true)
    expect(
      completed.state.requirementInstances.find((entry) => entry.id === ownTask.id),
    ).toMatchObject({ status: 'approved', reviewedAt: expect.any(String) })
    expect(
      completed.state.requirementInstances.find(
        (entry) =>
          entry.definitionId === ownTask.definitionId && entry.participationId === 'par_004',
      ),
    ).toMatchObject({ status: 'not_started' })
  })

  it('registers a speaker headshot against their own profile and completes readiness', () => {
    const state = createSeedState()
    const participant = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['assets:write'],
    }
    const result = executeOperation(state, 'asset.register', {
      input: {
        ownerType: 'person',
        ownerId: 'per_003',
        kind: 'headshot',
        filename: 'jordan-headshot.png',
        contentType: 'image/png',
        sizeBytes: 42_000,
        storageKey: 'evt_aie_2026/people/per_003/jordan-headshot.png',
      },
      actor: participant,
    })
    expect(result.response.ok).toBe(true)
    const asset = (result.response.data as { asset: { id: string } }).asset
    expect(result.state.people.find((entry) => entry.id === 'per_003')?.avatarUrl).toBe(
      `/public/v1/assets/${asset.id}`,
    )
    const headshotDefinition = result.state.requirementDefinitions.find(
      (entry) => entry.systemKey === 'profile_headshot',
    )!
    expect(
      result.state.requirementInstances.find(
        (entry) =>
          entry.participationId === 'par_003' && entry.definitionId === headshotDefinition.id,
      ),
    ).toMatchObject({ status: 'approved', value: asset.id })

    const denied = executeOperation(state, 'asset.register', {
      input: {
        ownerType: 'person',
        ownerId: 'per_004',
        kind: 'headshot',
        filename: 'wrong-person.png',
        contentType: 'image/png',
        sizeBytes: 10,
        storageKey: 'wrong-person.png',
      },
      actor: participant,
    })
    expect(denied.response.error?.code).toBe('FORBIDDEN')

    const replaced = executeOperation(result.state, 'asset.register', {
      input: {
        ownerType: 'person',
        ownerId: 'per_003',
        kind: 'headshot',
        filename: 'jordan-headshot-final.png',
        contentType: 'image/png',
        sizeBytes: 52_000,
        storageKey: 'evt_aie_2026/people/per_003/jordan-headshot-final.png',
      },
      actor: {
        type: 'staff',
        id: 'usr_admin',
        name: 'Jordan Alvarez',
        scopes: ['assets:write'],
      },
    })
    expect(replaced.response.ok).toBe(true)
    expect(replaced.state.assets.filter((entry) => entry.owner.id === 'per_003')).toEqual([
      expect.objectContaining({ version: 1, isLatest: false }),
      expect.objectContaining({
        version: 2,
        isLatest: true,
        uploadedBy: { type: 'staff', id: 'usr_admin', name: 'Jordan Alvarez' },
      }),
    ])
    expect(replaced.state.people.find((entry) => entry.id === 'per_003')?.avatarUrl).toBe(
      `/public/v1/assets/${replaced.state.assets.at(-1)?.id}`,
    )
  })

  it('versions speaker deliverables and keeps an attributed comment thread', () => {
    const state = createSeedState()
    const participant = state.participations.find((entry) => entry.id === 'par_003')!
    const sessionId = participant.sessionIds[0]
    const created = executeOperation(state, 'requirement.create', {
      input: {
        label: 'Upload final slides',
        description: 'PDF or PowerPoint, 20 MB maximum.',
        kind: 'file',
        sessionId,
        acceptedContentTypes: ['application/pdf'],
        maxSizeBytes: 20_000_000,
        dueAt: '2026-09-25T23:59:59.000Z',
        participationIds: [participant.id],
      },
    })
    expect(created.response.ok).toBe(true)
    const instance = created.state.requirementInstances.find(
      (entry) =>
        entry.participationId === participant.id &&
        created.state.requirementDefinitions.find(
          (definition) => definition.id === entry.definitionId,
        )?.label === 'Upload final slides',
    )!
    const speaker = {
      type: 'participant' as const,
      id: participant.id,
      name: 'Jordan Bell',
      scopes: ['assets:write'],
    }
    const first = executeOperation(created.state, 'asset.register', {
      input: {
        ownerType: 'requirement',
        ownerId: instance.id,
        kind: 'slides',
        filename: 'slides.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_000_000,
        storageKey: `${instance.id}/slides-v1.pdf`,
      },
      actor: speaker,
    })
    expect(first.response.ok).toBe(true)
    const second = executeOperation(first.state, 'asset.register', {
      input: {
        ownerType: 'requirement',
        ownerId: instance.id,
        kind: 'slides',
        filename: 'slides.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1_100_000,
        storageKey: `${instance.id}/slides-v2.pdf`,
      },
      actor: speaker,
    })
    expect(second.response.ok).toBe(true)
    expect(second.state.assets.filter((asset) => asset.owner.id === instance.id)).toEqual([
      expect.objectContaining({ version: 1, isLatest: false, sessionId }),
      expect.objectContaining({ version: 2, isLatest: true, sessionId }),
    ])
    expect(
      second.state.requirementInstances.find((entry) => entry.id === instance.id),
    ).toMatchObject({ status: 'submitted', value: second.state.assets.at(-1)?.id })

    const latest = second.state.assets.at(-1)!
    const commented = executeOperation(second.state, 'asset.comment', {
      input: { assetId: latest.id, body: 'Updated the diagrams and speaker notes.' },
      actor: speaker,
    })
    expect(commented.response.ok).toBe(true)
    expect(commented.state.assetComments).toContainEqual(
      expect.objectContaining({
        assetId: latest.id,
        body: 'Updated the diagrams and speaker notes.',
        author: { type: 'participant', id: participant.id, name: 'Jordan Bell' },
      }),
    )
  })

  it('keeps event-specific public identity separate from the global person record', () => {
    const state = createSeedState()
    const participation = state.participations.find((entry) => entry.id === 'par_003')!
    const person = state.people.find((entry) => entry.id === participation.personId)!
    const updated = executeOperation(state, 'portal.update-profile', {
      input: {
        participationId: participation.id,
        publicTitle: 'Event title',
        publicCompany: 'Event company',
        bio: 'A public biography updated through the speaker portal.',
      },
      actor: {
        type: 'participant',
        id: participation.id,
        name: 'Participant',
        scopes: ['portal:write'],
      },
    })
    expect(updated.response.ok).toBe(true)
    expect(
      updated.state.participations.find((entry) => entry.id === participation.id),
    ).toMatchObject({ publicTitle: 'Event title', publicCompany: 'Event company' })
    expect(updated.state.people.find((entry) => entry.id === person.id)).toMatchObject({
      title: person.title,
      company: person.company,
      bio: 'A public biography updated through the speaker portal.',
    })
    const bioDefinition = updated.state.requirementDefinitions.find(
      (entry) => entry.systemKey === 'profile_bio',
    )!
    expect(
      updated.state.requirementInstances.find(
        (entry) =>
          entry.definitionId === bioDefinition.id && entry.participationId === participation.id,
      ),
    ).toMatchObject({ status: 'approved', submittedAt: expect.any(String) })
  })

  it('enforces nested permissions when proposals are created', () => {
    const state = createSeedState()
    const campaign = state.campaigns.find((entry) => entry.status === 'awaiting_approval')!
    const result = executeOperation(state, 'change-set.create', {
      input: {
        title: 'Escalate privileges',
        operations: [
          {
            operation: 'campaign.approve',
            input: { campaignId: campaign.id },
          },
        ],
      },
      actor: {
        type: 'agent',
        id: 'agent_limited',
        name: 'Limited agent',
        scopes: ['changes:propose'],
      },
    })
    expect(result.response.ok).toBe(false)
    expect(result.response.error?.code).toBe('FORBIDDEN')
  })

  it('rejects dry runs for operations that cannot be previewed safely', () => {
    const state = createSeedState()
    const result = executeOperation(state, 'workspace.reset-demo', {
      input: {},
      mode: 'dry_run',
    })
    expect(result.response.ok).toBe(false)
    expect(result.response.error?.code).toBe('UNSUPPORTED_MODE')
    expect(result.state).toBe(state)
  })

  it('requires agents to propose schedule mutations', () => {
    const state = createSeedState()
    const request = {
      input: {
        placementId: 'plc_007',
        roomId: 'rom_main',
        startsAt: '2026-10-04T17:00:00.000Z',
      },
      actor: {
        type: 'agent' as const,
        id: 'agent',
        name: 'Agent',
        scopes: ['schedule:draft'],
      },
      expectedVersions: { plc_007: 1 },
    }
    const denied = executeOperation(state, 'schedule.move-session', request)
    expect(denied.response.error?.code).toBe('APPROVAL_REQUIRED')

    const proposed = executeOperation(state, 'schedule.move-session', {
      ...request,
      mode: 'propose',
    })
    expect(proposed.response.ok).toBe(true)
    expect(proposed.response.approvalRequired).toBe(true)
    expect(proposed.state.placements.find((placement) => placement.id === 'plc_007')?.roomId).toBe(
      'rom_studio',
    )
    expect(proposed.state.changeSets[0].status).toBe('awaiting_approval')
  })

  it('keeps draft schedule moves private and published releases immutable', () => {
    let state = createSeedState()
    const initialRelease = structuredClone(state.scheduleReleases[0])
    const initialPublicPlacement = publicAgenda(state).find(
      (entry) => entry.placement.id === 'plc_007',
    )!.placement

    const moved = executeOperation(state, 'schedule.move-session', {
      input: {
        placementId: 'plc_007',
        roomId: 'rom_main',
        startsAt: '2026-10-04T17:00:00.000Z',
      },
      expectedVersions: { plc_007: 1 },
    })
    expect(moved.response.ok).toBe(true)
    state = moved.state
    expect(state.placements.find((placement) => placement.id === 'plc_007')?.roomId).toBe(
      'rom_main',
    )
    expect(
      publicAgenda(state).find((entry) => entry.placement.id === 'plc_007')?.placement,
    ).toEqual(initialPublicPlacement)
    expect(state.scheduleReleases[0]).toEqual(initialRelease)

    const published = executeOperation(state, 'schedule.publish', { input: {} })
    expect(published.response.ok).toBe(true)
    state = published.state
    expect(state.events[0].publishedScheduleVersion).toBe(4)
    expect(state.scheduleReleases).toHaveLength(2)
    expect(
      publicAgenda(state).find((entry) => entry.placement.id === 'plc_007')?.placement,
    ).toMatchObject({
      roomId: 'rom_main',
      startsAt: '2026-10-04T17:00:00.000Z',
      scheduleVersion: 4,
      published: true,
    })
    expect(state.scheduleReleases[0]).toEqual(initialRelease)

    const latestRelease = structuredClone(state.scheduleReleases[1])
    const redrafted = executeOperation(state, 'schedule.move-session', {
      input: {
        placementId: 'plc_007',
        roomId: 'rom_studio',
        startsAt: '2026-10-04T19:00:00.000Z',
      },
      expectedVersions: { plc_007: 3 },
    })
    expect(redrafted.response.ok).toBe(true)
    expect(
      publicAgenda(redrafted.state).find((entry) => entry.placement.id === 'plc_007')?.placement,
    ).toEqual(latestRelease.placements.find((placement) => placement.id === 'plc_007'))
    expect(redrafted.state.scheduleReleases[0]).toEqual(initialRelease)
    expect(redrafted.state.scheduleReleases[1]).toEqual(latestRelease)
  })

  it('prevents schedule moves across event boundaries', () => {
    const state = createSeedState()
    state.rooms.push({
      id: 'rom_foreign',
      eventId: 'evt_foreign',
      name: 'Foreign room',
      capacity: 100,
    })
    const placement = state.placements.find((entry) => entry.id === 'plc_007')!
    const moved = executeOperation(state, 'schedule.move-session', {
      input: {
        placementId: placement.id,
        roomId: 'rom_foreign',
        startsAt: placement.startsAt,
      },
      expectedVersions: { [placement.id]: placement.version },
    })

    expect(moved.response).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } })
    expect(moved.state).toBe(state)
  })

  it('commits approved change sets and records the full audit chain', () => {
    let state = createSeedState()
    const changeSet = state.changeSets[0]
    const approved = executeOperation(state, 'change-set.approve', {
      input: { changeSetId: changeSet.id },
      expectedVersions: { [changeSet.id]: changeSet.version },
    })
    expect(approved.response.ok).toBe(true)
    state = approved.state
    const approvedChangeSet = state.changeSets.find((entry) => entry.id === changeSet.id)!
    const committed = executeOperation(state, 'change-set.commit', {
      input: { changeSetId: changeSet.id },
      expectedVersions: { [changeSet.id]: approvedChangeSet.version },
    })
    expect(committed.response.ok).toBe(true)
    expect(committed.state.changeSets.find((entry) => entry.id === changeSet.id)?.status).toBe(
      'committed',
    )
    expect(committed.state.placements.find((placement) => placement.id === 'plc_007')?.roomId).toBe(
      'rom_main',
    )
    expect(
      committed.state.domainEvents.some((event) => event.type === 'change-set.committed'),
    ).toBe(true)
  })

  it('persists a stale proposal when its guarded records changed before commit', () => {
    let state = createSeedState()
    const placement = state.placements.find((entry) => entry.id === 'plc_007')!
    const created = executeOperation(state, 'change-set.create', {
      input: {
        title: 'Move the opening session',
        operations: [
          {
            operation: 'schedule.move-session',
            input: {
              placementId: placement.id,
              roomId: 'rom_main',
              startsAt: '2026-10-04T17:00:00.000Z',
            },
            expectedVersions: { [placement.id]: placement.version },
          },
        ],
      },
    })
    expect(created.response.ok, JSON.stringify(created.response)).toBe(true)
    state = created.state

    const changeSet = state.changeSets[0]
    const approved = executeOperation(state, 'change-set.approve', {
      input: { changeSetId: changeSet.id },
      expectedVersions: { [changeSet.id]: changeSet.version },
    })
    expect(approved.response.ok, JSON.stringify(approved.response)).toBe(true)
    state = approved.state

    const changed = executeOperation(state, 'schedule.move-session', {
      input: {
        placementId: placement.id,
        roomId: 'rom_studio',
        startsAt: '2026-10-04T18:00:00.000Z',
      },
      expectedVersions: { [placement.id]: placement.version },
    })
    expect(changed.response.ok, JSON.stringify(changed.response)).toBe(true)
    state = changed.state
    const revisionBeforeCommit = state.revision
    const approvedChangeSet = state.changeSets.find((entry) => entry.id === changeSet.id)!

    const committed = executeOperation(state, 'change-set.commit', {
      input: { changeSetId: changeSet.id },
      expectedVersions: { [changeSet.id]: approvedChangeSet.version },
    })

    expect(committed.response).toMatchObject({
      ok: false,
      error: { code: 'STALE_WRITE', message: expect.stringContaining('can no longer be applied') },
      stateRevision: revisionBeforeCommit + 1,
    })
    expect(committed.state.changeSets.find((entry) => entry.id === changeSet.id)).toMatchObject({
      status: 'stale',
      warnings: [expect.stringContaining('changed after this action was prepared')],
    })
    expect(committed.state.placements.find((entry) => entry.id === placement.id)).toMatchObject({
      roomId: 'rom_studio',
      startsAt: '2026-10-04T18:00:00.000Z',
    })
    expect(
      committed.state.domainEvents.some(
        (event) => event.type === 'change-set.stale' && event.aggregate.id === changeSet.id,
      ),
    ).toBe(true)
  })

  it('separates campaign drafting, approval, and sending', () => {
    let state = createSeedState()
    const pending = state.campaigns.find((campaign) => campaign.status === 'awaiting_approval')!
    const earlySend = executeOperation(state, 'campaign.send', {
      input: { campaignId: pending.id },
    })
    expect(earlySend.response.error?.code).toBe('INVALID_TRANSITION')

    const approved = executeOperation(state, 'campaign.approve', {
      input: { campaignId: pending.id },
      expectedVersions: { [pending.id]: pending.version },
    })
    state = approved.state
    const current = state.campaigns.find((campaign) => campaign.id === pending.id)!
    const sent = executeOperation(state, 'campaign.send', {
      input: { campaignId: current.id },
      expectedVersions: { [current.id]: current.version },
    })
    expect(sent.response.ok).toBe(true)
    expect(sent.state.campaigns.find((campaign) => campaign.id === pending.id)?.status).toBe('sent')
    const messages = sent.state.outboundMessages?.filter(
      (message) => message.campaignId === pending.id,
    )
    expect(messages).toHaveLength(pending.recipientParticipationIds.length)
    expect(messages?.[0]).toMatchObject({
      kind: 'campaign',
      trigger: 'campaign.send',
      status: 'queued',
    })
    expect(`${messages?.[0]?.subject}${messages?.[0]?.body}`).not.toContain('{{')
  })

  it('freezes each scheduled speaker calendar into the approved campaign outbox', () => {
    let state = createSeedState()
    const participation = state.participations.find((entry) =>
      calendarAttachmentForParticipation(state, entry.id),
    )!
    const attachment = calendarAttachmentForParticipation(state, participation.id)!
    expect(attachment.content).toContain('BEGIN:VCALENDAR\r\n')
    expect(attachment.content).toContain('METHOD:PUBLISH\r\n')
    expect(attachment.content.match(/BEGIN:VEVENT/gu)).toHaveLength(attachment.eventCount)
    expect(attachment.filename).toMatch(/-schedule\.ics$/u)

    const drafted = executeOperation(state, 'campaign.create-draft', {
      input: {
        name: 'Speaker calendar delivery',
        subject: 'Your published schedule',
        body: 'Your confirmed sessions are attached.',
        audience: 'custom',
        recipientParticipationIds: [participation.id],
        includeCalendarInvite: true,
      },
    })
    state = drafted.state
    let campaign = state.campaigns[0]
    const submitted = executeOperation(state, 'campaign.submit', {
      input: { campaignId: campaign.id },
      expectedVersions: { [campaign.id]: campaign.version },
    })
    state = submitted.state
    campaign = state.campaigns.find((entry) => entry.id === campaign.id)!
    const approved = executeOperation(state, 'campaign.approve', {
      input: { campaignId: campaign.id },
      expectedVersions: { [campaign.id]: campaign.version },
    })
    state = approved.state
    campaign = state.campaigns.find((entry) => entry.id === campaign.id)!
    const sent = executeOperation(state, 'campaign.send', {
      input: { campaignId: campaign.id },
      expectedVersions: { [campaign.id]: campaign.version },
    })

    expect(sent.response.ok).toBe(true)
    expect(sent.state.outboundMessages?.[0]?.calendarAttachment).toMatchObject({
      filename: attachment.filename,
      contentType: 'text/calendar; method=PUBLISH; charset=utf-8',
      eventCount: attachment.eventCount,
    })
    expect(sent.state.outboundMessages?.[0]?.calendarAttachment?.content).toBe(attachment.content)
  })

  it('renders campaign merge fields for a real event participant', () => {
    const state = createSeedState()
    const participation = state.participations.find(
      (entry) =>
        entry.eventId === state.activeEventId &&
        state.requirementInstances.some(
          (instance) =>
            instance.participationId === entry.id &&
            instance.status !== 'approved' &&
            instance.status !== 'waived',
        ),
    )!
    const person = state.people.find((entry) => entry.id === participation.personId)!
    const preview = campaignPreview(
      state,
      {
        subject: 'Welcome to {{event_name}}, {{first_name}}',
        body: 'Hi {{full_name}},\n\n{{outstanding_tasks}}\n\nOpen {{portal_link}}.',
      },
      participation.id,
    )

    expect(preview).toMatchObject({
      recipientName: `${person.firstName} ${person.lastName}`,
      recipientEmail: person.email,
    })
    expect(preview?.subject).toContain(person.firstName)
    expect(preview?.body).toContain(`/portal/${participation.id}/`)
    expect(preview?.body).toMatch(/• .+ \(due \d{4}-\d{2}-\d{2}\)/)
    expect(`${preview?.subject}${preview?.body}`).not.toContain('{{')
  })

  it('persists private speaker logistics without exposing them to participant actors', () => {
    const state = createSeedState()
    const participation = state.participations.find(
      (entry) => entry.eventId === state.activeEventId,
    )!
    const notes = 'Arrival May 11, aisle seat; dietary: Vegetarian'
    const updated = executeOperation(state, 'participation.update-logistics', {
      input: { participationId: participation.id, internalNotes: notes },
      expectedVersions: { [participation.id]: participation.version },
    })

    expect(updated.response.ok).toBe(true)
    expect(
      updated.state.participations.find((entry) => entry.id === participation.id)?.internalNotes,
    ).toBe(notes)
    const denied = executeOperation(updated.state, 'participation.update-logistics', {
      input: { participationId: participation.id, internalNotes: 'Changed by speaker' },
      actor: {
        type: 'participant',
        id: participation.id,
        name: 'Speaker',
        scopes: ['participations:write'],
      },
    })
    expect(denied.response.error?.code).toBe('FORBIDDEN')
  })

  it('evaluates conditional CFP fields from canonical answers', () => {
    const state = createSeedState()
    const talkFields = visibleSubmissionFormFields(state, 'frm_cfp_2026', {
      session_format: 'talk',
    })
    const workshopFields = visibleSubmissionFormFields(state, 'frm_cfp_2026', {
      session_format: 'workshop',
    })
    expect(talkFields.some((field) => field.key === 'workshop_outline')).toBe(false)
    expect(workshopFields.some((field) => field.key === 'workshop_outline')).toBe(true)
  })

  it('renders choice labels instead of leaking stored option identifiers', () => {
    const state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_005')!
    const formatField = state.submissionFormFields.find(
      (field) => field.formId === submission.formId && field.purpose === 'session_format',
    )!
    formatField.options = [{ value: 'panel', label: 'Talk (30 min)' }]
    submission.answers[formatField.key] = 'panel'

    expect(submissionAnswerDisplayByPurpose(state, submission, 'session_format')).toBe(
      'Talk (30 min)',
    )
  })

  it('converts labeled formats and durations even when their stored choice ids are stale', () => {
    const state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_005')!
    const formatField = state.submissionFormFields.find(
      (field) => field.formId === submission.formId && field.purpose === 'session_format',
    )!
    formatField.options = [{ value: 'panel', label: 'Lightning Talk (10 min)' }]
    submission.answers[formatField.key] = 'panel'

    const accepted = executeOperation(state, 'review.decide', {
      input: {
        submissionId: submission.id,
        decision: 'accepted',
        override: true,
        reason: 'Approved by the program chair.',
      },
      expectedVersions: { [submission.id]: submission.version },
    })

    expect(accepted.response.ok).toBe(true)
    const converted = accepted.state.submissions.find((entry) => entry.id === submission.id)!
    expect(
      accepted.state.sessions.find((entry) => entry.id === converted.convertedSessionId),
    ).toMatchObject({ format: 'lightning', durationMinutes: 10 })
  })

  it('creates, configures, and publishes a versioned submission form', () => {
    let state = createSeedState()
    const created = executeOperation(state, 'submission-form.create', {
      input: {
        name: 'Community CFP',
        slug: 'community-cfp',
        title: 'Propose a community session',
        description: 'Share a practical story.',
        confirmationMessage: 'We received your idea.',
      },
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const form = state.submissionForms.find((entry) => entry.slug === 'community-cfp')!

    const prematurePublish = executeOperation(state, 'submission-form.publish', {
      input: { formId: form.id },
      expectedVersions: { [form.id]: form.version },
    })
    expect(prematurePublish.response.error?.code).toBe('INVALID_INPUT')
    expect(prematurePublish.state).toBe(state)

    const field = (
      key: string,
      label: string,
      purpose: string,
      kind: string = 'short_text',
      options: Array<{ value: string; label: string }> = [],
    ) => ({ key, label, purpose, kind, required: true, options })
    const updated = executeOperation(state, 'submission-form.update', {
      input: {
        formId: form.id,
        opensAt: '2026-08-01T14:00:00.000Z',
        closesAt: '2026-08-30T03:59:00.000Z',
        fields: [
          field('first_name', 'First name', 'first_name'),
          field('last_name', 'Last name', 'last_name'),
          field('email', 'Email', 'email', 'email'),
          field('biography', 'Biography', 'biography', 'long_text'),
          field('proposal_title', 'Title', 'proposal_title'),
          field('abstract', 'Abstract', 'abstract', 'long_text'),
          field('session_format', 'Format', 'session_format', 'select', [
            { value: 'talk', label: 'Talk' },
          ]),
          field('track', 'Track', 'track', 'select', [{ value: 'trk_build', label: 'Build' }]),
        ],
      },
      expectedVersions: { [form.id]: form.version },
    })
    expect(updated.response.ok).toBe(true)
    state = updated.state
    const configured = state.submissionForms.find((entry) => entry.id === form.id)!
    expect(configured.version).toBe(2)
    expect(state.submissionFormFields.filter((entry) => entry.formId === form.id)).toHaveLength(8)

    const published = executeOperation(state, 'submission-form.publish', {
      input: { formId: form.id },
      expectedVersions: { [form.id]: configured.version },
    })
    expect(published.response.ok).toBe(true)
    expect(published.state.submissionForms.find((entry) => entry.id === form.id)).toMatchObject({
      status: 'open',
      version: 3,
    })
  })

  it('reports incomplete form mappings and rejects incompatible answer shapes', () => {
    const state = createSeedState()
    const fields = state.submissionFormFields.filter((field) => field.formId === 'frm_cfp_2026')
    const track = fields.find((field) => field.purpose === 'track')!
    track.required = false

    expect(submissionFormPublishReadiness(fields)).toMatchObject({
      ready: false,
      completedCount: 7,
      incompletePurposes: ['track'],
    })

    const form = state.submissionForms.find((entry) => entry.id === 'frm_cfp_2026')!
    const incompleteUpdate = executeOperation(state, 'submission-form.update', {
      input: { formId: form.id, fields },
      expectedVersions: { [form.id]: form.version },
    })
    expect(incompleteUpdate.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(incompleteUpdate.response.error?.message).toContain(
      'Publish requires these mapped fields: track',
    )

    track.required = true
    track.kind = 'multi_select'
    const updated = executeOperation(state, 'submission-form.update', {
      input: { formId: form.id, fields },
      expectedVersions: { [form.id]: form.version },
    })
    expect(updated.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(updated.response.error?.message).toContain('cannot map multi_select answers to track')
  })

  it('preserves field identity after a form receives submissions', () => {
    const state = createSeedState()
    const form = state.submissionForms.find((entry) => entry.id === 'frm_cfp_2026')!
    const fields = state.submissionFormFields.filter((field) => field.formId === form.id)
    const titleField = fields.find((field) => field.purpose === 'proposal_title')!

    const remapped = executeOperation(state, 'submission-form.update', {
      input: {
        formId: form.id,
        fields: fields.map((field) =>
          field.id === titleField.id ? { ...field, key: 'renamed_title' } : field,
        ),
      },
      expectedVersions: { [form.id]: form.version },
    })
    expect(remapped.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', message: expect.stringContaining('cannot change') },
    })

    const removed = executeOperation(state, 'submission-form.update', {
      input: { formId: form.id, fields: fields.filter((field) => field.id !== titleField.id) },
      expectedVersions: { [form.id]: form.version },
    })
    expect(removed.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', message: expect.stringContaining('cannot be removed') },
    })

    const relabeled = executeOperation(state, 'submission-form.update', {
      input: {
        formId: form.id,
        fields: fields.map((field) =>
          field.id === titleField.id ? { ...field, label: 'Session title' } : field,
        ),
      },
      expectedVersions: { [form.id]: form.version },
    })
    expect(relabeled.response.ok).toBe(true)
    expect(
      relabeled.state.submissionFormFields.find((field) => field.id === titleField.id)?.label,
    ).toBe('Session title')

    for (const changedField of [
      { ...titleField, required: !titleField.required },
      {
        ...titleField,
        visibleWhen: { fieldId: fields[0].id, operator: 'equals' as const, value: 'yes' },
      },
    ]) {
      const changedContract = executeOperation(state, 'submission-form.update', {
        input: {
          formId: form.id,
          fields: fields.map((field) => (field.id === titleField.id ? changedField : field)),
        },
        expectedVersions: { [form.id]: form.version },
      })
      expect(changedContract.response).toMatchObject({
        ok: false,
        error: { code: 'INVALID_INPUT', message: expect.stringContaining('cannot change') },
      })
    }

    const addedRequiredField = executeOperation(state, 'submission-form.update', {
      input: {
        formId: form.id,
        fields: [
          ...fields,
          {
            key: 'new_required_answer',
            label: 'New required answer',
            purpose: 'custom',
            kind: 'short_text',
            required: true,
          },
        ],
      },
      expectedVersions: { [form.id]: form.version },
    })
    expect(addedRequiredField.response).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('cannot be added as required'),
      },
    })
  })

  it('validates visible required answers before assigning a submission', () => {
    let state = createSeedState()
    const answers = {
      first_name: 'Nia',
      last_name: 'Rivera',
      email: 'nia@example.com',
      company: 'Useful Systems',
      job_title: 'Engineering lead',
      biography: 'Nia builds tools for small program teams.',
      proposal_title: 'A workshop with a missing plan',
      abstract: 'A hands-on workshop about dependable event operations.',
      session_format: 'workshop',
      track: 'trk_build',
    }
    const created = executeOperation(state, 'submission.create', {
      input: { formId: 'frm_cfp_2026', kind: 'abstract', answers },
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const submission = state.submissions.at(-1)!

    const incomplete = executeOperation(state, 'submission.submit', {
      input: { submissionId: submission.id },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(incomplete.response.error?.fields).toMatchObject({
      workshop_outline: 'Workshop plan is required.',
    })

    const submitted = executeOperation(state, 'submission.submit', {
      input: {
        submissionId: submission.id,
        answers: {
          workshop_outline: 'Attendees will build and test a review queue in small groups.',
        },
      },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(submitted.response.ok).toBe(true)
    expect(
      submitted.state.reviewerAssignments.filter((entry) => entry.submissionId === submission.id),
    ).toHaveLength(2)
    expect(submitted.state.outboundMessages?.[0]).toMatchObject({
      kind: 'submission_confirmation',
      trigger: 'submission.submit',
      recipientEmail: 'nia@example.com',
      subject: expect.stringContaining('A workshop with a missing plan'),
      status: 'queued',
    })
  })

  it('keeps co-speaker roles attached to a speaker-owned submission', () => {
    let state = createSeedState()
    const actor = {
      type: 'submitter' as const,
      id: 'aie-nyc-2026-cfp',
      name: 'Public submitter',
      scopes: ['submissions:write', 'submissions:submit'],
    }
    const answers = {
      first_name: 'Nia',
      last_name: 'Rivera',
      email: 'nia@example.com',
      company: 'Useful Systems',
      job_title: 'Engineering lead',
      biography: 'Nia builds tools for small program teams.',
      proposal_title: 'Designing dependable review queues',
      abstract: 'Practical patterns for giving reviewers clarity without slowing them down.',
      session_format: 'talk',
      track: 'trk_build',
    }
    const contributor = {
      id: 'contributor_lee',
      firstName: 'Lee',
      lastName: 'Morgan',
      email: 'lee@example.com',
      company: 'Useful Systems',
      title: 'Design lead',
      biography: 'Lee designs collaborative review systems.',
      role: 'co_speaker' as const,
    }
    const created = executeOperation(state, 'submission.create', {
      input: {
        formId: 'frm_cfp_2026',
        kind: 'abstract',
        answers,
        contributors: [contributor],
      },
      actor,
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const draft = state.submissions.at(-1)!
    expect(draft).toMatchObject({
      status: 'draft',
      speakerAccessKey: expect.any(String),
      contributors: [contributor],
    })

    const submitted = executeOperation(state, 'submission.submit', {
      input: { submissionId: draft.id, speakerAccessKey: draft.speakerAccessKey },
      expectedVersions: { [draft.id]: draft.version },
      actor,
    })
    expect(submitted.response.ok).toBe(true)
    state = submitted.state
    const current = state.submissions.find((entry) => entry.id === draft.id)!

    const updated = executeOperation(state, 'submission.update', {
      input: {
        submissionId: current.id,
        speakerAccessKey: current.speakerAccessKey,
        contributors: [{ ...contributor, role: 'co_presenter' }],
      },
      expectedVersions: { [current.id]: current.version },
      actor,
    })
    expect(updated.response.ok).toBe(true)
    expect(
      updated.state.submissions.find((entry) => entry.id === current.id)?.contributors,
    ).toEqual([{ ...contributor, role: 'co_presenter' }])

    const changedEmail = executeOperation(state, 'submission.update', {
      input: {
        submissionId: current.id,
        speakerAccessKey: current.speakerAccessKey,
        answers: { email: 'different@example.com' },
      },
      expectedVersions: { [current.id]: current.version },
      actor,
    })
    expect(changedEmail.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT', fields: { email: expect.any(String) } },
    })

    const denied = executeOperation(state, 'submission.update', {
      input: {
        submissionId: current.id,
        speakerAccessKey: 'not-the-speaker-key',
        contributors: [],
      },
      expectedVersions: { [current.id]: current.version },
      actor,
    })
    expect(denied.response.error?.code).toBe('FORBIDDEN')
  })

  it('resumes a title-only draft and completes it through an existing speaker link', () => {
    let state = createSeedState()
    const actor = {
      type: 'submitter' as const,
      id: 'aie-nyc-2026-cfp',
      name: 'Public submitter',
      scopes: ['submissions:write', 'submissions:submit'],
    }
    const created = executeOperation(state, 'submission.create', {
      input: {
        formId: 'frm_cfp_2026',
        kind: 'abstract',
        answers: { proposal_title: 'A title-only private draft' },
        speakerAccessKey: 'speaker_priya_raman',
      },
      actor,
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const draft = state.submissions.at(-1)!
    expect(draft).toMatchObject({
      status: 'draft',
      speakerAccessKey: 'speaker_priya_raman',
      answers: { proposal_title: 'A title-only private draft' },
    })

    const updated = executeOperation(state, 'submission.update', {
      input: {
        submissionId: draft.id,
        speakerAccessKey: draft.speakerAccessKey,
        answers: {
          first_name: 'Priya',
          last_name: 'Raman',
          email: 'priya@craftwork.dev',
          biography: 'Priya prototypes interfaces for software with uncertain outputs.',
          proposal_title: 'A title-only private draft',
          abstract: 'A completed abstract that is ready for committee review.',
          session_format: 'talk',
          track: 'trk_build',
        },
      },
      expectedVersions: { [draft.id]: draft.version },
      actor,
    })
    expect(updated.response.ok).toBe(true)
    state = updated.state
    const completedDraft = state.submissions.find((entry) => entry.id === draft.id)!
    expect(completedDraft.answers.email).toBe('priya@craftwork.dev')

    const submitted = executeOperation(state, 'submission.submit', {
      input: {
        submissionId: completedDraft.id,
        speakerAccessKey: completedDraft.speakerAccessKey,
      },
      expectedVersions: { [completedDraft.id]: completedDraft.version },
      actor,
    })
    expect(submitted.response.ok).toBe(true)
    expect(submitted.state.submissions.find((entry) => entry.id === draft.id)?.status).toBe(
      'submitted',
    )
  })

  it('enforces submission form open and close times at the operation boundary', () => {
    let state = createSeedState()
    const form = state.submissionForms.find((entry) => entry.id === 'frm_cfp_2026')!
    const now = Date.now()

    form.opensAt = new Date(now + 60_000).toISOString()
    form.closesAt = new Date(now + 120_000).toISOString()
    expect(submissionFormAvailability(form, now)).toBe('scheduled')
    const early = executeOperation(state, 'submission.create', {
      input: { formId: form.id, kind: 'abstract', answers: {} },
    })
    expect(early.response).toMatchObject({
      ok: false,
      error: { code: 'FORM_CLOSED', message: 'This submission form is not open yet.' },
    })

    form.opensAt = new Date(now - 120_000).toISOString()
    form.closesAt = new Date(now + 120_000).toISOString()
    expect(submissionFormAvailability(form, now)).toBe('open')
    const created = executeOperation(state, 'submission.create', {
      input: { formId: form.id, kind: 'abstract', answers: {} },
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const submission = state.submissions.at(-1)!
    const currentForm = state.submissionForms.find((entry) => entry.id === form.id)!
    currentForm.closesAt = new Date(now - 60_000).toISOString()
    expect(submissionFormAvailability(currentForm, now)).toBe('closed')

    const late = executeOperation(state, 'submission.submit', {
      input: { submissionId: submission.id },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(late.response).toMatchObject({
      ok: false,
      error: {
        code: 'FORM_CLOSED',
        message: 'This submission form is no longer accepting responses.',
      },
    })

    const lateEdit = executeOperation(state, 'submission.update', {
      input: {
        submissionId: submission.id,
        speakerAccessKey: submission.speakerAccessKey,
        answers: { proposal_title: 'A late title change' },
      },
      expectedVersions: { [submission.id]: submission.version },
      actor: {
        type: 'submitter',
        id: currentForm.slug,
        name: 'Public submitter',
        scopes: ['submissions:write', 'submissions:submit'],
      },
    })
    expect(lateEdit.response).toMatchObject({
      ok: false,
      error: {
        code: 'FORM_CLOSED',
        message: 'This submission form is no longer accepting responses.',
      },
    })
  })

  it('scores reviews and atomically converts an accepted abstract into the program', () => {
    let state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_002')!
    const decision = executeOperation(state, 'review.decide', {
      input: {
        submissionId: submission.id,
        decision: 'accepted',
        reason: 'Two strong reviews and a clear audience takeaway.',
      },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(decision.response.ok).toBe(true)
    state = decision.state
    const accepted = state.submissions.find((entry) => entry.id === submission.id)!
    const person = state.people.find((entry) => entry.email === 'mina@plainspoken.systems')!
    const participation = state.participations.find(
      (entry) => entry.id === accepted.convertedParticipationId,
    )!
    const session = state.sessions.find((entry) => entry.id === accepted.convertedSessionId)!
    expect(accepted.status).toBe('accepted')
    expect(participation).toMatchObject({ personId: person.id, status: 'invited' })
    expect(session).toMatchObject({
      title: 'The boring parts of trustworthy agents',
      participantIds: [participation.id],
      trackId: 'trk_operate',
      status: 'ready',
    })
    expect(participation.sessionIds).toContain(session.id)
    expect(
      state.requirementInstances.filter((entry) => entry.participationId === participation.id),
    ).toHaveLength(state.requirementDefinitions.length)
    expect(
      state.domainEvents
        .filter((entry) => entry.operation === 'review.decide')
        .map((entry) => entry.type),
    ).toEqual(
      expect.arrayContaining([
        'person.created',
        'participation.created',
        'session.created-from-submission',
        'review.decision-recorded',
      ]),
    )
    expect(state.outboundMessages).toEqual([])
    const notified = executeOperation(state, 'submission.notify-decision', {
      input: { submissionId: submission.id },
    })
    expect(notified.response.ok).toBe(true)
    state = notified.state
    expect(state.outboundMessages?.[0]).toMatchObject({
      submissionId: submission.id,
      kind: 'decision_notice',
      trigger: 'submission.notify-decision',
      recipientEmail: 'mina@plainspoken.systems',
      subject: expect.stringContaining('The boring parts of trustworthy agents'),
      body: expect.stringContaining(`/portal/${participation.id}/${participation.portalAccessKey}`),
      status: 'queued',
    })
  })

  it('converts every accepted co-speaker into the session and onboarding workflow', () => {
    const state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_005')!
    const accepted = executeOperation(state, 'review.decide', {
      input: {
        submissionId: submission.id,
        decision: 'accepted',
        override: true,
        reason: 'The program chair approved this proposal before the final scorecard arrived.',
      },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(accepted.response.ok).toBe(true)
    const converted = accepted.state.submissions.find((entry) => entry.id === submission.id)!
    const session = accepted.state.sessions.find(
      (entry) => entry.id === converted.convertedSessionId,
    )!
    const participantEmails = session.participantIds.map((participationId) => {
      const participation = accepted.state.participations.find(
        (entry) => entry.id === participationId,
      )!
      return accepted.state.people.find((entry) => entry.id === participation.personId)!.email
    })
    expect(participantEmails).toEqual(
      expect.arrayContaining(['priya@craftwork.dev', 'marcus@cloudreachlabs.example']),
    )
    expect(session.participantIds).toHaveLength(2)
    for (const participationId of session.participantIds) {
      expect(
        accepted.state.requirementInstances.filter(
          (entry) => entry.participationId === participationId,
        ),
      ).toHaveLength(accepted.state.requirementDefinitions.length)
    }
  })

  it('records scorecards and allows guaranteed sessions to bypass abstract review', () => {
    let state = createSeedState()
    const pending = state.submissions.find((entry) => entry.id === 'sub_005')!
    const prematureDecision = executeOperation(state, 'review.decide', {
      input: { submissionId: pending.id, decision: 'accepted' },
      expectedVersions: { [pending.id]: pending.version },
    })
    expect(prematureDecision.response.error?.code).toBe('REVIEWS_INCOMPLETE')
    expect(prematureDecision.state).toBe(state)

    const assignment = state.reviewerAssignments.find((entry) => entry.id === 'rva_007')!
    const scored = executeOperation(state, 'review.submit-scorecard', {
      input: {
        assignmentId: assignment.id,
        scores: { crt_relevance: 5, crt_specificity: 4, crt_takeaway: 5 },
        recommendation: 'accept',
        comments: 'Specific and immediately useful.',
      },
      expectedVersions: { [assignment.id]: assignment.version },
    })
    expect(scored.response.ok).toBe(true)
    state = scored.state
    expect(state.reviewerAssignments.find((entry) => entry.id === assignment.id)?.status).toBe(
      'completed',
    )
    expect(state.submissions.find((entry) => entry.id === 'sub_005')?.status).toBe('in_review')

    const guaranteed = state.submissions.find((entry) => entry.id === 'sub_003')!
    const accepted = executeOperation(state, 'review.decide', {
      input: {
        submissionId: guaranteed.id,
        decision: 'accepted',
        reason: 'The partner has a guaranteed program slot.',
      },
      expectedVersions: { [guaranteed.id]: guaranteed.version },
    })
    expect(accepted.response.ok).toBe(true)
    expect(accepted.state.submissions.find((entry) => entry.id === guaranteed.id)).toMatchObject({
      status: 'accepted',
      convertedParticipationId: expect.any(String),
      convertedSessionId: expect.any(String),
    })
  })

  it('configures independent review rounds with typed scorecards', () => {
    let state = createSeedState()
    state.scorecards = []
    state.reviewerAssignments = []
    const addedReviewer = executeOperation(state, 'reviewer.create', {
      input: { name: 'Sam Rodriguez', email: 'sam@example.com' },
    })
    expect(addedReviewer.response.ok).toBe(true)
    state = addedReviewer.state
    const sam = state.reviewers.find((reviewer) => reviewer.email === 'sam@example.com')!
    expect(sam.accessKey).toMatch(/^reviewer_/u)
    const initialPool = state.reviewerTeams.find((team) => team.id === 'rvt_program')!
    const updatedPool = executeOperation(state, 'reviewer-team.update', {
      input: {
        teamId: initialPool.id,
        reviewerIds: [...initialPool.reviewerIds, sam.id],
      },
      expectedVersions: { [initialPool.id]: initialPool.version },
    })
    expect(updatedPool.response.ok).toBe(true)
    state = updatedPool.state
    expect(state.reviewerTeams.find((team) => team.id === initialPool.id)?.reviewerIds).toContain(
      sam.id,
    )
    const createdPool = executeOperation(state, 'reviewer-team.create', {
      input: {
        name: 'Final review committee',
        reviewerIds: [sam.id, 'rev_003'],
      },
    })
    expect(createdPool.response.ok).toBe(true)
    state = createdPool.state
    const finalTeam = state.reviewerTeams.find((team) => team.name === 'Final review committee')!
    const plan = state.evaluationPlans[0]
    const updated = executeOperation(state, 'evaluation-plan.update', {
      input: {
        planId: plan.id,
        name: 'AIE NYC two-round review',
        rounds: [
          {
            id: 'rnd_program_review',
            name: 'Initial Review',
            opensAt: '2026-08-01T00:00:00-04:00',
            closesAt: '2026-10-15T23:59:00-04:00',
            reviewerTeamId: 'rvt_program',
            blindReview: true,
            reviewersPerSubmission: 2,
            minimumCompletedReviews: 2,
            criteria: [
              {
                id: 'crt_originality',
                label: 'Originality',
                kind: 'numeric',
                minimum: 1,
                maximum: 5,
                weight: 2,
              },
              {
                id: 'crt_relevance',
                label: 'Relevance',
                kind: 'numeric',
                minimum: 1,
                maximum: 5,
                weight: 1,
              },
              {
                id: 'crt_recommendation',
                label: 'Recommendation',
                kind: 'select',
                options: ['Accept', 'Maybe', 'Reject'],
              },
              {
                id: 'crt_comments',
                label: 'Comments',
                kind: 'long_text',
              },
            ],
          },
          {
            id: 'rnd_final_review',
            name: 'Final Review',
            opensAt: '2026-10-16T00:00:00-04:00',
            closesAt: '2026-11-30T23:59:00-05:00',
            reviewerTeamId: finalTeam.id,
            blindReview: false,
            reviewersPerSubmission: 1,
            minimumCompletedReviews: 1,
            criteria: [
              {
                id: 'crt_final_score',
                label: 'Final Score',
                kind: 'numeric',
                minimum: 1,
                maximum: 10,
                weight: 1,
              },
              {
                id: 'crt_final_comments',
                label: 'Comments',
                kind: 'long_text',
              },
            ],
          },
        ],
      },
      expectedVersions: { [plan.id]: plan.version },
    })
    expect(updated.response.ok).toBe(true)
    state = updated.state
    const savedPlan = state.evaluationPlans[0]
    expect(savedPlan.name).toBe('AIE NYC two-round review')
    expect(savedPlan.rounds).toHaveLength(2)
    expect(savedPlan.rounds[0]).toMatchObject({
      name: 'Initial Review',
      reviewerTeamId: 'rvt_program',
      blindReview: true,
    })
    expect(savedPlan.rounds[0].criteria).toEqual([
      expect.objectContaining({ id: 'crt_originality', kind: 'numeric', weight: 2 }),
      expect.objectContaining({ id: 'crt_relevance', kind: 'numeric', weight: 1 }),
      expect.objectContaining({
        id: 'crt_recommendation',
        kind: 'select',
        options: ['Accept', 'Maybe', 'Reject'],
      }),
      expect.objectContaining({ id: 'crt_comments', kind: 'long_text' }),
    ])
    expect(savedPlan.rounds[1]).toMatchObject({
      name: 'Final Review',
      reviewerTeamId: finalTeam.id,
      blindReview: false,
    })
    expect(savedPlan.rounds[1].criteria).toEqual([
      expect.objectContaining({ maximum: 10 }),
      expect.objectContaining({ kind: 'long_text' }),
    ])

    const assigned = executeOperation(state, 'review.assign', {
      input: {
        evaluationPlanId: savedPlan.id,
        roundId: 'rnd_program_review',
        reviewerId: 'rev_001',
        submissionIds: ['sub_005'],
      },
    })
    expect(assigned.response.ok).toBe(true)
    state = assigned.state
    const assignment = state.reviewerAssignments.find(
      (entry) => entry.roundId === 'rnd_program_review' && entry.submissionId === 'sub_005',
    )!
    const scored = executeOperation(state, 'review.submit-scorecard', {
      input: {
        assignmentId: assignment.id,
        answers: {
          crt_originality: 5,
          crt_relevance: 3,
          crt_recommendation: 'Accept',
          crt_comments: 'A distinct idea with a clear audience fit.',
        },
      },
      expectedVersions: { [assignment.id]: assignment.version },
    })
    expect(scored.response.ok).toBe(true)
    expect(
      scored.state.scorecards.find((entry) => entry.assignmentId === assignment.id),
    ).toMatchObject({
      answers: {
        crt_originality: 5,
        crt_relevance: 3,
        crt_recommendation: 'Accept',
        crt_comments: 'A distinct idea with a clear audience fit.',
      },
      scores: { crt_originality: 5, crt_relevance: 3 },
      recommendation: 'accept',
    })
  })

  it('routes submitted proposals to category-specific reviewer pools', () => {
    let state = createSeedState()
    state.reviewerAssignments = []
    state.scorecards = []

    const createdPool = executeOperation(state, 'reviewer-team.create', {
      input: {
        name: 'Build track committee',
        reviewerIds: ['rev_003'],
      },
    })
    expect(createdPool.response.ok).toBe(true)
    state = createdPool.state
    const routedTeam = state.reviewerTeams.find((team) => team.name === 'Build track committee')!
    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]
    const configured = executeOperation(state, 'evaluation-plan.update', {
      input: {
        planId: plan.id,
        rounds: [
          {
            ...round,
            reviewerTeamId: plan.reviewerTeamId,
            blindReview: plan.blindReview,
            criteria: plan.criteria,
            categoryRoutes: [
              {
                trackId: 'trk_build',
                reviewerTeamId: routedTeam.id,
              },
            ],
          },
        ],
      },
      expectedVersions: { [plan.id]: plan.version },
    })
    expect(configured.response.ok, JSON.stringify(configured.response)).toBe(true)
    state = configured.state

    const source = state.submissions.find((submission) => submission.id === 'sub_005')!
    state.submissions.push({
      ...structuredClone(source),
      id: 'sub_category_route',
      status: 'draft',
      submittedAt: null,
      decidedAt: null,
      convertedParticipationId: null,
      convertedSessionId: null,
      speakerAccessKey: 'speaker_category_route',
      version: 1,
    })
    const submitted = executeOperation(state, 'submission.submit', {
      input: { submissionId: 'sub_category_route' },
    })

    expect(submitted.response.ok, JSON.stringify(submitted.response)).toBe(true)
    expect(
      submitted.state.reviewerAssignments.filter(
        (assignment) => assignment.submissionId === 'sub_category_route',
      ),
    ).toEqual([
      expect.objectContaining({
        reviewerId: 'rev_003',
        roundId: round.id,
      }),
    ])
    expect(
      submitted.state.domainEvents.find(
        (event) =>
          event.type === 'submission.submitted' && event.aggregate.id === 'sub_category_route',
      )?.data,
    ).toMatchObject({
      trackId: 'trk_build',
      reviewerTeamId: routedTeam.id,
    })
  })

  it('adds category routes without rewriting existing review assignments', () => {
    let state = createSeedState()
    const createdPool = executeOperation(state, 'reviewer-team.create', {
      input: {
        name: 'Build track committee',
        reviewerIds: ['rev_003'],
      },
    })
    expect(createdPool.response.ok).toBe(true)
    state = createdPool.state

    const routedTeam = state.reviewerTeams.find((team) => team.name === 'Build track committee')!
    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]
    const assignmentsBefore = structuredClone(state.reviewerAssignments)
    const configured = executeOperation(state, 'evaluation-plan.update', {
      input: {
        planId: plan.id,
        name: plan.name,
        submissionKinds: plan.submissionKinds,
        rounds: [
          {
            ...round,
            opensAt: '2026-08-01T00:00:00.000Z',
            closesAt: '2026-08-31T23:59:59.999Z',
            reviewerTeamId: plan.reviewerTeamId,
            blindReview: plan.blindReview,
            criteria: plan.criteria,
            categoryRoutes: [
              {
                trackId: 'trk_build',
                reviewerTeamId: routedTeam.id,
              },
            ],
          },
        ],
      },
      expectedVersions: { [plan.id]: plan.version },
    })

    expect(configured.response.ok, JSON.stringify(configured.response)).toBe(true)
    expect(configured.state.evaluationPlans[0].rounds[0].categoryRoutes).toEqual([
      {
        trackId: 'trk_build',
        reviewerTeamId: routedTeam.id,
      },
    ])
    expect(configured.state.reviewerAssignments).toEqual(assignmentsBefore)
  })

  it('keeps assigned reviews tied to an immutable review policy', () => {
    const state = createSeedState()
    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]
    const changed = executeOperation(state, 'evaluation-plan.update', {
      input: {
        planId: plan.id,
        rounds: [
          {
            ...round,
            reviewerTeamId: plan.reviewerTeamId,
            blindReview: plan.blindReview,
            criteria: plan.criteria.map((criterion, index) => ({
              ...criterion,
              weight: index === 0 ? criterion.weight + 1 : criterion.weight,
            })),
          },
        ],
      },
      expectedVersions: { [plan.id]: plan.version },
    })

    expect(changed.response).toMatchObject({
      ok: false,
      error: {
        code: 'INVALID_INPUT',
        message: expect.stringContaining('cannot change after assignments are created'),
      },
    })
    expect(changed.state).toBe(state)
  })

  it('requires every configured review round before a final decision', () => {
    let state = createSeedState()
    const plan = state.evaluationPlans[0]
    const firstRound = plan.rounds[0]
    const configured = executeOperation(state, 'evaluation-plan.update', {
      input: {
        planId: plan.id,
        rounds: [
          {
            ...firstRound,
            reviewerTeamId: plan.reviewerTeamId,
            blindReview: plan.blindReview,
            criteria: plan.criteria,
          },
          {
            id: 'rnd_final_decision',
            name: 'Final committee review',
            reviewerTeamId: plan.reviewerTeamId,
            blindReview: false,
            reviewersPerSubmission: 1,
            minimumCompletedReviews: 1,
            criteria: [
              {
                id: 'crt_final_score',
                label: 'Final score',
                kind: 'numeric',
                minimum: 1,
                maximum: 5,
                weight: 1,
              },
            ],
          },
        ],
      },
      expectedVersions: { [plan.id]: plan.version },
    })
    expect(configured.response.ok, JSON.stringify(configured.response)).toBe(true)
    state = configured.state

    const submission = state.submissions.find((entry) => entry.id === 'sub_002')!
    expect(submissionDecisionReadiness(state, submission)).toMatchObject({
      ready: false,
      incompleteRounds: [
        {
          id: 'rnd_final_decision',
          name: 'Final committee review',
          completed: 0,
          required: 1,
          remaining: 1,
        },
      ],
    })
    const blocked = executeOperation(state, 'review.decide', {
      input: { submissionId: submission.id, decision: 'accepted' },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(blocked.response).toMatchObject({
      ok: false,
      error: {
        code: 'REVIEWS_INCOMPLETE',
        message: expect.stringContaining('Final committee review'),
      },
    })

    const assigned = executeOperation(state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: 'rnd_final_decision',
        reviewerId: 'rev_001',
        submissionIds: [submission.id],
      },
    })
    expect(assigned.response.ok).toBe(true)
    state = assigned.state
    const finalAssignment = state.reviewerAssignments.find(
      (entry) => entry.roundId === 'rnd_final_decision' && entry.submissionId === submission.id,
    )!
    const scored = executeOperation(state, 'review.submit-scorecard', {
      input: { assignmentId: finalAssignment.id, answers: { crt_final_score: 5 } },
      expectedVersions: { [finalAssignment.id]: finalAssignment.version },
    })
    expect(scored.response.ok).toBe(true)
    state = scored.state

    const currentSubmission = state.submissions.find((entry) => entry.id === submission.id)!
    expect(submissionDecisionReadiness(state, currentSubmission)).toMatchObject({
      ready: true,
      incompleteRounds: [],
    })
    const decided = executeOperation(state, 'review.decide', {
      input: {
        submissionId: currentSubmission.id,
        decision: 'accepted',
        reason: 'Both review rounds are complete.',
      },
      expectedVersions: { [currentSubmission.id]: currentSubmission.version },
    })
    expect(decided.response.ok).toBe(true)
  })

  it('can reconsider a rejected proposal in a later committee workflow', () => {
    let state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_004')!
    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]

    expect(submission.status).toBe('rejected')
    expect(
      state.reviewDecisions.filter((entry) => entry.submissionId === submission.id),
    ).toHaveLength(1)

    const assigned = executeOperation(state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: 'rev_001',
        submissionIds: [submission.id],
      },
    })
    expect(assigned.response.ok, JSON.stringify(assigned.response)).toBe(true)
    state = assigned.state
    expect(state.submissions.find((entry) => entry.id === submission.id)?.status).toBe('rejected')

    const reconsidered = state.submissions.find((entry) => entry.id === submission.id)!
    const accepted = executeOperation(state, 'review.decide', {
      input: {
        submissionId: reconsidered.id,
        decision: 'accepted',
        reason: 'The committee reconsidered the proposal for the revised program.',
      },
      expectedVersions: { [reconsidered.id]: reconsidered.version },
    })
    expect(accepted.response.ok, JSON.stringify(accepted.response)).toBe(true)
    const current = accepted.state.submissions.find((entry) => entry.id === submission.id)!
    expect(current).toMatchObject({
      status: 'accepted',
      convertedParticipationId: expect.any(String),
      convertedSessionId: expect.any(String),
    })
    expect(
      accepted.state.reviewDecisions.filter((entry) => entry.submissionId === submission.id),
    ).toEqual([expect.objectContaining({ decision: 'accepted', version: 2 })])
  })

  it('safely compensates and can restore an accepted proposal decision', () => {
    let state = createSeedState()
    const submission = state.submissions.find((entry) => entry.id === 'sub_005')!
    const accepted = executeOperation(state, 'review.decide', {
      input: {
        submissionId: submission.id,
        decision: 'accepted',
        override: true,
        reason: 'The committee approved an early program exception.',
      },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(accepted.response.ok, JSON.stringify(accepted.response)).toBe(true)
    state = accepted.state

    const acceptedSubmission = state.submissions.find((entry) => entry.id === submission.id)!
    const firstSessionId = acceptedSubmission.convertedSessionId!
    const firstParticipationId = acceptedSubmission.convertedParticipationId!
    const participation = state.participations.find((entry) => entry.id === firstParticipationId)!
    participation.status = 'confirmed'
    const placed = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: firstSessionId,
        roomId: 'rom_studio',
        startsAt: '2026-10-04T20:00:00.000Z',
      },
    })
    expect(placed.response.ok, JSON.stringify(placed.response)).toBe(true)
    state = placed.state

    const current = state.submissions.find((entry) => entry.id === submission.id)!
    const blocked = executeOperation(state, 'review.decide', {
      input: {
        submissionId: current.id,
        decision: 'rejected',
        reason: 'The session no longer fits the program.',
      },
      expectedVersions: { [current.id]: current.version },
    })
    expect(blocked.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION', message: expect.stringContaining('override') },
    })

    const reversed = executeOperation(state, 'review.decide', {
      input: {
        submissionId: current.id,
        decision: 'rejected',
        override: true,
        reason: 'The session no longer fits the program.',
      },
      expectedVersions: { [current.id]: current.version },
    })
    expect(reversed.response.ok, JSON.stringify(reversed.response)).toBe(true)
    state = reversed.state
    expect(state.submissions.find((entry) => entry.id === current.id)?.status).toBe('rejected')
    expect(state.sessions.find((entry) => entry.id === firstSessionId)?.status).toBe('cancelled')
    expect(state.placements.some((entry) => entry.sessionId === firstSessionId)).toBe(false)
    expect(state.participations.find((entry) => entry.id === firstParticipationId)).toMatchObject({
      status: 'withdrawn',
      sessionIds: [],
    })
    expect(
      state.domainEvents.some(
        (entry) =>
          entry.type === 'session.cancelled-from-submission' &&
          entry.aggregate.id === firstSessionId,
      ),
    ).toBe(true)

    const rejected = state.submissions.find((entry) => entry.id === current.id)!
    const restored = executeOperation(state, 'review.decide', {
      input: {
        submissionId: rejected.id,
        decision: 'accepted',
        override: true,
        reason: 'A newly open slot makes the session viable again.',
      },
      expectedVersions: { [rejected.id]: rejected.version },
    })
    expect(restored.response.ok, JSON.stringify(restored.response)).toBe(true)
    const restoredSubmission = restored.state.submissions.find((entry) => entry.id === rejected.id)!
    expect(restoredSubmission.convertedSessionId).not.toBe(firstSessionId)
    expect(
      restored.state.participations.find((entry) => entry.id === firstParticipationId),
    ).toMatchObject({
      status: 'invited',
      sessionIds: [restoredSubmission.convertedSessionId],
    })
    expect(
      restored.state.people.filter((entry) => entry.email === 'priya@craftwork.dev'),
    ).toHaveLength(1)
  })

  it('bulk assigns only eligible proposals with reviewer caps and track filters', () => {
    let state = createSeedState()
    const addedReviewer = executeOperation(state, 'reviewer.create', {
      input: { name: 'Sam Whitfield', email: 'sam.reviewer@example.com' },
    })
    state = addedReviewer.state
    const sam = state.reviewers.find((reviewer) => reviewer.email === 'sam.reviewer@example.com')!
    const team = state.reviewerTeams.find((entry) => entry.id === 'rvt_program')!
    state = executeOperation(state, 'reviewer-team.update', {
      input: { teamId: team.id, reviewerIds: [...team.reviewerIds, sam.id] },
      expectedVersions: { [team.id]: team.version },
    }).state

    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]
    const trackFiltered = executeOperation(state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: sam.id,
        submissionIds: ['sub_005'],
        trackValues: ['trk_operate'],
        maxAssignments: 5,
      },
    })
    expect(trackFiltered.response.ok).toBe(true)
    expect(
      (trackFiltered.response.data as { assignments: unknown[]; skipped: unknown[] }).assignments,
    ).toHaveLength(0)
    expect((trackFiltered.response.data as { skipped: Array<{ reason: string }> }).skipped).toEqual(
      [{ submissionId: 'sub_005', reason: 'track' }],
    )

    const capped = executeOperation(trackFiltered.state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: sam.id,
        submissionIds: ['sub_002', 'sub_005'],
        maxAssignments: 1,
      },
    })
    expect(capped.response.ok).toBe(true)
    expect((capped.response.data as { assignments: unknown[] }).assignments).toHaveLength(1)
    expect((capped.response.data as { skipped: Array<{ reason: string }> }).skipped).toEqual([
      { submissionId: 'sub_005', reason: 'cap' },
    ])

    const second = executeOperation(capped.state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: sam.id,
        submissionIds: ['sub_005'],
        maxAssignments: 2,
      },
    })
    expect(second.response.ok).toBe(true)
    state = second.state
    const assignedToSam = state.reviewerAssignments.filter(
      (assignment) => assignment.roundId === round.id && assignment.reviewerId === sam.id,
    )
    expect(assignedToSam.map((assignment) => assignment.submissionId).sort()).toEqual([
      'sub_002',
      'sub_005',
    ])

    const removed = executeOperation(state, 'review.unassign', {
      input: { assignmentId: assignedToSam[1].id },
      expectedVersions: { [assignedToSam[1].id]: assignedToSam[1].version },
    })
    expect(removed.response.ok).toBe(true)
    expect(
      removed.state.reviewerAssignments.some((assignment) => assignment.id === assignedToSam[1].id),
    ).toBe(false)
  })

  it('records reviewer reminders only when work is outstanding', () => {
    const state = createSeedState()
    const reviewer = state.reviewers.find((entry) => entry.id === 'rev_001')!
    const outstanding = state.reviewerAssignments.filter(
      (assignment) => assignment.reviewerId === reviewer.id && assignment.status !== 'completed',
    )

    const reminded = executeOperation(state, 'review.remind', {
      input: { reviewerIds: [reviewer.id] },
    })

    expect(reminded.response.ok).toBe(true)
    expect(reminded.state.reviewers.find((entry) => entry.id === reviewer.id)).toMatchObject({
      lastRemindedAt: expect.any(String),
      version: reviewer.version + 1,
    })
    expect(reminded.response.data).toMatchObject({
      reviewers: [
        {
          id: reviewer.id,
          email: reviewer.email,
          outstanding: outstanding.length,
          sentAt: expect.any(String),
        },
      ],
    })
    expect(reminded.state.domainEvents.at(-1)).toMatchObject({
      type: 'reviewer.reminder-sent',
      data: {
        reviewerId: reviewer.id,
        recipient: reviewer.email,
        outstandingAssignmentIds: outstanding.map((assignment) => assignment.id),
        deliveryMode: 'demo-outbox',
      },
    })
    expect(reminded.state.outboundMessages?.[0]).toMatchObject({
      kind: 'reviewer_reminder',
      recipientEmail: reviewer.email,
      subject: expect.stringContaining(`${outstanding.length} review`),
      status: 'queued',
    })

    const completedReviewer = reminded.state.reviewers.find((entry) => entry.id === 'rev_003')!
    const skipped = executeOperation(reminded.state, 'review.remind', {
      input: { reviewerIds: [completedReviewer.id] },
    })
    expect(skipped.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
  })

  it('lets a reviewer recuse from one proposal and undo the conflict', () => {
    const state = createSeedState()
    const assignment = state.reviewerAssignments.find((entry) => entry.id === 'rva_007')!
    const reviewerActor = {
      type: 'reviewer' as const,
      id: assignment.reviewerId,
      name: 'Elena Vasquez',
      scopes: ['reviews:write'],
    }

    const recused = executeOperation(state, 'review.recuse', {
      input: {
        assignmentId: assignment.id,
        reason: 'I collaborate directly with the submitter.',
      },
      expectedVersions: { [assignment.id]: assignment.version },
      actor: reviewerActor,
    })

    expect(recused.response.ok).toBe(true)
    expect(
      recused.state.reviewerAssignments.find((entry) => entry.id === assignment.id),
    ).toMatchObject({
      status: 'recused',
      conflictReason: 'I collaborate directly with the submitter.',
      recusedAt: expect.any(String),
      version: assignment.version + 1,
    })
    expect(submissionReviewSummary(recused.state, assignment.submissionId)).toMatchObject({
      assigned: 1,
      completed: 0,
    })
    expect(recused.state.domainEvents.at(-1)).toMatchObject({
      type: 'reviewer-assignment.recused',
      data: {
        reviewerId: assignment.reviewerId,
        submissionId: assignment.submissionId,
        reason: 'I collaborate directly with the submitter.',
      },
    })

    const whileRecused = executeOperation(recused.state, 'review.submit-scorecard', {
      input: { assignmentId: assignment.id, answers: {} },
      actor: reviewerActor,
    })
    expect(whileRecused.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    })

    const recusedAssignment = recused.state.reviewerAssignments.find(
      (entry) => entry.id === assignment.id,
    )!
    const restored = executeOperation(recused.state, 'review.restore-recusal', {
      input: { assignmentId: assignment.id },
      expectedVersions: { [assignment.id]: recusedAssignment.version },
      actor: reviewerActor,
    })
    expect(restored.response.ok).toBe(true)
    expect(
      restored.state.reviewerAssignments.find((entry) => entry.id === assignment.id),
    ).toMatchObject({
      status: 'assigned',
      conflictReason: null,
      recusedAt: null,
      version: recusedAssignment.version + 1,
    })
    expect(restored.state.domainEvents.at(-1)?.type).toBe('reviewer-assignment.recusal-restored')
  })

  it('does not count recused reviews against a reviewer assignment cap', () => {
    let state = createSeedState()
    const created = executeOperation(state, 'reviewer.create', {
      input: { name: 'Morgan Lee', email: 'morgan.reviewer@example.com' },
    })
    state = created.state
    const reviewer = state.reviewers.find((entry) => entry.email === 'morgan.reviewer@example.com')!
    const team = state.reviewerTeams.find((entry) => entry.id === 'rvt_program')!
    state = executeOperation(state, 'reviewer-team.update', {
      input: { teamId: team.id, reviewerIds: [...team.reviewerIds, reviewer.id] },
      expectedVersions: { [team.id]: team.version },
    }).state
    const plan = state.evaluationPlans[0]
    const round = plan.rounds[0]

    const first = executeOperation(state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: reviewer.id,
        submissionIds: ['sub_005'],
        maxAssignments: 1,
      },
    })
    state = first.state
    const firstAssignment = state.reviewerAssignments.find(
      (entry) => entry.reviewerId === reviewer.id,
    )!
    const recused = executeOperation(state, 'review.recuse', {
      input: { assignmentId: firstAssignment.id, reason: 'I work with this speaker.' },
      expectedVersions: { [firstAssignment.id]: firstAssignment.version },
      actor: {
        type: 'reviewer',
        id: reviewer.id,
        name: reviewer.name,
        scopes: ['reviews:write'],
      },
    })
    expect(recused.response.ok).toBe(true)

    const replacement = executeOperation(recused.state, 'review.assign', {
      input: {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: reviewer.id,
        submissionIds: ['sub_002'],
        maxAssignments: 1,
      },
    })
    expect(replacement.response.ok).toBe(true)
    expect((replacement.response.data as { assignments: unknown[] }).assignments).toHaveLength(1)
  })
})

describe('next actions', () => {
  it('groups outstanding work into jobs an organizer can pick up', () => {
    const state = createSeedState()
    const groups = nextActions(state, '2026-08-07T16:00:00.000Z')

    expect(groups.length).toBeGreaterThan(0)
    // Every group has to be actionable: a destination and a non-zero size.
    for (const group of groups) {
      expect(group.count).toBeGreaterThan(0)
      expect(group.href.startsWith('/')).toBe(true)
      expect(group.label).not.toBe('')
    }
    // Blocking work sorts ahead of work that can wait.
    const tones = groups.map((group) => group.tone)
    expect(tones).toEqual(
      [...tones].sort((left, right) => {
        const order = { blocking: 0, attention: 1, upcoming: 2 }
        return order[left] - order[right]
      }),
    )
  })

  it('accounts for every requirement blocker the readiness summary reports', () => {
    const state = createSeedState()
    const summary = readinessSummary(state)
    const grouped = nextActions(state, '2026-08-07T16:00:00.000Z')
      .filter(
        (group) => group.id.startsWith('requirement-') && group.id !== 'requirement-approvals',
      )
      .reduce((total, group) => total + group.count, 0)

    expect(grouped).toBe(summary.blockers)
  })

  it('drops groups that no longer have work in them', () => {
    const state = createSeedState()
    const emptied = {
      ...state,
      submissions: [],
      requirementInstances: [],
      reviewerAssignments: [],
      participations: state.participations.map((participation) => ({
        ...participation,
        status: 'confirmed' as const,
      })),
    }
    const ids = nextActions(emptied, '2026-08-07T16:00:00.000Z').map((group) => group.id)

    expect(ids).not.toContain('submissions-untriaged')
    expect(ids).not.toContain('reviews-open')
    expect(ids).not.toContain('invitations-unanswered')
  })
})
