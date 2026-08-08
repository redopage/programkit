import type {
  Campaign,
  Participation,
  ReadinessRow,
  ScheduleConflict,
  WorkspaceState,
} from './types.ts'

export function activeEvent(state: WorkspaceState) {
  return state.events.find((event) => event.id === state.activeEventId) ?? state.events[0]
}

export function personName(state: WorkspaceState, personId: string) {
  const person = state.people.find((entry) => entry.id === personId)
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

export function participationPerson(state: WorkspaceState, participation: Participation) {
  return state.people.find((person) => person.id === participation.personId)
}

export function readinessRows(state: WorkspaceState): ReadinessRow[] {
  return state.participations
    .filter((participation) => participation.eventId === state.activeEventId)
    .map((participation) => {
      const person = participationPerson(state, participation)
      const instances = state.requirementInstances.filter(
        (instance) => instance.participationId === participation.id,
      )
      const requirementStatuses = Object.fromEntries(
        instances.map((instance) => [instance.definitionId, instance.status]),
      )
      const relevant = state.requirementDefinitions.filter(
        (definition) => definition.eventId === participation.eventId && definition.required,
      )
      const completed = relevant.filter((definition) => {
        const status = requirementStatuses[definition.id]
        return status === 'approved' || status === 'waived'
      }).length
      const blockers = relevant.filter((definition) => {
        const status = requirementStatuses[definition.id]
        return status === 'not_started' || status === 'revision_requested'
      }).length

      return {
        participationId: participation.id,
        personId: participation.personId,
        personName: person ? `${person.firstName} ${person.lastName}` : 'Unknown person',
        company: person?.company ?? '',
        status: participation.status,
        requirementStatuses,
        completed,
        total: relevant.length,
        blockers,
        percent: relevant.length === 0 ? 100 : Math.round((completed / relevant.length) * 100),
      }
    })
    .sort((left, right) => {
      if (left.blockers !== right.blockers) return right.blockers - left.blockers
      return left.personName.localeCompare(right.personName)
    })
}

export function readinessSummary(state: WorkspaceState) {
  const rows = readinessRows(state)
  const activeRows = rows.filter(
    (row) => row.status !== 'declined' && row.status !== 'withdrawn' && row.status !== 'prospect',
  )
  const ready = activeRows.filter((row) => row.percent === 100).length
  const awaitingReview = state.requirementInstances.filter(
    (instance) => instance.status === 'submitted',
  ).length
  const blockers = activeRows.reduce((total, row) => total + row.blockers, 0)
  return {
    participants: activeRows.length,
    confirmed: activeRows.filter((row) => row.status === 'confirmed').length,
    ready,
    readinessPercent:
      activeRows.length === 0
        ? 100
        : Math.round(activeRows.reduce((sum, row) => sum + row.percent, 0) / activeRows.length),
    awaitingReview,
    blockers,
    unconfirmed: activeRows.filter((row) => row.status === 'invited').length,
  }
}

export function scheduleConflicts(state: WorkspaceState): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const event = activeEvent(state)
  const eventStart = Date.parse(event.startsAt)
  const eventEnd = Date.parse(event.endsAt)
  const placements = state.placements.filter(
    (placement) => placement.eventId === state.activeEventId,
  )

  for (let index = 0; index < placements.length; index += 1) {
    const left = placements[index]
    const startsAt = Date.parse(left.startsAt)
    const endsAt = Date.parse(left.endsAt)
    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt) ||
      startsAt < eventStart ||
      endsAt > eventEnd ||
      endsAt <= startsAt
    ) {
      conflicts.push({
        id: `boundary-${left.id}`,
        severity: 'error',
        type: 'event_boundary',
        message: `Placement ${left.id} falls outside ${event.name} or has an invalid time range.`,
        placementIds: [left.id],
      })
    }

    const leftSession = state.sessions.find((session) => session.id === left.sessionId)
    if (!leftSession || leftSession.eventId !== state.activeEventId) {
      conflicts.push({
        id: `missing-${left.id}`,
        severity: 'error',
        type: 'missing_session',
        message: `Placement ${left.id} points to a missing session.`,
        placementIds: [left.id],
      })
      continue
    }

    if (
      Number.isFinite(startsAt) &&
      Number.isFinite(endsAt) &&
      endsAt - startsAt !== leftSession.durationMinutes * 60_000
    ) {
      conflicts.push({
        id: `duration-${left.id}`,
        severity: 'error',
        type: 'duration_mismatch',
        message: `${leftSession.title} is not allocated its ${leftSession.durationMinutes}-minute duration.`,
        placementIds: [left.id],
      })
    }

    if (leftSession.status === 'cancelled') {
      conflicts.push({
        id: `cancelled-${left.id}`,
        severity: 'error',
        type: 'cancelled_session',
        message: `${leftSession.title} is cancelled but still appears in the schedule.`,
        placementIds: [left.id],
      })
    }

    const track = state.tracks.find((entry) => entry.id === leftSession.trackId)
    if (!track || track.eventId !== state.activeEventId) {
      conflicts.push({
        id: `track-${left.id}`,
        severity: 'error',
        type: 'missing_track',
        message: `${leftSession.title} points to a missing track.`,
        placementIds: [left.id],
      })
    }

    for (const participationId of leftSession.participantIds) {
      const participation = state.participations.find((entry) => entry.id === participationId)
      if (!participation || participation.eventId !== state.activeEventId) {
        conflicts.push({
          id: `participant-${participationId}-${left.id}`,
          severity: 'error',
          type: 'missing_participant',
          message: `${leftSession.title} points to a missing participant.`,
          placementIds: [left.id],
        })
      }
    }

    const room = state.rooms.find((entry) => entry.id === left.roomId)
    if (!room || room.eventId !== state.activeEventId) {
      conflicts.push({
        id: `room-missing-${left.id}`,
        severity: 'error',
        type: 'missing_room',
        message: `${leftSession.title} points to a missing room.`,
        placementIds: [left.id],
      })
    } else if (leftSession.expectedAttendance > room.capacity) {
      conflicts.push({
        id: `capacity-${left.id}`,
        severity: 'warning',
        type: 'capacity',
        message: `${leftSession.title} exceeds ${room.name} capacity by ${leftSession.expectedAttendance - room.capacity}.`,
        placementIds: [left.id],
      })
    }

    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
      const right = placements[otherIndex]
      const rightStartsAt = Date.parse(right.startsAt)
      const rightEndsAt = Date.parse(right.endsAt)
      const overlaps =
        Number.isFinite(startsAt) &&
        Number.isFinite(endsAt) &&
        Number.isFinite(rightStartsAt) &&
        Number.isFinite(rightEndsAt) &&
        startsAt < rightEndsAt &&
        rightStartsAt < endsAt
      if (!overlaps) continue
      const rightSession = state.sessions.find((session) => session.id === right.sessionId)
      if (!rightSession) continue

      if (room && left.roomId === right.roomId) {
        conflicts.push({
          id: `room-${left.id}-${right.id}`,
          severity: 'error',
          type: 'room_overlap',
          message: `${leftSession.title} and ${rightSession.title} overlap in the same room.`,
          placementIds: [left.id, right.id],
        })
      }

      const sharedParticipants = leftSession.participantIds.filter((participantId) =>
        rightSession.participantIds.includes(participantId),
      )
      for (const participantId of sharedParticipants) {
        const participation = state.participations.find((entry) => entry.id === participantId)
        const name = participation ? personName(state, participation.personId) : 'A participant'
        conflicts.push({
          id: `person-${participantId}-${left.id}-${right.id}`,
          severity: 'error',
          type: 'person_overlap',
          message: `${name} is scheduled in two sessions at the same time.`,
          placementIds: [left.id, right.id],
        })
      }
    }
  }

  return conflicts
}

