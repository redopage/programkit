export interface DemoDetails {
  createdAt: string
  expiresAt: string
  url: string
}

export interface DemoStatus {
  active: boolean
  demo?: DemoDetails
}

export async function readCurrentDemo(signal?: AbortSignal) {
  const response = await fetch('/api/v1/demos/current', {
    credentials: 'same-origin',
    signal,
  })
  if (!response.ok) throw new Error('Demo status could not be loaded.')
  return (await response.json()) as DemoStatus
}
