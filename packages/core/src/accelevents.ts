import type {
  AcceleventsExportItem,
  AcceleventsSessionPayload,
  AcceleventsSpeakerPayload,
  Session,
  WorkspaceState,
} from './types.ts'

function dateTimeParts(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}/${value('month')}/${value('day')} ${value('hour')}:${value('minute')}`
}

function acceleventsSessionFormat(format: Session['format']): AcceleventsSessionPayload['format'] {
  switch (format) {
    case 'keynote':
      return 'MAIN_STAGE'
    case 'workshop':
      return 'WORKSHOP'
    case 'break':
      return 'BREAK'
    case 'talk':
    case 'panel':
      return 'BREAKOUT_SESSION'
  }
}

export function acceleventsExportPreflight(state: WorkspaceState) {
  const event = state.events.find((entry) => entry.id === state.activeEventId)
  const release = event
    ? [...state.scheduleReleases]
        .filter((entry) => entry.eventId === event.id)
        .sort((left, right) => right.version - left.version)[0]
    : undefined
  const blockers: string[] = []
  const warnings: string[] = []
  if (!event) blockers.push('The active event is unavailable.')
  if (!release) blockers.push('Publish a schedule before preparing the Accelevents export.')

  const sessionIds = new Set(release?.placements.map((placement) => placement.sessionId) ?? [])
  const sessions = state.sessions.filter((session) => sessionIds.has(session.id))
  const participationIds = new Set(sessions.flatMap((session) => session.participantIds))
  const participations = state.participations.filter((entry) => participationIds.has(entry.id))
  const personIds = new Set(participations.map((entry) => entry.personId))
  const people = state.people.filter((person) => personIds.has(person.id))

  for (const placement of release?.placements ?? []) {
    if (!state.sessions.some((session) => session.id === placement.sessionId)) {
      blockers.push(`Published placement ${placement.id} has no session.`)
    }
  }
  for (const session of sessions) {
    const placement = release?.placements.find((entry) => entry.sessionId === session.id)
    if (!placement) blockers.push(`${session.title} has no published placement.`)
    if (!state.rooms.some((room) => room.id === placement?.roomId && room.eventId === event?.id)) {
      blockers.push(`${session.title} has no exportable room.`)
    }
    if (
      !state.tracks.some((track) => track.id === session.trackId && track.eventId === event?.id)
    ) {
      blockers.push(`${session.title} has no exportable track.`)
    }
    if (session.format !== 'break' && session.participantIds.length === 0) {
      blockers.push(`${session.title} has no speaker or moderator.`)
    }
  }
  for (const participationId of participationIds) {
    const participation = state.participations.find((entry) => entry.id === participationId)
    const person = participation
      ? state.people.find((entry) => entry.id === participation.personId)
      : undefined
    if (!participation || !person) blockers.push(`Participant ${participationId} is unavailable.`)
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(person.email)) {
      blockers.push(`${person.firstName} ${person.lastName} needs a deliverable email address.`)
    }
  }
  if (people.some((person) => !person.avatarUrl)) {
    warnings.push('One or more speakers have no image URL; their profiles will export without one.')
  }

  return {
    event: event ?? null,
    release: release ?? null,
    sessions,
    participations,
    people,
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
    canPrepare: Boolean(event && release && sessions.length > 0 && blockers.length === 0),
  }
}

export function buildAcceleventsExportItems(
  state: WorkspaceState,
  timestamp: string,
  createItemId: () => string,
): AcceleventsExportItem[] {
  const plan = acceleventsExportPreflight(state)
  if (!plan.event || !plan.release || !plan.canPrepare) return []
  const previousProviderId = (resource: AcceleventsExportItem['resource'], externalKey: string) =>
    state.acceleventsExports
      .flatMap((entry) => entry.items)
      .find(
        (entry) =>
          entry.resource === resource &&
          entry.externalKey === externalKey &&
          Boolean(entry.providerId),
      )?.providerId ?? null

  const speakerItems: AcceleventsExportItem[] = plan.people.map((person) => {
    const participations = plan.participations.filter((entry) => entry.personId === person.id)
    const participation = participations[0]!
    const payload: AcceleventsSpeakerPayload = {
      sourceId: person.id,
      externalKey: `programkit:${person.id}`,
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email.trim().toLowerCase(),
      title: participation.publicTitle || person.title,
      company: participation.publicCompany || person.company,
      bio: person.bio,
      imageUrl: person.avatarUrl,
      moderator: participations.some((entry) => entry.roles.includes('moderator')),
    }
    return {
      id: createItemId(),
      resource: 'speaker',
      sourceId: person.id,
      externalKey: payload.externalKey,
      payload,
      status: 'pending_provider',
      providerId: previousProviderId('speaker', payload.externalKey),
      attemptCount: 0,
      lastError: null,
      updatedAt: timestamp,
      version: 1,
    }
  })

  const sessionItems: AcceleventsExportItem[] = plan.release.placements.map((placement) => {
    const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
    const room = state.rooms.find((entry) => entry.id === placement.roomId)!
    const track = state.tracks.find((entry) => entry.id === session.trackId)!
    const speakerExternalKeys = session.participantIds.map((participationId) => {
      const participation = state.participations.find((entry) => entry.id === participationId)!
      return `programkit:${participation.personId}`
    })
    const payload: AcceleventsSessionPayload = {
      sourceId: session.id,
      externalKey: `programkit:${session.id}`,
      title: session.title,
      description: session.summary,
      startTime: dateTimeParts(placement.startsAt, plan.event!.timezone),
      endTime: dateTimeParts(placement.endsAt, plan.event!.timezone),
      location: room.name,
      format: acceleventsSessionFormat(session.format),
      status: 'VISIBLE',
      capacity: room.capacity,
      track: track.name,
      speakerExternalKeys,
    }
    return {
      id: createItemId(),
      resource: 'session',
      sourceId: session.id,
      externalKey: payload.externalKey,
      payload,
      status: 'pending_provider',
      providerId: previousProviderId('session', payload.externalKey),
      attemptCount: 0,
      lastError: null,
      updatedAt: timestamp,
      version: 1,
    }
  })

  return [...speakerItems, ...sessionItems]
}
