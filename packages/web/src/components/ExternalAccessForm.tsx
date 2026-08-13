import { ArrowLeftIcon, EnvelopeIcon } from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { Button } from './ui.tsx'

export function ExternalAccessForm({
  signInTitle,
  signUpTitle = 'Create your account',
  description,
  defaultIntent = 'signup',
  emailSignInAvailable = false,
  initialError = '',
  onSubmit,
  onSendMagicLink,
}: {
  signInTitle: string
  signUpTitle?: string
  description?: string
  defaultIntent?: 'signin' | 'signup'
  emailSignInAvailable?: boolean
  initialError?: string
  onSubmit: (input: {
    email: string
    name: string
    password: string
    intent: 'signin' | 'signup'
  }) => Promise<void>
  onSendMagicLink?: (email: string) => Promise<void>
}) {
  const [intent, setIntent] = useState<'signin' | 'signup'>(defaultIntent)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ email, name, password, intent })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Access could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }

  async function sendMagicLink() {
    if (!email || !email.includes('@')) {
      setError('Enter your email address first.')
      return
    }
    if (!onSendMagicLink) return
    setSubmitting(true)
    setError('')
    try {
      await onSendMagicLink(email)
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The sign-in email could not be sent.')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-blue-50 text-blue-600 ring-1 ring-blue-600/10">
          <EnvelopeIcon className="size-5" />
        </span>
        <h1 className="pt-5 text-balance text-3xl font-semibold tracking-tight text-zinc-950">
          Check your email
        </h1>
        <p className="pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">
          If an account is connected to <span className="font-medium text-zinc-950">{email}</span>,
          its sign-in link is on the way.
        </p>
        <Button
          type="button"
          variant="secondary"
          className="mt-7 w-full"
          onClick={() => {
            setSent(false)
            setError('')
          }}
        >
          <ArrowLeftIcon className="size-4" />
          Use a different email
        </Button>
        <p className="pt-5 text-pretty text-base/7 text-zinc-500 sm:text-sm/6">
          Links expire in 15 minutes and work once.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-xs text-center">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950">
        {intent === 'signup' ? signUpTitle : signInTitle}
      </h1>
      {description ? (
        <p className="pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">{description}</p>
      ) : null}

      <form className="flex flex-col gap-4 pt-7 text-left" onSubmit={(event) => void submit(event)}>
        {intent === 'signup' ? (
          <label className="flex flex-col gap-2">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Full name</span>
            <input
              name="name"
              type="text"
              autoComplete="name"
              required
              autoFocus
              minLength={2}
              maxLength={80}
              value={name}
              className="focus-ring min-h-11 rounded-xl border-0 bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm"
              placeholder="Jordan Alvarez"
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-2">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Email address</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            autoFocus={intent === 'signin'}
            value={email}
            className="focus-ring min-h-11 rounded-xl border-0 bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:text-sm"
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Password</span>
          <input
            name="password"
            type="password"
            autoComplete={intent === 'signup' ? 'new-password' : 'current-password'}
            required
            minLength={10}
            maxLength={128}
            value={password}
            className="focus-ring min-h-11 rounded-xl border-0 bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:text-sm"
            placeholder="At least 10 characters"
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {error ? (
          <p role="alert" className="text-pretty text-base text-rose-700 sm:text-sm">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting
            ? intent === 'signup'
              ? 'Creating account…'
              : 'Signing in…'
            : intent === 'signup'
              ? 'Create account'
              : 'Sign in'}
        </Button>
        {intent === 'signin' && emailSignInAvailable && onSendMagicLink ? (
          <>
            <div className="flex items-center gap-3 text-xs text-zinc-400" aria-hidden="true">
              <span className="h-px flex-1 bg-zinc-200" />
              or
              <span className="h-px flex-1 bg-zinc-200" />
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => void sendMagicLink()}
            >
              <EnvelopeIcon className="size-4" />
              Email me a sign-in link
            </Button>
          </>
        ) : null}
      </form>
      <p className="pt-5 text-base text-zinc-600 sm:text-sm">
        {intent === 'signup' ? 'Already have an account?' : 'New to this event?'}{' '}
        <button
          type="button"
          className="focus-ring rounded-md font-medium text-zinc-950 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-950"
          onClick={() => {
            setIntent((current) => (current === 'signin' ? 'signup' : 'signin'))
            setError('')
            setPassword('')
          }}
        >
          {intent === 'signup' ? 'Sign in' : 'Create account'}
        </button>
      </p>
      <p className="pt-4 text-pretty text-base/7 text-zinc-500 sm:text-sm/6">
        Use this account for proposals, reviews, and speaker tasks for this event.
      </p>
    </div>
  )
}
