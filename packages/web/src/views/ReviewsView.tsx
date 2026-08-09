import { ArrowRightIcon, ClockIcon } from '@heroicons/react/16/solid'

import {
  submissionAnswerByPurpose,
  submissionReviewSummary,
  type SubmissionAnswerValue,
} from '@programkit/core'

import { Button, PageHeader, ProgressBar, cx, sentenceCase } from '../components/ui.tsx'
import { useWorkspace } from '../lib/workspace.tsx'

function answerText(value: SubmissionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null || value === '') return 'Untitled proposal'
  return String(value)
}

function AssignmentStatus({ status }: { status: 'assigned' | 'in_progress' | 'completed' }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
        status === 'completed' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10',
        status === 'in_progress' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
        status === 'assigned' && 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/5',
      )}
    >
      {sentenceCase(status)}
    </span>
  )
}

export function ReviewsView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  if (!payload) return null
  const { state } = payload
  const assignments = (state.reviewerAssignments ?? []).filter(
    (entry) => entry.eventId === state.activeEventId,
  )
  const completed = assignments.filter((entry) => entry.status === 'completed').length
  const completion =
    assignments.length === 0 ? 0 : Math.round((completed / assignments.length) * 100)
  const plan = (state.evaluationPlans ?? []).find((entry) => entry.eventId === state.activeEventId)
  const rounds = [...(plan?.rounds ?? [])].sort((left, right) => left.order - right.order)
  const team = state.reviewerTeams?.find((entry) => entry.id === plan?.reviewerTeamId)
  const reviewers = (state.reviewers ?? []).filter((entry) => team?.reviewerIds.includes(entry.id))
  const inReview = (state.submissions ?? [])
    .filter(
      (submission) =>
        submission.eventId === state.activeEventId &&
        (submission.status === 'submitted' || submission.status === 'in_review'),
    )
    .map((submission) => {
      const submissionAssignments = assignments.filter(
        (entry) => entry.submissionId === submission.id,
      )
      const assignedRoundIds = new Set(submissionAssignments.map((entry) => entry.roundId))
      const currentRoundIndex = rounds.reduce(
        (highest, round, index) => (assignedRoundIds.has(round.id) ? index : highest),
        -1,
      )
      const currentRound = rounds[currentRoundIndex]
      const nextRound = rounds[currentRoundIndex + 1]
      const review = submissionReviewSummary(state, submission.id)
      return {
        submission,
        review,
        currentRound,
        nextRound,
        canAdvance:
          Boolean(currentRound && nextRound) &&
          review.completed >= (currentRound?.minimumCompletedReviews ?? Number.POSITIVE_INFINITY),
      }
    })
    .sort((left, right) => right.review.completed - left.review.completed)

  async function advanceRound(
    submission: (typeof inReview)[number]['submission'],
    nextRound: NonNullable<(typeof inReview)[number]['nextRound']>,
  ) {
    await execute(
      'review.advance-round',
      { submissionId: submission.id },
      {
        expectedVersions: { [submission.id]: submission.version },
        idempotencyKey: `review-round:${submission.id}:${nextRound.id}`,
      },
      `Proposal advanced to ${nextRound.name}.`,
    )
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Review"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => navigate('/reviewer/rev_001')}>Open reviewer portal</Button>
            <Button onClick={() => navigate('/submissions')}>
              Review submissions
              <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
            </Button>
          </div>
        }
      />

      <section aria-labelledby="review-progress-heading" className="@container">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2
              id="review-progress-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Committee progress
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              {completed} of {assignments.length} assigned reviews are complete.
            </p>
          </div>
          <p className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
            {completion}% complete
          </p>
        </div>
        <div className="pt-3">
          <ProgressBar value={completion} />
        </div>
        <dl className="grid grid-cols-2 pt-5 @3xl:grid-cols-4">
          {[
            ['Assigned reviews', assignments.length],
            ['Outstanding', assignments.length - completed],
            [
              'Active reviewers',
              reviewers.filter((reviewer) => reviewer.status === 'active').length,
            ],
            ['Proposals in review', inReview.length],
          ].map(([label, value], index) => (
            <div
              key={String(label)}
              className={cx(
                'border-zinc-950/5 py-3',
                index % 2 === 0 ? 'pr-5' : 'border-l pl-5',
                index > 1 && 'border-t @3xl:border-t-0',
                index === 2 && '@3xl:border-l @3xl:pl-5',
              )}
            >
              <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
              <dd className="pt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-8 xl:grid-cols-[7fr_5fr]">
        <section aria-labelledby="decision-queue-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-2">
            <div>
              <h2
                id="decision-queue-heading"
                className="text-base font-medium text-zinc-950 sm:text-sm"
              >
                Decision queue
              </h2>
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                Proposals still moving through committee review.
              </p>
            </div>
            <button
              type="button"
              className="focus-ring rounded-md text-base font-medium text-blue-600 hover:text-blue-700 sm:text-sm"
              onClick={() => navigate('/submissions')}
            >
              View all
            </button>
          </div>
          <ul role="list" className="divide-y divide-zinc-950/5">
            {inReview.map(({ submission, review, currentRound, nextRound, canAdvance }) => (
              <li key={submission.id} className="flex flex-wrap items-center gap-3 py-3">
                <button
                  type="button"
                  className="focus-ring flex min-w-0 flex-1 items-center gap-4 rounded-lg py-1 text-left hover:bg-zinc-950/2"
                  onClick={() => navigate('/submissions')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {answerText(submissionAnswerByPurpose(state, submission, 'proposal_title'))}
                    </span>
                    <span className="block truncate text-base text-zinc-500 sm:text-sm">
                      {answerText(submissionAnswerByPurpose(state, submission, 'first_name'))}{' '}
                      {answerText(submissionAnswerByPurpose(state, submission, 'last_name'))} ·{' '}
                      {currentRound?.name ?? 'Review'} · {review.completed}/{review.assigned}{' '}
                      reviews
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                      {review.averageScore?.toFixed(1) ?? '—'}
                    </span>
                    <span className="block text-sm text-zinc-500">average</span>
                  </span>
                </button>
                {canAdvance && nextRound ? (
                  <Button
                    size="compact"
                    disabled={mutating}
                    onClick={() => void advanceRound(submission, nextRound)}
                  >
                    Advance to {nextRound.name}
                    <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="plan-heading" className="min-w-0">
          <div className="border-b border-zinc-950/5 pb-2">
            <h2 id="plan-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Evaluation plan
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              The rules every reviewer applies.
            </p>
          </div>
          {plan ? (
            <div className="flex flex-col gap-5 pt-4">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Reviewer team</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {team?.name ?? 'Unassigned'}
                  </dd>
                </div>
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Identity</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {plan.blindReview ? 'Blind review' : 'Visible submitter'}
                  </dd>
                </div>
              </dl>
              <div>
                <p className="text-base font-medium text-zinc-950 sm:text-sm">Review rounds</p>
                <ol role="list" className="divide-y divide-zinc-950/5 pt-1">
                  {rounds.map((round, index) => {
                    const roundAssignments = assignments.filter(
                      (entry) => entry.roundId === round.id,
                    )
                    const roundCompleted = roundAssignments.filter(
                      (entry) => entry.status === 'completed',
                    ).length
                    const proposalCount = new Set(
                      roundAssignments.map((entry) => entry.submissionId),
                    ).size
                    return (
                      <li key={round.id} className="flex items-start gap-3 py-3">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-medium tabular-nums text-zinc-700">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                            {round.name}
                          </span>
                          <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                            {round.minimumCompletedReviews} completed reviews required ·{' '}
                            {round.reviewersPerSubmission} reviewers per proposal
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm tabular-nums text-zinc-500">
                          <span className="block font-medium text-zinc-700">
                            {roundCompleted}/{roundAssignments.length}
                          </span>
                          <span className="block">
                            {proposalCount} proposal{proposalCount === 1 ? '' : 's'}
                          </span>
                        </span>
                      </li>
                    )
                  })}
                </ol>
              </div>
              <div>
                <p className="text-base font-medium text-zinc-950 sm:text-sm">Scoring criteria</p>
                <ul role="list" className="divide-y divide-zinc-950/5 pt-1">
                  {plan.criteria.map((criterion) => (
                    <li key={criterion.id} className="flex items-start justify-between gap-4 py-3">
                      <span className="min-w-0">
                        <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                          {criterion.label}
                        </span>
                        <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                          {criterion.description}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                        {criterion.weight}× weight
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 py-8 text-zinc-500">
              <ClockIcon className="size-4 h-lh shrink-0 fill-current" />
              <p className="text-pretty text-base sm:text-sm">
                Create a plan to begin assigning reviews.
              </p>
            </div>
          )}
        </section>
      </div>

      <section aria-labelledby="assignment-heading" className="min-w-0">
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 id="assignment-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Reviewer assignments
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Every outstanding review and its owner.
          </p>
        </div>
        <div className="-mx-4 -my-2 overflow-x-auto whitespace-nowrap sm:-mx-6">
          <div className="inline-block min-w-full px-4 py-2 align-middle sm:px-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-950/5 text-left">
                  {['Reviewer', 'Proposal', 'Round', 'Due', 'Status'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-zinc-500"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/5">
                {assignments.map((assignment) => {
                  const reviewer = state.reviewers.find(
                    (entry) => entry.id === assignment.reviewerId,
                  )
                  const submission = state.submissions.find(
                    (entry) => entry.id === assignment.submissionId,
                  )
                  const round = plan?.rounds.find((entry) => entry.id === assignment.roundId)
                  return (
                    <tr key={assignment.id}>
                      <td className="py-3 pr-4 text-sm font-medium text-zinc-950">
                        {reviewer?.name ?? 'Unknown reviewer'}
                      </td>
                      <td className="max-w-md truncate py-3 pr-4 text-sm text-zinc-600">
                        {submission
                          ? answerText(
                              submissionAnswerByPurpose(state, submission, 'proposal_title'),
                            )
                          : 'Missing submission'}
                      </td>
                      <td className="py-3 pr-4 text-sm text-zinc-600">{round?.name ?? 'Review'}</td>
                      <td className="py-3 pr-4 text-sm text-zinc-500">
                        {assignment.dueAt
                          ? new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(assignment.dueAt))
                          : 'No deadline'}
                      </td>
                      <td className="py-3">
                        <AssignmentStatus status={assignment.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}
