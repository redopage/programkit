import type { Event, Workspace, WorkspaceState } from './types.ts'

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
      `UID:${calendarEscape(`${event.id}-${session.id}`)}@programkit.dev`,
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

function escapeInvitationText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

function invitationTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Calendar dates must be valid ISO timestamps.')
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/u, 'Z')
}

function foldInvitationLine(line: string) {
  const encoder = new TextEncoder()
  const chunks: string[] = []
  let chunk = ''
  let bytes = 0

  for (const character of line) {
    const characterBytes = encoder.encode(character).byteLength
    const limit = chunks.length === 0 ? 75 : 74
    if (chunk && bytes + characterBytes > limit) {
      chunks.push(chunk)
      chunk = character
      bytes = characterBytes
    } else {
      chunk += character
      bytes += characterBytes
    }
  }
  chunks.push(chunk)
  return chunks.map((entry, index) => (index === 0 ? entry : ` ${entry}`)).join('\r\n')
}

export function eventCalendarFilename(event: Event) {
  const slug = event.slug
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
  return `${slug || 'event'}-invite.ics`
}

export function eventCalendar(
  workspace: Workspace,
  event: Event,
  generatedAt: string = new Date().toISOString(),
) {
  const location = [event.venue, event.city].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProgramKit//Event Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeInvitationText(`${event.id}@${workspace.slug}.programkit`)}`,
    `DTSTAMP:${invitationTimestamp(generatedAt)}`,
    `DTSTART:${invitationTimestamp(event.startsAt)}`,
    `DTEND:${invitationTimestamp(event.endsAt)}`,
    `SUMMARY:${escapeInvitationText(event.name)}`,
    `DESCRIPTION:${escapeInvitationText(`Join ${workspace.name} for ${event.name}.`)}`,
    `LOCATION:${escapeInvitationText(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldInvitationLine).join('\r\n')}\r\n`
}

export function eventCalendarInvitation(
  workspace: Workspace,
  event: Event,
  attendeeEmail: string,
  generatedAt: string = new Date().toISOString(),
  organizerEmail = 'notifications@programkit.dev',
) {
  const attendee = attendeeEmail.trim().toLocaleLowerCase()
  const organizer = organizerEmail.trim().toLocaleLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(attendee)) {
    throw new Error('A calendar invitation requires a valid attendee email address.')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(organizer)) {
    throw new Error('A calendar invitation requires a valid organizer email address.')
  }
  const location = [event.venue, event.city].filter(Boolean).join(', ')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ProgramKit//Event Invitation//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${escapeInvitationText(`${event.id}@${workspace.slug}.programkit`)}`,
    `DTSTAMP:${invitationTimestamp(generatedAt)}`,
    `DTSTART:${invitationTimestamp(event.startsAt)}`,
    `DTEND:${invitationTimestamp(event.endsAt)}`,
    `SUMMARY:${escapeInvitationText(event.name)}`,
    `DESCRIPTION:${escapeInvitationText(`Join ${workspace.name} for ${event.name}.`)}`,
    `LOCATION:${escapeInvitationText(location)}`,
    `ORGANIZER:mailto:${organizer}`,
    `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${attendee}`,
    'SEQUENCE:0',
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldInvitationLine).join('\r\n')}\r\n`
}
