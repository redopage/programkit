import type { WorkspaceState } from './types.ts'

export interface CalendarAttachment {
  filename: string
  contentType: 'text/calendar; method=PUBLISH; charset=utf-8'
  content: string
  eventCount: number
}

export function calendarEscape(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(',', '\\,')
    .replaceAll(';', '\\;')
    .replaceAll(/\r?\n/gu, '\\n')
}

export function calendarDate(value: string) {
  return new Date(value).toISOString().replaceAll(/[-:]/gu, '').replace('.000', '')
}

export function calendarUid(sessionId: string) {
  return `${calendarEscape(sessionId)}@programkit.dev`
}

function calendarFilename(value: string) {
  const normalized = value
    .normalize('NFKD')
    .replaceAll(/[^a-zA-Z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .toLowerCase()
  return normalized || 'speaker'
}

export function calendarAttachmentForParticipation(
  state: WorkspaceState,
  participationId: string,
): CalendarAttachment | null {
  const participation = state.participations.find(
    (entry) => entry.id === participationId && entry.eventId === state.activeEventId,
  )
  const person = participation
    ? state.people.find((entry) => entry.id === participation.personId)
    : null
  const event = state.events.find((entry) => entry.id === state.activeEventId)
  const release = [...(state.scheduleReleases ?? [])]
    .filter((entry) => entry.eventId === state.activeEventId)
    .sort((left, right) => right.version - left.version)[0]
  if (!participation || !person || !event || !release) return null

  const sessions = release.placements
    .map((placement) => {
      const session = state.sessions.find(
        (entry) =>
          entry.id === placement.sessionId && entry.participantIds.includes(participation.id),
      )
      const room = state.rooms.find((entry) => entry.id === placement.roomId)
      return session ? { placement, session, room } : null
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((left, right) => left.placement.startsAt.localeCompare(right.placement.startsAt))
  if (sessions.length === 0) return null

  const calendar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProgramKit//Speaker schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarEscape(`${event.name} · ${person.firstName} ${person.lastName}`)}`,
    ...sessions.flatMap(({ placement, session, room }) => [
      'BEGIN:VEVENT',
      `UID:${calendarUid(session.id)}`,
      `DTSTAMP:${calendarDate(release.publishedAt)}`,
      `DTSTART:${calendarDate(placement.startsAt)}`,
      `DTEND:${calendarDate(placement.endsAt)}`,
      `SEQUENCE:${release.version}`,
      'STATUS:CONFIRMED',
      `SUMMARY:${calendarEscape(session.title)}`,
      ...(session.summary ? [`DESCRIPTION:${calendarEscape(session.summary)}`] : []),
      `LOCATION:${calendarEscape(room?.name ?? event.venue)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
    '',
  ].join('\r\n')

  return {
    filename: `${calendarFilename(event.slug)}-${calendarFilename(person.lastName)}-schedule.ics`,
    contentType: 'text/calendar; method=PUBLISH; charset=utf-8',
    content: calendar,
    eventCount: sessions.length,
  }
}
