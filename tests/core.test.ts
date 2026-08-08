import { describe, expect, it } from 'vitest'

import {
  createSeedState,
  executeOperation,
  publicAgenda,
  readinessSummary,
  scheduleConflicts,
} from '@crm-library/core'

describe('CRM operation engine', () => {
  it('creates a useful deterministic workspace', () => {
    const state = createSeedState()
    expect(state.people).toHaveLength(16)
    expect(state.participations).toHaveLength(16)
    expect(state.sessions).toHaveLength(10)
    expect(state.scheduleReleases).toHaveLength(1)
    expect(state.events[0].publishedScheduleVersion).toBe(3)
    expect(publicAgenda(state)).toHaveLength(10)
    expect(readinessSummary(state).blockers).toBeGreaterThan(0)
    expect(
      scheduleConflicts(state).filter((conflict) => conflict.severity === 'error'),
    ).toHaveLength(0)
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
})
