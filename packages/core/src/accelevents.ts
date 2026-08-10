import { createStoredZip, recordsToCsv, type ZipFile } from './export.ts'
import { activeEvent, participationPerson } from './selectors.ts'
import type {
  Event,
  Participation,
  Person,
  ScheduleRelease,
  Session,
  WorkspaceState,
} from './types.ts'

const speakerColumns = [
  'Speaker Id',
  'First Name',
  'Last Name',
  'Email',
  'Pronouns',
  'Title',
  'Company',
  'Bio',
  'LinkedIn URL',
  'Instragram Handle',
  'Twitter Handle',
  'Override Profile',
  'Allow to Edit Sessions',
  'Primary Sessions',
  'Secondary Sessions',
] as const

const sessionColumns = [
  'ID',
  'Title',
  'Format',
  'Session Type',
  'Start Date',
  'Start Time',
  'End Time',
  'Full Detail',
  'Capacity',
  'Short Description',
  'Tags',
  'Tracks',
  'Location Id',
  'Primary Speaker',
  'Secondary Speaker',
] as const

function safeSlug(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/giu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLocaleLowerCase()
}

function latestPublishedRelease(state: WorkspaceState, event: Event) {
  const releases = state.scheduleReleases
    .filter((release) => release.eventId === event.id)
    .sort((left, right) => right.version - left.version)
  return (
    releases.find((release) => release.version === event.publishedScheduleVersion) ?? releases[0]
  )
}

