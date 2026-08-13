import {
  ArrowRightStartOnRectangleIcon,
  ComputerDesktopIcon,
  KeyIcon,
} from '@heroicons/react/16/solid'
import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { Button, Callout, Field, SectionHeading, textControl } from './ui.tsx'

interface AccountSession {
  id: string
  createdAt: string
  expiresAt: string
  current: boolean
}

interface AccountSecurityState {
  email: string
  passwordConfigured: boolean
  passwordRecoveryAvailable: boolean
  sessions: AccountSession[]
}

interface AccountSecurityResponse extends Partial<AccountSecurityState> {
  ok?: boolean
  error?: string
  revokedSessions?: number
}

type WorkingAction = 'password' | 'others' | 'logout' | `session:${string}` | null

function sessionTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function AccountSecuritySettings() {
  const [security, setSecurity] = useState<AccountSecurityState | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [working, setWorking] = useState<WorkingAction>(null)
  const [feedback, setFeedback] = useState<{
    area: 'password' | 'sessions'
    tone: 'success' | 'danger'
    title: string
  } | null>(null)

  useEffect(() => {
    if (window.location.hash !== '#account-security') return
    window.requestAnimationFrame(() => {
      document.getElementById('account-security')?.scrollIntoView({ block: 'start' })
    })
  }, [])

  const loadSecurity = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch('/api/v1/auth/security', {
      credentials: 'same-origin',
      signal,
    })
    const body = (await response.json()) as AccountSecurityResponse
    if (
      !response.ok ||
      !body.ok ||
      typeof body.email !== 'string' ||
      typeof body.passwordConfigured !== 'boolean' ||
      typeof body.passwordRecoveryAvailable !== 'boolean' ||
      !Array.isArray(body.sessions)
    ) {
      throw new Error(body.error ?? 'Account security could not be loaded.')
    }
    setSecurity({
      email: body.email,
      passwordConfigured: body.passwordConfigured,
      passwordRecoveryAvailable: body.passwordRecoveryAvailable,
      sessions: body.sessions,
    })
    setLoadError(null)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void loadSecurity(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setLoadError(
          caught instanceof Error ? caught.message : 'Account security could not be loaded.',
        )
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [loadSecurity])

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFeedback(null)
    if (newPassword.length < 10 || newPassword.length > 128) {
      setFeedback({
        area: 'password',
        tone: 'danger',
        title: 'Use between 10 and 128 characters.',
      })
      return
    }
    if (newPassword !== confirmation) {
      setFeedback({
        area: 'password',
        tone: 'danger',
        title: 'The new passwords do not match.',
      })
      return
    }
    setWorking('password')
    try {
      const response = await fetch('/api/v1/auth/password/change', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const body = (await response.json()) as AccountSecurityResponse
      if (!response.ok || !body.ok)
        throw new Error(body.error ?? 'The password could not be saved.')
      const wasConfigured = security?.passwordConfigured === true
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      await loadSecurity()
      setFeedback({
        area: 'password',
        tone: 'success',
        title: wasConfigured
          ? body.revokedSessions
            ? 'Password changed. Other sessions signed out.'
            : 'Password changed.'
          : 'Password set.',
      })
    } catch (caught) {
      setFeedback({
        area: 'password',
        tone: 'danger',
        title: caught instanceof Error ? caught.message : 'The password could not be saved.',
      })
    } finally {
      setWorking(null)
    }
  }

  async function revokeSessions(sessionId?: string) {
    const action: WorkingAction = sessionId ? `session:${sessionId}` : 'others'
    setWorking(action)
    setFeedback(null)
    try {
      const response = await fetch(
        sessionId
          ? `/api/v1/auth/sessions/${encodeURIComponent(sessionId)}`
          : '/api/v1/auth/sessions',
        { method: 'DELETE', credentials: 'same-origin' },
      )
      const body = (await response.json()) as AccountSecurityResponse
      if (!response.ok || !body.ok)
        throw new Error(body.error ?? 'The session could not be revoked.')
      await loadSecurity()
      setFeedback({
        area: 'sessions',
        tone: 'success',
        title: sessionId
          ? 'Session revoked.'
          : body.revokedSessions === 0
            ? 'No other sessions were active.'
            : 'Other sessions signed out.',
      })
    } catch (caught) {
      setFeedback({
        area: 'sessions',
        tone: 'danger',
        title: caught instanceof Error ? caught.message : 'The session could not be revoked.',
      })
    } finally {
      setWorking(null)
    }
  }

  async function signOutCurrentSession() {
    setWorking('logout')
    setFeedback(null)
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
      })
      if (!response.ok) throw new Error('This browser could not be signed out.')
      window.location.assign('/login')
    } catch (caught) {
      setWorking(null)
      setFeedback({
        area: 'sessions',
        tone: 'danger',
        title: caught instanceof Error ? caught.message : 'This browser could not be signed out.',
      })
    }
  }

  const otherSessions = security?.sessions.filter((session) => !session.current) ?? []

  return (
    <section
      id="account-security"
      className="mx-auto w-full max-w-4xl scroll-mt-6"
      aria-labelledby="account-security-heading"
    >
      <SectionHeading
        id="account-security-heading"
        title="Account security"
        description="Manage the password and browser sessions for your ProgramKit account."
      />

      {loading ? (
        <p className="pt-5 text-pretty text-base text-zinc-500 sm:text-sm">
          Loading account security…
        </p>
      ) : loadError || !security ? (
        <div className="grid justify-items-start gap-3 pt-5">
          <Callout tone="danger" title={loadError ?? 'Account security could not be loaded.'} />
          <Button
            size="compact"
            onClick={() => {
              setLoading(true)
              setLoadError(null)
              void loadSecurity()
                .catch((caught: unknown) => {
                  setLoadError(
                    caught instanceof Error
                      ? caught.message
                      : 'Account security could not be loaded.',
                  )
                })
                .finally(() => setLoading(false))
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="grid gap-8 pt-5">
          <div className="grid gap-4">
            <div className="flex items-start gap-3">
              <KeyIcon className="size-4 h-lh shrink-0 fill-zinc-400" aria-hidden="true" />
              <div>
                <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Password</h3>
                <p className="pt-0.5 text-pretty text-base text-zinc-500 sm:text-sm">
                  {security.email}
                </p>
              </div>
            </div>
            {feedback?.area === 'password' ? (
              <div role={feedback.tone === 'danger' ? 'alert' : 'status'} aria-live="polite">
                <Callout tone={feedback.tone} title={feedback.title} />
              </div>
            ) : null}
            <form className="grid max-w-xl gap-4" onSubmit={(event) => void updatePassword(event)}>
              {security.passwordConfigured && !security.passwordRecoveryAvailable ? (
                <Field label="Current password" htmlFor="account-current-password">
                  <input
                    id="account-current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.currentTarget.value)}
                    className={textControl}
                  />
                </Field>
              ) : null}
              {security.passwordRecoveryAvailable ? (
                <Callout
                  tone="info"
                  title="Email verified. Choose a new password; no old password is required."
                />
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label={security.passwordConfigured ? 'New password' : 'Password'}
                  htmlFor="account-new-password"
                  hint="10–128 characters."
                >
                  <input
                    id="account-new-password"
                    name="newPassword"
                    type="password"
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.currentTarget.value)}
                    className={textControl}
                  />
                </Field>
                <Field label="Confirm password" htmlFor="account-confirm-password">
                  <input
                    id="account-confirm-password"
                    name="confirmPassword"
                    type="password"
                    minLength={10}
                    maxLength={128}
                    autoComplete="new-password"
                    required
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.currentTarget.value)}
                    className={textControl}
                  />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="submit"
                  disabled={working !== null}
                  aria-describedby="account-password-effect"
                >
                  {working === 'password'
                    ? 'Saving…'
                    : security.passwordConfigured
                      ? 'Change password'
                      : 'Set password'}
                </Button>
                <p id="account-password-effect" className="text-pretty text-sm text-zinc-500">
                  Setting or changing your password signs out every other browser and expires
                  pending sign-in links.
                </p>
              </div>
            </form>
          </div>

          <div className="grid gap-3 border-t border-zinc-950/6 pt-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <ComputerDesktopIcon
                  className="size-4 h-lh shrink-0 fill-zinc-400"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Sessions</h3>
                  <p className="pt-0.5 text-pretty text-base text-zinc-500 sm:text-sm">
                    Review browsers signed in to this account.
                  </p>
                </div>
              </div>
              {otherSessions.length > 0 ? (
                <Button
                  size="compact"
                  variant="ghost"
                  disabled={working !== null}
                  onClick={() => void revokeSessions()}
                >
                  {working === 'others' ? 'Signing out…' : 'Sign out other sessions'}
                </Button>
              ) : null}
            </div>

            {feedback?.area === 'sessions' ? (
              <div role={feedback.tone === 'danger' ? 'alert' : 'status'} aria-live="polite">
                <Callout tone={feedback.tone} title={feedback.title} />
              </div>
            ) : null}

            <ul role="list" className="divide-y divide-zinc-950/6">
              {security.sessions.map((session) => (
                <li
                  key={session.id}
                  className="flex min-h-16 flex-col justify-center gap-3 py-3 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-medium text-zinc-800 sm:text-sm">
                      {session.current ? 'This browser' : 'Other browser'}
                    </p>
                    <p className="text-sm text-zinc-500">
                      Signed in{' '}
                      <time dateTime={session.createdAt}>{sessionTime(session.createdAt)}</time>
                      {' · '}Expires{' '}
                      <time dateTime={session.expiresAt}>{sessionTime(session.expiresAt)}</time>
                    </p>
                  </div>
                  {session.current ? (
                    <Button
                      size="compact"
                      variant="ghost"
                      disabled={working !== null}
                      onClick={() => void signOutCurrentSession()}
                    >
                      <ArrowRightStartOnRectangleIcon className="size-4 fill-current" />
                      {working === 'logout' ? 'Signing out…' : 'Sign out'}
                    </Button>
                  ) : (
                    <Button
                      size="compact"
                      variant="ghost"
                      disabled={working !== null}
                      onClick={() => void revokeSessions(session.id)}
                    >
                      {working === `session:${session.id}` ? 'Revoking…' : 'Revoke'}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {otherSessions.length === 0 ? (
              <p className="text-sm text-zinc-500">No other browsers are signed in.</p>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}
