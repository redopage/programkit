import { ArrowLeftIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState } from 'react'

import {
  submissionAnswerByPurpose,
  submissionParticipants,
  type SubmissionContributor,
} from '@programkit/core'

import { ProgramKitMark } from '../components/brand.tsx'
import { SubmissionParticipantsEditor } from '../components/SubmissionParticipantsEditor.tsx'
import { Button, StatusBadge, sentenceCase } from '../components/ui.tsx'
import { useWorkspace } from '../lib/workspace.tsx'

function answerText(value: unknown) {
  if (Array.isArray(value)) return value.join(', ')
  return typeof value === 'string' && value.trim() ? value.trim() : 'Not provided'
}

export function SpeakerSubmissionsView({
  formSlug,
  speakerAccessKey,
}: {
  formSlug: string
  speakerAccessKey: string
}) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload?.state
  const form = state?.submissionForms.find((entry) => entry.slug === formSlug)
  const event = state?.events.find((entry) => entry.id === form?.eventId)
  const submissions = useMemo(
    () =>
      [...(state?.submissions ?? [])].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      ),
    [state?.submissions],
  )
  const [selectedId, setSelectedId] = useState('')
  const selected = submissions.find((entry) => entry.id === selectedId) ?? submissions[0]
  const selectedTrackValue = selected
    ? answerText(submissionAnswerByPurpose(state!, selected, 'track'))
    : ''
  const selectedTrackLabel =
    state?.tracks.find((entry) => entry.id === selectedTrackValue)?.name ?? selectedTrackValue
  const [editing, setEditing] = useState(false)
  const [contributors, setContributors] = useState<SubmissionContributor[]>([])

  useEffect(() => {
    if (!selected) return
    setContributors(structuredClone(selected.contributors ?? []))
    setEditing(false)
  }, [selected])

  if (!state || !form || !event) return null

  async function saveParticipants() {
    if (!selected) return
    const response = await execute(
      'submission.update',
      {
        submissionId: selected.id,
        speakerAccessKey,
        contributors,
      },
      { expectedVersions: { [selected.id]: selected.version } },
      'Participants updated.',
    )
    if (response.ok) setEditing(false)
  }

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-950/5 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a
            href="/"
            aria-label="ProgramKit homepage"
            className="focus-ring flex items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-zinc-950"
          >
            <ProgramKitMark className="size-6" />
            ProgramKit
          </a>
          <p className="truncate text-base text-zinc-500 sm:text-sm">{event.name}</p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
              Your submissions
            </h1>
            <p className="max-w-2xl pt-2 text-pretty text-base text-zinc-500">
              Follow each proposal from submission through the program decision.
            </p>
          </div>
          <Button
            variant="primary"
            onClick={() => {
              window.location.href = `/submit/${formSlug}`
            }}
          >
            <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
            Submit another proposal
          </Button>
        </div>

        {submissions.length === 0 ? (
          <section className="mt-10 rounded-2xl bg-zinc-50 px-6 py-12 text-center ring-1 ring-zinc-950/5">
            <h2 className="text-lg font-semibold text-zinc-950">No submissions found</h2>
            <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
              This private speaker link is no longer connected to a proposal.
            </p>
            <div className="flex justify-center pt-5">
              <Button onClick={() => (window.location.href = `/submit/${formSlug}`)}>
                Return to the call for proposals
              </Button>
            </div>
          </section>
        ) : (
          <div className="grid gap-8 pt-10 lg:grid-cols-[20rem_minmax(0,1fr)] lg:gap-12">
            <section aria-labelledby="submission-list-heading">
              <h2 id="submission-list-heading" className="sr-only">
                Submissions
              </h2>
              <ul role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
                {submissions.map((submission) => {
                  const title = answerText(
                    submissionAnswerByPurpose(state, submission, 'proposal_title'),
                  )
                  const active = submission.id === selected?.id
                  return (
                    <li key={submission.id}>
                      <button
                        type="button"
                        className={`focus-ring -mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-4 rounded-xl px-2 py-4 text-left transition-colors ${
                          active ? 'bg-zinc-950/4' : 'hover:bg-zinc-950/2'
                        }`}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => setSelectedId(submission.id)}
                      >
                        <span className="min-w-0">
                          <span className="block text-pretty text-base font-medium text-zinc-950 sm:text-sm">
                            {title}
                          </span>
                          <span className="block pt-1 text-base text-zinc-500 sm:text-sm">
                            Updated{' '}
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(submission.updatedAt))}
                          </span>
                        </span>
                        <StatusBadge
                          status={submission.status}
                          label={submission.status === 'submitted' ? 'Submitted' : undefined}
                        />
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>

            {selected ? (
              <article className="min-w-0">
                <div className="flex flex-col gap-4 border-b border-zinc-950/5 pb-6 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <StatusBadge
                      status={selected.status}
                      label={selected.status === 'submitted' ? 'Submitted' : undefined}
                    />
                    <h2 className="max-w-3xl pt-3 text-balance text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                      {answerText(submissionAnswerByPurpose(state, selected, 'proposal_title'))}
                    </h2>
                    <p className="pt-2 text-base text-zinc-500 sm:text-sm">
                      {sentenceCase(selected.kind)} · Reference {selected.id}
                    </p>
                  </div>
                  {!editing && selected.status !== 'accepted' && selected.status !== 'withdrawn' ? (
                    <Button size="compact" onClick={() => setEditing(true)}>
                      <PencilSquareIcon className="size-4 h-lh shrink-0 fill-current" />
                      Edit participants
                    </Button>
                  ) : null}
                </div>

                {editing ? (
                  <div className="pt-7">
                    <SubmissionParticipantsEditor
                      contributors={contributors}
                      onChange={setContributors}
                      compact
                    />
                    <div className="flex flex-wrap items-center gap-3 pt-5">
                      <Button
                        variant="primary"
                        disabled={mutating}
                        onClick={() => void saveParticipants()}
                      >
                        Save participants
                      </Button>
                      <Button
                        disabled={mutating}
                        onClick={() => {
                          setContributors(structuredClone(selected.contributors ?? []))
                          setEditing(false)
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <section aria-labelledby="participants-heading" className="pt-7">
                      <h3
                        id="participants-heading"
                        className="text-base font-medium text-zinc-950 sm:text-sm"
                      >
                        Participants
                      </h3>
                      <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
                        {submissionParticipants(state, selected).map((participant) => (
                          <li
                            key={participant.id}
                            className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5"
                          >
                            <div className="min-w-0">
                              <p className="text-base font-medium text-zinc-950 sm:text-sm">
                                {participant.firstName} {participant.lastName}
                              </p>
                              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                                {[participant.title, participant.company]
                                  .filter(Boolean)
                                  .join(' · ') || participant.email}
                              </p>
                            </div>
                            <p className="shrink-0 text-base text-zinc-500 sm:text-sm">
                              {participant.roleLabel}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </section>

                    <section
                      aria-labelledby="proposal-detail-heading"
                      className="border-t border-zinc-950/5 pt-6 mt-6"
                    >
                      <h3
                        id="proposal-detail-heading"
                        className="text-base font-medium text-zinc-950 sm:text-sm"
                      >
                        Proposal
                      </h3>
                      <dl className="divide-y divide-zinc-950/5 pt-2">
                        {[
                          [
                            'Format',
                            sentenceCase(
                              answerText(
                                submissionAnswerByPurpose(state, selected, 'session_format'),
                              ),
                            ),
                          ],
                          ['Track', selectedTrackLabel],
                          [
                            'Abstract',
                            answerText(submissionAnswerByPurpose(state, selected, 'abstract')),
                          ],
                        ].map(([term, detail]) => (
                          <div
                            key={term}
                            className="grid gap-1 py-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5"
                          >
                            <dt className="text-base font-medium text-zinc-950 sm:text-sm">
                              {term}
                            </dt>
                            <dd className="text-pretty text-base text-zinc-500 sm:text-sm">
                              {detail}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </section>
                  </>
                )}
              </article>
            ) : null}
          </div>
        )}

        <div className="pt-10">
          <a
            href={`/submit/${formSlug}`}
            className="focus-ring inline-flex items-center gap-2 rounded-lg text-base font-medium text-zinc-600 hover:text-zinc-950 sm:text-sm"
          >
            <ArrowLeftIcon className="size-4 h-lh shrink-0 fill-current" />
            Back to {form.title}
          </a>
        </div>
      </main>
    </div>
  )
}
