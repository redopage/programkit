function decodeBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function toHex(value: ArrayBuffer) {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export async function verifyAirtableWebhookMac(
  body: ArrayBuffer,
  supplied: string | null,
  macSecret: string,
) {
  if (!supplied) return false
  const key = await crypto.subtle.importKey(
    'raw',
    decodeBase64(macSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, body)
  return constantTimeEqual(supplied, `hmac-sha256=${toHex(signature)}`)
}
