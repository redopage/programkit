import {
  ArrowTopRightOnSquareIcon,
  CheckIcon,
  ClockIcon,
  LinkIcon,
} from '@heroicons/react/16/solid'
import { useMemo } from 'react'

import {
  submissionAnswerByPurpose,
  submissionPipelineSummary,
  submissionReviewSummary,
  type SubmissionAnswerValue,
  type SubmissionStatus,
} from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  StatusBadge,
  Toolbar,
  cx,
  sentenceCase,
} from '../components/ui.tsx'

export type SubmissionFilter = 'all' | SubmissionStatus

export interface SubmissionsViewSearch {
  submission?: string
  status?: SubmissionFilter
  q?: string
}

function answerText(value: SubmissionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value == null || value === '') return 'Not provided'
  return String(value)
}

export function SubmissionsView({
  navigate,
  search,
  onSearchChange,
}: {
  navigate: (to: string) => void
  search: SubmissionsViewSearch
  onSearchChange: (next: SubmissionsViewSearch) => void
}) {
  const { payload } = useWorkspace()
  const filter = search.status ?? 'all'
  const query = search.q ?? ''
  const selectedId = search.submission ?? null
  if (!payload) return null

  const { state } = payload
  const form = (state.submissionForms ?? []).find((entry) => entry.eventId === state.activeEventId)
  const pipeline = submissionPipelineSummary(state)
  const submissions = useMemo(
    () =>
      (state.submissions ?? [])
        .filter((submission) => submission.eventId === state.activeEventId)
        .filter((submission) => filter === 'all' || submission.status === filter)
        .filter((submission) => {
          const search = query.trim().toLowerCase()
          if (!search) return true
          const haystack = [
            answerText(submissionAnswerByPurpose(state, submission, 'proposal_title')),
            answerText(submissionAnswerByPurpose(state, submission, 'first_name')),
            answerText(submissionAnswerByPurpose(state, submission, 'last_name')),
            answerText(submissionAnswerByPurpose(state, submission, 'company')),
          ]
            .join(' ')
            .toLowerCase()
          return haystack.includes(search)
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [filter, query, state],
  )

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Submissions"
        description="Triage proposals, read reviews, and move accepted work into the program."
        actions={
          <>
            <Button
              size="compact"
              onClick={() => {
                const url = `${window.location.origin}/submit/${form?.slug ?? 'call-for-speakers'}`
                void navigator.clipboard.writeText(url)
              }}
            >
              <LinkIcon className="size-4 h-lh shrink-0 fill-current" />
              Copy public link
            </Button>
            <Button
              variant="primary"
              onClick={() => navigate(`/submit/${form?.slug ?? 'call-for-speakers'}`)}
            >
              Open submission form
              <ArrowTopRightOnSquareIcon className="size-4 h-lh shrink-0 fill-current" />
            </Button>
          </>
        }
      />

      <section aria-labelledby="pipeline-heading" className="@container">
        <h2 id="pipeline-heading" className="sr-only">
          Submission pipeline
        </h2>
        <dl className="grid grid-cols-2 border-y border-zinc-950/5 @3xl:grid-cols-4">
          {[
            ['New', pipeline.submitted, 'Ready for triage'],
            ['In review', pipeline.inReview, `${pipeline.awaitingReviews} waiting on reviewers`],
            ['Accepted', pipeline.accepted, 'Converted to sessions'],
            ['Drafts', pipeline.draft, 'Not submitted yet'],
          ].map(([label, value, detail], index) => (
            <div
              key={String(label)}
              className={cx(
                'border-zinc-950/5 py-4',
                index % 2 === 0 ? 'pr-5' : 'border-l pl-5',
                index > 1 && 'border-t @3xl:border-t-0',
                index === 2 && '@3xl:border-l @3xl:pl-5',
              )}
            >
              <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
              <dd className="pt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">
                {value}
              </dd>
              <dd className="truncate text-base text-zinc-500 sm:text-sm">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="submission-list-heading" className="min-w-0">
        <div className="flex flex-col gap-3 border-b border-zinc-950/5 pb-2">
          <div>
            <h2
              id="submission-list-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              All proposals
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              Filter the queue, then open a proposal to review its content and decision history.
            </p>
          </div>
          <Toolbar>
            <FilterTabs
              label="Filter submissions"
              value={filter}
              onChange={(next) => onSearchChange({ ...search, status: next })}
              options={[
                ['all', 'All'],
                ['submitted', 'New'],
                ['in_review', 'In review'],
                ['accepted', 'Accepted'],
                ['rejected', 'Rejected'],
              ]}
            />
            <SearchInput
              label="Search submissions"
              name="submission-search"
              placeholder="Search proposals"
              value={query}
              onChange={(next) => onSearchChange({ ...search, q: next || undefined })}
            />
          </Toolbar>
        </div>

        {submissions.length === 0 ? (
          <EmptyState
            title="No proposals here"
            description="No proposal matches this filter and search."
            action={
              filter !== 'all' || query !== '' ? (
                <Button
                  size="compact"
                  onClick={() => onSearchChange({ submission: selectedId ?? undefined })}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="-mx-4 -my-2 hidden overflow-x-auto whitespace-nowrap sm:-mx-6 lg:block">
              <div className="inline-block min-w-full px-4 py-2 align-middle sm:px-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-950/5 text-left">
                      {['Proposal', 'Speaker', 'Type', 'Review', 'Status', 'Updated'].map(
                        (heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="whitespace-nowrap py-3 pr-4 text-sm font-medium text-zinc-500"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-950/5">
                    {submissions.map((submission) => {
                      const title = answerText(
                        submissionAnswerByPurpose(state, submission, 'proposal_title'),
                      )
                      const firstName = answerText(
                        submissionAnswerByPurpose(state, submission, 'first_name'),
                      )
                      const lastName = answerText(
                        submissionAnswerByPurpose(state, submission, 'last_name'),
                      )
                      const review = submissionReviewSummary(state, submission.id)
                      return (
                        <tr key={submission.id}>
                          <td className="max-w-md py-3 pr-4">
                            <button
                              type="button"
                              className="focus-ring max-w-full truncate rounded-md text-left text-sm font-medium text-zinc-950 hover:text-blue-600"
                              onClick={() =>
                                onSearchChange({ ...search, submission: submission.id })
                              }
                            >
                              {title}
                            </button>
                          </td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">
                            {firstName} {lastName}
                          </td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">
                            {sentenceCase(submission.kind)}
                          </td>
                          <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                            {review.averageScore == null
                              ? `${review.completed}/${review.assigned}`
                              : `${review.averageScore.toFixed(1)} · ${review.completed}/${review.assigned}`}
                          </td>
                          <td className="py-3 pr-4">
                            <StatusBadge
                              status={submission.status}
                              label={submission.status === 'submitted' ? 'New' : undefined}
                            />
                          </td>
                          <td className="py-3 text-sm text-zinc-500">
                            {new Intl.DateTimeFormat('en-US', {
                              month: 'short',
                              day: 'numeric',
                            }).format(new Date(submission.updatedAt))}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <ul role="list" className="divide-y divide-zinc-950/5 lg:hidden">
              {submissions.map((submission) => {
                const title = answerText(
                  submissionAnswerByPurpose(state, submission, 'proposal_title'),
                )
                const speaker = `${answerText(submissionAnswerByPurpose(state, submission, 'first_name'))} ${answerText(submissionAnswerByPurpose(state, submission, 'last_name'))}`
                return (
                  <li key={submission.id}>
                    <button
                      type="button"
                      className="focus-ring flex w-full items-start gap-4 rounded-lg py-4 text-left hover:bg-zinc-950/2"
                      onClick={() => onSearchChange({ ...search, submission: submission.id })}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-zinc-950">
                          {title}
                        </span>
                        <span className="block truncate text-base text-zinc-500">
                          {speaker} · {sentenceCase(submission.kind)}
                        </span>
                      </span>
                      <StatusBadge
                        status={submission.status}
                        label={submission.status === 'submitted' ? 'New' : undefined}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </section>

      <SubmissionDrawer
        submissionId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => onSearchChange({ ...search, submission: undefined })}
      />
    </div>
  )
}

function SubmissionDrawer({
  submissionId,
  open,
  onClose,
}: {
  submissionId: string | null
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const submission = payload?.state.submissions?.find((entry) => entry.id === submissionId)
  if (!payload || !submission) return null

  const { state } = payload
  const title = answerText(submissionAnswerByPurpose(state, submission, 'proposal_title'))
  const review = submissionReviewSummary(state, submission.id)
  const assignmentIds = new Set(
    state.reviewerAssignments
      .filter((entry) => entry.submissionId === submission.id)
      .map((entry) => entry.id),
  )
  const scorecards = state.scorecards.filter((entry) => assignmentIds.has(entry.assignmentId))
  const plan = state.evaluationPlans.find(
    (entry) =>
      entry.id ===
      state.reviewerAssignments.find((a) => a.submissionId === submission.id)?.evaluationPlanId,
  )
  const firstRound = plan?.rounds.slice().sort((left, right) => left.order - right.order)[0]
  const decisionReady =
    submission.kind === 'guaranteed_session' ||
    !firstRound ||
    review.completed >= firstRound.minimumCompletedReviews
  const canDecide =
    decisionReady && (submission.status === 'submitted' || submission.status === 'in_review')
  const trackValue = answerText(submissionAnswerByPurpose(state, submission, 'track'))
  const trackLabel = state.tracks.find((entry) => entry.id === trackValue)?.name ?? trackValue

  async function decide(decision: 'accepted' | 'rejected' | 'waitlisted') {
    const response = await execute(
      'review.decide',
      {
        submissionId: submission!.id,
        decision,
        reason:
          decision === 'accepted'
            ? 'Selected for the program after committee review.'
            : decision === 'waitlisted'
              ? 'Held for a later program decision.'
              : 'Not selected for this program edition.',
      },
      { expectedVersions: { [submission!.id]: submission!.version } },
      decision === 'accepted'
        ? 'Submission accepted and added to the program.'
        : `Submission ${decision}.`,
    )
    if (response.ok) onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={title}
      footer={
        canDecide ? (
          <>
            <Button
              size="compact"
              variant="danger"
              disabled={mutating}
              onClick={() => void decide('rejected')}
            >
              Decline
            </Button>
            <Button size="compact" disabled={mutating} onClick={() => void decide('waitlisted')}>
              Waitlist
            </Button>
            <Button variant="primary" disabled={mutating} onClick={() => void decide('accepted')}>
              <CheckIcon className="size-4 h-lh shrink-0 fill-current" />
              Accept proposal
            </Button>
          </>
        ) : null
      }
    >
      <div className="flex flex-col gap-7">
        <section aria-labelledby="submission-summary-heading">
          <div className="flex items-center justify-between gap-4">
            <StatusBadge
              status={submission.status}
              label={submission.status === 'submitted' ? 'New' : undefined}
            />
            <p className="text-base tabular-nums text-zinc-500 sm:text-sm">
              {submission.submittedAt
                ? `Submitted ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(submission.submittedAt))}`
                : 'Draft submission'}
            </p>
          </div>
          <h3
            id="submission-summary-heading"
            className="pt-4 text-base font-medium text-zinc-950 sm:text-sm"
          >
            Proposal
          </h3>
          <dl className="divide-y divide-zinc-950/5">
            {[
              [
                'Speaker',
                `${answerText(submissionAnswerByPurpose(state, submission, 'first_name'))} ${answerText(submissionAnswerByPurpose(state, submission, 'last_name'))}`,
              ],
              ['Company', answerText(submissionAnswerByPurpose(state, submission, 'company'))],
              [
                'Format',
                sentenceCase(
                  answerText(submissionAnswerByPurpose(state, submission, 'session_format')),
                ),
              ],
              ['Track', trackLabel],
            ].map(([term, detail]) => (
              <div key={term} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 py-3">
                <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
                <dd className="text-pretty text-base text-zinc-500 sm:text-sm">{detail}</dd>
              </div>
            ))}
          </dl>
          <div className="border-t border-zinc-950/5 pt-4">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">Abstract</p>
            <p className="pt-1 text-pretty text-base text-zinc-600 sm:text-sm">
              {answerText(submissionAnswerByPurpose(state, submission, 'abstract'))}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="review-summary-heading"
          className="border-t border-zinc-950/5 pt-6"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3
                id="review-summary-heading"
                className="text-base font-medium text-zinc-950 sm:text-sm"
              >
                Committee review
              </h3>
              <p className="text-base text-zinc-500 sm:text-sm">
                {review.completed} of {review.assigned} assignments complete.
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">
                {review.averageScore?.toFixed(1) ?? '—'}
              </p>
              <p className="text-sm text-zinc-500">out of 5</p>
            </div>
          </div>
          {plan ? (
            <dl className="flex flex-col gap-3 pt-5">
              {plan.criteria.map((criterion) => {
                const value = review.criterionAverages[criterion.id] ?? 0
                return (
                  <div key={criterion.id}>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                        {criterion.label}
                      </dt>
                      <dd className="text-base tabular-nums text-zinc-500 sm:text-sm">
                        {value.toFixed(1)}
                      </dd>
                    </div>
                    <div className="pt-1.5">
                      <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
                        <div
                          className="h-full w-(--score) rounded-full bg-blue-600"
                          style={
                            {
                              '--score': `${(value / criterion.maximum) * 100}%`,
                            } as React.CSSProperties
                          }
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </dl>
          ) : (
            <div className="flex items-start gap-2 pt-5 text-zinc-500">
              <ClockIcon className="size-4 h-lh shrink-0 fill-current" />
              <p className="text-pretty text-base sm:text-sm">No review plan is assigned yet.</p>
            </div>
          )}
          {!decisionReady && firstRound ? (
            <div className="mt-5 rounded-lg bg-amber-50 p-3 text-amber-800 ring-1 ring-amber-800/10">
              <p className="text-pretty text-base sm:text-sm">
                Complete {firstRound.minimumCompletedReviews - review.completed} more review
                {firstRound.minimumCompletedReviews - review.completed === 1 ? '' : 's'} before the
                committee records a decision.
              </p>
            </div>
          ) : null}
          {scorecards.length > 0 ? (
            <ul role="list" className="divide-y divide-zinc-950/5 pt-5">
              {scorecards.map((scorecard) => (
                <li key={scorecard.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-base font-medium text-zinc-950 sm:text-sm">
                      {sentenceCase(scorecard.recommendation)}
                    </p>
                    <p className="text-sm text-zinc-500">Reviewer feedback</p>
                  </div>
                  <p className="pt-1 text-pretty text-base text-zinc-600 sm:text-sm">
                    {scorecard.comments}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </Drawer>
  )
}
