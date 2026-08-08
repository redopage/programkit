import {
  ArrowLeftIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { readinessRows } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  ProgressBar,
  StatusBadge,
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

export function PortalView() {
  const { payload } = useWorkspace()
  if (!payload) return null
  return <PortalWorkspace />
}

function PortalWorkspace() {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload!.state
  const participation =
    state.participations.find((entry) => entry.id === 'par_003') ?? state.participations[0]
  const person = state.people.find((entry) => entry.id === participation.personId)!
  const row = readinessRows(state).find((entry) => entry.participationId === participation.id)!
  const [form, setForm] = useState({
    publicTitle: participation.publicTitle,
    publicCompany: participation.publicCompany,
    bio: person.bio,
  })
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await execute(
      'portal.update-profile',
      { participationId: participation.id, ...form },
      {
        expectedVersions: {
          [participation.id]: participation.version,
          [person.id]: person.version,
        },
      },
      'Public profile updated.',
    )
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-950/5 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href={`/portal/${participation.id}`}
            aria-label="Homepage"
            className="focus-ring text-base font-semibold tracking-tight text-zinc-950"
            onClick={(event) => event.preventDefault()}
          >
            AIE NYC
          </a>
          <button
            type="button"
            className="focus-ring flex items-center gap-2 rounded-lg text-base text-zinc-500 hover:text-zinc-950 sm:text-sm"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            <ArrowLeftIcon className="size-4 h-lh shrink-0 fill-current" />
            Operator demo
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="flex flex-col gap-6 border-b border-zinc-950/5 pb-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar
              src={person.avatarUrl}
              name={`${person.firstName} ${person.lastName}`}
              size="large"
            />
            <div className="min-w-0">
              <p className="text-base text-zinc-500 sm:text-sm">Speaker workspace</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950">
                Welcome, {person.firstName}
              </h1>
              <p className="truncate text-base text-zinc-500 sm:text-sm">
                {sentenceCase(participation.roles.join(', '))} · AIE NYC 2026
              </p>
            </div>
          </div>
          <div className="min-w-0 lg:w-72">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-medium text-zinc-950 sm:text-sm">Your readiness</p>
              <p className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                {row.percent}%
              </p>
            </div>
            <div className="pt-2">
              <ProgressBar value={row.percent} />
            </div>
          </div>
        </section>

        {participation.status === 'invited' ? (
          <section className="rounded-2xl bg-zinc-950 p-5 text-white shadow-sm ring-1 ring-black/10 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold">Confirm your participation</h2>
                <p className="text-pretty text-base text-zinc-300 sm:text-sm">
                  Confirm that you plan to join us in Brooklyn on October 4–5. You can update
                  logistics later.
                </p>
              </div>
              <Button
                variant="primary"
                disabled={mutating}
                onClick={() =>
                  void execute(
                    'participation.set-status',
                    { participationId: participation.id, status: 'confirmed' },
                    { expectedVersions: { [participation.id]: participation.version } },
                    'Participation confirmed. We look forward to seeing you.',
                  )
                }
              >
                <CheckCircleIcon className="size-4 h-lh shrink-0 fill-current" />
                Confirm participation
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[7fr_5fr]">
          <section
            aria-labelledby="tasks-heading"
            className="rounded-2xl p-5 ring-1 ring-zinc-950/10 sm:p-6"
          >
            <div className="border-b border-zinc-950/5 pb-3">
              <h2 id="tasks-heading" className="text-lg font-semibold text-zinc-950">
                Next steps
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">
                Complete these before their due dates.
              </p>
            </div>
            <ul role="list" className="divide-y divide-zinc-950/5">
              {state.requirementInstances
                .filter((instance) => instance.participationId === participation.id)
                .map((instance) => {
                  const definition = state.requirementDefinitions.find(
                    (entry) => entry.id === instance.definitionId,
                  )!
                  return (
                    <li
                      key={instance.id}
                      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2">
                          {instance.status === 'approved' ? (
                            <CheckCircleIcon className="size-4 h-lh shrink-0 fill-emerald-600" />
                          ) : (
                            <ClockIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
                          )}
                          <div className="min-w-0">
                            <p className="text-base font-medium text-zinc-950 sm:text-sm">
                              {definition.label}
                            </p>
                            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                              {definition.description}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 pl-6 sm:pl-0">
                        <span className="flex sm:w-32">
                          <StatusBadge status={instance.status} />
                        </span>
                        <span className="flex sm:w-24 sm:justify-end">
                          {(instance.status === 'not_started' ||
                            instance.status === 'revision_requested') &&
                          definition.id !== 'req_confirm' ? (
                            <Button
                              size="compact"
                              disabled={mutating}
                              onClick={() =>
                                void execute(
                                  'requirement.set-status',
                                  {
                                    requirementInstanceId: instance.id,
                                    status: 'submitted',
                                    value: 'Submitted through participant portal.',
                                  },
                                  { expectedVersions: { [instance.id]: instance.version } },
                                  `${definition.label} submitted for review.`,
                                )
                              }
                            >
                              <DocumentArrowUpIcon className="size-4 h-lh shrink-0 fill-current" />
                              Submit
                            </Button>
                          ) : null}
                        </span>
                      </div>
                    </li>
                  )
                })}
            </ul>
          </section>

          <section
            aria-labelledby="profile-heading"
            className="rounded-2xl p-5 ring-1 ring-zinc-950/10 sm:p-6"
          >
            <div className="border-b border-zinc-950/5 pb-3">
              <h2 id="profile-heading" className="text-lg font-semibold text-zinc-950">
                Public profile
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">Shown on the published program.</p>
            </div>
            <form
              className="flex flex-col gap-4 pt-4"
              onSubmit={(event) => void saveProfile(event)}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Title</span>
                <input
                  type="text"
                  name="publicTitle"
                  value={form.publicTitle}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publicTitle: event.target.value }))
                  }
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Company</span>
                <input
                  type="text"
                  name="publicCompany"
                  value={form.publicCompany}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publicCompany: event.target.value }))
                  }
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Bio</span>
                <textarea
                  name="bio"
                  rows={6}
                  maxLength={600}
                  value={form.bio}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bio: event.target.value }))
                  }
                  className={textAreaControl}
                />
              </label>
              <p className="text-right text-sm tabular-nums text-zinc-500">{form.bio.length}/600</p>
              <Button
                type="submit"
                variant={participation.status === 'invited' ? 'secondary' : 'primary'}
                disabled={mutating}
              >
                Save public profile
              </Button>
            </form>
          </section>
        </div>
      </main>
    </div>
  )
}
