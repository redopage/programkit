import { describe, expect, it } from 'vitest'

import {
  hostedPublicEventId,
  isApiKeyAccessiblePath,
  isApiKeyCredentialPath,
  isHostedDemoReset,
  normalizeHostedEventCreateInput,
  parseApiKeyToken,
  runtimeIntegrations,
} from '../apps/cloudflare/src/worker.ts'

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

describe('hosted API key routing', () => {
  it('extracts only the non-secret event and key identifiers from a live token', () => {
    const token = `pk_live_${eventId}_key_0123456789abcdef_${'a'.repeat(64)}`

    expect(parseApiKeyToken(token)).toEqual({
      token,
      eventId,
      apiKeyId: 'key_0123456789abcdef',
    })
    expect(parseApiKeyToken(`${token}extra`)).toBeNull()
    expect(parseApiKeyToken('pk_test_not-supported')).toBeNull()
  })

  it('allows the documented integration surface and rejects account or file routes', () => {
    expect(isApiKeyAccessiblePath('/api/v1/events')).toBe(true)
    expect(isApiKeyAccessiblePath(`/api/v1/events/${eventId}/submissions`)).toBe(true)
    expect(isApiKeyAccessiblePath('/api/v1/operations/session.update')).toBe(true)
    expect(isApiKeyAccessiblePath('/api/v1/export')).toBe(true)
    expect(isApiKeyAccessiblePath('/mcp')).toBe(true)

    expect(isApiKeyAccessiblePath('/api/v1/state')).toBe(false)
    expect(isApiKeyAccessiblePath('/api/v1/account')).toBe(false)
    expect(isApiKeyAccessiblePath(`/api/v1/events/${eventId}/api-keys`)).toBe(false)
    expect(isApiKeyAccessiblePath('/api/v1/assets/export')).toBe(false)
    expect(isApiKeyAccessiblePath('/api/v1/integrations/airtable/status')).toBe(false)
  })

  it('resolves API-key credentials for both REST and MCP requests', () => {
    expect(isApiKeyCredentialPath('/api/v1/events')).toBe(true)
    expect(isApiKeyCredentialPath('/mcp')).toBe(true)
    expect(isApiKeyCredentialPath('/login')).toBe(false)
  })
})

describe('hosted event creation', () => {
  it('normalizes complete event details before provisioning a workspace', () => {
    expect(
      normalizeHostedEventCreateInput({
        name: '  DevFlow Conf 2027 ',
        startsAt: '2027-05-12T16:00:00.000Z',
        endsAt: '2027-05-15T00:00:00.000Z',
        timezone: 'America/Los_Angeles',
        venue: ' Moscone West ',
        city: ' San Francisco ',
      }),
    ).toEqual({
      name: 'DevFlow Conf 2027',
      startsAt: '2027-05-12T16:00:00.000Z',
      endsAt: '2027-05-15T00:00:00.000Z',
      timezone: 'America/Los_Angeles',
      venue: 'Moscone West',
      city: 'San Francisco',
    })
  })

  it('rejects incomplete or inverted dates', () => {
    expect(() =>
      normalizeHostedEventCreateInput({
        name: 'DevFlow Conf 2027',
        startsAt: '2027-05-12T16:00:00.000Z',
      }),
    ).toThrow('both a start date and an end date')
    expect(() =>
      normalizeHostedEventCreateInput({
        name: 'DevFlow Conf 2027',
        startsAt: '2027-05-15T00:00:00.000Z',
        endsAt: '2027-05-12T16:00:00.000Z',
      }),
    ).toThrow('end must be after its start')
  })
})

describe('hosted event safety', () => {
  it('reserves the seeded reset for demo deployments', () => {
    const path = '/api/v1/operations/workspace.reset-demo'

    expect(isHostedDemoReset('hosted-app', 'POST', path)).toBe(true)
    expect(isHostedDemoReset('hosted-demo', 'POST', path)).toBe(false)
    expect(isHostedDemoReset('hosted-app', 'GET', path)).toBe(false)
  })
})

describe('hosted runtime status', () => {
  const integrations = [
    {
      id: 'int_email',
      name: 'Transactional email',
      kind: 'email' as const,
      status: 'not_configured' as const,
      detail: 'Seed status.',
      lastSeenAt: null,
    },
    {
      id: 'int_storage',
      name: 'Asset storage',
      kind: 'storage' as const,
      status: 'not_configured' as const,
      detail: 'Seed status.',
      lastSeenAt: null,
    },
    {
      id: 'int_webhook',
      name: 'Program website webhook',
      kind: 'webhook' as const,
      status: 'attention' as const,
      detail: 'Stored event status.',
      lastSeenAt: null,
    },
  ]

  it('reports configured Cloudflare bindings without mutating persisted event state', () => {
    const result = runtimeIntegrations(integrations, { email: true, storage: true })

    expect(result).toEqual([
      expect.objectContaining({ kind: 'email', status: 'connected' }),
      expect.objectContaining({ kind: 'storage', status: 'connected' }),
      expect.objectContaining({ kind: 'webhook', status: 'attention' }),
    ])
    expect(result[0].detail).toContain('Cloudflare Email Service')
    expect(result[1].detail).toContain('Cloudflare R2')
    expect(integrations[0]).toMatchObject({ status: 'not_configured', detail: 'Seed status.' })
  })

  it('keeps unavailable runtime services honest', () => {
    const result = runtimeIntegrations(integrations, { email: false, storage: false })

    expect(result[0]).toMatchObject({
      status: 'not_configured',
      detail: 'Connect an email service before sending real notifications.',
    })
    expect(result[1]).toMatchObject({
      status: 'not_configured',
      detail: 'Connect object storage before accepting file uploads.',
    })
  })
})
