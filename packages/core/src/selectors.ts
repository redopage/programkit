import { nowIso } from './utils.ts'
import { evaluationCriterionKind, evaluationRoundCriteria } from './reviews.ts'
import type {
  Campaign,
  ISODateTime,
  NextActionGroup,
  NextActionTone,
  Participation,
  ReadinessRow,
  ReviewerAssignment,
  ScheduleConflict,
  Submission,
  SubmissionAnswers,
  SubmissionAnswerValue,
  SubmissionFormField,
  SubmissionFieldPurpose,
  SubmissionPipelineSummary,
  SubmissionReviewSummary,
  WorkspaceState,
} from './types.ts'

export function activeEvent(state: WorkspaceState) {
  return state.events.find((event) => event.id === state.activeEventId) ?? state.events[0]
}

export function personName(state: WorkspaceState, personId: string) {
  const person = state.people.find((entry) => entry.id === personId)
  return person ? `${person.firstName} ${person.lastName}` : 'Unknown person'
}

export function participationPerson(state: WorkspaceState, participation: Participation) {
  return state.people.find((person) => person.id === participation.personId)
}

function answerIncludes(answer: SubmissionAnswerValue | undefined, value: string) {
  if (Array.isArray(answer)) return answer.includes(value)
  return typeof answer === 'string' && answer.includes(value)
}

export function isSubmissionFieldVisible(
  field: SubmissionFormField,
  fields: readonly SubmissionFormField[],
  answers: SubmissionAnswers,
) {
  if (!field.visibleWhen) return true
  const source = fields.find((entry) => entry.id === field.visibleWhen?.fieldId)
  if (!source) return false
  const answer = answers[source.key]
  if (field.visibleWhen.operator === 'equals') return answer === field.visibleWhen.value
  if (field.visibleWhen.operator === 'not_equals') return answer !== field.visibleWhen.value
  return answerIncludes(answer, field.visibleWhen.value)
}

