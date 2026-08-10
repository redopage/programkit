import type { WorkspaceState } from './types.ts'

export const AIRTABLE_SCHEMA_VERSION = 1

export type AirtableCellValue = string | number | boolean | null

export interface AirtableFieldDefinition {
  name: string
  type: 'singleLineText' | 'multilineText' | 'number' | 'checkbox'
  options?: Record<string, unknown>
}

export interface AirtableTableDefinition {
  name: string
  keyField: string
  fields: AirtableFieldDefinition[]
  collection?: NativeCollection
  editableFields?: Record<string, string>
}

export interface AirtableRecordFields {
  [field: string]: AirtableCellValue
}

export interface AirtableRecordInput {
  fields: AirtableRecordFields
}

export interface AirtableRecord extends AirtableRecordInput {
  id: string
}

export interface AirtableWorkspaceBundle {
  schemaVersion: number
  workspaceId: string
  revision: number
  tables: Record<string, AirtableRecordInput[]>
}

type NativeCollection =
  | 'events'
  | 'people'
  | 'participations'
  | 'submissions'
  | 'requirementInstances'
  | 'reviewerAssignments'
  | 'sessions'
  | 'placements'
  | 'tracks'
  | 'rooms'

type NativeEntity = WorkspaceState[NativeCollection][number]

const idField: AirtableFieldDefinition = { name: 'ProgramKit ID', type: 'singleLineText' }
const sortField: AirtableFieldDefinition = {
  name: 'ProgramKit Sort',
  type: 'number',
  options: { precision: 0 },
}
const jsonField: AirtableFieldDefinition = { name: 'ProgramKit JSON', type: 'multilineText' }
const versionField: AirtableFieldDefinition = {
  name: 'Version',
  type: 'number',
  options: { precision: 0 },
}

function text(name: string): AirtableFieldDefinition {
  return { name, type: 'singleLineText' }
}

function number(name: string): AirtableFieldDefinition {
  return { name, type: 'number', options: { precision: 0 } }
}

function checkbox(name: string): AirtableFieldDefinition {
  return { name, type: 'checkbox', options: { color: 'greenBright', icon: 'check' } }
}

export const airtableTableDefinitions: readonly AirtableTableDefinition[] = [
  {
    name: 'ProgramKit State',
    keyField: 'Workspace ID',
    fields: [
      text('Workspace ID'),
      text('Workspace Name'),
      number('Schema Version'),
      number('Revision'),
      text('Updated At'),
      { name: 'Snapshot JSON', type: 'multilineText' },
    ],
  },
  {
    name: 'Events',
    keyField: idField.name,
    collection: 'events',
    fields: [
      idField,
      sortField,
      text('Name'),
      text('Slug'),
      text('Status'),
      text('Starts At'),
      text('Ends At'),
      text('Timezone'),
      versionField,
      jsonField,
    ],
    editableFields: {
      Name: 'name',
      Slug: 'slug',
      Status: 'status',
      'Starts At': 'startsAt',
      'Ends At': 'endsAt',
      Timezone: 'timezone',
    },
  },
  {
    name: 'People',
    keyField: idField.name,
    collection: 'people',
    fields: [
      idField,
      sortField,
      text('First Name'),
      text('Last Name'),
      text('Email'),
      text('Company'),
      text('Job Title'),
      text('Timezone'),
      versionField,
      jsonField,
    ],
    editableFields: {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      Email: 'email',
      Company: 'company',
      'Job Title': 'title',
      Timezone: 'timezone',
    },
  },
  {
    name: 'Participations',
    keyField: idField.name,
    collection: 'participations',
    fields: [
      idField,
      sortField,
      text('Person ID'),
      text('Event ID'),
      text('Status'),
      text('Roles'),
      text('Updated At'),
      versionField,
      jsonField,
    ],
    editableFields: { Status: 'status' },
  },
  {
    name: 'Submissions',
    keyField: idField.name,
    collection: 'submissions',
    fields: [
      idField,
      sortField,
      text('Title'),
      text('Event ID'),
      text('Status'),
      text('Kind'),
      text('Submitted At'),
      text('Updated At'),
      versionField,
      jsonField,
    ],
    editableFields: { Status: 'status' },
  },
  {
    name: 'Tasks',
    keyField: idField.name,
    collection: 'requirementInstances',
    fields: [
      idField,
      sortField,
      text('Participation ID'),
      text('Definition ID'),
      text('Status'),
      text('Submitted At'),
      text('Reviewed At'),
      text('Updated At'),
      versionField,
      jsonField,
    ],
    editableFields: { Status: 'status' },
  },
  {
    name: 'Reviews',
    keyField: idField.name,
    collection: 'reviewerAssignments',
    fields: [
      idField,
      sortField,
      text('Submission ID'),
      text('Reviewer ID'),
      text('Round ID'),
      text('Status'),
      text('Due At'),
      text('Updated At'),
      versionField,
      jsonField,
    ],
    editableFields: { Status: 'status', 'Due At': 'dueAt' },
  },
  {
    name: 'Sessions',
    keyField: idField.name,
    collection: 'sessions',
    fields: [
      idField,
      sortField,
      text('Title'),
      text('Event ID'),
      text('Status'),
      text('Format'),
      text('Track ID'),
      number('Duration Minutes'),
      text('Updated At'),
      versionField,
      jsonField,
    ],
    editableFields: {
      Title: 'title',
      Status: 'status',
      Format: 'format',
      'Track ID': 'trackId',
      'Duration Minutes': 'durationMinutes',
    },
  },
  {
    name: 'Placements',
    keyField: idField.name,
    collection: 'placements',
    fields: [
      idField,
      sortField,
      text('Session ID'),
      text('Room ID'),
      text('Starts At'),
      text('Ends At'),
      number('Schedule Version'),
      checkbox('Published'),
      versionField,
      jsonField,
    ],
    editableFields: {
      'Room ID': 'roomId',
      'Starts At': 'startsAt',
      'Ends At': 'endsAt',
      Published: 'published',
    },
  },
  {
    name: 'Tracks',
    keyField: idField.name,
    collection: 'tracks',
    fields: [idField, sortField, text('Name'), text('Event ID'), text('Color'), jsonField],
    editableFields: { Name: 'name', Color: 'color' },
  },
  {
    name: 'Rooms',
    keyField: idField.name,
    collection: 'rooms',
    fields: [idField, sortField, text('Name'), text('Event ID'), number('Capacity'), jsonField],
    editableFields: { Name: 'name', Capacity: 'capacity' },
  },
] as const

