import { describe, expect, it } from 'vitest'

import { reconcileAirtableRecord } from '@programkit/core'

describe('Airtable reconciliation', () => {
  it('separates outbound repairs from previewable inbound edits', () => {
    const result = reconcileAirtableRecord({
      lastSynced: { title: 'Old title', status: 'submitted', notes: '' },
      programKit: { title: 'ProgramKit title', status: 'in_review', notes: '' },
      airtable: { title: 'Old title', status: 'submitted', notes: 'Discuss on Friday' },
      editableFields: ['title', 'notes'],
    })

    expect(result).toEqual({
      pushToAirtable: [
        { field: 'status', value: 'in_review' },
        { field: 'title', value: 'ProgramKit title' },
      ],
      proposeToProgramKit: [{ field: 'notes', value: 'Discuss on Friday' }],
      conflicts: [],
      convergedFields: [],
    })
  })

  it('reports concurrent edits instead of choosing a winner', () => {
    const result = reconcileAirtableRecord({
      lastSynced: { track: 'Build' },
      programKit: { track: 'Operate' },
      airtable: { track: 'Society' },
      editableFields: ['track'],
    })

    expect(result.conflicts).toEqual([
      {
        field: 'track',
        lastSyncedValue: 'Build',
        programKitValue: 'Operate',
        airtableValue: 'Society',
      },
    ])
    expect(result.pushToAirtable).toEqual([])
    expect(result.proposeToProgramKit).toEqual([])
  })

  it('recognizes matching edits and repairs read-only fields from ProgramKit', () => {
    const result = reconcileAirtableRecord({
      lastSynced: { title: 'Draft', programKitId: 'sub_001' },
      programKit: { title: 'Final', programKitId: 'sub_001' },
      airtable: { title: 'Final', programKitId: 'changed-in-airtable' },
      editableFields: ['title'],
    })

    expect(result.convergedFields).toEqual(['title'])
    expect(result.pushToAirtable).toEqual([{ field: 'programKitId', value: 'sub_001' }])
  })

  it('compares structured values independently of object key insertion order', () => {
    const result = reconcileAirtableRecord({
      lastSynced: { routing: { track: 'Build', tags: ['practical', 'systems'] } },
      programKit: { routing: { tags: ['practical', 'systems'], track: 'Build' } },
      airtable: { routing: { track: 'Build', tags: ['practical', 'systems'] } },
      editableFields: ['routing'],
    })

    expect(result).toEqual({
      pushToAirtable: [],
      proposeToProgramKit: [],
      conflicts: [],
      convergedFields: [],
    })
  })
})
