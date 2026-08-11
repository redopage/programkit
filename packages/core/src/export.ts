import type { WorkspaceState } from './types.ts'
import { evaluationCriterionKind, evaluationRoundCriteria } from './reviews.ts'
import {
  submissionAnswerByPurpose,
  submissionAnswerDisplayByPurpose,
  submissionParticipants,
  submissionReviewSummary,
} from './selectors.ts'

const csvCollectionKeys = [
  'events',
  'people',
  'participations',
  'requirementDefinitions',
  'requirementInstances',
  'submissionForms',
  'submissionFormFields',
  'submissions',
  'assets',
  'assetComments',
  'reviewers',
  'reviewerTeams',
  'evaluationPlans',
  'reviewerAssignments',
  'scorecards',
  'reviewDecisions',
  'tracks',
  'rooms',
  'sessions',
  'placements',
  'scheduleReleases',
  'campaigns',
  'outboundMessages',
  'portalResourcePages',
  'changeSets',
  'integrations',
  'domainEvents',
  'recentCommandResults',
] as const satisfies readonly (keyof WorkspaceState)[]

type CsvCollectionKey = (typeof csvCollectionKeys)[number]
type FlatRecord = Record<string, string | number | boolean>

const fallbackColumns: Record<CsvCollectionKey, readonly string[]> = {
  events: [
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
  people: [
    'id',
    'firstName',
    'lastName',
    'email',
    'company',
    'title',
    'city',
    'timezone',
    'bio',
    'avatarUrl',
    'tags',
    'createdAt',
    'updatedAt',
    'version',
  ],
  participations: [
    'id',
    'eventId',
    'personId',
    'roles',
    'status',
    'sessionIds',
    'internalNotes',
    'publicTitle',
    'publicCompany',
    'confirmedAt',
    'updatedAt',
    'version',
  ],
  requirementDefinitions: [
    'id',
    'eventId',
    'label',
    'description',
    'kind',
    'dueAt',
    'required',
    'automaticReminders',
  ],
  requirementInstances: [
    'id',
    'definitionId',
    'participationId',
    'status',
    'value',
    'submittedAt',
    'reviewedAt',
    'updatedAt',
    'version',
  ],
  submissionForms: [
    'id',
    'eventId',
    'name',
    'slug',
    'title',
    'description',
    'status',
    'allowedKinds',
    'opensAt',
    'closesAt',
    'confirmationMessage',
    'updatedAt',
    'version',
  ],
  submissionFormFields: [
    'id',
    'formId',
    'key',
    'label',
    'description',
    'kind',
    'purpose',
    'required',
    'options',
    'placeholder',
    'sortOrder',
    'visibleWhen.fieldId',
    'visibleWhen.operator',
    'visibleWhen.value',
  ],
  submissions: [
    'id',
    'eventId',
    'formId',
    'kind',
    'status',
    'assetIds',
    'submittedAt',
    'decidedAt',
    'convertedParticipationId',
    'convertedSessionId',
    'createdAt',
    'updatedAt',
    'version',
  ],
  assets: [
    'id',
    'eventId',
    'owner.type',
    'owner.id',
    'kind',
    'filename',
    'contentType',
    'sizeBytes',
    'storageKey',
    'version',
    'isLatest',
    'sessionId',
    'uploadedBy.type',
    'uploadedBy.id',
    'uploadedBy.name',
    'createdAt',
  ],
  assetComments: [
    'id',
    'eventId',
    'assetId',
    'body',
    'author.type',
    'author.id',
    'author.name',
    'createdAt',
  ],
  reviewers: ['id', 'eventId', 'name', 'email', 'status', 'createdAt', 'version'],
  reviewerTeams: ['id', 'eventId', 'name', 'reviewerIds', 'version'],
  evaluationPlans: [
    'id',
    'eventId',
    'formId',
    'name',
    'reviewerTeamId',
    'submissionKinds',
    'blindReview',
    'rounds',
    'criteria',
    'version',
  ],
  reviewerAssignments: [
    'id',
    'eventId',
    'evaluationPlanId',
    'roundId',
    'submissionId',
    'reviewerId',
    'status',
    'dueAt',
    'updatedAt',
    'version',
  ],
  scorecards: [
    'id',
    'assignmentId',
    'recommendation',
    'comments',
    'submittedAt',
    'updatedAt',
    'version',
  ],
  reviewDecisions: [
    'id',
    'eventId',
    'submissionId',
    'decision',
    'reason',
    'decidedBy.type',
    'decidedBy.id',
    'decidedBy.name',
    'decidedAt',
    'version',
  ],
  tracks: ['id', 'eventId', 'name', 'color'],
  rooms: ['id', 'eventId', 'name', 'capacity'],
  sessions: [
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
  placements: [
    'id',
    'eventId',
    'sessionId',
    'roomId',
    'startsAt',
    'endsAt',
    'scheduleVersion',
    'published',
    'version',
  ],
  scheduleReleases: ['id', 'eventId', 'version', 'publishedAt', 'publishedBy', 'placements'],
  campaigns: [
    'id',
    'eventId',
    'name',
    'subject',
    'body',
    'audience',
    'recipientParticipationIds',
    'includeCalendarInvite',
    'status',
    'createdAt',
    'approvedAt',
    'sentAt',
    'createdBy',
    'version',
  ],
  outboundMessages: [
    'id',
    'eventId',
    'campaignId',
    'submissionId',
    'kind',
    'trigger',
    'recipientName',
    'recipientEmail',
    'subject',
    'body',
    'calendarAttachment',
    'status',
    'queuedAt',
    'sentAt',
    'providerMessageId',
    'attempts',
    'lastAttemptAt',
    'nextAttemptAt',
    'lastError',
  ],
  portalResourcePages: [
    'id',
    'eventId',
    'title',
    'slug',
    'summary',
    'body',
    'embedUrl',
    'linkUrl',
    'status',
    'sortOrder',
    'updatedAt',
    'version',
  ],
  changeSets: [
    'id',
    'eventId',
    'title',
    'description',
    'origin',
    'operations',
    'status',
    'impactSummary',
    'warnings',
    'createdBy',
    'approvedBy',
    'createdAt',
    'updatedAt',
    'committedEventIds',
    'version',
  ],
  integrations: ['id', 'name', 'kind', 'status', 'detail', 'lastSeenAt'],
  domainEvents: [
    'id',
    'sequence',
    'type',
    'occurredAt',
    'actor.type',
    'actor.id',
    'actor.name',
    'aggregate.type',
    'aggregate.id',
    'aggregate.version',
    'operation',
    'summary',
    'data',
  ],
  recentCommandResults: [
    'idempotencyKey',
    'operation',
    'actorKey',
    'requestFingerprint',
    'response',
    'recordedAt',
  ],
}

function kebabCase(value: string) {
  return value.replace(/([a-z0-9])([A-Z])/gu, '$1-$2').toLocaleLowerCase()
}

function flattenRecord(value: Record<string, unknown>, prefix = '', output: FlatRecord = {}) {
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (entry === null || entry === undefined) {
      output[path] = ''
    } else if (Array.isArray(entry)) {
      output[path] = entry.every(
        (item) => item === null || ['string', 'number', 'boolean'].includes(typeof item),
      )
        ? entry.map((item) => item ?? '').join(' | ')
        : JSON.stringify(entry)
    } else if (typeof entry === 'object') {
      const nested = Object.entries(entry as Record<string, unknown>)
      if (nested.length === 0) output[path] = ''
      else flattenRecord(entry as Record<string, unknown>, path, output)
    } else if (
      typeof entry === 'string' ||
      typeof entry === 'number' ||
      typeof entry === 'boolean'
    ) {
      output[path] = entry
    }
  }
  return output
}

function spreadsheetSafe(value: string | number | boolean | undefined) {
  const text = value === undefined ? '' : String(value)
  return /^[=+\-@]/u.test(text) ? `'${text}` : text
}

function csvCell(value: string | number | boolean | undefined) {
  return `"${spreadsheetSafe(value).replaceAll('"', '""')}"`
}

export function recordsToCsv(
  records: readonly Record<string, unknown>[],
  preferredColumns: readonly string[] = [],
) {
  const rows = records.map((record) => flattenRecord(record))
  const discovered = [...new Set(rows.flatMap((row) => Object.keys(row)))].sort((a, b) =>
    a.localeCompare(b),
  )
  const columns = [
    ...preferredColumns,
    ...discovered.filter((key) => !preferredColumns.includes(key)),
  ]
  const lines = [
    columns.map(csvCell).join(','),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(',')),
  ]
  return `\uFEFF${lines.join('\r\n')}\r\n`
}

