import { proposalSessionFormatOptions, type SubmissionFormField } from '@programkit/core'

export type StarterSubmissionField = Omit<SubmissionFormField, 'id' | 'formId'>

export function submissionFormSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .slice(0, 64)
}

export function starterSubmissionFields(
  tracks: Array<{ id: string; name: string }>,
): StarterSubmissionField[] {
  return [
    {
      key: 'proposal_title',
      label: 'Session title',
      description: '',
      kind: 'short_text',
      purpose: 'proposal_title',
      required: true,
      options: [],
      placeholder: 'A clear, specific title',
      sortOrder: 10,
      visibleWhen: null,
    },
    {
      key: 'abstract',
      label: 'Session abstract',
      description: 'Tell the committee what attendees will learn.',
      kind: 'long_text',
      purpose: 'abstract',
      required: true,
      options: [],
      placeholder: 'What will this session cover?',
      sortOrder: 20,
      visibleWhen: null,
    },
    {
      key: 'session_format',
      label: 'Session format',
      description: '',
      kind: 'select',
      purpose: 'session_format',
      required: true,
      options: [...proposalSessionFormatOptions],
      placeholder: '',
      sortOrder: 30,
      visibleWhen: null,
    },
    {
      key: 'track',
      label: 'Program track',
      description: '',
      kind: 'select',
      purpose: 'track',
      required: true,
      options: tracks.map((track) => ({ value: track.id, label: track.name })),
      placeholder: '',
      sortOrder: 40,
      visibleWhen: null,
    },
    {
      key: 'first_name',
      label: 'First name',
      description: '',
      kind: 'short_text',
      purpose: 'first_name',
      required: true,
      options: [],
      placeholder: 'First name',
      sortOrder: 50,
      visibleWhen: null,
    },
    {
      key: 'last_name',
      label: 'Last name',
      description: '',
      kind: 'short_text',
      purpose: 'last_name',
      required: true,
      options: [],
      placeholder: 'Last name',
      sortOrder: 60,
      visibleWhen: null,
    },
    {
      key: 'email',
      label: 'Email address',
      description: '',
      kind: 'email',
      purpose: 'email',
      required: true,
      options: [],
      placeholder: 'you@example.com',
      sortOrder: 70,
      visibleWhen: null,
    },
    {
      key: 'biography',
      label: 'Speaker biography',
      description: '',
      kind: 'long_text',
      purpose: 'biography',
      required: true,
      options: [],
      placeholder: 'A short biography for the program',
      sortOrder: 80,
      visibleWhen: null,
    },
  ]
}
