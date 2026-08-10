import { executeOperation } from './engine.ts'
import { evaluationRoundIsBlind } from './reviews.ts'
import { createWorkspaceExportArchive, workspaceExportFilename } from './export.ts'
import { operationManifest } from './manifest.ts'
import { publicAgenda, readinessSummary, scheduleConflicts } from './selectors.ts'
import { defaultActor } from './utils.ts'
import type { WorkspaceRepository } from './repository.ts'
import type { Actor, OperationRequest, WorkspaceState } from './types.ts'

const maximumJsonBytes = 128_000

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

async function readJson(request: Request) {
  if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    throw new Error('Content-Type must be application/json.')
  }
  const declaredLength = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredLength) && declaredLength > maximumJsonBytes) {
    throw new Error('Request body is too large.')
  }
  if (!request.body) throw new Error('The request body is empty.')
  const reader = request.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let body = ''
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > maximumJsonBytes) {
      await reader.cancel()
      throw new Error('Request body is too large.')
    }
    body += decoder.decode(chunk.value, { stream: true })
  }
  body += decoder.decode()
  return JSON.parse(body) as unknown
}

function publicState(state: WorkspaceState) {
  const clone = structuredClone(state)
  clone.recentCommandResults = []
  return clone
}

function participantState(state: WorkspaceState, participationId: string, portalAccessKey: string) {
  const participation = state.participations.find(
    (entry) => entry.id === participationId && entry.portalAccessKey === portalAccessKey,
  )
  if (!participation) return null
  const person = state.people.find((entry) => entry.id === participation.personId)
  if (!person) return null
  const event = state.events.find((entry) => entry.id === participation.eventId)
  const clone = structuredClone(state)
  clone.events = event ? [event] : []
  clone.people = [person]
  clone.participations = [{ ...participation, internalNotes: '' }]
  clone.requirementDefinitions = state.requirementDefinitions.filter(
    (entry) => entry.eventId === participation.eventId,
  )
  clone.requirementInstances = state.requirementInstances.filter(
    (entry) => entry.participationId === participationId,
  )
  clone.submissions = (state.submissions ?? []).filter(
    (entry) => entry.convertedParticipationId === participationId,
  )
  const formIds = new Set(clone.submissions.map((entry) => entry.formId))
  clone.submissionForms = (state.submissionForms ?? []).filter((entry) => formIds.has(entry.id))
  clone.submissionFormFields = (state.submissionFormFields ?? []).filter((entry) =>
    formIds.has(entry.formId),
  )
  const submissionIds = new Set(clone.submissions.map((entry) => entry.id))
  const requirementIds = new Set(clone.requirementInstances.map((entry) => entry.id))
  clone.assets = (state.assets ?? []).filter(
    (entry) =>
      (entry.owner.type === 'submission' && submissionIds.has(entry.owner.id)) ||
      (entry.owner.type === 'participation' && entry.owner.id === participationId) ||
      (entry.owner.type === 'person' && entry.owner.id === person.id) ||
      (entry.owner.type === 'requirement' && requirementIds.has(entry.owner.id)),
  )
  const assetIds = new Set(clone.assets.map((entry) => entry.id))
  clone.assetComments = (state.assetComments ?? []).filter((entry) => assetIds.has(entry.assetId))
  clone.reviewers = []
  clone.reviewerTeams = []
  clone.evaluationPlans = []
  clone.reviewerAssignments = []
  clone.scorecards = []
  clone.reviewDecisions = []
  const sessionIds = new Set(participation.sessionIds)
  clone.sessions = state.sessions.filter(
    (entry) => entry.eventId === participation.eventId && sessionIds.has(entry.id),
  )
  const trackIds = new Set(clone.sessions.map((entry) => entry.trackId))
  clone.tracks = state.tracks.filter(
    (entry) => entry.eventId === participation.eventId && trackIds.has(entry.id),
  )
  clone.placements = state.placements.filter((entry) => sessionIds.has(entry.sessionId))
  const roomIds = new Set(clone.placements.map((entry) => entry.roomId))
  clone.rooms = state.rooms.filter(
    (entry) => entry.eventId === participation.eventId && roomIds.has(entry.id),
  )
  clone.scheduleReleases = []
  clone.campaigns = []
  clone.changeSets = []
  clone.integrations = []
  clone.domainEvents = []
  clone.recentCommandResults = []
  return clone
}

