import { CheckIcon, FunnelIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState } from 'react'

import {
  evaluationRoundReviewerTeamId,
  submissionAnswerByPurpose,
  type Submission,
  type SubmissionAnswerValue,
} from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Drawer, cx, selectControl, textControl } from './ui.tsx'

function answerText(value: SubmissionAnswerValue | undefined) {
  if (Array.isArray(value)) return value.join(', ')
  return value == null ? '' : String(value)
}

export function ReviewAssignmentsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload?.state
  const plan = state?.evaluationPlans.find((entry) => entry.eventId === state.activeEventId)
  const rounds = useMemo(
    () => [...(plan?.rounds ?? [])].sort((left, right) => left.order - right.order),
    [plan?.rounds],
  )
  const [roundId, setRoundId] = useState('')
  const [reviewerId, setReviewerId] = useState('')
  const [trackValue, setTrackValue] = useState('all')
  const [maxAssignments, setMaxAssignments] = useState(5)
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<string[]>([])

  const round = rounds.find((entry) => entry.id === roundId) ?? rounds[0]
  const reviewerTeamId = plan && round ? evaluationRoundReviewerTeamId(plan, round.id) : undefined
  const reviewerTeam = state?.reviewerTeams.find((entry) => entry.id === reviewerTeamId)
  const reviewers = useMemo(
    () =>
      (reviewerTeam?.reviewerIds ?? [])
        .map((id) => state?.reviewers.find((entry) => entry.id === id))
        .filter((entry) => entry?.status === 'active'),
    [reviewerTeam?.reviewerIds, state?.reviewers],
  )
  const reviewer = reviewers.find((entry) => entry?.id === reviewerId) ?? reviewers[0]
  const trackField = state?.submissionFormFields.find(
    (field) => field.formId === plan?.formId && field.purpose === 'track',
  )
  const trackOptions = trackField?.options ?? []
  const eligibleSubmissions = useMemo(
    () =>
      (state?.submissions ?? []).filter(
        (submission) =>
          submission.eventId === state?.activeEventId &&
          submission.formId === plan?.formId &&
          plan.submissionKinds.includes(submission.kind) &&
          (submission.status === 'submitted' || submission.status === 'in_review'),
      ),
    [plan?.formId, plan?.submissionKinds, state?.activeEventId, state?.submissions],
  )
  const assignments = useMemo(
    () =>
      (state?.reviewerAssignments ?? []).filter(
        (assignment) => assignment.roundId === round?.id && assignment.reviewerId === reviewer?.id,
      ),
    [reviewer?.id, round?.id, state?.reviewerAssignments],
  )
  const assignedSubmissionIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.submissionId)),
    [assignments],
  )
  const visibleSubmissions = eligibleSubmissions.filter(
    (submission) =>
      trackValue === 'all' ||
      answerText(submissionAnswerByPurpose(state!, submission, 'track')) === trackValue,
  )

  useEffect(() => {
    if (!open) return
    setRoundId((current) =>
      rounds.some((candidate) => candidate.id === current) ? current : (rounds[0]?.id ?? ''),
    )
  }, [open, rounds])

  useEffect(() => {
    if (!open) return
    setReviewerId((current) =>
      reviewers.some((candidate) => candidate?.id === current) ? current : (reviewers[0]?.id ?? ''),
    )
    setSelectedSubmissionIds([])
  }, [open, reviewerTeamId, reviewers])

  if (!state) return null

  function title(submission: Submission) {
    return (
      answerText(submissionAnswerByPurpose(state!, submission, 'proposal_title')) ||
      'Untitled proposal'
    )
  }

  function trackLabel(submission: Submission) {
    const value = answerText(submissionAnswerByPurpose(state!, submission, 'track'))
    return trackOptions.find((option) => option.value === value)?.label ?? value ?? 'No track'
  }

  function toggleSubmission(submissionId: string) {
    setSelectedSubmissionIds((current) =>
      current.includes(submissionId)
        ? current.filter((id) => id !== submissionId)
        : [...current, submissionId],
    )
  }

  async function assignSelected() {
    if (!plan || !round || !reviewer || selectedSubmissionIds.length === 0) return
    const response = await execute(
      'review.assign',
      {
        evaluationPlanId: plan.id,
        roundId: round.id,
        reviewerId: reviewer.id,
        submissionIds: selectedSubmissionIds,
        maxAssignments,
        ...(trackValue === 'all' ? {} : { trackValues: [trackValue] }),
      },
      undefined,
      `${selectedSubmissionIds.length} review${selectedSubmissionIds.length === 1 ? '' : 's'} assigned to ${reviewer.name}.`,
    )
    if (response.ok) setSelectedSubmissionIds([])
  }

  async function removeAssignment(assignmentId: string) {
    await execute('review.unassign', { assignmentId }, undefined, 'Review assignment removed.')
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Assign reviews"
      size="wide"
      footer={<Button onClick={onClose}>Done</Button>}
    >
      {!plan ? (
        <div className="py-12 text-center">
          <h3 className="text-base font-medium text-zinc-950">Create an evaluation plan first</h3>
          <p className="pt-1 text-base text-zinc-500 sm:text-sm">
            Rounds and reviewer pools determine who can receive each proposal.
          </p>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(18rem,5fr)]">
          <section className="min-w-0">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-base font-medium text-zinc-700 sm:text-sm">
                Round
                <span className="relative grid">
                  <select
                    className={selectControl}
                    value={round?.id ?? ''}
                    onChange={(event) => {
                      setRoundId(event.target.value)
                      setSelectedSubmissionIds([])
                    }}
                  >
                    {rounds.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="grid gap-1.5 text-base font-medium text-zinc-700 sm:text-sm">
                Reviewer
                <span className="relative grid">
                  <select
                    className={selectControl}
                    value={reviewer?.id ?? ''}
                    onChange={(event) => {
                      setReviewerId(event.target.value)
                      setSelectedSubmissionIds([])
                    }}
                  >
                    {reviewers.map((entry) => (
                      <option key={entry!.id} value={entry!.id}>
                        {entry!.name}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-y border-zinc-950/5 py-4 sm:flex-row sm:items-end">
              <label className="grid min-w-0 flex-1 gap-1.5 text-base font-medium text-zinc-700 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
                  <FunnelIcon className="size-4 fill-current text-zinc-400" />
                  Track
                </span>
                <span className="relative grid">
                  <select
                    className={selectControl}
                    value={trackValue}
                    onChange={(event) => {
                      setTrackValue(event.target.value)
                      setSelectedSubmissionIds([])
                    }}
                  >
                    <option value="all">All tracks</option>
                    {trackOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
              <label className="grid gap-1.5 text-base font-medium text-zinc-700 sm:w-36 sm:text-sm">
                Reviewer cap
                <input
                  className={textControl}
                  type="number"
                  min={1}
                  max={500}
                  value={maxAssignments}
                  onChange={(event) => setMaxAssignments(Number(event.target.value))}
                />
              </label>
              <Button
                variant="primary"
                disabled={mutating || !reviewer || selectedSubmissionIds.length === 0}
                onClick={() => void assignSelected()}
              >
                Assign {selectedSubmissionIds.length || 'selected'}
              </Button>
            </div>

            <div className="flex items-end justify-between gap-4 pt-5 pb-2">
              <div>
                <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Proposals</h3>
                <p className="text-base text-zinc-500 sm:text-sm">
                  {visibleSubmissions.length} visible · {selectedSubmissionIds.length} selected
                </p>
              </div>
              <button
                type="button"
                className="focus-ring rounded-lg text-sm font-medium text-blue-600 hover:text-blue-700"
                onClick={() =>
                  setSelectedSubmissionIds(
                    visibleSubmissions
                      .filter((submission) => !assignedSubmissionIds.has(submission.id))
                      .map((submission) => submission.id),
                  )
                }
              >
                Select visible
              </button>
            </div>
            <ul role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
              {visibleSubmissions.map((submission) => {
                const assigned = assignedSubmissionIds.has(submission.id)
                const checked = selectedSubmissionIds.includes(submission.id)
                return (
                  <li key={submission.id}>
                    <label
                      className={cx(
                        'flex items-start gap-3 py-3',
                        assigned ? 'cursor-default opacity-55' : 'cursor-pointer',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-600"
                        disabled={assigned}
                        checked={assigned || checked}
                        onChange={() => toggleSubmission(submission.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                          {title(submission)}
                        </span>
                        <span className="block text-sm text-zinc-500">
                          {trackLabel(submission)} · {assigned ? 'Already assigned' : 'Available'}
                        </span>
                      </span>
                      {assigned ? <CheckIcon className="size-4 fill-emerald-600" /> : null}
                    </label>
                  </li>
                )
              })}
            </ul>
          </section>

          <aside className="min-w-0 lg:border-l lg:border-zinc-950/5 lg:pl-8">
            <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-2">
              <div>
                <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                  {reviewer?.name ?? 'Reviewer'}
                </h3>
                <p className="text-base text-zinc-500 sm:text-sm">
                  {assignments.length} of {maxAssignments} assigned
                </p>
              </div>
              <span className="text-sm font-medium tabular-nums text-zinc-700">
                {assignments.filter((entry) => entry.status === 'completed').length} complete
              </span>
            </div>
            {reviewers.length === 0 ? (
              <p className="py-8 text-base text-zinc-500 sm:text-sm">
                Add an active reviewer to this round’s pool before assigning proposals.
              </p>
            ) : assignments.length === 0 ? (
              <p className="py-8 text-base text-zinc-500 sm:text-sm">
                No proposals assigned in this round yet.
              </p>
            ) : (
              <ul role="list" className="divide-y divide-zinc-950/5">
                {assignments.map((assignment) => {
                  const submission = state.submissions.find(
                    (entry) => entry.id === assignment.submissionId,
                  )
                  return (
                    <li key={assignment.id} className="flex items-start gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                          {submission ? title(submission) : 'Missing proposal'}
                        </span>
                        <span className="block text-sm text-zinc-500">
                          {assignment.status === 'completed' ? 'Completed' : 'Awaiting review'}
                        </span>
                      </span>
                      {assignment.status !== 'completed' ? (
                        <button
                          type="button"
                          aria-label={`Remove ${submission ? title(submission) : 'review assignment'}`}
                          className="touch-target focus-ring inline-flex size-8 items-center justify-center rounded-full text-zinc-400 hover:bg-red-50 hover:text-red-600"
                          disabled={mutating}
                          onClick={() => void removeAssignment(assignment.id)}
                        >
                          <TrashIcon className="size-4 fill-current" />
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </aside>
        </div>
      )}
    </Drawer>
  )
}
