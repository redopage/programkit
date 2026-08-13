import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

import { apiKeyScopes } from '../packages/core/src/api-keys.ts'
import { operationManifest } from '../packages/core/src/manifest.ts'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outputPath = resolve(repositoryRoot, 'docs/api/openapi.json')
const packageJson = JSON.parse(await readFile(resolve(repositoryRoot, 'package.json'), 'utf8'))
const grantableApiKeyScopes = new Set(apiKeyScopes)

const publicOperations = operationManifest.filter((operation) =>
  operation.scopes.every((scope) => grantableApiKeyScopes.has(scope)),
)

const numberInputs = new Set(['capacity', 'durationMinutes', 'expectedAttendance', 'sizeBytes'])
const arrayObjectInputs = new Set(['operations', 'people', 'rounds'])
const objectInputs = new Set(['answers'])

function inputSchema(name) {
  if (numberInputs.has(name)) return { type: 'integer' }
  if (arrayObjectInputs.has(name)) {
    return { type: 'array', minItems: 1, items: { type: 'object', additionalProperties: true } }
  }
  if (name.endsWith('Ids')) return { type: 'array', minItems: 1, items: { type: 'string' } }
  if (objectInputs.has(name)) return { type: 'object', additionalProperties: true }
  if (name === 'email') return { type: 'string', format: 'email' }
  if (name === 'at' || name.endsWith('At')) return { type: 'string', format: 'date-time' }
  return { type: 'string' }
}

function inputExample(name) {
  if (numberInputs.has(name)) return name === 'durationMinutes' ? 45 : 100
  if (name === 'answers') return { proposal_title: 'Dependable agent handoffs' }
  if (name === 'operations') {
    return [{ operation: 'session.update', input: { sessionId: 'ses_example' } }]
  }
  if (name === 'people') {
    return [{ firstName: 'Grace', lastName: 'Hopper', email: 'grace@example.com' }]
  }
  if (name === 'rounds') return [{ id: 'round_example', name: 'Editorial review' }]
  if (name.endsWith('Ids')) return [`${name.slice(0, -3).toLowerCase()}_example`]
  if (name === 'email') return 'grace@example.com'
  if (name === 'at' || name.endsWith('At')) return '2026-09-10T14:00:00.000Z'
  if (name.endsWith('Id')) return `${name.slice(0, -2).toLowerCase()}_example`
  const examples = {
    audience: 'all_active',
    body: 'Please review the attached program update.',
    contentType: 'application/pdf',
    decision: 'accepted',
    filename: 'speaker-slides.pdf',
    firstName: 'Grace',
    format: 'talk',
    internalNotes: 'Arrives on the morning flight.',
    kind: 'slides',
    label: 'Final slides',
    lastName: 'Hopper',
    mode: 'dynamic',
    name: 'Program update',
    output: 'json',
    ownerType: 'participation',
    stage: 'contacted',
    status: 'confirmed',
    storageKey: 'events/evt_example/assets/speaker-slides.pdf',
    subject: 'Your ProgramKit update',
    summary: 'A practical session about dependable agent handoffs.',
    title: 'Dependable agent handoffs',
    view: 'agenda',
  }
  return examples[name] ?? `Example ${name}`
}

function requestModes(operation) {
  const modes = ['execute']
  if (!operation.name.startsWith('change-set.')) modes.push('propose')
  if (operation.supportsDryRun) modes.push('dry_run')
  return modes
}

function operationId(name) {
  return `execute${name
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
    .map((part) => `${part[0].toUpperCase()}${part.slice(1)}`)
    .join('')}`
}

function operationRequestSchema(operation) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['input'],
    properties: {
      input: {
        type: 'object',
        additionalProperties: true,
        required: [...operation.requiredInput],
        properties: Object.fromEntries(
          operation.requiredInput.map((name) => [name, inputSchema(name)]),
        ),
      },
      mode: {
        type: 'string',
        enum: requestModes(operation),
        default: 'execute',
        description:
          'Use dry_run to validate without mutation or propose to create a reviewable change set.',
      },
      expectedVersions: {
        type: 'object',
        additionalProperties: { type: 'integer', minimum: 0 },
        description: 'Optional optimistic-concurrency versions keyed by record ID.',
      },
      idempotencyKey: {
        type: 'string',
        minLength: 1,
        description: 'A stable key for retries of the same logical command.',
      },
      reason: {
        type: 'string',
        description: 'Optional audit context for this operation.',
      },
    },
  }
}

