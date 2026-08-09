import { describe, expect, it } from 'vitest'

import {
  AIRTABLE_SCHEMA_VERSION,
  AirtableCachedWorkspaceRepository,
  MemoryWorkspaceRepository,
  airtableTableDefinitions,
  createAirtableWorkspaceBundle,
  createSeedState,
  rebuildWorkspaceFromAirtable,
  type AirtableRecord,
} from '@programkit/core'

function storedRecords(bundle: ReturnType<typeof createAirtableWorkspaceBundle>) {
  return Object.fromEntries(
    Object.entries(bundle.tables).map(([table, records]) => [
      table,
      records.map((record, index) => ({
        id: `rec_${table}_${index}`,
        fields: record.fields,
      })),
    ]),
  ) as Record<string, AirtableRecord[]>
}

describe('Airtable workspace persistence', () => {
  it('keeps every native collection out of the snapshot and rebuilds the full workspace', () => {
    const state = createSeedState()
    const bundle = createAirtableWorkspaceBundle(state, '2026-08-08T10:00:00.000Z')
    const snapshot = JSON.parse(
      String(bundle.tables['ProgramKit State'][0]?.fields['Snapshot JSON']),
    ) as Record<string, unknown[]>

    for (const definition of airtableTableDefinitions) {
      if (definition.collection) expect(snapshot[definition.collection]).toEqual([])
    }

    expect(rebuildWorkspaceFromAirtable(storedRecords(bundle))).toEqual(state)
  })

  it('applies allowlisted native Airtable edits while preserving the full JSON entity', () => {
    const state = createSeedState()
    const records = storedRecords(createAirtableWorkspaceBundle(state))
    const person = records.People?.find(
      (record) => record.fields['ProgramKit ID'] === state.people[0]?.id,
    )
    if (!person) throw new Error('Expected a projected person.')
    person.fields.Company = 'Edited in Airtable'
    person.fields.Email = 'airtable@example.com'

    const rebuilt = rebuildWorkspaceFromAirtable(records)

    expect(rebuilt.people[0]).toMatchObject({
      company: 'Edited in Airtable',
      email: 'airtable@example.com',
      bio: state.people[0]?.bio,
      tags: state.people[0]?.tags,
    })
  })

  it('refuses an unknown Airtable schema version', () => {
    const records = storedRecords(createAirtableWorkspaceBundle(createSeedState()))
    records['ProgramKit State'][0]!.fields['Schema Version'] = AIRTABLE_SCHEMA_VERSION + 1

    expect(() => rebuildWorkspaceFromAirtable(records)).toThrow(
      'Unsupported Airtable schema version',
    )
  })

  it('serves reads from cache and writes Airtable before updating that cache', async () => {
    const initial = createSeedState()
    const cache = new MemoryWorkspaceRepository(initial)
    const calls: string[] = []
    const repository = new AirtableCachedWorkspaceRepository(cache, {
      rebuildWorkspace: async () => {
        calls.push('rebuild')
        return initial
      },
      writeDelta: async (before, after) => {
        calls.push(`airtable:${before.revision}->${after.revision}`)
        expect((await cache.read()).revision).toBe(before.revision)
        return { requestCount: 2, upserted: 2, deleted: 0, changedTables: [] }
      },
    })

    await repository.read()
    expect(calls).toEqual([])

    await repository.mutate((state) => ({
      state: { ...state, revision: state.revision + 1 },
      result: 'saved',
    }))

    expect(calls).toEqual(['airtable:1->2'])
    expect((await repository.read()).revision).toBe(2)
  })

  it('does not acknowledge or cache a mutation that Airtable rejected', async () => {
    const initial = createSeedState()
    const cache = new MemoryWorkspaceRepository(initial)
    const repository = new AirtableCachedWorkspaceRepository(cache, {
      rebuildWorkspace: async () => initial,
      writeDelta: async () => {
        throw new Error('Airtable unavailable')
      },
    })

    await expect(
      repository.mutate((state) => ({
        state: { ...state, revision: state.revision + 1 },
        result: undefined,
      })),
    ).rejects.toThrow('Airtable unavailable')
    expect((await cache.read()).revision).toBe(initial.revision)
  })
})