export function createReviewResultsCsv(state: WorkspaceState) {
  const activeAssignments = state.reviewerAssignments.filter(
    (assignment) => assignment.eventId === state.activeEventId && assignment.status !== 'recused',
  )
  const submissionIds = new Set(activeAssignments.map((assignment) => assignment.submissionId))
  const numericCriteria = [
    ...new Map(
      state.evaluationPlans
        .filter((plan) => plan.eventId === state.activeEventId)
        .flatMap((plan) =>
          plan.rounds.flatMap((round) =>
            evaluationRoundCriteria(plan, round.id).filter(
              (criterion) => evaluationCriterionKind(criterion) === 'numeric',
            ),
          ),
        )
        .map((criterion) => [criterion.id, criterion]),
    ).values(),
  ]
  const rows = state.submissions
    .filter(
      (submission) =>
        submission.eventId === state.activeEventId && submissionIds.has(submission.id),
    )
    .map((submission) => {
      const review = submissionReviewSummary(state, submission.id)
      const assignments = activeAssignments.filter(
        (assignment) => assignment.submissionId === submission.id,
      )
      const assignmentIds = new Set(assignments.map((assignment) => assignment.id))
      const scorecards = state.scorecards.filter((scorecard) =>
        assignmentIds.has(scorecard.assignmentId),
      )
      const criterionAverages = Object.fromEntries(
        numericCriteria.map((criterion) => [
          criterion.label,
          review.criterionAverages[criterion.id] ?? '',
        ]),
      )
      return {
        submissionId: submission.id,
        title: submissionAnswerByPurpose(state, submission, 'proposal_title') ?? '',
        speakerFirstName: submissionAnswerByPurpose(state, submission, 'first_name') ?? '',
        speakerLastName: submissionAnswerByPurpose(state, submission, 'last_name') ?? '',
        participants: submissionParticipants(state, submission)
          .map(
            (participant) =>
              `${participant.firstName} ${participant.lastName} (${participant.roleLabel})`,
          )
          .join(' | '),
        track: submissionAnswerDisplayByPurpose(state, submission, 'track') ?? '',
        status: submission.status,
        assignedReviews: review.assigned,
        completedReviews: review.completed,
        weightedAggregate: review.averageScore ?? '',
        criterionAverages,
        recommendations: review.recommendations,
        reviewComments: scorecards
          .map((scorecard) => scorecard.comments)
          .filter((comment): comment is string => Boolean(comment))
          .join(' | '),
      }
    })

  return recordsToCsv(rows, [
    'submissionId',
    'title',
    'speakerFirstName',
    'speakerLastName',
    'participants',
    'track',
    'status',
    'assignedReviews',
    'completedReviews',
    'weightedAggregate',
  ])
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function zipTime(value: Date) {
  const year = Math.min(2107, Math.max(1980, value.getUTCFullYear()))
  return {
    date: ((year - 1980) << 9) | ((value.getUTCMonth() + 1) << 5) | value.getUTCDate(),
    time: (value.getUTCHours() << 11) | (value.getUTCMinutes() << 5) | (value.getUTCSeconds() >> 1),
  }
}

function concatenate(chunks: readonly Uint8Array[]) {
  const combined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
  let offset = 0
  for (const chunk of chunks) {
    combined.set(chunk, offset)
    offset += chunk.byteLength
  }
  return combined
}

export interface ZipFile {
  name: string
  text?: string
  data?: Uint8Array
}

export interface StoredAssetExportEntry {
  assetId: string
  storageKey: string
  path: string
  sizeBytes: number
}

function safeZipPathSegment(value: string, fallback: string) {
  const withoutControls = [...value.normalize('NFKC')]
    .map((character) => (character.codePointAt(0)! < 32 ? '-' : character))
    .join('')
  const normalized = withoutControls
    .replace(/[<>:"/\\|?*]+/gu, '-')
    .replace(/\s+/gu, ' ')
    .replace(/\.{2,}/gu, '.')
    .trim()
    .replace(/^[. -]+|[. -]+$/gu, '')
    .slice(0, 120)
  return normalized || fallback
}

function newestAsset<T extends WorkspaceState['assets'][number]>(assets: readonly T[]) {
  return [...assets].sort((left, right) => {
    const version = (right.version ?? 0) - (left.version ?? 0)
    if (version !== 0) return version
    const createdAt = right.createdAt.localeCompare(left.createdAt)
    return createdAt !== 0 ? createdAt : right.id.localeCompare(left.id)
  })[0]
}

/**
 * Resolve the exact latest requirement uploads that belong in an operator ZIP.
 * The plan is intentionally storage-agnostic so every host enforces the same
 * version and folder rules before reading private objects.
 */
export function createStoredAssetExportPlan(
  state: WorkspaceState,
  requestedIds: ReadonlySet<string>,
): StoredAssetExportEntry[] {
  const requirementAssets = state.assets.filter(
    (asset) => asset.eventId === state.activeEventId && asset.owner.type === 'requirement',
  )
  const assetsByRequirement = new Map<string, typeof requirementAssets>()
  for (const asset of requirementAssets) {
    const assets = assetsByRequirement.get(asset.owner.id) ?? []
    assets.push(asset)
    assetsByRequirement.set(asset.owner.id, assets)
  }
  const latestAssets = [...assetsByRequirement.values()]
    .map(
      (assets) =>
        newestAsset(assets.filter((asset) => asset.isLatest === true)) ?? newestAsset(assets),
    )
    .filter((asset) => asset && (requestedIds.size === 0 || requestedIds.has(asset.id)))

  const instances = new Map(state.requirementInstances.map((instance) => [instance.id, instance]))
  const definitions = new Map(
    state.requirementDefinitions.map((definition) => [definition.id, definition]),
  )
  const participations = new Map(
    state.participations.map((participation) => [participation.id, participation]),
  )
  const people = new Map(state.people.map((person) => [person.id, person]))
  const usedPaths = new Set<string>()

  return latestAssets
    .map((asset) => {
      const instance = instances.get(asset.owner.id)
      const definition = instance ? definitions.get(instance.definitionId) : undefined
      const participation = instance ? participations.get(instance.participationId) : undefined
      const person = participation ? people.get(participation.personId) : undefined
      const speaker = safeZipPathSegment(
        person ? `${person.firstName} ${person.lastName}` : 'Unknown speaker',
        'Unknown speaker',
      )
      const task = safeZipPathSegment(definition?.label ?? 'Other files', 'Other files')
      const filename = safeZipPathSegment(asset.filename, 'upload')
      const basePath = `${speaker}/${task}/${filename}`
      let path = basePath
      if (usedPaths.has(path.toLocaleLowerCase())) {
        const extensionAt = filename.lastIndexOf('.')
        const stem = extensionAt > 0 ? filename.slice(0, extensionAt) : filename
        const extension = extensionAt > 0 ? filename.slice(extensionAt) : ''
        path = `${speaker}/${task}/${stem}-${safeZipPathSegment(asset.id, 'file')}${extension}`
      }
      usedPaths.add(path.toLocaleLowerCase())
      return {
        assetId: asset.id,
        storageKey: asset.storageKey,
        path,
        sizeBytes: asset.sizeBytes,
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

export function createStoredZip(files: readonly ZipFile[], modifiedAt: Date) {
  const encoder = new TextEncoder()
  const localChunks: Uint8Array[] = []
  const centralChunks: Uint8Array[] = []
  const { date, time } = zipTime(modifiedAt)
  let localOffset = 0

  for (const file of files) {
    const name = encoder.encode(file.name)
    const data = file.data ?? encoder.encode(file.text ?? '')
    const checksum = crc32(data)
    const local = new Uint8Array(30 + name.byteLength)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, 0x0800, true)
    localView.setUint16(8, 0, true)
    localView.setUint16(10, time, true)
    localView.setUint16(12, date, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, data.byteLength, true)
    localView.setUint32(22, data.byteLength, true)
    localView.setUint16(26, name.byteLength, true)
    localView.setUint16(28, 0, true)
    local.set(name, 30)
    localChunks.push(local, data)

    const central = new Uint8Array(46 + name.byteLength)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, 0x0800, true)
    centralView.setUint16(10, 0, true)
    centralView.setUint16(12, time, true)
    centralView.setUint16(14, date, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, data.byteLength, true)
    centralView.setUint32(24, data.byteLength, true)
    centralView.setUint16(28, name.byteLength, true)
    centralView.setUint16(30, 0, true)
    centralView.setUint16(32, 0, true)
    centralView.setUint16(34, 0, true)
    centralView.setUint16(36, 0, true)
    centralView.setUint32(38, 0, true)
    centralView.setUint32(42, localOffset, true)
    central.set(name, 46)
    centralChunks.push(central)
    localOffset += local.byteLength + data.byteLength
  }

  const centralDirectory = concatenate(centralChunks)
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(4, 0, true)
  endView.setUint16(6, 0, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralDirectory.byteLength, true)
  endView.setUint32(16, localOffset, true)
  endView.setUint16(20, 0, true)
  return concatenate([...localChunks, centralDirectory, end])
}

export interface WorkspaceExportFile {
  name: string
  kind: 'readme' | 'manifest' | 'json' | 'csv'
  rows?: number
}

export function workspaceExportFilename(state: WorkspaceState, exportedAt: string) {
  const slug = state.workspace.slug.replace(/[^a-z0-9-]+/giu, '-').replace(/^-+|-+$/gu, '')
  return `${slug || 'programkit'}-export-${exportedAt.slice(0, 10)}.zip`
}

export function createWorkspaceExportArchive(state: WorkspaceState, exportedAt: string) {
  const cleanState = structuredClone(state)
  cleanState.recentCommandResults = []
  const jsonDocument = {
    exportedAt,
    format: 'programkit.workspace.v1',
    state: cleanState,
  }
  const csvFiles = csvCollectionKeys.map((key) => {
    const records = (cleanState[key] ?? []) as unknown as readonly Record<string, unknown>[]
    return {
      name: `csv/${kebabCase(key)}.csv`,
      kind: 'csv' as const,
      rows: records.length,
      text: recordsToCsv(records, fallbackColumns[key]),
    }
  })
  const workspaceCsv = recordsToCsv(
    [
      {
        ...cleanState.workspace,
        activeEventId: cleanState.activeEventId,
        schemaVersion: cleanState.schemaVersion,
        revision: cleanState.revision,
      },
    ],
    ['id', 'name', 'slug', 'timezone', 'activeEventId', 'schemaVersion', 'revision'],
  )
  const reviewResultsCsv = createReviewResultsCsv(cleanState)
  const reviewResultRows = new Set(
    cleanState.reviewerAssignments
      .filter(
        (assignment) =>
          assignment.eventId === cleanState.activeEventId && assignment.status !== 'recused',
      )
      .map((assignment) => assignment.submissionId),
  ).size
  const exportFiles: WorkspaceExportFile[] = [
    { name: 'README.txt', kind: 'readme' },
    { name: 'manifest.json', kind: 'manifest' },
    { name: 'workspace.json', kind: 'json' },
    { name: 'csv/workspace.csv', kind: 'csv', rows: 1 },
    { name: 'csv/review-results.csv', kind: 'csv', rows: reviewResultRows },
    ...csvFiles.map(({ name, kind, rows }) => ({ name, kind, rows })),
  ]
  const manifest = {
    format: 'programkit.export.v2',
    exportedAt,
    schemaVersion: cleanState.schemaVersion,
    revision: cleanState.revision,
    workspace: {
      id: cleanState.workspace.id,
      name: cleanState.workspace.name,
      slug: cleanState.workspace.slug,
      activeEventId: cleanState.activeEventId,
    },
    files: exportFiles,
    notes: [
      'workspace.json is the complete logical backup.',
      'CSV files use UTF-8, a header row, CRLF line endings, and spreadsheet-safe text values.',
      'csv/review-results.csv contains the human-readable scoring summary.',
      'Transient idempotency-cache records are intentionally omitted.',
      'Asset metadata is included. Download stored binaries separately from the Files page.',
    ],
  }
  const readme = [
    'ProgramKit export',
    '=================',
    '',
    `Workspace: ${cleanState.workspace.name}`,
    `Exported: ${exportedAt}`,
    `Schema version: ${cleanState.schemaVersion}`,
    `Revision: ${cleanState.revision}`,
    '',
    'workspace.json is the complete logical backup for machines and future restore tools.',
    'csv/ contains one human-readable file for every ProgramKit record collection.',
    'csv/review-results.csv summarizes scores, recommendations, and review comments.',
    'Nested fields use dot-separated column names. Lists use | separators when possible.',
    'manifest.json lists every file and row count.',
    '',
    'Asset metadata is included in csv/assets.csv and workspace.json.',
    'Download the latest stored headshots, slides, and documents from the Files page.',
    '',
  ].join('\r\n')
  const files: ZipFile[] = [
    { name: 'README.txt', text: readme },
    { name: 'manifest.json', text: `${JSON.stringify(manifest, null, 2)}\n` },
    { name: 'workspace.json', text: `${JSON.stringify(jsonDocument, null, 2)}\n` },
    { name: 'csv/workspace.csv', text: workspaceCsv },
    { name: 'csv/review-results.csv', text: reviewResultsCsv },
    ...csvFiles.map(({ name, text }) => ({ name, text })),
  ]
  return createStoredZip(files, new Date(exportedAt))
}