function operationRequestExample(operation) {
  return {
    input: Object.fromEntries(operation.requiredInput.map((name) => [name, inputExample(name)])),
    mode: 'execute',
    idempotencyKey: `example-${operation.name.replaceAll('.', '-')}-1`,
  }
}

function listParameters() {
  return [
    {
      name: 'page',
      in: 'query',
      description: 'One-based page number.',
      schema: { type: 'integer', minimum: 1, default: 1 },
    },
    {
      name: 'pageSize',
      in: 'query',
      description: 'Number of results per page.',
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
    },
    {
      name: 'q',
      in: 'query',
      description: 'Case-insensitive text search.',
      schema: { type: 'string' },
    },
    {
      name: 'status',
      in: 'query',
      description: 'Exact resource status filter.',
      schema: { type: 'string' },
    },
  ]
}

function paginatedResponse(itemReference, description) {
  return {
    description,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['data', 'pagination'],
          properties: {
            data: { type: 'array', items: { $ref: itemReference } },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
      },
    },
  }
}

function standardReadResponses(success, includeNotFound = false) {
  return {
    200: success,
    401: { $ref: '#/components/responses/Unauthorized' },
    403: { $ref: '#/components/responses/Forbidden' },
    ...(includeNotFound ? { 404: { $ref: '#/components/responses/NotFound' } } : {}),
  }
}

