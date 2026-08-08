import {
  activeEvent,
  operationManifest,
  publicAgenda,
  readinessRows,
  readinessSummary,
  scheduleConflicts,
  type OperationRequest,
  type OperationResponse,
  type WorkspaceState,
} from '@crm-library/core'

const modernVersion = '2026-07-28'
const serverInfo = { name: 'program-ops', version: '0.1.0' }

export interface McpContext {
  readState: () => Promise<WorkspaceState>
  execute: (operation: string, request: OperationRequest) => Promise<OperationResponse>
}

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

const agentActor = {
  type: 'agent' as const,
  id: 'agent_program_ops',
  name: 'Program Ops Agent',
  scopes: [
    'people:read',
    'participations:read',
    'requirements:read',
    'schedule:read',
    'schedule:draft',
    'communications:draft',
    'changes:read',
    'changes:propose',
  ],
}

const emptySchema = { type: 'object', additionalProperties: false } as const

export const mcpTools = [
  {
    name: 'get_event_context',
    title: 'Get event context',
    description:
      'Read the active event, workspace, current operational summary, and relevant policy boundaries.',
    inputSchema: emptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'search_people',
    title: 'Search people',
    description:
      'Search people and return their event participation, roles, and readiness summary.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, email, company, or tag fragment.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
      },
      required: ['query'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_readiness_report',
    title: 'Get readiness report',
    description:
      'Return participant readiness with requirement-level statuses and traceable blocker counts.',
    inputSchema: {
      type: 'object',
      properties: {
        onlyBlockers: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_schedule',
    title: 'Get schedule',
    description:
      'Read the current draft schedule with sessions, rooms, tracks, and public speaker context.',
    inputSchema: emptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'validate_schedule',
    title: 'Validate schedule',
    description:
      'Detect participant overlaps, room collisions, missing records, and capacity warnings.',
    inputSchema: emptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'get_change_set',
    title: 'Get change set',
    description: 'Read one proposal, its operations, impact summary, warnings, and approval state.',
    inputSchema: {
      type: 'object',
      properties: { changeSetId: { type: 'string' } },
      required: ['changeSetId'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'list_change_sets',
    title: 'List change sets',
    description: 'List proposal IDs, origins, statuses, warnings, and summaries for review.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'awaiting_approval', 'approved', 'rejected', 'committed', 'stale'],
        },
      },
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'preflight_program_publish',
    title: 'Preflight program publication',
    description:
      'Check schedule integrity, scheduled participant confirmation, public profile completeness, pending changes, and published-release availability without publishing.',
    inputSchema: emptySchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  {
    name: 'draft_campaign',
    title: 'Draft campaign',
    description:
      'Create a campaign draft from a live audience segment. This cannot approve or send messages.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string' },
        audience: {
          type: 'string',
          enum: ['all_active', 'unconfirmed', 'missing_requirements'],
        },
      },
      required: ['name', 'subject', 'body', 'audience'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
  {
    name: 'propose_schedule_move',
    title: 'Propose schedule move',
    description:
      'Create a human-reviewable change set for one session move. This does not change or publish the schedule.',
    inputSchema: {
      type: 'object',
      properties: {
        placementId: { type: 'string' },
        roomId: { type: 'string' },
        startsAt: { type: 'string', format: 'date-time' },
        reason: { type: 'string' },
        expectedVersion: { type: 'integer', minimum: 1 },
      },
      required: ['placementId', 'roomId', 'startsAt', 'reason', 'expectedVersion'],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
  },
] as const

function resultWithServerInfo(result: unknown) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) return result
  const record = result as Record<string, unknown>
  return {
    ...record,
    _meta: {
      ...asObject(record._meta),
      'io.modelcontextprotocol/serverInfo': serverInfo,
    },
  }
}

function jsonRpcResult(id: string | number, result: unknown, status = 200) {
  return new Response(
    JSON.stringify({ jsonrpc: '2.0', id, result: resultWithServerInfo(result) }),
    {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    },
  )
}

function jsonRpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
  status = 400,
  data?: Record<string, unknown>,
) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message, ...(data ? { data } : {}) },
    }),
    {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    },
  )
}

interface InputSchema {
  type: 'object'
  properties?: Record<
    string,
    {
      type?: 'string' | 'integer' | 'boolean' | 'array' | 'object'
      enum?: readonly string[]
      minimum?: number
      maximum?: number
      format?: string
    }
  >
  required?: readonly string[]
  additionalProperties?: boolean
}

