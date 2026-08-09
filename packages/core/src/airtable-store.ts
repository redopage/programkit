import {
  airtableTableDefinitions,
  createAirtableWorkspaceBundle,
  rebuildWorkspaceFromAirtable,
  type AirtableRecord,
  type AirtableRecordFields,
  type AirtableRecordInput,
  type AirtableTableDefinition,
} from './airtable-schema.ts'
import type { WorkspaceState } from './types.ts'

interface AirtableStoreOptions {
  token: string
  baseId: string
  fetch?: typeof globalThis.fetch
  apiOrigin?: string
}

interface AirtableTableMetadata {
  id: string
  name: string
  fields: Array<{ id: string; name: string; type: string }>
}

interface AirtableListResponse {
  records: AirtableRecord[]
  offset?: string
}

export interface AirtableSchemaIssue {
  table: string
  field?: string
  message: string
}

export interface AirtableExportResult {
  requestCount: number
  recordCount: number
  tableCounts: Record<string, number>
}

export interface AirtableDeltaResult {
  requestCount: number
  upserted: number
  deleted: number
  changedTables: string[]
}

export class AirtableApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details: unknown,
  ) {
    super(message)
    this.name = 'AirtableApiError'
  }
}

function batches<T>(values: readonly T[], size = 10) {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function valueKey(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : null
}

export class AirtableWorkspaceStore {
  readonly #token: string
  readonly #baseId: string
  readonly #fetch: typeof globalThis.fetch
  readonly #apiOrigin: string
  #requestCount = 0

  constructor(options: AirtableStoreOptions) {
    this.#token = options.token
    this.#baseId = options.baseId
    this.#fetch = options.fetch ?? globalThis.fetch
    this.#apiOrigin = options.apiOrigin ?? 'https://api.airtable.com'
  }

  get requestCount() {
    return this.#requestCount
  }

  async #request<T>(path: string, init: RequestInit = {}) {
    this.#requestCount += 1
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${this.#token}`)
    if (init.body) headers.set('content-type', 'application/json')
    const response = await this.#fetch(`${this.#apiOrigin}${path}`, { ...init, headers })
    const text = await response.text()
    const body = text ? (JSON.parse(text) as unknown) : null
    if (!response.ok) {
      throw new AirtableApiError(
        `Airtable request failed with ${response.status}.`,
        response.status,
        body,
      )
    }
    return body as T
  }

  async schema() {
    const body = await this.#request<{ tables: AirtableTableMetadata[] }>(
      `/v0/meta/bases/${this.#baseId}/tables`,
    )
    return body.tables
  }

  async ensureSchema() {
    let tables = await this.schema()
    for (const definition of airtableTableDefinitions) {
      let table = tables.find((candidate) => candidate.name === definition.name)
      if (!table) {
        table = await this.#request<AirtableTableMetadata>(
          `/v0/meta/bases/${this.#baseId}/tables`,
          {
            method: 'POST',
            body: JSON.stringify({ name: definition.name, fields: definition.fields }),
          },
        )
        tables = [...tables, table]
        continue
      }

      for (const field of definition.fields) {
        if (table.fields.some((candidate) => candidate.name === field.name)) continue
        const created = await this.#request<{ id: string; name: string; type: string }>(
          `/v0/meta/bases/${this.#baseId}/tables/${table.id}/fields`,
          { method: 'POST', body: JSON.stringify(field) },
        )
        table.fields.push(created)
      }
    }
    return this.validateSchema(tables)
  }

  async validateSchema(tables?: AirtableTableMetadata[]) {
    const actualTables = tables ?? (await this.schema())
    const issues: AirtableSchemaIssue[] = []
    for (const definition of airtableTableDefinitions) {
      const table = actualTables.find((candidate) => candidate.name === definition.name)
      if (!table) {
        issues.push({ table: definition.name, message: 'Table is missing.' })
        continue
      }
      for (const field of definition.fields) {
        const actual = table.fields.find((candidate) => candidate.name === field.name)
        if (!actual) {
          issues.push({ table: definition.name, field: field.name, message: 'Field is missing.' })
        } else if (actual.type !== field.type) {
          issues.push({
            table: definition.name,
            field: field.name,
            message: `Expected ${field.type}, found ${actual.type}.`,
          })
        }
      }
    }
    return issues
  }

  async listRecords(tableName: string) {
    const records: AirtableRecord[] = []
    let offset: string | undefined
    do {
      const query = new URLSearchParams({ pageSize: '100' })
      if (offset) query.set('offset', offset)
      const body = await this.#request<AirtableListResponse>(
        `/v0/${this.#baseId}/${encodeURIComponent(tableName)}?${query}`,
      )
      records.push(...body.records)
      offset = body.offset
    } while (offset)
    return records
  }

  async #upsertRecords(definition: AirtableTableDefinition, records: AirtableRecordInput[]) {
    for (const batch of batches(records)) {
      await this.#request(`/v0/${this.#baseId}/${encodeURIComponent(definition.name)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          performUpsert: { fieldsToMergeOn: [definition.keyField] },
          records: batch,
          typecast: true,
        }),
      })
    }
  }

  async #deleteRecords(tableName: string, recordIds: string[]) {
    for (const batch of batches(recordIds)) {
      const query = new URLSearchParams()
      for (const id of batch) query.append('records[]', id)
      await this.#request(`/v0/${this.#baseId}/${encodeURIComponent(tableName)}?${query}`, {
        method: 'DELETE',
      })
    }
  }

  async #syncTable(definition: AirtableTableDefinition, desired: AirtableRecordInput[]) {
    const existing = await this.listRecords(definition.name)
    const desiredKeys = new Set(
      desired.map((record) => valueKey(record.fields[definition.keyField])).filter(Boolean),
    )
    const stale = existing
      .filter((record) => {
        const key = valueKey(record.fields[definition.keyField])
        return key !== null && !desiredKeys.has(key)
      })
      .map((record) => record.id)
    await this.#upsertRecords(definition, desired)
    await this.#deleteRecords(definition.name, stale)
  }

  async exportWorkspace(state: WorkspaceState): Promise<AirtableExportResult> {
    const requestStart = this.#requestCount
    const issues = await this.ensureSchema()
    if (issues.length > 0) {
      throw new Error(`Airtable schema validation failed: ${JSON.stringify(issues)}`)
    }
    const bundle = createAirtableWorkspaceBundle(state)
    for (const definition of airtableTableDefinitions) {
      await this.#syncTable(definition, bundle.tables[definition.name] ?? [])
    }
    const tableCounts = Object.fromEntries(
      Object.entries(bundle.tables).map(([table, records]) => [table, records.length]),
    )
    return {
      requestCount: this.#requestCount - requestStart,
      recordCount: Object.values(tableCounts).reduce((total, count) => total + count, 0),
      tableCounts,
    }
  }

  async writeDelta(before: WorkspaceState, after: WorkspaceState): Promise<AirtableDeltaResult> {
    const requestStart = this.#requestCount
    const beforeBundle = createAirtableWorkspaceBundle(before)
    const afterBundle = createAirtableWorkspaceBundle(after)
    const result: AirtableDeltaResult = {
      requestCount: 0,
      upserted: 0,
      deleted: 0,
      changedTables: [],
    }

    for (const definition of airtableTableDefinitions) {
      const beforeRecords = beforeBundle.tables[definition.name] ?? []
      const afterRecords = afterBundle.tables[definition.name] ?? []
      const beforeByKey = new Map(
        beforeRecords.map((record) => [valueKey(record.fields[definition.keyField]), record]),
      )
      const afterKeys = new Set(
        afterRecords.map((record) => valueKey(record.fields[definition.keyField])).filter(Boolean),
      )
      const changed = afterRecords.filter((record) => {
        const key = valueKey(record.fields[definition.keyField])
        const previous = beforeByKey.get(key)
        return !previous || JSON.stringify(previous.fields) !== JSON.stringify(record.fields)
      })
      const removedKeys = beforeRecords
        .map((record) => valueKey(record.fields[definition.keyField]))
        .filter((key): key is string => key !== null && !afterKeys.has(key))

      if (changed.length === 0 && removedKeys.length === 0) continue
      result.changedTables.push(definition.name)
      await this.#upsertRecords(definition, changed)
      result.upserted += changed.length

      if (removedKeys.length > 0) {
        const existing = await this.listRecords(definition.name)
        const removedSet = new Set(removedKeys)
        const recordIds = existing
          .filter((record) => {
            const key = valueKey(record.fields[definition.keyField])
            return key !== null && removedSet.has(key)
          })
          .map((record) => record.id)
        await this.#deleteRecords(definition.name, recordIds)
        result.deleted += recordIds.length
      }
    }

    result.requestCount = this.#requestCount - requestStart
    return result
  }

  async rebuildWorkspace() {
    const recordsByTable: Record<string, AirtableRecord[]> = {}
    for (const definition of airtableTableDefinitions) {
      recordsByTable[definition.name] = await this.listRecords(definition.name)
    }
    return rebuildWorkspaceFromAirtable(recordsByTable)
  }

  async updateRecord(tableName: string, recordId: string, fields: AirtableRecordFields) {
    return this.#request<AirtableRecord>(
      `/v0/${this.#baseId}/${encodeURIComponent(tableName)}/${recordId}`,
      { method: 'PATCH', body: JSON.stringify({ fields, typecast: true }) },
    )
  }
}
