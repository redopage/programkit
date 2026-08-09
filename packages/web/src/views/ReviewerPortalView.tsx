import { ArrowLeftIcon, CheckCircleIcon, ChevronUpDownIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  evaluationCriterionKind,
  evaluationRoundCriteria,
  evaluationRoundIsBlind,
  reviewerQueue,
  submissionAnswerByPurpose,
  type ReviewRecommendation,
  type SubmissionAnswerValue,
} from '@programkit/core'

import { ProgramKitMark } from '../components/brand.tsx'
import { Button, cx, selectControl, sentenceCase, textAreaControl } from '../components/ui.tsx'
import { useWorkspace } from '../lib/workspace.tsx'

function answerText(value: SubmissionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null || value === '') return 'Not provided'
  return String(value)
}

export function ReviewerPortalView({
  reviewerId,
  selectedAssignmentId,
  onSelectionChange,
}: {
  reviewerId: string
  selectedAssignmentId?: string
  onSelectionChange: (assignmentId?: string) => void
}) {
  const { payload } = useWorkspace()
  if (!payload) return null
  return (
    <ReviewerWorkspace
      reviewerId={reviewerId}
      selectedAssignmentId={selectedAssignmentId}
      onSelectionChange={onSelectionChange}
    />
  )
}

function ReviewerWorkspace({
  reviewerId,
  selectedAssignmentId,
  onSelectionChange,
}: {
  reviewerId: string
  selectedAssignmentId?: string
  onSelectionChange: (assignmentId?: string) => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload!.state
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const reviewer = state.reviewers.find((entry) => entry.id === reviewerId)
  const queue = useMemo(() => reviewerQueue(state, reviewerId), [reviewerId, state])
  const [answers, setAnswers] = useState<Record<string, number | string>>({})
  const [recommendation, setRecommendation] = useState<ReviewRecommendation>('accept')
  const [comments, setComments] = useState('')
  const selected =
    queue.find((entry) => entry.assignment.id === selectedAssignmentId) ??
    queue.find((entry) => entry.assignment.status !== 'completed') ??
    queue[0]
  const plan = state.evaluationPlans.find(
    (entry) => entry.id === selected?.assignment.evaluationPlanId,
  )
  const criteria = useMemo(
    () => evaluationRoundCriteria(plan, selected?.assignment.roundId),
    [plan, selected?.assignment.roundId],
  )
  const blindReview = evaluationRoundIsBlind(plan, selected?.assignment.roundId)
  const hasRecommendationCriterion = criteria.some(
    (criterion) =>
      evaluationCriterionKind(criterion) === 'select' && /recommendation/iu.test(criterion.label),
  )
  const hasCommentsCriterion = criteria.some(
    (criterion) =>
      evaluationCriterionKind(criterion) === 'long_text' && /comments?/iu.test(criterion.label),
  )

  useEffect(() => {
    if (!selected || !plan) return
    setAnswers(
      Object.fromEntries(
        criteria.map((criterion) => {
          const saved = selected.scorecard?.answers?.[criterion.id]
          if (saved !== undefined) return [criterion.id, saved]
          if (evaluationCriterionKind(criterion) === 'numeric') {
            return [
              criterion.id,
              selected.scorecard?.scores[criterion.id] ?? criterion.maximum ?? 5,
            ]
          }
          if (evaluationCriterionKind(criterion) === 'select') {
            return [criterion.id, criterion.options?.[0] ?? '']
          }
          return [criterion.id, '']
        }),
      ),
    )
    setRecommendation(selected.scorecard?.recommendation ?? 'accept')
    setComments(selected.scorecard?.comments ?? '')
  }, [criteria, plan, selected])

  if (!reviewer) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <div className="max-w-md text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
            This review link is unavailable
          </h1>
          <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
            Ask the program chair for a current reviewer link.
          </p>
        </div>
      </div>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) return
    const response = await execute(
      'review.submit-scorecard',
      {
        assignmentId: selected.assignment.id,
        answers,
        ...(!hasRecommendationCriterion ? { recommendation } : {}),
        ...(!hasCommentsCriterion ? { comments } : {}),
      },
      { expectedVersions: { [selected.assignment.id]: selected.assignment.version } },
      'Review submitted.',
    )
    if (!response.ok) return
    const next = queue.find(
      (entry) =>
        entry.assignment.id !== selected.assignment.id && entry.assignment.status !== 'completed',
    )
    if (next) onSelectionChange(next.assignment.id)
  }

  const complete = queue.filter((entry) => entry.assignment.status === 'completed').length

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-950/5 bg-white">
        <div className="mx-auto flex h-16 max-w-[90rem] items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href={`/reviewer/${reviewer.id}`}
            aria-label="ProgramKit homepage"
            className="focus-ring flex items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-zinc-950"
          >
            <ProgramKitMark className="size-6" />
            ProgramKit
          </a>
          <div className="min-w-0 text-right">
            <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
              {reviewer.name}
            </p>
            <p className="truncate text-sm text-zinc-500">{event.name} review committee</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-[90rem] flex-col gap-7 px-4 py-8 sm:px-6 lg:py-10">
        <div className="flex flex-col gap-4 border-b border-zinc-950/5 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-base text-zinc-500 sm:text-sm">
              {complete} of {queue.length} assignments complete
            </p>
            <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
              Review workspace
            </h1>
            <p className="max-w-[66ch] text-pretty text-base text-zinc-500 sm:text-sm">
              Read each proposal, apply the shared rubric, and leave enough context for the final
              committee decision.
            </p>
          </div>
          <Button
            size="compact"
            onClick={() => {
              window.location.href = '/reviews'
            }}
          >
            <ArrowLeftIcon className="size-4 h-lh shrink-0 fill-current" />
            Organizer view
          </Button>
        </div>

        {selected?.submission && plan ? (
          <div className="grid min-w-0 gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] xl:grid-cols-[18rem_minmax(0,5fr)_minmax(20rem,3fr)]">
            <aside aria-label="Assigned submissions" className="min-w-0">
              <div className="lg:sticky lg:top-6">
                <p className="px-2 pb-2 text-base font-medium text-zinc-500 sm:text-sm">
                  Your assignments
                </p>
                <ol role="list" className="flex gap-2 overflow-x-auto lg:flex-col">
                  {queue.map((entry, index) => {
                    const submission = entry.submission
                    const title = submission
                      ? answerText(submissionAnswerByPurpose(state, submission, 'proposal_title'))
                      : 'Missing proposal'
                    const active = entry.assignment.id === selected.assignment.id
                    return (
                      <li key={entry.assignment.id} className="min-w-64 lg:min-w-0">
                        <button
                          type="button"
                          aria-pressed={active}
                          className={cx(
                            'focus-ring flex w-full items-start gap-3 rounded-lg p-3 text-left',
                            active
                              ? 'bg-zinc-950/5 text-zinc-950'
                              : 'text-zinc-600 hover:bg-zinc-950/3 hover:text-zinc-950',
                          )}
                          onClick={() => onSelectionChange(entry.assignment.id)}
                        >
                          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-mono text-sm tabular-nums text-zinc-500 ring-1 ring-zinc-950/10">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-medium sm:text-sm">
                              {title}
                            </span>
                            <span className="block text-sm text-zinc-500">
                              {entry.assignment.status === 'completed'
                                ? 'Complete'
                                : 'Needs review'}
                            </span>
                          </span>
                          {entry.assignment.status === 'completed' ? (
                            <CheckCircleIcon className="size-4 h-lh shrink-0 fill-emerald-600" />
                          ) : null}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </div>
            </aside>

            <article aria-labelledby="proposal-heading" className="min-w-0">
              <h2
                id="proposal-heading"
                className="max-w-[28ch] text-balance text-2xl font-semibold tracking-tight text-zinc-950"
              >
                {answerText(
                  submissionAnswerByPurpose(state, selected.submission, 'proposal_title'),
                )}
              </h2>
              <p className="pt-1 text-base text-zinc-500 sm:text-sm">
                {sentenceCase(selected.submission.kind)}
              </p>
              <dl className="grid grid-cols-2 gap-4 border-y border-zinc-950/5 py-5 mt-5">
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Format</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {sentenceCase(
                      answerText(
                        submissionAnswerByPurpose(state, selected.submission, 'session_format'),
                      ),
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Track</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {state.tracks.find(
                      (track) =>
                        track.id ===
                        submissionAnswerByPurpose(state, selected.submission!, 'track'),
                    )?.name ?? 'Unassigned'}
                  </dd>
                </div>
              </dl>
              {!blindReview ? (
                <section aria-labelledby="submitter-heading" className="pt-6">
                  <h3 id="submitter-heading" className="text-lg font-semibold text-zinc-950">
                    Submitter
                  </h3>
                  <p className="pt-1 text-base text-zinc-700">
                    {answerText(
                      submissionAnswerByPurpose(state, selected.submission, 'first_name'),
                    )}{' '}
                    {answerText(submissionAnswerByPurpose(state, selected.submission, 'last_name'))}
                  </p>
                  <p className="text-base text-zinc-500 sm:text-sm">
                    {answerText(submissionAnswerByPurpose(state, selected.submission, 'job_title'))}{' '}
                    · {answerText(submissionAnswerByPurpose(state, selected.submission, 'company'))}
                  </p>
                </section>
              ) : null}
              <section aria-labelledby="abstract-heading" className="pt-6">
                <h3 id="abstract-heading" className="text-lg font-semibold text-zinc-950">
                  Abstract
                </h3>
                <p className="max-w-[75ch] pt-2 text-pretty text-base text-zinc-700">
                  {answerText(submissionAnswerByPurpose(state, selected.submission, 'abstract'))}
                </p>
              </section>
              {blindReview ? (
                <p className="mt-8 rounded-lg bg-zinc-50 p-3 text-pretty text-base text-zinc-500 ring-1 ring-zinc-950/5 sm:text-sm">
                  Submitter identity is hidden for this review round.
                </p>
              ) : null}
            </article>

            <form
              className="min-w-0 border-t border-zinc-950/5 pt-6 lg:col-start-2 xl:col-start-auto xl:border-t-0 xl:pt-0"
              onSubmit={(event) => void submit(event)}
            >
              <div className="xl:sticky xl:top-6">
                <h2 className="text-lg font-semibold text-zinc-950">Scorecard</h2>
                <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                  Complete every required field for this round.
                </p>
                <div className="flex flex-col gap-4 pt-5">
                  {criteria.map((criterion) => {
                    const kind = evaluationCriterionKind(criterion)
                    return (
                      <label
                        key={criterion.id}
                        className={cx(
                          'gap-4',
                          kind === 'numeric'
                            ? 'grid grid-cols-[minmax(0,1fr)_5rem] items-end'
                            : 'flex flex-col gap-1.5',
                        )}
                      >
                        <span className="min-w-0">
                          <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                            {criterion.label}
                          </span>
                          {criterion.description ? (
                            <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                              {criterion.description}
                            </span>
                          ) : null}
                        </span>
                        {kind === 'long_text' ? (
                          <textarea
                            name={`answer-${criterion.id}`}
                            rows={5}
                            required={criterion.required ?? true}
                            value={String(answers[criterion.id] ?? '')}
                            onChange={(event) =>
                              setAnswers((current) => ({
                                ...current,
                                [criterion.id]: event.target.value,
                              }))
                            }
                            className={textAreaControl}
                          />
                        ) : (
                          <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
                            <select
                              name={`answer-${criterion.id}`}
                              required={criterion.required ?? true}
                              aria-label={criterion.label}
                              value={answers[criterion.id] ?? ''}
                              onChange={(event) =>
                                setAnswers((current) => ({
                                  ...current,
                                  [criterion.id]:
                                    kind === 'numeric'
                                      ? Number(event.target.value)
                                      : event.target.value,
                                }))
                              }
                              className={selectControl}
                            >
                              {kind === 'numeric'
                                ? Array.from(
                                    {
                                      length:
                                        (criterion.maximum ?? 5) - (criterion.minimum ?? 1) + 1,
                                    },
                                    (_, index) => (criterion.minimum ?? 1) + index,
                                  ).map((score) => (
                                    <option key={score} value={score}>
                                      {score}
                                    </option>
                                  ))
                                : (criterion.options ?? []).map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                            </select>
                            <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
                          </span>
                        )}
                      </label>
                    )
                  })}
                  {!hasRecommendationCriterion ? (
                    <label className="flex flex-col gap-1.5 border-t border-zinc-950/5 pt-4">
                      <span className="text-base font-medium text-zinc-950 sm:text-sm">
                        Recommendation
                      </span>
                      <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
                        <select
                          name="recommendation"
                          value={recommendation}
                          onChange={(event) =>
                            setRecommendation(event.target.value as ReviewRecommendation)
                          }
                          className={selectControl}
                        >
                          {(
                            [
                              'strong_accept',
                              'accept',
                              'borderline',
                              'reject',
                              'strong_reject',
                            ] as const
                          ).map((value) => (
                            <option key={value} value={value}>
                              {sentenceCase(value)}
                            </option>
                          ))}
                        </select>
                        <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
                      </span>
                    </label>
                  ) : null}
                  {!hasCommentsCriterion ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-base font-medium text-zinc-950 sm:text-sm">
                        Committee notes
                      </span>
                      <textarea
                        name="comments"
                        rows={5}
                        value={comments}
                        onChange={(event) => setComments(event.target.value)}
                        className={textAreaControl}
                      />
                    </label>
                  ) : null}
                  <Button type="submit" variant="primary" disabled={mutating}>
                    {selected.assignment.status === 'completed' ? 'Update review' : 'Submit review'}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        ) : (
          <div className="py-20 text-center">
            <CheckCircleIcon className="mx-auto size-10 fill-emerald-600" />
            <h2 className="pt-4 text-lg font-semibold text-zinc-950">All reviews are complete</h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              The program chair can now make final decisions.
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
