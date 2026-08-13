import { ArrowLeftIcon, ArrowRightIcon, EnvelopeIcon } from '@heroicons/react/16/solid'
import { useEffect, useState, type FormEvent } from 'react'

import { ProgramKitMark } from '../components/brand.tsx'
import { Button } from '../components/ui.tsx'

export function AuthView() {
  const search = new URLSearchParams(window.location.search)
  const invited = search.get('invite') === '1'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [bootstrapToken, setBootstrapToken] = useState(() => search.get('setup') ?? '')
  const [intent, setIntent] = useState<'signin' | 'signup'>(() =>
    window.location.pathname === '/signup' ? 'signup' : 'signin',
  )
  const [authConfig, setAuthConfig] = useState<{
    invited: boolean
    initialized: boolean
    signupAvailable: boolean
    bootstrapRequired: boolean
    bootstrapConfigured: boolean
    emailConfigured: boolean
  } | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentForRecovery, setSentForRecovery] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const reason = search.get('error')
    if (reason === 'invitation') {
      return 'That invitation expired, was canceled, or belongs to another email.'
    }
    if (reason === 'access') return 'Your access to that event was removed.'
    if (reason === 'account') return 'That account could not be opened. Try again.'
    return reason ? 'That sign-in link expired or was already used. Request a new one.' : null
  })

  useEffect(() => {
    let active = true
    void fetch('/api/v1/auth/config', { credentials: 'same-origin' })
      .then(async (response) => {
        const body = (await response.json()) as {
          invited?: boolean
          initialized?: boolean
          signupAvailable?: boolean
          bootstrapRequired?: boolean
          bootstrapConfigured?: boolean
          emailConfigured?: boolean
        }
        if (!active || !response.ok) return
        const next = {
          invited: body.invited === true,
          initialized: body.initialized === true,
          signupAvailable: body.signupAvailable === true,
          bootstrapRequired: body.bootstrapRequired === true,
          bootstrapConfigured: body.bootstrapConfigured === true,
          emailConfigured: body.emailConfigured === true,
        }
        setAuthConfig(next)
        if (!next.signupAvailable) setIntent('signin')
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!search.has('setup')) return
    search.delete('setup')
    const next = `${window.location.pathname}${search.size ? `?${search}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', next)
  }, [])

  const signupAvailable = authConfig?.signupAvailable ?? invited
  const firstOwnerSignup = intent === 'signup' && authConfig?.initialized === false && !invited

  const sendMagicLink = async (recoverPassword = false) => {
    if (!email || !email.includes('@')) {
      setError('Enter your email address first.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/magic-link', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, intent, name, bootstrapToken, recoverPassword }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'The sign-in email could not be sent. Try again.')
        return
      }
      setSentForRecovery(recoverPassword)
      setSent(true)
    } catch {
      setError('The sign-in email could not be sent. Try again.')
    } finally {
      setSending(false)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password, intent, name, bootstrapToken }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        if (intent === 'signin') {
          const participantResponse = await fetch('/public/v1/access/discover/password', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password, intent: 'signin', name: '' }),
          })
          const participantBody = (await participantResponse.json()) as {
            ok?: boolean
            authenticated?: boolean
          }
          if (participantResponse.ok && participantBody.ok && participantBody.authenticated) {
            window.location.assign('/access')
            return
          }
        }
        setError(body.error ?? 'The account could not be opened. Try again.')
        return
      }
      window.location.assign('/')
    } catch {
      setError('The account could not be opened. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 pt-[max(--spacing(10),env(safe-area-inset-top))] pb-[max(--spacing(10),env(safe-area-inset-bottom))] text-center">
      <div className="w-full max-w-xs">
        <a
          href="https://programkit.dev"
          aria-label="ProgramKit homepage"
          className="focus-ring mx-auto flex w-fit items-center gap-2.5 rounded-xl"
        >
          <ProgramKitMark className="size-8" />
          <span className="text-base font-semibold text-zinc-950">ProgramKit</span>
        </a>

        {sent ? (
          <div className="pt-14 sm:pt-16">
            <span className="mx-auto grid size-11 place-items-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">
              <EnvelopeIcon className="size-5" />
            </span>
            <h1 className="pt-5 text-balance text-3xl font-semibold tracking-tight text-zinc-950">
              Check your email
            </h1>
            <p className="pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">
              We sent a {sentForRecovery ? 'password reset' : 'sign-in'} link to{' '}
              <span className="font-medium text-zinc-950">{email}</span>.
            </p>
            <Button
              variant="secondary"
              className="mt-7 w-full"
              onClick={() => {
                setSent(false)
                setError(null)
              }}
            >
              <ArrowLeftIcon className="size-4" />
              Use a different email
            </Button>
            <p className="pt-5 text-pretty text-base/7 text-zinc-500 sm:text-sm/6">
              The link expires in 15 minutes and works once.
            </p>
          </div>
        ) : (
          <form className="pt-14 sm:pt-16" onSubmit={(event) => void submit(event)}>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950">
              {intent === 'signup' ? 'Create your account' : 'Sign in'}
            </h1>
            <p className="pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">
              {invited
                ? 'Use the email address that received the invitation.'
                : intent === 'signup'
                  ? firstOwnerSignup
                    ? 'Claim this installation and set up your first event.'
                    : 'Set up your first event.'
                  : 'Welcome back.'}
            </p>
            <div className="pt-7 text-left">
              {intent === 'signup' ? (
                <>
                  <label htmlFor="auth-name" className="text-sm font-medium text-zinc-800">
                    Full name
                  </label>
                  <input
                    id="auth-name"
                    name="name"
                    type="text"
                    autoComplete="name"
                    required
                    autoFocus
                    maxLength={80}
                    value={name}
                    onChange={(event) => setName(event.currentTarget.value)}
                    className="focus-ring mt-2 min-h-11 w-full rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/12 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm"
                    placeholder="Jordan Alvarez"
                  />
                </>
              ) : null}
              <label htmlFor="auth-email" className="text-sm font-medium text-zinc-800">
                Email address
              </label>
              <input
                id="auth-email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                autoFocus={intent === 'signin'}
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className={`focus-ring min-h-11 w-full rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/12 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm ${intent === 'signup' ? 'mt-4' : 'mt-2'}`}
                placeholder="you@example.com"
              />
              <label
                htmlFor="auth-password"
                className="mt-4 flex items-center justify-between gap-3 text-sm font-medium text-zinc-800"
              >
                <span>Password</span>
                {intent === 'signin' && authConfig?.emailConfigured ? (
                  <button
                    type="button"
                    className="focus-ring rounded-md font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-4 hover:text-zinc-950 hover:decoration-zinc-950"
                    onClick={() => void sendMagicLink(true)}
                  >
                    Forgot password?
                  </button>
                ) : null}
              </label>
              <input
                id="auth-password"
                name="password"
                type="password"
                autoComplete={intent === 'signup' ? 'new-password' : 'current-password'}
                required
                minLength={10}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/12 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm"
                placeholder="At least 10 characters"
              />
              {firstOwnerSignup && authConfig?.bootstrapRequired ? (
                <>
                  <label
                    htmlFor="auth-setup-code"
                    className="mt-4 block text-sm font-medium text-zinc-800"
                  >
                    Installation setup code
                  </label>
                  <input
                    id="auth-setup-code"
                    name="setup-code"
                    type="password"
                    autoComplete="one-time-code"
                    required
                    minLength={16}
                    maxLength={256}
                    value={bootstrapToken}
                    onChange={(event) => setBootstrapToken(event.currentTarget.value)}
                    className="focus-ring mt-2 min-h-11 w-full rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/12 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm"
                    placeholder="From your deployment setup"
                  />
                  <p className="pt-2 text-xs/5 text-zinc-500">
                    This one-time code prevents someone else from claiming a new installation.
                  </p>
                </>
              ) : null}
            </div>
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={sending}>
              {sending ? 'Working…' : intent === 'signup' ? 'Create account' : 'Sign in'}
              {!sending ? <ArrowRightIcon className="size-4" /> : null}
            </Button>
            {error ? <p className="pt-3 text-left text-sm text-red-600">{error}</p> : null}
            {intent === 'signup' || signupAvailable ? (
              <p className="pt-5 text-sm text-zinc-600">
                {intent === 'signup' ? 'Already have an account?' : 'New here?'}{' '}
                <button
                  type="button"
                  className="focus-ring rounded-md font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950"
                  onClick={() => {
                    setIntent((value) => (value === 'signin' ? 'signup' : 'signin'))
                    setError(null)
                    setPassword('')
                  }}
                >
                  {intent === 'signup' ? 'Sign in' : 'Create account'}
                </button>
              </p>
            ) : authConfig?.bootstrapRequired && !authConfig.bootstrapConfigured ? (
              <p className="pt-5 text-pretty text-sm text-zinc-500">
                Finish deployment by configuring the ProgramKit setup code in Cloudflare.
              </p>
            ) : authConfig ? (
              <p className="pt-5 text-pretty text-sm text-zinc-500">
                Organizer access is invite-only. Ask the ProgramKit owner for an invitation.
              </p>
            ) : null}
            <a
              href="/access"
              className="focus-ring mt-4 inline-block rounded-md text-sm font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950"
            >
              Find your event access
            </a>
            {authConfig?.emailConfigured ? (
              <>
                <div
                  className="my-5 flex items-center gap-3 text-xs text-zinc-400"
                  aria-hidden="true"
                >
                  <span className="h-px flex-1 bg-zinc-200" />
                  or
                  <span className="h-px flex-1 bg-zinc-200" />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  disabled={sending}
                  onClick={() => void sendMagicLink(false)}
                >
                  <EnvelopeIcon className="size-4" />
                  Email me a sign-in link
                </Button>
              </>
            ) : authConfig ? (
              <p className="pt-5 text-pretty text-sm text-zinc-500">
                Email sign-in is not configured on this installation. Use your password.
              </p>
            ) : null}
          </form>
        )}
      </div>
    </main>
  )
}
