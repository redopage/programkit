import { MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { useMemo, useRef, useState } from 'react'

import type { SubmissionFormField } from '@programkit/core'

import { Button, Dialog } from './ui.tsx'

export interface QuestionTypePreset {
  kind: SubmissionFormField['kind']
  label: string
  description: string
  category: 'Text' | 'Choice' | 'Contact and files'
  defaultQuestion: string
  placeholder: string
  options: SubmissionFormField['options']
}

const questionTypes: QuestionTypePreset[] = [
  {
    kind: 'short_text',
    label: 'Short answer',
    description: 'Names, organizations, roles, or any brief response.',
    category: 'Text',
    defaultQuestion: 'Short answer question',
    placeholder: 'Type a short answer',
    options: [],
  },
  {
    kind: 'long_text',
    label: 'Long answer',
    description: 'Abstracts, biographies, context, and detailed responses.',
    category: 'Text',
    defaultQuestion: 'Long answer question',
    placeholder: 'Type your answer',
    options: [],
  },
  {
    kind: 'select',
    label: 'Single choice',
    description: 'Let submitters choose exactly one option.',
    category: 'Choice',
    defaultQuestion: 'Choose one option',
    placeholder: '',
    options: [
      { value: 'option-1', label: 'Option 1' },
      { value: 'option-2', label: 'Option 2' },
    ],
  },
  {
    kind: 'multi_select',
    label: 'Multiple choice',
    description: 'Let submitters choose one or more options.',
    category: 'Choice',
    defaultQuestion: 'Choose all that apply',
    placeholder: '',
    options: [
      { value: 'option-1', label: 'Option 1' },
      { value: 'option-2', label: 'Option 2' },
    ],
  },
  {
    kind: 'checkbox',
    label: 'Confirmation',
    description: 'A single acknowledgement or consent checkbox.',
    category: 'Choice',
    defaultQuestion: 'I confirm this information is accurate',
    placeholder: '',
    options: [],
  },
  {
    kind: 'email',
    label: 'Email address',
    description: 'A validated email address for follow-up.',
    category: 'Contact and files',
    defaultQuestion: 'Email address',
    placeholder: 'name@example.com',
    options: [],
  },
  {
    kind: 'url',
    label: 'Website or link',
    description: 'A portfolio, recording, profile, or supporting URL.',
    category: 'Contact and files',
    defaultQuestion: 'Website or supporting link',
    placeholder: 'https://',
    options: [],
  },
  {
    kind: 'file',
    label: 'File upload',
    description: 'Slides, posters, headshots, or another supporting file.',
    category: 'Contact and files',
    defaultQuestion: 'Supporting file',
    placeholder: '',
    options: [],
  },
]

const categories: QuestionTypePreset['category'][] = ['Text', 'Choice', 'Contact and files']

export function QuestionTypeDialog({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (preset: QuestionTypePreset) => void
}) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const matches = useMemo(
    () =>
      questionTypes.filter((questionType) =>
        [questionType.label, questionType.description, questionType.category]
          .join(' ')
          .toLowerCase()
          .includes(normalizedQuery),
      ),
    [normalizedQuery],
  )

  function close() {
    setQuery('')
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Add a question"
      description="Choose a structured answer type. You can change its wording, choices, rules, and requirement status next."
      size="wide"
      initialFocusRef={searchRef}
      footer={<Button onClick={close}>Cancel</Button>}
    >
      <label className="relative block">
        <span className="sr-only">Search question types</span>
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-zinc-400" />
        <input
          ref={searchRef}
          type="search"
          name="question-type-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search question types"
          className="focus-ring min-h-11 w-full rounded-full bg-white py-2 pr-3 pl-9 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
        />
      </label>

      {matches.length > 0 ? (
        <div className="flex flex-col gap-5 pt-5">
          {categories.map((category) => {
            const categoryMatches = matches.filter(
              (questionType) => questionType.category === category,
            )
            if (categoryMatches.length === 0) return null
            return (
              <section key={category} aria-labelledby={`question-category-${category}`}>
                <h3
                  id={`question-category-${category}`}
                  className="text-base font-medium text-zinc-500 sm:text-sm"
                >
                  {category}
                </h3>
                <div className="grid gap-2 pt-2 sm:grid-cols-3">
                  {categoryMatches.map((questionType) => (
                    <button
                      key={questionType.kind}
                      type="button"
                      onClick={() => {
                        onSelect(questionType)
                        close()
                      }}
                      className="focus-ring min-w-0 rounded-2xl bg-white p-3 text-left ring-1 ring-zinc-950/10 hover:bg-zinc-50 hover:ring-zinc-950/20"
                    >
                      <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                        {questionType.label}
                      </span>
                      <span className="block pt-0.5 text-pretty text-base text-zinc-500 sm:text-sm">
                        {questionType.description}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : (
        <div className="py-10 text-center">
          <p className="text-base font-medium text-zinc-950 sm:text-sm">No question types found</p>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Try a term like choice, email, upload, or long answer.
          </p>
        </div>
      )}
    </Dialog>
  )
}
