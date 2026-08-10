export interface DemoDetails {
  createdAt: string
  expiresAt: string
  url: string
}

export interface DemoStatus {
  active: boolean
  demo?: DemoDetails
}

interface DemoMutationResult {
  ok: boolean
  demo?: DemoDetails
  error?: string
}

export async function readCurrentDemo(signal?: AbortSignal) {
  const response = await fetch('/api/v1/demos/current', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) throw new Error('Demo status could not be loaded.')
  return (await response.json()) as DemoStatus
}

export async function createDemo() {
  const response = await fetch('/api/v1/demos', {
    method: 'POST',
    credentials: 'same-origin',
  })
  const result = (await response.json()) as DemoMutationResult
  if (!response.ok || !result.demo) {
    throw new Error(result.error ?? 'The demo could not be created.')
  }
  return result.demo
}

export async function leaveCurrentDemo() {
  const response = await fetch('/api/v1/demos/current', {
    method: 'POST',
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error('The demo could not be left. Try again.')
}