function projectionBase(state: WorkspaceState) {
  const clone = structuredClone(state)
  clone.events = []
  clone.people = []
  clone.participations = []
  clone.requirementDefinitions = []
  clone.requirementInstances = []
  clone.submissionForms = []
  clone.submissionFormFields = []
  clone.submissions = []
  clone.assets = []
  clone.assetComments = []
  clone.reviewers = []
  clone.reviewerTeams = []
  clone.evaluationPlans = []
  clone.reviewerAssignments = []
  clone.scorecards = []
  clone.reviewDecisions = []
  clone.tracks = []
  clone.rooms = []
  clone.sessions = []
  clone.placements = []
  clone.scheduleReleases = []
  clone.campaigns = []
  clone.changeSets = []
  clone.integrations = []
  clone.domainEvents = []
  clone.recentCommandResults = []
  return clone
}

function publicSubmissionState(state: WorkspaceState, slug: string, speakerAccessKey = '') {
  const form = state.submissionForms.find(
    (entry) =>
      entry.slug === slug &&
      entry.eventId === state.activeEventId &&
      (entry.status !== 'draft' || speakerAccessKey.length > 0),
  )
  if (!form) return null
  const projected = projectionBase(state)
  const event = state.events.find((entry) => entry.id === form.eventId)
  projected.events = event ? [event] : []
  projected.submissionForms = [structuredClone(form)]
  projected.submissionFormFields = state.submissionFormFields
    .filter((entry) => entry.formId === form.id)
    .map((entry) => structuredClone(entry))
  projected.tracks = state.tracks
    .filter((entry) => entry.eventId === form.eventId)
    .map((entry) => structuredClone(entry))
  if (speakerAccessKey) {
    projected.submissions = state.submissions
      .filter((entry) => entry.formId === form.id && entry.speakerAccessKey === speakerAccessKey)
      .map((entry) => structuredClone(entry))
    const submissionIds = new Set(projected.submissions.map((entry) => entry.id))
    projected.assets = state.assets
      .filter((entry) => entry.owner.type === 'submission' && submissionIds.has(entry.owner.id))
      .map((entry) => structuredClone(entry))
  }
  return projected
}

function reviewerState(state: WorkspaceState, reviewerId: string, accessKey: string) {
  const reviewer = state.reviewers.find(
    (entry) =>
      entry.id === reviewerId &&
      entry.eventId === state.activeEventId &&
      entry.accessKey === accessKey,
  )
  if (!reviewer) return null
  const projected = projectionBase(state)
  const event = state.events.find((entry) => entry.id === reviewer.eventId)
  const assignments = state.reviewerAssignments.filter((entry) => entry.reviewerId === reviewerId)
  const assignmentIds = new Set(assignments.map((entry) => entry.id))
  const submissionIds = new Set(assignments.map((entry) => entry.submissionId))
  const planIds = new Set(assignments.map((entry) => entry.evaluationPlanId))
  const plans = state.evaluationPlans.filter((entry) => planIds.has(entry.id))
  const formIds = new Set(plans.map((entry) => entry.formId))
  const fields = state.submissionFormFields.filter((entry) => formIds.has(entry.formId))
  const identityPurposes = new Set([
    'first_name',
    'last_name',
    'email',
    'company',
    'job_title',
    'biography',
  ])

  projected.events = event ? [event] : []
  projected.reviewers = [structuredClone(reviewer)]
  projected.evaluationPlans = structuredClone(plans)
  projected.reviewerAssignments = structuredClone(assignments)
  projected.scorecards = structuredClone(
    state.scorecards.filter((entry) => assignmentIds.has(entry.assignmentId)),
  )
  projected.submissionForms = structuredClone(
    state.submissionForms.filter((entry) => formIds.has(entry.id)),
  )
  projected.submissionFormFields = structuredClone(fields)
  projected.submissions = state.submissions
    .filter((entry) => submissionIds.has(entry.id))
    .map((submission) => {
      const plan = plans.find((entry) => entry.formId === submission.formId)
      const assignment = assignments.find((entry) => entry.submissionId === submission.id)
      if (!evaluationRoundIsBlind(plan, assignment?.roundId)) return structuredClone(submission)
      const hiddenKeys = new Set(
        fields
          .filter(
            (field) => field.formId === submission.formId && identityPurposes.has(field.purpose),
          )
          .map((field) => field.key),
      )
      return {
        ...structuredClone(submission),
        contributors: [],
        answers: Object.fromEntries(
          Object.entries(submission.answers).filter(([key]) => !hiddenKeys.has(key)),
        ),
      }
    })
  projected.tracks = structuredClone(
    state.tracks.filter((entry) => entry.eventId === reviewer.eventId),
  )
  return projected
}

