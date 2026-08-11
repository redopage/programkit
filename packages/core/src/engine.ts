import { operationDefinition } from './manifest.ts'
import { calendarAttachmentForParticipation } from './calendar.ts'
import {
  dueRequirementReminders,
  requirementReminderSummary,
  requirementReminderTrigger,
} from './reminders.ts'
import {
  evaluationCriterionKind,
  evaluationRoundCriteria,
  evaluationRoundReviewerTeamId,
} from './reviews.ts'
import {
  requiredSubmissionFieldPurposes,
  submissionFormAvailability,
  submissionFieldPurposeSupportsKind,
} from './submission-forms.ts'
import {
  audienceForCampaign,
  campaignPreview,
  scheduleConflicts,
  submissionAnswerByPurpose,
  submissionAnswerDisplayByPurpose,
  submissionAnswerErrors,
  submissionDecisionMessagePreview,
  submissionDecisionMessageTemplate,
  submissionDecisionReadiness,
  submissionReviewSummary,
} from './selectors.ts'
import { createSeedState } from './seed.ts'
import type {
  Actor,
  Asset,
  AssetComment,
  Campaign,
  ChangeOperation,
  ChangeSet,
  ContactNote,
  CrmSegment,
  DomainEvent,
  EvaluationCriterion,
  EvaluationPlan,
  EvaluationRound,
  OperationRequest,
  OperationDefinition,
  OperationResponse,
  OutboundMessage,
  Participation,
  ParticipationStatus,
  Person,
  PortalResourcePage,
  RequirementStatus,
  ReviewRecommendation,
  Session,
  SpeakerPipelineEntry,
  SpeakerPipelineStage,
  Submission,
  SubmissionAnswers,
  SubmissionContributor,
  SubmissionForm,
  SubmissionFormField,
  WorkspaceState,
} from './types.ts'
import {
  addMinutes,
  assertOneOf,
  assertString,
  assertStringArray,
  cloneState,
  createId,
  defaultActor,
  findRequired,
  nowIso,
  OperationError,
} from './utils.ts'

export interface ExecutionResult {
  state: WorkspaceState
  response: OperationResponse
}

class PersistedOperationError extends OperationError {
  constructor(
    code: string,
    message: string,
    readonly state: WorkspaceState,
    readonly eventIds: string[],
    fields?: Record<string, string>,
  ) {
    super(code, message, fields)
  }
}

interface ApplyContext {
  actor: Actor
  operation: string
  emittedEventIds: string[]
}

function initializeProgramCollections(state: WorkspaceState) {
  for (const event of state.events) event.version ??= 1
  state.contactNotes ??= []
  state.crmSegments ??= []
  state.speakerPipeline ??= []
  state.submissionForms ??= []
  state.submissionFormFields ??= []
  state.submissions ??= []
  state.assets ??= []
  state.assetComments ??= []
  state.reviewers ??= []
  state.reviewerTeams ??= []
  state.evaluationPlans ??= []
  state.reviewerAssignments ??= []
  state.scorecards ??= []
  state.reviewDecisions ??= []
  state.outboundMessages ??= []
  state.portalResourcePages ??= []
  for (const message of state.outboundMessages) {
    message.submissionId ??= null
    message.attempts ??= 0
    message.lastAttemptAt ??= null
    message.nextAttemptAt ??= null
    message.lastError ??= null
  }
  for (const submission of state.submissions) {
    submission.contributors ??= []
    submission.speakerAccessKey ??= createId('speaker')
  }
  for (const reviewer of state.reviewers) reviewer.accessKey ??= createId('reviewer')
  for (const participation of state.participations) {
    participation.portalAccessKey ??= createId('portal')
  }
  for (const definition of state.requirementDefinitions) {
    definition.systemKey ??=
      definition.id === 'req_confirm'
        ? 'participation_confirmation'
        : definition.id === 'req_bio'
          ? 'profile_bio'
          : definition.id === 'req_headshot'
            ? 'profile_headshot'
            : definition.id === 'req_slides'
              ? 'final_slides'
              : null
    definition.selfCompletable ??= false
    definition.sessionId ??= null
    definition.acceptedContentTypes ??=
      definition.kind === 'file'
        ? [
            'application/pdf',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          ]
        : []
    definition.maxSizeBytes ??= definition.kind === 'file' ? 50_000_000 : null
    definition.automaticReminders ??= false
  }
  for (const asset of state.assets) {
    asset.version ??= 1
    asset.isLatest ??= true
    asset.sessionId ??= null
    asset.uploadedBy ??= { type: 'staff', id: 'system', name: 'ProgramKit' }
  }
  for (const campaign of state.campaigns) campaign.includeCalendarInvite ??= false
  for (const message of state.outboundMessages ?? []) message.calendarAttachment ??= null
  for (const plan of state.evaluationPlans) {
    for (const round of plan.rounds) round.categoryRoutes ??= []
  }
  state.schemaVersion = Math.max(state.schemaVersion, 14)
}

function queueOutboundMessage(
  state: WorkspaceState,
  input: Omit<
    OutboundMessage,
    'id' | 'eventId' | 'status' | 'queuedAt' | 'sentAt' | 'providerMessageId'
  >,
  timestamp: string,
) {
  state.outboundMessages ??= []
  const message: OutboundMessage = {
    id: createId('msg'),
    eventId: state.activeEventId,
    ...input,
    status: 'queued',
    queuedAt: timestamp,
    sentAt: null,
    providerMessageId: null,
    attempts: 0,
    lastAttemptAt: null,
    nextAttemptAt: null,
    lastError: null,
  }
  state.outboundMessages.unshift(message)
  return message
}

function assertRecord(value: unknown, field: string) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new OperationError('INVALID_INPUT', `${field} must be an object.`, {
      [field]: 'Enter a valid object.',
    })
  }
  return value as Record<string, unknown>
}

function assertSubmissionAnswers(value: unknown): SubmissionAnswers {
  const record = assertRecord(value, 'answers')
  const answers: SubmissionAnswers = {}
  for (const [key, answer] of Object.entries(record)) {
    if (key.trim().length === 0) {
      throw new OperationError('INVALID_INPUT', 'Answer keys cannot be empty.')
    }
    if (
      answer === null ||
      typeof answer === 'string' ||
      typeof answer === 'boolean' ||
      (typeof answer === 'number' && Number.isFinite(answer)) ||
      (Array.isArray(answer) && answer.every((entry) => typeof entry === 'string'))
    ) {
      answers[key] = answer as SubmissionAnswers[string]
      continue
    }
    throw new OperationError('INVALID_INPUT', `Answer ${key} has an unsupported value.`)
  }
  return answers
}

function assertSubmissionContributors(
  value: unknown,
  primaryEmail: string,
): SubmissionContributor[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 10) {
    throw new OperationError(
      'INVALID_INPUT',
      'contributors must be an array with no more than 10 people.',
      { contributors: 'Add no more than 10 co-speakers.' },
    )
  }
  const emails = new Set(primaryEmail ? [primaryEmail.toLowerCase()] : [])
  return value.map((entry, index) => {
    const record = assertRecord(entry, `contributors.${index}`)
    const email = assertEmail(record.email, `contributors.${index}.email`)
    if (emails.has(email)) {
      throw new OperationError('DUPLICATE', 'Each submission participant needs a unique email.', {
        [`contributors.${index}.email`]: 'Use a different email address.',
      })
    }
    emails.add(email)
    return {
      id:
        typeof record.id === 'string' && record.id.trim().length > 0
          ? record.id.trim()
          : createId('contributor'),
      firstName: assertString(record.firstName, `contributors.${index}.firstName`),
      lastName: assertString(record.lastName, `contributors.${index}.lastName`),
      email,
      company: optionalString(record.company),
      title: optionalString(record.title),
      biography: optionalString(record.biography),
      role: assertOneOf(record.role, `contributors.${index}.role`, [
        'co_speaker',
        'co_author',
        'co_presenter',
      ] as const),
    }
  })
}

function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function assertEmail(value: unknown, field = 'email') {
  const email = assertString(value, field).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new OperationError('INVALID_INPUT', `${field} must be a valid email address.`, {
      [field]: 'Enter a valid email address.',
    })
  }
  return email
}

function assertEventReviewerIds(state: WorkspaceState, value: unknown) {
  const reviewerIds = assertStringArray(value, 'reviewerIds')
  if (new Set(reviewerIds).size !== reviewerIds.length) {
    throw new OperationError('INVALID_INPUT', 'A reviewer can only appear once in a pool.')
  }
  for (const reviewerId of reviewerIds) {
    const reviewer = findRequired(state.reviewers, reviewerId, 'reviewer')
    if (reviewer.eventId !== state.activeEventId) {
      throw new OperationError('FORBIDDEN', 'Reviewer pools cannot cross event boundaries.')
    }
  }
  return reviewerIds
}

function optionalBoolean(value: unknown, fallback: boolean) {
  if (value === undefined) return fallback
  if (typeof value !== 'boolean') {
    throw new OperationError('INVALID_INPUT', 'Expected a true or false value.')
  }
  return value
}

function boundedInteger(value: unknown, field: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new OperationError('INVALID_INPUT', `${field} must be from ${minimum} to ${maximum}.`, {
      [field]: `Enter a whole number from ${minimum} to ${maximum}.`,
    })
  }
  return value as number
}

function finiteNumber(value: unknown, field: string, minimum = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
    throw new OperationError('INVALID_INPUT', `${field} must be at least ${minimum}.`, {
      [field]: `Enter a number of at least ${minimum}.`,
    })
  }
  return value
}

const sessionFormats = ['keynote', 'talk', 'lightning', 'panel', 'workshop', 'break'] as const

const trackColors = ['emerald', 'amber', 'sky', 'rose', 'violet', 'zinc'] as const

function sessionParticipantIds(state: WorkspaceState, value: unknown) {
  if (value === undefined) return []
  const participantIds = assertStringArray(value, 'participantIds')
  if (new Set(participantIds).size !== participantIds.length) {
    throw new OperationError('INVALID_INPUT', 'A speaker can only be assigned once.', {
      participantIds: 'Remove duplicate speakers.',
    })
  }
  for (const participantId of participantIds) {
    const participation = findRequired(state.participations, participantId, 'participation')
    if (participation.eventId !== state.activeEventId) {
      throw new OperationError('FORBIDDEN', 'Session speakers cannot cross event boundaries.')
    }
  }
  return participantIds
}

function parseEvaluationCriteria(value: unknown, roundIndex: number): EvaluationCriterion[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OperationError('INVALID_INPUT', 'Every evaluation round needs a scorecard.', {
      [`rounds.${roundIndex}.criteria`]: 'Add at least one criterion.',
    })
  }
  const ids = new Set<string>()
  return value.map((entry, criterionIndex) => {
    const prefix = `rounds.${roundIndex}.criteria.${criterionIndex}`
    const record = assertRecord(entry, prefix)
    const kind = assertOneOf(record.kind ?? 'numeric', `${prefix}.kind`, [
      'numeric',
      'select',
      'long_text',
    ] as const)
    const id =
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : createId('crt')
    if (ids.has(id)) {
      throw new OperationError('INVALID_INPUT', 'Criterion IDs must be unique within a round.')
    }
    ids.add(id)
    const criterion: EvaluationCriterion = {
      id,
      label: assertString(record.label, `${prefix}.label`),
      description: optionalString(record.description),
      kind,
      required: optionalBoolean(record.required, true),
      weight: kind === 'numeric' ? finiteNumber(record.weight ?? 1, `${prefix}.weight`) : 0,
    }
    if (kind === 'numeric') {
      criterion.minimum = finiteNumber(record.minimum ?? 1, `${prefix}.minimum`)
      criterion.maximum = finiteNumber(record.maximum ?? 5, `${prefix}.maximum`)
      if (criterion.maximum <= criterion.minimum) {
        throw new OperationError('INVALID_INPUT', 'A numeric maximum must exceed its minimum.')
      }
    }
    if (kind === 'select') {
      const options = assertStringArray(record.options, `${prefix}.options`)
        .map((option) => option.trim())
        .filter(Boolean)
      if (options.length < 2 || new Set(options).size !== options.length) {
        throw new OperationError('INVALID_INPUT', 'A dropdown needs at least two unique options.')
      }
      criterion.options = options
    }
    return criterion
  })
}

function parseEvaluationRounds(
  state: WorkspaceState,
  eventId: string,
  value: unknown,
): EvaluationRound[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new OperationError('INVALID_INPUT', 'An evaluation plan needs at least one round.', {
      rounds: 'Add at least one round.',
    })
  }
  const ids = new Set<string>()
  const rounds = value.map((entry, index) => {
    const record = assertRecord(entry, `rounds.${index}`)
    const id =
      typeof record.id === 'string' && record.id.trim().length > 0
        ? record.id.trim()
        : createId('rnd')
    if (ids.has(id)) throw new OperationError('INVALID_INPUT', 'Round IDs must be unique.')
    ids.add(id)
    const reviewerTeamId = assertString(record.reviewerTeamId, `rounds.${index}.reviewerTeamId`)
    const team = findRequired(state.reviewerTeams, reviewerTeamId, 'reviewer team')
    if (team.eventId !== eventId) {
      throw new OperationError('FORBIDDEN', 'Reviewer teams cannot be shared across events.')
    }
    const opensAt = optionalDateTime(record.opensAt, `rounds.${index}.opensAt`)
    const closesAt = optionalDateTime(record.closesAt, `rounds.${index}.closesAt`)
    if (opensAt && closesAt && new Date(opensAt) >= new Date(closesAt)) {
      throw new OperationError('INVALID_INPUT', 'A review round must close after it opens.')
    }
    const categoryRoutes = Array.isArray(record.categoryRoutes)
      ? record.categoryRoutes
          .map((entry, routeIndex) => {
            const route = assertRecord(entry, `rounds.${index}.categoryRoutes.${routeIndex}`)
            const trackId = assertString(
              route.trackId,
              `rounds.${index}.categoryRoutes.${routeIndex}.trackId`,
            )
            const routedTeamId = assertString(
              route.reviewerTeamId,
              `rounds.${index}.categoryRoutes.${routeIndex}.reviewerTeamId`,
            )
            const track = findRequired(state.tracks, trackId, 'track')
            const routedTeam = findRequired(state.reviewerTeams, routedTeamId, 'reviewer team')
            if (track.eventId !== eventId || routedTeam.eventId !== eventId) {
              throw new OperationError(
                'FORBIDDEN',
                'Category routing cannot cross event boundaries.',
              )
            }
            return { trackId, reviewerTeamId: routedTeamId }
          })
          .sort((left, right) => left.trackId.localeCompare(right.trackId))
      : []
    if (new Set(categoryRoutes.map((route) => route.trackId)).size !== categoryRoutes.length) {
      throw new OperationError(
        'INVALID_INPUT',
        `Each category can be routed only once in “${assertString(record.name, `rounds.${index}.name`)}”.`,
      )
    }
    return {
      id,
      name: assertString(record.name, `rounds.${index}.name`),
      order: index + 1,
      opensAt,
      closesAt,
      reviewerTeamId,
      categoryRoutes,
      blindReview: optionalBoolean(record.blindReview, false),
      criteria: parseEvaluationCriteria(record.criteria, index),
      reviewersPerSubmission: boundedInteger(
        record.reviewersPerSubmission ?? 1,
        `rounds.${index}.reviewersPerSubmission`,
        1,
        20,
      ),
      minimumCompletedReviews: boundedInteger(
        record.minimumCompletedReviews ?? record.reviewersPerSubmission ?? 1,
        `rounds.${index}.minimumCompletedReviews`,
        1,
        20,
      ),
    }
  })
  for (const round of rounds) {
    if (round.minimumCompletedReviews > round.reviewersPerSubmission) {
      throw new OperationError(
        'INVALID_INPUT',
        'Required completed reviews cannot exceed reviewers per submission.',
      )
    }
  }
  return rounds
}

function recommendationFromAnswers(
  criteria: EvaluationCriterion[],
  answers: Record<string, number | string>,
): ReviewRecommendation {
  const criterion = criteria.find(
    (entry) => evaluationCriterionKind(entry) === 'select' && /recommendation/iu.test(entry.label),
  )
  const answer = criterion ? answers[criterion.id] : undefined
  const normalized =
    typeof answer === 'string' ? answer.trim().toLowerCase().replaceAll(' ', '_') : ''
  if (normalized === 'strong_accept') return 'strong_accept'
  if (normalized === 'accept') return 'accept'
  if (normalized === 'maybe' || normalized === 'borderline') return 'borderline'
  if (normalized === 'reject') return 'reject'
  if (normalized === 'strong_reject') return 'strong_reject'
  return 'borderline'
}

function optionalDateTime(value: unknown, field: string) {
  if (value === null || value === undefined || value === '') return null
  const input = assertString(value, field)
  const parsed = new Date(input)
  if (Number.isNaN(parsed.getTime())) {
    throw new OperationError('INVALID_INPUT', `${field} must be an ISO date and time.`, {
      [field]: 'Enter a valid date and time.',
    })
  }
  return parsed.toISOString()
}

function optionalHttpsUrl(value: unknown, field: string) {
  if (value === undefined || value === null || value === '') return ''
  if (typeof value !== 'string') {
    throw new OperationError('INVALID_INPUT', `${field} must be an HTTPS URL.`, {
      [field]: 'Enter a secure URL.',
    })
  }
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'https:') throw new Error('HTTPS required')
    return url.toString()
  } catch {
    throw new OperationError('INVALID_INPUT', `${field} must be an HTTPS URL.`, {
      [field]: 'Enter a full URL beginning with https://.',
    })
  }
}

function assertTimeZone(value: unknown, field = 'timezone') {
  const timeZone = assertString(value, field)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0))
  } catch {
    throw new OperationError('INVALID_INPUT', `${field} must be an IANA time zone.`, {
      [field]: 'Choose a valid time zone such as America/New_York.',
    })
  }
  return timeZone
}

function parseSubmissionFormFields(formId: string, value: unknown): SubmissionFormField[] {
  if (!Array.isArray(value)) {
    throw new OperationError('INVALID_INPUT', 'fields must be an array.')
  }
  return value.map((entry, index) => {
    const field = assertRecord(entry, `fields.${index}`)
    const kind = assertOneOf(field.kind, `fields.${index}.kind`, [
      'short_text',
      'long_text',
      'email',
      'url',
      'select',
      'multi_select',
      'checkbox',
      'file',
    ] as const)
    const purpose = assertOneOf(field.purpose, `fields.${index}.purpose`, [
      'first_name',
      'last_name',
      'email',
      'company',
      'job_title',
      'biography',
      'proposal_title',
      'abstract',
      'session_format',
      'track',
      'custom',
    ] as const)
    const options = field.options === undefined ? [] : field.options
    if (!Array.isArray(options)) {
      throw new OperationError('INVALID_INPUT', `fields.${index}.options must be an array.`)
    }
    const visibleWhen =
      field.visibleWhen === undefined || field.visibleWhen === null
        ? null
        : (() => {
            const condition = assertRecord(field.visibleWhen, `fields.${index}.visibleWhen`)
            return {
              fieldId: assertString(condition.fieldId, `fields.${index}.visibleWhen.fieldId`),
              operator: assertOneOf(condition.operator, `fields.${index}.visibleWhen.operator`, [
                'equals',
                'not_equals',
                'includes',
              ] as const),
              value: assertString(condition.value, `fields.${index}.visibleWhen.value`, {
                allowEmpty: true,
              }),
            }
          })()
    const sortOrder = field.sortOrder === undefined ? (index + 1) * 10 : field.sortOrder
    if (typeof sortOrder !== 'number' || !Number.isFinite(sortOrder)) {
      throw new OperationError('INVALID_INPUT', `fields.${index}.sortOrder must be a number.`)
    }
    return {
      id: typeof field.id === 'string' && field.id.trim() ? field.id.trim() : createId('fld'),
      formId,
      key: assertString(field.key, `fields.${index}.key`),
      label: assertString(field.label, `fields.${index}.label`),
      description: optionalString(field.description),
      kind,
      purpose,
      required: field.required === true,
      options: options.map((option, optionIndex) => {
        const parsed = assertRecord(option, `fields.${index}.options.${optionIndex}`)
        return {
          value: assertString(parsed.value, `fields.${index}.options.${optionIndex}.value`),
          label: assertString(parsed.label, `fields.${index}.options.${optionIndex}.label`),
        }
      }),
      placeholder: optionalString(field.placeholder),
      sortOrder,
      visibleWhen,
    }
  })
}

