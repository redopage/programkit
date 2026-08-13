import { describe, expect, it } from 'vitest'

import {
  canDeleteStoredAssets,
  browserSecurityHeaders,
  configuredAppOrigin,
  docsMarkdownPathname,
  eventLogoStorageKeyFromUrl,
  hostedPublicEventId,
  isApiKeyAccessiblePath,
  isApiKeyCredentialPath,
  isHostedDemoReset,
  isHostedRecoveryPath,
  isHostedSiteDocument,
  isWorkspaceCrmPath,
  normalizeHostedEventCreateInput,
  parseApiKeyToken,
  prefersMarkdown,
  publicOperationalResponse,
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

  it('keeps uploaded logo objects scoped to the event in their public URL', () => {
    const assetId = 'a'.repeat(32)
    const logoUrl = `/public/v1/events/${eventId}/logo/${assetId}?event=${eventId}`

    expect(eventLogoStorageKeyFromUrl(logoUrl, eventId)).toBe(`${eventId}/branding/logo-${assetId}`)
    expect(
      eventLogoStorageKeyFromUrl(
        `/public/v1/events/${eventId}/logo/${assetId}?event=evt_ffffffffffffffffffffffff`,
        eventId,
      ),
    ).toBeNull()
  })
})

describe('hosted project site routing', () => {
  it('keeps documentation pages public without opening application routes', () => {
    expect(isHostedSiteDocument('/')).toBe(true)
    expect(isHostedSiteDocument('/docs')).toBe(true)
    expect(isHostedSiteDocument('/docs/self-hosting/cloudflare')).toBe(true)
    expect(isHostedSiteDocument('/docs/self-hosting/cloudflare.md')).toBe(true)
    expect(isHostedSiteDocument('/docs.md')).toBe(true)
    expect(isHostedSiteDocument('/llms.txt')).toBe(true)
    expect(isHostedSiteDocument('/llms-full.txt')).toBe(true)
    expect(isHostedSiteDocument('/sitemap.xml')).toBe(true)
    expect(isHostedSiteDocument('/privacy')).toBe(true)

    expect(isHostedSiteDocument('/forms')).toBe(false)
    expect(isHostedSiteDocument('/api/v1/state')).toBe(false)
  })

  it('maps human documentation routes to explicit Markdown resources', () => {
    expect(docsMarkdownPathname('/docs')).toBe('/docs.md')
    expect(docsMarkdownPathname('/docs/')).toBe('/docs.md')
    expect(docsMarkdownPathname('/docs/self-hosting/cloudflare')).toBe(
      '/docs/self-hosting/cloudflare.md',
    )
    expect(docsMarkdownPathname('/docs/self-hosting/cloudflare/')).toBe(
      '/docs/self-hosting/cloudflare.md',
    )
    expect(docsMarkdownPathname('/docs/self-hosting/cloudflare.md')).toBeNull()
    expect(docsMarkdownPathname('/forms')).toBeNull()
  })

  it('negotiates Markdown only when the client prefers it over HTML', () => {
    const request = (accept: string) =>
      new Request('https://programkit.dev/docs', { headers: { accept } })

    expect(prefersMarkdown(request('text/markdown'))).toBe(true)
    expect(prefersMarkdown(request('text/markdown, text/html;q=0.8'))).toBe(true)
    expect(prefersMarkdown(request('text/html, text/markdown;q=0.8'))).toBe(false)
    expect(prefersMarkdown(request('text/html,application/xhtml+xml,*/*;q=0.8'))).toBe(false)
    expect(prefersMarkdown(request('*/*'))).toBe(false)
  })
})

describe('hosted canonical origins', () => {
  it('uses an explicit canonical origin when configured', () => {
    expect(
      configuredAppOrigin(
        { PROGRAMKIT_APP_ORIGIN: 'https://events.example.com' },
        new URL('https://programkit.workers.dev/login'),
      ),
    ).toBe('https://events.example.com')
  })

  it('keeps workers.dev links on the current installation when no custom origin is configured', () => {
    expect(
      configuredAppOrigin({}, new URL('https://my-programkit.example.workers.dev/login')),
    ).toBe('https://my-programkit.example.workers.dev')
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

  it('recognizes only the read-only recovery inspection surface', () => {
    expect(isHostedRecoveryPath('GET', '/api/v1/recovery')).toBe(true)
    expect(isHostedRecoveryPath('POST', '/api/v1/recovery/bookmark')).toBe(true)
    expect(isHostedRecoveryPath('POST', '/api/v1/recovery')).toBe(false)
    expect(isHostedRecoveryPath('POST', '/api/v1/recovery/restore')).toBe(false)
    expect(isApiKeyAccessiblePath('/api/v1/recovery')).toBe(false)
  })

  it('reserves stored-file deletion for the hosted event owner', () => {
    expect(canDeleteStoredAssets('hosted-app', 'owner')).toBe(true)
    expect(canDeleteStoredAssets('hosted-app', 'admin')).toBe(false)
    expect(canDeleteStoredAssets('hosted-app', 'member')).toBe(false)
    expect(canDeleteStoredAssets('hosted-app', null)).toBe(false)
    expect(canDeleteStoredAssets('single-workspace')).toBe(true)
    expect(canDeleteStoredAssets('hosted-demo')).toBe(true)
  })
})

describe('CRM routing', () => {
  it('adapts the organization CRM surface to one workspace outside the hosted app', () => {
    expect(isWorkspaceCrmPath('single-workspace', '/api/v1/crm/state')).toBe(true)
    expect(isWorkspaceCrmPath('hosted-demo', '/api/v1/crm/operations/person.update')).toBe(true)

    expect(isWorkspaceCrmPath('hosted-app', '/api/v1/crm/state')).toBe(false)
    expect(isWorkspaceCrmPath('hosted-demo', '/api/v1/state')).toBe(false)
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
      id: 'int_calendar',
      name: 'Calendar sync',
      kind: 'calendar' as const,
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
      expect.objectContaining({
        kind: 'calendar',
        name: 'Calendar delivery',
        status: 'connected',
      }),
      expect.objectContaining({ kind: 'webhook', status: 'attention' }),
    ])
    expect(result[0].detail).toContain('Cloudflare Email Service')
    expect(result[1].detail).toContain('Cloudflare R2')
    expect(result[2].detail).toContain('Google Calendar')
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
    expect(result[2]).toMatchObject({
      name: 'Calendar delivery',
      status: 'connected',
    })
  })
})

