import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardDocumentIcon,
  ClockIcon,
  EnvelopeIcon,
  UserPlusIcon,
} from '@heroicons/react/16/solid'
import { useState } from 'react'

import {
  evaluationCriterionKind,
  evaluationRoundCriteria,
  evaluationRoundIsBlind,
  evaluationRoundReviewerTeamId,
  createReviewResultsCsv,
  reviewerReminderMessagePreview,
  reviewerReminderMessageTemplate,
  submissionAnswerByPurpose,
  submissionReviewSummary,
  type SubmissionAnswerValue,
} from '@programkit/core'

import {
  Button,
  Dialog,
  PageHeader,
  ProgressBar,
  StatusBadge,
  cx,
  sentenceCase,
} from '../components/ui.tsx'
import { ReviewAssignmentsDrawer } from '../components/ReviewAssignmentsDrawer.tsx'
import { ReviewSetupDrawer } from '../components/ReviewSetupDrawer.tsx'
import { useWorkspace } from '../lib/workspace.tsx'
import { reviewerAccessPath } from '../lib/public-links.ts'

function answerText(value: SubmissionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null || value === '') return 'Untitled proposal'
  return String(value)
}

function AssignmentStatus({
  status,
}: {
  status: 'assigned' | 'in_progress' | 'completed' | 'recused'
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
        status === 'completed' && 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10',
        status === 'in_progress' && 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
        status === 'assigned' && 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/5',
        status === 'recused' && 'bg-rose-50 text-rose-700 ring-1 ring-rose-700/10',
      )}
    >
      {sentenceCase(status)}
    </span>
  )
}