function publicProgramState(state: WorkspaceState) {
  const projected = projectionBase(state)
  const event = state.events.find((entry) => entry.id === state.activeEventId)
  if (!event) return projected
  const release = [...state.scheduleReleases]
    .filter((entry) => entry.eventId === event.id)
    .sort((left, right) => right.version - left.version)[0]
  const sessionIds = new Set(release?.placements.map((entry) => entry.sessionId) ?? [])
  const sessions = state.sessions.filter((entry) => sessionIds.has(entry.id))
  const participationIds = new Set(sessions.flatMap((entry) => entry.participantIds))
  const participations = state.participations.filter((entry) => participationIds.has(entry.id))
  const personIds = new Set(participations.map((entry) => entry.personId))

  projected.events = [structuredClone(event)]
  projected.tracks = structuredClone(state.tracks.filter((entry) => entry.eventId === event.id))
  projected.rooms = structuredClone(state.rooms.filter((entry) => entry.eventId === event.id))
  projected.sessions = structuredClone(sessions)
  projected.participations = participations.map((entry) => ({
    ...structuredClone(entry),
    internalNotes: '',
  }))
  projected.people = state.people
    .filter((entry) => personIds.has(entry.id))
    .map((entry) => ({
      ...structuredClone(entry),
      email: '',
      city: '',
      timezone: '',
      tags: [],
    }))
  projected.scheduleReleases = release ? [structuredClone(release)] : []
  return projected
}

function projectionPayload(state: WorkspaceState) {
  return {
    state,
    derived: {
      readiness: readinessSummary(state),
      scheduleConflicts: [],
    },
  }
}

function hasScope(actor: Actor, scope: string) {
  return actor.scopes.includes('*') || actor.scopes.includes(scope)
}

function forbidden(scope: string) {
  return json({ error: `The current actor is missing ${scope}.` }, { status: 403 })
}

