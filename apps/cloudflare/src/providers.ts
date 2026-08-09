import type { AcceleventsExportItem, CampaignDelivery } from '@programkit/core'

export interface EmailSendBinding {
  send(message: {
    to: string
    from: string
    subject: string
    text: string
    attachments?: Array<{
      content: string
      filename: string
      type: string
      disposition: 'attachment'
    }>
    headers?: Record<string, string>
  }): Promise<{ messageId: string }>
}

function utf8Base64(value: string) {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8_192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8_192))
  }
  return btoa(binary)
}

export async function deliverCampaignMessage(
  email: EmailSendBinding,
  from: string,
  delivery: CampaignDelivery,
) {
  const result = await email.send({
    to: delivery.recipientEmail,
    from,
    subject: delivery.subject,
    text: delivery.body,
    attachments: delivery.attachments.map((attachment) => ({
      content: utf8Base64(attachment.content),
      filename: attachment.filename,
      type: attachment.contentType,
      disposition: 'attachment',
    })),
    headers: { 'X-ProgramKit-Delivery-Id': delivery.id },
  })
  if (!result.messageId) throw new Error('Cloudflare Email did not return a message ID.')
  return result.messageId
}

function providerError(status: number, body: string) {
  const compact = body.replace(/\s+/gu, ' ').trim().slice(0, 300)
  return new Error(`Accelevents returned ${status}${compact ? `: ${compact}` : '.'}`)
}

function providerId(body: string, resource: AcceleventsExportItem['resource']) {
  const trimmed = body.trim()
  if (/^\d+$/u.test(trimmed)) return trimmed
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (typeof parsed === 'number' || typeof parsed === 'string') return String(parsed)
    if (parsed && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>
      const nested =
        record.id ??
        record[resource === 'speaker' ? 'speakerId' : 'sessionId'] ??
        (record.data && typeof record.data === 'object'
          ? (record.data as Record<string, unknown>).id
          : undefined)
      if (typeof nested === 'number' || typeof nested === 'string') return String(nested)
    }
  } catch {
    // The caller turns an undocumented successful response into explicit provider evidence failure.
  }
  throw new Error(`Accelevents did not return a ${resource} ID.`)
}

export async function deliverAcceleventsItem(
  fetcher: typeof globalThis.fetch,
  apiKey: string,
  eventUrl: string,
  item: AcceleventsExportItem,
  speakerProviderIds: ReadonlyMap<string, string>,
) {
  const existingProviderId = item.providerId
  const path = `https://api.accelevents.com/rest/host/event/${encodeURIComponent(eventUrl)}/${item.resource}`
  const endpoint = existingProviderId ? `${path}/${encodeURIComponent(existingProviderId)}` : path
  let body: Record<string, unknown>
  if (item.resource === 'speaker') {
    const { sourceId: _sourceId, externalKey: _externalKey, ...speaker } = item.payload
    body = speaker
  } else {
    const {
      sourceId: _sourceId,
      externalKey: _externalKey,
      speakerExternalKeys,
      ...session
    } = item.payload
    const missingSpeaker = speakerExternalKeys.find((key) => !speakerProviderIds.has(key))
    if (missingSpeaker) {
      throw new Error(
        `Accelevents speaker ${missingSpeaker} must be delivered before this session.`,
      )
    }
    body = {
      ...session,
      sessionVisibilityType: 'PUBLIC',
      speakerList: speakerExternalKeys.map((key) => ({
        speakerId: Number(speakerProviderIds.get(key)),
      })),
    }
  }

  const response = await fetcher(endpoint, {
    method: existingProviderId ? 'PUT' : 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      AUTHENTICATION: apiKey,
      'Idempotency-Key': item.externalKey,
    },
    body: JSON.stringify(body),
  })
  const responseBody = await response.text()
  if (!response.ok) throw providerError(response.status, responseBody)
  return existingProviderId ?? providerId(responseBody, item.resource)
}