function validateSubmissionForm(
  form: SubmissionForm,
  fields: readonly SubmissionFormField[],
  options: { forPublish: boolean },
) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(form.slug)) {
    throw new OperationError('INVALID_INPUT', 'The form slug must be URL-safe.', {
      slug: 'Use lowercase letters, numbers, and hyphens.',
    })
  }
  if (form.allowedKinds.length === 0) {
    throw new OperationError('INVALID_INPUT', 'Choose at least one submission kind.')
  }
  if (form.opensAt && form.closesAt && Date.parse(form.opensAt) >= Date.parse(form.closesAt)) {
    throw new OperationError('INVALID_INPUT', 'The form close date must be after its open date.')
  }
  const ids = new Set<string>()
  const keys = new Set<string>()
  const systemPurposes = new Set<string>()
  for (const field of fields) {
    if (ids.has(field.id))
      throw new OperationError('INVALID_INPUT', `Field ID ${field.id} is duplicated.`)
    if (keys.has(field.key)) {
      throw new OperationError('INVALID_INPUT', `Field key ${field.key} is duplicated.`)
    }
    ids.add(field.id)
    keys.add(field.key)
    if (field.purpose !== 'custom') {
      if (systemPurposes.has(field.purpose)) {
        throw new OperationError('INVALID_INPUT', `Only one field can map to ${field.purpose}.`)
      }
      if (!submissionFieldPurposeSupportsKind(field.purpose, field.kind)) {
        throw new OperationError(
          'INVALID_INPUT',
          `${field.label} cannot map ${field.kind} answers to ${field.purpose}.`,
        )
      }
      systemPurposes.add(field.purpose)
    }
    if ((field.kind === 'select' || field.kind === 'multi_select') && field.options.length === 0) {
      throw new OperationError('INVALID_INPUT', `${field.label} needs at least one option.`)
    }
    if (
      field.visibleWhen &&
      (!ids.has(field.visibleWhen.fieldId) || field.visibleWhen.fieldId === field.id)
    ) {
      throw new OperationError(
        'INVALID_INPUT',
        `${field.label} must depend on an earlier field in the same form.`,
      )
    }
  }
  if (options.forPublish) {
    const missing = requiredSubmissionFieldPurposes.filter(
      (purpose) => !fields.some((field) => field.purpose === purpose && field.required),
    )
    if (missing.length > 0) {
      throw new OperationError(
        'INVALID_INPUT',
        `Publish requires these mapped fields: ${missing.join(', ')}.`,
      )
    }
  }
}

function assertSubmissionFormAccepting(form: SubmissionForm, at: string) {
  const availability = submissionFormAvailability(form, Date.parse(at))
  if (availability === 'open') return
  const message =
    availability === 'scheduled'
      ? 'This submission form is not open yet.'
      : availability === 'closed'
        ? 'This submission form is no longer accepting responses.'
        : 'This submission form is not accepting responses.'
  throw new OperationError('FORM_CLOSED', message)
}

function validateAnswersForSubmission(state: WorkspaceState, submission: Submission) {
  const errors = submissionAnswerErrors(state, submission.formId, submission.answers)
  if (Object.keys(errors).length > 0) {
    throw new OperationError('INVALID_INPUT', 'Complete the required submission fields.', errors)
  }
}

function stringAnswer(
  state: WorkspaceState,
  submission: Submission,
  purpose: Parameters<typeof submissionAnswerByPurpose>[2],
) {
  const value = submissionAnswerByPurpose(state, submission, purpose)
  return typeof value === 'string' ? value.trim() : ''
}

function sessionFormatAnswer(
  state: WorkspaceState,
  submission: Submission,
): Exclude<Session['format'], 'break'> {
  const stored = stringAnswer(state, submission, 'session_format')
  const displayed = submissionAnswerDisplayByPurpose(state, submission, 'session_format')
  const candidates = [typeof displayed === 'string' ? displayed : '', stored]
  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase()
    if (normalized.includes('keynote')) return 'keynote'
    if (normalized.includes('lightning')) return 'lightning'
    if (normalized.includes('workshop')) return 'workshop'
    if (normalized.includes('panel')) return 'panel'
    if (normalized.includes('talk')) return 'talk'
  }
  throw new OperationError('INVALID_INPUT', 'Choose a supported session format.', {
    session_format: 'Use Keynote, Talk, Lightning Talk, Workshop, or Panel.',
  })
}

function requestedSessionDuration(state: WorkspaceState, submission: Submission) {
  const displayed = submissionAnswerDisplayByPurpose(state, submission, 'session_format')
  if (typeof displayed !== 'string') return null
  const match = displayed.match(/\b(\d{1,3})\s*min(?:ute)?s?\b/iu)
  if (!match) return null
  const minutes = Number(match[1])
  return Number.isInteger(minutes) && minutes > 0 ? minutes : null
}

function hasScope(actor: Actor, scope: string) {
  return actor.scopes.includes('*') || actor.scopes.includes(scope)
}

function assertScopes(actor: Actor, scopes: readonly string[]) {
  const missing = scopes.filter((scope) => !hasScope(actor, scope))
  if (missing.length > 0) {
    throw new OperationError(
      'FORBIDDEN',
      `The current actor is missing required scopes: ${missing.join(', ')}.`,
    )
  }
}

function assertRequiredInput(
  definition: Pick<OperationDefinition, 'name' | 'requiredInput'>,
  input: Record<string, unknown>,
) {
  const missing = definition.requiredInput.filter((field) => !(field in input))
  if (missing.length > 0) {
    throw new OperationError(
      'INVALID_INPUT',
      `${definition.name} is missing required input: ${missing.join(', ')}.`,
    )
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    )
  }
  return value
}

function requestFingerprint(operation: string, request: OperationRequest) {
  return JSON.stringify(
    stableValue({
      operation,
      input: request.input,
      mode: request.mode ?? 'execute',
      expectedVersions: request.expectedVersions ?? {},
    }),
  )
}

function allVersionedRecords(state: WorkspaceState) {
  return [
    ...state.events,
    ...state.people,
    ...(state.crmSegments ?? []),
    ...(state.speakerPipeline ?? []),
    ...state.participations,
    ...state.requirementInstances,
    ...(state.submissionForms ?? []),
    ...(state.submissions ?? []),
    ...(state.reviewers ?? []),
    ...(state.reviewerTeams ?? []),
    ...(state.evaluationPlans ?? []),
    ...(state.reviewerAssignments ?? []),
    ...(state.scorecards ?? []),
    ...(state.reviewDecisions ?? []),
    ...state.sessions,
    ...state.placements,
    ...state.campaigns,
    ...(state.portalResourcePages ?? []),
    ...state.changeSets,
  ]
}

function assertExpectedVersions(state: WorkspaceState, expected?: Record<string, number>) {
  if (!expected) return
  const records = allVersionedRecords(state)
  for (const [id, version] of Object.entries(expected)) {
    const record = records.find((entry) => entry.id === id)
    if (!record) throw new OperationError('STALE_WRITE', `${id} no longer exists.`)
    // Schema v4 added event versions. Treat a persisted pre-v4 event as version
    // one so its first guarded update can migrate it without weakening later
    // stale-write checks.
    if ((record.version ?? 1) !== version) {
      throw new OperationError(
        'STALE_WRITE',
        `${id} changed after this action was prepared. Refresh and review the latest version.`,
      )
    }
  }
}

function appendEvent(
  state: WorkspaceState,
  context: ApplyContext,
  event: Omit<DomainEvent, 'id' | 'sequence' | 'occurredAt' | 'actor' | 'operation'>,
) {
  const id = createId('dev')
  state.domainEvents.push({
    ...event,
    id,
    sequence: (state.domainEvents.at(-1)?.sequence ?? 0) + 1,
    occurredAt: nowIso(),
    actor: {
      type: context.actor.type,
      id: context.actor.id,
      name: context.actor.name,
    },
    operation: context.operation,
  })
  context.emittedEventIds.push(id)
  return id
}

function createProposedChangeSet(
  state: WorkspaceState,
  operation: string,
  request: OperationRequest,
  actor: Actor,
) {
  const definition = operationDefinition(operation)
  if (!definition) throw new OperationError('UNKNOWN_OPERATION', `Unknown operation: ${operation}.`)
  const timestamp = nowIso()
  const changeSet: ChangeSet = {
    id: createId('chg'),
    eventId: state.activeEventId,
    title: request.reason || definition.title,
    description: definition.description,
    origin: actor.type === 'agent' ? 'agent' : 'human',
    operations: [
      {
        operation,
        input: request.input,
        expectedVersions: request.expectedVersions,
      },
    ],
    status: 'awaiting_approval',
    impactSummary: [`Run ${definition.title.toLowerCase()} after approval.`],
    warnings: definition.risk === 'external' ? ['This operation has an external effect.'] : [],
    createdBy: actor.name,
    approvedBy: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    committedEventIds: [],
    version: 1,
  }
  state.changeSets.unshift(changeSet)
  return changeSet
}

