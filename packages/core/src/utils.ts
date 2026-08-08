import type { Actor, Id } from './types.ts'

export const nowIso = () => new Date().toISOString()

export const createId = (prefix: string) => {
  const random = crypto.randomUUID().replaceAll('-', '').slice(0, 12)
  return `${prefix}_${random}`
}

export const defaultActor: Actor = {
  type: 'staff',
  id: 'usr_alex',
  name: 'Alex Morgan',
  scopes: ['*'],
}

export function assertString(value: unknown, field: string, options?: { allowEmpty?: boolean }) {
  if (typeof value !== 'string' || (!options?.allowEmpty && value.trim().length === 0)) {
    throw new OperationError('INVALID_INPUT', `${field} must be a non-empty string.`, {
      [field]: 'Enter a value.',
    })
  }
  return value.trim()
}

export function assertStringArray(value: unknown, field: string) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string')) {
    throw new OperationError('INVALID_INPUT', `${field} must be an array of strings.`, {
      [field]: 'Choose valid values.',
    })
  }
  return value as string[]
}

export function assertOneOf<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
) {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new OperationError('INVALID_INPUT', `${field} is invalid.`, {
      [field]: `Choose one of: ${allowed.join(', ')}.`,
    })
  }
  return value as T
}

export function findRequired<T extends { id: Id }>(records: T[], id: unknown, kind: string) {
  const validId = assertString(id, `${kind}_id`)
  const record = records.find((entry) => entry.id === validId)
  if (!record) throw new OperationError('NOT_FOUND', `${kind} ${validId} was not found.`)
  return record
}

export class OperationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message)
  }
}

export function minutesBetween(start: string, end: string) {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000)
}

export function addMinutes(iso: string, minutes: number) {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString()
}

export function cloneState<T>(value: T): T {
  return structuredClone(value)
}
