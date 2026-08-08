import {
  ArrowDownIcon,
  ArrowTopRightOnSquareIcon,
  ArrowUpIcon,
  ChevronUpDownIcon,
  DocumentDuplicateIcon,
  DocumentPlusIcon,
  EyeIcon,
  TrashIcon,
} from '@heroicons/react/16/solid'
import { useBlocker } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import {
  submissionFieldPurposeSupportsKind,
  submissionFormPublishReadiness,
} from '@programkit/core'
import type { SubmissionFieldPurpose, SubmissionFormField } from '@programkit/core'

import { QuestionTypeDialog, type QuestionTypePreset } from '../components/QuestionTypeDialog.tsx'
import { SubmissionFormPreview } from '../components/SubmissionFormPreview.tsx'
import {
  Button,
  Checkbox,
  Dialog,
  Drawer,
  PageHeader,
  ProgressBar,
  cx,
  selectControl,
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'
import { useWorkspace } from '../lib/workspace.tsx'

function fieldKindLabel(kind: SubmissionFormField['kind']) {
  const labels: Record<SubmissionFormField['kind'], string> = {
    short_text: 'Short answer',
    long_text: 'Long answer',
    email: 'Email',
    url: 'URL',
    select: 'Single choice',
    multi_select: 'Multiple choice',
    checkbox: 'Checkbox',
    file: 'File upload',
  }
  return labels[kind]
}

const fieldPurposeLabels: Record<SubmissionFieldPurpose, string> = {
  custom: 'Custom answer',
  first_name: 'Speaker first name',
  last_name: 'Speaker last name',
  email: 'Speaker email',
  company: 'Speaker organization',
  job_title: 'Speaker role',
  biography: 'Speaker biography',
  proposal_title: 'Session title',
  abstract: 'Session abstract',
  session_format: 'Session format',
  track: 'Session track',
}

const fieldPurposeGroups: Array<{
  label: string
  purposes: Array<Exclude<SubmissionFieldPurpose, 'custom'>>
}> = [
  {
    label: 'Speaker profile',
    purposes: ['first_name', 'last_name', 'email', 'company', 'job_title', 'biography'],
  },
  {
    label: 'Session record',
    purposes: ['proposal_title', 'abstract', 'session_format', 'track'],
  },
]

function selectedFormFromSearch(search: unknown) {
  if (!search || typeof search !== 'object' || !('form' in search)) return undefined
  const form = search.form
  return typeof form === 'string' ? form : undefined
}

export function FormsView({
  navigate,
  selectedFormId,
  selectedFieldId,
  onSelectionChange,
}: {
  navigate: (to: string) => void
  selectedFormId?: string
  selectedFieldId?: string
  onSelectionChange: (formId: string, fieldId?: string) => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload?.state
  const forms = useMemo(
    () =>
      (state?.submissionForms ?? [])
        .filter((entry) => entry.eventId === state?.activeEventId)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [state?.activeEventId, state?.submissionForms],
  )
  const form = forms.find((entry) => entry.id === selectedFormId) ?? forms[0]
  const sourceFields = useMemo(
    () =>
      (state?.submissionFormFields ?? [])
        .filter((field) => field.formId === form?.id)
        .sort((left, right) => left.sortOrder - right.sortOrder),
    [form?.id, state?.submissionFormFields],
  )
  const [fields, setFields] = useState<SubmissionFormField[]>([])
  const [formDraft, setFormDraft] = useState(form ?? null)
  const [dirty, setDirty] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [questionPickerOpen, setQuestionPickerOpen] = useState(false)
  const navigationBlocker = useBlocker({
    shouldBlockFn: ({ current, next }) =>
      dirty &&
      (current.pathname !== next.pathname ||
        selectedFormFromSearch(current.search) !== selectedFormFromSearch(next.search)),
    enableBeforeUnload: dirty,
    withResolver: true,
  })

  useEffect(() => {
    setFields(sourceFields)
    setFormDraft(form ?? null)
    setDirty(false)
    // Reinitialize only when the selected form or its persisted version changes.
    // Background query refreshes must not wipe an organizer's unsaved edits.
  }, [form?.id, form?.version])

  if (!payload || !form) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Submission forms"
          description="Create the public entry point for your program."
        />
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          No submission form has been configured for this event yet.
        </p>
      </div>
    )
  }

  const activeForm = formDraft ?? form
  const event = state?.events.find((entry) => entry.id === activeForm.eventId)
  const selected = fields.find((field) => field.id === selectedFieldId) ?? fields[0]
  const publishReadiness = submissionFormPublishReadiness(fields)
  const speakerPurposes = ['first_name', 'last_name', 'email', 'company', 'job_title', 'biography']
  const activeStep = selected && speakerPurposes.includes(selected.purpose) ? 2 : 1

  function updateSelected(update: Partial<SubmissionFormField>) {
    if (!selected) return
    setFields((current) =>
      current.map((field) => (field.id === selected.id ? { ...field, ...update } : field)),
    )
    setDirty(true)
  }

  function updateForm(update: Partial<typeof activeForm>) {
    setFormDraft((current) => (current ? { ...current, ...update } : current))
    setDirty(true)
  }

  function deleteSelected() {
    if (!selected) return
    const remaining = fields
      .filter((field) => field.id !== selected.id)
      .map((field, index) => ({
        ...field,
        sortOrder: (index + 1) * 10,
        visibleWhen: field.visibleWhen?.fieldId === selected.id ? null : field.visibleWhen,
      }))
    setFields(remaining)
    onSelectionChange(activeForm.id, remaining[0]?.id)
    setDirty(true)
  }

  function duplicateSelected() {
    if (!selected) return
    const index = fields.findIndex((field) => field.id === selected.id)
    const copy: SubmissionFormField = {
      ...structuredClone(selected),
      id: `fld_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`,
      key: `${selected.key}_copy_${fields.length + 1}`,
      label: `${selected.label} copy`,
      purpose: 'custom',
      visibleWhen: null,
    }
    const next = [...fields]
    next.splice(index + 1, 0, copy)
    const reordered = next.map((field, fieldIndex) => ({
      ...field,
      sortOrder: (fieldIndex + 1) * 10,
    }))
    setFields(reordered)
    onSelectionChange(activeForm.id, copy.id)
    setDirty(true)
  }

  function updateOption(index: number, update: { value?: string; label?: string }) {
    if (!selected) return
    updateSelected({
      options: selected.options.map((option, optionIndex) =>
        optionIndex === index ? { ...option, ...update } : option,
      ),
    })
  }

  function addOption() {
    if (!selected) return
    const number = selected.options.length + 1
    updateSelected({
      options: [...selected.options, { value: `option-${number}`, label: `Option ${number}` }],
    })
  }

  function removeOption(index: number) {
    if (!selected) return
    updateSelected({ options: selected.options.filter((_, optionIndex) => optionIndex !== index) })
  }

  function moveSelected(direction: -1 | 1) {
    if (!selected) return
    const index = fields.findIndex((field) => field.id === selected.id)
    const target = index + direction
    if (target < 0 || target >= fields.length) return
    const reordered = [...fields]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(target, 0, moved)
    setFields(
      reordered.map((field, fieldIndex) => ({ ...field, sortOrder: (fieldIndex + 1) * 10 })),
    )
    setDirty(true)
  }

  function addField(preset: QuestionTypePreset) {
    const field: SubmissionFormField = {
      id: `fld_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`,
      formId: activeForm.id,
      key: `question_${fields.length + 1}`,
      label: preset.defaultQuestion,
      description: '',
      kind: preset.kind,
      purpose: 'custom',
      required: false,
      options: structuredClone(preset.options),
      placeholder: preset.placeholder,
      sortOrder: (fields.length + 1) * 10,
      visibleWhen: null,
    }
    setFields((current) => [...current, field])
    onSelectionChange(activeForm.id, field.id)
    setDirty(true)
  }

  function discard() {
    const retainedField = sourceFields.find((field) => field.id === selected?.id) ?? sourceFields[0]
    setFields(sourceFields)
    setFormDraft(form)
    onSelectionChange(form.id, retainedField?.id)
    setDirty(false)
  }

  async function save() {
    const response = await execute(
      'submission-form.update',
      {
        formId: activeForm.id,
        name: activeForm.name,
        slug: activeForm.slug,
        title: activeForm.title,
        description: activeForm.description,
        allowedKinds: activeForm.allowedKinds,
        opensAt: activeForm.opensAt,
        closesAt: activeForm.closesAt,
        confirmationMessage: activeForm.confirmationMessage,
        fields,
      },
      { expectedVersions: { [activeForm.id]: activeForm.version } },
      'Submission form saved.',
    )
    if (response.ok) setDirty(false)
  }

  async function duplicateForm() {
    const slugs = new Set(forms.map((entry) => entry.slug))
    let suffix = 2
    let slug = `${activeForm.slug}-copy`
    while (slugs.has(slug)) {
      slug = `${activeForm.slug}-copy-${suffix}`
      suffix += 1
    }
    const response = await execute(
      'submission-form.create',
      {
        name: `${activeForm.name} copy`,
        slug,
        title: activeForm.title,
        description: activeForm.description,
        allowedKinds: activeForm.allowedKinds,
        opensAt: activeForm.opensAt,
        closesAt: activeForm.closesAt,
        confirmationMessage: activeForm.confirmationMessage,
        fields: fields.map(({ id: _id, formId: _formId, ...field }) => field),
      },
      undefined,
      'Draft form duplicated.',
    )
    const data = response.data as { form?: { id?: string } } | undefined
    if (response.ok && data?.form?.id) onSelectionChange(data.form.id)
  }

  async function publishForm() {
    await execute(
      'submission-form.publish',
      { formId: activeForm.id },
      { expectedVersions: { [activeForm.id]: activeForm.version } },
      'Submission form published.',
    )
  }

  async function closeForm() {
    await execute(
      'submission-form.update',
      { formId: activeForm.id, status: 'closed' },
      { expectedVersions: { [activeForm.id]: activeForm.version } },
      'Submission form closed.',
    )
  }

  return (
    <div className="@container/form-builder flex min-w-0 flex-col gap-7">
      <PageHeader
        title={form.name}
        description="Build the public form speakers use to submit proposals."
        actions={
          <>
            <label className="inline-grid grid-cols-[1fr_--spacing(8)]">
              <span className="sr-only">Current submission form</span>
              <select
                aria-label="Current submission form"
                value={activeForm.id}
                disabled={dirty}
                onChange={(event) => onSelectionChange(event.target.value)}
                className="focus-ring col-span-full row-start-1 min-h-9 appearance-none rounded-lg bg-white py-1.5 pr-8 pl-3 text-sm text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {forms.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
              <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
            </label>
            <Button
              size="compact"
              disabled={dirty || mutating}
              onClick={() => void duplicateForm()}
            >
              <DocumentDuplicateIcon className="size-4 h-lh shrink-0 fill-current" />
              Duplicate
            </Button>
            <Button size="compact" onClick={() => setPreviewOpen(true)}>
              <EyeIcon className="size-4 h-lh shrink-0 fill-current" />
              Preview
            </Button>
            <Button
              size="compact"
              variant="primary"
              disabled={mutating || !dirty}
              onClick={() => void save()}
            >
              Save
            </Button>
          </>
        }
      />

      <section aria-labelledby="form-content-heading" className="border-b border-zinc-950/5 pb-7">
        <div>
          <h2 id="form-content-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Form content
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Configure the public introduction, URL, accepted submission types, and confirmation.
          </p>
        </div>
        <div className="grid max-w-5xl gap-5 pt-5 @3xl/form-builder:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Internal name</span>
            <input
              type="text"
              name="form-internal-name"
              value={activeForm.name}
              onChange={(event) => updateForm({ name: event.target.value })}
              className={textControl}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Public URL</span>
            <span className="flex min-h-11 items-center rounded-lg bg-white text-base shadow-xs ring-1 ring-zinc-950/10 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-500 sm:min-h-9 sm:text-sm">
              <span className="shrink-0 pl-3 text-zinc-400">/submit/</span>
              <input
                type="text"
                aria-label="Public form slug"
                name="form-slug"
                value={activeForm.slug}
                onChange={(event) => updateForm({ slug: event.target.value })}
                className="min-w-0 flex-1 bg-transparent px-0 py-2 pr-3 text-zinc-950 outline-none"
              />
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Public title</span>
            <input
              type="text"
              name="form-public-title"
              value={activeForm.title}
              onChange={(event) => updateForm({ title: event.target.value })}
              className={textControl}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">Introduction</span>
            <textarea
              rows={4}
              name="form-introduction"
              value={activeForm.description}
              onChange={(event) => updateForm({ description: event.target.value })}
              className={textAreaControl}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">
              Confirmation message
            </span>
            <textarea
              rows={4}
              name="form-confirmation"
              value={activeForm.confirmationMessage}
              onChange={(event) => updateForm({ confirmationMessage: event.target.value })}
              className={textAreaControl}
            />
          </label>
          <fieldset className="@3xl/form-builder:col-span-2">
            <legend className="text-base font-medium text-zinc-950 sm:text-sm">
              Accepted submission types
            </legend>
            <div className="flex flex-wrap gap-4 pt-2">
              {(
                [
                  ['abstract', 'Open proposals'],
                  ['guaranteed_session', 'Invited sessions'],
                ] as const
              ).map(([kind, label]) => (
                <Checkbox
                  key={kind}
                  id={`allowed-kind-${kind}`}
                  name="allowed-kinds"
                  label={label}
                  checked={activeForm.allowedKinds.includes(kind)}
                  onChange={(next) =>
                    updateForm({
                      allowedKinds: next
                        ? [...activeForm.allowedKinds, kind]
                        : activeForm.allowedKinds.filter((entry) => entry !== kind),
                    })
                  }
                />
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <div className="grid min-w-0 gap-6 @5xl/form-builder:grid-cols-[minmax(0,1fr)_20rem] @7xl/form-builder:grid-cols-[12rem_minmax(0,1fr)_20rem]">
        <aside
          aria-label="Form sections"
          className="min-w-0 @5xl/form-builder:col-span-2 @7xl/form-builder:col-span-1"
        >
          <div className="sticky top-6">
            <ol role="list" className="flex gap-1 overflow-x-auto @7xl/form-builder:flex-col">
              {[
                ['01', 'Welcome', 'Public introduction'],
                [
                  '02',
                  'Proposal',
                  `${fields.filter((field) => ['proposal_title', 'abstract', 'session_format', 'track', 'custom'].includes(field.purpose)).length} questions`,
                ],
                [
                  '03',
                  'Speaker',
                  `${fields.filter((field) => ['first_name', 'last_name', 'email', 'company', 'job_title', 'biography'].includes(field.purpose)).length} questions`,
                ],
                ['04', 'Confirmation', 'Email and next steps'],
              ].map(([number, label, detail], index) => (
                <li key={label} className="min-w-40 @7xl/form-builder:min-w-0">
                  <div
                    className={cx(
                      'flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left',
                      index === activeStep ? 'bg-zinc-950/5 text-zinc-950' : 'text-zinc-500',
                    )}
                  >
                    <span className="shrink-0 font-mono text-sm tabular-nums text-zinc-400">
                      {number}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-medium sm:text-sm">{label}</span>
                      <span className="block truncate text-sm text-zinc-500">{detail}</span>
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </aside>

        <section aria-labelledby="questions-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-2">
            <div>
              <h2 id="questions-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
                Form questions
              </h2>
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                Select a question to edit its label, helper text, and validation.
              </p>
            </div>
            <Button size="compact" onClick={() => setQuestionPickerOpen(true)}>
              <DocumentPlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Add question
            </Button>
          </div>
          <ol role="list" className="flex flex-col gap-2 pt-4">
            {fields.map((field, index) => (
              <li key={field.id}>
                <button
                  type="button"
                  aria-pressed={selected?.id === field.id}
                  className={cx(
                    'focus-ring flex w-full items-start gap-4 rounded-xl bg-white p-4 text-left ring-1',
                    selected?.id === field.id
                      ? 'ring-blue-600'
                      : 'ring-zinc-950/10 hover:ring-zinc-950/20',
                  )}
                  onClick={() => onSelectionChange(activeForm.id, field.id)}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-zinc-100 font-mono text-sm tabular-nums text-zinc-500">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-medium text-zinc-950 sm:text-sm">
                        {field.label}
                      </span>
                      {field.required ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-sm font-medium text-amber-700 ring-1 ring-amber-700/10">
                          Required
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-base text-zinc-500 sm:text-sm">
                      {fieldKindLabel(field.kind)}
                      {field.purpose !== 'custom' ? ` · ${fieldPurposeLabels[field.purpose]}` : ''}
                      {field.visibleWhen ? ' · Conditional' : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            <li>
              <button
                type="button"
                className="focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-300 text-base font-medium text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-950 sm:text-sm"
                onClick={() => setQuestionPickerOpen(true)}
              >
                <DocumentPlusIcon className="size-4 h-lh shrink-0 fill-current" />
                Add another question
              </button>
            </li>
          </ol>
        </section>

        <aside aria-labelledby="field-settings-heading" className="min-w-0">
          <div className="sticky top-6 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
            {selected ? (
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-3 border-b border-zinc-950/5 pb-2">
                  <div className="min-w-0">
                    <h2
                      id="field-settings-heading"
                      className="text-base font-medium text-zinc-950 sm:text-sm"
                    >
                      Field settings
                    </h2>
                    <p className="truncate font-mono text-sm text-zinc-500">{selected.key}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Move question up"
                      className="touch-target focus-ring inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950"
                      onClick={() => moveSelected(-1)}
                    >
                      <ArrowUpIcon className="size-4 shrink-0 fill-current" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move question down"
                      className="touch-target focus-ring inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950"
                      onClick={() => moveSelected(1)}
                    >
                      <ArrowDownIcon className="size-4 shrink-0 fill-current" />
                    </button>
                    <button
                      type="button"
                      aria-label="Duplicate question"
                      className="touch-target focus-ring inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950"
                      onClick={duplicateSelected}
                    >
                      <DocumentDuplicateIcon className="size-4 shrink-0 fill-current" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete question"
                      className="touch-target focus-ring inline-flex size-8 items-center justify-center rounded-lg text-zinc-500 hover:bg-rose-50 hover:text-rose-700"
                      onClick={deleteSelected}
                    >
                      <TrashIcon className="size-4 shrink-0 fill-current" />
                    </button>
                  </div>
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">Question</span>
                  <input
                    type="text"
                    name="field-label"
                    value={selected.label}
                    onChange={(event) => updateSelected({ label: event.target.value })}
                    className={textControl}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">Help text</span>
                  <textarea
                    name="field-description"
                    rows={3}
                    value={selected.description}
                    onChange={(event) => updateSelected({ description: event.target.value })}
                    className={textAreaControl}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">
                    Answer type
                  </span>
                  <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
                    <select
                      name="field-kind"
                      value={selected.kind}
                      onChange={(event) => {
                        const kind = event.target.value as SubmissionFormField['kind']
                        updateSelected({
                          kind,
                          purpose: submissionFieldPurposeSupportsKind(selected.purpose, kind)
                            ? selected.purpose
                            : 'custom',
                          options:
                            (kind === 'select' || kind === 'multi_select') &&
                            selected.options.length === 0
                              ? [{ value: 'option-1', label: 'Option 1' }]
                              : selected.options,
                        })
                      }}
                      className={selectControl}
                    >
                      {(
                        [
                          'short_text',
                          'long_text',
                          'email',
                          'url',
                          'select',
                          'multi_select',
                          'checkbox',
                          'file',
                        ] as const
                      ).map((kind) => (
                        <option key={kind} value={kind}>
                          {fieldKindLabel(kind)}
                        </option>
                      ))}
                    </select>
                    <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
                  </span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">
                    Data mapping
                  </span>
                  <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
                    <select
                      name="field-purpose"
                      value={selected.purpose}
                      onChange={(event) =>
                        updateSelected({
                          purpose: event.target.value as SubmissionFieldPurpose,
                        })
                      }
                      className={selectControl}
                    >
                      <option value="custom">{fieldPurposeLabels.custom}</option>
                      {fieldPurposeGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.purposes.map((purpose) => {
                            const usedByAnotherField = fields.some(
                              (field) => field.id !== selected.id && field.purpose === purpose,
                            )
                            const compatible = submissionFieldPurposeSupportsKind(
                              purpose,
                              selected.kind,
                            )
                            return (
                              <option
                                key={purpose}
                                value={purpose}
                                disabled={usedByAnotherField || !compatible}
                              >
                                {fieldPurposeLabels[purpose]}
                                {usedByAnotherField
                                  ? ' — already mapped'
                                  : !compatible
                                    ? ' — choose another answer type'
                                    : ''}
                              </option>
                            )
                          })}
                        </optgroup>
                      ))}
                    </select>
                    <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
                  </span>
                  <span className="text-pretty text-base text-zinc-500 sm:text-sm">
                    Mapped answers create speaker and session records after acceptance. Each mapping
                    can be used once.
                  </span>
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">
                    Placeholder
                  </span>
                  <input
                    type="text"
                    name="field-placeholder"
                    value={selected.placeholder}
                    onChange={(event) => updateSelected({ placeholder: event.target.value })}
                    className={textControl}
                  />
                </label>
                {selected.kind === 'select' || selected.kind === 'multi_select' ? (
                  <fieldset className="border-t border-zinc-950/5 pt-4">
                    <div className="flex items-center justify-between gap-3">
                      <legend className="text-base font-medium text-zinc-950 sm:text-sm">
                        Choice options
                      </legend>
                      <Button size="compact" variant="ghost" type="button" onClick={addOption}>
                        Add option
                      </Button>
                    </div>
                    <div className="flex flex-col gap-2 pt-2">
                      {selected.options.map((option, optionIndex) => (
                        <div key={optionIndex} className="flex items-center gap-2">
                          <input
                            type="text"
                            aria-label={`Option ${optionIndex + 1} label`}
                            value={option.label}
                            onChange={(event) => {
                              const label = event.target.value
                              updateOption(optionIndex, {
                                label,
                                value:
                                  option.value === `option-${optionIndex + 1}`
                                    ? label
                                        .toLowerCase()
                                        .trim()
                                        .replace(/[^a-z0-9]+/gu, '-')
                                        .replace(/^-|-$/gu, '') || option.value
                                    : option.value,
                              })
                            }}
                            className={cx(textControl, 'min-w-0 flex-1')}
                          />
                          <button
                            type="button"
                            aria-label={`Remove option ${optionIndex + 1}`}
                            className="touch-target focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-rose-50 hover:text-rose-700"
                            onClick={() => removeOption(optionIndex)}
                          >
                            <TrashIcon className="size-4 shrink-0 fill-current" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                <fieldset className="border-t border-zinc-950/5 pt-4">
                  <legend className="text-base font-medium text-zinc-950 sm:text-sm">
                    Conditional visibility
                  </legend>
                  <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                    Show this question only when an earlier answer matches a rule.
                  </p>
                  <div className="flex flex-col gap-2 pt-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-zinc-500">Depends on</span>
                      <select
                        value={selected.visibleWhen?.fieldId ?? ''}
                        onChange={(event) => {
                          const source = fields.find((field) => field.id === event.target.value)
                          updateSelected({
                            visibleWhen: source
                              ? {
                                  fieldId: source.id,
                                  operator: 'equals',
                                  value: source.options[0]?.value ?? '',
                                }
                              : null,
                          })
                        }}
                        className={textControl}
                      >
                        <option value="">Always show</option>
                        {fields
                          .filter(
                            (field) =>
                              field.id !== selected.id && field.sortOrder < selected.sortOrder,
                          )
                          .map((field) => (
                            <option key={field.id} value={field.id}>
                              {field.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    {selected.visibleWhen ? (
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          aria-label="Condition operator"
                          value={selected.visibleWhen.operator}
                          onChange={(event) =>
                            updateSelected({
                              visibleWhen: {
                                ...selected.visibleWhen!,
                                operator: event.target.value as
                                  'equals' | 'not_equals' | 'includes',
                              },
                            })
                          }
                          className={textControl}
                        >
                          <option value="equals">Equals</option>
                          <option value="not_equals">Does not equal</option>
                          <option value="includes">Includes</option>
                        </select>
                        <input
                          type="text"
                          aria-label="Condition value"
                          value={selected.visibleWhen.value}
                          onChange={(event) =>
                            updateSelected({
                              visibleWhen: { ...selected.visibleWhen!, value: event.target.value },
                            })
                          }
                          className={cx(textControl, 'min-w-0')}
                        />
                      </div>
                    ) : null}
                  </div>
                </fieldset>
                <label className="flex items-start gap-3">
                  <span className="flex h-lh items-center text-base sm:text-sm">
                    <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
                      <input
                        type="checkbox"
                        name="field-required"
                        checked={selected.required}
                        onChange={(event) => updateSelected({ required: event.target.checked })}
                        className="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-zinc-300 disabled:bg-zinc-100 disabled:checked:bg-zinc-100 forced-colors:appearance-auto"
                      />
                      <svg
                        viewBox="0 0 14 14"
                        fill="none"
                        className="pointer-events-none col-start-1 row-start-1 size-7/8 self-center justify-self-center stroke-white group-not-has-checked:opacity-0"
                      >
                        <path
                          d="M3 8L6 11L11 3.5"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                      Required answer
                    </span>
                    <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                      Submitters cannot finish without it.
                    </span>
                  </span>
                </label>
              </div>
            ) : null}
          </div>
        </aside>
      </div>

      <section
        aria-labelledby="publish-readiness-heading"
        className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 sm:p-5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2
              id="publish-readiness-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Publish readiness
            </h2>
            <p className="max-w-[70ch] text-pretty text-base text-zinc-500 sm:text-sm">
              Accepted proposals need eight required mappings so ProgramKit can create dependable
              speaker and session records.
            </p>
          </div>
          <span
            className={cx(
              'inline-flex shrink-0 self-start rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
              publishReadiness.ready
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10'
                : 'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
            )}
          >
            {publishReadiness.ready
              ? 'Ready to publish'
              : `${publishReadiness.completedCount} of ${publishReadiness.requiredCount} mapped`}
          </span>
        </div>
        <div className="pt-4">
          <ProgressBar
            value={(publishReadiness.completedCount / publishReadiness.requiredCount) * 100}
            label={`${publishReadiness.completedCount} of ${publishReadiness.requiredCount} required data mappings complete`}
          />
        </div>
        {!publishReadiness.ready ? (
          <div className="pt-4">
            <p className="text-pretty text-base text-zinc-600 sm:text-sm">
              Map these questions and mark them required:
            </p>
            <ul role="list" className="flex flex-wrap gap-2 pt-2">
              {publishReadiness.incompletePurposes.map((purpose) => (
                <li
                  key={purpose}
                  className="rounded-full bg-white px-2 py-1 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/10"
                >
                  {fieldPurposeLabels[purpose]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section
        aria-label="Form status"
        className="flex flex-col gap-3 border-t border-zinc-950/5 pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span
            className={cx(
              'inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
              activeForm.status === 'open'
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10'
                : 'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/5',
            )}
          >
            {sentenceCase(activeForm.status)}
          </span>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            {activeForm.status === 'open'
              ? `Open until ${activeForm.closesAt ? new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(activeForm.closesAt)) : 'you close it'}.`
              : 'This form is not accepting submissions.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="pr-1 text-base text-zinc-500 sm:text-sm">
            {dirty ? 'Unsaved changes' : `${fields.length} questions saved`}
          </p>
          {dirty ? (
            <Button size="compact" variant="ghost" onClick={discard}>
              Discard
            </Button>
          ) : null}
          {activeForm.status !== 'open' ? (
            <Button
              size="compact"
              variant="primary"
              disabled={dirty || mutating || !publishReadiness.ready}
              onClick={() => void publishForm()}
            >
              {activeForm.status === 'closed' ? 'Reopen form' : 'Publish form'}
            </Button>
          ) : activeForm.status === 'open' ? (
            <Button size="compact" disabled={dirty || mutating} onClick={() => void closeForm()}>
              Close form
            </Button>
          ) : null}
        </div>
      </section>
      <Dialog
        open={navigationBlocker.status === 'blocked'}
        onClose={() => navigationBlocker.reset?.()}
        title="Discard unsaved changes?"
        description="You have edits to this submission form that have not been saved."
        footer={
          <>
            <Button onClick={() => navigationBlocker.reset?.()}>Keep editing</Button>
            <Button variant="danger" onClick={() => navigationBlocker.proceed?.()}>
              Discard and leave
            </Button>
          </>
        }
      />
      <QuestionTypeDialog
        open={questionPickerOpen}
        onClose={() => setQuestionPickerOpen(false)}
        onSelect={addField}
      />
      {event ? (
        <Drawer
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          title="Preview submission form"
          size="wide"
          footer={
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                {dirty ? 'Unsaved changes are included.' : 'Preview matches the saved form.'}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <Button onClick={() => setPreviewOpen(false)}>Done</Button>
                <Button
                  variant="primary"
                  disabled={activeForm.status !== 'open' || dirty}
                  onClick={() => navigate(`/submit/${activeForm.slug}`)}
                >
                  Open published form
                  <ArrowTopRightOnSquareIcon className="size-4 h-lh shrink-0 fill-current" />
                </Button>
              </div>
            </div>
          }
        >
          <SubmissionFormPreview
            key={activeForm.id}
            event={event}
            form={activeForm}
            fields={fields}
            selectedFieldId={selected?.id}
          />
        </Drawer>
      ) : null}
    </div>
  )
}
