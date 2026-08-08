import { operationDefinition } from './manifest.ts'
import { audienceForCampaign, scheduleConflicts } from './selectors.ts'
import { createSeedState } from './seed.ts'
import type {
  Actor,
  Campaign,
  ChangeOperation,
  ChangeSet,
  DomainEvent,
  OperationRequest,
  OperationDefinition,
  OperationResponse,
  ParticipationStatus,
  RequirementStatus,
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
    ...state.people,
    ...state.participations,
    ...state.requirementInstances,
    ...state.sessions,
    ...state.placements,
    ...state.campaigns,
    ...state.changeSets,
  ]
}

function assertExpectedVersions(state: WorkspaceState, expected?: Record<string, number>) {
  if (!expected) return
  const records = allVersionedRecords(state)
  for (const [id, version] of Object.entries(expected)) {
    const record = records.find((entry) => entry.id === id)
    if (!record) throw new OperationError('STALE_WRITE', `${id} no longer exists.`)
    if (record.version !== version) {
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

    case 'schedule.move-session': {
      const placement = findRequired(state.placements, input.placementId, 'placement')
      const room = findRequired(state.rooms, input.roomId, 'room')
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

    case 'schedule.publish': {
      const conflicts = scheduleConflicts(state)
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
      appendEvent(state, context, {
        type: 'campaign.sent',
        aggregate: { type: 'campaign', id: campaign.id, version: campaign.version },
        summary: `Queued ${campaign.name} for ${campaign.recipientParticipationIds.length} recipients.`,
        data: {
          recipientCount: campaign.recipientParticipationIds.length,
          deliveryMode: 'demo-outbox',
        },
      })
      return { campaign }
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