export function ReviewsView({ navigate }: { navigate: (to: string) => void }) {
  const [setupOpen, setSetupOpen] = useState(false)
  const [assignmentsOpen, setAssignmentsOpen] = useState(false)
  const [reminderReviewerIds, setReminderReviewerIds] = useState<string[]>([])
  const [reminderComposerOpen, setReminderComposerOpen] = useState(false)
  const [reminderMessage, setReminderMessage] = useState(reviewerReminderMessageTemplate())
  const [scoreOrder, setScoreOrder] = useState<'descending' | 'ascending'>('descending')
  const [exported, setExported] = useState(false)
  const [copiedReviewerId, setCopiedReviewerId] = useState<string | null>(null)
  const { payload, execute, mutating } = useWorkspace()
  if (!payload) return null
  const { state } = payload
  const assignments = (state.reviewerAssignments ?? []).filter(
    (entry) => entry.eventId === state.activeEventId,
  )
  const activeAssignments = assignments.filter((entry) => entry.status !== 'recused')
  const completed = activeAssignments.filter((entry) => entry.status === 'completed').length
  const completion =
    activeAssignments.length === 0 ? 0 : Math.round((completed / activeAssignments.length) * 100)
  const plan = (state.evaluationPlans ?? []).find((entry) => entry.eventId === state.activeEventId)
  const reviewerTeamIds = new Set(
    plan?.rounds.flatMap((round) => [
      evaluationRoundReviewerTeamId(plan, round.id),
      ...(round.categoryRoutes ?? []).map((route) => route.reviewerTeamId),
    ]) ?? [],
  )
  const reviewerIds = new Set(
    (state.reviewerTeams ?? [])
      .filter((team) => reviewerTeamIds.has(team.id))
      .flatMap((team) => team.reviewerIds),
  )
  const reviewers = (state.reviewers ?? []).filter((entry) => reviewerIds.has(entry.id))
  const reviewerProgress = reviewers
    .map((reviewer) => {
      const reviewerAssignments = assignments.filter(
        (assignment) => assignment.reviewerId === reviewer.id && assignment.status !== 'recused',
      )
      const reviewerCompleted = reviewerAssignments.filter(
        (assignment) => assignment.status === 'completed',
      ).length
      return {
        reviewer,
        assigned: reviewerAssignments.length,
        completed: reviewerCompleted,
        outstanding: reviewerAssignments.length - reviewerCompleted,
      }
    })
    .sort(
      (left, right) =>
        right.outstanding - left.outstanding ||
        left.reviewer.name.localeCompare(right.reviewer.name),
    )
  const reminderPreviews = reminderReviewerIds
    .map((reviewerId) => reviewers.find((reviewer) => reviewer.id === reviewerId))
    .flatMap((reviewer) => {
      if (!reviewer) return []
      const preview = reviewerReminderMessagePreview(state, reviewer, reminderMessage)
      return preview ? [preview] : []
    })
  const sampleReminder = reminderPreviews[0]
  const inReview = (state.submissions ?? [])
    .filter(
      (submission) =>
        submission.eventId === state.activeEventId &&
        (submission.status === 'submitted' || submission.status === 'in_review'),
    )
    .map((submission) => ({ submission, review: submissionReviewSummary(state, submission.id) }))
    .sort(
      (left, right) =>
        left.review.completed - right.review.completed ||
        left.review.assigned - right.review.assigned ||
        answerText(
          submissionAnswerByPurpose(state, left.submission, 'proposal_title'),
        ).localeCompare(
          answerText(submissionAnswerByPurpose(state, right.submission, 'proposal_title')),
        ),
    )
  const assignedSubmissionIds = new Set(
    activeAssignments.map((assignment) => assignment.submissionId),
  )
  const resultRows = (state.submissions ?? [])
    .filter(
      (submission) =>
        submission.eventId === state.activeEventId && assignedSubmissionIds.has(submission.id),
    )
    .map((submission) => ({ submission, review: submissionReviewSummary(state, submission.id) }))
    .sort((left, right) => {
      if (left.review.averageScore == null || right.review.averageScore == null) {
        if (left.review.averageScore == null && right.review.averageScore == null) {
          return answerText(
            submissionAnswerByPurpose(state, left.submission, 'proposal_title'),
          ).localeCompare(
            answerText(submissionAnswerByPurpose(state, right.submission, 'proposal_title')),
          )
        }
        return left.review.averageScore == null ? 1 : -1
      }
      return scoreOrder === 'descending'
        ? right.review.averageScore - left.review.averageScore
        : left.review.averageScore - right.review.averageScore
    })

  async function remindReviewers() {
    const response = await execute(
      'review.remind',
      {
        reviewerIds: reminderReviewerIds,
        subject: reminderMessage.subject,
        body: reminderMessage.body,
      },
      undefined,
      `Reminder${reminderReviewerIds.length === 1 ? '' : 's'} queued.`,
    )
    if (response.ok) {
      setReminderReviewerIds([])
      setReminderComposerOpen(false)
    }
  }

  function reviewReminders() {
    setReminderMessage(reviewerReminderMessageTemplate())
    setReminderComposerOpen(true)
  }

  function reviewerLink(reviewerId: string, accessKey: string) {
    return reviewerAccessPath(state.activeEventId, reviewerId, accessKey)
  }

  async function copyReviewerLink(reviewerId: string, accessKey: string) {
    try {
      const url = new URL(reviewerLink(reviewerId, accessKey), window.location.origin)
      await navigator.clipboard.writeText(url.toString())
      setCopiedReviewerId(reviewerId)
      window.setTimeout(
        () => setCopiedReviewerId((current) => (current === reviewerId ? null : current)),
        1800,
      )
    } catch {
      setCopiedReviewerId(null)
    }
  }

  function downloadReviewResults() {
    const event = state.events.find((entry) => entry.id === state.activeEventId)
    const blob = new Blob([createReviewResultsCsv(state)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${event?.slug ?? 'programkit'}-review-results.csv`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
    setExported(true)
  }

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Review"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => setSetupOpen(true)}>
              <AdjustmentsHorizontalIcon className="size-4 h-lh shrink-0 fill-current" />
              Configure
            </Button>
            <Button onClick={() => setAssignmentsOpen(true)}>
              <UserPlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Assign reviews
            </Button>
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
              {completed} of {activeAssignments.length} assigned reviews are complete.
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
            ['Assigned reviews', activeAssignments.length],
            ['Outstanding', activeAssignments.length - completed],
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

      <section aria-labelledby="reviewer-progress-heading" className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-zinc-950/5 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="reviewer-progress-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Reviewer progress
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              Select anyone who is behind and send one reminder.
            </p>
          </div>
          <Button disabled={mutating || reminderReviewerIds.length === 0} onClick={reviewReminders}>
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            Review reminder{reminderReviewerIds.length === 1 ? '' : 's'}
          </Button>
        </div>
        <div className="-mx-4 overflow-x-auto sm:-mx-6">
          <div className="inline-block min-w-full px-4 align-middle sm:px-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-950/5 text-left">
                  <th scope="col" className="w-10 py-3 pr-2">
                    <span className="sr-only">Select</span>
                  </th>
                  {[
                    'Reviewer',
                    'Assigned',
                    'Completed',
                    'Progress',
                    'Last reminder',
                    'Portal link',
                  ].map((heading) => (
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
                {reviewerProgress.map(({ reviewer, assigned, completed, outstanding }) => {
                  const percent = assigned === 0 ? 0 : Math.round((completed / assigned) * 100)
                  const selected = reminderReviewerIds.includes(reviewer.id)
                  return (
                    <tr key={reviewer.id}>
                      <td className="py-3 pr-2">
                        <input
                          type="checkbox"
                          aria-label={`Select ${reviewer.name}`}
                          className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
                          disabled={outstanding === 0}
                          checked={selected}
                          onChange={() =>
                            setReminderReviewerIds((current) =>
                              current.includes(reviewer.id)
                                ? current.filter((id) => id !== reviewer.id)
                                : [...current, reviewer.id],
                            )
                          }
                        />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <span className="block text-sm font-medium text-zinc-950">
                          {reviewer.name}
                        </span>
                        <span className="block text-sm text-zinc-500">{reviewer.email}</span>
                      </td>
                      <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">{assigned}</td>
                      <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">{completed}</td>
                      <td className="min-w-36 py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 min-w-20 flex-1 overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-blue-600"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-sm tabular-nums text-zinc-500">
                            {percent}%
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-sm text-zinc-500">
                        {reviewer.lastRemindedAt
                          ? new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(reviewer.lastRemindedAt))
                          : 'Never'}
                      </td>
                      <td className="whitespace-nowrap py-3 text-sm">
                        {reviewer.accessKey ? (
                          <div className="flex items-center gap-1">
                            <Button
                              size="compact"
                              onClick={() => void copyReviewerLink(reviewer.id, reviewer.accessKey)}
                            >
                              <ClipboardDocumentIcon className="size-4 h-lh shrink-0 fill-current" />
                              {copiedReviewerId === reviewer.id ? 'Copied' : 'Copy link'}
                            </Button>
                            <a
                              href={reviewerLink(reviewer.id, reviewer.accessKey)}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Open ${reviewer.name}'s reviewer portal`}
                              className="touch-target focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 motion-safe:transition-transform motion-safe:active:scale-95 hover:bg-zinc-950/5 hover:text-zinc-950"
                            >
                              <ArrowTopRightOnSquareIcon className="size-4 fill-current" />
                            </a>
                          </div>
                        ) : (
                          <span className="text-zinc-400">Available after next save</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section aria-labelledby="review-results-heading" className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-zinc-950/5 pb-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="review-results-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Review results
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              Weighted committee scores across every active evaluation round.
            </p>
          </div>
          <Button onClick={downloadReviewResults}>
            <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
            {exported ? 'Downloaded' : 'Export CSV'}
          </Button>
        </div>
        <div className="-mx-4 overflow-x-auto sm:-mx-6">
          <div className="inline-block min-w-full px-4 align-middle sm:px-6">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-950/5 text-left">
                  <th scope="col" className="py-3 pr-4 text-sm font-medium text-zinc-500">
                    Proposal
                  </th>
                  <th scope="col" className="py-3 pr-4 text-sm font-medium text-zinc-500">
                    Reviews
                  </th>
                  <th scope="col" className="py-3 pr-4 text-sm font-medium text-zinc-500">
                    <button
                      type="button"
                      className="focus-ring inline-flex items-center gap-1 rounded-md text-left hover:text-zinc-950"
                      aria-label={`Weighted score, ${scoreOrder}`}
                      onClick={() =>
                        setScoreOrder((current) =>
                          current === 'descending' ? 'ascending' : 'descending',
                        )
                      }
                    >
                      Weighted score
                      {scoreOrder === 'descending' ? (
                        <ChevronDownIcon className="size-4 fill-current" />
                      ) : (
                        <ChevronUpIcon className="size-4 fill-current" />
                      )}
                    </button>
                  </th>
                  <th scope="col" className="py-3 pr-4 text-sm font-medium text-zinc-500">
                    Recommendations
                  </th>
                  <th scope="col" className="py-3 text-sm font-medium text-zinc-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/5">
                {resultRows.map(({ submission, review }) => {
                  const recommendation = Object.entries(review.recommendations)
                    .sort((left, right) => right[1] - left[1])
                    .map(([label, count]) => `${count} ${sentenceCase(label)}`)
                    .join(' · ')
                  return (
                    <tr key={submission.id}>
                      <td className="max-w-md py-3 pr-4">
                        <button
                          type="button"
                          className="focus-ring max-w-full truncate rounded-md text-left text-sm font-medium text-zinc-950 hover:text-blue-600"
                          onClick={() => navigate(`/submissions?submission=${submission.id}`)}
                        >
                          {answerText(
                            submissionAnswerByPurpose(state, submission, 'proposal_title'),
                          )}
                        </button>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-sm tabular-nums text-zinc-600">
                        {review.completed}/{review.assigned}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-sm font-medium tabular-nums text-zinc-950">
                        {review.averageScore?.toFixed(2) ?? '—'}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4 text-sm text-zinc-600">
                        {recommendation || 'No recommendations'}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={submission.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
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
                  onClick={() => navigate(`/submissions?submission=${submission.id}`)}
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
                      {round.categoryRoutes && round.categoryRoutes.length > 0 ? (
                        <ul
                          role="list"
                          className="flex flex-wrap gap-x-3 gap-y-1 pt-3 text-sm text-zinc-500"
                        >
                          {round.categoryRoutes.map((route) => {
                            const track = state.tracks.find((entry) => entry.id === route.trackId)
                            const routedTeam = state.reviewerTeams.find(
                              (entry) => entry.id === route.reviewerTeamId,
                            )
                            return (
                              <li key={route.trackId}>
                                {track?.name ?? 'Unknown category'} →{' '}
                                {routedTeam?.name ?? 'Unknown pool'}
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
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
      <Dialog
        open={reminderComposerOpen}
        onClose={() => {
          if (!mutating) setReminderComposerOpen(false)
        }}
        title={`Review reminder${reminderReviewerIds.length === 1 ? '' : 's'}`}
        description="Each reviewer receives their own count and private workspace link."
        footer={
          <>
            <Button
              size="compact"
              disabled={mutating}
              onClick={() => setReminderComposerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="compact"
              variant="primary"
              disabled={
                mutating ||
                reminderReviewerIds.length === 0 ||
                !reminderMessage.subject.trim() ||
                !reminderMessage.body.trim()
              }
              onClick={() => void remindReviewers()}
            >
              <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
              Queue reminder{reminderReviewerIds.length === 1 ? '' : 's'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-xl bg-zinc-50 px-4 py-2.5 ring-1 ring-zinc-950/5">
            <p className="text-sm text-zinc-500">
              {reminderPreviews.length} recipient{reminderPreviews.length === 1 ? '' : 's'}
            </p>
            <p className="truncate pt-0.5 text-base font-medium text-zinc-950 sm:text-sm">
              {reminderPreviews.map((preview) => preview.recipientName).join(', ')}
            </p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Subject</span>
            <input
              type="text"
              required
              value={reminderMessage.subject}
              onChange={(event) =>
                setReminderMessage((current) => ({ ...current, subject: event.target.value }))
              }
              className="focus-ring min-h-11 rounded-xl bg-white px-3.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Message</span>
            <textarea
              required
              rows={4}
              value={reminderMessage.body}
              onChange={(event) =>
                setReminderMessage((current) => ({ ...current, body: event.target.value }))
              }
              className="focus-ring resize-y rounded-xl bg-white px-3.5 py-2.5 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:text-sm"
            />
          </label>
          <p className="text-pretty text-sm text-zinc-500">
            Merge fields: {'{{first_name}}'}, {'{{full_name}}'}, {'{{event_name}}'},{' '}
            {'{{outstanding_reviews}}'}, and {'{{reviewer_link}}'}.
          </p>
          {sampleReminder ? (
            <div className="rounded-xl bg-zinc-950 px-4 py-4 text-white shadow-lg">
              <p className="text-sm font-medium">{sampleReminder.subject}</p>
              <p className="line-clamp-3 whitespace-pre-wrap pt-2 text-pretty text-sm text-zinc-300">
                {sampleReminder.body}
              </p>
            </div>
          ) : null}
        </div>
      </Dialog>
      <ReviewAssignmentsDrawer open={assignmentsOpen} onClose={() => setAssignmentsOpen(false)} />
      <ReviewSetupDrawer open={setupOpen} onClose={() => setSetupOpen(false)} />
    </div>
  )
}