function validateToolArguments(name: string, args: Record<string, unknown>) {
  const tool = mcpTools.find((entry) => entry.name === name)
  if (!tool) throw new Error(`Unknown tool: ${name}.`)
  const schema = tool.inputSchema as InputSchema
  const properties = schema.properties ?? {}
  for (const field of schema.required ?? []) {
    if (!(field in args)) throw new Error(`${field} is required.`)
  }
  if (schema.additionalProperties === false) {
    const unexpected = Object.keys(args).find((field) => !(field in properties))
    if (unexpected) throw new Error(`${unexpected} is not a supported argument.`)
  }
  for (const [field, value] of Object.entries(args)) {
    const definition = properties[field]
    if (!definition) continue
    if (definition.type === 'string') {
      if (typeof value !== 'string') throw new Error(`${field} must be a string.`)
      if (definition.enum && !definition.enum.includes(value)) {
        throw new Error(`${field} must be one of: ${definition.enum.join(', ')}.`)
      }
      if (definition.format === 'date-time' && Number.isNaN(new Date(value).getTime())) {
        throw new Error(`${field} must be a valid ISO date-time.`)
      }
    } else if (definition.type === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        throw new Error(`${field} must be an integer.`)
      }
      if (definition.minimum !== undefined && value < definition.minimum) {
        throw new Error(`${field} must be at least ${definition.minimum}.`)
      }
      if (definition.maximum !== undefined && value > definition.maximum) {
        throw new Error(`${field} must be at most ${definition.maximum}.`)
      }
    } else if (definition.type === 'boolean' && typeof value !== 'boolean') {
      throw new Error(`${field} must be a boolean.`)
    } else if (definition.type === 'array' && !Array.isArray(value)) {
      throw new Error(`${field} must be an array.`)
    } else if (
      definition.type === 'object' &&
      (!value || typeof value !== 'object' || Array.isArray(value))
    ) {
      throw new Error(`${field} must be an object.`)
    }
  }
}

function toolResult(data: unknown, isError = false) {
  return {
    resultType: 'complete',
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
    isError,
  }
}

function asObject(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function asString(value: unknown, field: string) {
  if (typeof value !== 'string' || value.trim().length === 0)
    throw new Error(`${field} is required.`)
  return value.trim()
}

function latestScheduleRelease(state: WorkspaceState) {
  return (
    state.scheduleReleases
      .filter((release) => release.eventId === state.activeEventId)
      .sort((left, right) => right.version - left.version)[0] ?? null
  )
}

function validOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return true
  try {
    const originUrl = new URL(origin)
    const requestUrl = new URL(request.url)
    return (
      originUrl.host === requestUrl.host ||
      (['localhost', '127.0.0.1'].includes(originUrl.hostname) &&
        ['localhost', '127.0.0.1'].includes(requestUrl.hostname))
    )
  } catch {
    return false
  }
}

function requestVersion(message: JsonRpcRequest) {
  const meta = asObject(asObject(message.params)._meta)
  return typeof meta['io.modelcontextprotocol/protocolVersion'] === 'string'
    ? meta['io.modelcontextprotocol/protocolVersion']
    : null
}

