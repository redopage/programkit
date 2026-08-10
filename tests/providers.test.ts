import { describe, expect, it, vi } from 'vitest'

import {
  buildAcceleventsExportItems,
  createSeedState,
  type AcceleventsExportItem,
} from '@programkit/core'

import {
  deliverAcceleventsItem,
  deliverCampaignMessage,
  type EmailSendBinding,
} from '../apps/cloudflare/src/providers.ts'

describe('credentialed provider adapters', () => {
  it('sends the frozen campaign message with its RFC 5545 attachment', async () => {
    const delivery = createSeedState().campaignDeliveries[0]!
    let message: Parameters<EmailSendBinding['send']>[0] | undefined
    const email: EmailSendBinding = {
      async send(next) {
        message = next
        return { messageId: 'cf-message-001' }
      },
    }

    await expect(
      deliverCampaignMessage(email, 'notifications@programkit.dev', delivery),
    ).resolves.toBe('cf-message-001')
    expect(message).toMatchObject({
      to: delivery.recipientEmail,
      subject: delivery.subject,
      text: delivery.body,
      headers: { 'X-ProgramKit-Delivery-Id': delivery.id },
    })
    expect(atob(message!.attachments![0]!.content)).toContain('BEGIN:VCALENDAR\r\n')
    expect(message!.attachments![0]).toMatchObject({
      filename: 'aie-nyc-2026-invite.ics',
      type: 'text/calendar; charset=utf-8; method=REQUEST',
      disposition: 'attachment',
    })
  })

  it('creates speakers and updates known sessions through the Accelevents API contract', async () => {
    const items = buildAcceleventsExportItems(createSeedState(), '2026-08-09T18:00:00.000Z', () =>
      crypto.randomUUID(),
    )
    const speaker = items.find((entry) => entry.resource === 'speaker')!
    const createFetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 314 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    ) as unknown as typeof globalThis.fetch

    await expect(
      deliverAcceleventsItem(createFetch, 'owner-api-key', 'aie-nyc-2026', speaker, new Map()),
    ).resolves.toBe('314')
    const [createUrl, createInit] = vi.mocked(createFetch).mock.calls[0]!
    expect(String(createUrl)).toBe(
      'https://api.accelevents.com/rest/host/event/aie-nyc-2026/speaker',
    )
    expect(createInit?.method).toBe('POST')
    expect(new Headers(createInit?.headers).get('AUTHENTICATION')).toBe('owner-api-key')
    expect(JSON.parse(String(createInit?.body))).not.toHaveProperty('externalKey')

    const session = items.find((entry) => entry.resource === 'session')!
    const knownSession: AcceleventsExportItem = { ...session, providerId: '2718' }
    const speakerIds = new Map(
      session.resource === 'session'
        ? session.payload.speakerExternalKeys.map((key, index) => [key, String(index + 100)])
        : [],
    )
    const updateFetch = vi.fn(
      async () => new Response('', { status: 200 }),
    ) as unknown as typeof fetch
    await expect(
      deliverAcceleventsItem(
        updateFetch,
        'owner-api-key',
        'aie-nyc-2026',
        knownSession,
        speakerIds,
      ),
    ).resolves.toBe('2718')
    const [updateUrl, updateInit] = vi.mocked(updateFetch).mock.calls[0]!
    expect(String(updateUrl)).toBe(
      'https://api.accelevents.com/rest/host/event/aie-nyc-2026/session/2718',
    )
    expect(updateInit?.method).toBe('PUT')
    expect(JSON.parse(String(updateInit?.body))).toMatchObject({
      sessionVisibilityType: 'PUBLIC',
      speakerList: [{ speakerId: 100 }],
    })
  })
})
