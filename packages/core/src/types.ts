export type Id = string
export type ISODateTime = string

export type ParticipationStatus = 'prospect' | 'invited' | 'confirmed' | 'declined' | 'withdrawn'

export type RequirementStatus =
  'not_started' | 'submitted' | 'revision_requested' | 'approved' | 'waived'

export type CampaignStatus = 'draft' | 'awaiting_approval' | 'approved' | 'sent'
export type ChangeSetStatus =
  'draft' | 'awaiting_approval' | 'approved' | 'rejected' | 'committed' | 'stale'

export interface Workspace {
  id: Id
  name: string
  slug: string
  timezone: string
}

export interface Event {
  id: Id
  name: string
  slug: string
  venue: string
  city: string
  startsAt: ISODateTime
  endsAt: ISODateTime
  timezone: string
  status: 'planning' | 'active' | 'complete'
  publishedScheduleVersion: number | null
}

export interface Person {
  id: Id
  firstName: string
  lastName: string
  email: string
  company: string
  title: string
  city: string
  timezone: string
  bio: string
  avatarUrl: string
  tags: string[]
  createdAt: ISODateTime
  updatedAt: ISODateTime
  version: number
}

export interface Participation {
  id: Id
  eventId: Id
  personId: Id
  roles: Array<'speaker' | 'moderator' | 'panelist' | 'chair' | 'workshop_lead'>
  status: ParticipationStatus
  sessionIds: Id[]
  internalNotes: string
  publicTitle: string
  publicCompany: string
  confirmedAt: ISODateTime | null
  updatedAt: ISODateTime
  version: number
}

export interface RequirementDefinition {
  id: Id
  eventId: Id
  label: string
  description: string
  kind: 'confirmation' | 'text' | 'file' | 'form' | 'approval'
  dueAt: ISODateTime
  required: boolean
}

export interface RequirementInstance {
  id: Id
  definitionId: Id
  participationId: Id
  status: RequirementStatus
  value: string
  submittedAt: ISODateTime | null
  reviewedAt: ISODateTime | null
  updatedAt: ISODateTime
  version: number
}

export interface Track {
  id: Id
  eventId: Id
  name: string
  color: 'emerald' | 'amber' | 'sky' | 'rose' | 'violet' | 'zinc'
}

export interface Room {
  id: Id
  eventId: Id
  name: string
  capacity: number
}

export interface Session {
  id: Id
  eventId: Id
  title: string
  format: 'keynote' | 'talk' | 'panel' | 'workshop' | 'break'
  summary: string
  trackId: Id
  participantIds: Id[]
  durationMinutes: number
  expectedAttendance: number
  status: 'draft' | 'ready' | 'cancelled'
  updatedAt: ISODateTime
  version: number
}

export interface Placement {
  id: Id
  eventId: Id
  sessionId: Id
  roomId: Id
  startsAt: ISODateTime
  endsAt: ISODateTime
  scheduleVersion: number
  published: boolean
  version: number
}

export interface Campaign {
  id: Id
  eventId: Id
  name: string
  subject: string
  body: string
  audience: 'all_active' | 'unconfirmed' | 'missing_requirements' | 'custom'
  recipientParticipationIds: Id[]
  status: CampaignStatus
  createdAt: ISODateTime
  approvedAt: ISODateTime | null
  sentAt: ISODateTime | null
  createdBy: string
  version: number
}

export interface Integration {
  id: Id
  name: string
  kind: 'email' | 'webhook' | 'calendar' | 'storage' | 'api'
  status: 'connected' | 'attention' | 'not_configured'
  detail: string
  lastSeenAt: ISODateTime | null
}

export interface Actor {
  type: 'staff' | 'participant' | 'agent' | 'service' | 'system'
  id: Id
  name: string
  scopes: string[]
}

export interface ScheduleRelease {
  readonly id: Id
  readonly eventId: Id
  readonly version: number
  readonly publishedAt: ISODateTime
  readonly publishedBy: Pick<Actor, 'type' | 'id' | 'name'>
  readonly placements: readonly Readonly<Placement>[]
}

export interface DomainEvent {
  id: Id
  sequence: number
  type: string
  occurredAt: ISODateTime
  actor: Pick<Actor, 'type' | 'id' | 'name'>
  aggregate: { type: string; id: Id; version: number }
  operation: string
  summary: string
  data: Record<string, unknown>
}

export interface ChangeOperation {
  operation: string
  input: Record<string, unknown>
  expectedVersions?: Record<string, number>
}

export interface ChangeSet {
  id: Id
  eventId: Id
  title: string
  description: string
  origin: 'human' | 'agent' | 'import' | 'automation'
  operations: ChangeOperation[]
  status: ChangeSetStatus
  impactSummary: string[]
  warnings: string[]
  createdBy: string
  approvedBy: string | null
  createdAt: ISODateTime
  updatedAt: ISODateTime
  committedEventIds: Id[]
  version: number
}

export interface StoredCommandResult {
  idempotencyKey: string
  operation: string
  actorKey: string
  requestFingerprint: string
  response: OperationResponse
  recordedAt: ISODateTime
}

export interface WorkspaceState {
  schemaVersion: number
  revision: number
  workspace: Workspace
  activeEventId: Id
  events: Event[]
  people: Person[]
  participations: Participation[]
  requirementDefinitions: RequirementDefinition[]
  requirementInstances: RequirementInstance[]
  tracks: Track[]
  rooms: Room[]
  sessions: Session[]
  placements: Placement[]
  scheduleReleases: ScheduleRelease[]
  campaigns: Campaign[]
  changeSets: ChangeSet[]
  integrations: Integration[]
  domainEvents: DomainEvent[]
  recentCommandResults: StoredCommandResult[]
}

export interface OperationRequest {
  input: Record<string, unknown>
  mode?: 'execute' | 'propose' | 'dry_run'
  expectedVersions?: Record<string, number>
  idempotencyKey?: string
  reason?: string
  actor?: Actor
}

export interface OperationResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: {
    code: string
    message: string
    fields?: Record<string, string>
  }
  eventIds: Id[]
  warnings: Array<{ code: string; message: string }>
  approvalRequired: boolean
  stateRevision: number
  traceId: string
}

export interface OperationDefinition {
  name: string
  title: string
  description: string
  kind: 'query' | 'command'
  scopes: string[]
  risk: 'read' | 'internal' | 'external' | 'public' | 'administrative'
  agentPolicy: 'read' | 'execute' | 'propose_only' | 'denied'
  reversible: boolean
  supportsDryRun: boolean
  requiredInput: string[]
  emits: string[]
}

export interface ReadinessRow {
  participationId: Id
  personId: Id
  personName: string
  company: string
  status: ParticipationStatus
  requirementStatuses: Record<Id, RequirementStatus>
  completed: number
  total: number
  blockers: number
  percent: number
}

export interface ScheduleConflict {
  id: string
  severity: 'error' | 'warning'
  type:
    | 'person_overlap'
    | 'room_overlap'
    | 'capacity'
    | 'missing_session'
    | 'missing_room'
    | 'missing_track'
    | 'missing_participant'
    | 'event_boundary'
    | 'duration_mismatch'
    | 'cancelled_session'
  message: string
  placementIds: Id[]
}