function titleForSubmission(
  state: WorkspaceState,
  submission: WorkspaceState['submissions'][number],
) {
  const formFields = state.submissionFormFields.filter(
    (field) => field.formId === submission.formId,
  )
  const titleField = formFields.find((field) => field.purpose === 'proposal_title')
  const value = titleField
    ? (submission.answers[titleField.id] ?? submission.answers[titleField.key])
    : null
  return typeof value === 'string' ? value : submission.id
}

function nativeFields(
  state: WorkspaceState,
  collection: NativeCollection,
  entity: NativeEntity,
): AirtableRecordFields {
  const common: AirtableRecordFields = {
    'ProgramKit ID': entity.id,
    'ProgramKit JSON': JSON.stringify(entity),
  }

  switch (collection) {
    case 'events': {
      const event = entity as WorkspaceState['events'][number]
      return {
        ...common,
        Name: event.name,
        Slug: event.slug,
        Status: event.status,
        'Starts At': event.startsAt,
        'Ends At': event.endsAt,
        Timezone: event.timezone,
        Version: event.version,
      }
    }
    case 'people': {
      const person = entity as WorkspaceState['people'][number]
      return {
        ...common,
        'First Name': person.firstName,
        'Last Name': person.lastName,
        Email: person.email,
        Company: person.company,
        'Job Title': person.title,
        Timezone: person.timezone,
        Version: person.version,
      }
    }
    case 'participations': {
      const participation = entity as WorkspaceState['participations'][number]
      return {
        ...common,
        'Person ID': participation.personId,
        'Event ID': participation.eventId,
        Status: participation.status,
        Roles: participation.roles.join(', '),
        'Updated At': participation.updatedAt,
        Version: participation.version,
      }
    }
    case 'submissions': {
      const submission = entity as WorkspaceState['submissions'][number]
      return {
        ...common,
        Title: titleForSubmission(state, submission),
        'Event ID': submission.eventId,
        Status: submission.status,
        Kind: submission.kind,
        'Submitted At': submission.submittedAt,
        'Updated At': submission.updatedAt,
        Version: submission.version,
      }
    }
    case 'requirementInstances': {
      const task = entity as WorkspaceState['requirementInstances'][number]
      return {
        ...common,
        'Participation ID': task.participationId,
        'Definition ID': task.definitionId,
        Status: task.status,
        'Submitted At': task.submittedAt,
        'Reviewed At': task.reviewedAt,
        'Updated At': task.updatedAt,
        Version: task.version,
      }
    }
    case 'reviewerAssignments': {
      const review = entity as WorkspaceState['reviewerAssignments'][number]
      return {
        ...common,
        'Submission ID': review.submissionId,
        'Reviewer ID': review.reviewerId,
        'Round ID': review.roundId,
        Status: review.status,
        'Due At': review.dueAt,
        'Updated At': review.updatedAt,
        Version: review.version,
      }
    }
    case 'sessions': {
      const session = entity as WorkspaceState['sessions'][number]
      return {
        ...common,
        Title: session.title,
        'Event ID': session.eventId,
        Status: session.status,
        Format: session.format,
        'Track ID': session.trackId,
        'Duration Minutes': session.durationMinutes,
        'Updated At': session.updatedAt,
        Version: session.version,
      }
    }
    case 'placements': {
      const placement = entity as WorkspaceState['placements'][number]
      return {
        ...common,
        'Session ID': placement.sessionId,
        'Room ID': placement.roomId,
        'Starts At': placement.startsAt,
        'Ends At': placement.endsAt,
        'Schedule Version': placement.scheduleVersion,
        Published: placement.published,
        Version: placement.version,
      }
    }
    case 'tracks': {
      const track = entity as WorkspaceState['tracks'][number]
      return {
        ...common,
        Name: track.name,
        'Event ID': track.eventId,
        Color: track.color,
      }
    }
    case 'rooms': {
      const room = entity as WorkspaceState['rooms'][number]
      return {
        ...common,
        Name: room.name,
        'Event ID': room.eventId,
        Capacity: room.capacity,
      }
    }
  }
}