const operationPaths = Object.fromEntries(
  publicOperations.map((operation) => [
    `/api/v1/operations/${operation.name}`,
    {
      post: {
        operationId: operationId(operation.name),
        tags: ['Named operations'],
        summary: operation.title,
        description: operation.description,
        security: [{ ProgramKitApiKey: [] }],
        'x-programkit-operation': operation.name,
        'x-programkit-scopes': [...operation.scopes],
        'x-programkit-risk': operation.risk,
        'x-programkit-agent-policy': operation.agentPolicy,
        'x-programkit-reversible': operation.reversible,
        'x-programkit-supports-dry-run': operation.supportsDryRun,
        'x-programkit-emits': [...operation.emits],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: operationRequestSchema(operation),
              examples: {
                request: {
                  summary: `${operation.title} request`,
                  value: operationRequestExample(operation),
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'The operation was accepted.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OperationResponse' },
                examples: {
                  success: {
                    value: {
                      ok: true,
                      data: {},
                      eventIds: ['evtlog_example'],
                      warnings: [],
                      approvalRequired: false,
                      stateRevision: 42,
                      traceId: 'trace_example',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'The operation failed validation or a domain rule.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/OperationResponse' },
              },
            },
          },
          401: { $ref: '#/components/responses/Unauthorized' },
          403: { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
  ]),
)

const document = {
  openapi: '3.1.0',
  jsonSchemaDialect: 'https://json-schema.org/draft/2020-12/schema',
  info: {
    title: 'ProgramKit Event API',
    version: packageJson.version,
    description:
      'The event-scoped integration API for ProgramKit. Every named write uses the same authorization, validation, idempotency, and audit path as the web application.',
    license: { name: packageJson.license },
  },
  servers: [
    { url: 'https://app.programkit.dev', description: 'Hosted ProgramKit' },
    { url: 'http://localhost:4173', description: 'Local ProgramKit' },
  ],
  tags: [
    { name: 'System', description: 'Workspace health and operation discovery.' },
    { name: 'Events', description: 'Event-scoped resource reads.' },
    { name: 'Exports', description: 'Portable workspace exports and domain events.' },
    {
      name: 'Named operations',
      description: 'Authorized, idempotent event mutations generated from the core manifest.',
    },
  ],
  security: [{ ProgramKitApiKey: [] }],
  'x-programkit-generated-from': ['packages/core/src/manifest.ts', 'packages/core/src/api-keys.ts'],
  paths: {
    '/api/v1/health': {
      get: {
        operationId: 'getEventApiHealth',
        tags: ['System'],
        summary: 'Read event workspace health',
        'x-programkit-scopes': [],
        responses: standardReadResponses({
          description: 'The current schema and workspace revision.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/HealthResponse' },
              examples: {
                healthy: { value: { ok: true, schemaVersion: 1, revision: 42 } },
              },
            },
          },
        }),
      },
    },
    '/api/v1/manifest': {
      get: {
        operationId: 'getOperationManifest',
        tags: ['System'],
        summary: 'Discover all named operations',
        description:
          'Returns the canonical operation manifest. Some staff- or demo-only operations cannot be granted to an API key and are therefore not exposed as write paths in this document.',
        'x-programkit-scopes': [],
        responses: standardReadResponses({
          description: 'The complete runtime operation manifest.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/OperationManifestResponse' },
              examples: {
                manifest: { value: { operations: operationManifest } },
              },
            },
          },
        }),
      },
    },
    '/api/v1/domain-events': {
      get: {
        operationId: 'listDomainEvents',
        tags: ['Exports'],
        summary: 'List recent domain events',
        description:
          'Returns newest accepted events first. This is an operator feed, not a webhook delivery guarantee.',
        'x-programkit-scopes': ['events:read'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            description: 'Maximum number of newest events to return.',
            schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        ],
        responses: standardReadResponses({
          description: 'Recent domain events.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['events'],
                properties: {
                  events: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/DomainEvent' },
                  },
                },
              },
            },
          },
        }),
      },
    },
    '/api/v1/events': {
      get: {
        operationId: 'listEvents',
        tags: ['Events'],
        summary: 'List accessible events',
        'x-programkit-scopes': ['workspace:read'],
        parameters: listParameters(),
        responses: standardReadResponses(
          paginatedResponse('#/components/schemas/Event', 'A page of accessible events.'),
        ),
      },
    },
    '/api/v1/events/{eventId}': {
      get: {
        operationId: 'getEvent',
        tags: ['Events'],
        summary: 'Read one event',
        'x-programkit-scopes': ['workspace:read'],
        parameters: [{ $ref: '#/components/parameters/EventId' }],
        responses: standardReadResponses(
          {
            description: 'The requested event.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['data'],
                  properties: { data: { $ref: '#/components/schemas/Event' } },
                },
              },
            },
          },
          true,
        ),
      },
    },
    '/api/v1/events/{eventId}/sessions': {
      get: {
        operationId: 'listEventSessions',
        tags: ['Events'],
        summary: 'List event sessions',
        'x-programkit-scopes': ['workspace:read'],
        parameters: [{ $ref: '#/components/parameters/EventId' }, ...listParameters()],
        responses: standardReadResponses(
          paginatedResponse('#/components/schemas/Session', 'A page of event sessions.'),
          true,
        ),
      },
    },
    '/api/v1/events/{eventId}/speakers': {
      get: {
        operationId: 'listEventSpeakers',
        tags: ['Events'],
        summary: 'List event speakers',
        'x-programkit-scopes': ['workspace:read'],
        parameters: [{ $ref: '#/components/parameters/EventId' }, ...listParameters()],
        responses: standardReadResponses(
          paginatedResponse('#/components/schemas/Speaker', 'A page of event speakers.'),
          true,
        ),
      },
    },
    '/api/v1/events/{eventId}/submissions': {
      get: {
        operationId: 'listEventSubmissions',
        tags: ['Events'],
        summary: 'List event submissions',
        'x-programkit-scopes': ['workspace:read'],
        parameters: [{ $ref: '#/components/parameters/EventId' }, ...listParameters()],
        responses: standardReadResponses(
          paginatedResponse('#/components/schemas/Submission', 'A page of event submissions.'),
          true,
        ),
      },
    },
    '/api/v1/export': {
      get: {
        operationId: 'downloadWorkspaceExport',
        tags: ['Exports'],
        summary: 'Download the portable workspace archive',
        'x-programkit-scopes': ['workspace:export'],
        responses: standardReadResponses({
          description:
            'A ZIP containing the lossless JSON backup, manifest, README, and CSV tables.',
          headers: {
            'Content-Disposition': {
              schema: { type: 'string' },
              description: 'Attachment filename for the export.',
            },
          },
          content: {
            'application/zip': {
              schema: { type: 'string', contentEncoding: 'base64' },
            },
          },
        }),
      },
    },
    '/api/v1/export.json': {
      get: {
        operationId: 'downloadWorkspaceJson',
        tags: ['Exports'],
        summary: 'Download the logical workspace document',
        'x-programkit-scopes': ['workspace:export'],
        responses: standardReadResponses({
          description: 'The versioned logical workspace export.',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/WorkspaceExport' },
            },
          },
        }),
      },
    },
    ...operationPaths,
  },
  components: {
    securitySchemes: {
      ProgramKitApiKey: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'pk_live_…',
        description:
          'An event-scoped key created by an owner or administrator. Send it only over HTTPS.',
      },
    },
    parameters: {
      EventId: {
        name: 'eventId',
        in: 'path',
        required: true,
        description: 'The stable event identifier selected by the API key.',
        schema: { type: 'string' },
      },
    },
    responses: {
      Unauthorized: {
        description: 'The API key is missing, invalid, expired, or revoked.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      Forbidden: {
        description: 'The actor does not have the scope required by this endpoint.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      NotFound: {
        description: 'The requested event-scoped resource was not found.',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        additionalProperties: true,
        required: ['error'],
        properties: { error: { type: 'string' } },
      },
      HealthResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'schemaVersion', 'revision'],
        properties: {
          ok: { type: 'boolean', const: true },
          schemaVersion: { type: 'integer', minimum: 1 },
          revision: { type: 'integer', minimum: 0 },
        },
      },
      OperationDefinition: {
        type: 'object',
        additionalProperties: false,
        required: [
          'name',
          'title',
          'description',
          'kind',
          'scopes',
          'risk',
          'agentPolicy',
          'reversible',
          'supportsDryRun',
          'requiredInput',
          'emits',
        ],
        properties: {
          name: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          kind: { type: 'string', enum: ['query', 'command'] },
          scopes: { type: 'array', items: { type: 'string' } },
          risk: {
            type: 'string',
            enum: ['read', 'internal', 'external', 'public', 'administrative'],
          },
          agentPolicy: {
            type: 'string',
            enum: ['read', 'execute', 'propose_only', 'denied'],
          },
          reversible: { type: 'boolean' },
          supportsDryRun: { type: 'boolean' },
          requiredInput: { type: 'array', items: { type: 'string' } },
          emits: { type: 'array', items: { type: 'string' } },
        },
      },
      OperationManifestResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['operations'],
        properties: {
          operations: {
            type: 'array',
            items: { $ref: '#/components/schemas/OperationDefinition' },
          },
        },
      },
      OperationResponse: {
        type: 'object',
        additionalProperties: false,
        required: ['ok', 'eventIds', 'warnings', 'approvalRequired', 'stateRevision', 'traceId'],
        properties: {
          ok: { type: 'boolean' },
          data: {},
          error: {
            type: 'object',
            additionalProperties: false,
            required: ['code', 'message'],
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              fields: {
                type: 'object',
                additionalProperties: { type: 'string' },
              },
            },
          },
          eventIds: { type: 'array', items: { type: 'string' } },
          warnings: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['code', 'message'],
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
              },
            },
          },
          approvalRequired: { type: 'boolean' },
          stateRevision: { type: 'integer', minimum: 0 },
          traceId: { type: 'string' },
        },
      },
      Pagination: {
        type: 'object',
        additionalProperties: false,
        required: ['currentPage', 'pageSize', 'totalPages', 'totalResults'],
        properties: {
          currentPage: { type: 'integer', minimum: 1 },
          pageSize: { type: 'integer', minimum: 1, maximum: 100 },
          totalPages: { type: 'integer', minimum: 0 },
          totalResults: { type: 'integer', minimum: 0 },
        },
      },
      Event: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'name',
          'slug',
          'venue',
          'city',
          'startsAt',
          'endsAt',
          'timezone',
          'status',
          'publishedScheduleVersion',
          'version',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          slug: { type: 'string' },
          logoUrl: { type: 'string' },
          venue: { type: 'string' },
          city: { type: 'string' },
          startsAt: { type: 'string', format: 'date-time' },
          endsAt: { type: 'string', format: 'date-time' },
          timezone: { type: 'string' },
          status: { type: 'string', enum: ['planning', 'active', 'complete'] },
          publishedScheduleVersion: { type: ['integer', 'null'], minimum: 1 },
          version: { type: 'integer', minimum: 1 },
        },
      },
      Session: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'eventId',
          'title',
          'format',
          'summary',
          'trackId',
          'participantIds',
          'durationMinutes',
          'expectedAttendance',
          'status',
          'updatedAt',
          'version',
        ],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          title: { type: 'string' },
          format: {
            type: 'string',
            enum: ['keynote', 'talk', 'lightning', 'panel', 'workshop', 'break'],
          },
          summary: { type: 'string' },
          trackId: { type: 'string' },
          participantIds: { type: 'array', items: { type: 'string' } },
          durationMinutes: { type: 'integer', minimum: 1 },
          expectedAttendance: { type: 'integer', minimum: 0 },
          status: { type: 'string', enum: ['draft', 'ready', 'cancelled'] },
          updatedAt: { type: 'string', format: 'date-time' },
          version: { type: 'integer', minimum: 1 },
        },
      },
      Speaker: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'eventId',
          'personId',
          'firstName',
          'lastName',
          'email',
          'title',
          'company',
          'biography',
          'roles',
          'status',
          'sessionIds',
          'updatedAt',
          'version',
        ],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          personId: { type: 'string' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          title: { type: 'string' },
          company: { type: 'string' },
          biography: { type: 'string' },
          roles: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['speaker', 'moderator', 'panelist', 'chair', 'workshop_lead'],
            },
          },
          status: {
            type: 'string',
            enum: ['prospect', 'invited', 'confirmed', 'declined', 'withdrawn'],
          },
          sessionIds: { type: 'array', items: { type: 'string' } },
          updatedAt: { type: 'string', format: 'date-time' },
          version: { type: 'integer', minimum: 1 },
        },
      },
      Submission: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'eventId',
          'formId',
          'kind',
          'status',
          'answers',
          'contributors',
          'speakerAccessKey',
          'assetIds',
          'submittedAt',
          'decidedAt',
          'convertedParticipationId',
          'convertedSessionId',
          'createdAt',
          'updatedAt',
          'version',
        ],
        properties: {
          id: { type: 'string' },
          eventId: { type: 'string' },
          formId: { type: 'string' },
          kind: { type: 'string', enum: ['abstract', 'guaranteed_session'] },
          status: {
            type: 'string',
            enum: [
              'draft',
              'submitted',
              'in_review',
              'waitlisted',
              'accepted',
              'rejected',
              'withdrawn',
            ],
          },
          answers: { type: 'object', additionalProperties: true },
          contributors: {
            type: 'array',
            items: { type: 'object', additionalProperties: true },
          },
          speakerAccessKey: { type: 'string' },
          assetIds: { type: 'array', items: { type: 'string' } },
          submittedAt: { type: ['string', 'null'], format: 'date-time' },
          decidedAt: { type: ['string', 'null'], format: 'date-time' },
          convertedParticipationId: { type: ['string', 'null'] },
          convertedSessionId: { type: ['string', 'null'] },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          version: { type: 'integer', minimum: 1 },
        },
      },
      DomainEvent: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'sequence',
          'type',
          'occurredAt',
          'actor',
          'aggregate',
          'operation',
          'summary',
          'data',
        ],
        properties: {
          id: { type: 'string' },
          sequence: { type: 'integer', minimum: 1 },
          type: { type: 'string' },
          occurredAt: { type: 'string', format: 'date-time' },
          actor: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'name'],
            properties: {
              type: { type: 'string' },
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          aggregate: {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'id', 'version'],
            properties: {
              type: { type: 'string' },
              id: { type: 'string' },
              version: { type: 'integer', minimum: 1 },
            },
          },
          operation: { type: 'string' },
          summary: { type: 'string' },
          data: { type: 'object', additionalProperties: true },
        },
      },
      WorkspaceExport: {
        type: 'object',
        additionalProperties: false,
        required: ['exportedAt', 'format', 'state'],
        properties: {
          exportedAt: { type: 'string', format: 'date-time' },
          format: { type: 'string', const: 'programkit.workspace.v1' },
          state: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
}

const prettierConfig = (await resolveConfig(outputPath)) ?? {}
const serialized = await format(JSON.stringify(document), { ...prettierConfig, parser: 'json' })
if (process.argv.includes('--check')) {
  let existing = ''
  try {
    existing = await readFile(outputPath, 'utf8')
  } catch {
    // The mismatch message below is more useful than a raw ENOENT.
  }
  if (existing !== serialized) {
    console.error('docs/api/openapi.json is stale. Run `pnpm openapi:generate`.')
    process.exitCode = 1
  } else {
    console.log(`OpenAPI contract is current (${publicOperations.length} named operations).`)
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, serialized)
  console.log(`Generated ${outputPath} with ${publicOperations.length} named operations.`)
}