export function visibleSubmissionFormFields(
  state: WorkspaceState,
  formId: string,
  answers: SubmissionAnswers = {},
) {
  const fields = (state.submissionFormFields ?? [])
    .filter((field) => field.formId === formId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  return fields.filter((field) => isSubmissionFieldVisible(field, fields, answers))
}

export function submissionAnswerByPurpose(
  state: WorkspaceState,
  submission: Submission,
  purpose: SubmissionFieldPurpose,
) {
  const field = (state.submissionFormFields ?? []).find(
    (entry) => entry.formId === submission.formId && entry.purpose === purpose,
  )
  return field ? submission.answers[field.key] : undefined
}

export function submissionParticipants(state: WorkspaceState, submission: Submission) {
  const text = (purpose: SubmissionFieldPurpose) => {
    const value = submissionAnswerByPurpose(state, submission, purpose)
    return typeof value === 'string' ? value.trim() : ''
  }
  return [
    {
      id: `lead:${submission.id}`,
      firstName: text('first_name'),
      lastName: text('last_name'),
      email: text('email'),
      company: text('company'),
      title: text('job_title'),
      biography: text('biography'),
      role: 'lead_speaker' as const,
      roleLabel: 'Lead speaker',
    },
    ...(submission.contributors ?? []).map((contributor) => ({
      ...contributor,
      roleLabel:
        contributor.role === 'co_author'
          ? 'Co-author'
          : contributor.role === 'co_presenter'
            ? 'Co-presenter'
            : 'Co-speaker',
    })),
  ]
}

export function submissionPipelineSummary(
  state: WorkspaceState,
  eventId = state.activeEventId,
): SubmissionPipelineSummary {
  const submissions = (state.submissions ?? []).filter((entry) => entry.eventId === eventId)
  const count = (status: Submission['status']) =>
    submissions.filter((entry) => entry.status === status).length
  const awaitingReviews = submissions.filter((submission) => {
    if (submission.status !== 'submitted' && submission.status !== 'in_review') return false
    const assignments = (state.reviewerAssignments ?? []).filter(
      (entry) => entry.submissionId === submission.id,
    )
    return assignments.some((entry) => entry.status !== 'completed')
  }).length

  return {
    total: submissions.length,
    draft: count('draft'),
    submitted: count('submitted'),
    inReview: count('in_review'),
    waitlisted: count('waitlisted'),
    accepted: count('accepted'),
    rejected: count('rejected'),
    withdrawn: count('withdrawn'),
    awaitingReviews,
  }
}

export function submissionReviewSummary(
  state: WorkspaceState,
  submissionId: string,
): SubmissionReviewSummary {
  const assignments = (state.reviewerAssignments ?? []).filter(
    (entry) => entry.submissionId === submissionId && entry.status !== 'recused',
  )
  const assignmentIds = new Set(assignments.map((entry) => entry.id))
  const scorecards = (state.scorecards ?? []).filter((entry) =>
    assignmentIds.has(entry.assignmentId),
  )
  const plan = (state.evaluationPlans ?? []).find(
    (entry) => entry.id === assignments[0]?.evaluationPlanId,
  )
  const criteria = [
    ...new Map(
      assignments
        .flatMap((assignment) => evaluationRoundCriteria(plan, assignment.roundId))
        .filter((criterion) => evaluationCriterionKind(criterion) === 'numeric')
        .map((criterion) => [criterion.id, criterion]),
    ).values(),
  ]
  const criterionAverages = Object.fromEntries(
    criteria.map((criterion) => {
      const values = scorecards
        .map((scorecard) => scorecard.scores[criterion.id])
        .filter((score): score is number => typeof score === 'number')
      return [
        criterion.id,
        values.length === 0
          ? 0
          : Math.round((values.reduce((sum, score) => sum + score, 0) / values.length) * 10) / 10,
      ]
    }),
  )
  const scorecardAverages = scorecards.map((scorecard) => {
    const assignment = assignments.find((entry) => entry.id === scorecard.assignmentId)
    const roundCriteria = evaluationRoundCriteria(plan, assignment?.roundId).filter(
      (criterion) => evaluationCriterionKind(criterion) === 'numeric',
    )
    const weighted = roundCriteria.reduce(
      (total, criterion) => total + (scorecard.scores[criterion.id] ?? 0) * criterion.weight,
      0,
    )
    const totalWeight = roundCriteria.reduce((total, criterion) => total + criterion.weight, 0)
    return totalWeight === 0 ? 0 : weighted / totalWeight
  })
  const recommendations: SubmissionReviewSummary['recommendations'] = {}
  for (const scorecard of scorecards) {
    recommendations[scorecard.recommendation] = (recommendations[scorecard.recommendation] ?? 0) + 1
  }

  return {
    submissionId,
    assigned: assignments.length,
    completed: assignments.filter((entry) => entry.status === 'completed').length,
    averageScore:
      scorecardAverages.length === 0
        ? null
        : Math.round(
            (scorecardAverages.reduce((sum, score) => sum + score, 0) / scorecardAverages.length) *
              10,
          ) / 10,
    criterionAverages,
    recommendations,
  }
}

export function reviewerQueue(state: WorkspaceState, reviewerId: string) {
  return (state.reviewerAssignments ?? [])
    .filter((assignment) => assignment.reviewerId === reviewerId)
    .map((assignment: ReviewerAssignment) => ({
      assignment,
      submission: (state.submissions ?? []).find(
        (submission) => submission.id === assignment.submissionId,
      ),
      scorecard: (state.scorecards ?? []).find(
        (scorecard) => scorecard.assignmentId === assignment.id,
      ),
    }))
    .sort((left, right) => {
      if (left.assignment.status !== right.assignment.status) {
        return left.assignment.status.localeCompare(right.assignment.status)
      }
      return (left.assignment.dueAt ?? '').localeCompare(right.assignment.dueAt ?? '')
    })
}

export function readinessRows(state: WorkspaceState): ReadinessRow[] {
  return state.participations
    .filter((participation) => participation.eventId === state.activeEventId)
    .map((participation) => {
      const person = participationPerson(state, participation)
      const instances = state.requirementInstances.filter(
        (instance) => instance.participationId === participation.id,
      )
      const requirementStatuses = Object.fromEntries(
        instances.map((instance) => [instance.definitionId, instance.status]),
      )
      const relevant = state.requirementDefinitions.filter(
        (definition) =>
          definition.eventId === participation.eventId &&
          definition.required &&
          Object.hasOwn(requirementStatuses, definition.id),
      )
      const completed = relevant.filter((definition) => {
        const status = requirementStatuses[definition.id]
        return status === 'approved' || status === 'waived'
      }).length
      const blockers = relevant.filter((definition) => {
        const status = requirementStatuses[definition.id]
        return status === 'not_started' || status === 'revision_requested'
      }).length

      return {
        participationId: participation.id,
        personId: participation.personId,
        personName: person ? `${person.firstName} ${person.lastName}` : 'Unknown person',
        company: person?.company ?? '',
        status: participation.status,
        requirementStatuses,
        completed,
        total: relevant.length,
        blockers,
        percent: relevant.length === 0 ? 100 : Math.round((completed / relevant.length) * 100),
      }
    })
    .sort((left, right) => {
      if (left.blockers !== right.blockers) return right.blockers - left.blockers
      return left.personName.localeCompare(right.personName)
    })
}

export function readinessSummary(state: WorkspaceState) {
  const rows = readinessRows(state)
  const activeRows = rows.filter(
    (row) => row.status !== 'declined' && row.status !== 'withdrawn' && row.status !== 'prospect',
  )
  const ready = activeRows.filter((row) => row.percent === 100).length
  const awaitingReview = state.requirementInstances.filter(
    (instance) => instance.status === 'submitted',
  ).length
  const blockers = activeRows.reduce((total, row) => total + row.blockers, 0)
  return {
    participants: activeRows.length,
    confirmed: activeRows.filter((row) => row.status === 'confirmed').length,
    ready,
    readinessPercent:
      activeRows.length === 0
        ? 100
        : Math.round(activeRows.reduce((sum, row) => sum + row.percent, 0) / activeRows.length),
    awaitingReview,
    blockers,
    unconfirmed: activeRows.filter((row) => row.status === 'invited').length,
  }
}

export function scheduleConflicts(state: WorkspaceState): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const event = activeEvent(state)
  const eventStart = Date.parse(event.startsAt)
  const eventEnd = Date.parse(event.endsAt)
  const placements = state.placements.filter(
    (placement) => placement.eventId === state.activeEventId,
  )

  for (let index = 0; index < placements.length; index += 1) {
    const left = placements[index]
    const startsAt = Date.parse(left.startsAt)
    const endsAt = Date.parse(left.endsAt)
    if (
      !Number.isFinite(startsAt) ||
      !Number.isFinite(endsAt) ||
      startsAt < eventStart ||
      endsAt > eventEnd ||
      endsAt <= startsAt
    ) {
      conflicts.push({
        id: `boundary-${left.id}`,
        severity: 'error',
        type: 'event_boundary',
        message: `Placement ${left.id} falls outside ${event.name} or has an invalid time range.`,
        placementIds: [left.id],
      })
    }

    const leftSession = state.sessions.find((session) => session.id === left.sessionId)
    if (!leftSession || leftSession.eventId !== state.activeEventId) {
      conflicts.push({
        id: `missing-${left.id}`,
        severity: 'error',
        type: 'missing_session',
        message: `Placement ${left.id} points to a missing session.`,
        placementIds: [left.id],
      })
      continue
    }

    if (
      Number.isFinite(startsAt) &&
      Number.isFinite(endsAt) &&
      endsAt - startsAt !== leftSession.durationMinutes * 60_000
    ) {
      conflicts.push({
        id: `duration-${left.id}`,
        severity: 'error',
        type: 'duration_mismatch',
        message: `${leftSession.title} is not allocated its ${leftSession.durationMinutes}-minute duration.`,
        placementIds: [left.id],
      })
    }

    if (leftSession.status === 'cancelled') {
      conflicts.push({
        id: `cancelled-${left.id}`,
        severity: 'error',
        type: 'cancelled_session',
        message: `${leftSession.title} is cancelled but still appears in the schedule.`,
        placementIds: [left.id],
      })
    }

    const track = state.tracks.find((entry) => entry.id === leftSession.trackId)
    if (!track || track.eventId !== state.activeEventId) {
      conflicts.push({
        id: `track-${left.id}`,
        severity: 'error',
        type: 'missing_track',
        message: `${leftSession.title} points to a missing track.`,
        placementIds: [left.id],
      })
    }

    for (const participationId of leftSession.participantIds) {
      const participation = state.participations.find((entry) => entry.id === participationId)
      if (!participation || participation.eventId !== state.activeEventId) {
        conflicts.push({
          id: `participant-${participationId}-${left.id}`,
          severity: 'error',
          type: 'missing_participant',
          message: `${leftSession.title} points to a missing participant.`,
          placementIds: [left.id],
        })
      }
    }

    const room = state.rooms.find((entry) => entry.id === left.roomId)
    if (!room || room.eventId !== state.activeEventId) {
      conflicts.push({
        id: `room-missing-${left.id}`,
        severity: 'error',
        type: 'missing_room',
        message: `${leftSession.title} points to a missing room.`,
        placementIds: [left.id],
      })
    } else if (leftSession.expectedAttendance > room.capacity) {
      conflicts.push({
        id: `capacity-${left.id}`,
        severity: 'warning',
        type: 'capacity',
        message: `${leftSession.title} exceeds ${room.name} capacity by ${leftSession.expectedAttendance - room.capacity}.`,
        placementIds: [left.id],
      })
    }

    for (let otherIndex = index + 1; otherIndex < placements.length; otherIndex += 1) {
      const right = placements[otherIndex]
      const rightStartsAt = Date.parse(right.startsAt)
      const rightEndsAt = Date.parse(right.endsAt)
      const overlaps =
        Number.isFinite(startsAt) &&
        Number.isFinite(endsAt) &&
        Number.isFinite(rightStartsAt) &&
        Number.isFinite(rightEndsAt) &&
        startsAt < rightEndsAt &&
        rightStartsAt < endsAt
      if (!overlaps) continue
      const rightSession = state.sessions.find((session) => session.id === right.sessionId)
      if (!rightSession) continue

      if (room && left.roomId === right.roomId) {
        conflicts.push({
          id: `room-${left.id}-${right.id}`,
          severity: 'error',
          type: 'room_overlap',
          message: `${leftSession.title} and ${rightSession.title} overlap in the same room.`,
          placementIds: [left.id, right.id],
        })
      }

      const sharedParticipants = leftSession.participantIds.filter((participantId) =>
        rightSession.participantIds.includes(participantId),
      )
      for (const participantId of sharedParticipants) {
        const participation = state.participations.find((entry) => entry.id === participantId)
        const name = participation ? personName(state, participation.personId) : 'A participant'
        conflicts.push({
          id: `person-${participantId}-${left.id}-${right.id}`,
          severity: 'error',
          type: 'person_overlap',
          message: `${name} is scheduled in two sessions at the same time.`,
          placementIds: [left.id, right.id],
        })
      }
    }
  }

  return conflicts
}