function baselineState(state: WorkspaceState) {
  const baseline = JSON.parse(JSON.stringify(state)) as WorkspaceState
  for (const definition of airtableTableDefinitions) {
    if (definition.collection) baseline[definition.collection] = [] as never
  }
  baseline.recentCommandResults = []
  return baseline
}

export function createAirtableWorkspaceBundle(
  state: WorkspaceState,
  updatedAt = new Date().toISOString(),
): AirtableWorkspaceBundle {
  const tables: Record<string, AirtableRecordInput[]> = {
    'ProgramKit State': [
      {
        fields: {
          'Workspace ID': state.workspace.id,
          'Workspace Name': state.workspace.name,
          'Schema Version': AIRTABLE_SCHEMA_VERSION,
          Revision: state.revision,
          'Updated At': updatedAt,
          'Snapshot JSON': JSON.stringify(baselineState(state)),
        },
      },
    ],
  }

  for (const definition of airtableTableDefinitions) {
    if (!definition.collection) continue
    const collection = state[definition.collection] as NativeEntity[]
    tables[definition.name] = collection.map((entity, index) => ({
      fields: {
        ...nativeFields(state, definition.collection as NativeCollection, entity),
        'ProgramKit Sort': index,
      },
    }))
  }

  return {
    schemaVersion: AIRTABLE_SCHEMA_VERSION,
    workspaceId: state.workspace.id,
    revision: state.revision,
    tables,
  }
}

function assertWorkspaceState(value: unknown): asserts value is WorkspaceState {
  if (!value || typeof value !== 'object') throw new Error('Airtable snapshot is not an object.')
  const state = value as Partial<WorkspaceState>
  if (!state.workspace || typeof state.workspace.id !== 'string') {
    throw new Error('Airtable snapshot is missing a workspace.')
  }
  if (typeof state.schemaVersion !== 'number' || typeof state.revision !== 'number') {
    throw new Error('Airtable snapshot has invalid version metadata.')
  }
}

function entityFromRecord(definition: AirtableTableDefinition, record: AirtableRecord) {
  const raw = record.fields['ProgramKit JSON']
  if (typeof raw !== 'string') {
    throw new Error(`${definition.name} record ${record.id} is missing ProgramKit JSON.`)
  }
  const entity = JSON.parse(raw) as Record<string, unknown>
  for (const [fieldName, property] of Object.entries(definition.editableFields ?? {})) {
    const value = record.fields[fieldName]
    if (value !== null && value !== undefined) entity[property] = value
  }
  return entity
}

export function rebuildWorkspaceFromAirtable(
  recordsByTable: Record<string, AirtableRecord[]>,
): WorkspaceState {
  const stateRecord = recordsByTable['ProgramKit State']?.[0]
  const snapshot = stateRecord?.fields['Snapshot JSON']
  if (typeof snapshot !== 'string') throw new Error('ProgramKit State is missing Snapshot JSON.')
  const state = JSON.parse(snapshot) as unknown
  assertWorkspaceState(state)

  const storedSchemaVersion = stateRecord.fields['Schema Version']
  if (storedSchemaVersion !== AIRTABLE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported Airtable schema version ${String(storedSchemaVersion)}. Expected ${AIRTABLE_SCHEMA_VERSION}.`,
    )
  }

  const storedRevision = stateRecord.fields.Revision
  if (typeof storedRevision === 'number') state.revision = storedRevision

  for (const definition of airtableTableDefinitions) {
    if (!definition.collection) continue
    const entities = [...(recordsByTable[definition.name] ?? [])]
      .sort((left, right) => {
        const leftSort = left.fields['ProgramKit Sort']
        const rightSort = right.fields['ProgramKit Sort']
        return (
          (typeof leftSort === 'number' ? leftSort : 0) -
          (typeof rightSort === 'number' ? rightSort : 0)
        )
      })
      .map((record) => entityFromRecord(definition, record))
    state[definition.collection] = entities as never
  }

  return state
}