function dateParts(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .formatToParts(new Date(value))
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== 'literal') result[part.type] = part.value
      return result
    }, {})
  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}`,
  }
}

function acceleventsFormat(format: Session['format']) {
  switch (format) {
    case 'keynote':
      return 'MAIN_STAGE_SESSION'
    case 'workshop':
      return 'WORKSHOP'
    case 'break':
      return 'BREAK'
    default:
      return 'REGULAR_SESSION'
  }
}

function sessionType(event: Event) {
  return event.venue.trim() || event.city.trim() ? 'IN_PERSON' : 'VIRTUAL'
}

function participantRecord(
  state: WorkspaceState,
  participationId: string,
): { participation: Participation; person: Person } | null {
  const participation = state.participations.find((entry) => entry.id === participationId)
  if (!participation) return null
  const person = participationPerson(state, participation)
  return person ? { participation, person } : null
}

function speakerRows(state: WorkspaceState, sessions: readonly Session[], warnings: string[]) {
  const sessionTitlesByParticipation = new Map<string, string[]>()
  for (const session of sessions) {
    for (const participationId of session.participantIds) {
      const titles = sessionTitlesByParticipation.get(participationId) ?? []
      titles.push(session.title)
      sessionTitlesByParticipation.set(participationId, titles)
    }
  }

  const seenEmails = new Set<string>()
  const rows: Record<string, unknown>[] = []
  for (const participationId of sessionTitlesByParticipation.keys()) {
    const record = participantRecord(state, participationId)
    if (!record) {
      warnings.push(`A published session references missing participant ${participationId}.`)
      continue
    }
    const emailKey = record.person.email.trim().toLocaleLowerCase()
    if (!emailKey) {
      warnings.push(`${record.person.firstName} ${record.person.lastName} has no email address.`)
      continue
    }
    if (seenEmails.has(emailKey)) continue
    seenEmails.add(emailKey)
    rows.push({
      'Speaker Id': '',
      'First Name': record.person.firstName,
      'Last Name': record.person.lastName,
      Email: record.person.email,
      Pronouns: '',
      Title: record.participation.publicTitle || record.person.title,
      Company: record.participation.publicCompany || record.person.company,
      Bio: record.person.bio,
      'LinkedIn URL': '',
      'Instragram Handle': '',
      'Twitter Handle': '',
      'Override Profile': 'FALSE',
      'Allow to Edit Sessions': 'TRUE',
      'Primary Sessions': '',
      'Secondary Sessions': '',
    })
  }
  return rows
}

function publishedProgram(
  state: WorkspaceState,
  event: Event,
  release: ScheduleRelease,
  warnings: string[],
) {
  const sessions: Session[] = []
  const rows: Record<string, unknown>[] = []
  for (const placement of [...release.placements].sort((left, right) =>
    left.startsAt.localeCompare(right.startsAt),
  )) {
    const session = state.sessions.find(
      (entry) => entry.id === placement.sessionId && entry.eventId === event.id,
    )
    if (!session || session.status !== 'ready') {
      warnings.push(`Placement ${placement.id} does not reference a ready session.`)
      continue
    }
    const room = state.rooms.find((entry) => entry.id === placement.roomId)
    const track = state.tracks.find((entry) => entry.id === session.trackId)
    const participants = session.participantIds
      .map((participationId) => participantRecord(state, participationId))
      .filter((entry) => entry !== null)
    const start = dateParts(placement.startsAt, event.timezone)
    const end = dateParts(placement.endsAt, event.timezone)
    if (start.date !== end.date) {
      warnings.push(`${session.title} crosses midnight; verify its end date after import.`)
    }
    sessions.push(session)
    rows.push({
      ID: '',
      Title: session.title,
      Format: acceleventsFormat(session.format),
      'Session Type': sessionType(event),
      'Start Date': start.date,
      'Start Time': start.time,
      'End Time': end.time,
      'Full Detail': session.summary,
      Capacity: room?.capacity ?? session.expectedAttendance,
      'Short Description': session.summary.slice(0, 240),
      Tags: '',
      Tracks: track?.name ?? '',
      'Location Id': 0,
      'Primary Speaker': participants[0]?.person.email ?? '',
      'Secondary Speaker': participants
        .slice(1)
        .map((entry) => entry.person.email)
        .join(','),
    })
  }
  return { sessions, rows }
}

export interface AcceleventsExport {
  filename: string
  archive: Uint8Array
  files: readonly ZipFile[]
  eventId: string
  releaseVersion: number
  speakerCount: number
  sessionCount: number
  warnings: readonly string[]
}

export function createAcceleventsExport(
  state: WorkspaceState,
  exportedAt: string,
): AcceleventsExport {
  const event = activeEvent(state)
  if (!event) throw new Error('Create an event before exporting to Accelevents.')
  const release = latestPublishedRelease(state, event)
  if (!release) throw new Error('Publish the agenda before exporting to Accelevents.')

  const warnings: string[] = []
  const program = publishedProgram(state, event, release, warnings)
  const speakers = speakerRows(state, program.sessions, warnings)
  const rooms = state.rooms
    .filter((room) => room.eventId === event.id)
    .map((room) => ({
      'ProgramKit Room Id': room.id,
      'Room Name': room.name,
      Capacity: room.capacity,
      'Accelevents Location Id': '',
    }))
  const readme = [
    `Accelevents handoff for ${event.name}`,
    '',
    'Import order',
    '1. Import speakers.csv in Accelevents Speakers.',
    '2. Create or confirm Locations in Accelevents.',
    '3. If you use Locations, copy their numeric IDs into sessions.csv using rooms-reference.csv.',
    '4. Import sessions.csv in Accelevents Sessions.',
    '',
    'ProgramKit exports Location Id as 0 so the session upload remains valid before locations are mapped.',
    'Speaker assignments use email addresses. Review the Accelevents preview before finishing either import.',
    `Dates and times are formatted in ${event.timezone}.`,
    `Published schedule version: ${release.version}.`,
    '',
    ...(warnings.length > 0 ? ['Warnings', ...warnings.map((warning) => `- ${warning}`), ''] : []),
    'Generated by ProgramKit.',
  ].join('\n')
  const manifest = {
    format: 'programkit.accelevents.v1',
    exportedAt,
    event: { id: event.id, name: event.name, timezone: event.timezone },
    releaseVersion: release.version,
    counts: { speakers: speakers.length, sessions: program.rows.length, rooms: rooms.length },
    warnings,
  }
  const files: ZipFile[] = [
    { name: 'README.txt', text: readme },
    { name: 'speakers.csv', text: recordsToCsv(speakers, speakerColumns) },
    { name: 'sessions.csv', text: recordsToCsv(program.rows, sessionColumns) },
    {
      name: 'rooms-reference.csv',
      text: recordsToCsv(rooms, [
        'ProgramKit Room Id',
        'Room Name',
        'Capacity',
        'Accelevents Location Id',
      ]),
    },
    { name: 'manifest.json', text: `${JSON.stringify(manifest, null, 2)}\n` },
  ]
  const slug = safeSlug(event.slug || event.name) || 'programkit-event'
  return {
    filename: `${slug}-accelevents-${exportedAt.slice(0, 10)}.zip`,
    archive: createStoredZip(files, new Date(exportedAt)),
    files,
    eventId: event.id,
    releaseVersion: release.version,
    speakerCount: speakers.length,
    sessionCount: program.rows.length,
    warnings,
  }
}
