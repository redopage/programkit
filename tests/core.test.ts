import { describe, expect, it } from 'vitest'

import {
  createEmptyWorkspaceState,
  createSeedState,
  executeOperation,
  nextActions,
  publicAgenda,
  readinessSummary,
  reviewerQueue,
  scheduleConflicts,
  submissionPipelineSummary,
  submissionFormPublishReadiness,
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
      averageScore: 4.7,
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

  it('keeps event-specific public identity separate from the global person record', () => {
    const state = createSeedState()
    const participation = state.participations.find((entry) => entry.id === 'par_003')!
    const person = state.people.find((entry) => entry.id === participation.personId)!
    const updated = executeOperation(state, 'portal.update-profile', {
      input: {
        participationId: participation.id,
        publicTitle: 'Event title',
        publicCompany: 'Event company',
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
    })
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
