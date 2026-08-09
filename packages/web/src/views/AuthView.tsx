import { ArrowLeftIcon, ArrowRightIcon, EnvelopeIcon } from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { Button } from '../components/ui.tsx'

export function AuthView() {
  const search = new URLSearchParams(window.location.search)
  const invited = search.get('invite') === '1'
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(() => {
    const reason = search.get('error')
    if (reason === 'invitation') {
      return 'That invitation expired, was canceled, or belongs to another email.'
    }
    if (reason === 'access') return 'Your access to that event was removed.'
    if (reason === 'account') return 'That account could not be opened. Try again.'
    return reason ? 'That sign-in link expired or was already used. Request a new one.' : null
  })

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSending(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/magic-link', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        setError(body.error ?? 'The sign-in email could not be sent. Try again.')
        return
      }
      setSent(true)
    } catch {
      setError('The sign-in email could not be sent. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 py-10 text-center">
      <div className="w-full max-w-xs">
        <a
          href="https://programkit.dev"
          aria-label="ProgramKit homepage"
          className="focus-ring mx-auto flex w-fit items-center gap-2.5 rounded-xl"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
            P
          </span>
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
              We sent a sign-in link to <span className="font-medium text-zinc-950">{email}</span>.
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
              Sign in to ProgramKit
            </h1>
            <p className="pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">
              {invited
                ? 'Use the email address that received the invitation.'
                : 'Enter your email to continue.'}
            </p>
            <div className="pt-7 text-left">
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
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.currentTarget.value)}
                className="focus-ring mt-2 min-h-11 w-full rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/12 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm"
                placeholder="you@example.com"
              />
            </div>
            <Button type="submit" variant="primary" className="mt-4 w-full" disabled={sending}>
              {sending ? 'Sending…' : 'Continue with email'}
              {!sending ? <ArrowRightIcon className="size-4" /> : null}
            </Button>
            {error ? <p className="pt-3 text-left text-sm text-red-600">{error}</p> : null}
          </form>
        )}
      </div>
    </main>
  )
}