function applyHandler(
  state: WorkspaceState,
  operation: string,
  input: Record<string, unknown>,
  context: ApplyContext,
): unknown {
  const timestamp = nowIso()

  switch (operation) {
    case 'event.update': {
      const event = findRequired(state.events, input.eventId, 'event')
      if (event.id !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only the active event can be updated here.')
      }
      const previous = {
        name: event.name,
        slug: event.slug,
        venue: event.venue,
        city: event.city,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        timezone: event.timezone,
        status: event.status,
      }
      const nextName =
        typeof input.name === 'string' ? assertString(input.name, 'name') : event.name
      const nextSlug =
        typeof input.slug === 'string' ? assertString(input.slug, 'slug').toLowerCase() : event.slug
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(nextSlug)) {
        throw new OperationError('INVALID_INPUT', 'The event slug must be URL-safe.', {
          slug: 'Use lowercase letters, numbers, and hyphens.',
        })
      }
      if (state.events.some((entry) => entry.id !== event.id && entry.slug === nextSlug)) {
        throw new OperationError('DUPLICATE', 'Another event already uses that slug.', {
          slug: 'Choose another event slug.',
        })
      }
      const nextVenue =
        typeof input.venue === 'string' ? assertString(input.venue, 'venue') : event.venue
      const nextCity =
        typeof input.city === 'string' ? assertString(input.city, 'city') : event.city
      const nextTimeZone =
        input.timezone === undefined ? event.timezone : assertTimeZone(input.timezone, 'timezone')
      const nextStartsAt =
        input.startsAt === undefined ? event.startsAt : optionalDateTime(input.startsAt, 'startsAt')
      const nextEndsAt =
        input.endsAt === undefined ? event.endsAt : optionalDateTime(input.endsAt, 'endsAt')
      if (!nextStartsAt || !nextEndsAt || Date.parse(nextStartsAt) >= Date.parse(nextEndsAt)) {
        throw new OperationError('INVALID_INPUT', 'The event end must be after its start.', {
          endsAt: 'Choose a time after the event starts.',
        })
      }
      const nextStatus =
        input.status === undefined
          ? event.status
          : assertOneOf(input.status, 'status', ['planning', 'active', 'complete'] as const)

      event.name = nextName
      event.slug = nextSlug
      event.venue = nextVenue
      event.city = nextCity
      event.startsAt = nextStartsAt
      event.endsAt = nextEndsAt
      event.timezone = nextTimeZone
      event.status = nextStatus

      if (input.startsAt !== undefined || input.endsAt !== undefined) {
        const boundaryConflict = scheduleConflicts(state).find(
          (conflict) => conflict.severity === 'error' && conflict.type === 'event_boundary',
        )
        if (boundaryConflict) {
          throw new OperationError('INVALID_INPUT', boundaryConflict.message, {
            startsAt: 'Keep every scheduled session inside the event dates.',
            endsAt: 'Keep every scheduled session inside the event dates.',
          })
        }
      }

      event.version = (event.version ?? 1) + 1
      appendEvent(state, context, {
        type: 'event.updated',
        aggregate: { type: 'event', id: event.id, version: event.version },
        summary: `Updated event “${event.name}”.`,
        data: { previous },
      })
      return { event }
    }

    case 'portal-resource.create': {
      const title = assertString(input.title, 'title')
      const slug =
        typeof input.slug === 'string' && input.slug.trim()
          ? assertString(input.slug, 'slug').toLocaleLowerCase()
          : title
              .normalize('NFKD')
              .replace(/[^a-z0-9]+/giu, '-')
              .replace(/^-+|-+$/gu, '')
              .toLocaleLowerCase()
      if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug)) {
        throw new OperationError('INVALID_INPUT', 'The resource slug must be URL-safe.', {
          slug: 'Use lowercase letters, numbers, and hyphens.',
        })
      }
      if (
        state.portalResourcePages.some(
          (entry) => entry.eventId === state.activeEventId && entry.slug === slug,
        )
      ) {
        throw new OperationError('DUPLICATE', 'A portal resource already uses that slug.', {
          title: 'Choose a title that creates a different URL.',
        })
      }
      const resource: PortalResourcePage = {
        id: createId('res'),
        eventId: state.activeEventId,
        title,
        slug,
        summary: typeof input.summary === 'string' ? input.summary.trim() : '',
        body: typeof input.body === 'string' ? input.body.trim() : '',
        embedUrl: optionalHttpsUrl(input.embedUrl, 'embedUrl'),
        linkUrl: optionalHttpsUrl(input.linkUrl, 'linkUrl'),
        status:
          input.status === undefined
            ? 'draft'
            : assertOneOf(input.status, 'status', ['draft', 'published', 'archived'] as const),
        sortOrder:
          typeof input.sortOrder === 'number'
            ? boundedInteger(input.sortOrder, 'sortOrder', 0, 10_000)
            : Math.max(
                -1,
                ...state.portalResourcePages
                  .filter((entry) => entry.eventId === state.activeEventId)
                  .map((entry) => entry.sortOrder),
              ) + 1,
        updatedAt: timestamp,
        version: 1,
      }
      if (!resource.summary && !resource.body && !resource.embedUrl && !resource.linkUrl) {
        throw new OperationError('INVALID_INPUT', 'Add content or a link before saving.', {
          body: 'Add page content, an embed, or a related link.',
        })
      }
      state.portalResourcePages.push(resource)
      appendEvent(state, context, {
        type: 'portal-resource.created',
        aggregate: { type: 'portal-resource', id: resource.id, version: resource.version },
        summary: `Created speaker resource “${resource.title}”.`,
        data: { status: resource.status, slug: resource.slug },
      })
      return { resource }
    }

    case 'portal-resource.update': {
      const resource = findRequired(state.portalResourcePages, input.resourceId, 'portal resource')
      if (resource.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The resource does not belong to the active event.')
      }
      const nextTitle =
        input.title === undefined ? resource.title : assertString(input.title, 'title')
      const nextSummary =
        input.summary === undefined
          ? resource.summary
          : typeof input.summary === 'string'
            ? input.summary.trim()
            : resource.summary
      const nextBody =
        input.body === undefined
          ? resource.body
          : typeof input.body === 'string'
            ? input.body.trim()
            : resource.body
      const nextEmbedUrl =
        input.embedUrl === undefined
          ? resource.embedUrl
          : optionalHttpsUrl(input.embedUrl, 'embedUrl')
      const nextLinkUrl =
        input.linkUrl === undefined ? resource.linkUrl : optionalHttpsUrl(input.linkUrl, 'linkUrl')
      if (!nextSummary && !nextBody && !nextEmbedUrl && !nextLinkUrl) {
        throw new OperationError('INVALID_INPUT', 'Add content or a link before saving.', {
          body: 'Add page content, an embed, or a related link.',
        })
      }
      resource.title = nextTitle
      resource.summary = nextSummary
      resource.body = nextBody
      resource.embedUrl = nextEmbedUrl
      resource.linkUrl = nextLinkUrl
      if (input.status !== undefined) {
        resource.status = assertOneOf(input.status, 'status', [
          'draft',
          'published',
          'archived',
        ] as const)
      }
      if (input.sortOrder !== undefined) {
        resource.sortOrder = boundedInteger(input.sortOrder, 'sortOrder', 0, 10_000)
      }
      resource.updatedAt = timestamp
      resource.version += 1
      appendEvent(state, context, {
        type: 'portal-resource.updated',
        aggregate: { type: 'portal-resource', id: resource.id, version: resource.version },
        summary: `Updated speaker resource “${resource.title}”.`,
        data: { status: resource.status },
      })
      return { resource }
    }

    case 'track.create': {
      const name = assertString(input.name, 'name')
      if (
        state.tracks.some(
          (entry) =>
            entry.eventId === state.activeEventId &&
            entry.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      ) {
        throw new OperationError('DUPLICATE', 'A track already uses that name.', {
          name: 'Choose another track name.',
        })
      }
      const color =
        input.color === undefined
          ? trackColors[
              state.tracks.filter((entry) => entry.eventId === state.activeEventId).length %
                trackColors.length
            ]
          : assertOneOf(input.color, 'color', trackColors)
      const track = {
        id: createId('trk'),
        eventId: state.activeEventId,
        name,
        color,
      }
      state.tracks.push(track)
      appendEvent(state, context, {
        type: 'track.created',
        aggregate: { type: 'track', id: track.id, version: 1 },
        summary: `Created track “${track.name}”.`,
        data: { color: track.color },
      })
      return { track }
    }

    case 'room.create': {
      const name = assertString(input.name, 'name')
      const capacity = boundedInteger(input.capacity, 'capacity', 1, 100_000)
      if (
        state.rooms.some(
          (entry) =>
            entry.eventId === state.activeEventId &&
            entry.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
        )
      ) {
        throw new OperationError('DUPLICATE', 'A room already uses that name.', {
          name: 'Choose another room name.',
        })
      }
      const room = { id: createId('rom'), eventId: state.activeEventId, name, capacity }
      state.rooms.push(room)
      appendEvent(state, context, {
        type: 'room.created',
        aggregate: { type: 'room', id: room.id, version: 1 },
        summary: `Created room “${room.name}”.`,
        data: { capacity: room.capacity },
      })
      return { room }
    }

    case 'session.create': {
      const title = assertString(input.title, 'title')
      const summary = assertString(input.summary, 'summary')
      const format = assertOneOf(input.format, 'format', sessionFormats)
      const track = findRequired(state.tracks, input.trackId, 'track')
      if (track.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The track does not belong to the active event.')
      }
      const participantIds = sessionParticipantIds(state, input.participantIds)
      const durationMinutes = boundedInteger(input.durationMinutes, 'durationMinutes', 5, 480)
      const expectedAttendance = boundedInteger(
        input.expectedAttendance,
        'expectedAttendance',
        1,
        100_000,
      )
      const status =
        input.status === undefined
          ? 'draft'
          : assertOneOf(input.status, 'status', ['draft', 'ready', 'cancelled'] as const)
      const session: Session = {
        id: createId('ses'),
        eventId: state.activeEventId,
        title,
        summary,
        format,
        trackId: track.id,
        participantIds,
        durationMinutes,
        expectedAttendance,
        status,
        updatedAt: timestamp,
        version: 1,
      }
      state.sessions.push(session)
      for (const participationId of participantIds) {
        const participation = findRequired(state.participations, participationId, 'participation')
        if (!participation.sessionIds.includes(session.id)) {
          participation.sessionIds.push(session.id)
          participation.updatedAt = timestamp
          participation.version += 1
        }
      }
      appendEvent(state, context, {
        type: 'session.created',
        aggregate: { type: 'session', id: session.id, version: session.version },
        summary: `Created session “${session.title}”.`,
        data: { trackId: track.id, participantIds, status },
      })
      return { session }
    }

    case 'session.update': {
      const session = findRequired(state.sessions, input.sessionId, 'session')
      if (session.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The session does not belong to the active event.')
      }
      const previous = {
        title: session.title,
        summary: session.summary,
        format: session.format,
        trackId: session.trackId,
        participantIds: [...session.participantIds],
        durationMinutes: session.durationMinutes,
        expectedAttendance: session.expectedAttendance,
        status: session.status,
      }
      if (input.title !== undefined) session.title = assertString(input.title, 'title')
      if (input.summary !== undefined) session.summary = assertString(input.summary, 'summary')
      if (input.format !== undefined) {
        session.format = assertOneOf(input.format, 'format', sessionFormats)
      }
      if (input.trackId !== undefined) {
        const track = findRequired(state.tracks, input.trackId, 'track')
        if (track.eventId !== state.activeEventId) {
          throw new OperationError('FORBIDDEN', 'The track does not belong to the active event.')
        }
        session.trackId = track.id
      }
      if (input.durationMinutes !== undefined) {
        session.durationMinutes = boundedInteger(input.durationMinutes, 'durationMinutes', 5, 480)
      }
      if (input.expectedAttendance !== undefined) {
        session.expectedAttendance = boundedInteger(
          input.expectedAttendance,
          'expectedAttendance',
          1,
          100_000,
        )
      }
      if (input.status !== undefined) {
        session.status = assertOneOf(input.status, 'status', [
          'draft',
          'ready',
          'cancelled',
        ] as const)
      }
      if (input.participantIds !== undefined) {
        const nextParticipantIds = sessionParticipantIds(state, input.participantIds)
        const nextSet = new Set(nextParticipantIds)
        for (const participation of state.participations) {
          if (participation.eventId !== session.eventId) continue
          const hadSession = participation.sessionIds.includes(session.id)
          const hasSession = nextSet.has(participation.id)
          if (hadSession === hasSession) continue
          participation.sessionIds = hasSession
            ? [...participation.sessionIds, session.id]
            : participation.sessionIds.filter((sessionId) => sessionId !== session.id)
          participation.updatedAt = timestamp
          participation.version += 1
        }
        session.participantIds = nextParticipantIds
      }
      const placement = state.placements.find((entry) => entry.sessionId === session.id)
      if (placement && session.durationMinutes !== previous.durationMinutes) {
        placement.endsAt = addMinutes(placement.startsAt, session.durationMinutes)
        placement.published = false
        placement.version += 1
      }
      session.updatedAt = timestamp
      session.version += 1
      appendEvent(state, context, {
        type: 'session.updated',
        aggregate: { type: 'session', id: session.id, version: session.version },
        summary: `Updated session “${session.title}”.`,
        data: { previous },
      })
      return { session, conflicts: scheduleConflicts(state) }
    }

    case 'session.restore': {
      const session = findRequired(state.sessions, input.sessionId, 'session')
      if (session.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The session does not belong to the active event.')
      }
      const sourceEvent = findRequired(state.domainEvents, input.eventId, 'event')
      if (
        sourceEvent.aggregate.type !== 'session' ||
        sourceEvent.aggregate.id !== session.id ||
        !['session.updated', 'session.restored'].includes(sourceEvent.type)
      ) {
        throw new OperationError(
          'INVALID_INPUT',
          'Choose a recorded content change for this session.',
        )
      }
      const snapshot = assertRecord(sourceEvent.data.previous, 'previous')
      const track = findRequired(state.tracks, snapshot.trackId, 'track')
      if (track.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The recorded track does not belong to this event.')
      }
      const participantIds = sessionParticipantIds(state, snapshot.participantIds)
      const previous = {
        title: session.title,
        summary: session.summary,
        format: session.format,
        trackId: session.trackId,
        participantIds: [...session.participantIds],
        durationMinutes: session.durationMinutes,
        expectedAttendance: session.expectedAttendance,
        status: session.status,
      }
      session.title = assertString(snapshot.title, 'title')
      session.summary = assertString(snapshot.summary, 'summary')
      session.format = assertOneOf(snapshot.format, 'format', sessionFormats)
      session.trackId = track.id
      session.durationMinutes = boundedInteger(snapshot.durationMinutes, 'durationMinutes', 5, 480)
      session.expectedAttendance = boundedInteger(
        snapshot.expectedAttendance,
        'expectedAttendance',
        1,
        100_000,
      )
      session.status = assertOneOf(snapshot.status, 'status', [
        'draft',
        'ready',
        'cancelled',
      ] as const)
      const nextParticipantIds = new Set(participantIds)
      for (const participation of state.participations) {
        if (participation.eventId !== session.eventId) continue
        const hadSession = participation.sessionIds.includes(session.id)
        const hasSession = nextParticipantIds.has(participation.id)
        if (hadSession === hasSession) continue
        participation.sessionIds = hasSession
          ? [...participation.sessionIds, session.id]
          : participation.sessionIds.filter((sessionId) => sessionId !== session.id)
        participation.updatedAt = timestamp
        participation.version += 1
      }
      session.participantIds = participantIds
      const placement = state.placements.find((entry) => entry.sessionId === session.id)
      if (placement && session.durationMinutes !== previous.durationMinutes) {
        placement.endsAt = addMinutes(placement.startsAt, session.durationMinutes)
        placement.published = false
        placement.version += 1
      }
      session.updatedAt = timestamp
      session.version += 1
      appendEvent(state, context, {
        type: 'session.restored',
        aggregate: { type: 'session', id: session.id, version: session.version },
        summary: `Restored an earlier version of “${session.title}”.`,
        data: { previous, restoredFromEventId: sourceEvent.id },
      })
      return { session, restoredFromEventId: sourceEvent.id, conflicts: scheduleConflicts(state) }
    }

    case 'submission-form.create': {
      const name = assertString(input.name, 'name')
      const slug = assertString(input.slug, 'slug').toLowerCase()
      const title = assertString(input.title, 'title')
      if (
        state.submissionForms.some(
          (entry) => entry.eventId === state.activeEventId && entry.slug === slug,
        )
      ) {
        throw new OperationError('DUPLICATE', 'A submission form already uses that slug.', {
          slug: 'Choose another public URL slug.',
        })
      }
      const allowedKindsInput =
        input.allowedKinds === undefined
          ? ['abstract']
          : assertStringArray(input.allowedKinds, 'allowedKinds')
      const allowedKinds = allowedKindsInput.map((kind) =>
        assertOneOf(kind, 'allowedKinds', ['abstract', 'guaranteed_session'] as const),
      )
      const form: SubmissionForm = {
        id: createId('frm'),
        eventId: state.activeEventId,
        name,
        slug,
        title,
        description: optionalString(input.description),
        status: 'draft',
        allowedKinds,
        opensAt: optionalDateTime(input.opensAt, 'opensAt'),
        closesAt: optionalDateTime(input.closesAt, 'closesAt'),
        confirmationMessage:
          optionalString(input.confirmationMessage) || 'Thanks—your submission has been received.',
        updatedAt: timestamp,
        version: 1,
      }
      const fields =
        input.fields === undefined ? [] : parseSubmissionFormFields(form.id, input.fields)
      validateSubmissionForm(form, fields, { forPublish: false })
      state.submissionForms.push(form)
      state.submissionFormFields.push(...fields)
      appendEvent(state, context, {
        type: 'submission-form.created',
        aggregate: { type: 'submission-form', id: form.id, version: form.version },
        summary: `Created submission form “${form.name}”.`,
        data: { fieldCount: fields.length, slug: form.slug },
      })
      return { form, fields }
    }

    case 'submission-form.update': {
      const form = findRequired(state.submissionForms, input.formId, 'submission form')
      if (form.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The form does not belong to the active event.')
      }
      const nextSlug =
        typeof input.slug === 'string' ? assertString(input.slug, 'slug').toLowerCase() : form.slug
      if (
        state.submissionForms.some(
          (entry) =>
            entry.id !== form.id && entry.eventId === form.eventId && entry.slug === nextSlug,
        )
      ) {
        throw new OperationError('DUPLICATE', 'A submission form already uses that slug.', {
          slug: 'Choose another public URL slug.',
        })
      }
      const previous = {
        name: form.name,
        slug: form.slug,
        title: form.title,
        status: form.status,
        allowedKinds: [...form.allowedKinds],
        fieldCount: state.submissionFormFields.filter((field) => field.formId === form.id).length,
      }
      if (typeof input.name === 'string') form.name = assertString(input.name, 'name')
      form.slug = nextSlug
      if (typeof input.title === 'string') form.title = assertString(input.title, 'title')
      if (typeof input.description === 'string') form.description = input.description.trim()
      if (typeof input.confirmationMessage === 'string') {
        form.confirmationMessage = assertString(input.confirmationMessage, 'confirmationMessage')
      }
      if ('opensAt' in input) form.opensAt = optionalDateTime(input.opensAt, 'opensAt')
      if ('closesAt' in input) form.closesAt = optionalDateTime(input.closesAt, 'closesAt')
      if (input.allowedKinds !== undefined) {
        form.allowedKinds = assertStringArray(input.allowedKinds, 'allowedKinds').map((kind) =>
          assertOneOf(kind, 'allowedKinds', ['abstract', 'guaranteed_session'] as const),
        )
      }
      if (input.status !== undefined) {
        form.status = assertOneOf(input.status, 'status', ['draft', 'closed'] as const)
      }
      const fields =
        input.fields === undefined
          ? state.submissionFormFields.filter((field) => field.formId === form.id)
          : parseSubmissionFormFields(form.id, input.fields)
      if (
        input.fields !== undefined &&
        state.submissions.some((submission) => submission.formId === form.id)
      ) {
        const formSubmissions = state.submissions.filter(
          (submission) => submission.formId === form.id,
        )
        const removedSubmissionKind = previous.allowedKinds.find(
          (kind) =>
            formSubmissions.some((submission) => submission.kind === kind) &&
            !form.allowedKinds.includes(kind),
        )
        if (removedSubmissionKind) {
          throw new OperationError(
            'INVALID_INPUT',
            `The ${removedSubmissionKind.replaceAll('_', ' ')} submission type cannot be removed after responses are received.`,
          )
        }
        const currentFields = state.submissionFormFields.filter((field) => field.formId === form.id)
        const nextFieldsById = new Map(fields.map((field) => [field.id, field]))
        const currentFieldIds = new Set(currentFields.map((field) => field.id))
        for (const currentField of currentFields) {
          const nextField = nextFieldsById.get(currentField.id)
          if (!nextField) {
            throw new OperationError(
              'INVALID_INPUT',
              `“${currentField.label}” cannot be removed after the form receives submissions.`,
            )
          }
          const currentAnswerContract = {
            key: currentField.key,
            purpose: currentField.purpose,
            kind: currentField.kind,
            required: currentField.required,
            optionValues: currentField.options.map((option) => option.value),
            visibleWhen: currentField.visibleWhen,
          }
          const nextAnswerContract = {
            key: nextField.key,
            purpose: nextField.purpose,
            kind: nextField.kind,
            required: nextField.required,
            optionValues: nextField.options.map((option) => option.value),
            visibleWhen: nextField.visibleWhen,
          }
          if (JSON.stringify(nextAnswerContract) !== JSON.stringify(currentAnswerContract)) {
            throw new OperationError(
              'INVALID_INPUT',
              `The answer contract for “${currentField.label}” cannot change after the form receives submissions.`,
            )
          }
        }
        const newRequiredField = fields.find(
          (field) => !currentFieldIds.has(field.id) && field.required,
        )
        if (newRequiredField) {
          throw new OperationError(
            'INVALID_INPUT',
            `“${newRequiredField.label}” cannot be added as required after the form receives submissions.`,
          )
        }
      }
      validateSubmissionForm(form, fields, { forPublish: form.status === 'open' })
      if (input.fields !== undefined) {
        state.submissionFormFields = state.submissionFormFields.filter(
          (field) => field.formId !== form.id,
        )
        state.submissionFormFields.push(...fields)
      }
      form.updatedAt = timestamp
      form.version += 1
      appendEvent(state, context, {
        type: 'submission-form.updated',
        aggregate: { type: 'submission-form', id: form.id, version: form.version },
        summary: `Updated submission form “${form.name}”.`,
        data: { previous, fieldCount: fields.length },
      })
      return { form, fields }
    }

    case 'submission-form.publish': {
      const form = findRequired(state.submissionForms, input.formId, 'submission form')
      if (form.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The form does not belong to the active event.')
      }
      const fields = state.submissionFormFields
        .filter((field) => field.formId === form.id)
        .sort((left, right) => left.sortOrder - right.sortOrder)
      validateSubmissionForm(form, fields, { forPublish: true })
      form.status = 'open'
      form.updatedAt = timestamp
      form.version += 1
      appendEvent(state, context, {
        type: 'submission-form.published',
        aggregate: { type: 'submission-form', id: form.id, version: form.version },
        summary: `Published submission form “${form.name}”.`,
        data: { slug: form.slug, fieldCount: fields.length },
      })
      return { form, fields }
    }

    case 'submission.create': {
      const form = findRequired(state.submissionForms, input.formId, 'submission form')
      if (context.actor.type === 'submitter' && context.actor.id !== form.slug) {
        throw new OperationError('FORBIDDEN', 'This submission link cannot write to that form.')
      }
      if (form.eventId !== state.activeEventId) {
        throw new OperationError('FORM_CLOSED', 'This submission form is not accepting responses.')
      }
      assertSubmissionFormAccepting(form, timestamp)
      const kind = assertOneOf(input.kind, 'kind', ['abstract', 'guaranteed_session'] as const)
      if (!form.allowedKinds.includes(kind)) {
        throw new OperationError('INVALID_INPUT', 'This form does not accept that submission kind.')
      }
      const answers = assertSubmissionAnswers(input.answers)
      const requestedAccessKey = optionalString(input.speakerAccessKey)
      const submission: Submission = {
        id: createId('sub'),
        eventId: form.eventId,
        formId: form.id,
        kind,
        status: 'draft',
        answers,
        contributors: [],
        speakerAccessKey: requestedAccessKey || createId('speaker'),
        assetIds: input.assetIds === undefined ? [] : assertStringArray(input.assetIds, 'assetIds'),
        submittedAt: null,
        decidedAt: null,
        convertedParticipationId: null,
        convertedSessionId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      const primaryEmail = stringAnswer(state, submission, 'email')
      if (requestedAccessKey) {
        const ownedSubmission = state.submissions.find(
          (entry) =>
            entry.eventId === form.eventId && entry.speakerAccessKey === requestedAccessKey,
        )
        const verifiedPrimaryEmail = primaryEmail.trim() ? assertEmail(primaryEmail) : ''
        if (!ownedSubmission) {
          throw new OperationError(
            'FORBIDDEN',
            'This speaker access link does not match an existing submission.',
          )
        }
        const ownedEmail = stringAnswer(state, ownedSubmission, 'email').toLowerCase()
        if (verifiedPrimaryEmail && ownedEmail && ownedEmail !== verifiedPrimaryEmail) {
          throw new OperationError(
            'FORBIDDEN',
            'This speaker access link does not match the submission email.',
          )
        }
      }
      submission.contributors =
        input.contributors === undefined
          ? []
          : assertSubmissionContributors(
              input.contributors,
              primaryEmail.trim() ? assertEmail(primaryEmail) : '',
            )
      state.submissions.push(submission)
      appendEvent(state, context, {
        type: 'submission.created',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: 'Created a submission draft.',
        data: { formId: form.id, kind },
      })
      return { submission }
    }

    case 'submission.update': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      const form = findRequired(state.submissionForms, submission.formId, 'submission form')
      if (
        context.actor.type === 'submitter' &&
        (context.actor.id !== form.slug ||
          optionalString(input.speakerAccessKey) !== submission.speakerAccessKey)
      ) {
        throw new OperationError('FORBIDDEN', 'This speaker link cannot edit that submission.')
      }
      if (context.actor.type === 'submitter') {
        assertSubmissionFormAccepting(form, timestamp)
      }
      if (submission.status === 'accepted' || submission.status === 'withdrawn') {
        throw new OperationError(
          'INVALID_TRANSITION',
          `A ${submission.status} submission cannot be edited.`,
        )
      }
      const previous = structuredClone(submission)
      if (input.answers !== undefined) {
        const nextAnswers = { ...submission.answers, ...assertSubmissionAnswers(input.answers) }
        if (context.actor.type === 'submitter') {
          const emailField = state.submissionFormFields.find(
            (field) => field.formId === form.id && field.purpose === 'email',
          )
          const currentEmail = stringAnswer(state, submission, 'email').toLowerCase()
          if (
            emailField &&
            currentEmail &&
            String(nextAnswers[emailField.key] ?? '').toLowerCase() !== currentEmail
          ) {
            throw new OperationError(
              'INVALID_INPUT',
              'The submission contact email cannot be changed from a speaker access link.',
              { [emailField.key]: 'Contact the program team to change this email.' },
            )
          }
        }
        submission.answers = nextAnswers
      }
      if (input.contributors !== undefined) {
        submission.contributors = assertSubmissionContributors(
          input.contributors,
          assertEmail(stringAnswer(state, submission, 'email')),
        )
      }
      if (input.assetIds !== undefined) {
        submission.assetIds = assertStringArray(input.assetIds, 'assetIds')
      }
      if (submission.status !== 'draft') validateAnswersForSubmission(state, submission)
      submission.updatedAt = timestamp
      submission.version += 1
      appendEvent(state, context, {
        type: 'submission.updated',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: `Updated “${stringAnswer(state, submission, 'proposal_title')}”.`,
        data: {
          previousContributorCount: previous.contributors.length,
          contributorCount: submission.contributors.length,
        },
      })
      return { submission }
    }

    case 'submission.submit': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      if (submission.status !== 'draft') {
        throw new OperationError('INVALID_TRANSITION', 'Only a draft submission can be submitted.')
      }
      const form = findRequired(state.submissionForms, submission.formId, 'submission form')
      if (
        context.actor.type === 'submitter' &&
        (context.actor.id !== form.slug ||
          optionalString(input.speakerAccessKey) !== submission.speakerAccessKey)
      ) {
        throw new OperationError('FORBIDDEN', 'This speaker link cannot submit that draft.')
      }
      assertSubmissionFormAccepting(form, timestamp)
      if (input.answers !== undefined) {
        submission.answers = {
          ...submission.answers,
          ...assertSubmissionAnswers(input.answers),
        }
      }
      if (input.assetIds !== undefined) {
        submission.assetIds = assertStringArray(input.assetIds, 'assetIds')
      }
      if (input.contributors !== undefined) {
        submission.contributors = assertSubmissionContributors(
          input.contributors,
          assertEmail(stringAnswer(state, submission, 'email')),
        )
      }
      validateAnswersForSubmission(state, submission)
      submission.status = 'submitted'
      submission.submittedAt = timestamp
      submission.updatedAt = timestamp
      submission.version += 1

      const plan = state.evaluationPlans.find(
        (entry) => entry.formId === form.id && entry.submissionKinds.includes(submission.kind),
      )
      const createdAssignments = []
      const trackId = stringAnswer(state, submission, 'track')
      let routedReviewerTeamId: string | undefined
      if (plan) {
        const round = [...plan.rounds].sort((left, right) => left.order - right.order)[0]
        const teamId = evaluationRoundReviewerTeamId(plan, round?.id, trackId)
        routedReviewerTeamId = teamId
        const team = state.reviewerTeams.find((entry) => entry.id === teamId)
        const activeReviewerIds = (team?.reviewerIds ?? []).filter(
          (reviewerId) =>
            state.reviewers.find((reviewer) => reviewer.id === reviewerId)?.status === 'active',
        )
        const startIndex = Math.max(0, state.submissions.indexOf(submission))
        const count = Math.min(round?.reviewersPerSubmission ?? 0, activeReviewerIds.length)
        for (let index = 0; index < count; index += 1) {
          const reviewerId = activeReviewerIds[(startIndex + index) % activeReviewerIds.length]
          const assignment = {
            id: createId('rva'),
            eventId: submission.eventId,
            evaluationPlanId: plan.id,
            roundId: round.id,
            submissionId: submission.id,
            reviewerId,
            status: 'assigned' as const,
            dueAt: round.closesAt ?? null,
            updatedAt: timestamp,
            version: 1,
          }
          state.reviewerAssignments.push(assignment)
          createdAssignments.push(assignment)
        }
      }
      const submissionTitle = stringAnswer(state, submission, 'proposal_title')
      const submitterFirstName = stringAnswer(state, submission, 'first_name')
      const submitterLastName = stringAnswer(state, submission, 'last_name')
      const event = findRequired(state.events, submission.eventId, 'event')
      const confirmationMessage = queueOutboundMessage(
        state,
        {
          campaignId: null,
          submissionId: submission.id,
          kind: 'submission_confirmation',
          trigger: 'submission.submit',
          recipientName: `${submitterFirstName} ${submitterLastName}`.trim(),
          recipientEmail: assertEmail(stringAnswer(state, submission, 'email')),
          subject: `We received “${submissionTitle}”`,
          body: `Hi ${submitterFirstName},\n\nYour proposal “${submissionTitle}” was submitted to ${event.name}. We will share a decision when the program team finishes reviewing it.`,
        },
        timestamp,
      )
      appendEvent(state, context, {
        type: 'submission.submitted',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: `Submitted “${submissionTitle}” for review.`,
        data: {
          formId: form.id,
          reviewerTeamId: routedReviewerTeamId,
          trackId,
          assignmentIds: createdAssignments.map((entry) => entry.id),
          confirmationMessageId: confirmationMessage.id,
        },
      })
      return { submission, assignments: createdAssignments, confirmationMessage }
    }

    case 'reviewer.create': {
      const email = assertEmail(input.email)
      if (
        state.reviewers.some(
          (reviewer) => reviewer.eventId === state.activeEventId && reviewer.email === email,
        )
      ) {
        throw new OperationError('DUPLICATE', 'A reviewer already uses that email address.', {
          email: 'Use a different email address.',
        })
      }
      const reviewer = {
        id: createId('rev'),
        eventId: state.activeEventId,
        name: assertString(input.name, 'name'),
        email,
        accessKey: createId('reviewer'),
        status: 'active' as const,
        createdAt: timestamp,
        version: 1,
      }
      state.reviewers.push(reviewer)
      appendEvent(state, context, {
        type: 'reviewer.created',
        aggregate: { type: 'reviewer', id: reviewer.id, version: reviewer.version },
        summary: `Added reviewer ${reviewer.name}.`,
        data: { email: reviewer.email },
      })
      return { reviewer }
    }

    case 'reviewer-team.create': {
      const team = {
        id: createId('rvt'),
        eventId: state.activeEventId,
        name: assertString(input.name, 'name'),
        reviewerIds: assertEventReviewerIds(state, input.reviewerIds),
        version: 1,
      }
      state.reviewerTeams.push(team)
      appendEvent(state, context, {
        type: 'reviewer-team.created',
        aggregate: { type: 'reviewer-team', id: team.id, version: team.version },
        summary: `Created reviewer pool “${team.name}”.`,
        data: { reviewerIds: team.reviewerIds },
      })
      return { team }
    }

    case 'reviewer-team.update': {
      const team = findRequired(state.reviewerTeams, input.teamId, 'reviewer team')
      if (team.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only active-event reviewer pools can be updated.')
      }
      if (input.name !== undefined) team.name = assertString(input.name, 'name')
      if (input.reviewerIds !== undefined) {
        team.reviewerIds = assertEventReviewerIds(state, input.reviewerIds)
      }
      team.version += 1
      appendEvent(state, context, {
        type: 'reviewer-team.updated',
        aggregate: { type: 'reviewer-team', id: team.id, version: team.version },
        summary: `Updated reviewer pool “${team.name}”.`,
        data: { reviewerIds: team.reviewerIds },
      })
      return { team }
    }

    case 'evaluation-plan.create': {
      const form = findRequired(state.submissionForms, input.formId, 'submission form')
      if (form.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Evaluation plans cannot cross event boundaries.')
      }
      if (state.evaluationPlans.some((entry) => entry.formId === form.id)) {
        throw new OperationError(
          'DUPLICATE',
          'This submission form already has an evaluation plan.',
        )
      }
      const rounds = parseEvaluationRounds(state, form.eventId, input.rounds)
      const firstRound = rounds[0]
      const submissionKinds =
        input.submissionKinds === undefined
          ? [...form.allowedKinds]
          : assertStringArray(input.submissionKinds, 'submissionKinds').map((kind) =>
              assertOneOf(kind, 'submissionKinds', ['abstract', 'guaranteed_session'] as const),
            )
      if (submissionKinds.length === 0) {
        throw new OperationError('INVALID_INPUT', 'Choose at least one submission kind.')
      }
      const plan: EvaluationPlan = {
        id: createId('evp'),
        eventId: form.eventId,
        formId: form.id,
        name: assertString(input.name, 'name'),
        submissionKinds,
        rounds,
        // These plan-level values keep persisted v4 clients readable. Round-level
        // settings are authoritative for every new plan.
        reviewerTeamId: firstRound.reviewerTeamId!,
        blindReview: firstRound.blindReview!,
        criteria: structuredClone(firstRound.criteria!),
        version: 1,
      }
      state.evaluationPlans.push(plan)
      appendEvent(state, context, {
        type: 'evaluation-plan.created',
        aggregate: { type: 'evaluation-plan', id: plan.id, version: plan.version },
        summary: `Created evaluation plan “${plan.name}”.`,
        data: { formId: form.id, roundIds: rounds.map((round) => round.id) },
      })
      return { plan }
    }

    case 'evaluation-plan.update': {
      const plan = findRequired(state.evaluationPlans, input.planId, 'evaluation plan')
      if (plan.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only the active event plan can be updated here.')
      }
      const rounds =
        input.rounds === undefined
          ? plan.rounds
          : parseEvaluationRounds(state, plan.eventId, input.rounds)
      const assignedRoundIds = new Set(
        state.reviewerAssignments
          .filter((assignment) => assignment.evaluationPlanId === plan.id)
          .map((assignment) => assignment.roundId),
      )
      const nextRoundIds = new Set(rounds.map((round) => round.id))
      if ([...assignedRoundIds].some((roundId) => !nextRoundIds.has(roundId))) {
        throw new OperationError(
          'INVALID_INPUT',
          'A review round with assignments cannot be removed.',
        )
      }
      for (const roundId of assignedRoundIds) {
        const currentRound = plan.rounds.find((round) => round.id === roundId)
        const nextRound = rounds.find((round) => round.id === roundId)
        if (!currentRound || !nextRound) continue
        const currentPolicy = {
          reviewerTeamId: currentRound.reviewerTeamId ?? plan.reviewerTeamId,
          blindReview: currentRound.blindReview ?? plan.blindReview,
          reviewersPerSubmission: currentRound.reviewersPerSubmission,
          minimumCompletedReviews: currentRound.minimumCompletedReviews,
          criteria: (currentRound.criteria ?? plan.criteria).map((criterion) => ({
            id: criterion.id,
            label: criterion.label,
            description: criterion.description,
            kind: evaluationCriterionKind(criterion),
            required: criterion.required ?? true,
            minimum: criterion.minimum ?? null,
            maximum: criterion.maximum ?? null,
            weight: criterion.weight,
            options: criterion.options ?? null,
          })),
        }
        const nextPolicy = {
          reviewerTeamId: nextRound.reviewerTeamId,
          blindReview: nextRound.blindReview,
          reviewersPerSubmission: nextRound.reviewersPerSubmission,
          minimumCompletedReviews: nextRound.minimumCompletedReviews,
          criteria: (nextRound.criteria ?? []).map((criterion) => ({
            id: criterion.id,
            label: criterion.label,
            description: criterion.description,
            kind: evaluationCriterionKind(criterion),
            required: criterion.required ?? true,
            minimum: criterion.minimum ?? null,
            maximum: criterion.maximum ?? null,
            weight: criterion.weight,
            options: criterion.options ?? null,
          })),
        }
        if (JSON.stringify(currentPolicy) !== JSON.stringify(nextPolicy)) {
          throw new OperationError(
            'INVALID_INPUT',
            `The review policy for “${currentRound.name}” cannot change after assignments are created.`,
          )
        }
      }
      if (input.name !== undefined) plan.name = assertString(input.name, 'name')
      if (input.submissionKinds !== undefined) {
        plan.submissionKinds = assertStringArray(input.submissionKinds, 'submissionKinds').map(
          (kind) =>
            assertOneOf(kind, 'submissionKinds', ['abstract', 'guaranteed_session'] as const),
        )
        if (plan.submissionKinds.length === 0) {
          throw new OperationError('INVALID_INPUT', 'Choose at least one submission kind.')
        }
      }
      plan.rounds = rounds
      const firstRound = rounds[0]
      plan.reviewerTeamId = firstRound.reviewerTeamId!
      plan.blindReview = firstRound.blindReview!
      plan.criteria = structuredClone(firstRound.criteria!)
      plan.version += 1
      appendEvent(state, context, {
        type: 'evaluation-plan.updated',
        aggregate: { type: 'evaluation-plan', id: plan.id, version: plan.version },
        summary: `Updated evaluation plan “${plan.name}”.`,
        data: { roundIds: rounds.map((round) => round.id) },
      })
      return { plan }
    }

    case 'review.assign': {
      const plan = findRequired(state.evaluationPlans, input.evaluationPlanId, 'evaluation plan')
      if (plan.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only active-event reviews can be assigned.')
      }
      const round = plan.rounds.find((entry) => entry.id === input.roundId)
      if (!round) throw new OperationError('NOT_FOUND', 'The evaluation round was not found.')
      const reviewer = findRequired(state.reviewers, input.reviewerId, 'reviewer')
      if (reviewer.eventId !== state.activeEventId || reviewer.status !== 'active') {
        throw new OperationError('INVALID_INPUT', 'Choose an active reviewer for this event.')
      }
      const submissionIds = [...new Set(assertStringArray(input.submissionIds, 'submissionIds'))]
      if (submissionIds.length === 0) {
        throw new OperationError('INVALID_INPUT', 'Select at least one proposal to assign.', {
          submissionIds: 'Select at least one proposal.',
        })
      }
      const trackValues =
        input.trackValues === undefined
          ? null
          : new Set(assertStringArray(input.trackValues, 'trackValues'))
      const maxAssignments =
        input.maxAssignments === undefined
          ? 500
          : boundedInteger(input.maxAssignments, 'maxAssignments', 1, 500)
      const existingForReviewer = state.reviewerAssignments.filter(
        (entry) =>
          entry.roundId === round.id &&
          entry.reviewerId === reviewer.id &&
          entry.status !== 'recused',
      ).length
      let available = Math.max(0, maxAssignments - existingForReviewer)
      const assignments = []
      const skipped: Array<{
        submissionId: string
        reason: 'existing' | 'cap' | 'track' | 'pool'
      }> = []

      for (const submissionId of submissionIds) {
        const submission = findRequired(state.submissions, submissionId, 'submission')
        if (
          submission.eventId !== state.activeEventId ||
          submission.formId !== plan.formId ||
          !plan.submissionKinds.includes(submission.kind)
        ) {
          throw new OperationError(
            'FORBIDDEN',
            'Review assignments cannot cross event, form, or submission-kind boundaries.',
          )
        }
        if (
          submission.status !== 'submitted' &&
          submission.status !== 'in_review' &&
          submission.status !== 'rejected' &&
          submission.status !== 'waitlisted'
        ) {
          throw new OperationError(
            'INVALID_TRANSITION',
            'Only proposals that have been submitted can be assigned.',
          )
        }
        if (trackValues && !trackValues.has(stringAnswer(state, submission, 'track'))) {
          skipped.push({ submissionId, reason: 'track' })
          continue
        }
        const submissionTrackId = stringAnswer(state, submission, 'track')
        const teamId = evaluationRoundReviewerTeamId(plan, round.id, submissionTrackId)
        const team = state.reviewerTeams.find((entry) => entry.id === teamId)
        if (!team?.reviewerIds.includes(reviewer.id)) {
          skipped.push({ submissionId, reason: 'pool' })
          continue
        }
        if (
          state.reviewerAssignments.some(
            (entry) =>
              entry.roundId === round.id &&
              entry.reviewerId === reviewer.id &&
              entry.submissionId === submission.id,
          )
        ) {
          skipped.push({ submissionId, reason: 'existing' })
          continue
        }
        if (available === 0) {
          skipped.push({ submissionId, reason: 'cap' })
          continue
        }
        const assignment = {
          id: createId('rva'),
          eventId: state.activeEventId,
          evaluationPlanId: plan.id,
          roundId: round.id,
          submissionId: submission.id,
          reviewerId: reviewer.id,
          status: 'assigned' as const,
          dueAt: round.closesAt ?? null,
          updatedAt: timestamp,
          version: 1,
        }
        state.reviewerAssignments.push(assignment)
        assignments.push(assignment)
        available -= 1
        if (submission.status === 'submitted') {
          submission.status = 'in_review'
          submission.updatedAt = timestamp
          submission.version += 1
        }
      }

      appendEvent(state, context, {
        type: 'reviewer-assignment.created',
        aggregate: { type: 'reviewer', id: reviewer.id, version: reviewer.version },
        summary: `Assigned ${assignments.length} review${assignments.length === 1 ? '' : 's'} to ${reviewer.name}.`,
        data: {
          roundId: round.id,
          assignmentIds: assignments.map((entry) => entry.id),
          skipped,
          maxAssignments,
          trackValues: trackValues ? [...trackValues] : [],
        },
      })
      return { assignments, skipped }
    }

    case 'review.unassign': {
      const assignment = findRequired(
        state.reviewerAssignments,
        input.assignmentId,
        'reviewer assignment',
      )
      if (assignment.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only active-event reviews can be unassigned.')
      }
      if (
        assignment.status === 'completed' ||
        state.scorecards.some((entry) => entry.assignmentId === assignment.id)
      ) {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Completed reviews cannot be unassigned. Keep their audit history intact.',
        )
      }
      const reviewer = findRequired(state.reviewers, assignment.reviewerId, 'reviewer')
      const submission = findRequired(state.submissions, assignment.submissionId, 'submission')
      state.reviewerAssignments.splice(state.reviewerAssignments.indexOf(assignment), 1)
      if (
        submission.status === 'in_review' &&
        !state.reviewerAssignments.some((entry) => entry.submissionId === submission.id)
      ) {
        submission.status = 'submitted'
        submission.updatedAt = timestamp
        submission.version += 1
      }
      appendEvent(state, context, {
        type: 'reviewer-assignment.removed',
        aggregate: {
          type: 'reviewer-assignment',
          id: assignment.id,
          version: assignment.version + 1,
        },
        summary: `Removed ${reviewer.name} from “${stringAnswer(state, submission, 'proposal_title')}”.`,
        data: { reviewerId: reviewer.id, submissionId: submission.id, roundId: assignment.roundId },
      })
      return { assignmentId: assignment.id }
    }

    case 'review.remind': {
      const reviewerIds = [...new Set(assertStringArray(input.reviewerIds, 'reviewerIds'))]
      if (reviewerIds.length === 0) {
        throw new OperationError('INVALID_INPUT', 'Select at least one reviewer to remind.', {
          reviewerIds: 'Select at least one reviewer.',
        })
      }
      const reminded = []
      for (const reviewerId of reviewerIds) {
        const reviewer = findRequired(state.reviewers, reviewerId, 'reviewer')
        if (reviewer.eventId !== state.activeEventId || reviewer.status !== 'active') {
          throw new OperationError('INVALID_INPUT', 'Only active reviewers can be reminded.')
        }
        const outstanding = state.reviewerAssignments.filter(
          (assignment) =>
            assignment.eventId === state.activeEventId &&
            assignment.reviewerId === reviewer.id &&
            assignment.status !== 'completed' &&
            assignment.status !== 'recused',
        )
        if (outstanding.length === 0) {
          throw new OperationError(
            'INVALID_INPUT',
            `${reviewer.name} has no outstanding reviews to remind them about.`,
          )
        }
        reviewer.lastRemindedAt = timestamp
        reviewer.version += 1
        const event = findRequired(state.events, reviewer.eventId, 'event')
        const message = queueOutboundMessage(
          state,
          {
            campaignId: null,
            submissionId: null,
            kind: 'reviewer_reminder',
            trigger: 'review.remind',
            recipientName: reviewer.name,
            recipientEmail: reviewer.email,
            subject: `${outstanding.length} review${outstanding.length === 1 ? '' : 's'} waiting in ${event.name}`,
            body: `Hi ${reviewer.name.split(' ')[0]},\n\nYou have ${outstanding.length} outstanding review${outstanding.length === 1 ? '' : 's'} for ${event.name}. Open your reviewer workspace to finish the assigned scorecards.`,
          },
          timestamp,
        )
        reminded.push({ reviewer, outstanding: outstanding.length, message })
        appendEvent(state, context, {
          type: 'reviewer.reminder-sent',
          aggregate: { type: 'reviewer', id: reviewer.id, version: reviewer.version },
          summary: `Sent ${reviewer.name} a reminder for ${outstanding.length} outstanding review${outstanding.length === 1 ? '' : 's'}.`,
          data: {
            reviewerId: reviewer.id,
            recipient: reviewer.email,
            outstandingAssignmentIds: outstanding.map((assignment) => assignment.id),
            deliveryMode: 'durable-outbox',
          },
        })
      }
      return {
        reviewers: reminded.map(({ reviewer, outstanding, message }) => ({
          id: reviewer.id,
          email: reviewer.email,
          outstanding,
          sentAt: timestamp,
          messageId: message.id,
        })),
      }
    }

    case 'review.recuse': {
      const assignment = findRequired(
        state.reviewerAssignments,
        input.assignmentId,
        'reviewer assignment',
      )
      if (assignment.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only active-event reviews can be recused.')
      }
      if (context.actor.type === 'reviewer' && assignment.reviewerId !== context.actor.id) {
        throw new OperationError('FORBIDDEN', 'This review is assigned to another reviewer.')
      }
      if (assignment.status === 'completed') {
        throw new OperationError('INVALID_TRANSITION', 'A completed review cannot be recused.')
      }
      if (assignment.status === 'recused') {
        throw new OperationError('INVALID_TRANSITION', 'This conflict has already been declared.')
      }
      const reviewer = findRequired(state.reviewers, assignment.reviewerId, 'reviewer')
      const submission = findRequired(state.submissions, assignment.submissionId, 'submission')
      const reason =
        typeof input.reason === 'string' && input.reason.trim()
          ? input.reason.trim()
          : 'Reviewer declared a conflict of interest.'
      assignment.status = 'recused'
      assignment.conflictReason = reason
      assignment.recusedAt = timestamp
      assignment.updatedAt = timestamp
      assignment.version += 1
      appendEvent(state, context, {
        type: 'reviewer-assignment.recused',
        aggregate: {
          type: 'reviewer-assignment',
          id: assignment.id,
          version: assignment.version,
        },
        summary: `${reviewer.name} declared a conflict with “${stringAnswer(state, submission, 'proposal_title')}”.`,
        data: {
          reviewerId: reviewer.id,
          submissionId: submission.id,
          roundId: assignment.roundId,
          reason,
        },
      })
      return { assignment }
    }

    case 'review.restore-recusal': {
      const assignment = findRequired(
        state.reviewerAssignments,
        input.assignmentId,
        'reviewer assignment',
      )
      if (assignment.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Only active-event reviews can be restored.')
      }
      if (context.actor.type === 'reviewer' && assignment.reviewerId !== context.actor.id) {
        throw new OperationError('FORBIDDEN', 'This review is assigned to another reviewer.')
      }
      if (assignment.status !== 'recused') {
        throw new OperationError('INVALID_TRANSITION', 'Only a recused review can be restored.')
      }
      const reviewer = findRequired(state.reviewers, assignment.reviewerId, 'reviewer')
      const submission = findRequired(state.submissions, assignment.submissionId, 'submission')
      assignment.status = 'assigned'
      assignment.conflictReason = null
      assignment.recusedAt = null
      assignment.updatedAt = timestamp
      assignment.version += 1
      appendEvent(state, context, {
        type: 'reviewer-assignment.recusal-restored',
        aggregate: {
          type: 'reviewer-assignment',
          id: assignment.id,
          version: assignment.version,
        },
        summary: `${reviewer.name} restored “${stringAnswer(state, submission, 'proposal_title')}” to their review queue.`,
        data: {
          reviewerId: reviewer.id,
          submissionId: submission.id,
          roundId: assignment.roundId,
        },
      })
      return { assignment }
    }

    case 'review.submit-scorecard': {
      const assignment = findRequired(
        state.reviewerAssignments,
        input.assignmentId,
        'reviewer assignment',
      )
      if (context.actor.type === 'reviewer' && assignment.reviewerId !== context.actor.id) {
        throw new OperationError('FORBIDDEN', 'This scorecard is assigned to another reviewer.')
      }
      if (assignment.status === 'recused') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Restore this review before submitting a scorecard.',
        )
      }
      const plan = findRequired(
        state.evaluationPlans,
        assignment.evaluationPlanId,
        'evaluation plan',
      )
      const criteria = evaluationRoundCriteria(plan, assignment.roundId)
      const answerInput = assertRecord(input.answers ?? input.scores ?? {}, 'answers')
      const answers: Record<string, number | string> = {}
      const scores: Record<string, number> = {}
      const fields: Record<string, string> = {}
      for (const criterion of criteria) {
        const value = answerInput[criterion.id]
        const kind = evaluationCriterionKind(criterion)
        const required = criterion.required ?? true
        if (!required && (value === undefined || value === '')) continue
        if (kind === 'numeric') {
          const minimum = criterion.minimum ?? 1
          const maximum = criterion.maximum ?? 5
          if (
            typeof value !== 'number' ||
            !Number.isFinite(value) ||
            value < minimum ||
            value > maximum
          ) {
            fields[criterion.id] = `Enter a score from ${minimum} to ${maximum}.`
          } else {
            answers[criterion.id] = value
            scores[criterion.id] = value
          }
          continue
        }
        if (kind === 'select') {
          if (typeof value !== 'string' || !(criterion.options ?? []).includes(value)) {
            fields[criterion.id] = 'Choose one of the available options.'
          } else {
            answers[criterion.id] = value
          }
          continue
        }
        if (typeof value !== 'string' || value.trim().length === 0) {
          fields[criterion.id] = 'Enter a response.'
        } else {
          answers[criterion.id] = value.trim()
        }
      }
      if (Object.keys(fields).length > 0) {
        throw new OperationError('INVALID_INPUT', 'Complete every scorecard criterion.', fields)
      }
      const recommendation =
        input.recommendation === undefined
          ? recommendationFromAnswers(criteria, answers)
          : assertOneOf(input.recommendation, 'recommendation', [
              'strong_accept',
              'accept',
              'borderline',
              'reject',
              'strong_reject',
            ] as const)
      let scorecard = state.scorecards.find((entry) => entry.assignmentId === assignment.id)
      if (scorecard) {
        scorecard.answers = answers
        scorecard.scores = scores
        scorecard.recommendation = recommendation
        scorecard.comments = optionalString(input.comments)
        scorecard.submittedAt = timestamp
        scorecard.updatedAt = timestamp
        scorecard.version += 1
      } else {
        scorecard = {
          id: createId('sco'),
          assignmentId: assignment.id,
          answers,
          scores,
          recommendation,
          comments: optionalString(input.comments),
          submittedAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        }
        state.scorecards.push(scorecard)
      }
      assignment.status = 'completed'
      assignment.updatedAt = timestamp
      assignment.version += 1
      const submission = findRequired(state.submissions, assignment.submissionId, 'submission')
      if (submission.status === 'submitted') {
        submission.status = 'in_review'
        submission.updatedAt = timestamp
        submission.version += 1
      }
      appendEvent(state, context, {
        type: 'review.scorecard-submitted',
        aggregate: { type: 'scorecard', id: scorecard.id, version: scorecard.version },
        summary: `Completed a review for “${stringAnswer(state, submission, 'proposal_title')}”.`,
        data: { assignmentId: assignment.id, submissionId: submission.id, recommendation },
      })
      return {
        assignment,
        scorecard,
        review: submissionReviewSummary(state, submission.id),
      }
    }

    case 'review.decide': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      const decision = assertOneOf(input.decision, 'decision', [
        'accepted',
        'rejected',
        'waitlisted',
      ] as const)
      const previousStatus = submission.status
      if (
        submission.status === 'draft' ||
        submission.status === 'withdrawn' ||
        (submission.status === 'accepted' && decision === 'accepted')
      ) {
        throw new OperationError(
          'INVALID_TRANSITION',
          `A ${submission.status} submission cannot receive this decision.`,
        )
      }
      if (previousStatus === 'accepted' && input.override !== true) {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Changing an accepted decision requires an explicit override and reason.',
          { reason: 'Explain why the accepted decision is changing.' },
        )
      }
      if (input.override !== true) {
        const readiness = submissionDecisionReadiness(state, submission)
        if (!readiness.ready) {
          const nextIncomplete = readiness.incompleteRounds[0]
          throw new OperationError(
            'REVIEWS_INCOMPLETE',
            `Complete ${nextIncomplete.required} reviews in “${nextIncomplete.name}” before deciding this submission.`,
          )
        }
      }
      if (input.override === true && optionalString(input.reason).length === 0) {
        throw new OperationError('INVALID_INPUT', 'An override decision requires a reason.', {
          reason: 'Explain why review requirements are being overridden.',
        })
      }

      let person: Person | null = null
      let participation: Participation | null = null
      let session: Session | null = null
      let removedPlacementIds: string[] = []
      const acceptedParticipations: Participation[] = []
      if (decision === 'accepted') {
        const submissionParticipants = [
          {
            firstName: assertString(stringAnswer(state, submission, 'first_name'), 'firstName'),
            lastName: assertString(stringAnswer(state, submission, 'last_name'), 'lastName'),
            email: assertEmail(stringAnswer(state, submission, 'email')),
            company: stringAnswer(state, submission, 'company'),
            title: stringAnswer(state, submission, 'job_title'),
            biography: stringAnswer(state, submission, 'biography'),
          },
          ...submission.contributors,
        ]
        for (const [index, participantInput] of submissionParticipants.entries()) {
          let participantPerson =
            state.people.find(
              (entry) => entry.email.toLowerCase() === participantInput.email.toLowerCase(),
            ) ?? null
          if (!participantPerson) {
            participantPerson = {
              id: createId('per'),
              firstName: participantInput.firstName,
              lastName: participantInput.lastName,
              email: participantInput.email.toLowerCase(),
              company: participantInput.company,
              title: participantInput.title,
              city: '',
              timezone: state.workspace.timezone,
              bio: participantInput.biography,
              avatarUrl: `https://assets.ui.sh/avatars/${(state.people.length % 12) + 1}.webp`,
              tags: [],
              createdAt: timestamp,
              updatedAt: timestamp,
              version: 1,
            }
            state.people.push(participantPerson)
            appendEvent(state, context, {
              type: 'person.created',
              aggregate: {
                type: 'person',
                id: participantPerson.id,
                version: participantPerson.version,
              },
              summary: `Created ${participantPerson.firstName} ${participantPerson.lastName} from an accepted submission.`,
              data: { submissionId: submission.id },
            })
          }
          let participantParticipation =
            state.participations.find(
              (entry) =>
                entry.eventId === submission.eventId && entry.personId === participantPerson?.id,
            ) ?? null
          if (!participantParticipation) {
            participantParticipation = {
              id: createId('par'),
              eventId: submission.eventId,
              personId: participantPerson.id,
              portalAccessKey: createId('portal'),
              roles: ['speaker'],
              status: 'invited',
              sessionIds: [],
              internalNotes: '',
              publicTitle: participantPerson.title,
              publicCompany: participantPerson.company,
              confirmedAt: null,
              updatedAt: timestamp,
              version: 1,
            }
            state.participations.push(participantParticipation)
            appendEvent(state, context, {
              type: 'participation.created',
              aggregate: {
                type: 'participation',
                id: participantParticipation.id,
                version: participantParticipation.version,
              },
              summary: `Invited ${participantPerson.firstName} ${participantPerson.lastName} to the event.`,
              data: { personId: participantPerson.id, submissionId: submission.id },
            })
          } else if (
            participantParticipation.status === 'prospect' ||
            participantParticipation.status === 'declined' ||
            participantParticipation.status === 'withdrawn'
          ) {
            participantParticipation.status = 'invited'
            participantParticipation.updatedAt = timestamp
            participantParticipation.version += 1
          }
          for (const definition of state.requirementDefinitions.filter(
            (entry) => entry.eventId === submission.eventId,
          )) {
            if (
              !state.requirementInstances.some(
                (entry) =>
                  entry.definitionId === definition.id &&
                  entry.participationId === participantParticipation?.id,
              )
            ) {
              state.requirementInstances.push({
                id: createId('rqi'),
                definitionId: definition.id,
                participationId: participantParticipation.id,
                status: 'not_started',
                value: '',
                submittedAt: null,
                reviewedAt: null,
                updatedAt: timestamp,
                version: 1,
              })
            }
          }
          acceptedParticipations.push(participantParticipation)
          if (index === 0) {
            person = participantPerson
            participation = participantParticipation
          }
        }
        const format = sessionFormatAnswer(state, submission)
        const requestedTrackId = stringAnswer(state, submission, 'track')
        const track =
          state.tracks.find(
            (entry) => entry.id === requestedTrackId && entry.eventId === submission.eventId,
          ) ?? state.tracks.find((entry) => entry.eventId === submission.eventId)
        if (!track) throw new OperationError('INVALID_INPUT', 'The event needs at least one track.')
        const defaultDurations = {
          keynote: 45,
          talk: 30,
          lightning: 10,
          panel: 45,
          workshop: 120,
        } as const
        const durationMinutes =
          typeof input.durationMinutes === 'number' &&
          Number.isInteger(input.durationMinutes) &&
          input.durationMinutes > 0
            ? input.durationMinutes
            : (requestedSessionDuration(state, submission) ?? defaultDurations[format])
        const expectedAttendance =
          typeof input.expectedAttendance === 'number' &&
          Number.isInteger(input.expectedAttendance) &&
          input.expectedAttendance > 0
            ? input.expectedAttendance
            : 100
        session = {
          id: createId('ses'),
          eventId: submission.eventId,
          title: assertString(stringAnswer(state, submission, 'proposal_title'), 'proposalTitle'),
          format,
          summary: assertString(stringAnswer(state, submission, 'abstract'), 'abstract'),
          trackId: track.id,
          participantIds: acceptedParticipations.map((entry) => entry.id),
          durationMinutes,
          expectedAttendance,
          status: 'ready',
          updatedAt: timestamp,
          version: 1,
        }
        state.sessions.push(session)
        for (const acceptedParticipation of acceptedParticipations) {
          acceptedParticipation.sessionIds.push(session.id)
          acceptedParticipation.updatedAt = timestamp
          acceptedParticipation.version += 1
        }
        appendEvent(state, context, {
          type: 'session.created-from-submission',
          aggregate: { type: 'session', id: session.id, version: session.version },
          summary: `Created session “${session.title}” from an accepted submission.`,
          data: {
            submissionId: submission.id,
            participationId: participation!.id,
            participantIds: acceptedParticipations.map((entry) => entry.id),
          },
        })
        submission.convertedParticipationId = participation!.id
        submission.convertedSessionId = session.id
      } else if (previousStatus === 'accepted') {
        session = submission.convertedSessionId
          ? (state.sessions.find((entry) => entry.id === submission.convertedSessionId) ?? null)
          : null
        removedPlacementIds = session
          ? state.placements
              .filter((placement) => placement.sessionId === session?.id)
              .map((placement) => placement.id)
          : []
        if (session) {
          session.status = 'cancelled'
          session.updatedAt = timestamp
          session.version += 1
          state.placements = state.placements.filter(
            (placement) => placement.sessionId !== session?.id,
          )
          for (const participationId of session.participantIds) {
            const acceptedParticipation = state.participations.find(
              (entry) => entry.id === participationId,
            )
            if (!acceptedParticipation) continue
            acceptedParticipation.sessionIds = acceptedParticipation.sessionIds.filter(
              (sessionId) => sessionId !== session?.id,
            )
            if (
              acceptedParticipation.sessionIds.length === 0 &&
              (acceptedParticipation.status === 'invited' ||
                acceptedParticipation.status === 'confirmed')
            ) {
              acceptedParticipation.status = 'withdrawn'
            }
            acceptedParticipation.updatedAt = timestamp
            acceptedParticipation.version += 1
          }
          appendEvent(state, context, {
            type: 'session.cancelled-from-submission',
            aggregate: { type: 'session', id: session.id, version: session.version },
            summary: `Cancelled “${session.title}” after its proposal decision changed.`,
            data: {
              submissionId: submission.id,
              decision,
              removedPlacementIds,
            },
          })
        }
      }

      const previous = submission.status
      submission.status = decision
      submission.decidedAt = timestamp
      submission.updatedAt = timestamp
      submission.version += 1
      const existingDecision = state.reviewDecisions.find(
        (entry) => entry.submissionId === submission.id,
      )
      const reviewDecision = existingDecision ?? {
        id: createId('rde'),
        eventId: submission.eventId,
        submissionId: submission.id,
        decision,
        reason: optionalString(input.reason),
        decidedBy: {
          type: context.actor.type,
          id: context.actor.id,
          name: context.actor.name,
        },
        decidedAt: timestamp,
        version: 1,
      }
      if (existingDecision) {
        existingDecision.decision = decision
        existingDecision.reason = optionalString(input.reason)
        existingDecision.decidedBy = {
          type: context.actor.type,
          id: context.actor.id,
          name: context.actor.name,
        }
        existingDecision.decidedAt = timestamp
        existingDecision.version += 1
      } else {
        state.reviewDecisions.push(reviewDecision)
      }
      appendEvent(state, context, {
        type: 'review.decision-recorded',
        aggregate: {
          type: 'submission',
          id: submission.id,
          version: submission.version,
        },
        summary: `${decision === 'accepted' ? 'Accepted' : decision === 'rejected' ? 'Rejected' : 'Waitlisted'} “${stringAnswer(state, submission, 'proposal_title')}”.`,
        data: {
          previous,
          decision,
          reviewDecisionId: reviewDecision.id,
          participationId: participation?.id,
          sessionId: session?.id,
          removedPlacementIds,
        },
      })
      return {
        submission,
        decision: reviewDecision,
        person,
        participation,
        session,
      }
    }

    case 'submission.notify-decision': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      if (
        submission.status !== 'accepted' &&
        submission.status !== 'rejected' &&
        submission.status !== 'waitlisted'
      ) {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Record an accepted, rejected, or waitlisted decision before notifying the submitter.',
        )
      }
      const submissionTitle = stringAnswer(state, submission, 'proposal_title')
      const defaults = submissionDecisionMessageTemplate(submission.status)
      const preview = submissionDecisionMessagePreview(state, submission, {
        subject:
          input.subject === undefined ? defaults.subject : assertString(input.subject, 'subject'),
        body: input.body === undefined ? defaults.body : assertString(input.body, 'body'),
      })
      if (!preview) throw new OperationError('NOT_FOUND', 'The submission event was not found.')
      const message = queueOutboundMessage(
        state,
        {
          campaignId: null,
          submissionId: submission.id,
          kind: 'decision_notice',
          trigger: 'submission.notify-decision',
          recipientName: preview.recipientName,
          recipientEmail: assertEmail(preview.recipientEmail),
          subject: preview.subject,
          body: preview.body,
        },
        timestamp,
      )
      appendEvent(state, context, {
        type: 'submission.decision-notice-queued',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: `Queued the decision email for “${submissionTitle}”.`,
        data: {
          messageId: message.id,
          recipientEmail: message.recipientEmail,
          decision: submission.status,
          deliveryMode: 'durable-outbox',
        },
      })
      return { submission, message }
    }

    case 'person.create': {
      const firstName = assertString(input.firstName, 'firstName')
      const lastName = assertString(input.lastName, 'lastName')
      const email = assertEmail(input.email)
      if (state.people.some((person) => person.email.toLowerCase() === email)) {
        throw new OperationError('DUPLICATE', 'A person with that email already exists.', {
          email: 'Use the existing person or enter another email.',
        })
      }
      const personId = createId('per')
      const addToActiveEvent = input.addToActiveEvent !== false
      const participationId = addToActiveEvent ? createId('par') : null
      const person = {
        id: personId,
        firstName,
        lastName,
        email,
        company: typeof input.company === 'string' ? input.company.trim() : '',
        title: typeof input.title === 'string' ? input.title.trim() : '',
        city: typeof input.city === 'string' ? input.city.trim() : '',
        timezone:
          typeof input.timezone === 'string' && input.timezone.trim().length > 0
            ? assertTimeZone(input.timezone)
            : state.workspace.timezone,
        bio: optionalString(input.bio),
        avatarUrl: `https://assets.ui.sh/avatars/${(state.people.length % 12) + 1}.webp`,
        tags: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      const roles = Array.isArray(input.roles)
        ? assertStringArray(input.roles, 'roles')
        : ['speaker']
      const allowedRoles = ['speaker', 'moderator', 'panelist', 'chair', 'workshop_lead'] as const
      if (roles.some((role) => !allowedRoles.includes(role as (typeof allowedRoles)[number]))) {
        throw new OperationError('INVALID_INPUT', 'One or more participant roles are invalid.')
      }
      const participation: Participation | null = participationId
        ? {
            id: participationId,
            eventId: state.activeEventId,
            personId,
            portalAccessKey: createId('portal'),
            roles: roles as Array<(typeof allowedRoles)[number]>,
            status: 'prospect' as const,
            sessionIds: [],
            internalNotes: '',
            publicTitle: person.title,
            publicCompany: person.company,
            confirmedAt: null,
            updatedAt: timestamp,
            version: 1,
          }
        : null
      state.people.push(person)
      if (participation) {
        state.participations.push(participation)
        for (const definition of state.requirementDefinitions.filter(
          (entry) => entry.eventId === state.activeEventId,
        )) {
          state.requirementInstances.push({
            id: createId('rqi'),
            definitionId: definition.id,
            participationId: participation.id,
            status: 'not_started',
            value: '',
            submittedAt: null,
            reviewedAt: null,
            updatedAt: timestamp,
            version: 1,
          })
        }
      }
      appendEvent(state, context, {
        type: 'person.created',
        aggregate: { type: 'person', id: personId, version: 1 },
        summary: `Created ${firstName} ${lastName}.`,
        data: { participationId },
      })
      if (participation) {
        appendEvent(state, context, {
          type: 'participation.created',
          aggregate: { type: 'participation', id: participation.id, version: 1 },
          summary: `Added ${firstName} ${lastName} to the active event.`,
          data: { personId, roles },
        })
      }
      return { person, participation }
    }

    case 'person.add-note': {
      const person = findRequired(state.people, input.personId, 'person')
      const note: ContactNote = {
        id: createId('note'),
        personId: person.id,
        body: assertString(input.body, 'body'),
        createdBy: context.actor.name,
        createdAt: timestamp,
      }
      state.contactNotes.unshift(note)
      appendEvent(state, context, {
        type: 'person.note-added',
        aggregate: { type: 'person', id: person.id, version: person.version },
        summary: `Added a note to ${person.firstName} ${person.lastName}.`,
        data: { noteId: note.id },
      })
      return { person, note }
    }

    case 'person.add-to-event': {
      const person = findRequired(state.people, input.personId, 'person')
      const event = findRequired(state.events, input.eventId, 'event')
      const existing = state.participations.find(
        (entry) => entry.personId === person.id && entry.eventId === event.id,
      )
      if (existing) return { person, participation: existing, created: false }

      const participation: Participation = {
        id: createId('par'),
        eventId: event.id,
        personId: person.id,
        portalAccessKey: createId('portal'),
        roles: ['speaker'],
        status: 'prospect',
        sessionIds: [],
        internalNotes: '',
        publicTitle: person.title,
        publicCompany: person.company,
        confirmedAt: null,
        updatedAt: timestamp,
        version: 1,
      }
      state.participations.push(participation)
      for (const definition of state.requirementDefinitions.filter(
        (entry) => entry.eventId === event.id,
      )) {
        state.requirementInstances.push({
          id: createId('rqi'),
          definitionId: definition.id,
          participationId: participation.id,
          status: 'not_started',
          value: '',
          submittedAt: null,
          reviewedAt: null,
          updatedAt: timestamp,
          version: 1,
        })
      }
      appendEvent(state, context, {
        type: 'participation.created',
        aggregate: { type: 'participation', id: participation.id, version: 1 },
        summary: `Added ${person.firstName} ${person.lastName} to ${event.name}.`,
        data: { personId: person.id, eventId: event.id, roles: participation.roles },
      })
      return { person, participation, created: true }
    }

    case 'person.merge': {
      const primary = findRequired(state.people, input.primaryPersonId, 'primary person')
      const duplicate = findRequired(state.people, input.duplicatePersonId, 'duplicate person')
      if (primary.id === duplicate.id) {
        throw new OperationError('INVALID_INPUT', 'Choose two different contacts to merge.')
      }

      primary.tags = [...new Set([...primary.tags, ...duplicate.tags])]
      for (const field of ['company', 'title', 'city', 'bio'] as const) {
        if (!primary[field] && duplicate[field]) primary[field] = duplicate[field]
      }
      const duplicateParticipations = state.participations.filter(
        (entry) => entry.personId === duplicate.id,
      )
      let combinedParticipations = 0
      for (const source of duplicateParticipations) {
        const target = state.participations.find(
          (entry) => entry.personId === primary.id && entry.eventId === source.eventId,
        )
        if (!target) {
          source.personId = primary.id
          source.updatedAt = timestamp
          source.version += 1
          continue
        }

        combinedParticipations += 1
        target.roles = [...new Set([...target.roles, ...source.roles])]
        target.sessionIds = [...new Set([...target.sessionIds, ...source.sessionIds])]
        target.internalNotes = [target.internalNotes, source.internalNotes]
          .filter(Boolean)
          .join('\n\n')
        target.publicTitle ||= source.publicTitle
        target.publicCompany ||= source.publicCompany
        target.confirmedAt ||= source.confirmedAt
        target.updatedAt = timestamp
        target.version += 1

        for (const session of state.sessions.filter((entry) =>
          entry.participantIds.includes(source.id),
        )) {
          session.participantIds = [
            ...new Set(
              session.participantIds.map((participantId) =>
                participantId === source.id ? target.id : participantId,
              ),
            ),
          ]
          session.updatedAt = timestamp
          session.version += 1
        }

        for (const sourceRequirement of state.requirementInstances.filter(
          (entry) => entry.participationId === source.id,
        )) {
          const targetRequirement = state.requirementInstances.find(
            (entry) =>
              entry.participationId === target.id &&
              entry.definitionId === sourceRequirement.definitionId,
          )
          if (!targetRequirement) {
            sourceRequirement.participationId = target.id
            sourceRequirement.updatedAt = timestamp
            sourceRequirement.version += 1
            continue
          }
          if (sourceRequirement.updatedAt > targetRequirement.updatedAt) {
            targetRequirement.status = sourceRequirement.status
            targetRequirement.value = sourceRequirement.value
            targetRequirement.submittedAt = sourceRequirement.submittedAt
            targetRequirement.reviewedAt = sourceRequirement.reviewedAt
            targetRequirement.updatedAt = timestamp
            targetRequirement.version += 1
          }
          for (const asset of state.assets) {
            if (asset.owner.type === 'requirement' && asset.owner.id === sourceRequirement.id) {
              asset.owner.id = targetRequirement.id
            }
          }
          state.requirementInstances = state.requirementInstances.filter(
            (entry) => entry.id !== sourceRequirement.id,
          )
        }
        for (const asset of state.assets) {
          if (asset.owner.type === 'participation' && asset.owner.id === source.id) {
            asset.owner.id = target.id
          }
        }
        state.participations = state.participations.filter((entry) => entry.id !== source.id)
      }

      for (const asset of state.assets) {
        if (asset.owner.type === 'person' && asset.owner.id === duplicate.id) {
          asset.owner.id = primary.id
        }
      }
      for (const note of state.contactNotes) {
        if (note.personId === duplicate.id) note.personId = primary.id
      }
      for (const segment of state.crmSegments) {
        if (segment.personIds.includes(duplicate.id)) {
          segment.personIds = [
            ...new Set(
              segment.personIds.map((personId) =>
                personId === duplicate.id ? primary.id : personId,
              ),
            ),
          ]
          segment.updatedAt = timestamp
          segment.version += 1
        }
      }

      const primaryPipeline = state.speakerPipeline.find((entry) => entry.personId === primary.id)
      const duplicatePipeline = state.speakerPipeline.find(
        (entry) => entry.personId === duplicate.id,
      )
      if (duplicatePipeline && primaryPipeline) {
        primaryPipeline.notes.unshift(...duplicatePipeline.notes)
        primaryPipeline.history.push(...duplicatePipeline.history)
        primaryPipeline.updatedAt = timestamp
        primaryPipeline.version += 1
        state.speakerPipeline = state.speakerPipeline.filter(
          (entry) => entry.id !== duplicatePipeline.id,
        )
      } else if (duplicatePipeline) {
        duplicatePipeline.personId = primary.id
        duplicatePipeline.updatedAt = timestamp
        duplicatePipeline.version += 1
      }

      primary.updatedAt = timestamp
      primary.version += 1
      state.people = state.people.filter((entry) => entry.id !== duplicate.id)
      appendEvent(state, context, {
        type: 'person.merged',
        aggregate: { type: 'person', id: primary.id, version: primary.version },
        summary: `Merged ${duplicate.firstName} ${duplicate.lastName} into ${primary.firstName} ${primary.lastName}.`,
        data: { duplicatePersonId: duplicate.id, combinedParticipations },
      })
      return { person: primary, duplicatePersonId: duplicate.id, combinedParticipations }
    }

    case 'crm.segment.create': {
      const mode = assertOneOf(input.mode, 'mode', ['dynamic', 'static'] as const)
      const filtersInput = input.filters === undefined ? {} : assertRecord(input.filters, 'filters')
      const filters: CrmSegment['filters'] = {}
      for (const field of ['company', 'title', 'tag'] as const) {
        if (filtersInput[field] !== undefined) {
          const value = filtersInput[field]
          if (value === '') continue
          filters[field] = assertString(value, `filters.${field}`)
        }
      }
      const personIds =
        mode === 'static' ? [...new Set(assertStringArray(input.personIds ?? [], 'personIds'))] : []
      for (const personId of personIds) findRequired(state.people, personId, 'person')
      const segment: CrmSegment = {
        id: createId('seg'),
        name: assertString(input.name, 'name'),
        mode,
        filters,
        personIds,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      state.crmSegments.unshift(segment)
      appendEvent(state, context, {
        type: 'crm.segment-created',
        aggregate: { type: 'crm_segment', id: segment.id, version: 1 },
        summary: `Saved the ${segment.name} segment.`,
        data: { mode, personCount: personIds.length, filters },
      })
      return { segment }
    }

    case 'crm.pipeline.enroll': {
      const person = findRequired(state.people, input.personId, 'person')
      if (state.speakerPipeline.some((entry) => entry.personId === person.id)) {
        throw new OperationError('DUPLICATE', 'This contact is already in the speaker pipeline.')
      }
      const stage = assertOneOf(input.stage, 'stage', [
        'researching',
        'identified',
        'contacted',
        'interested',
        'confirmed',
        'declined',
      ] as const)
      const score = input.score === undefined || input.score === null ? null : Number(input.score)
      if (score !== null && (!Number.isInteger(score) || score < 0 || score > 100)) {
        throw new OperationError('INVALID_INPUT', 'score must be an integer from 0 to 100.')
      }
      const entry: SpeakerPipelineEntry = {
        id: createId('pipe'),
        personId: person.id,
        stage,
        score,
        rationale: optionalString(input.rationale),
        notes: [],
        history: [{ from: null, to: stage, changedAt: timestamp, changedBy: context.actor.name }],
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      state.speakerPipeline.unshift(entry)
      appendEvent(state, context, {
        type: 'crm.pipeline-enrolled',
        aggregate: { type: 'speaker_pipeline', id: entry.id, version: 1 },
        summary: `Added ${person.firstName} ${person.lastName} to the speaker pipeline.`,
        data: { personId: person.id, stage, score },
      })
      return { entry, person }
    }

    case 'crm.pipeline.move': {
      const entry = findRequired(state.speakerPipeline, input.entryId, 'pipeline entry')
      const stage: SpeakerPipelineStage = assertOneOf(input.stage, 'stage', [
        'researching',
        'identified',
        'contacted',
        'interested',
        'confirmed',
        'declined',
      ] as const)
      if (entry.stage === stage) return { entry, changed: false }
      const previous = entry.stage
      entry.stage = stage
      entry.history.push({
        from: previous,
        to: stage,
        changedAt: timestamp,
        changedBy: context.actor.name,
      })
      entry.updatedAt = timestamp
      entry.version += 1
      appendEvent(state, context, {
        type: 'crm.pipeline-moved',
        aggregate: { type: 'speaker_pipeline', id: entry.id, version: entry.version },
        summary: `Moved a speaker prospect from ${previous} to ${stage}.`,
        data: { personId: entry.personId, from: previous, to: stage },
      })
      return { entry, changed: true }
    }

    case 'crm.pipeline.add-note': {
      const entry = findRequired(state.speakerPipeline, input.entryId, 'pipeline entry')
      const note: ContactNote = {
        id: createId('note'),
        personId: entry.personId,
        body: assertString(input.body, 'body'),
        createdBy: context.actor.name,
        createdAt: timestamp,
      }
      entry.notes.unshift(note)
      entry.updatedAt = timestamp
      entry.version += 1
      appendEvent(state, context, {
        type: 'crm.pipeline-note-added',
        aggregate: { type: 'speaker_pipeline', id: entry.id, version: entry.version },
        summary: 'Added a note to a speaker prospect.',
        data: { personId: entry.personId, noteId: note.id },
      })
      return { entry, note }
    }

    case 'crm.outreach.queue': {
      const personIds = [...new Set(assertStringArray(input.personIds, 'personIds'))]
      if (personIds.length < 1 || personIds.length > 500) {
        throw new OperationError('INVALID_INPUT', 'Choose between 1 and 500 contacts.')
      }
      const subject = assertString(input.subject, 'subject')
      const body = assertString(input.body, 'body')
      const people = personIds.map((personId) => findRequired(state.people, personId, 'person'))
      const messages = people.map((person) =>
        queueOutboundMessage(
          state,
          {
            campaignId: null,
            submissionId: null,
            kind: 'crm_outreach',
            trigger: 'crm.outreach.queue',
            recipientName: `${person.firstName} ${person.lastName}`,
            recipientEmail: person.email,
            subject: subject.replaceAll('{{first_name}}', person.firstName),
            body: body.replaceAll('{{first_name}}', person.firstName),
          },
          timestamp,
        ),
      )
      appendEvent(state, context, {
        type: 'crm.outreach-queued',
        aggregate: { type: 'workspace', id: state.workspace.id, version: state.revision + 1 },
        summary: `Queued outreach for ${messages.length} contact${messages.length === 1 ? '' : 's'}.`,
        data: { personIds, messageIds: messages.map((message) => message.id), subject },
      })
      return { messages, recipientCount: messages.length }
    }

    case 'person.import': {
      if (!Array.isArray(input.people) || input.people.length === 0 || input.people.length > 500) {
        throw new OperationError('INVALID_INPUT', 'people must contain between 1 and 500 rows.', {
          people: 'Choose a CSV with at least one speaker and no more than 500 rows.',
        })
      }
      const existingEmails = new Set(state.people.map((person) => person.email.toLowerCase()))
      const addToActiveEvent = input.addToActiveEvent !== false
      const imported: Array<{
        personId: string
        participationId: string | null
        email: string
      }> = []
      const skipped: string[] = []

      for (const [index, value] of input.people.entries()) {
        const record = assertRecord(value, `people.${index}`)
        const email = assertEmail(record.email, `people.${index}.email`)
        if (existingEmails.has(email)) {
          skipped.push(email)
          continue
        }
        existingEmails.add(email)
        const firstName = assertString(record.firstName, `people.${index}.firstName`)
        const lastName = assertString(record.lastName, `people.${index}.lastName`)
        const personId = createId('per')
        const participationId = addToActiveEvent ? createId('par') : null
        const person: Person = {
          id: personId,
          firstName,
          lastName,
          email,
          company: optionalString(record.company),
          title: optionalString(record.title),
          city: optionalString(record.city),
          timezone:
            typeof record.timezone === 'string' && record.timezone.trim().length > 0
              ? assertTimeZone(record.timezone, `people.${index}.timezone`)
              : state.workspace.timezone,
          bio: optionalString(record.bio),
          avatarUrl: `https://assets.ui.sh/avatars/${(state.people.length % 12) + 1}.webp`,
          tags: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        }
        const participation: Participation | null = participationId
          ? {
              id: participationId,
              eventId: state.activeEventId,
              personId,
              portalAccessKey: createId('portal'),
              roles: ['speaker'],
              status: 'prospect',
              sessionIds: [],
              internalNotes: '',
              publicTitle: person.title,
              publicCompany: person.company,
              confirmedAt: null,
              updatedAt: timestamp,
              version: 1,
            }
          : null
        state.people.push(person)
        if (participation) {
          state.participations.push(participation)
          for (const definition of state.requirementDefinitions.filter(
            (entry) => entry.eventId === state.activeEventId,
          )) {
            state.requirementInstances.push({
              id: createId('rqi'),
              definitionId: definition.id,
              participationId: participation.id,
              status: 'not_started',
              value: '',
              submittedAt: null,
              reviewedAt: null,
              updatedAt: timestamp,
              version: 1,
            })
          }
        }
        appendEvent(state, context, {
          type: 'person.created',
          aggregate: { type: 'person', id: personId, version: 1 },
          summary: `Imported ${firstName} ${lastName}.`,
          data: { participationId },
        })
        if (participation) {
          appendEvent(state, context, {
            type: 'participation.created',
            aggregate: { type: 'participation', id: participation.id, version: 1 },
            summary: `Added ${firstName} ${lastName} to the active event.`,
            data: { personId, roles: ['speaker'] },
          })
        }
        imported.push({ personId, participationId, email })
      }

      appendEvent(state, context, {
        type: 'people.imported',
        aggregate: { type: 'workspace', id: state.workspace.id, version: state.revision + 1 },
        summary: `Imported ${imported.length} people and skipped ${skipped.length} existing emails.`,
        data: { imported: imported.length, skipped: skipped.length },
      })
      return { imported, skipped }
    }

    case 'person.update': {
      const person = findRequired(state.people, input.personId, 'person')
      const editable = [
        'firstName',
        'lastName',
        'email',
        'company',
        'title',
        'city',
        'timezone',
        'bio',
      ] as const
      const changed: string[] = []
      for (const field of editable) {
        if (typeof input[field] === 'string' && input[field] !== person[field]) {
          const next =
            field === 'email'
              ? assertEmail(input[field])
              : field === 'timezone'
                ? assertTimeZone(input[field])
                : input[field].trim()
          if (
            field === 'email' &&
            state.people.some(
              (entry) => entry.id !== person.id && entry.email.toLowerCase() === next.toLowerCase(),
            )
          ) {
            throw new OperationError('DUPLICATE', 'A person with that email already exists.', {
              email: 'Use a different email address.',
            })
          }
          person[field] = next
          changed.push(field)
        }
      }
      if (input.tags !== undefined) {
        const tags = [
          ...new Set(
            assertStringArray(input.tags, 'tags')
              .map((tag) => tag.trim().toLowerCase())
              .filter(Boolean),
          ),
        ]
        if (tags.length > 20 || tags.some((tag) => tag.length > 40)) {
          throw new OperationError(
            'INVALID_INPUT',
            'A contact can have up to 20 tags, each no longer than 40 characters.',
          )
        }
        if (JSON.stringify(tags) !== JSON.stringify(person.tags)) {
          person.tags = tags
          changed.push('tags')
        }
      }
      if (changed.length === 0) return { person, changed }
      person.updatedAt = timestamp
      person.version += 1
      appendEvent(state, context, {
        type: 'person.updated',
        aggregate: { type: 'person', id: person.id, version: person.version },
        summary: `Updated ${person.firstName} ${person.lastName}.`,
        data: { changedFields: changed },
      })
      return { person, changed }
    }

    case 'asset.register': {
      const ownerType = assertOneOf(input.ownerType, 'ownerType', [
        'submission',
        'participation',
        'person',
        'requirement',
      ] as const)
      const ownerId = assertString(input.ownerId, 'ownerId')
      const kind = assertOneOf(input.kind, 'kind', [
        'headshot',
        'slides',
        'video',
        'supporting_document',
        'other',
      ] as const)
      const filename = assertString(input.filename, 'filename')
      const contentType = assertString(input.contentType, 'contentType')
      const storageKey = assertString(input.storageKey, 'storageKey')
      const sizeBytes = input.sizeBytes
      if (
        !Number.isInteger(sizeBytes) ||
        (sizeBytes as number) < 1 ||
        (sizeBytes as number) > 50_000_000
      ) {
        throw new OperationError('INVALID_INPUT', 'Asset size must be between 1 byte and 50 MB.', {
          sizeBytes: 'Choose a non-empty file smaller than 50 MB.',
        })
      }
      if (filename.length > 255 || contentType.length > 200 || storageKey.length > 1_000) {
        throw new OperationError('INVALID_INPUT', 'Asset metadata exceeds the supported size.')
      }
      const participant =
        context.actor.type === 'participant'
          ? findRequired(state.participations, context.actor.id, 'participation')
          : null
      if (participant) {
        const ownsPerson = ownerType === 'person' && ownerId === participant.personId
        const ownsParticipation = ownerType === 'participation' && ownerId === participant.id
        const requirement =
          ownerType === 'requirement'
            ? state.requirementInstances.find(
                (entry) => entry.id === ownerId && entry.participationId === participant.id,
              )
            : null
        const definition = requirement
          ? state.requirementDefinitions.find((entry) => entry.id === requirement.definitionId)
          : null
        const ownsFileRequirement = Boolean(requirement && definition?.kind === 'file')
        if (
          (!ownsPerson && !ownsParticipation && !ownsFileRequirement) ||
          (kind !== 'headshot' && !ownsFileRequirement)
        ) {
          throw new OperationError(
            'FORBIDDEN',
            'A speaker can only upload their own headshot or assigned deliverables.',
          )
        }
      }
      const ownerBelongsToEvent =
        ownerType === 'person'
          ? state.participations.some(
              (entry) => entry.eventId === state.activeEventId && entry.personId === ownerId,
            )
          : ownerType === 'participation'
            ? state.participations.some(
                (entry) => entry.eventId === state.activeEventId && entry.id === ownerId,
              )
            : ownerType === 'submission'
              ? state.submissions.some(
                  (entry) => entry.eventId === state.activeEventId && entry.id === ownerId,
                )
              : state.requirementInstances.some((instance) => {
                  if (instance.id !== ownerId) return false
                  const participation = state.participations.find(
                    (entry) => entry.id === instance.participationId,
                  )
                  return participation?.eventId === state.activeEventId
                })
      if (!ownerBelongsToEvent) {
        throw new OperationError('FORBIDDEN', 'The asset owner is outside the active event.')
      }
      const requirementInstance =
        ownerType === 'requirement'
          ? findRequired(state.requirementInstances, ownerId, 'requirement instance')
          : null
      const requirementDefinition = requirementInstance
        ? findRequired(
            state.requirementDefinitions,
            requirementInstance.definitionId,
            'requirement definition',
          )
        : null
      if (requirementDefinition?.kind === 'file') {
        const acceptedTypes = requirementDefinition.acceptedContentTypes ?? []
        if (acceptedTypes.length > 0 && !acceptedTypes.includes(contentType)) {
          throw new OperationError(
            'INVALID_INPUT',
            'This file type is not accepted for the task.',
            {
              contentType: `Accepted types: ${acceptedTypes.join(', ')}.`,
            },
          )
        }
        const maximum = requirementDefinition.maxSizeBytes ?? 50_000_000
        if ((sizeBytes as number) > maximum) {
          throw new OperationError('INVALID_INPUT', 'This file is larger than the task allows.', {
            sizeBytes: `Choose a file smaller than ${Math.round(maximum / 1_000_000)} MB.`,
          })
        }
      }
      const previousVersions = state.assets.filter(
        (entry) => entry.owner.type === ownerType && entry.owner.id === ownerId,
      )
      for (const entry of previousVersions) entry.isLatest = false
      const asset: Asset = {
        id: createId('ast'),
        eventId: state.activeEventId,
        owner: { type: ownerType, id: ownerId },
        kind,
        filename,
        contentType,
        sizeBytes: sizeBytes as number,
        storageKey,
        version: previousVersions.length + 1,
        isLatest: true,
        sessionId: requirementDefinition?.sessionId ?? null,
        uploadedBy: {
          type: context.actor.type === 'participant' ? 'participant' : 'staff',
          id: context.actor.id,
          name: context.actor.name,
        },
        createdAt: timestamp,
      }
      state.assets.push(asset)
      appendEvent(state, context, {
        type: 'asset.registered',
        aggregate: { type: 'asset', id: asset.id, version: 1 },
        summary: `Uploaded ${asset.filename}.`,
        data: { ownerType, ownerId, kind, sizeBytes: asset.sizeBytes },
      })
      if (kind === 'headshot' && ownerType === 'person') {
        const person = findRequired(state.people, ownerId, 'person')
        person.avatarUrl = `/public/v1/assets/${encodeURIComponent(asset.id)}`
        person.updatedAt = timestamp
        person.version += 1
        const participation = state.participations.find(
          (entry) => entry.eventId === state.activeEventId && entry.personId === person.id,
        )
        const definition = state.requirementDefinitions.find(
          (entry) =>
            entry.eventId === state.activeEventId && entry.systemKey === 'profile_headshot',
        )
        const instance =
          participation && definition
            ? state.requirementInstances.find(
                (entry) =>
                  entry.participationId === participation.id &&
                  entry.definitionId === definition.id,
              )
            : null
        if (instance && definition && instance.status !== 'approved') {
          const previous = instance.status
          instance.status = 'approved'
          instance.value = asset.id
          instance.submittedAt = timestamp
          instance.reviewedAt = timestamp
          instance.updatedAt = timestamp
          instance.version += 1
          appendEvent(state, context, {
            type: 'requirement.status-changed',
            aggregate: { type: 'requirementInstance', id: instance.id, version: instance.version },
            summary: `${person.firstName} ${person.lastName} completed ${definition.label}.`,
            data: { participationId: participation?.id, previous, next: 'approved' },
          })
        }
      }
      if (requirementInstance && requirementDefinition) {
        const previous = requirementInstance.status
        requirementInstance.status = 'submitted'
        requirementInstance.value = asset.id
        requirementInstance.submittedAt = timestamp
        requirementInstance.reviewedAt = null
        requirementInstance.updatedAt = timestamp
        requirementInstance.version += 1
        appendEvent(state, context, {
          type: 'requirement.status-changed',
          aggregate: {
            type: 'requirement',
            id: requirementInstance.id,
            version: requirementInstance.version,
          },
          summary: `${requirementDefinition.label} was submitted for review.`,
          data: {
            participationId: requirementInstance.participationId,
            previous,
            next: 'submitted',
            assetId: asset.id,
          },
        })
      }
      return { asset }
    }

    case 'asset.comment': {
      const asset = findRequired(state.assets, input.assetId, 'asset')
      if (asset.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The file is outside the active event.')
      }
      if (context.actor.type === 'participant') {
        if (asset.owner.type !== 'requirement') {
          throw new OperationError('FORBIDDEN', 'Comments are only available on assigned files.')
        }
        const instance = findRequired(state.requirementInstances, asset.owner.id, 'requirement')
        if (instance.participationId !== context.actor.id) {
          throw new OperationError('FORBIDDEN', 'A speaker can only comment on their own files.')
        }
      }
      const body = assertString(input.body, 'body')
      if (body.length > 2_000) {
        throw new OperationError('INVALID_INPUT', 'Comments must be 2,000 characters or fewer.', {
          body: 'Shorten this comment.',
        })
      }
      const comment: AssetComment = {
        id: createId('acm'),
        eventId: state.activeEventId,
        assetId: asset.id,
        body,
        author: {
          type: context.actor.type === 'participant' ? 'participant' : 'staff',
          id: context.actor.id,
          name: context.actor.name,
        },
        createdAt: timestamp,
      }
      state.assetComments.push(comment)
      appendEvent(state, context, {
        type: 'asset.commented',
        aggregate: { type: 'asset', id: asset.id, version: asset.version ?? 1 },
        summary: `Commented on ${asset.filename}.`,
        data: { assetId: asset.id, commentId: comment.id },
      })
      return { comment }
    }

    case 'participation.set-status': {
      const participation = findRequired(
        state.participations,
        input.participationId,
        'participation',
      )
      if (context.actor.type === 'participant' && context.actor.id !== participation.id) {
        throw new OperationError(
          'FORBIDDEN',
          'A participant can only update their own participation.',
        )
      }
      const nextStatus = assertOneOf(input.status, 'status', [
        'prospect',
        'invited',
        'confirmed',
        'declined',
        'withdrawn',
      ] as const)
      if (context.actor.type === 'participant') {
        const participantTransitions: Partial<Record<ParticipationStatus, ParticipationStatus[]>> =
          {
            invited: ['confirmed', 'declined'],
            confirmed: ['withdrawn'],
          }
        if (
          nextStatus !== participation.status &&
          !participantTransitions[participation.status]?.includes(nextStatus)
        ) {
          throw new OperationError(
            'FORBIDDEN',
            'A participant cannot perform that participation transition.',
          )
        }
      }
      const allowedTransitions: Record<ParticipationStatus, ParticipationStatus[]> = {
        prospect: ['invited', 'confirmed', 'withdrawn'],
        invited: ['confirmed', 'declined', 'withdrawn'],
        confirmed: ['withdrawn'],
        declined: ['invited'],
        withdrawn: ['invited'],
      }
      if (
        nextStatus !== participation.status &&
        !allowedTransitions[participation.status].includes(nextStatus)
      ) {
        throw new OperationError(
          'INVALID_TRANSITION',
          `Cannot move participation from ${participation.status} to ${nextStatus}.`,
        )
      }
      const previous = participation.status
      participation.status = nextStatus
      participation.confirmedAt = nextStatus === 'confirmed' ? timestamp : null
      participation.updatedAt = timestamp
      participation.version += 1
      if (nextStatus === 'confirmed') {
        const confirmation = state.requirementInstances.find((instance) => {
          if (instance.participationId !== participation.id) return false
          const definition = state.requirementDefinitions.find(
            (entry) => entry.id === instance.definitionId,
          )
          return definition?.systemKey === 'participation_confirmation'
        })
        if (confirmation) {
          confirmation.status = 'approved'
          confirmation.submittedAt = timestamp
          confirmation.reviewedAt = timestamp
          confirmation.updatedAt = timestamp
          confirmation.version += 1
        }
      }
      appendEvent(state, context, {
        type: 'participation.status-changed',
        aggregate: {
          type: 'participation',
          id: participation.id,
          version: participation.version,
        },
        summary: `Changed participation from ${previous} to ${nextStatus}.`,
        data: { previous, next: nextStatus },
      })
      return { participation }
    }

    case 'participation.update-logistics': {
      const participation = findRequired(
        state.participations,
        input.participationId,
        'participation',
      )
      if (participation.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'Logistics can only be updated in the active event.')
      }
      if (context.actor.type === 'participant' || context.actor.type === 'reviewer') {
        throw new OperationError('FORBIDDEN', 'Private logistics notes are organizer-only.')
      }
      const internalNotes = optionalString(input.internalNotes)
      if (internalNotes.length > 10_000) {
        throw new OperationError(
          'INVALID_INPUT',
          'Logistics notes must be 10,000 characters or fewer.',
          {
            internalNotes: 'Shorten these notes before saving.',
          },
        )
      }
      const changed = participation.internalNotes !== internalNotes
      if (changed) {
        participation.internalNotes = internalNotes
        participation.updatedAt = timestamp
        participation.version += 1
        appendEvent(state, context, {
          type: 'participation.logistics-updated',
          aggregate: {
            type: 'participation',
            id: participation.id,
            version: participation.version,
          },
          summary: 'Updated private speaker logistics.',
          data: { changed: true },
        })
      }
      return { participation, changed }
    }

    case 'requirement.create': {
      const label = assertString(input.label, 'label')
      const description = optionalString(input.description)
      const dueAt = assertString(input.dueAt, 'dueAt')
      if (Number.isNaN(new Date(dueAt).getTime())) {
        throw new OperationError('INVALID_INPUT', 'dueAt must be a valid date and time.', {
          dueAt: 'Choose a valid due date.',
        })
      }
      const participationIds = [
        ...new Set(assertStringArray(input.participationIds, 'participationIds')),
      ]
      if (participationIds.length === 0) {
        throw new OperationError('INVALID_INPUT', 'Choose at least one participant.', {
          participationIds: 'Select one or more people.',
        })
      }
      const participations = participationIds.map((participationId) => {
        const participation = findRequired(state.participations, participationId, 'participation')
        if (participation.eventId !== state.activeEventId) {
          throw new OperationError(
            'FORBIDDEN',
            'Tasks can only be assigned within the active event.',
          )
        }
        return participation
      })
      const kind = input.kind === 'file' ? ('file' as const) : ('confirmation' as const)
      const sessionId =
        typeof input.sessionId === 'string' && input.sessionId.length > 0
          ? findRequired(state.sessions, input.sessionId, 'session').id
          : null
      if (
        sessionId &&
        !participations.every((participation) => participation.sessionIds.includes(sessionId))
      ) {
        throw new OperationError(
          'INVALID_INPUT',
          'A session-scoped task can only be assigned to speakers on that session.',
          { sessionId: 'Choose a session shared by every selected speaker.' },
        )
      }
      const acceptedContentTypes =
        kind === 'file'
          ? input.acceptedContentTypes === undefined
            ? [
                'application/pdf',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              ]
            : assertStringArray(input.acceptedContentTypes, 'acceptedContentTypes')
          : []
      const maximumInput = input.maxSizeBytes
      const maxSizeBytes =
        kind === 'file'
          ? maximumInput === undefined
            ? 50_000_000
            : Number.isInteger(maximumInput) &&
                (maximumInput as number) >= 1_000_000 &&
                (maximumInput as number) <= 50_000_000
              ? (maximumInput as number)
              : (() => {
                  throw new OperationError(
                    'INVALID_INPUT',
                    'File tasks must allow between 1 MB and 50 MB.',
                    { maxSizeBytes: 'Choose a limit from 1 MB to 50 MB.' },
                  )
                })()
          : null
      const definition = {
        id: createId('req'),
        eventId: state.activeEventId,
        label,
        description,
        kind,
        systemKey: null,
        selfCompletable: kind !== 'file',
        sessionId,
        acceptedContentTypes,
        maxSizeBytes,
        dueAt: new Date(dueAt).toISOString(),
        required: input.required !== false,
        automaticReminders: input.automaticReminders !== false,
      }
      const instances = participations.map((participation) => ({
        id: createId('rqi'),
        definitionId: definition.id,
        participationId: participation.id,
        status: 'not_started' as const,
        value: '',
        submittedAt: null,
        reviewedAt: null,
        updatedAt: timestamp,
        version: 1,
      }))
      state.requirementDefinitions.push(definition)
      state.requirementInstances.push(...instances)
      appendEvent(state, context, {
        type: 'requirement.created',
        aggregate: { type: 'requirement-definition', id: definition.id, version: 1 },
        summary: `Created task “${label}” for ${instances.length} ${instances.length === 1 ? 'person' : 'people'}.`,
        data: { participationIds, dueAt: definition.dueAt },
      })
      for (const instance of instances) {
        appendEvent(state, context, {
          type: 'requirement.assigned',
          aggregate: { type: 'requirement', id: instance.id, version: 1 },
          summary: `Assigned “${label}”.`,
          data: { participationId: instance.participationId, definitionId: definition.id },
        })
      }
      return { requirementDefinition: definition, requirementInstances: instances }
    }

    case 'requirement.process-reminders': {
      if (context.actor.type !== 'system' && context.actor.type !== 'service') {
        throw new OperationError('FORBIDDEN', 'Only the reminder scheduler can run this job.')
      }
      const at = assertString(input.at, 'at')
      if (Number.isNaN(Date.parse(at))) {
        throw new OperationError('INVALID_INPUT', 'at must be a valid date and time.')
      }
      const event = findRequired(state.events, state.activeEventId, 'active event')
      const queued = dueRequirementReminders(state, at).map(
        ({ instance, definition, participation, window }) => {
          const person = findRequired(state.people, participation.personId, 'person')
          const dueDate = new Intl.DateTimeFormat('en-US', {
            dateStyle: 'long',
            timeZone: event.timezone,
          }).format(new Date(definition.dueAt))
          const timing = requirementReminderSummary(definition, at)
          const portalPath = `/portal/${encodeURIComponent(participation.id)}/${encodeURIComponent(participation.portalAccessKey)}?event=${encodeURIComponent(event.id)}`
          const message = queueOutboundMessage(
            state,
            {
              campaignId: null,
              submissionId: null,
              kind: 'requirement_reminder',
              trigger: requirementReminderTrigger(instance.id, window),
              recipientName: `${person.firstName} ${person.lastName}`,
              recipientEmail: person.email,
              subject: `Reminder: ${definition.label} is ${timing}`,
              body: `Hi ${person.firstName},\n\nThis is an automatic reminder that “${definition.label}” is ${timing} for ${event.name}. The due date is ${dueDate}.\n\nOpen your speaker portal to complete it:\n${portalPath}`,
            },
            timestamp,
          )
          appendEvent(state, context, {
            type: 'requirement.reminder-queued',
            aggregate: { type: 'requirement', id: instance.id, version: instance.version },
            summary: `Queued an automatic reminder for “${definition.label}”.`,
            data: {
              requirementInstanceId: instance.id,
              participationId: participation.id,
              dueAt: definition.dueAt,
              window: window.key,
              messageId: message.id,
            },
          })
          return message
        },
      )
      return { messages: queued, queuedCount: queued.length, processedAt: at }
    }

    case 'requirement.set-status': {
      const instance = findRequired(
        state.requirementInstances,
        input.requirementInstanceId,
        'requirement instance',
      )
      if (context.actor.type === 'participant' && context.actor.id !== instance.participationId) {
        throw new OperationError(
          'FORBIDDEN',
          'A participant can only update their own requirements.',
        )
      }
      const nextStatus = assertOneOf(input.status, 'status', [
        'not_started',
        'submitted',
        'revision_requested',
        'approved',
        'waived',
      ] as const)
      const previous = instance.status
      const definition = findRequired(
        state.requirementDefinitions,
        instance.definitionId,
        'requirement definition',
      )
      if (context.actor.type === 'participant') {
        const incomplete = previous === 'not_started' || previous === 'revision_requested'
        const participantCanComplete =
          definition.selfCompletable && nextStatus === 'approved' && incomplete
        const participantCanSubmit =
          !definition.selfCompletable && nextStatus === 'submitted' && incomplete
        if (!participantCanComplete && !participantCanSubmit) {
          throw new OperationError(
            'FORBIDDEN',
            'Participants can complete action tasks or submit their own incomplete requirements; review decisions require staff.',
          )
        }
      }
      instance.status = nextStatus as RequirementStatus
      if (typeof input.value === 'string') instance.value = input.value.trim()
      // `submittedAt` is the time of the latest handoff, not the first attempt. The
      // domain event stream preserves earlier submissions while the operational UI
      // can accurately show when a requested revision came back.
      if (nextStatus === 'submitted') instance.submittedAt = timestamp
      if (nextStatus === 'approved' || nextStatus === 'waived') instance.reviewedAt = timestamp
      instance.updatedAt = timestamp
      instance.version += 1
      appendEvent(state, context, {
        type: 'requirement.status-changed',
        aggregate: { type: 'requirement', id: instance.id, version: instance.version },
        summary: `${definition?.label ?? 'Requirement'} changed from ${previous} to ${nextStatus}.`,
        data: { participationId: instance.participationId, previous, next: nextStatus },
      })
      appendEvent(state, context, {
        type: 'participation.readiness-changed',
        aggregate: { type: 'participation', id: instance.participationId, version: 1 },
        summary: 'Participant readiness was recalculated.',
        data: { requirementInstanceId: instance.id },
      })
      return { requirementInstance: instance }
    }

    case 'portal.update-profile': {
      const participation = findRequired(
        state.participations,
        input.participationId,
        'participation',
      )
      if (context.actor.type !== 'participant' || context.actor.id !== participation.id) {
        throw new OperationError(
          'FORBIDDEN',
          'This operation requires the matching participant session.',
        )
      }
      const person = findRequired(state.people, participation.personId, 'person')
      const changed: string[] = []
      if (
        typeof input.publicTitle === 'string' &&
        input.publicTitle.trim() !== participation.publicTitle
      ) {
        participation.publicTitle = input.publicTitle.trim()
        changed.push('publicTitle')
      }
      if (
        typeof input.publicCompany === 'string' &&
        input.publicCompany.trim() !== participation.publicCompany
      ) {
        participation.publicCompany = input.publicCompany.trim()
        changed.push('publicCompany')
      }
      if (typeof input.bio === 'string' && input.bio.trim() !== person.bio) {
        person.bio = input.bio.trim()
        changed.push('bio')
      }
      if (typeof input.bio === 'string') {
        const bioDefinition = state.requirementDefinitions.find(
          (entry) => entry.eventId === participation.eventId && entry.systemKey === 'profile_bio',
        )
        const bioRequirement = bioDefinition
          ? state.requirementInstances.find(
              (entry) =>
                entry.definitionId === bioDefinition.id &&
                entry.participationId === participation.id,
            )
          : null
        const nextBioStatus = input.bio.trim().length > 0 ? 'approved' : 'not_started'
        if (bioRequirement && bioRequirement.status !== nextBioStatus) {
          const previous = bioRequirement.status
          bioRequirement.status = nextBioStatus
          bioRequirement.value = input.bio.trim()
          bioRequirement.submittedAt = nextBioStatus === 'approved' ? timestamp : null
          bioRequirement.reviewedAt = nextBioStatus === 'approved' ? timestamp : null
          bioRequirement.updatedAt = timestamp
          bioRequirement.version += 1
          appendEvent(state, context, {
            type: 'requirement.status-changed',
            aggregate: {
              type: 'requirement',
              id: bioRequirement.id,
              version: bioRequirement.version,
            },
            summary: `Speaker bio changed from ${previous} to ${nextBioStatus}.`,
            data: { participationId: participation.id, previous, next: nextBioStatus },
          })
          appendEvent(state, context, {
            type: 'participation.readiness-changed',
            aggregate: { type: 'participation', id: participation.id, version: 1 },
            summary: 'Participant readiness was recalculated.',
            data: { requirementInstanceId: bioRequirement.id },
          })
        }
      }
      if (changed.length > 0) {
        participation.updatedAt = timestamp
        participation.version += 1
        person.updatedAt = timestamp
        person.version += 1
        appendEvent(state, context, {
          type: 'participant.profile-updated',
          aggregate: {
            type: 'participation',
            id: participation.id,
            version: participation.version,
          },
          summary: `Updated the public profile for ${person.firstName} ${person.lastName}.`,
          data: { changedFields: changed },
        })
      }
      return { person, participation, changed }
    }

    case 'schedule.place-session': {
      const session = findRequired(state.sessions, input.sessionId, 'session')
      const room = findRequired(state.rooms, input.roomId, 'room')
      if (session.eventId !== state.activeEventId || room.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'The session and room must belong to this event.')
      }
      if (session.status === 'cancelled') {
        throw new OperationError('INVALID_INPUT', 'A cancelled session cannot be scheduled.')
      }
      if (
        state.placements.some(
          (entry) => entry.eventId === state.activeEventId && entry.sessionId === session.id,
        )
      ) {
        throw new OperationError('DUPLICATE', 'This session is already on the schedule.')
      }
      const startsAt = assertString(input.startsAt, 'startsAt')
      if (Number.isNaN(new Date(startsAt).getTime())) {
        throw new OperationError('INVALID_INPUT', 'startsAt must be an ISO date and time.')
      }
      const placement = {
        id: createId('plc'),
        eventId: state.activeEventId,
        sessionId: session.id,
        roomId: room.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: addMinutes(new Date(startsAt).toISOString(), session.durationMinutes),
        scheduleVersion: 0,
        published: false,
        version: 1,
      }
      state.placements.push(placement)
      const conflicts = scheduleConflicts(state).filter((conflict) =>
        conflict.placementIds.includes(placement.id),
      )
      const blocking = conflicts.find(
        (conflict) => conflict.severity === 'error' && conflict.type !== 'person_overlap',
      )
      if (blocking) {
        throw new OperationError(
          blocking.type === 'room_overlap' ? 'ROOM_CONFLICT' : 'SCHEDULE_CONFLICT',
          blocking.message,
        )
      }
      appendEvent(state, context, {
        type: 'schedule.session-placed',
        aggregate: { type: 'placement', id: placement.id, version: placement.version },
        summary: `Placed ${session.title} in ${room.name}.`,
        data: { sessionId: session.id, roomId: room.id, startsAt: placement.startsAt },
      })
      return { placement, conflicts }
    }

    case 'schedule.move-session': {
      const placement = findRequired(state.placements, input.placementId, 'placement')
      const room = findRequired(state.rooms, input.roomId, 'room')
      const session = findRequired(state.sessions, placement.sessionId, 'session')
      if (
        placement.eventId !== state.activeEventId ||
        room.eventId !== state.activeEventId ||
        session.eventId !== state.activeEventId
      ) {
        throw new OperationError(
          'FORBIDDEN',
          'The placement, session, and room must belong to the active event.',
        )
      }
      const startsAt = assertString(input.startsAt, 'startsAt')
      if (Number.isNaN(new Date(startsAt).getTime())) {
        throw new OperationError('INVALID_INPUT', 'startsAt must be an ISO date and time.')
      }
      const previous = { roomId: placement.roomId, startsAt: placement.startsAt }
      placement.roomId = room.id
      placement.startsAt = new Date(startsAt).toISOString()
      placement.endsAt = addMinutes(placement.startsAt, session.durationMinutes)
      placement.published = false
      placement.version += 1
      const conflicts = scheduleConflicts(state).filter((conflict) =>
        conflict.placementIds.includes(placement.id),
      )
      const blocking = conflicts.find(
        (conflict) => conflict.severity === 'error' && conflict.type !== 'person_overlap',
      )
      if (blocking) {
        throw new OperationError(
          blocking.type === 'room_overlap' ? 'ROOM_CONFLICT' : 'SCHEDULE_CONFLICT',
          blocking.message,
        )
      }
      appendEvent(state, context, {
        type: 'schedule.session-moved',
        aggregate: { type: 'placement', id: placement.id, version: placement.version },
        summary: `Moved ${session.title} to ${room.name}.`,
        data: { previous, next: { roomId: room.id, startsAt: placement.startsAt } },
      })
      return { placement, conflicts }
    }

    case 'schedule.auto-place': {
      const event = findRequired(state.events, state.activeEventId, 'event')
      const rooms = state.rooms
        .filter((room) => room.eventId === state.activeEventId)
        .sort((left, right) => right.capacity - left.capacity)
      if (rooms.length === 0) {
        throw new OperationError('INVALID_INPUT', 'Add at least one room before auto-scheduling.')
      }
      const placedSessionIds = new Set(
        state.placements
          .filter((placement) => placement.eventId === state.activeEventId)
          .map((placement) => placement.sessionId),
      )
      const unscheduled = state.sessions.filter(
        (session) =>
          session.eventId === state.activeEventId &&
          session.status !== 'cancelled' &&
          !placedSessionIds.has(session.id),
      )
      const placed = []
      const unplaced: string[] = []
      const eventEnd = Date.parse(event.endsAt)
      for (const session of unscheduled) {
        let placement = null
        for (
          let candidateStart = Date.parse(event.startsAt);
          candidateStart + session.durationMinutes * 60_000 <= eventEnd;
          candidateStart += 30 * 60_000
        ) {
          for (const room of rooms) {
            const candidate = {
              id: createId('plc'),
              eventId: state.activeEventId,
              sessionId: session.id,
              roomId: room.id,
              startsAt: new Date(candidateStart).toISOString(),
              endsAt: addMinutes(new Date(candidateStart).toISOString(), session.durationMinutes),
              scheduleVersion: 0,
              published: false,
              version: 1,
            }
            state.placements.push(candidate)
            const hasHardConflict = scheduleConflicts(state).some(
              (conflict) =>
                conflict.severity === 'error' && conflict.placementIds.includes(candidate.id),
            )
            if (!hasHardConflict) {
              placement = candidate
              break
            }
            state.placements.pop()
          }
          if (placement) break
        }
        if (placement) placed.push(placement)
        else unplaced.push(session.id)
      }
      appendEvent(state, context, {
        type: 'schedule.sessions-auto-placed',
        aggregate: { type: 'event', id: event.id, version: event.version },
        summary: `Auto-placed ${placed.length} session${placed.length === 1 ? '' : 's'}.`,
        data: {
          placementIds: placed.map((placement) => placement.id),
          unplacedSessionIds: unplaced,
        },
      })
      return { placements: placed, unplacedSessionIds: unplaced }
    }

    case 'schedule.publish': {
      const approvedSessionIds = new Set(
        state.sessions
          .filter(
            (session) => session.eventId === state.activeEventId && session.status === 'ready',
          )
          .map((session) => session.id),
      )
      const approvedPlacementIds = new Set(
        state.placements
          .filter(
            (placement) =>
              placement.eventId === state.activeEventId &&
              approvedSessionIds.has(placement.sessionId),
          )
          .map((placement) => placement.id),
      )
      if (approvedPlacementIds.size === 0) {
        throw new OperationError(
          'INVALID_INPUT',
          'Approve and schedule at least one session before publishing.',
        )
      }
      const conflicts = scheduleConflicts(state).filter((conflict) =>
        conflict.placementIds.every((placementId) => approvedPlacementIds.has(placementId)),
      )
      const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error')
      if (hardConflicts.length > 0) {
        throw new OperationError(
          'SCHEDULE_CONFLICTS',
          `Resolve ${hardConflicts.length} schedule conflict${hardConflicts.length === 1 ? '' : 's'} before publishing.`,
        )
      }
      const event = findRequired(state.events, state.activeEventId, 'event')
      const existingReleases = (state.scheduleReleases ?? []).filter(
        (release) => release.eventId === event.id,
      )
      const version =
        Math.max(
          event.publishedScheduleVersion ?? 0,
          ...existingReleases.map((release) => release.version),
        ) + 1
      const draftPlacements = state.placements.filter(
        (entry) => entry.eventId === event.id && approvedSessionIds.has(entry.sessionId),
      )
      const release = {
        id: createId('sch'),
        eventId: event.id,
        version,
        publishedAt: timestamp,
        publishedBy: {
          type: context.actor.type,
          id: context.actor.id,
          name: context.actor.name,
        },
        placements: cloneState(draftPlacements).map((placement) => ({
          ...placement,
          scheduleVersion: version,
          published: true,
        })),
      }
      state.scheduleReleases ??= []
      state.scheduleReleases.push(release)
      event.publishedScheduleVersion = version
      event.version = (event.version ?? 1) + 1
      for (const placement of draftPlacements) {
        placement.scheduleVersion = version
        placement.published = true
        placement.version += 1
      }
      appendEvent(state, context, {
        type: 'schedule.published',
        aggregate: { type: 'schedule-release', id: release.id, version },
        summary: `Published schedule version ${version}.`,
        data: {
          releaseId: release.id,
          version,
          placements: release.placements.length,
          warnings: conflicts.length,
        },
      })
      return { release, version, warnings: conflicts }
    }

    case 'campaign.send-portal-invite': {
      const participation = findRequired(
        state.participations,
        input.participationId,
        'participation',
      )
      if (participation.eventId !== state.activeEventId) {
        throw new OperationError('FORBIDDEN', 'That speaker belongs to another event.')
      }
      const person = findRequired(state.people, participation.personId, 'person')
      const event = findRequired(state.events, state.activeEventId, 'event')
      if (!participation.portalAccessKey) {
        throw new OperationError('INVALID_INPUT', 'This speaker does not have a portal yet.')
      }
      const portalPath = `/portal/${encodeURIComponent(participation.id)}/${encodeURIComponent(participation.portalAccessKey)}?event=${encodeURIComponent(event.id)}`
      const campaign: Campaign = {
        id: createId('cam'),
        eventId: state.activeEventId,
        name: `Portal invitation: ${person.firstName} ${person.lastName}`,
        subject: `Your ${event.name} speaker portal`,
        body: `Hi ${person.firstName},\n\nYour speaker portal is ready. Use this private link to confirm your participation, update your profile, and complete your tasks:\n\n${portalPath}\n\nPlease keep this link private.`,
        audience: 'custom',
        recipientParticipationIds: [participation.id],
        includeCalendarInvite: false,
        status: 'sent',
        createdAt: timestamp,
        approvedAt: timestamp,
        sentAt: timestamp,
        createdBy: context.actor.name,
        version: 1,
      }
      state.campaigns.unshift(campaign)
      const preview = campaignPreview(state, campaign, participation.id)
      if (!preview) {
        throw new OperationError('INVALID_INPUT', 'This speaker cannot receive email.')
      }
      const message = queueOutboundMessage(
        state,
        {
          campaignId: campaign.id,
          submissionId: null,
          kind: 'campaign',
          trigger: 'campaign.send-portal-invite',
          recipientName: preview.recipientName,
          recipientEmail: preview.recipientEmail,
          subject: preview.subject,
          body: preview.body,
          calendarAttachment: null,
        },
        timestamp,
      )
      appendEvent(state, context, {
        type: 'campaign.sent',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Queued a speaker portal invitation for ${person.firstName} ${person.lastName}.`,
        data: {
          recipientCount: 1,
          messageIds: [message.id],
          deliveryMode: 'durable-outbox',
        },
      })
      return { campaign, messages: [message] }
    }

    case 'campaign.create-draft': {
      const audience = assertOneOf(input.audience, 'audience', [
        'all_active',
        'unconfirmed',
        'missing_requirements',
        'custom',
      ] as const)
      const name = assertString(input.name, 'name')
      const subject = assertString(input.subject, 'subject')
      const body = assertString(input.body, 'body')
      if (name.length > 200 || subject.length > 300 || body.length > 100_000) {
        throw new OperationError(
          'INVALID_INPUT',
          'Campaign name, subject, or body exceeds the supported size.',
        )
      }
      const campaign: Campaign = {
        id: createId('cam'),
        eventId: state.activeEventId,
        name,
        subject,
        body,
        audience,
        recipientParticipationIds:
          audience === 'custom'
            ? assertStringArray(input.recipientParticipationIds ?? [], 'recipientParticipationIds')
            : [],
        includeCalendarInvite: input.includeCalendarInvite === true,
        status: 'draft',
        createdAt: timestamp,
        approvedAt: null,
        sentAt: null,
        createdBy: context.actor.name,
        version: 1,
      }
      campaign.recipientParticipationIds = audienceForCampaign(state, campaign)
      state.campaigns.unshift(campaign)
      appendEvent(state, context, {
        type: 'campaign.drafted',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Drafted ${campaign.name} for ${campaign.recipientParticipationIds.length} recipients.`,
        data: { audience, recipientCount: campaign.recipientParticipationIds.length },
      })
      return { campaign }
    }

    case 'campaign.submit': {
      const campaign = findRequired(state.campaigns, input.campaignId, 'campaign')
      if (campaign.status !== 'draft') {
        throw new OperationError('INVALID_TRANSITION', 'Only a draft campaign can be submitted.')
      }
      campaign.recipientParticipationIds = audienceForCampaign(state, campaign)
      campaign.status = 'awaiting_approval'
      campaign.version += 1
      appendEvent(state, context, {
        type: 'campaign.submitted',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Submitted ${campaign.name} for approval.`,
        data: { recipientCount: campaign.recipientParticipationIds.length },
      })
      return { campaign }
    }

    case 'campaign.approve': {
      const campaign = findRequired(state.campaigns, input.campaignId, 'campaign')
      if (campaign.status !== 'awaiting_approval') {
        throw new OperationError('INVALID_TRANSITION', 'Only a submitted campaign can be approved.')
      }
      campaign.status = 'approved'
      campaign.approvedAt = timestamp
      campaign.version += 1
      appendEvent(state, context, {
        type: 'campaign.approved',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Approved ${campaign.name}.`,
        data: { recipientCount: campaign.recipientParticipationIds.length },
      })
      return { campaign }
    }

    case 'campaign.send': {
      const campaign = findRequired(state.campaigns, input.campaignId, 'campaign')
      if (campaign.status !== 'approved') {
        throw new OperationError('INVALID_TRANSITION', 'Only an approved campaign can be sent.')
      }
      campaign.status = 'sent'
      campaign.sentAt = timestamp
      campaign.version += 1
      const messages = campaign.recipientParticipationIds
        .map((participationId) => {
          const preview = campaignPreview(state, campaign, participationId)
          if (!preview) return null
          return queueOutboundMessage(
            state,
            {
              campaignId: campaign.id,
              submissionId: null,
              kind: 'campaign',
              trigger: 'campaign.send',
              recipientName: preview.recipientName,
              recipientEmail: preview.recipientEmail,
              subject: preview.subject,
              body: preview.body,
              calendarAttachment: campaign.includeCalendarInvite
                ? calendarAttachmentForParticipation(state, participationId)
                : null,
            },
            timestamp,
          )
        })
        .filter((message): message is OutboundMessage => Boolean(message))
      appendEvent(state, context, {
        type: 'campaign.sent',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Queued ${campaign.name} for ${campaign.recipientParticipationIds.length} recipients.`,
        data: {
          recipientCount: campaign.recipientParticipationIds.length,
          messageIds: messages.map((message) => message.id),
          calendarInviteCount: messages.filter((message) => message.calendarAttachment).length,
          deliveryMode: 'durable-outbox',
        },
      })
      return { campaign, messages }
    }

    case 'change-set.create': {
      const title = assertString(input.title, 'title')
      if (!Array.isArray(input.operations) || input.operations.length === 0) {
        throw new OperationError('INVALID_INPUT', 'operations must contain at least one operation.')
      }
      const operations = input.operations as ChangeOperation[]
      const validationState = cloneState(state)
      for (const item of operations) {
        const nestedDefinition =
          item && typeof item.operation === 'string'
            ? operationDefinition(item.operation)
            : undefined
        if (!nestedDefinition || item.operation.startsWith('change-set.')) {
          throw new OperationError('INVALID_INPUT', 'A change-set operation is invalid.')
        }
        if (!item.input || typeof item.input !== 'object') {
          throw new OperationError('INVALID_INPUT', 'Every change-set operation needs input.')
        }
        assertRequiredInput(nestedDefinition, item.input)
        assertScopes(context.actor, nestedDefinition.scopes)
        if (context.actor.type === 'agent' && nestedDefinition.agentPolicy === 'denied') {
          throw new OperationError(
            'AGENT_POLICY_DENIED',
            `${item.operation} cannot be proposed by an agent.`,
          )
        }
        assertExpectedVersions(validationState, item.expectedVersions)
        applyHandler(validationState, item.operation, item.input, {
          actor: context.actor,
          operation: item.operation,
          emittedEventIds: [],
        })
      }
      const changeSet: ChangeSet = {
        id: createId('chg'),
        eventId: state.activeEventId,
        title,
        description: typeof input.description === 'string' ? input.description.trim() : '',
        origin:
          context.actor.type === 'agent' ? 'agent' : input.origin === 'import' ? 'import' : 'human',
        operations: structuredClone(operations),
        status: 'awaiting_approval',
        impactSummary: operations.map(
          (item) => operationDefinition(item.operation)?.title ?? item.operation,
        ),
        warnings: [],
        createdBy: context.actor.name,
        approvedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        committedEventIds: [],
        version: 1,
      }
      state.changeSets.unshift(changeSet)
      appendEvent(state, context, {
        type: 'change-set.created',
        aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
        summary: `Created proposal “${changeSet.title}”.`,
        data: { operations: operations.length, origin: changeSet.origin },
      })
      return { changeSet }
    }

    case 'change-set.approve': {
      const changeSet = findRequired(state.changeSets, input.changeSetId, 'change set')
      if (changeSet.status !== 'awaiting_approval') {
        throw new OperationError('INVALID_TRANSITION', 'This proposal is not awaiting approval.')
      }
      changeSet.status = 'approved'
      changeSet.approvedBy = context.actor.name
      changeSet.updatedAt = timestamp
      changeSet.version += 1
      appendEvent(state, context, {
        type: 'change-set.approved',
        aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
        summary: `Approved proposal “${changeSet.title}”.`,
        data: { operations: changeSet.operations.length },
      })
      return { changeSet }
    }

    case 'change-set.reject': {
      const changeSet = findRequired(state.changeSets, input.changeSetId, 'change set')
      if (changeSet.status !== 'awaiting_approval' && changeSet.status !== 'approved') {
        throw new OperationError('INVALID_TRANSITION', 'This proposal can no longer be rejected.')
      }
      changeSet.status = 'rejected'
      changeSet.updatedAt = timestamp
      changeSet.version += 1
      appendEvent(state, context, {
        type: 'change-set.rejected',
        aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
        summary: `Rejected proposal “${changeSet.title}”.`,
        data: {},
      })
      return { changeSet }
    }

    case 'change-set.commit': {
      const changeSet = findRequired(state.changeSets, input.changeSetId, 'change set')
      if (changeSet.status !== 'approved') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Approve this proposal before committing it.',
        )
      }
      const resolvedOperations = changeSet.operations.map((item) => {
        if (item.operation.startsWith('change-set.')) {
          throw new OperationError(
            'INVALID_INPUT',
            'Change sets cannot contain change-set operations.',
          )
        }
        const nestedDefinition = operationDefinition(item.operation)
        if (!nestedDefinition) {
          throw new OperationError('UNKNOWN_OPERATION', `Unknown operation: ${item.operation}.`)
        }
        assertRequiredInput(nestedDefinition, item.input)
        assertScopes(context.actor, nestedDefinition.scopes)
        return { item, nestedDefinition }
      })

      const validationState = cloneState(state)
      try {
        for (const { item } of resolvedOperations) {
          assertExpectedVersions(validationState, item.expectedVersions)
          applyHandler(validationState, item.operation, item.input, {
            actor: context.actor,
            operation: item.operation,
            emittedEventIds: [],
          })
        }
      } catch (error) {
        if (!(error instanceof OperationError)) throw error
        const warning = `This proposal can no longer be applied: ${error.message}`
        changeSet.status = 'stale'
        changeSet.warnings = [warning]
        changeSet.updatedAt = timestamp
        changeSet.version += 1
        appendEvent(state, context, {
          type: 'change-set.stale',
          aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
          summary: `Marked proposal “${changeSet.title}” as stale.`,
          data: { causeCode: error.code, cause: error.message },
        })
        throw new PersistedOperationError(
          'STALE_WRITE',
          warning,
          state,
          [...context.emittedEventIds],
          error.fields,
        )
      }

      const nestedEventIds: string[] = []
      for (const { item } of resolvedOperations) {
        const nestedContext: ApplyContext = {
          actor: context.actor,
          operation: item.operation,
          emittedEventIds: nestedEventIds,
        }
        applyHandler(state, item.operation, item.input, nestedContext)
      }
      context.emittedEventIds.push(...nestedEventIds)
      changeSet.status = 'committed'
      changeSet.updatedAt = timestamp
      changeSet.version += 1
      const committedEvent = appendEvent(state, context, {
        type: 'change-set.committed',
        aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
        summary: `Committed proposal “${changeSet.title}”.`,
        data: { operationEventIds: nestedEventIds },
      })
      changeSet.committedEventIds = [...nestedEventIds, committedEvent]
      return { changeSet }
    }

    default:
      throw new OperationError('UNKNOWN_OPERATION', `Unknown operation: ${operation}.`)
  }
}

export function executeOperation(
  currentState: WorkspaceState,
  operation: string,
  request: OperationRequest,
): ExecutionResult {
  const traceId = createId('trc')
  const actor = request.actor ?? defaultActor
  const definition = operationDefinition(operation)

  if (!definition) {
    return {
      state: currentState,
      response: {
        ok: false,
        error: { code: 'UNKNOWN_OPERATION', message: `Unknown operation: ${operation}.` },
        eventIds: [],
        warnings: [],
        approvalRequired: false,
        stateRevision: currentState.revision,
        traceId,
      },
    }
  }

  try {
    assertScopes(actor, definition.scopes)
    assertRequiredInput(definition, request.input)
    assertExpectedVersions(currentState, request.expectedVersions)

    if (actor.type === 'agent') {
      if (definition.agentPolicy === 'denied') {
        throw new OperationError('AGENT_POLICY_DENIED', 'This operation requires a human actor.')
      }
      if (definition.agentPolicy === 'propose_only' && request.mode !== 'propose') {
        throw new OperationError(
          'APPROVAL_REQUIRED',
          'The agent must create a proposal for this operation.',
        )
      }
    }

    if (request.mode === 'dry_run' && !definition.supportsDryRun) {
      throw new OperationError('UNSUPPORTED_MODE', `${operation} does not support dry runs.`)
    }

    if (request.idempotencyKey) {
      const previous = currentState.recentCommandResults.find(
        (entry) => entry.idempotencyKey === request.idempotencyKey,
      )
      if (previous) {
        const actorKey = `${actor.type}:${actor.id}`
        const fingerprint = requestFingerprint(operation, request)
        if (
          previous.operation !== operation ||
          previous.actorKey !== actorKey ||
          previous.requestFingerprint !== fingerprint
        ) {
          throw new OperationError(
            'IDEMPOTENCY_CONFLICT',
            'That idempotency key was already used for a different command.',
          )
        }
        return { state: currentState, response: previous.response }
      }
    }

    if (operation === 'workspace.reset-demo') {
      const reset = createSeedState()
      reset.revision = currentState.revision + 1
      const response: OperationResponse = {
        ok: true,
        data: { reset: true },
        eventIds: [],
        warnings: [],
        approvalRequired: false,
        stateRevision: reset.revision,
        traceId,
      }
      return { state: reset, response }
    }

    const working = cloneState(currentState)
    initializeProgramCollections(working)
    const warnings: Array<{ code: string; message: string }> = []
    let data: unknown
    let approvalRequired = false
    const emittedEventIds: string[] = []

    if (request.mode === 'propose' && !operation.startsWith('change-set.')) {
      const validationState = cloneState(working)
      applyHandler(validationState, operation, request.input, {
        actor,
        operation,
        emittedEventIds: [],
      })
      const changeSet = createProposedChangeSet(working, operation, request, actor)
      const context: ApplyContext = { actor, operation: 'change-set.create', emittedEventIds }
      appendEvent(working, context, {
        type: 'change-set.created',
        aggregate: { type: 'change-set', id: changeSet.id, version: changeSet.version },
        summary: `Created proposal “${changeSet.title}”.`,
        data: { proposedOperation: operation },
      })
      data = { changeSet }
      approvalRequired = true
    } else {
      const context: ApplyContext = { actor, operation, emittedEventIds }
      data = applyHandler(working, operation, request.input, context)
      if (
        operation === 'schedule.move-session' ||
        operation === 'schedule.place-session' ||
        operation === 'schedule.auto-place'
      ) {
        const conflicts = scheduleConflicts(working)
        for (const conflict of conflicts) {
          warnings.push({ code: conflict.type.toUpperCase(), message: conflict.message })
        }
      }
    }

    const isDryRun = request.mode === 'dry_run'
    if (!isDryRun) working.revision += 1
    const response: OperationResponse = {
      ok: true,
      data,
      eventIds: isDryRun ? [] : emittedEventIds,
      warnings,
      approvalRequired,
      stateRevision: isDryRun ? currentState.revision : working.revision,
      traceId,
    }

    if (isDryRun) {
      return { state: currentState, response: { ...response, data: { preview: data } } }
    }

    if (request.idempotencyKey) {
      working.recentCommandResults.push({
        idempotencyKey: request.idempotencyKey,
        operation,
        actorKey: `${actor.type}:${actor.id}`,
        requestFingerprint: requestFingerprint(operation, request),
        response,
        recordedAt: nowIso(),
      })
      working.recentCommandResults = working.recentCommandResults.slice(-100)
    }

    return { state: working, response }
  } catch (error) {
    const known =
      error instanceof OperationError
        ? error
        : new OperationError(
            'INTERNAL_ERROR',
            error instanceof Error ? error.message : 'The operation failed.',
          )
    const persistedState = error instanceof PersistedOperationError ? error.state : null
    if (persistedState) persistedState.revision += 1
    return {
      state: persistedState ?? currentState,
      response: {
        ok: false,
        error: { code: known.code, message: known.message, fields: known.fields },
        eventIds: error instanceof PersistedOperationError ? error.eventIds : [],
        warnings: [],
        approvalRequired: known.code === 'APPROVAL_REQUIRED',
        stateRevision: persistedState?.revision ?? currentState.revision,
        traceId,
      },
    }
  }
}
