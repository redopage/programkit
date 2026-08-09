import type { Event, Workspace } from './types.ts'

function escapeCalendarText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\r\n', '\\n')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\n')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
}

function calendarTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) throw new Error('Calendar dates must be valid ISO timestamps.')
  return date
    .toISOString()
    .replaceAll('-', '')
    .replaceAll(':', '')
    .replace(/\.\d{3}Z$/u, 'Z')
}

function foldCalendarLine(line: string) {
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
    `UID:${escapeCalendarText(`${event.id}@${workspace.slug}.programkit`)}`,
    `DTSTAMP:${calendarTimestamp(generatedAt)}`,
    `DTSTART:${calendarTimestamp(event.startsAt)}`,
    `DTEND:${calendarTimestamp(event.endsAt)}`,
    `SUMMARY:${escapeCalendarText(event.name)}`,
    `DESCRIPTION:${escapeCalendarText(`Join ${workspace.name} for ${event.name}.`)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`
}
