export const demoCookieName = 'programkit_demo'
export const demoLifetimeMs = 7 * 24 * 60 * 60 * 1_000

const demoIdPattern = /^[a-f0-9]{48}$/u

export function createDemoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function isDemoId(value: string | null | undefined): value is string {
  return typeof value === 'string' && demoIdPattern.test(value)
}

export function demoWorkspaceKey(id: string) {
  if (!isDemoId(id)) throw new Error('The demo identifier is invalid.')
  return `demo_${id}`
}

export function demoIdFromWorkspaceKey(key: string) {
  if (!key.startsWith('demo_')) return null
  const id = key.slice('demo_'.length)
  return isDemoId(id) ? id : null
}

export function demoIdFromPath(pathname: string) {
  const match = pathname.match(/^\/demo\/([^/]+)\/?$/u)
  if (!match) return null
  return isDemoId(match[1]) ? match[1] : null
}

export function demoExpiresAt(now = Date.now()) {
  return new Date(now + demoLifetimeMs).toISOString()
}
