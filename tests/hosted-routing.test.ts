import { describe, expect, it } from 'vitest'

import { hostedPublicEventId } from '../apps/cloudflare/src/worker.ts'

const eventId = 'evt_1234567890abcdef12345678'

function documentRequest(path: string, cookie?: string) {
  return new Request(`https://app.programkit.dev${path}`, {
    headers: {
      accept: 'text/html',
      ...(cookie ? { cookie } : {}),
    },
  })
}

describe('hosted public event routing', () => {
  it('selects the event from an explicit public link', () => {
    const request = documentRequest(`/submit/cfp?event=${eventId}`)

    expect(hostedPublicEventId(request, new URL(request.url))).toBe(eventId)
  })

  it('keeps follow-up public documents on the selected event', () => {
    const request = documentRequest(
      '/submit/cfp/mine/speaker_key',
      `programkit_public_event=${eventId}`,
    )

    expect(hostedPublicEventId(request, new URL(request.url))).toBe(eventId)
  })

  it('keeps participant account access on the selected event', () => {
    const request = documentRequest(`/access?event=${eventId}`)

    expect(hostedPublicEventId(request, new URL(request.url))).toBe(eventId)
  })

  it('does not use the public event cookie for staff documents', () => {
    const request = documentRequest('/submissions', `programkit_public_event=${eventId}`)

    expect(hostedPublicEventId(request, new URL(request.url))).toBeNull()
  })
})
