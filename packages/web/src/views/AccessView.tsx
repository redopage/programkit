import {
  ArrowRightIcon,
  DocumentTextIcon,
  IdentificationIcon,
  StarIcon,
} from '@heroicons/react/16/solid'

import { EventIdentity } from '../components/event-brand.tsx'
import { ExternalAccessForm } from '../components/ExternalAccessForm.tsx'
import { Button } from '../components/ui.tsx'
import { useExternalAccess, type ExternalAccessDestination } from '../lib/external-access.ts'

const destinationIcons = {
  submissions: DocumentTextIcon,
  reviewer: StarIcon,
  speaker: IdentificationIcon,
} satisfies Record<ExternalAccessDestination['kind'], typeof DocumentTextIcon>

export function AccessView() {
  const search = new URLSearchParams(window.location.search)
  const eventId = search.get('event') ?? ''
  const formSlug = search.get('form') ?? undefined
  const linkError =
    search.get('error') === 'expired'
      ? 'That sign-in link expired or was already used. Request a new one.'
      : ''
  const access = useExternalAccess(eventId, formSlug)

  if (!access.session.authenticated) {
    return (
      <div className="flex min-h-dvh flex-col bg-white">
        <main className="grid flex-1 place-items-center px-6 pt-[max(--spacing(10),env(safe-area-inset-top))] pb-10">
          <div className="w-full max-w-xs">
            {access.loading ? (
              <div className="mx-auto h-8 w-36 animate-pulse rounded-lg bg-zinc-950/8" />
            ) : access.session.eventName ? (
              <EventIdentity
                name={access.session.eventName}
                logoUrl={access.session.eventLogoUrl}
                className="mx-auto w-fit justify-center"
              />
            ) : null}
            <div className={access.session.eventName ? 'pt-14 sm:pt-16' : ''}>
              {access.loading ? (
                <p className="text-center text-base text-zinc-500 sm:text-sm">Loading access…</p>
              ) : (
                <ExternalAccessForm
                  signInTitle={
                    access.session.eventName
                      ? `Sign in to ${access.session.eventName}`
                      : 'Access your events'
                  }
                  signUpTitle="Create your account"
                  description={
                    access.session.eventName
                      ? 'Continue to your proposals, reviews, and speaker tasks.'
                      : 'Use the email address connected to your event.'
                  }
                  defaultIntent="signin"
                  emailSignInAvailable={access.session.emailConfigured === true}
                  initialError={linkError}
                  onSubmit={async (input) => {
                    await access.authenticate(input)
                  }}
                  onSendMagicLink={async (email) => {
                    await access.sendMagicLink(email)
                  }}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="border-b border-zinc-950/5 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <EventIdentity
            name={access.session.eventName ?? 'Your event'}
            logoUrl={access.session.eventLogoUrl}
          />
          <button
            type="button"
            className="focus-ring rounded-lg text-base font-medium text-zinc-600 hover:text-zinc-950 sm:text-sm"
            onClick={() => void access.logout()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-14 sm:px-6 sm:py-20">
        <div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Your event access
          </h1>
          <p className="pt-2 text-pretty text-base text-zinc-500">
            {access.session.eventName ? `${access.session.eventName} · ` : ''}
            Signed in as {access.session.identity?.name ?? access.session.identity?.email}
          </p>
          {(access.session.destinations ?? []).length > 0 ? (
            <ul role="list" className="mt-10 divide-y divide-zinc-950/5 border-y border-zinc-950/5">
              {(access.session.destinations ?? []).map((destination) => {
                const Icon = destinationIcons[destination.kind]
                return (
                  <li key={destination.id}>
                    <a
                      href={destination.href}
                      className="focus-ring -mx-2 flex items-center gap-4 rounded-xl px-2 py-5 hover:bg-zinc-950/3"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <Icon className="size-5 fill-current" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium text-zinc-950">
                          {destination.label}
                        </span>
                        <span className="block text-base text-zinc-500 sm:text-sm">
                          {destination.detail}
                        </span>
                      </span>
                      <ArrowRightIcon className="size-4 shrink-0 fill-zinc-400" />
                    </a>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="mt-10 rounded-2xl bg-zinc-50 p-6 ring-1 ring-zinc-950/5">
              <h2 className="text-base font-medium text-zinc-950">Nothing assigned yet</h2>
              <p className="max-w-xl pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
                Use this email when you submit a proposal. Reviewer and speaker access will appear
                here when the program team assigns it.
              </p>
              {formSlug ? (
                <div className="pt-5">
                  <Button
                    variant="primary"
                    onClick={() => {
                      window.location.href = `/submit/${encodeURIComponent(formSlug)}?event=${encodeURIComponent(eventId)}`
                    }}
                  >
                    Start a proposal
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
