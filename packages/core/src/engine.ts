import { operationDefinition } from './manifest.ts'
import { eventCalendarFilename } from './calendar.ts'
import { acceleventsExportPreflight, buildAcceleventsExportItems } from './accelevents.ts'
import { normalizeWorkspaceState } from './migrations.ts'
import {
  requiredSubmissionFieldPurposes,
  submissionFieldPurposeSupportsKind,
} from './submission-forms.ts'
import {
  audienceForCampaign,
  renderCampaignMessage,
  scheduleConflicts,
  schedulePublishPreflight,
  submissionAnswerByPurpose,
  submissionReviewSummary,
  visibleSubmissionFormFields,
} from './selectors.ts'
import { createSeedState } from './seed.ts'
import type {
  Actor,
  AcceleventsExport,
  Asset,
  Campaign,
  CampaignDelivery,
  ChangeOperation,
  ChangeSet,
  DomainEvent,
  OperationRequest,
  OperationDefinition,
  OperationResponse,
  Participation,
  ParticipationStatus,
  Placement,
  Person,
  PortalResource,
  RequirementStatus,
  Session,
  Submission,
  SubmissionAnswers,
  SubmissionForm,
  SubmissionFormField,
  SubmissionReceiptDelivery,
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

interface ApplyContext {
  actor: Actor
  operation: string
  emittedEventIds: string[]
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

function optionalString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

const portalEmbedTag =
  /^<\/?(?:article|section|h1|h2|h3|p|ul|ol|li|strong|em|br|hr|blockquote|code|pre)\s*\/?>$/iu

function validatedPortalEmbedHtml(value: unknown) {
  const html = assertString(value, 'embedHtml')
  if (html.length > 12_000) {
    throw new OperationError('INVALID_INPUT', 'embedHtml must be 12,000 characters or fewer.', {
      embedHtml: 'Shorten the embedded card.',
    })
  }
  const tags = html.match(/<[^>]*>/gu) ?? []
  if (
    tags.some((tag) => !portalEmbedTag.test(tag)) ||
    html.replaceAll(/<[^>]*>/gu, '').match(/[<>]/u)
  ) {
    throw new OperationError(
      'INVALID_INPUT',
      'Embedded cards accept only static headings, text, lists, quotes, and code.',
      { embedHtml: 'Remove attributes, links, images, forms, scripts, and unsupported tags.' },
    )
  }
  return html
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

const maximumRequirementFileBytes = 8 * 1024 * 1024
const imageContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const documentContentTypes = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])

function requirementAssetKind(definitionId: string): Asset['kind'] {
  if (definitionId === 'req_headshot') return 'headshot'
  if (definitionId === 'req_slides') return 'slides'
  return 'supporting_document'
}

function validateRequirementFile(
  workspaceId: string,
  participationId: string,
  definitionId: string,
  input: Record<string, unknown>,
) {
  const filename = assertString(input.filename, 'filename')
  if (filename.length > 160 || filename.includes('/') || filename.includes('\\')) {
    throw new OperationError('INVALID_INPUT', 'Use a filename without folders.', {
      filename: 'Choose a file with a name under 160 characters.',
    })
  }
  const contentType = assertString(input.contentType, 'contentType').toLowerCase()
  const allowedTypes = definitionId === 'req_headshot' ? imageContentTypes : documentContentTypes
  if (!allowedTypes.has(contentType)) {
    throw new OperationError(
      'INVALID_INPUT',
      definitionId === 'req_headshot'
        ? 'Headshots must be JPEG, PNG, or WebP images.'
        : 'Files must be PDF, Word, or PowerPoint documents.',
      { contentType: 'Choose a supported file type.' },
    )
  }
  const sizeBytes = input.sizeBytes
  if (
    typeof sizeBytes !== 'number' ||
    !Number.isInteger(sizeBytes) ||
    sizeBytes <= 0 ||
    sizeBytes > maximumRequirementFileBytes
  ) {
    throw new OperationError('INVALID_INPUT', 'Files must be between 1 byte and 8 MB.', {
      sizeBytes: 'Choose a file no larger than 8 MB.',
    })
  }
  const storageKey = assertString(input.storageKey, 'storageKey')
  const requiredPrefix = `workspaces/${workspaceId}/participants/${participationId}/`
  if (
    !storageKey.startsWith(requiredPrefix) ||
    storageKey.includes('..') ||
    storageKey.length > 512
  ) {
    throw new OperationError('FORBIDDEN', 'The file storage key is outside this participant.')
  }
  return { filename, contentType, sizeBytes, storageKey }
}

function assertTimeZone(value: unknown, field: string) {
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

function answerIsEmpty(value: SubmissionAnswers[string] | undefined) {
  return (
    value === undefined ||
    value === null ||
    value === false ||
    (typeof value === 'string' && value.trim().length === 0) ||
    (Array.isArray(value) && value.length === 0)
  )
}

function validateAnswersForSubmission(state: WorkspaceState, submission: Submission) {
  const visibleFields = visibleSubmissionFormFields(state, submission.formId, submission.answers)
  const errors: Record<string, string> = {}
  for (const field of visibleFields) {
    const value = submission.answers[field.key]
    if (field.required && answerIsEmpty(value)) errors[field.key] = `${field.label} is required.`
    if (answerIsEmpty(value)) continue
    if (field.kind === 'email' && typeof value === 'string' && !/^\S+@\S+\.\S+$/u.test(value)) {
      errors[field.key] = 'Enter a valid email address.'
    }
    if (field.kind === 'url' && typeof value === 'string') {
      try {
        new URL(value)
      } catch {
        errors[field.key] = 'Enter a valid URL.'
      }
    }
    if (field.kind === 'select' && typeof value === 'string') {
      if (!field.options.some((option) => option.value === value)) {
        errors[field.key] = 'Choose one of the available options.'
      }
    }
    if (field.kind === 'multi_select' && Array.isArray(value)) {
      if (value.some((entry) => !field.options.some((option) => option.value === entry))) {
        errors[field.key] = 'Choose only available options.'
      }
    }
  }
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
    ...state.participations,
    ...state.requirementInstances,
    ...(state.submissionForms ?? []),
    ...(state.submissions ?? []),
    ...(state.submissionReceiptDeliveries ?? []),
    ...(state.portalResources ?? []),
    ...(state.reviewers ?? []),
    ...(state.reviewerTeams ?? []),
    ...(state.evaluationPlans ?? []),
    ...(state.reviewerAssignments ?? []),
    ...(state.scorecards ?? []),
    ...(state.reviewDecisions ?? []),
    ...state.sessions,
    ...state.placements,
    ...state.campaigns,
    ...(state.campaignDeliveries ?? []),
    ...(state.acceleventsExports ?? []),
    ...(state.acceleventsExports ?? []).flatMap((entry) => entry.items),
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
      if (form.eventId !== state.activeEventId || form.status !== 'open') {
        throw new OperationError('FORM_CLOSED', 'This submission form is not accepting responses.')
      }
      const kind = assertOneOf(input.kind, 'kind', ['abstract', 'guaranteed_session'] as const)
      if (!form.allowedKinds.includes(kind)) {
        throw new OperationError('INVALID_INPUT', 'This form does not accept that submission kind.')
      }
      const submission: Submission = {
        id: createId('sub'),
        eventId: form.eventId,
        formId: form.id,
        kind,
        status: 'draft',
        answers: assertSubmissionAnswers(input.answers),
        assetIds: input.assetIds === undefined ? [] : assertStringArray(input.assetIds, 'assetIds'),
        submittedAt: null,
        decidedAt: null,
        convertedParticipationId: null,
        convertedSessionId: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      state.submissions.push(submission)
      appendEvent(state, context, {
        type: 'submission.created',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: 'Created a submission draft.',
        data: { formId: form.id, kind },
      })
      return { submission }
    }

    case 'submission.submit': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      if (submission.status !== 'draft') {
        throw new OperationError('INVALID_TRANSITION', 'Only a draft submission can be submitted.')
      }
      const form = findRequired(state.submissionForms, submission.formId, 'submission form')
      if (context.actor.type === 'submitter' && context.actor.id !== form.slug) {
        throw new OperationError('FORBIDDEN', 'This submission link cannot submit that draft.')
      }
      if (form.status !== 'open') {
        throw new OperationError('FORM_CLOSED', 'This submission form is not accepting responses.')
      }
      if (input.answers !== undefined) {
        submission.answers = {
          ...submission.answers,
          ...assertSubmissionAnswers(input.answers),
        }
      }
      if (input.assetIds !== undefined) {
        submission.assetIds = assertStringArray(input.assetIds, 'assetIds')
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
      if (plan) {
        const round = [...plan.rounds].sort((left, right) => left.order - right.order)[0]
        const team = state.reviewerTeams.find((entry) => entry.id === plan.reviewerTeamId)
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
            dueAt: form.closesAt,
            updatedAt: timestamp,
            version: 1,
          }
          state.reviewerAssignments.push(assignment)
          createdAssignments.push(assignment)
        }
      }

      const event = findRequired(state.events, submission.eventId, 'event')
      const firstName = stringAnswer(state, submission, 'first_name')
      const lastName = stringAnswer(state, submission, 'last_name')
      const recipientEmail = stringAnswer(state, submission, 'email').toLowerCase()
      const proposalTitle = stringAnswer(state, submission, 'proposal_title')
      const deliverable = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(recipientEmail)
      const receiptDelivery: SubmissionReceiptDelivery = {
        id: createId('rcp'),
        submissionId: submission.id,
        eventId: submission.eventId,
        formId: form.id,
        recipientName: `${firstName} ${lastName}`.trim() || 'Submitter',
        recipientEmail,
        subject: `We received your proposal for ${event.name}`,
        body: [
          `Hi ${firstName || 'there'},`,
          '',
          `We received “${proposalTitle || 'your proposal'}” for ${event.name}.`,
          form.confirmationMessage,
          '',
          `Reference: ${submission.id}`,
          '',
          'Keep this reference if you need to follow up with the program team.',
        ].join('\n'),
        status: deliverable ? 'pending_provider' : 'suppressed',
        provider: null,
        providerMessageId: null,
        attemptCount: 0,
        lastError: deliverable ? null : 'The submission has no deliverable email address.',
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      state.submissionReceiptDeliveries.push(receiptDelivery)
      appendEvent(state, context, {
        type: 'submission.submitted',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: `Submitted “${stringAnswer(state, submission, 'proposal_title')}” for review.`,
        data: {
          formId: form.id,
          assignmentIds: createdAssignments.map((entry) => entry.id),
          receiptDeliveryId: receiptDelivery.id,
        },
      })
      appendEvent(state, context, {
        type: 'submission.receipt-queued',
        aggregate: {
          type: 'submission-receipt-delivery',
          id: receiptDelivery.id,
          version: receiptDelivery.version,
        },
        summary: `Prepared a submission receipt for ${receiptDelivery.recipientName}.`,
        data: {
          submissionId: submission.id,
          receiptStatus: receiptDelivery.status,
        },
      })
      return { submission, assignments: createdAssignments, receiptDelivery }
    }

    case 'submission.record-receipt-delivery': {
      const delivery = findRequired(
        state.submissionReceiptDeliveries,
        input.deliveryId,
        'submission receipt delivery',
      )
      if (delivery.status === 'delivered' || delivery.status === 'suppressed') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'That submission receipt already reached a terminal state.',
        )
      }
      const status = assertOneOf(input.status, 'status', ['delivered', 'failed'] as const)
      const providerMessageId = optionalString(input.providerMessageId)
      const lastError = optionalString(input.lastError)
      if (status === 'delivered' && !providerMessageId) {
        throw new OperationError(
          'INVALID_INPUT',
          'A delivered submission receipt requires its provider message ID.',
        )
      }
      if (status === 'failed' && !lastError) {
        throw new OperationError(
          'INVALID_INPUT',
          'A failed submission receipt requires an error summary.',
        )
      }
      delivery.status = status
      delivery.provider = 'cloudflare_email'
      delivery.providerMessageId = providerMessageId || null
      delivery.lastError = lastError || null
      delivery.attemptCount += 1
      delivery.updatedAt = timestamp
      delivery.version += 1
      appendEvent(state, context, {
        type:
          status === 'delivered'
            ? 'submission.receipt-delivered'
            : 'submission.receipt-delivery-failed',
        aggregate: {
          type: 'submission-receipt-delivery',
          id: delivery.id,
          version: delivery.version,
        },
        summary:
          status === 'delivered'
            ? `Delivered the submission receipt to ${delivery.recipientName}.`
            : `Submission receipt delivery to ${delivery.recipientName} failed.`,
        data: {
          submissionId: delivery.submissionId,
          deliveryStatus: status,
          attemptCount: delivery.attemptCount,
        },
      })
      return { delivery }
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
      const plan = findRequired(
        state.evaluationPlans,
        assignment.evaluationPlanId,
        'evaluation plan',
      )
      const scoreInput = assertRecord(input.scores, 'scores')
      const scores: Record<string, number> = {}
      const fields: Record<string, string> = {}
      for (const criterion of plan.criteria) {
        const value = scoreInput[criterion.id]
        if (
          typeof value !== 'number' ||
          !Number.isFinite(value) ||
          value < criterion.minimum ||
          value > criterion.maximum
        ) {
          fields[criterion.id] = `Enter a score from ${criterion.minimum} to ${criterion.maximum}.`
        } else {
          scores[criterion.id] = value
        }
      }
      if (Object.keys(fields).length > 0) {
        throw new OperationError('INVALID_INPUT', 'Complete every scorecard criterion.', fields)
      }
      const recommendation = assertOneOf(input.recommendation, 'recommendation', [
        'strong_accept',
        'accept',
        'borderline',
        'reject',
        'strong_reject',
      ] as const)
      let scorecard = state.scorecards.find((entry) => entry.assignmentId === assignment.id)
      if (scorecard) {
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

    case 'review.advance-round': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      if (submission.status !== 'submitted' && submission.status !== 'in_review') {
        throw new OperationError(
          'INVALID_TRANSITION',
          `A ${submission.status} submission cannot advance to another review round.`,
        )
      }
      const plan = state.evaluationPlans.find(
        (entry) =>
          entry.formId === submission.formId && entry.submissionKinds.includes(submission.kind),
      )
      if (!plan) {
        throw new OperationError('INVALID_TRANSITION', 'This submission has no evaluation plan.')
      }
      const rounds = [...plan.rounds].sort((left, right) => left.order - right.order)
      if (rounds.length === 0) {
        throw new OperationError('INVALID_TRANSITION', 'This evaluation plan has no review rounds.')
      }
      const submissionAssignments = state.reviewerAssignments.filter(
        (entry) => entry.submissionId === submission.id && entry.evaluationPlanId === plan.id,
      )
      const assignedRoundIds = new Set(submissionAssignments.map((entry) => entry.roundId))
      const currentRoundIndex = rounds.reduce(
        (highest, round, index) => (assignedRoundIds.has(round.id) ? index : highest),
        -1,
      )
      if (currentRoundIndex < 0) {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Assign the first evaluation round before advancing this submission.',
        )
      }
      const currentRound = rounds[currentRoundIndex]
      const nextRound = rounds[currentRoundIndex + 1]
      if (!nextRound) {
        throw new OperationError(
          'REVIEW_PLAN_COMPLETE',
          'This submission is already in the final review round.',
        )
      }
      const completed = submissionAssignments.filter(
        (entry) => entry.roundId === currentRound.id && entry.status === 'completed',
      ).length
      if (completed < currentRound.minimumCompletedReviews) {
        throw new OperationError(
          'REVIEWS_INCOMPLETE',
          `Complete ${currentRound.minimumCompletedReviews} reviews in ${currentRound.name} before advancing this submission.`,
        )
      }
      if (submissionAssignments.some((entry) => entry.roundId === nextRound.id)) {
        throw new OperationError(
          'DUPLICATE',
          `This submission already has ${nextRound.name.toLowerCase()} assignments.`,
        )
      }
      const team = state.reviewerTeams.find((entry) => entry.id === plan.reviewerTeamId)
      const activeReviewerIds = (team?.reviewerIds ?? []).filter(
        (reviewerId) =>
          state.reviewers.find((reviewer) => reviewer.id === reviewerId)?.status === 'active',
      )
      if (activeReviewerIds.length < nextRound.reviewersPerSubmission) {
        throw new OperationError(
          'REVIEWERS_UNAVAILABLE',
          `${nextRound.name} needs ${nextRound.reviewersPerSubmission} active reviewers.`,
        )
      }
      const previousReviewerIds = new Set(
        submissionAssignments
          .filter((entry) => entry.roundId === currentRound.id)
          .map((entry) => entry.reviewerId),
      )
      const startIndex = Math.max(0, state.submissions.indexOf(submission)) + nextRound.order
      const rotatedReviewerIds = activeReviewerIds.map(
        (_, index) => activeReviewerIds[(startIndex + index) % activeReviewerIds.length],
      )
      const reviewerIds = [
        ...rotatedReviewerIds.filter((reviewerId) => !previousReviewerIds.has(reviewerId)),
        ...rotatedReviewerIds.filter((reviewerId) => previousReviewerIds.has(reviewerId)),
      ].slice(0, nextRound.reviewersPerSubmission)
      const form = findRequired(state.submissionForms, submission.formId, 'submission form')
      const assignments = reviewerIds.map((reviewerId) => ({
        id: createId('rva'),
        eventId: submission.eventId,
        evaluationPlanId: plan.id,
        roundId: nextRound.id,
        submissionId: submission.id,
        reviewerId,
        status: 'assigned' as const,
        dueAt: form.closesAt,
        updatedAt: timestamp,
        version: 1,
      }))
      state.reviewerAssignments.push(...assignments)
      const previous = submission.status
      submission.status = 'in_review'
      submission.updatedAt = timestamp
      submission.version += 1
      appendEvent(state, context, {
        type: 'review.round-advanced',
        aggregate: { type: 'submission', id: submission.id, version: submission.version },
        summary: `Advanced “${stringAnswer(state, submission, 'proposal_title')}” to ${nextRound.name}.`,
        data: {
          previous,
          evaluationPlanId: plan.id,
          previousRoundId: currentRound.id,
          roundId: nextRound.id,
          assignmentIds: assignments.map((entry) => entry.id),
        },
      })
      return { submission, previousRound: currentRound, round: nextRound, assignments }
    }

    case 'review.decide': {
      const submission = findRequired(state.submissions, input.submissionId, 'submission')
      if (
        submission.status === 'draft' ||
        submission.status === 'withdrawn' ||
        submission.status === 'accepted'
      ) {
        throw new OperationError(
          'INVALID_TRANSITION',
          `A ${submission.status} submission cannot receive this decision.`,
        )
      }
      const decision = assertOneOf(input.decision, 'decision', [
        'accepted',
        'rejected',
        'waitlisted',
      ] as const)
      const plan = state.evaluationPlans.find(
        (entry) =>
          entry.formId === submission.formId && entry.submissionKinds.includes(submission.kind),
      )
      if (plan && input.override !== true) {
        const rounds = [...plan.rounds].sort((left, right) => left.order - right.order)
        if (rounds.length === 0) {
          throw new OperationError(
            'INVALID_TRANSITION',
            'This evaluation plan has no review rounds.',
          )
        }
        const assignedRoundIds = new Set(
          state.reviewerAssignments
            .filter(
              (entry) => entry.submissionId === submission.id && entry.evaluationPlanId === plan.id,
            )
            .map((entry) => entry.roundId),
        )
        const activeRound = [...rounds].reverse().find((round) => assignedRoundIds.has(round.id))
        const round = activeRound ?? rounds[0]
        const finalRound = rounds.at(-1)
        if (decision === 'accepted' && round.id !== finalRound?.id) {
          throw new OperationError(
            'REVIEWS_INCOMPLETE',
            `Advance this submission to ${finalRound?.name ?? 'the final review round'} before accepting it.`,
          )
        }
        const completed = state.reviewerAssignments.filter(
          (entry) =>
            entry.submissionId === submission.id &&
            entry.roundId === round.id &&
            entry.status === 'completed',
        ).length
        if (completed < round.minimumCompletedReviews) {
          throw new OperationError(
            'REVIEWS_INCOMPLETE',
            `Complete ${round.minimumCompletedReviews} reviews before deciding this submission.`,
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
      if (decision === 'accepted') {
        const email = assertString(stringAnswer(state, submission, 'email'), 'email').toLowerCase()
        const firstName = assertString(stringAnswer(state, submission, 'first_name'), 'firstName')
        const lastName = assertString(stringAnswer(state, submission, 'last_name'), 'lastName')
        person = state.people.find((entry) => entry.email.toLowerCase() === email) ?? null
        if (!person) {
          person = {
            id: createId('per'),
            firstName,
            lastName,
            email,
            company: stringAnswer(state, submission, 'company'),
            title: stringAnswer(state, submission, 'job_title'),
            city: '',
            timezone: state.workspace.timezone,
            bio: stringAnswer(state, submission, 'biography'),
            avatarUrl: `https://assets.ui.sh/avatars/${(state.people.length % 12) + 1}.webp`,
            tags: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            version: 1,
          }
          state.people.push(person)
          appendEvent(state, context, {
            type: 'person.created',
            aggregate: { type: 'person', id: person.id, version: person.version },
            summary: `Created ${person.firstName} ${person.lastName} from an accepted submission.`,
            data: { submissionId: submission.id },
          })
        }
        participation =
          state.participations.find(
            (entry) => entry.eventId === submission.eventId && entry.personId === person?.id,
          ) ?? null
        if (!participation) {
          participation = {
            id: createId('par'),
            eventId: submission.eventId,
            personId: person.id,
            roles: ['speaker'],
            status: 'invited',
            sessionIds: [],
            internalNotes: '',
            publicTitle: person.title,
            publicCompany: person.company,
            confirmedAt: null,
            updatedAt: timestamp,
            version: 1,
          }
          state.participations.push(participation)
          appendEvent(state, context, {
            type: 'participation.created',
            aggregate: {
              type: 'participation',
              id: participation.id,
              version: participation.version,
            },
            summary: `Invited ${person.firstName} ${person.lastName} to the event.`,
            data: { personId: person.id, submissionId: submission.id },
          })
        } else if (
          participation.status === 'prospect' ||
          participation.status === 'declined' ||
          participation.status === 'withdrawn'
        ) {
          participation.status = 'invited'
          participation.updatedAt = timestamp
          participation.version += 1
        }
        for (const definition of state.requirementDefinitions.filter(
          (entry) => entry.eventId === submission.eventId,
        )) {
          if (
            !state.requirementInstances.some(
              (entry) =>
                entry.definitionId === definition.id && entry.participationId === participation?.id,
            )
          ) {
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
        const format = assertOneOf(stringAnswer(state, submission, 'session_format'), 'format', [
          'keynote',
          'talk',
          'panel',
          'workshop',
        ] as const)
        const requestedTrackId = stringAnswer(state, submission, 'track')
        const track =
          state.tracks.find(
            (entry) => entry.id === requestedTrackId && entry.eventId === submission.eventId,
          ) ?? state.tracks.find((entry) => entry.eventId === submission.eventId)
        if (!track) throw new OperationError('INVALID_INPUT', 'The event needs at least one track.')
        const defaultDurations = { keynote: 40, talk: 30, panel: 45, workshop: 75 } as const
        const durationMinutes =
          typeof input.durationMinutes === 'number' &&
          Number.isInteger(input.durationMinutes) &&
          input.durationMinutes > 0
            ? input.durationMinutes
            : defaultDurations[format]
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
          participantIds: [participation.id],
          durationMinutes,
          expectedAttendance,
          status: 'ready',
          updatedAt: timestamp,
          version: 1,
        }
        state.sessions.push(session)
        participation.sessionIds.push(session.id)
        participation.updatedAt = timestamp
        participation.version += 1
        appendEvent(state, context, {
          type: 'session.created-from-submission',
          aggregate: { type: 'session', id: session.id, version: session.version },
          summary: `Created session “${session.title}” from an accepted submission.`,
          data: { submissionId: submission.id, participationId: participation.id },
        })
        submission.convertedParticipationId = participation.id
        submission.convertedSessionId = session.id
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

    case 'person.create': {
      const firstName = assertString(input.firstName, 'firstName')
      const lastName = assertString(input.lastName, 'lastName')
      const email = assertString(input.email, 'email').toLowerCase()
      if (state.people.some((person) => person.email.toLowerCase() === email)) {
        throw new OperationError('DUPLICATE', 'A person with that email already exists.', {
          email: 'Use the existing person or enter another email.',
        })
      }
      const personId = createId('per')
      const participationId = createId('par')
      const person = {
        id: personId,
        firstName,
        lastName,
        email,
        company: typeof input.company === 'string' ? input.company.trim() : '',
        title: typeof input.title === 'string' ? input.title.trim() : '',
        city: typeof input.city === 'string' ? input.city.trim() : '',
        timezone: typeof input.timezone === 'string' ? input.timezone : 'America/New_York',
        bio: '',
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
      const participation = {
        id: participationId,
        eventId: state.activeEventId,
        personId,
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
      state.people.push(person)
      state.participations.push(participation)
      for (const definition of state.requirementDefinitions.filter(
        (entry) => entry.eventId === state.activeEventId,
      )) {
        state.requirementInstances.push({
          id: createId('rqi'),
          definitionId: definition.id,
          participationId,
          status: 'not_started',
          value: '',
          submittedAt: null,
          reviewedAt: null,
          updatedAt: timestamp,
          version: 1,
        })
      }
      appendEvent(state, context, {
        type: 'person.created',
        aggregate: { type: 'person', id: personId, version: 1 },
        summary: `Created ${firstName} ${lastName}.`,
        data: { participationId },
      })
      appendEvent(state, context, {
        type: 'participation.created',
        aggregate: { type: 'participation', id: participationId, version: 1 },
        summary: `Added ${firstName} ${lastName} to the active event.`,
        data: { personId, roles },
      })
      return { person, participation }
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
          person[field] = input[field].trim()
          changed.push(field)
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
        prospect: ['invited', 'withdrawn'],
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
        const confirmation = state.requirementInstances.find(
          (instance) =>
            instance.participationId === participation.id &&
            instance.definitionId === 'req_confirm',
        )
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

    case 'requirement.submit-file': {
      const instance = findRequired(
        state.requirementInstances,
        input.requirementInstanceId,
        'requirement instance',
      )
      if (context.actor.type === 'participant' && context.actor.id !== instance.participationId) {
        throw new OperationError(
          'FORBIDDEN',
          'A participant can only upload files for their own requirements.',
        )
      }
      if (instance.status !== 'not_started' && instance.status !== 'revision_requested') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'Only an incomplete or revision-requested file can be submitted.',
        )
      }
      const definition = findRequired(
        state.requirementDefinitions,
        instance.definitionId,
        'requirement definition',
      )
      if (definition.kind !== 'file') {
        throw new OperationError('INVALID_INPUT', 'This requirement does not accept a file.')
      }
      const file = validateRequirementFile(
        state.workspace.id,
        instance.participationId,
        definition.id,
        input,
      )
      const asset: Asset = {
        id: createId('ast'),
        eventId: definition.eventId,
        owner: { type: 'participation', id: instance.participationId },
        kind: requirementAssetKind(definition.id),
        ...file,
        createdAt: timestamp,
      }
      state.assets.push(asset)
      const previous = instance.status
      instance.status = 'submitted'
      instance.value = asset.id
      instance.submittedAt = timestamp
      instance.reviewedAt = null
      instance.updatedAt = timestamp
      instance.version += 1
      appendEvent(state, context, {
        type: 'asset.created',
        aggregate: { type: 'asset', id: asset.id, version: 1 },
        summary: `Uploaded ${asset.filename} for ${definition.label}.`,
        data: {
          participationId: instance.participationId,
          requirementInstanceId: instance.id,
          assetKind: asset.kind,
          contentType: asset.contentType,
          sizeBytes: asset.sizeBytes,
        },
      })
      appendEvent(state, context, {
        type: 'requirement.status-changed',
        aggregate: { type: 'requirement', id: instance.id, version: instance.version },
        summary: `${definition.label} changed from ${previous} to submitted.`,
        data: {
          participationId: instance.participationId,
          previous,
          next: 'submitted',
          assetId: asset.id,
        },
      })
      appendEvent(state, context, {
        type: 'participation.readiness-changed',
        aggregate: { type: 'participation', id: instance.participationId, version: 1 },
        summary: 'Participant readiness was recalculated.',
        data: { requirementInstanceId: instance.id },
      })
      return { asset: { ...asset, storageKey: '' }, requirementInstance: instance }
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
      if (context.actor.type === 'participant') {
        if (
          nextStatus !== 'submitted' ||
          (previous !== 'not_started' && previous !== 'revision_requested')
        ) {
          throw new OperationError(
            'FORBIDDEN',
            'Participants can submit their own incomplete requirements; review decisions require staff.',
          )
        }
      }
      instance.status = nextStatus as RequirementStatus
      if (typeof input.value === 'string') instance.value = input.value.trim()
      if (nextStatus === 'submitted' && !instance.submittedAt) instance.submittedAt = timestamp
      if (nextStatus === 'approved' || nextStatus === 'waived') instance.reviewedAt = timestamp
      instance.updatedAt = timestamp
      instance.version += 1
      const definition = state.requirementDefinitions.find(
        (entry) => entry.id === instance.definitionId,
      )
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

    case 'portal-resource.save': {
      const event = findRequired(state.events, input.eventId, 'event')
      if (event.id !== state.activeEventId) {
        throw new OperationError('INVALID_INPUT', 'That resource belongs to another event.')
      }
      const title = assertString(input.title, 'title')
      const summary = assertString(input.summary, 'summary')
      if (title.length > 120 || summary.length > 240) {
        throw new OperationError(
          'INVALID_INPUT',
          'Resource titles and summaries must stay concise.',
          {
            title: title.length > 120 ? 'Use 120 characters or fewer.' : '',
            summary: summary.length > 240 ? 'Use 240 characters or fewer.' : '',
          },
        )
      }
      const kind = assertOneOf(input.kind, 'kind', ['guide', 'html_embed'] as const)
      const status = assertOneOf(input.status, 'status', ['draft', 'published'] as const)
      if (
        typeof input.sortOrder !== 'number' ||
        !Number.isInteger(input.sortOrder) ||
        input.sortOrder < 0 ||
        input.sortOrder > 10_000
      ) {
        throw new OperationError(
          'INVALID_INPUT',
          'sortOrder must be a whole number from 0 to 10,000.',
        )
      }
      const body = kind === 'guide' ? assertString(input.body, 'body') : ''
      if (body.length > 12_000) {
        throw new OperationError('INVALID_INPUT', 'body must be 12,000 characters or fewer.')
      }
      const embedHtml = kind === 'html_embed' ? validatedPortalEmbedHtml(input.embedHtml) : null
      const existing = optionalString(input.resourceId)
        ? findRequired(state.portalResources, input.resourceId, 'portal resource')
        : null
      if (existing && existing.eventId !== event.id) {
        throw new OperationError('INVALID_INPUT', 'That resource belongs to another event.')
      }
      const values = { title, summary, kind, body, embedHtml, status, sortOrder: input.sortOrder }
      if (
        existing &&
        Object.entries(values).every(
          ([key, value]) => existing[key as keyof typeof values] === value,
        )
      ) {
        throw new OperationError('NO_CHANGES', 'That resource already matches the saved version.')
      }
      const resource: PortalResource = existing ?? {
        id: createId('por'),
        eventId: event.id,
        ...values,
        updatedAt: timestamp,
        version: 1,
      }
      if (existing) {
        Object.assign(existing, values, { updatedAt: timestamp, version: existing.version + 1 })
      } else {
        state.portalResources.push(resource)
      }
      appendEvent(state, context, {
        type: 'portal-resource.saved',
        aggregate: { type: 'portal-resource', id: resource.id, version: resource.version },
        summary: `${status === 'published' ? 'Published' : 'Saved'} speaker resource ${title}.`,
        data: { kind, status, sortOrder: resource.sortOrder },
      })
      return { resource }
    }

    case 'schedule.place-session': {
      const session = findRequired(state.sessions, input.sessionId, 'session')
      if (session.eventId !== state.activeEventId) {
        throw new OperationError('INVALID_INPUT', 'That session belongs to another event.')
      }
      if (session.status === 'cancelled') {
        throw new OperationError('INVALID_TRANSITION', 'A cancelled session cannot be scheduled.')
      }
      if (state.placements.some((placement) => placement.sessionId === session.id)) {
        throw new OperationError('INVALID_TRANSITION', 'That session is already on the schedule.')
      }
      const room = findRequired(state.rooms, input.roomId, 'room')
      if (room.eventId !== session.eventId) {
        throw new OperationError('INVALID_INPUT', 'That room belongs to another event.')
      }
      const startsAt = assertString(input.startsAt, 'startsAt')
      if (Number.isNaN(new Date(startsAt).getTime())) {
        throw new OperationError('INVALID_INPUT', 'startsAt must be an ISO date and time.')
      }
      const event = findRequired(state.events, state.activeEventId, 'event')
      const placement: Placement = {
        id: createId('plc'),
        eventId: event.id,
        sessionId: session.id,
        roomId: room.id,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: addMinutes(new Date(startsAt).toISOString(), session.durationMinutes),
        scheduleVersion: event.publishedScheduleVersion ?? 0,
        published: false,
        version: 1,
      }
      state.placements.push(placement)
      appendEvent(state, context, {
        type: 'schedule.session-placed',
        aggregate: { type: 'placement', id: placement.id, version: placement.version },
        summary: `Placed ${session.title} in ${room.name}.`,
        data: { sessionId: session.id, roomId: room.id, startsAt: placement.startsAt },
      })
      return {
        placement,
        conflicts: scheduleConflicts(state).filter((conflict) =>
          conflict.placementIds.includes(placement.id),
        ),
      }
    }

    case 'schedule.move-session': {
      const placement = findRequired(state.placements, input.placementId, 'placement')
      if (placement.eventId !== state.activeEventId) {
        throw new OperationError('INVALID_INPUT', 'That placement belongs to another event.')
      }
      const room = findRequired(state.rooms, input.roomId, 'room')
      if (room.eventId !== placement.eventId) {
        throw new OperationError('INVALID_INPUT', 'That room belongs to another event.')
      }
      const startsAt = assertString(input.startsAt, 'startsAt')
      if (Number.isNaN(new Date(startsAt).getTime())) {
        throw new OperationError('INVALID_INPUT', 'startsAt must be an ISO date and time.')
      }
      const session = findRequired(state.sessions, placement.sessionId, 'session')
      const previous = { roomId: placement.roomId, startsAt: placement.startsAt }
      placement.roomId = room.id
      placement.startsAt = new Date(startsAt).toISOString()
      placement.endsAt = addMinutes(placement.startsAt, session.durationMinutes)
      placement.published = false
      placement.version += 1
      appendEvent(state, context, {
        type: 'schedule.session-moved',
        aggregate: { type: 'placement', id: placement.id, version: placement.version },
        summary: `Moved ${session.title} to ${room.name}.`,
        data: { previous, next: { roomId: room.id, startsAt: placement.startsAt } },
      })
      return { placement, conflicts: scheduleConflicts(state) }
    }

    case 'schedule.unplace-session': {
      const placement = findRequired(state.placements, input.placementId, 'placement')
      if (placement.eventId !== state.activeEventId) {
        throw new OperationError('INVALID_INPUT', 'That placement belongs to another event.')
      }
      const session = findRequired(state.sessions, placement.sessionId, 'session')
      const previous = cloneState(placement)
      state.placements = state.placements.filter((entry) => entry.id !== placement.id)
      appendEvent(state, context, {
        type: 'schedule.session-unplaced',
        aggregate: { type: 'placement', id: placement.id, version: placement.version + 1 },
        summary: `Returned ${session.title} to the unscheduled tray.`,
        data: { sessionId: session.id, previous },
      })
      return { session, placementId: placement.id, previous }
    }

    case 'schedule.publish': {
      const preflight = schedulePublishPreflight(state)
      if (preflight.hardConflicts.length > 0) {
        throw new OperationError(
          'SCHEDULE_CONFLICTS',
          `Resolve ${preflight.hardConflicts.length} schedule conflict${preflight.hardConflicts.length === 1 ? '' : 's'} before publishing.`,
        )
      }
      if (preflight.unscheduledSessions.length > 0) {
        throw new OperationError(
          'SCHEDULE_INCOMPLETE',
          `Place ${preflight.unscheduledSessions.length} unscheduled session${preflight.unscheduledSessions.length === 1 ? '' : 's'} before publishing.`,
        )
      }
      if (preflight.placementCount === 0) {
        throw new OperationError(
          'SCHEDULE_INCOMPLETE',
          'Place at least one session before publishing.',
        )
      }
      if (preflight.changeCount === 0) {
        throw new OperationError('NO_CHANGES', 'The draft already matches the published schedule.')
      }
      const conflicts = preflight.conflicts
      const event = findRequired(state.events, state.activeEventId, 'event')
      const existingReleases = (state.scheduleReleases ?? []).filter(
        (release) => release.eventId === event.id,
      )
      const version =
        Math.max(
          event.publishedScheduleVersion ?? 0,
          ...existingReleases.map((release) => release.version),
        ) + 1
      const draftPlacements = state.placements.filter((entry) => entry.eventId === event.id)
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

    case 'accelevents.prepare-export': {
      const eventUrl = assertString(input.eventUrl, 'eventUrl').toLowerCase()
      if (!/^[a-z0-9](?:[a-z0-9_-]{0,98}[a-z0-9])?$/u.test(eventUrl)) {
        throw new OperationError(
          'INVALID_INPUT',
          'eventUrl must be the Accelevents event URL identifier, not a full URL.',
          { eventUrl: 'Use only letters, numbers, hyphens, or underscores.' },
        )
      }
      const preflight = acceleventsExportPreflight(state)
      if (!preflight.canPrepare || !preflight.release || !preflight.event) {
        throw new OperationError(
          'EXPORT_NOT_READY',
          preflight.blockers[0] ?? 'The published program is not ready to export.',
        )
      }
      const existing = state.acceleventsExports.find(
        (entry) =>
          entry.eventId === preflight.event!.id &&
          entry.scheduleReleaseId === preflight.release!.id &&
          entry.eventUrl === eventUrl,
      )
      if (existing) {
        throw new OperationError(
          'NO_CHANGES',
          'This published schedule already has an Accelevents export. Retry failed items in that batch.',
        )
      }
      const items = buildAcceleventsExportItems(state, timestamp, () => createId('aci'))
      if (items.length === 0) {
        throw new OperationError(
          'EXPORT_NOT_READY',
          'The published program has no exportable items.',
        )
      }
      const acceleventsExport: AcceleventsExport = {
        id: createId('acx'),
        eventId: preflight.event.id,
        eventUrl,
        scheduleReleaseId: preflight.release.id,
        scheduleVersion: preflight.release.version,
        status: 'pending_provider',
        items,
        createdAt: timestamp,
        updatedAt: timestamp,
        version: 1,
      }
      state.acceleventsExports.unshift(acceleventsExport)
      const integration = state.integrations.find((entry) => entry.kind === 'accelevents')
      if (integration) {
        integration.status = 'attention'
        integration.detail = `${items.length} frozen items await the credentialed Accelevents consumer.`
      }
      appendEvent(state, context, {
        type: 'accelevents.export-prepared',
        aggregate: {
          type: 'accelevents-export',
          id: acceleventsExport.id,
          version: acceleventsExport.version,
        },
        summary: `Prepared Accelevents export for schedule version ${preflight.release.version}.`,
        data: {
          eventUrl,
          scheduleReleaseId: preflight.release.id,
          speakers: items.filter((item) => item.resource === 'speaker').length,
          sessions: items.filter((item) => item.resource === 'session').length,
          warnings: preflight.warnings,
        },
      })
      return { export: acceleventsExport, warnings: preflight.warnings }
    }

    case 'accelevents.record-result': {
      const acceleventsExport = findRequired(
        state.acceleventsExports,
        input.exportId,
        'Accelevents export',
      )
      if (acceleventsExport.eventId !== state.activeEventId) {
        throw new OperationError('INVALID_INPUT', 'That export belongs to another event.')
      }
      const item = findRequired(acceleventsExport.items, input.itemId, 'Accelevents export item')
      if (item.status === 'delivered') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'That export item already reached a delivered state.',
        )
      }
      const status = assertOneOf(input.status, 'status', ['delivered', 'failed'] as const)
      const providerId = optionalString(input.providerId)
      const lastError = optionalString(input.lastError)
      if (status === 'delivered' && !providerId) {
        throw new OperationError(
          'INVALID_INPUT',
          'A delivered export item requires its Accelevents resource ID.',
        )
      }
      if (status === 'failed' && !lastError) {
        throw new OperationError('INVALID_INPUT', 'A failed export item requires an error summary.')
      }
      item.status = status
      item.providerId = status === 'delivered' ? providerId : null
      item.lastError = status === 'failed' ? lastError : null
      item.attemptCount += 1
      item.updatedAt = timestamp
      item.version += 1

      const pending = acceleventsExport.items.filter(
        (entry) => entry.status === 'pending_provider',
      ).length
      const delivered = acceleventsExport.items.filter(
        (entry) => entry.status === 'delivered',
      ).length
      const failed = acceleventsExport.items.filter((entry) => entry.status === 'failed').length
      acceleventsExport.status =
        pending > 0
          ? delivered + failed > 0
            ? 'partial'
            : 'pending_provider'
          : failed === 0
            ? 'delivered'
            : delivered > 0
              ? 'partial'
              : 'failed'
      acceleventsExport.updatedAt = timestamp
      acceleventsExport.version += 1

      const integration = state.integrations.find((entry) => entry.kind === 'accelevents')
      if (integration) {
        integration.status = acceleventsExport.status === 'delivered' ? 'connected' : 'attention'
        integration.detail =
          acceleventsExport.status === 'delivered'
            ? `Schedule version ${acceleventsExport.scheduleVersion} is confirmed in Accelevents.`
            : `${pending} pending, ${delivered} delivered, and ${failed} failed export items.`
        integration.lastSeenAt = timestamp
      }
      appendEvent(state, context, {
        type: status === 'delivered' ? 'accelevents.item-delivered' : 'accelevents.item-failed',
        aggregate: { type: 'accelevents-export-item', id: item.id, version: item.version },
        summary:
          status === 'delivered'
            ? `Confirmed ${item.resource} ${item.externalKey} in Accelevents.`
            : `Accelevents export failed for ${item.resource} ${item.externalKey}.`,
        data: {
          exportId: acceleventsExport.id,
          resource: item.resource,
          sourceId: item.sourceId,
          exportStatus: acceleventsExport.status,
          attemptCount: item.attemptCount,
        },
      })
      return { export: acceleventsExport, item }
    }

    case 'campaign.create-draft': {
      const audience = assertOneOf(input.audience, 'audience', [
        'all_active',
        'confirmed',
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
        includeEventInvite: input.includeEventInvite === true,
        status: 'draft',
        createdAt: timestamp,
        approvedAt: null,
        queuedAt: null,
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
      if (campaign.recipientParticipationIds.length === 0) {
        throw new OperationError(
          'INVALID_INPUT',
          'The approved campaign has no recipients to place in the delivery outbox.',
        )
      }
      const event = findRequired(state.events, campaign.eventId, 'event')
      const attachmentNames = campaign.includeEventInvite ? [eventCalendarFilename(event)] : []
      const deliveries: CampaignDelivery[] = []
      for (const participationId of new Set(campaign.recipientParticipationIds)) {
        const participation = findRequired(state.participations, participationId, 'participation')
        const person = findRequired(state.people, participation.personId, 'person')
        const rendered = renderCampaignMessage(state, campaign, participationId)
        if (!rendered) {
          throw new OperationError(
            'INVALID_INPUT',
            'A campaign recipient could not be rendered from the approved event and profile.',
          )
        }
        const email = person.email.trim().toLocaleLowerCase()
        const suppressed =
          participation.status === 'declined' ||
          participation.status === 'withdrawn' ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)
        deliveries.push({
          id: createId('dlv'),
          campaignId: campaign.id,
          eventId: campaign.eventId,
          participationId,
          personId: person.id,
          recipientName: `${person.firstName} ${person.lastName}`.trim(),
          recipientEmail: email,
          subject: rendered.subject,
          body: rendered.body,
          status: suppressed ? 'suppressed' : 'pending_provider',
          provider: null,
          providerMessageId: null,
          attachmentNames: [...attachmentNames],
          attemptCount: 0,
          lastError: suppressed ? 'Recipient is unavailable or has no deliverable email.' : null,
          createdAt: timestamp,
          updatedAt: timestamp,
          version: 1,
        })
      }
      if (deliveries.every((delivery) => delivery.status === 'suppressed')) {
        throw new OperationError(
          'INVALID_INPUT',
          'Every approved recipient is unavailable or has an undeliverable email.',
        )
      }
      state.campaignDeliveries.push(...deliveries)
      campaign.status = 'queued'
      campaign.queuedAt = timestamp
      campaign.sentAt = null
      campaign.version += 1
      appendEvent(state, context, {
        type: 'campaign.queued',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Added ${campaign.name} to the delivery outbox for ${deliveries.length} recipients.`,
        data: {
          recipientCount: deliveries.length,
          pendingProvider: deliveries.filter((entry) => entry.status === 'pending_provider').length,
          suppressed: deliveries.filter((entry) => entry.status === 'suppressed').length,
          includesEventInvite: campaign.includeEventInvite,
          deliveryIds: deliveries.map((entry) => entry.id),
        },
      })
      return { campaign, deliveries }
    }

    case 'campaign.record-delivery': {
      const delivery = findRequired(state.campaignDeliveries, input.deliveryId, 'campaign delivery')
      if (delivery.status === 'delivered' || delivery.status === 'suppressed') {
        throw new OperationError(
          'INVALID_TRANSITION',
          'That delivery already reached a terminal state.',
        )
      }
      const status = assertOneOf(input.status, 'status', ['delivered', 'failed'] as const)
      const providerMessageId = optionalString(input.providerMessageId)
      const lastError = optionalString(input.lastError)
      if (status === 'delivered' && !providerMessageId) {
        throw new OperationError(
          'INVALID_INPUT',
          'A delivered message requires its provider message ID.',
        )
      }
      if (status === 'failed' && !lastError) {
        throw new OperationError('INVALID_INPUT', 'A failed message requires an error summary.')
      }
      delivery.status = status
      delivery.provider = 'cloudflare_email'
      delivery.providerMessageId = providerMessageId || null
      delivery.lastError = lastError || null
      delivery.attemptCount += 1
      delivery.updatedAt = timestamp
      delivery.version += 1

      const campaign = findRequired(state.campaigns, delivery.campaignId, 'campaign')
      const campaignDeliveries = state.campaignDeliveries.filter(
        (entry) => entry.campaignId === campaign.id,
      )
      if (
        campaignDeliveries.length > 0 &&
        campaignDeliveries.every(
          (entry) => entry.status === 'delivered' || entry.status === 'suppressed',
        )
      ) {
        campaign.status = 'sent'
        campaign.sentAt = timestamp
        campaign.version += 1
      }
      appendEvent(state, context, {
        type: status === 'delivered' ? 'campaign.delivery-succeeded' : 'campaign.delivery-failed',
        aggregate: { type: 'campaign-delivery', id: delivery.id, version: delivery.version },
        summary:
          status === 'delivered'
            ? `Delivered ${campaign.name} to ${delivery.recipientName}.`
            : `Delivery of ${campaign.name} to ${delivery.recipientName} failed.`,
        data: {
          campaignId: campaign.id,
          deliveryStatus: status,
          attemptCount: delivery.attemptCount,
          campaignStatus: campaign.status,
        },
      })
      return { campaign, delivery }
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
      const nestedEventIds: string[] = []
      for (const item of changeSet.operations) {
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
        assertExpectedVersions(state, item.expectedVersions)
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

    assertExpectedVersions(currentState, request.expectedVersions)

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
    normalizeWorkspaceState(working)
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
      if (operation === 'schedule.move-session') {
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
    return {
      state: currentState,
      response: {
        ok: false,
        error: { code: known.code, message: known.message, fields: known.fields },
        eventIds: [],
        warnings: [],
        approvalRequired: known.code === 'APPROVAL_REQUIRED',
        stateRevision: currentState.revision,
        traceId,
      },
    }
  }
}