export function audienceForCampaign(state: WorkspaceState, campaign: Campaign) {
  const rows = readinessRows(state)
  const active = state.participations.filter(
    (participation) =>
      participation.eventId === campaign.eventId &&
      participation.status !== 'declined' &&
      participation.status !== 'withdrawn' &&
      participation.status !== 'prospect',
  )

  if (campaign.audience === 'all_active') return active.map((participation) => participation.id)
  if (campaign.audience === 'unconfirmed')
    return active
      .filter((participation) => participation.status === 'invited')
      .map((participation) => participation.id)
  if (campaign.audience === 'missing_requirements')
    return rows
      .filter((row) => row.blockers > 0 && row.status !== 'prospect')
      .map((row) => row.participationId)
  return campaign.recipientParticipationIds
}

export function publicAgenda(state: WorkspaceState) {
  const release = (state.scheduleReleases ?? [])
    .filter((entry) => entry.eventId === state.activeEventId)
    .sort((left, right) => right.version - left.version)[0]

  if (!release) return []

  return [...release.placements]
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .map((placement) => {
      const session = state.sessions.find((entry) => entry.id === placement.sessionId)
      const room = state.rooms.find((entry) => entry.id === placement.roomId)
      const track = state.tracks.find((entry) => entry.id === session?.trackId)
      const speakers = (session?.participantIds ?? []).map((participationId) => {
        const participation = state.participations.find((entry) => entry.id === participationId)
        if (!participation) return null
        const person = participationPerson(state, participation)
        return person
          ? {
              id: person.id,
              name: `${person.firstName} ${person.lastName}`,
              company: participation.publicCompany,
              title: participation.publicTitle,
              avatarUrl: person.avatarUrl,
            }
          : null
      })

      return {
        placement,
        session,
        room,
        track,
        speakers: speakers.filter((speaker) => speaker !== null),
      }
    })
}

