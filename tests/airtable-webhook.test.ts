import { describe, expect, it } from 'vitest'

import { verifyAirtableWebhookMac } from '@programkit/core'

function hex(value: ArrayBuffer) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

describe('Airtable webhook verification', () => {
  it('accepts the documented HMAC and rejects tampering', async () => {
    const secret = Uint8Array.from([10, 20, 30, 40, 50, 60])
    const secretBase64 = btoa(String.fromCharCode(...secret))
    const body = new TextEncoder().encode('{"base":{"id":"app_test"}}')
    const key = await crypto.subtle.importKey(
      'raw',
      secret,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )
    const signature = await crypto.subtle.sign('HMAC', key, body)
    const header = `hmac-sha256=${hex(signature)}`

    expect(await verifyAirtableWebhookMac(body.buffer, header, secretBase64)).toBe(true)
    expect(
      await verifyAirtableWebhookMac(
        new TextEncoder().encode('{"base":{"id":"different"}}').buffer,
        header,
        secretBase64,
      ),
    ).toBe(false)
    expect(await verifyAirtableWebhookMac(body.buffer, null, secretBase64)).toBe(false)
  })
})
