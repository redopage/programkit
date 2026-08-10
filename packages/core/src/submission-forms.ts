import type {
  SubmissionFieldKind,
  SubmissionFieldPurpose,
  SubmissionForm,
  SubmissionFormField,
} from './types.ts'

export type SubmissionFormAvailability = 'draft' | 'scheduled' | 'open' | 'closed'

export function submissionFormAvailability(
  form: SubmissionForm,
  at: number = Date.now(),
): SubmissionFormAvailability {
  if (form.status !== 'open') return form.status
  if (form.opensAt && Date.parse(form.opensAt) > at) return 'scheduled'
  if (form.closesAt && Date.parse(form.closesAt) <= at) return 'closed'
  return 'open'
}

export const requiredSubmissionFieldPurposes = [
  'first_name',
  'last_name',
  'email',
  'biography',
  'proposal_title',
  'abstract',
  'session_format',
  'track',
] as const satisfies readonly SubmissionFieldPurpose[]

const compatibleKinds: Record<
  Exclude<SubmissionFieldPurpose, 'custom'>,
  readonly SubmissionFieldKind[]
> = {
  first_name: ['short_text'],
  last_name: ['short_text'],
  email: ['email'],
  company: ['short_text'],
  job_title: ['short_text'],
  biography: ['long_text', 'short_text'],
  proposal_title: ['short_text'],
  abstract: ['long_text', 'short_text'],
  session_format: ['select'],
  track: ['select'],
}

export function submissionFieldPurposeSupportsKind(
  purpose: SubmissionFieldPurpose,
  kind: SubmissionFieldKind,
) {
  return purpose === 'custom' || compatibleKinds[purpose].includes(kind)
}

export interface SubmissionFormPublishReadiness {
  ready: boolean
  completedCount: number
  requiredCount: number
  incompletePurposes: Array<(typeof requiredSubmissionFieldPurposes)[number]>
  duplicatePurposes: SubmissionFieldPurpose[]
  invalidMappings: Array<{
    fieldId: string
    purpose: Exclude<SubmissionFieldPurpose, 'custom'>
    kind: SubmissionFieldKind
  }>
}

export function submissionFormPublishReadiness(
  fields: readonly SubmissionFormField[],
): SubmissionFormPublishReadiness {
  const mappedFields = fields.filter(
    (
      field,
    ): field is SubmissionFormField & {
      purpose: Exclude<SubmissionFieldPurpose, 'custom'>
    } => field.purpose !== 'custom',
  )
  const purposes = new Map<SubmissionFieldPurpose, SubmissionFormField[]>()
  for (const field of mappedFields) {
    const matches = purposes.get(field.purpose) ?? []
    matches.push(field)
    purposes.set(field.purpose, matches)
  }

  const duplicatePurposes = [...purposes.entries()]
    .filter(([, matches]) => matches.length > 1)
    .map(([purpose]) => purpose)
  const invalidMappings = mappedFields
    .filter((field) => !submissionFieldPurposeSupportsKind(field.purpose, field.kind))
    .map((field) => ({ fieldId: field.id, purpose: field.purpose, kind: field.kind }))
  const incompletePurposes = requiredSubmissionFieldPurposes.filter((purpose) => {
    const matches = purposes.get(purpose) ?? []
    return (
      matches.length !== 1 ||
      !matches[0].required ||
      !submissionFieldPurposeSupportsKind(purpose, matches[0].kind)
    )
  })
  const completedCount = requiredSubmissionFieldPurposes.length - incompletePurposes.length

  return {
    ready:
      incompletePurposes.length === 0 &&
      duplicatePurposes.length === 0 &&
      invalidMappings.length === 0,
    completedCount,
    requiredCount: requiredSubmissionFieldPurposes.length,
    incompletePurposes: [...incompletePurposes],
    duplicatePurposes,
    invalidMappings,
  }
}