export function audienceForCampaign(state: WorkspaceState, campaign: Campaign) {
  const rows = readinessRows(state)
  const active = state.participations.filter(
    (participation) =>
      participation.eventId === campaign.eventId &&
      participation.status !== 'declined' &&
      participation.status !== 'withdrawn' &&
      participation.status !== 'prospect',
  )

  if (campaign.audience === 'all_active') return active.map((participation) => participation.id)
  if (campaign.audience === 'unconfirmed')
    return active
      .filter((participation) => participation.status === 'invited')
      .map((participation) => participation.id)
  if (campaign.audience === 'missing_requirements')
    return rows
      .filter((row) => row.blockers > 0 && row.status !== 'prospect')
      .map((row) => row.participationId)
  return campaign.recipientParticipationIds
}

export function publicAgenda(state: WorkspaceState) {
  const release = (state.scheduleReleases ?? [])
    .filter((entry) => entry.eventId === state.activeEventId)
    .sort((left, right) => right.version - left.version)[0]

  if (!release) return []

  return [...release.placements]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((placement) => {
      const session = state.sessions.find((entry) => entry.id === placement.sessionId)
      const room = state.rooms.find((entry) => entry.id === placement.roomId)
      const track = state.tracks.find((entry) => entry.id === session?.trackId)
      const speakers = (session?.participantIds ?? []).map((participationId) => {
        const participation = state.participations.find((entry) => entry.id === participationId)
        if (!participation) return null
        const person = participationPerson(state, participation)
        return person
          ? {
              id: person.id,
              name: `${person.firstName} ${person.lastName}`,
              company: participation.publicCompany,
              title: participation.publicTitle,
              avatarUrl: person.avatarUrl,
            }
          : null
      })

      return {
        placement,
        session,
        room,
        track,
        speakers: speakers.filter((speaker) => speaker !== null),
      }
    })
}
