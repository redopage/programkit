import { useState, type FormEvent } from 'react'

import { Button, cx } from './ui.tsx'

export function ExternalAccessForm({
  title,
  defaultIntent = 'signup',
  onSubmit,
}: {
  title: string
  defaultIntent?: 'signin' | 'signup'
  onSubmit: (input: {
    email: string
    password: string
    intent: 'signin' | 'signup'
  }) => Promise<void>
}) {
  const [intent, setIntent] = useState<'signin' | 'signup'>(defaultIntent)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await onSubmit({ email, password, intent })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Access could not be updated.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        {title}
      </h1>
      <div className="mt-7 inline-flex rounded-full bg-zinc-100 p-1" aria-label="Account action">
        {[
          ['signup', 'Create account'],
          ['signin', 'Sign in'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={intent === value}
            className={cx(
              'focus-ring rounded-full px-4 py-2 text-base font-medium transition sm:text-sm',
              intent === value
                ? 'bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-950/5'
                : 'text-zinc-500 hover:text-zinc-950',
            )}
            onClick={() => {
              setIntent(value as 'signin' | 'signup')
              setError('')
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="flex flex-col gap-5 pt-7" onSubmit={(event) => void submit(event)}>
        <label className="flex flex-col gap-2">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            className="focus-ring min-h-11 rounded-xl border-0 bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:text-sm"
            placeholder="you@example.com"
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Password</span>
          <input
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
      </form>
      <p className="pt-5 text-pretty text-base text-zinc-500 sm:text-sm">
        Your account is private to this event and never grants organizer access.
      </p>
    </div>
  )
}