describe('browser response hardening', () => {
  it('prevents private app pages from being framed', () => {
    const headers = browserSecurityHeaders(
      { 'content-type': 'text/html; charset=utf-8' },
      new URL('https://app.programkit.dev/login'),
    )

    expect(headers.get('strict-transport-security')).toBe('max-age=31536000')
    expect(headers.get('x-content-type-options')).toBe('nosniff')
    expect(headers.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(headers.get('permissions-policy')).toContain('camera=()')
    expect(headers.get('x-frame-options')).toBe('DENY')
    expect(headers.get('content-security-policy')).toBe("frame-ancestors 'none'")
  })

  it('keeps public event documents embeddable', () => {
    const headers = browserSecurityHeaders(
      { 'content-type': 'text/html; charset=utf-8' },
      new URL('https://app.programkit.dev/agenda'),
      { allowEmbedding: true },
    )

    expect(headers.get('x-frame-options')).toBeNull()
    expect(headers.get('content-security-policy')).toBeNull()
  })

  it('does not ask local HTTP development to remember HSTS', () => {
    const headers = browserSecurityHeaders({}, new URL('http://localhost:4173'))

    expect(headers.get('strict-transport-security')).toBeNull()
  })
})

describe('public operational endpoints', () => {
  it.each(['/api/health', '/healthz'])('serves %s without workspace access', async (pathname) => {
    const request = new Request(`https://app.programkit.dev${pathname}`)
    const response = publicOperationalResponse(request, new URL(request.url))

    expect(response?.status).toBe(200)
    await expect(response?.json()).resolves.toMatchObject({
      ok: true,
      service: 'programkit',
      status: 'ready',
    })
    expect(response?.headers.get('cache-control')).toBe('no-store')
  })

  it('serves crawler guidance instead of the SPA shell', async () => {
    const request = new Request('https://app.programkit.dev/robots.txt')
    const response = publicOperationalResponse(request, new URL(request.url))

    expect(response?.headers.get('content-type')).toContain('text/plain')
    await expect(response?.text()).resolves.toContain('Disallow: /')
  })

  it('allows crawlers to discover the public project site and its sitemap', async () => {
    const request = new Request('https://programkit.dev/robots.txt')
    const response = publicOperationalResponse(request, new URL(request.url), 'hosted-site')
    const text = await response?.text()

    expect(text).toContain('Allow: /')
    expect(text).toContain('Disallow: /api/')
    expect(text).toContain('Sitemap: https://programkit.dev/sitemap.xml')
  })

  it('serves a security contact and rejects unknown well-known files', async () => {
    const securityRequest = new Request('https://app.programkit.dev/.well-known/security.txt')
    const securityResponse = publicOperationalResponse(
      securityRequest,
      new URL(securityRequest.url),
    )
    await expect(securityResponse?.text()).resolves.toContain('mailto:support@programkit.dev')

    const unknownRequest = new Request('https://app.programkit.dev/.well-known/example.txt')
    const unknownResponse = publicOperationalResponse(unknownRequest, new URL(unknownRequest.url))
    expect(unknownResponse?.status).toBe(404)
    await expect(unknownResponse?.text()).resolves.toBe('Not found.\n')
  })

  it('serves a public, deployment-specific Agent Plugin without credentials', async () => {
    const request = new Request('https://events.example.com/agent-plugin.zip')
    const response = publicOperationalResponse(request, new URL(request.url))

    expect(response?.status).toBe(200)
    expect(response?.headers.get('content-type')).toBe('application/zip')
    expect(response?.headers.get('cache-control')).toBe('public, max-age=300')
    expect(response?.headers.get('x-content-type-options')).toBe('nosniff')
    const body = new Uint8Array(await response!.arrayBuffer())
    expect(Array.from(body.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(new TextDecoder().decode(body)).toContain('https://events.example.com/mcp')
    expect(new TextDecoder().decode(body)).not.toContain('pk_live_')

    const head = new Request(request.url, { method: 'HEAD' })
    const headResponse = publicOperationalResponse(head, new URL(head.url))
    expect(headResponse?.headers.get('content-length')).toBe(String(body.byteLength))
    expect((await headResponse?.arrayBuffer())?.byteLength).toBe(0)
  })

  it('does not consume unrelated application routes', () => {
    const request = new Request('https://app.programkit.dev/forms')
    expect(publicOperationalResponse(request, new URL(request.url))).toBeNull()
  })
})
