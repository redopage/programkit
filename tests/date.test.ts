import { describe, expect, it } from 'vitest'

import { toZonedDateTimeInput, zonedDateTimeInputToIso } from '../packages/web/src/lib/date.ts'

describe('event timezone conversion', () => {
  it('uses the zone offset in effect on the selected date', () => {
    expect(zonedDateTimeInputToIso('2026-10-04T09:00', 'America/New_York')).toBe(
      '2026-10-04T13:00:00.000Z',
    )
    expect(zonedDateTimeInputToIso('2026-01-04T09:00', 'America/New_York')).toBe(
      '2026-01-04T14:00:00.000Z',
    )
  })

  it('round-trips event-local values', () => {
    const iso = zonedDateTimeInputToIso('2026-10-04T09:30', 'Europe/London')
    expect(toZonedDateTimeInput(iso, 'Europe/London')).toBe('2026-10-04T09:30')
  })

  it('rejects a local time skipped by daylight saving time', () => {
    expect(() => zonedDateTimeInputToIso('2026-03-08T02:30', 'America/New_York')).toThrow(
      'does not exist',
    )
  })

  it('rejects malformed local input', () => {
    expect(() => zonedDateTimeInputToIso('not-a-date', 'America/New_York')).toThrow(
      'valid local date and time',
    )
  })
})
