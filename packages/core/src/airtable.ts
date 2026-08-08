export type AirtableSyncValue =
  string | number | boolean | null | AirtableSyncValue[] | { [key: string]: AirtableSyncValue }

export type AirtableSyncValues = Record<string, AirtableSyncValue | undefined>

export interface AirtableFieldChange {
  field: string
  value: AirtableSyncValue | undefined
}

export interface AirtableFieldConflict {
  field: string
  lastSyncedValue: AirtableSyncValue | undefined
  programKitValue: AirtableSyncValue | undefined
  airtableValue: AirtableSyncValue | undefined
}

export interface AirtableReconciliation {
  pushToAirtable: AirtableFieldChange[]
  proposeToProgramKit: AirtableFieldChange[]
  conflicts: AirtableFieldConflict[]
  convergedFields: string[]
}

function canonicalValue(value: AirtableSyncValue | undefined): AirtableSyncValue | undefined {
  if (Array.isArray(value)) return value.map(canonicalValue) as AirtableSyncValue[]
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalValue(value[key])]),
    ) as { [key: string]: AirtableSyncValue }
  }
  return value
}

function sameValue(
  left: AirtableSyncValue | undefined,
  right: AirtableSyncValue | undefined,
): boolean {
  if (Object.is(left, right)) return true
  if (left === undefined || right === undefined) return false
  return JSON.stringify(canonicalValue(left)) === JSON.stringify(canonicalValue(right))
}

/**
 * Compares the last successfully mirrored row with both current copies.
 *
 * ProgramKit remains authoritative: inbound Airtable edits are returned as proposed changes for
 * validation and human approval. Read-only fields are always repaired from ProgramKit. A caller
 * persists the next baseline only after its outbound write or approved inbound change succeeds.
 */
export function reconcileAirtableRecord(input: {
  lastSynced: AirtableSyncValues
  programKit: AirtableSyncValues
  airtable: AirtableSyncValues
  editableFields: readonly string[]
}): AirtableReconciliation {
  const editableFields = new Set(input.editableFields)
  const fields = new Set([
    ...Object.keys(input.lastSynced),
    ...Object.keys(input.programKit),
    ...Object.keys(input.airtable),
  ])
  const result: AirtableReconciliation = {
    pushToAirtable: [],
    proposeToProgramKit: [],
    conflicts: [],
    convergedFields: [],
  }

  for (const field of [...fields].sort()) {
    const lastSyncedValue = input.lastSynced[field]
    const programKitValue = input.programKit[field]
    const airtableValue = input.airtable[field]
    const programKitChanged = !sameValue(programKitValue, lastSyncedValue)
    const airtableChanged = !sameValue(airtableValue, lastSyncedValue)

    if (!editableFields.has(field)) {
      if (!sameValue(programKitValue, airtableValue)) {
        result.pushToAirtable.push({ field, value: programKitValue })
      }
      continue
    }

    if (!programKitChanged && !airtableChanged) continue

    if (programKitChanged && !airtableChanged) {
      result.pushToAirtable.push({ field, value: programKitValue })
      continue
    }

    if (!programKitChanged && airtableChanged) {
      result.proposeToProgramKit.push({ field, value: airtableValue })
      continue
    }

    if (sameValue(programKitValue, airtableValue)) {
      result.convergedFields.push(field)
      continue
    }

    result.conflicts.push({ field, lastSyncedValue, programKitValue, airtableValue })
  }

  return result
}
