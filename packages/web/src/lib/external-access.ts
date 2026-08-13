import { useCallback, useEffect, useMemo, useState } from 'react'

export interface ExternalAccessDestination {
  id: string
  kind: 'submissions' | 'reviewer' | 'speaker'
  label: string
  detail: string
  href: string
}

export interface ExternalAccessSession {
  authenticated: boolean
  eventId?: string
  eventName?: string
  eventLogoUrl?: string
  identity?: { id: string; name: string; email: string }
  destinations?: ExternalAccessDestination[]
  submissionAccessKey?: string | null
}

interface ExternalAccessResult extends ExternalAccessSession {
  ok: boolean
  code?: string
  error?: string
}

function hostedApp() {
  if (typeof document === 'undefined') return false
  return (
    document.querySelector<HTMLMetaElement>('meta[name="programkit-deployment-profile"]')
      ?.content === 'hosted-app'
  )
}

function endpoint(pathname: string, eventId?: string, formSlug?: string) {
  const search = new URLSearchParams()
  if (eventId) search.set('event', eventId)
  if (formSlug) search.set('form', formSlug)
  const query = search.toString()
  return query ? `${pathname}?${query}` : pathname
}

async function responseBody(response: Response) {
  const body = (await response.json()) as ExternalAccessResult
  if (!response.ok || !body.ok) throw new Error(body.error ?? 'Access could not be updated.')
  return body
}

export function useExternalAccess(eventId: string, formSlug?: string) {
  const enabled = useMemo(hostedApp, [])
  const [loading, setLoading] = useState(enabled)
  const [session, setSession] = useState<ExternalAccessSession>({ authenticated: false })
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false)
      return { ok: true, authenticated: false } satisfies ExternalAccessResult
    }
    setLoading(true)
    setError('')
    try {
      const result = await responseBody(
        await fetch(
          endpoint(
            eventId ? '/public/v1/access/session' : '/public/v1/access/discover/session',
            eventId,
            formSlug,
          ),
          {
            headers: { accept: 'application/json' },
          },
        ),
      )
      setSession(result)
      return result
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Access could not be loaded.'
      setError(message)
      setSession({ authenticated: false })
      return { ok: false, authenticated: false, error: message } satisfies ExternalAccessResult
    } finally {
      setLoading(false)
    }
  }, [enabled, eventId, formSlug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const authenticate = useCallback(
    async (input: {
      email: string
      name: string
      password: string
      intent: 'signin' | 'signup'
    }) => {
      setError('')
      const result = await responseBody(
        await fetch(
          endpoint(
            eventId ? '/public/v1/access/password' : '/public/v1/access/discover/password',
            eventId,
            formSlug,
          ),
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(input),
          },
        ),
      )
      setSession(result)
      return result
    },
    [eventId, formSlug],
  )

  const logout = useCallback(async () => {
    const resolvedEventId = eventId || session.eventId
    await responseBody(
      await fetch(
        endpoint(
          eventId ? '/public/v1/access/logout' : '/public/v1/access/discover/logout',
          resolvedEventId,
        ),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
        },
      ),
    )
    setSession({ authenticated: false })
  }, [eventId, session.eventId])

  return { enabled, loading, session, error, setError, refresh, authenticate, logout }
}
