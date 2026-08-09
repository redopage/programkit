import { describe, expect, it } from 'vitest'

import {
  acceleventsExportPreflight,
  buildAcceleventsExportItems,
  createSeedState,
  eventCalendar,
  eventCalendarInvitation,
  executeOperation,
  nextActions,
  publicAgenda,
  readinessSummary,
  reviewerQueue,
  scheduleConflicts,
  schedulePublishPreflight,
  submissionPipelineSummary,
  submissionFormPublishReadiness,
  submissionReviewSummary,
  renderCampaignMessage,
  visibleSubmissionFormFields,
} from '@programkit/core'

describe('ProgramKit operation engine', () => {
  it('creates a useful deterministic workspace', () => {
    const state = createSeedState()
    expect(state.schemaVersion).toBe(9)
    expect(state.people).toHaveLength(16)
    expect(state.participations).toHaveLength(16)
    expect(state.sessions).toHaveLength(11)
    expect(state.scheduleReleases).toHaveLength(1)
    expect(state.campaignDeliveries).toHaveLength(6)
    expect(state.events[0].publishedScheduleVersion).toBe(3)
    expect(state.events[0].version).toBe(1)
    expect(publicAgenda(state)).toHaveLength(10)
    expect(readinessSummary(state).blockers).toBeGreaterThan(0)
    expect(state.submissionForms).toHaveLength(2)
    expect(state.submissions).toHaveLength(6)
    expect(state.submissionReceiptDeliveries).toHaveLength(1)
    expect(state.portalResources).toHaveLength(2)
    expect(state.acceleventsExports).toHaveLength(0)
    expect(state.evaluationPlans[0].rounds.map((round) => round.name)).toEqual([
      'Program committee review',
      'Finalist review',
    ])
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
    expect(schedulePublishPreflight(state)).toMatchObject({
      placementCount: 10,
      changeCount: 0,
      canPublish: false,
    })
    expect(schedulePublishPreflight(state).unscheduledSessions.map((entry) => entry.id)).toEqual([
      'ses_011',
    ])
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

  it('detects duplicate draft placements for one session', () => {
    const state = createSeedState()
    state.placements.push({
      ...structuredClone(state.placements[0]),
      id: 'plc_duplicate',
      roomId: 'rom_studio',
      startsAt: '2026-10-05T16:00:00.000Z',
      endsAt: '2026-10-05T16:40:00.000Z',
    })
    expect(scheduleConflicts(state).map((conflict) => conflict.type)).toContain('duplicate_session')
    expect(schedulePublishPreflight(state).canPublish).toBe(false)
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

  it('submits private requirement files with ownership and file validation', () => {
    const state = createSeedState()
    const requirement = state.requirementInstances.find(
      (entry) => entry.participationId === 'par_003' && entry.definitionId === 'req_headshot',
    )!
    const participant = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['requirements:write', 'assets:write'],
    }
    const result = executeOperation(state, 'requirement.submit-file', {
      input: {
        requirementInstanceId: requirement.id,
        filename: 'jordan-headshot.png',
        contentType: 'image/png',
        sizeBytes: 42_000,
        storageKey: 'workspaces/wrk_aie/participants/par_003/upload-1/jordan-headshot.png',
      },
      expectedVersions: { [requirement.id]: requirement.version },
      actor: participant,
    })
    expect(result.response.ok).toBe(true)
    expect(result.state.assets).toHaveLength(state.assets.length + 1)
    const asset = result.state.assets.at(-1)!
    expect(asset).toMatchObject({
      owner: { type: 'participation', id: 'par_003' },
      kind: 'headshot',
      filename: 'jordan-headshot.png',
      storageKey: 'workspaces/wrk_aie/participants/par_003/upload-1/jordan-headshot.png',
    })
    expect(result.response.data).toMatchObject({ asset: { id: asset.id, storageKey: '' } })
    expect(
      result.state.requirementInstances.find((entry) => entry.id === requirement.id),
    ).toMatchObject({ status: 'submitted', value: asset.id, version: requirement.version + 1 })

    const foreignRequirement = state.requirementInstances.find(
      (entry) => entry.participationId === 'par_004' && entry.definitionId === 'req_headshot',
    )!
    const foreign = executeOperation(state, 'requirement.submit-file', {
      input: {
        requirementInstanceId: foreignRequirement.id,
        filename: 'foreign.png',
        contentType: 'image/png',
        sizeBytes: 100,
        storageKey: 'workspaces/wrk_aie/participants/par_004/upload-2/foreign.png',
      },
      actor: participant,
    })
    expect(foreign.response.error?.code).toBe('FORBIDDEN')

    const invalidType = executeOperation(state, 'requirement.submit-file', {
      input: {
        requirementInstanceId: requirement.id,
        filename: 'headshot.pdf',
        contentType: 'application/pdf',
        sizeBytes: 100,
        storageKey: 'workspaces/wrk_aie/participants/par_003/upload-3/headshot.pdf',
      },
      actor: participant,
    })
    expect(invalidType.response.error?.code).toBe('INVALID_INPUT')
    expect(invalidType.state).toBe(state)
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

  it('saves versioned speaker resources and rejects active HTML content', () => {
    const state = createSeedState()
    const created = executeOperation(state, 'portal-resource.save', {
      input: {
        eventId: state.activeEventId,
        title: 'Recording checklist',
        summary: 'A short production card for remote contributors.',
        kind: 'html_embed',
        embedHtml:
          '<section><h2>Before recording</h2><ul><li>Close noisy apps.</li></ul></section>',
        status: 'draft',
        sortOrder: 30,
      },
      actor: {
        type: 'staff',
        id: 'usr_resource_editor',
        name: 'Resource editor',
        scopes: ['portal-resources:write'],
      },
    })
    expect(created.response.ok).toBe(true)
    const resource = created.state.portalResources.at(-1)!
    expect(resource).toMatchObject({ kind: 'html_embed', status: 'draft', version: 1 })

    const published = executeOperation(created.state, 'portal-resource.save', {
      input: { ...resource, resourceId: resource.id, status: 'published' },
      expectedVersions: { [resource.id]: resource.version },
      actor: {
        type: 'staff',
        id: 'usr_resource_editor',
        name: 'Resource editor',
        scopes: ['portal-resources:write'],
      },
    })
    expect(published.response.ok).toBe(true)
    expect(published.state.portalResources.at(-1)).toMatchObject({
      status: 'published',
      version: 2,
    })

    const unsafe = executeOperation(state, 'portal-resource.save', {
      input: {
        eventId: state.activeEventId,
        title: 'Unsafe card',
        summary: 'Must not persist.',
        kind: 'html_embed',
        embedHtml: '<img src="https://tracker.example/pixel.png"><script>alert(1)</script>',
        status: 'published',
        sortOrder: 40,
      },
      actor: {
        type: 'staff',
        id: 'usr_resource_editor',
        name: 'Resource editor',
        scopes: ['portal-resources:write'],
      },
    })
    expect(unsafe.response.error?.code).toBe('INVALID_INPUT')
    expect(unsafe.state).toBe(state)
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

  it('places and unplaces sessions with versioned audit evidence', () => {
    const state = createSeedState()
    const forbidden = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: 'ses_011',
        roomId: 'rom_studio',
        startsAt: '2026-10-05T15:00:00.000Z',
      },
      actor: { type: 'participant', id: 'par_001', name: 'Participant', scopes: [] },
    })
    expect(forbidden.response.error?.code).toBe('FORBIDDEN')

    const incomplete = executeOperation(state, 'schedule.publish', { input: {} })
    expect(incomplete.response.error?.code).toBe('SCHEDULE_INCOMPLETE')

    const placed = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: 'ses_011',
        roomId: 'rom_studio',
        startsAt: '2026-10-05T15:00:00.000Z',
      },
      expectedVersions: { ses_011: 1 },
      idempotencyKey: 'place-session-eleven',
    })
    expect(placed.response.ok).toBe(true)
    const placement = placed.state.placements.find((entry) => entry.sessionId === 'ses_011')!
    expect(placement).toMatchObject({
      roomId: 'rom_studio',
      startsAt: '2026-10-05T15:00:00.000Z',
      published: false,
      version: 1,
    })
    expect(schedulePublishPreflight(placed.state)).toMatchObject({
      changeCount: 1,
      canPublish: true,
    })
    expect(placed.state.domainEvents.at(-1)?.type).toBe('schedule.session-placed')

    const duplicate = executeOperation(placed.state, 'schedule.place-session', {
      input: {
        sessionId: 'ses_011',
        roomId: 'rom_main',
        startsAt: '2026-10-05T16:00:00.000Z',
      },
      expectedVersions: { ses_011: 1 },
    })
    expect(duplicate.response.error?.code).toBe('INVALID_TRANSITION')

    const unplaced = executeOperation(placed.state, 'schedule.unplace-session', {
      input: { placementId: placement.id },
      expectedVersions: { [placement.id]: placement.version },
    })
    expect(unplaced.response.ok).toBe(true)
    expect(unplaced.state.placements.some((entry) => entry.id === placement.id)).toBe(false)
    expect(unplaced.state.domainEvents.at(-1)?.type).toBe('schedule.session-unplaced')
  })

  it('keeps draft schedule moves private and published releases immutable', () => {
    let state = createSeedState()
    const initialRelease = structuredClone(state.scheduleReleases[0])
    const initialPublicPlacement = publicAgenda(state).find(
      (entry) => entry.placement.id === 'plc_007',
    )!.placement

    const placed = executeOperation(state, 'schedule.place-session', {
      input: {
        sessionId: 'ses_011',
        roomId: 'rom_studio',
        startsAt: '2026-10-05T15:00:00.000Z',
      },
      expectedVersions: { ses_011: 1 },
    })
    expect(placed.response.ok).toBe(true)
    state = placed.state
    expect(publicAgenda(state)).toHaveLength(10)

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
    expect(schedulePublishPreflight(state)).toMatchObject({ changeCount: 0, canPublish: false })

    const unchanged = executeOperation(state, 'schedule.publish', { input: {} })
    expect(unchanged.response.error?.code).toBe('NO_CHANGES')

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
    const sendRequest = {
      input: { campaignId: current.id },
      expectedVersions: { [current.id]: current.version },
      idempotencyKey: 'queue-campaign-once',
    }
    const queued = executeOperation(state, 'campaign.send', sendRequest)
    expect(queued.response.ok).toBe(true)
    expect(queued.state.campaigns.find((campaign) => campaign.id === pending.id)?.status).toBe(
      'queued',
    )
    const deliveries = queued.state.campaignDeliveries.filter(
      (delivery) => delivery.campaignId === pending.id,
    )
    expect(deliveries).toHaveLength(pending.recipientParticipationIds.length)
    expect(deliveries.every((delivery) => delivery.status === 'pending_provider')).toBe(true)
    expect(deliveries.every((delivery) => delivery.attachmentNames.length === 1)).toBe(true)
    expect(
      deliveries.every(
        (delivery) =>
          delivery.attachments.length === 1 &&
          delivery.attachments[0]?.contentType === 'text/calendar; charset=utf-8; method=REQUEST' &&
          delivery.attachments[0]?.content.includes('METHOD:REQUEST\r\n'),
      ),
    ).toBe(true)
    expect(deliveries.every((delivery) => !delivery.body.includes('{{'))).toBe(true)
    expect(deliveries.every((delivery) => !delivery.subject.includes('{{'))).toBe(true)

    const firstDelivery = deliveries[0]
    const renamed = executeOperation(queued.state, 'person.update', {
      input: { personId: firstDelivery.personId, firstName: 'Changed after approval' },
    })
    expect(
      renamed.state.campaignDeliveries.find((delivery) => delivery.id === firstDelivery.id)?.body,
    ).toBe(firstDelivery.body)

    const replayed = executeOperation(queued.state, 'campaign.send', sendRequest)
    expect(replayed.response).toEqual(queued.response)
    expect(
      replayed.state.campaignDeliveries.filter((delivery) => delivery.campaignId === pending.id),
    ).toHaveLength(deliveries.length)
  })

  it('suppresses an unavailable recipient and refuses an entirely undeliverable audience', () => {
    let state = createSeedState()
    const pending = state.campaigns.find((campaign) => campaign.status === 'awaiting_approval')!
    const firstParticipation = state.participations.find(
      (participation) => participation.id === pending.recipientParticipationIds[0],
    )!
    const firstPerson = state.people.find((person) => person.id === firstParticipation.personId)!
    firstPerson.email = 'not-an-email'
    state = executeOperation(state, 'campaign.approve', {
      input: { campaignId: pending.id },
    }).state
    const approved = state.campaigns.find((campaign) => campaign.id === pending.id)!
    const partlySuppressed = executeOperation(state, 'campaign.send', {
      input: { campaignId: approved.id },
    })
    expect(partlySuppressed.response.ok).toBe(true)
    expect(
      partlySuppressed.state.campaignDeliveries.filter(
        (delivery) => delivery.campaignId === pending.id && delivery.status === 'suppressed',
      ),
    ).toHaveLength(1)

    const undeliverable = createSeedState()
    const undeliverableCampaign = undeliverable.campaigns.find(
      (campaign) => campaign.status === 'awaiting_approval',
    )!
    for (const participationId of undeliverableCampaign.recipientParticipationIds) {
      const participation = undeliverable.participations.find(
        (entry) => entry.id === participationId,
      )!
      undeliverable.people.find((person) => person.id === participation.personId)!.email = ''
    }
    const approvedUndeliverable = executeOperation(undeliverable, 'campaign.approve', {
      input: { campaignId: undeliverableCampaign.id },
    }).state
    const failed = executeOperation(approvedUndeliverable, 'campaign.send', {
      input: { campaignId: undeliverableCampaign.id },
    })
    expect(failed.response.error?.code).toBe('INVALID_INPUT')
    expect(failed.state).toBe(approvedUndeliverable)
  })

  it('renders campaign fields and creates a portable RFC 5545 event invite', () => {
    const state = createSeedState()
    const campaign = state.campaigns.find((entry) => entry.id === 'cam_002')!
    const message = renderCampaignMessage(state, campaign, campaign.recipientParticipationIds[0])!
    expect(message.subject).not.toContain('{{')
    expect(message.body).toContain(message.person.firstName)
    expect(message.body).toContain('October 4, 2026')
    expect(message.body).toContain(`/portal/${message.participation.id}`)

    const event = { ...state.events[0], name: 'A very long, useful event; with ünicode' }
    const calendar = eventCalendar(state.workspace, event, '2026-08-09T02:00:00.000Z')
    expect(calendar).toContain('BEGIN:VCALENDAR\r\n')
    expect(calendar).toContain('DTSTART:20261004T130000Z\r\n')
    expect(calendar).toContain('SUMMARY:A very long\\, useful event\\; with ünicode\r\n')
    expect(calendar).toContain('LOCATION:Brooklyn Navy Yard\\, Brooklyn\\, New York\r\n')
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(
      calendar
        .split('\r\n')
        .filter(Boolean)
        .every((line) => new TextEncoder().encode(line).byteLength <= 75),
    ).toBe(true)

    const invitation = eventCalendarInvitation(
      state.workspace,
      event,
      'speaker@example.com',
      '2026-08-09T02:00:00.000Z',
    ).replaceAll('\r\n ', '')
    expect(invitation).toContain('METHOD:REQUEST\r\n')
    expect(invitation).toContain('ORGANIZER:mailto:notifications@programkit.dev\r\n')
    expect(invitation).toContain(
      'ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:speaker@example.com\r\n',
    )
  })

  it('records trusted provider outcomes without closing a campaign early', () => {
    let state = createSeedState()
    const pending = state.campaigns.find((campaign) => campaign.status === 'awaiting_approval')!
    state = executeOperation(state, 'campaign.approve', {
      input: { campaignId: pending.id },
    }).state
    const approved = state.campaigns.find((campaign) => campaign.id === pending.id)!
    state = executeOperation(state, 'campaign.send', {
      input: { campaignId: approved.id },
    }).state
    const deliveries = state.campaignDeliveries.filter(
      (delivery) => delivery.campaignId === pending.id,
    )

    for (const [index, delivery] of deliveries.entries()) {
      const result = executeOperation(state, 'campaign.record-delivery', {
        input: {
          deliveryId: delivery.id,
          status: 'delivered',
          providerMessageId: `cloudflare-message-${index + 1}`,
        },
      })
      expect(result.response.ok).toBe(true)
      state = result.state
      expect(state.campaigns.find((campaign) => campaign.id === pending.id)?.status).toBe(
        index === deliveries.length - 1 ? 'sent' : 'queued',
      )
      expect(state.integrations.find((entry) => entry.kind === 'email')).toMatchObject({
        status: 'connected',
        lastSeenAt: expect.any(String),
      })
    }
  })

  it('requeues failed frozen campaign deliveries without losing attempt evidence', () => {
    let state = createSeedState()
    const pending = state.campaigns.find((campaign) => campaign.status === 'awaiting_approval')!
    state = executeOperation(state, 'campaign.approve', {
      input: { campaignId: pending.id },
    }).state
    const approved = state.campaigns.find((campaign) => campaign.id === pending.id)!
    state = executeOperation(state, 'campaign.send', {
      input: { campaignId: approved.id },
    }).state
    let campaign = state.campaigns.find((entry) => entry.id === pending.id)!
    let delivery = state.campaignDeliveries.find((entry) => entry.campaignId === pending.id)!
    state = executeOperation(state, 'campaign.record-delivery', {
      input: { deliveryId: delivery.id, status: 'failed', lastError: 'Temporary provider error.' },
    }).state
    campaign = state.campaigns.find((entry) => entry.id === pending.id)!
    delivery = state.campaignDeliveries.find((entry) => entry.id === delivery.id)!
    expect(state.integrations.find((entry) => entry.kind === 'email')).toMatchObject({
      status: 'attention',
      lastSeenAt: expect.any(String),
    })

    const retried = executeOperation(state, 'campaign.retry-deliveries', {
      input: { campaignId: campaign.id },
      expectedVersions: { [campaign.id]: campaign.version },
    })
    expect(retried.response.ok).toBe(true)
    expect(
      retried.state.campaignDeliveries.find((entry) => entry.id === delivery.id),
    ).toMatchObject({
      status: 'pending_provider',
      attemptCount: 1,
      lastError: null,
      version: delivery.version + 1,
    })
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
    const receipt = submitted.state.submissionReceiptDeliveries.find(
      (entry) => entry.submissionId === submission.id,
    )
    expect(receipt).toMatchObject({
      recipientName: 'Nia Rivera',
      recipientEmail: 'nia@example.com',
      status: 'pending_provider',
      provider: null,
      attemptCount: 0,
    })
    expect(receipt?.subject).toBe('We received your proposal for AIE NYC 2026')
    expect(receipt?.body).toContain(`Reference: ${submission.id}`)
    expect(submitted.response.data).toMatchObject({
      receiptDelivery: { id: receipt?.id, status: 'pending_provider' },
    })

    const frozenBody = receipt?.body
    submitted.state.submissions.find((entry) => entry.id === submission.id)!.answers.first_name =
      'Changed'
    expect(
      submitted.state.submissionReceiptDeliveries.find((entry) => entry.id === receipt?.id)?.body,
    ).toBe(frozenBody)
  })

  it('records trusted submission-receipt provider outcomes without duplicating retries', () => {
    const state = createSeedState()
    const delivery = state.submissionReceiptDeliveries[0]
    const missingProviderId = executeOperation(state, 'submission.record-receipt-delivery', {
      input: { deliveryId: delivery.id, status: 'delivered' },
      expectedVersions: { [delivery.id]: delivery.version },
    })
    expect(missingProviderId.response.error?.code).toBe('INVALID_INPUT')

    const request = {
      input: {
        deliveryId: delivery.id,
        status: 'delivered',
        providerMessageId: 'cf-email-receipt-001',
      },
      expectedVersions: { [delivery.id]: delivery.version },
      idempotencyKey: 'receipt-delivered-once',
    }
    const delivered = executeOperation(state, 'submission.record-receipt-delivery', request)
    const replayed = executeOperation(
      delivered.state,
      'submission.record-receipt-delivery',
      request,
    )
    expect(delivered.response.ok).toBe(true)
    expect(replayed.response).toEqual(delivered.response)
    expect(replayed.state.submissionReceiptDeliveries).toHaveLength(1)
    expect(replayed.state.submissionReceiptDeliveries[0]).toMatchObject({
      status: 'delivered',
      provider: 'cloudflare_email',
      providerMessageId: 'cf-email-receipt-001',
      attemptCount: 1,
      version: 2,
    })
  })

  it('freezes the published program into a stable Accelevents export outbox', () => {
    const state = createSeedState()
    const preflight = acceleventsExportPreflight(state)
    expect(preflight).toMatchObject({
      canPrepare: true,
      blockers: [],
      sessions: { length: 10 },
      people: { length: 16 },
    })

    const prepared = executeOperation(state, 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
      idempotencyKey: 'prepare-accelevents-v3',
    })
    expect(prepared.response.ok).toBe(true)
    expect(prepared.state.scheduleReleases).toHaveLength(1)
    expect(publicAgenda(prepared.state)).toHaveLength(10)
    const batch = prepared.state.acceleventsExports[0]
    expect(batch).toMatchObject({
      eventUrl: 'aie-nyc-2026',
      scheduleVersion: 3,
      status: 'pending_provider',
      version: 1,
    })
    expect(batch.items.filter((item) => item.resource === 'speaker')).toHaveLength(16)
    expect(batch.items.filter((item) => item.resource === 'session')).toHaveLength(10)
    expect(
      batch.items.find((item) => item.resource === 'speaker' && item.sourceId === 'per_001')
        ?.payload,
    ).toMatchObject({
      externalKey: 'programkit:per_001',
      firstName: 'Robin',
      lastName: 'Sloan',
    })
    expect(
      batch.items.find((item) => item.resource === 'session' && item.sourceId === 'ses_001')
        ?.payload,
    ).toMatchObject({
      externalKey: 'programkit:ses_001',
      title: 'Opening the useful frontier',
      startTime: '2026/10/04 09:00',
      endTime: '2026/10/04 09:40',
      location: 'Main stage',
      format: 'MAIN_STAGE',
      status: 'VISIBLE',
      speakerExternalKeys: ['programkit:per_001'],
    })
    expect(prepared.state.domainEvents.at(-1)?.type).toBe('accelevents.export-prepared')

    const duplicate = executeOperation(prepared.state, 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
    })
    expect(duplicate.response.error?.code).toBe('NO_CHANGES')
    expect(duplicate.state).toBe(prepared.state)
  })

  it('records retryable per-item Accelevents provider evidence and closes a batch', () => {
    let state = executeOperation(createSeedState(), 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
    }).state
    let batch = state.acceleventsExports[0]
    let item = batch.items[0]
    item.providerId = 'acc-speaker-existing'

    const missingError = executeOperation(state, 'accelevents.record-result', {
      input: { exportId: batch.id, itemId: item.id, status: 'failed' },
      expectedVersions: { [item.id]: item.version },
    })
    expect(missingError.response.error?.code).toBe('INVALID_INPUT')

    const failed = executeOperation(state, 'accelevents.record-result', {
      input: {
        exportId: batch.id,
        itemId: item.id,
        status: 'failed',
        lastError: 'Provider rate limit.',
      },
      expectedVersions: { [item.id]: item.version },
    })
    expect(failed.response.ok).toBe(true)
    state = failed.state
    batch = state.acceleventsExports[0]
    item = batch.items.find((entry) => entry.id === item.id)!
    expect(batch.status).toBe('partial')
    expect(item).toMatchObject({
      status: 'failed',
      providerId: 'acc-speaker-existing',
      attemptCount: 1,
      lastError: 'Provider rate limit.',
      version: 2,
    })

    const queuedRetry = executeOperation(state, 'accelevents.retry-export', {
      input: { exportId: batch.id },
      expectedVersions: { [batch.id]: batch.version },
    })
    expect(queuedRetry.response.ok).toBe(true)
    state = queuedRetry.state
    batch = state.acceleventsExports[0]
    item = batch.items.find((entry) => entry.id === item.id)!
    expect(item).toMatchObject({
      status: 'pending_provider',
      providerId: 'acc-speaker-existing',
      attemptCount: 1,
      lastError: null,
      version: 3,
    })

    const retried = executeOperation(state, 'accelevents.record-result', {
      input: {
        exportId: batch.id,
        itemId: item.id,
        status: 'delivered',
        providerId: 'acc-speaker-001',
      },
      expectedVersions: { [item.id]: item.version },
    })
    expect(retried.response.ok).toBe(true)
    state = retried.state
    batch = state.acceleventsExports[0]
    expect(batch.items.find((entry) => entry.id === item.id)).toMatchObject({
      status: 'delivered',
      providerId: 'acc-speaker-001',
      attemptCount: 2,
      lastError: null,
      version: 4,
    })

    for (const pending of batch.items.filter((entry) => entry.status === 'pending_provider')) {
      const result = executeOperation(state, 'accelevents.record-result', {
        input: {
          exportId: batch.id,
          itemId: pending.id,
          status: 'delivered',
          providerId: `acc-${pending.resource}-${pending.sourceId}`,
        },
        expectedVersions: { [pending.id]: pending.version },
        idempotencyKey: `deliver-${pending.id}`,
      })
      expect(result.response.ok).toBe(true)
      state = result.state
      batch = state.acceleventsExports[0]
    }
    expect(batch.status).toBe('delivered')
    expect(batch.items.every((entry) => entry.status === 'delivered')).toBe(true)
    expect(state.integrations.find((entry) => entry.kind === 'accelevents')).toMatchObject({
      status: 'connected',
      lastSeenAt: expect.any(String),
    })
    const nextItems = buildAcceleventsExportItems(state, '2026-08-10T12:00:00.000Z', () =>
      crypto.randomUUID(),
    )
    expect(nextItems.find((entry) => entry.externalKey === item.externalKey)?.providerId).toBe(
      'acc-speaker-001',
    )
  })

  it('guards Accelevents export scope, target identifiers, and published-release readiness', () => {
    const state = createSeedState()
    const scopedOut = executeOperation(state, 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
      actor: { type: 'service', id: 'limited', name: 'Limited', scopes: [] },
    })
    expect(scopedOut.response.error?.code).toBe('FORBIDDEN')

    const invalidTarget = executeOperation(state, 'accelevents.prepare-export', {
      input: { eventUrl: 'https://www.accelevents.com/e/aie-nyc-2026' },
    })
    expect(invalidTarget.response.error?.code).toBe('INVALID_INPUT')

    const withoutRelease = { ...state, scheduleReleases: [] }
    const notReady = executeOperation(withoutRelease, 'accelevents.prepare-export', {
      input: { eventUrl: 'aie-nyc-2026' },
    })
    expect(notReady.response.error?.code).toBe('EXPORT_NOT_READY')

    const missingPublishedSession = {
      ...state,
      sessions: state.sessions.filter((session) => session.id !== 'ses_001'),
    }
    expect(acceleventsExportPreflight(missingPublishedSession)).toMatchObject({
      canPrepare: false,
      blockers: expect.arrayContaining(['Published placement plc_001 has no session.']),
    })
  })

  it('advances a completed finalist, scores the final round, and atomically converts it', () => {
    let state = createSeedState()
    let submission = state.submissions.find((entry) => entry.id === 'sub_002')!
    const advanced = executeOperation(state, 'review.advance-round', {
      input: { submissionId: submission.id },
      expectedVersions: { [submission.id]: submission.version },
    })
    expect(advanced.response.ok).toBe(true)
    state = advanced.state
    submission = state.submissions.find((entry) => entry.id === submission.id)!
    const finalistAssignments = state.reviewerAssignments.filter(
      (entry) => entry.submissionId === submission.id && entry.roundId === 'rnd_finalist_review',
    )
    expect(finalistAssignments).toHaveLength(2)
    expect(new Set(finalistAssignments.map((entry) => entry.reviewerId)).size).toBe(2)
    expect(submissionReviewSummary(state, submission.id)).toMatchObject({
      assigned: 2,
      completed: 0,
      averageScore: null,
    })
    for (const assignment of finalistAssignments) {
      const scored = executeOperation(state, 'review.submit-scorecard', {
        input: {
          assignmentId: assignment.id,
          scores: { crt_relevance: 5, crt_specificity: 5, crt_takeaway: 5 },
          recommendation: 'strong_accept',
          comments: 'Finalist review confirms a clear program fit.',
        },
        expectedVersions: { [assignment.id]: assignment.version },
      })
      expect(scored.response.ok).toBe(true)
      state = scored.state
    }
    expect(submissionReviewSummary(state, submission.id)).toMatchObject({
      assigned: 2,
      completed: 2,
      averageScore: 5,
    })
    submission = state.submissions.find((entry) => entry.id === submission.id)!
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

  it('guards review-round progression, final-round acceptance, scope, and duplicate retries', () => {
    const state = createSeedState()
    const pending = state.submissions.find((entry) => entry.id === 'sub_005')!
    const incomplete = executeOperation(state, 'review.advance-round', {
      input: { submissionId: pending.id },
      expectedVersions: { [pending.id]: pending.version },
    })
    expect(incomplete.response.error?.code).toBe('REVIEWS_INCOMPLETE')
    expect(incomplete.state).toBe(state)

    const scopedOut = executeOperation(state, 'review.advance-round', {
      input: { submissionId: 'sub_002' },
      actor: {
        type: 'reviewer',
        id: 'rev_001',
        name: 'Elena Vasquez',
        scopes: ['reviews:write'],
      },
    })
    expect(scopedOut.response.error?.code).toBe('FORBIDDEN')

    const eligible = state.submissions.find((entry) => entry.id === 'sub_002')!
    const request = {
      input: { submissionId: eligible.id },
      expectedVersions: { [eligible.id]: eligible.version },
      idempotencyKey: 'advance-sub-002-finalist',
    }
    const advanced = executeOperation(state, 'review.advance-round', request)
    expect(advanced.response.ok).toBe(true)
    expect(
      advanced.state.domainEvents.find(
        (event) =>
          event.operation === 'review.advance-round' && event.type === 'review.round-advanced',
      ),
    ).toMatchObject({
      aggregate: { type: 'submission', id: eligible.id },
      data: { previousRoundId: 'rnd_program_review', roundId: 'rnd_finalist_review' },
    })

    const replayed = executeOperation(advanced.state, 'review.advance-round', request)
    expect(replayed.state).toBe(advanced.state)
    expect(replayed.response).toEqual(advanced.response)
    expect(
      replayed.state.reviewerAssignments.filter(
        (entry) => entry.submissionId === eligible.id && entry.roundId === 'rnd_finalist_review',
      ),
    ).toHaveLength(2)

    const advancedSubmission = advanced.state.submissions.find((entry) => entry.id === eligible.id)!
    const duplicate = executeOperation(advanced.state, 'review.advance-round', {
      input: { submissionId: eligible.id },
      expectedVersions: { [eligible.id]: advancedSubmission.version },
      idempotencyKey: 'advance-sub-002-again',
    })
    expect(duplicate.response.error?.code).toBe('REVIEW_PLAN_COMPLETE')

    const prematureAcceptance = executeOperation(advanced.state, 'review.decide', {
      input: { submissionId: eligible.id, decision: 'accepted' },
      expectedVersions: { [eligible.id]: advancedSubmission.version },
    })
    expect(prematureAcceptance.response.error?.code).toBe('REVIEWS_INCOMPLETE')
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