function decodeRoutingHeader(value: string | null) {
  if (value === null) return null
  if (!value.startsWith('=?base64?')) return value
  const match = value.match(/^=\?base64\?([A-Za-z0-9+/]*={0,2})\?=$/u)
  if (!match) throw new Error('The encoded routing header is malformed.')
  try {
    const bytes = Uint8Array.from(atob(match[1]), (character) => character.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new Error('The encoded routing header could not be decoded.')
  }
}

function validateModernHeaders(request: Request, message: JsonRpcRequest) {
  const bodyVersion = requestVersion(message)
  const headerVersion = request.headers.get('mcp-protocol-version')
  if (!bodyVersion || !headerVersion || bodyVersion !== headerVersion) {
    return jsonRpcError(
      message.id,
      -32020,
      'MCP protocol metadata is missing or does not match.',
      400,
    )
  }
  if (bodyVersion !== modernVersion) {
    return jsonRpcError(message.id, -32022, 'Unsupported protocol version', 400, {
      supported: [modernVersion],
      requested: bodyVersion,
    })
  }
  const meta = asObject(asObject(message.params)._meta)
  const clientCapabilities = meta['io.modelcontextprotocol/clientCapabilities']
  if (
    !clientCapabilities ||
    typeof clientCapabilities !== 'object' ||
    Array.isArray(clientCapabilities)
  ) {
    return jsonRpcError(
      message.id,
      -32021,
      'The request is missing required client capabilities.',
      400,
    )
  }
  if (request.headers.get('mcp-method') !== message.method) {
    return jsonRpcError(
      message.id,
      -32020,
      'Mcp-Method header does not match the request body.',
      400,
    )
  }
  if (message.method === 'tools/call' || message.method === 'resources/read') {
    const name =
      message.method === 'tools/call' ? asObject(message.params).name : asObject(message.params).uri
    let headerName: string | null
    try {
      headerName = decodeRoutingHeader(request.headers.get('mcp-name'))
    } catch (error) {
      return jsonRpcError(
        message.id,
        -32020,
        error instanceof Error ? error.message : 'Mcp-Name is malformed.',
        400,
      )
    }
    if (headerName !== name) {
      return jsonRpcError(
        message.id,
        -32020,
        'Mcp-Name header does not match the request body.',
        400,
      )
    }
  }
  return null
}

async function callTool(name: string, args: Record<string, unknown>, context: McpContext) {
  const state = await context.readState()
  if (name === 'get_event_context') {
    return toolResult({
      workspace: state.workspace,
      event: activeEvent(state),
      readiness: readinessSummary(state),
      pendingChangeSets: state.changeSets.filter(
        (changeSet) => changeSet.status === 'awaiting_approval',
      ).length,
      policy: {
        agentCanDraft: true,
        agentMustProposeScheduleChanges: true,
        humanOnly: ['approve', 'commit', 'send', 'publish', 'manage secrets'],
      },
    })
  }
  if (name === 'search_people') {
    const query = asString(args.query, 'query').toLowerCase()
    const limit =
      typeof args.limit === 'number' ? Math.min(Math.max(Math.floor(args.limit), 1), 50) : 20
    const readiness = readinessRows(state)
    const records = state.people
      .filter((person) =>
        `${person.firstName} ${person.lastName} ${person.email} ${person.company} ${person.tags.join(' ')}`
          .toLowerCase()
          .includes(query),
      )
      .slice(0, limit)
      .map((person) => {
        const participation = state.participations.find((entry) => entry.personId === person.id)
        return {
          person,
          participation,
          readiness: readiness.find((row) => row.personId === person.id),
        }
      })
    return toolResult({ records, count: records.length })
  }
  if (name === 'get_readiness_report') {
    const onlyBlockers = args.onlyBlockers === true
    const rows = readinessRows(state).filter((row) => !onlyBlockers || row.blockers > 0)
    return toolResult({
      generatedAt: new Date().toISOString(),
      summary: readinessSummary(state),
      requirementDefinitions: state.requirementDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.label,
        required: definition.required,
        dueAt: definition.dueAt,
      })),
      rows,
    })
  }
  if (name === 'get_schedule') {
    return toolResult({
      event: activeEvent(state),
      placements: state.placements
        .filter((placement) => placement.eventId === state.activeEventId)
        .map((placement) => ({
          placement,
          session: state.sessions.find((entry) => entry.id === placement.sessionId),
          room: state.rooms.find((entry) => entry.id === placement.roomId),
          track: state.tracks.find(
            (entry) =>
              entry.id ===
              state.sessions.find((session) => session.id === placement.sessionId)?.trackId,
          ),
        })),
      latestPublishedRelease: latestScheduleRelease(state),
      revision: state.revision,
    })
  }
  if (name === 'validate_schedule') {
    const conflicts = scheduleConflicts(state)
    return toolResult({
      status: conflicts.some((conflict) => conflict.severity === 'error') ? 'blocked' : 'valid',
      conflicts,
      hardErrors: conflicts.filter((conflict) => conflict.severity === 'error').length,
      warnings: conflicts.filter((conflict) => conflict.severity === 'warning').length,
    })
  }
  if (name === 'get_change_set') {
    const changeSetId = asString(args.changeSetId, 'changeSetId')
    const changeSet = state.changeSets.find((entry) => entry.id === changeSetId)
    return changeSet
      ? toolResult({ changeSet })
      : toolResult({ error: 'Change set not found.', changeSetId }, true)
  }
  if (name === 'list_change_sets') {
    const status = typeof args.status === 'string' ? args.status : null
    const changeSets = state.changeSets
      .filter((changeSet) => !status || changeSet.status === status)
      .map((changeSet) => ({
        id: changeSet.id,
        title: changeSet.title,
        description: changeSet.description,
        origin: changeSet.origin,
        status: changeSet.status,
        operations: changeSet.operations.map((operation) => operation.operation),
        warnings: changeSet.warnings,
        impactSummary: changeSet.impactSummary,
        createdBy: changeSet.createdBy,
        updatedAt: changeSet.updatedAt,
        version: changeSet.version,
      }))
    return toolResult({ changeSets, count: changeSets.length })
  }
  if (name === 'preflight_program_publish') {
    const conflicts = scheduleConflicts(state)
    const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error')
    const scheduledParticipationIds = new Set(
      state.sessions
        .filter((session) =>
          state.placements.some((placement) => placement.sessionId === session.id),
        )
        .flatMap((session) => session.participantIds),
    )
    const participantBlockers = [...scheduledParticipationIds].flatMap((participationId) => {
      const participation = state.participations.find((entry) => entry.id === participationId)
      const person = participation
        ? state.people.find((entry) => entry.id === participation.personId)
        : null
      const issues: string[] = []
      if (!participation || !person) issues.push('record is missing')
      else {
        if (participation.status !== 'confirmed') issues.push('participation is not confirmed')
        if (!participation.publicTitle || !participation.publicCompany || !person.bio) {
          issues.push('public profile is incomplete')
        }
      }
      return issues.length > 0 ? [{ participationId, personId: person?.id ?? null, issues }] : []
    })
    const pendingChangeSets = state.changeSets
      .filter((changeSet) => ['awaiting_approval', 'approved', 'stale'].includes(changeSet.status))
      .map((changeSet) => ({ id: changeSet.id, title: changeSet.title, status: changeSet.status }))
    const blockers = [
      ...(hardConflicts.length > 0 ? [`${hardConflicts.length} hard schedule conflicts`] : []),
      ...(participantBlockers.length > 0
        ? [`${participantBlockers.length} scheduled participants need attention`]
        : []),
    ]
    const warnings = [
      ...conflicts
        .filter((conflict) => conflict.severity === 'warning')
        .map((conflict) => conflict.message),
      ...(pendingChangeSets.length > 0
        ? [`${pendingChangeSets.length} unresolved change sets remain`]
        : []),
    ]
    return toolResult({
      status: blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'PASS WITH WARNINGS' : 'PASS',
      blockers,
      warnings,
      hardConflicts,
      participantBlockers,
      pendingChangeSets,
      latestPublishedRelease: latestScheduleRelease(state)?.id ?? null,
      exportAvailable: true,
    })
  }
  if (name === 'draft_campaign') {
    const response = await context.execute('campaign.create-draft', {
      input: {
        name: asString(args.name, 'name'),
        subject: asString(args.subject, 'subject'),
        body: asString(args.body, 'body'),
        audience: asString(args.audience, 'audience'),
      },
      actor: agentActor,
      idempotencyKey: crypto.randomUUID(),
    })
    return toolResult(
      response.ok
        ? {
            status: 'draft',
            approvalRequiredBeforeSend: true,
            result: response.data,
            traceId: response.traceId,
          }
        : { error: response.error, traceId: response.traceId },
      !response.ok,
    )
  }
  if (name === 'propose_schedule_move') {
    const placementId = asString(args.placementId, 'placementId')
    const response = await context.execute('schedule.move-session', {
      input: {
        placementId,
        roomId: asString(args.roomId, 'roomId'),
        startsAt: asString(args.startsAt, 'startsAt'),
      },
      mode: 'propose',
      reason: asString(args.reason, 'reason'),
      expectedVersions: { [placementId]: Number(args.expectedVersion) },
      actor: agentActor,
      idempotencyKey: crypto.randomUUID(),
    })
    return toolResult(
      response.ok
        ? {
            status: 'awaiting_approval',
            approvalRequired: true,
            result: response.data,
            traceId: response.traceId,
          }
        : { error: response.error, traceId: response.traceId },
      !response.ok,
    )
  }
  return toolResult({ error: `Unknown tool: ${name}.` }, true)
}