function positiveInteger(value: string | null, fallback: number) {
  if (value === null || value.trim() === '') return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function paginate<T>(items: T[], url: URL) {
  const pageSize = Math.min(positiveInteger(url.searchParams.get('pageSize'), 25), 100)
  const totalResults = items.length
  const totalPages = totalResults === 0 ? 0 : Math.ceil(totalResults / pageSize)
  const requestedPage = positiveInteger(url.searchParams.get('page'), 1)
  const currentPage = totalPages === 0 ? 1 : Math.min(requestedPage, totalPages)
  const start = (currentPage - 1) * pageSize

  return {
    data: items.slice(start, start + pageSize),
    pagination: {
      currentPage,
      pageSize,
      totalPages,
      totalResults,
    },
  }
}

function includesQuery(query: string, values: Array<string | null | undefined>) {
  if (!query) return true
  return values.some((value) => value?.toLocaleLowerCase().includes(query))
}

export interface CoreRequestContext {
  actor?: Actor
}

export async function handleCoreRequest(
  request: Request,
  repository: WorkspaceRepository,
  context: CoreRequestContext = {},
) {
  const url = new URL(request.url)
  const path = url.pathname
  const actor = context.actor ?? defaultActor

  if (request.method === 'GET' && path === '/api/v1/health') {
    const state = await repository.read()
    return json({ ok: true, schemaVersion: state.schemaVersion, revision: state.revision })
  }

  if (request.method === 'GET' && path === '/api/v1/state') {
    if (!hasScope(actor, 'workspace:read')) return forbidden('workspace:read')
    const state = await repository.read()
    return json({
      state: publicState(state),
      derived: {
        readiness: readinessSummary(state),
        scheduleConflicts: scheduleConflicts(state),
      },
    })
  }

  if (request.method === 'GET' && path === '/api/v1/manifest') {
    return json({ operations: operationManifest })
  }

  if (request.method === 'GET' && path === '/api/v1/domain-events') {
    if (!hasScope(actor, 'events:read')) return forbidden('events:read')
    const state = await repository.read()
    const limit = Math.min(positiveInteger(url.searchParams.get('limit'), 50), 200)
    return json({ events: state.domainEvents.slice(-limit).reverse() })
  }

  if (request.method === 'GET' && path === '/api/v1/events') {
    if (!hasScope(actor, 'workspace:read')) return forbidden('workspace:read')
    const state = await repository.read()
    const query = url.searchParams.get('q')?.trim().toLocaleLowerCase() ?? ''
    const status = url.searchParams.get('status')
    const events = state.events
      .filter((event) => !status || event.status === status)
      .filter((event) => includesQuery(query, [event.name, event.slug, event.venue, event.city]))
      .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    return json(paginate(events, url))
  }

  const eventResourceMatch = path.match(
    /^\/api\/v1\/events\/([^/]+)(?:\/(sessions|speakers|submissions))?$/u,
  )
  if (request.method === 'GET' && eventResourceMatch) {
    if (!hasScope(actor, 'workspace:read')) return forbidden('workspace:read')
    const eventId = decodeURIComponent(eventResourceMatch[1])
    const resource = eventResourceMatch[2]
    const state = await repository.read()
    const event = state.events.find((entry) => entry.id === eventId)
    if (!event) return json({ error: 'Event not found.' }, { status: 404 })
    if (!resource) return json({ data: event })

    const query = url.searchParams.get('q')?.trim().toLocaleLowerCase() ?? ''
    const status = url.searchParams.get('status')

    if (resource === 'sessions') {
      const tracks = new Map(state.tracks.map((track) => [track.id, track.name]))
      const sessions = state.sessions
        .filter((session) => session.eventId === eventId)
        .filter((session) => !status || session.status === status)
        .filter((session) =>
          includesQuery(query, [
            session.title,
            session.summary,
            session.format,
            tracks.get(session.trackId),
          ]),
        )
        .sort((left, right) => left.title.localeCompare(right.title))
      return json(paginate(sessions, url))
    }

    if (resource === 'submissions') {
      const submissions = state.submissions
        .filter((submission) => submission.eventId === eventId)
        .filter((submission) => !status || submission.status === status)
        .filter((submission) =>
          includesQuery(query, [
            submission.kind,
            ...Object.values(submission.answers).flatMap((answer) =>
              Array.isArray(answer) ? answer : answer === null ? [] : [String(answer)],
            ),
          ]),
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
      return json(paginate(submissions, url))
    }

    const speakers = state.participations
      .filter((participation) => participation.eventId === eventId)
      .map((participation) => {
        const person = state.people.find((entry) => entry.id === participation.personId)
        if (!person) return null
        return {
          id: participation.id,
          eventId: participation.eventId,
          personId: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          email: person.email,
          title: participation.publicTitle || person.title,
          company: participation.publicCompany || person.company,
          biography: person.bio,
          roles: participation.roles,
          status: participation.status,
          sessionIds: participation.sessionIds,
          updatedAt: participation.updatedAt,
          version: participation.version,
        }
      })
      .filter((speaker): speaker is NonNullable<typeof speaker> => speaker !== null)
      .filter((speaker) => !status || speaker.status === status)
      .filter((speaker) =>
        includesQuery(query, [
          speaker.firstName,
          speaker.lastName,
          speaker.email,
          speaker.title,
          speaker.company,
        ]),
      )
      .sort((left, right) =>
        `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
      )
    return json(paginate(speakers, url))
  }

  if (request.method === 'GET' && (path === '/api/v1/export' || path === '/api/v1/export.json')) {
    if (!hasScope(actor, 'workspace:export')) return forbidden('workspace:export')
    const state = await repository.read()
    const exportedAt = new Date().toISOString()
    if (path === '/api/v1/export') {
      const archive = createWorkspaceExportArchive(state, exportedAt)
      const body = archive.buffer.slice(
        archive.byteOffset,
        archive.byteOffset + archive.byteLength,
      ) as ArrayBuffer
      return new Response(body, {
        headers: {
          'cache-control': 'no-store',
          'content-disposition': `attachment; filename="${workspaceExportFilename(state, exportedAt)}"`,
          'content-type': 'application/zip',
        },
      })
    }
    return json(
      {
        exportedAt,
        format: 'programkit.workspace.v1',
        state: publicState(state),
      },
      {
        headers: {
          'content-disposition': `attachment; filename="${state.workspace.slug}-export.json"`,
        },
      },
    )
  }

  if (request.method === 'GET' && path === '/public/agenda.json') {
    const state = await repository.read()
    return json(
      {
        event: state.events.find((event) => event.id === state.activeEventId),
        agenda: publicAgenda(state),
      },
      {
        headers: { 'cache-control': 'public, max-age=60' },
      },
    )
  }

  if (request.method === 'GET' && path === '/public/v1/program/state') {
    const state = await repository.read()
    return json(projectionPayload(publicProgramState(state)), {
      headers: { 'cache-control': 'public, max-age=60' },
    })
  }

  const publicSubmissionStateMatch = path.match(/^\/public\/v1\/submission-forms\/([^/]+)\/state$/u)
  if (request.method === 'GET' && publicSubmissionStateMatch) {
    const slug = decodeURIComponent(publicSubmissionStateMatch[1])
    const state = await repository.read()
    const projected = publicSubmissionState(
      state,
      slug,
      url.searchParams.get('speakerAccessKey') ?? '',
    )
    if (!projected) return json({ error: 'Submission form not found.' }, { status: 404 })
    return json(projectionPayload(projected))
  }

  const reviewerStateMatch = path.match(/^\/(?:api|public)\/v1\/reviewers\/([^/]+)\/state$/u)
  if (request.method === 'GET' && reviewerStateMatch) {
    const reviewerId = decodeURIComponent(reviewerStateMatch[1])
    if (actor.type !== 'reviewer' || actor.id !== reviewerId) {
      return json({ error: 'The reviewer session does not match this workspace.' }, { status: 403 })
    }
    const state = await repository.read()
    const projected = reviewerState(
      state,
      reviewerId,
      request.headers.get('x-programkit-reviewer-key') ?? '',
    )
    if (!projected) return json({ error: 'This reviewer link is unavailable.' }, { status: 403 })
    return json(projectionPayload(projected))
  }

  const portalStateMatch = path.match(/^\/(?:api|public)\/v1\/portal\/([^/]+)\/state$/u)
  if (request.method === 'GET' && portalStateMatch) {
    const participationId = decodeURIComponent(portalStateMatch[1])
    if (actor.type !== 'participant' || actor.id !== participationId) {
      return json({ error: 'The participant session does not match this portal.' }, { status: 403 })
    }
    const state = await repository.read()
    const projected = participantState(
      state,
      participationId,
      request.headers.get('x-programkit-portal-key') ?? '',
    )
    if (!projected) return json({ error: 'This speaker link is unavailable.' }, { status: 403 })
    return json({
      state: projected,
      derived: {
        readiness: readinessSummary(projected),
        scheduleConflicts: [],
      },
    })
  }

  const operatorOperation = path.startsWith('/api/v1/operations/')
    ? decodeURIComponent(path.slice('/api/v1/operations/'.length))
    : null
  const portalOperationMatch = path.match(
    /^\/(?:api|public)\/v1\/portal\/([^/]+)\/operations\/(.+)$/u,
  )
  const reviewerOperationMatch = path.match(
    /^\/(?:api|public)\/v1\/reviewers\/([^/]+)\/operations\/(.+)$/u,
  )
  const publicSubmissionOperationMatch = path.match(
    /^\/public\/v1\/submission-forms\/([^/]+)\/operations\/(.+)$/u,
  )
  if (
    request.method === 'POST' &&
    (operatorOperation ||
      portalOperationMatch ||
      reviewerOperationMatch ||
      publicSubmissionOperationMatch)
  ) {
    const participationId = portalOperationMatch
      ? decodeURIComponent(portalOperationMatch[1])
      : null
    if (participationId && (actor.type !== 'participant' || actor.id !== participationId)) {
      return json({ error: 'The participant session does not match this portal.' }, { status: 403 })
    }
    if (participationId) {
      const state = await repository.read()
      const validPortalLink = state.participations.some(
        (participation) =>
          participation.id === participationId &&
          participation.eventId === state.activeEventId &&
          participation.portalAccessKey === request.headers.get('x-programkit-portal-key'),
      )
      if (!validPortalLink) {
        return json({ error: 'This speaker link is unavailable.' }, { status: 403 })
      }
    }
    const reviewerId = reviewerOperationMatch ? decodeURIComponent(reviewerOperationMatch[1]) : null
    if (reviewerId && (actor.type !== 'reviewer' || actor.id !== reviewerId)) {
      return json({ error: 'The reviewer session does not match this workspace.' }, { status: 403 })
    }
    const submissionFormSlug = publicSubmissionOperationMatch
      ? decodeURIComponent(publicSubmissionOperationMatch[1])
      : null
    if (submissionFormSlug && (actor.type !== 'submitter' || actor.id !== submissionFormSlug)) {
      return json({ error: 'The submission session does not match this form.' }, { status: 403 })
    }
    if (
      operatorOperation &&
      (actor.type === 'participant' || actor.type === 'reviewer' || actor.type === 'submitter')
    ) {
      return json({ error: 'This actor cannot use operator operations.' }, { status: 403 })
    }
    const operation =
      operatorOperation ??
      decodeURIComponent(
        portalOperationMatch?.[2] ??
          reviewerOperationMatch?.[2] ??
          publicSubmissionOperationMatch?.[2] ??
          '',
      )
    if (
      reviewerId &&
      !['review.submit-scorecard', 'review.recuse', 'review.restore-recusal'].includes(operation)
    ) {
      return json(
        { error: 'That operation is not available in the reviewer workspace.' },
        {
          status: 403,
        },
      )
    }
    if (reviewerId) {
      const state = await repository.read()
      const validReviewerLink = state.reviewers.some(
        (reviewer) =>
          reviewer.id === reviewerId &&
          reviewer.eventId === state.activeEventId &&
          reviewer.accessKey === request.headers.get('x-programkit-reviewer-key'),
      )
      if (!validReviewerLink) {
        return json({ error: 'This reviewer link is unavailable.' }, { status: 403 })
      }
    }
    if (
      submissionFormSlug &&
      operation !== 'submission.create' &&
      operation !== 'submission.submit' &&
      operation !== 'submission.update'
    ) {
      return json(
        { error: 'That operation is not available on a public submission form.' },
        {
          status: 403,
        },
      )
    }
    try {
      const body = (await readJson(request)) as OperationRequest
      if (!body || typeof body !== 'object' || !body.input || typeof body.input !== 'object') {
        return json({ error: 'The request must include an input object.' }, { status: 400 })
      }
      const response = await repository.mutate((state) => {
        if (submissionFormSlug) {
          const form = state.submissionForms.find((entry) => entry.slug === submissionFormSlug)
          if (!form) throw new Error('Submission form not found.')
          if (operation === 'submission.create' && body.input.formId !== form.id) {
            throw new Error('This submission link cannot write to that form.')
          }
          if (operation === 'submission.submit' || operation === 'submission.update') {
            const submission = state.submissions.find(
              (entry) => entry.id === body.input.submissionId,
            )
            if (
              !submission ||
              submission.formId !== form.id ||
              submission.speakerAccessKey !== body.input.speakerAccessKey
            ) {
              throw new Error('This speaker link cannot update that submission.')
            }
          }
        }
        const result = executeOperation(state, operation, { ...body, actor })
        return { state: result.state, result: result.response }
      })
      return json(response, { status: response.ok ? 200 : 400 })
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : 'The request could not be processed.' },
        { status: 400 },
      )
    }
  }

  if (path.startsWith('/api/') || path.startsWith('/public/')) {
    return json({ error: 'Not found.' }, { status: 404 })
  }

  return null
}
