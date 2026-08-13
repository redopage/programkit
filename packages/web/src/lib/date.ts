export function eventDateTime(iso: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-US', { ...options, timeZone }).format(new Date(iso))
}

export function eventTimeZoneLabel(iso: string, timeZone: string) {
  return (
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'short',
    })
      .formatToParts(new Date(iso))
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone
  )
}

export function toZonedDateTimeInput(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(iso))
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}T${value.hour}:${value.minute}`
}

export function eventDayKey(iso: string, timeZone: string) {
  return toZonedDateTimeInput(iso, timeZone).slice(0, 10)
}

export function eventCalendarDays(startsAt: string, endsAt: string, timeZone: string) {
  const first = eventDayKey(startsAt, timeZone)
  const last = eventDayKey(endsAt, timeZone)
  const days: string[] = []
  let cursor = first
  while (cursor <= last && days.length < 31) {
    days.push(cursor)
    const next = new Date(`${cursor}T12:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    cursor = next.toISOString().slice(0, 10)
  }
  return days
}

export function eventCalendarDayLabel(day: string, long = false) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: long ? 'long' : undefined,
    month: long ? 'long' : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`))
}

export function zonedDateTimeInputToIso(value: string, timeZone: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u)
  if (!match) throw new Error('Enter a valid local date and time.')
  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  )
  let candidate = desired
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  })
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    )
    const displayed = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    )
    const correction = desired - displayed
    candidate += correction
    if (correction === 0) break
  }
  const verified = Object.fromEntries(
    formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
  )
  const verifiedLocal = `${verified.year}-${verified.month}-${verified.day}T${verified.hour}:${verified.minute}`
  if (verifiedLocal !== value) {
    throw new Error(`That local time does not exist in ${timeZone}.`)
  }
  return new Date(candidate).toISOString()
}