function listedResources() {
  return [
    {
      uri: 'ops://workspace/manifest',
      name: 'operation-manifest',
      title: 'Operation manifest',
      description: 'Typed capabilities and agent policies.',
      mimeType: 'application/json',
    },
    {
      uri: 'ops://events/current/summary',
      name: 'event-summary',
      title: 'Active event summary',
      description: 'Current event and operational health.',
      mimeType: 'application/json',
    },
    {
      uri: 'ops://events/current/readiness',
      name: 'readiness-report',
      title: 'Readiness report',
      description: 'Participant readiness with blockers.',
      mimeType: 'application/json',
    },
    {
      uri: 'ops://events/current/schedule',
      name: 'draft-schedule',
      title: 'Draft schedule',
      description: 'Current placements and conflicts.',
      mimeType: 'application/json',
    },
    {
      uri: 'ops://events/current/preflight',
      name: 'program-preflight',
      title: 'Program publication preflight',
      description: 'Current blockers and warnings before agenda publication.',
      mimeType: 'application/json',
    },
  ]
}

async function readResource(uri: string, context: McpContext) {
  const state = await context.readState()
  let data: unknown
  if (uri === 'ops://workspace/manifest') data = { operations: operationManifest }
  else if (uri === 'ops://events/current/summary')
    data = { event: activeEvent(state), readiness: readinessSummary(state) }
  else if (uri === 'ops://events/current/readiness')
    data = { summary: readinessSummary(state), rows: readinessRows(state) }
  else if (uri === 'ops://events/current/schedule')
    data = { agenda: publicAgenda(state), conflicts: scheduleConflicts(state) }
  else if (uri === 'ops://events/current/preflight') {
    const preflight = await callTool('preflight_program_publish', {}, context)
    data = preflight.structuredContent
  } else return null
  return { uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
}

export async function handleMcpRequest(request: Request, context: McpContext) {
  if (request.method !== 'POST')
    return new Response('Method not allowed.', { status: 405, headers: { allow: 'POST' } })
  if (!validOrigin(request)) return jsonRpcError(null, -32600, 'Origin is not allowed.', 403)

  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return jsonRpcError(null, -32700, 'Parse error.', 400)
  }
  const candidate = asObject(parsed)
  const validId =
    typeof candidate.id === 'string' ||
    (typeof candidate.id === 'number' && Number.isInteger(candidate.id))
  if (
    candidate.jsonrpc !== '2.0' ||
    typeof candidate.method !== 'string' ||
    !validId ||
    !candidate.params ||
    typeof candidate.params !== 'object' ||
    Array.isArray(candidate.params)
  ) {
    return jsonRpcError(
      typeof candidate.id === 'string' || typeof candidate.id === 'number' ? candidate.id : null,
      -32600,
      'Invalid request.',
      400,
    )
  }
  const message = candidate as unknown as JsonRpcRequest

  const validation = validateModernHeaders(request, message)
  if (validation) return validation

  if (message.method === 'server/discover') {
    return jsonRpcResult(message.id, {
      resultType: 'complete',
      supportedVersions: [modernVersion],
      capabilities: { tools: {}, resources: {} },
      instructions:
        'Read operational records, draft safely, and create proposals for schedule changes. Sending and publishing are human-only.',
      ttlMs: 300_000,
      cacheScope: 'public',
    })
  }

  if (message.method === 'tools/list') {
    return jsonRpcResult(message.id, {
      resultType: 'complete',
      tools: mcpTools,
      ttlMs: 300_000,
      cacheScope: 'private',
    })
  }

  if (message.method === 'tools/call') {
    const params = asObject(message.params)
    try {
      const name = asString(params.name, 'name')
      const args = asObject(params.arguments)
      validateToolArguments(name, args)
      return jsonRpcResult(message.id, await callTool(name, args, context))
    } catch (error) {
      return jsonRpcResult(
        message.id,
        toolResult({ error: error instanceof Error ? error.message : 'Tool call failed.' }, true),
      )
    }
  }

  if (message.method === 'resources/list') {
    return jsonRpcResult(message.id, {
      resultType: 'complete',
      resources: listedResources(),
      ttlMs: 60_000,
      cacheScope: 'private',
    })
  }

  if (message.method === 'resources/read') {
    try {
      const uri = asString(asObject(message.params).uri, 'uri')
      const content = await readResource(uri, context)
      if (!content) return jsonRpcError(message.id, -32602, 'Resource not found.', 400)
      return jsonRpcResult(message.id, {
        resultType: 'complete',
        contents: [content],
        ttlMs: 30_000,
        cacheScope: 'private',
      })
    } catch (error) {
      return jsonRpcError(
        message.id,
        -32602,
        error instanceof Error ? error.message : 'Resource request is invalid.',
        400,
      )
    }
  }

  return jsonRpcError(message.id, -32601, 'Method not found.', 404)
}
