import { ArrowRightIcon, ClockIcon } from '@heroicons/react/16/solid'

import {
  evaluationCriterionKind,
  evaluationRoundCriteria,
  evaluationRoundIsBlind,
  evaluationRoundReviewerTeamId,
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
  const { payload } = useWorkspace()
  if (!payload) return null
  const { state } = payload
  const assignments = (state.reviewerAssignments ?? []).filter(
    (entry) => entry.eventId === state.activeEventId,
  )
  const completed = assignments.filter((entry) => entry.status === 'completed').length
  const completion =
    assignments.length === 0 ? 0 : Math.round((completed / assignments.length) * 100)
  const plan = (state.evaluationPlans ?? []).find((entry) => entry.eventId === state.activeEventId)
  const reviewerTeamIds = new Set(
    plan?.rounds.map((round) => evaluationRoundReviewerTeamId(plan, round.id)) ?? [],
  )
  const reviewerIds = new Set(
    (state.reviewerTeams ?? [])
      .filter((team) => reviewerTeamIds.has(team.id))
      .flatMap((team) => team.reviewerIds),
  )
  const reviewers = (state.reviewers ?? []).filter((entry) => reviewerIds.has(entry.id))
  const inReview = (state.submissions ?? [])
    .filter(
      (submission) =>
        submission.eventId === state.activeEventId &&
        (submission.status === 'submitted' || submission.status === 'in_review'),
    )
    .map((submission) => ({ submission, review: submissionReviewSummary(state, submission.id) }))
    .sort((left, right) => right.review.completed - left.review.completed)

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
            {inReview.map(({ submission, review }) => (
              <li key={submission.id}>
                <button
                  type="button"
                  className="focus-ring flex w-full items-center gap-4 rounded-lg py-4 text-left hover:bg-zinc-950/2"
                  onClick={() => navigate('/submissions')}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {answerText(submissionAnswerByPurpose(state, submission, 'proposal_title'))}
                    </span>
                    <span className="block truncate text-base text-zinc-500 sm:text-sm">
                      {answerText(submissionAnswerByPurpose(state, submission, 'first_name'))}{' '}
                      {answerText(submissionAnswerByPurpose(state, submission, 'last_name'))} ·{' '}
                      {review.completed}/{review.assigned} reviews
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                      {review.averageScore?.toFixed(1) ?? '—'}
                    </span>
                    <span className="block text-sm text-zinc-500">average</span>
                  </span>
                </button>
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
            <div className="divide-y divide-zinc-950/5">
              {[...plan.rounds]
                .sort((left, right) => left.order - right.order)
                .map((round) => {
                  const teamId = evaluationRoundReviewerTeamId(plan, round.id)
                  const team = state.reviewerTeams.find((entry) => entry.id === teamId)
                  const criteria = evaluationRoundCriteria(plan, round.id)
                  return (
                    <article key={round.id} className="py-4 first:pt-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                            {round.name}
                          </h3>
                          <p className="truncate text-base text-zinc-500 sm:text-sm">
                            {team?.name ?? 'No reviewer pool'} ·{' '}
                            {evaluationRoundIsBlind(plan, round.id)
                              ? 'Blind review'
                              : 'Visible submitter'}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm text-zinc-500">
                          {round.reviewersPerSubmission} per proposal
                        </span>
                      </div>
                      <ul role="list" className="flex flex-wrap gap-1.5 pt-3">
                        {criteria.map((criterion) => (
                          <li
                            key={criterion.id}
                            className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-zinc-700 ring-1 ring-zinc-950/5"
                          >
                            {criterion.label}
                            {evaluationCriterionKind(criterion) === 'numeric'
                              ? ` · ${criterion.minimum ?? 1}–${criterion.maximum ?? 5} · ${criterion.weight}×`
                              : ''}
                          </li>
                        ))}
                      </ul>
                    </article>
                  )
                })}
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