/**
 * Turns the workspace's aggregate counts into the small number of grouped jobs
 * an organizer can actually pick up. A dashboard that reports "36 blockers"
 * leaves the triage work to the reader; these groups carry the verb, the size,
 * and the destination, so the overview can be acted on rather than interpreted.
 */
export function nextActions(state: WorkspaceState, now: ISODateTime = nowIso()): NextActionGroup[] {
  const nowMs = Date.parse(now)
  const groups: NextActionGroup[] = []
  const overdue = (dueAt: string | null) =>
    dueAt != null && Number.isFinite(Date.parse(dueAt)) && Date.parse(dueAt) < nowMs

  const activeParticipations = state.participations.filter(
    (participation) =>
      participation.eventId === state.activeEventId &&
      participation.status !== 'declined' &&
      participation.status !== 'withdrawn' &&
      participation.status !== 'prospect',
  )
  const activeParticipationIds = new Set(
    activeParticipations.map((participation) => participation.id),
  )

  // Speaker onboarding, split by what is actually missing rather than pooled
  // into one blocker count: "5 people owe a headshot" is a job, "36 blockers"
  // is a number.
  for (const definition of state.requirementDefinitions) {
    if (definition.eventId !== state.activeEventId || !definition.required) continue
    const outstanding = state.requirementInstances.filter(
      (instance) =>
        instance.definitionId === definition.id &&
        activeParticipationIds.has(instance.participationId) &&
        (instance.status === 'not_started' || instance.status === 'revision_requested'),
    )
    if (outstanding.length === 0) continue
    groups.push({
      id: `requirement-${definition.id}`,
      kind: 'speaker_requirement',
      label: definition.label,
      count: outstanding.length,
      detail: '',
      dueAt: definition.dueAt,
      tone: overdue(definition.dueAt) ? 'blocking' : 'attention',
      href: `/readiness?requirement=${definition.id}`,
    })
  }

  const awaitingApproval = state.requirementInstances.filter(
    (instance) =>
      activeParticipationIds.has(instance.participationId) && instance.status === 'submitted',
  ).length
  if (awaitingApproval > 0) {
    groups.push({
      id: 'requirement-approvals',
      kind: 'speaker_requirement',
      label: 'Speaker uploads waiting on you',
      count: awaitingApproval,
      detail: 'Submitted and unreviewed',
      dueAt: null,
      tone: 'attention',
      href: '/readiness',
    })
  }

  const untriaged = (state.submissions ?? []).filter(
    (submission) => submission.eventId === state.activeEventId && submission.status === 'submitted',
  ).length
  if (untriaged > 0) {
    groups.push({
      id: 'submissions-untriaged',
      kind: 'submission',
      label: 'Proposals waiting for triage',
      count: untriaged,
      detail: 'No review has started',
      dueAt: null,
      tone: 'attention',
      href: '/submissions?status=submitted',
    })
  }

  const completedAssignmentIds = new Set(
    state.scorecards.map((scorecard) => scorecard.assignmentId),
  )
  const openAssignments = state.reviewerAssignments.filter(
    (assignment) =>
      assignment.eventId === state.activeEventId &&
      assignment.status !== 'completed' &&
      assignment.status !== 'recused' &&
      !completedAssignmentIds.has(assignment.id),
  )
  if (openAssignments.length > 0) {
    const overdueCount = openAssignments.filter((assignment) => overdue(assignment.dueAt)).length
    groups.push({
      id: 'reviews-open',
      kind: 'review',
      label: 'Reviews not finished',
      count: openAssignments.length,
      detail: overdueCount > 0 ? `${overdueCount} past due` : 'Assigned to reviewers',
      dueAt: null,
      tone: overdueCount > 0 ? 'blocking' : 'attention',
      href: '/reviews',
    })
  }

  const placedSessionIds = new Set(
    state.placements
      .filter((placement) => placement.eventId === state.activeEventId)
      .map((placement) => placement.sessionId),
  )
  const unplaced = state.sessions.filter(
    (session) =>
      session.eventId === state.activeEventId &&
      session.status !== 'cancelled' &&
      !placedSessionIds.has(session.id),
  ).length
  if (unplaced > 0) {
    groups.push({
      id: 'sessions-unscheduled',
      kind: 'schedule',
      label: 'Sessions not on the schedule',
      count: unplaced,
      detail: 'No room or time yet',
      dueAt: null,
      tone: 'attention',
      href: '/schedule',
    })
  }

  const conflicts = scheduleConflicts(state).filter((conflict) => conflict.severity === 'error')
  if (conflicts.length > 0) {
    groups.push({
      id: 'schedule-conflicts',
      kind: 'schedule',
      label: 'Schedule conflicts to resolve',
      count: conflicts.length,
      detail: 'Blocks publishing the agenda',
      dueAt: null,
      tone: 'blocking',
      href: '/schedule',
    })
  }

  const unanswered = activeParticipations.filter(
    (participation) => participation.status === 'invited',
  ).length
  if (unanswered > 0) {
    groups.push({
      id: 'invitations-unanswered',
      kind: 'invitation',
      label: 'Invitations without a reply',
      count: unanswered,
      detail: 'Sent, not yet confirmed',
      dueAt: null,
      tone: 'upcoming',
      href: '/people?status=invited',
    })
  }

  const toneOrder: Record<NextActionTone, number> = { blocking: 0, attention: 1, upcoming: 2 }
  return groups.sort((left, right) => {
    if (toneOrder[left.tone] !== toneOrder[right.tone]) {
      return toneOrder[left.tone] - toneOrder[right.tone]
    }
    return right.count - left.count
  })
}
