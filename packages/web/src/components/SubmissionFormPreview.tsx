import {
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  ChevronUpDownIcon,
} from '@heroicons/react/16/solid'
import { useMemo, useState } from 'react'

import {
  isSubmissionFieldVisible,
  type Event,
  type SubmissionAnswers,
  type SubmissionForm,
  type SubmissionFormField,
  type SubmissionKind,
} from '@programkit/core'

import { cx } from './ui.tsx'

const speakerPurposes = new Set([
  'first_name',
  'last_name',
  'email',
  'company',
  'job_title',
  'biography',
])

export function SubmissionFormPreview({
  event,
  form,
  fields,
  selectedFieldId,
}: {
  event: Event
  form: SubmissionForm
  fields: SubmissionFormField[]
  selectedFieldId?: string
}) {
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [answers, setAnswers] = useState<SubmissionAnswers>({})
  const [kind, setKind] = useState<SubmissionKind>(form.allowedKinds[0] ?? 'abstract')
  const visibleFields = useMemo(
    () => fields.filter((field) => isSubmissionFieldVisible(field, fields, answers)),
    [answers, fields],
  )
  const proposalFields = visibleFields.filter((field) => !speakerPurposes.has(field.purpose))
  const speakerFields = visibleFields.filter((field) => speakerPurposes.has(field.purpose))

  function setAnswer(key: string, value: SubmissionAnswers[string]) {
    setAnswers((current) => ({ ...current, [key]: value }))
  }

  return (
    <div className="@container/form-preview flex min-w-0 flex-col gap-4">
      <div className="flex">
        <div
          className="inline-flex w-fit shrink-0 rounded-full bg-zinc-100 p-1 ring-1 ring-zinc-950/5"
          role="group"
          aria-label="Preview size"
        >
          <button
            type="button"
            aria-pressed={viewport === 'desktop'}
            onClick={() => setViewport('desktop')}
            className={cx(
              'focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-base font-medium sm:text-sm',
              viewport === 'desktop'
                ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-950/5'
                : 'text-zinc-500 hover:text-zinc-950',
            )}
          >
            <ComputerDesktopIcon className="size-4 h-lh shrink-0 fill-current" />
            Desktop
          </button>
          <button
            type="button"
            aria-pressed={viewport === 'mobile'}
            onClick={() => setViewport('mobile')}
            className={cx(
              'focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-full py-1 pr-2.5 pl-2 text-base font-medium sm:text-sm',
              viewport === 'mobile'
                ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-950/5'
                : 'text-zinc-500 hover:text-zinc-950',
            )}
          >
            <DevicePhoneMobileIcon className="size-4 h-lh shrink-0 fill-current" />
            Mobile
          </button>
        </div>
      </div>

      <div className="min-w-0 overflow-x-auto rounded-(--preview-radius) bg-zinc-100 p-(--preview-padding) ring-1 ring-zinc-950/5 [--preview-padding:--spacing(2)] [--preview-radius:var(--radius-3xl)] sm:[--preview-padding:--spacing(4)]">
        <div
          className={cx(
            'mx-auto overflow-hidden rounded-[max(0px,calc(var(--preview-radius)-var(--preview-padding)))] bg-white shadow-sm ring-1 ring-black/5',
            viewport === 'mobile' ? 'max-w-[24.375rem]' : 'w-full max-w-[60rem]',
          )}
        >
          <div className="flex h-14 items-center justify-between gap-4 border-b border-zinc-950/5 px-4 sm:px-5">
            <p className="text-base font-semibold tracking-tight text-zinc-950 sm:text-sm">
              ProgramKit
            </p>
            <p className="truncate text-base text-zinc-500 sm:text-sm">{event.name}</p>
          </div>

          <div
            className={cx(
              'grid min-w-0 gap-8 p-5 sm:p-7',
              viewport === 'desktop' &&
                '@3xl/form-preview:grid-cols-[3fr_5fr] @3xl/form-preview:gap-10',
            )}
          >
            <aside className="min-w-0">
              <h3 className="max-w-[18ch] text-balance text-2xl font-semibold tracking-tight text-zinc-950">
                {form.title || 'Untitled submission form'}
              </h3>
              <p className="max-w-[48ch] pt-3 text-pretty text-base text-zinc-600 sm:text-sm">
                {form.description || 'Add an introduction to help speakers understand the call.'}
              </p>
              <dl className="flex flex-col gap-3 border-t border-zinc-950/5 pt-5 mt-5">
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Event</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">{event.name}</dd>
                </div>
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">Location</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {event.venue} · {event.city}
                  </dd>
                </div>
                <div>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">
                    Submissions close
                  </dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">
                    {form.closesAt
                      ? new Intl.DateTimeFormat('en-US', {
                          month: 'long',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: event.timezone,
                        }).format(new Date(form.closesAt))
                      : 'No close date'}
                  </dd>
                </div>
              </dl>
            </aside>

            <div className="flex min-w-0 flex-col gap-8">
              {form.allowedKinds.length > 1 ? (
                <fieldset>
                  <legend className="text-lg font-semibold text-zinc-950">
                    What are you proposing?
                  </legend>
                  <div className="grid gap-2 pt-3 @2xl/form-preview:grid-cols-2">
                    {form.allowedKinds.map((option) => (
                      <label
                        key={option}
                        className={cx(
                          'flex cursor-pointer items-start gap-2.5 rounded-2xl bg-white p-3 ring-1',
                          kind === option ? 'ring-blue-600' : 'ring-zinc-950/10',
                        )}
                      >
                        <span className="flex h-lh shrink-0 items-center text-base sm:text-sm">
                          <input
                            type="radio"
                            name="preview-submission-kind"
                            value={option}
                            checked={kind === option}
                            onChange={() => setKind(option)}
                            className="size-5 accent-blue-600 sm:size-4"
                          />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                            {option === 'abstract' ? 'Open proposal' : 'Invited session'}
                          </span>
                          <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                            {option === 'abstract'
                              ? 'Submit an idea for committee review.'
                              : 'Provide details for a guaranteed session.'}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : null}

              <PreviewSection
                title="Your proposal"
                description="Tell the committee what attendees will learn and how you plan to deliver it."
                fields={proposalFields}
                answers={answers}
                selectedFieldId={selectedFieldId}
                onChange={setAnswer}
              />
              <PreviewSection
                title="About you"
                description="This information becomes your speaker profile only if the proposal is accepted."
                fields={speakerFields}
                answers={answers}
                selectedFieldId={selectedFieldId}
                onChange={setAnswer}
              />

              <div className="flex flex-col gap-3 border-t border-zinc-950/5 pt-5 @2xl/form-preview:flex-row @2xl/form-preview:items-center @2xl/form-preview:justify-between">
                <p className="max-w-[42ch] text-pretty text-base text-zinc-500 sm:text-sm">
                  The details you share become part of your proposal and, if it's accepted, your
                  speaker record.
                </p>
                <div
                  aria-hidden="true"
                  className="flex min-h-9 shrink-0 items-center justify-center rounded-full bg-blue-600 px-3 text-base font-medium text-white ring-1 ring-blue-600 sm:text-sm"
                >
                  Submit proposal
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PreviewSection({
  title,
  description,
  fields,
  answers,
  selectedFieldId,
  onChange,
}: {
  title: string
  description: string
  fields: SubmissionFormField[]
  answers: SubmissionAnswers
  selectedFieldId?: string
  onChange: (key: string, value: SubmissionAnswers[string]) => void
}) {
  if (fields.length === 0) return null
  return (
    <fieldset className="@container/preview-section min-w-0">
      <legend className="text-lg font-semibold text-zinc-950">{title}</legend>
      <p className="text-pretty text-base text-zinc-500 sm:text-sm">{description}</p>
      <div className="grid gap-5 pt-5 @lg/preview-section:grid-cols-2">
        {fields.map((field) => (
          <PreviewField
            key={field.id}
            field={field}
            value={answers[field.key]}
            selected={field.id === selectedFieldId}
            onChange={(value) => onChange(field.key, value)}
          />
        ))}
      </div>
    </fieldset>
  )
}

function PreviewField({
  field,
  value,
  selected,
  onChange,
}: {
  field: SubmissionFormField
  value: SubmissionAnswers[string] | undefined
  selected: boolean
  onChange: (value: SubmissionAnswers[string]) => void
}) {
  const fieldId = `preview-${field.id}`
  const spanWide =
    field.kind === 'long_text' || field.kind === 'file' || field.kind === 'multi_select'
  const inputClass =
    'focus-ring min-h-10 w-full rounded-xl bg-white px-3 py-2 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm'

  return (
    <div
      className={cx(
        'min-w-0 rounded-xl',
        spanWide && '@lg/preview-section:col-span-2',
        selected && 'ring-2 ring-blue-600 ring-offset-4 ring-offset-white',
      )}
    >
      <label htmlFor={fieldId} className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-zinc-950 sm:text-sm">{field.label}</span>
        {field.required ? <span className="text-sm text-zinc-400">Required</span> : null}
      </label>
      {field.description ? (
        <p className="pb-1.5 text-pretty text-base text-zinc-500 sm:text-sm">{field.description}</p>
      ) : (
        <div className="h-1.5" />
      )}

      {field.kind === 'long_text' ? (
        <textarea
          id={fieldId}
          name={field.key}
          rows={4}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={`${inputClass} resize-y`}
        />
      ) : field.kind === 'select' ? (
        <span className="inline-grid w-full grid-cols-[1fr_--spacing(8)]">
          <select
            id={fieldId}
            name={field.key}
            value={typeof value === 'string' ? value : ''}
            onChange={(event) => onChange(event.target.value)}
            className={`${inputClass} col-span-full row-start-1 appearance-none pr-8`}
          >
            <option value="">Choose an option</option>
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
        </span>
      ) : field.kind === 'multi_select' ? (
        <div className="flex flex-col gap-2 pt-1">
          {field.options.map((option) => {
            const values = Array.isArray(value) ? value : []
            return (
              <label key={option.value} className="flex items-center gap-2.5 py-1">
                <input
                  type="checkbox"
                  name={field.key}
                  value={option.value}
                  checked={values.includes(option.value)}
                  onChange={(event) =>
                    onChange(
                      event.target.checked
                        ? [...values, option.value]
                        : values.filter((entry) => entry !== option.value),
                    )
                  }
                  className="size-4 shrink-0 accent-blue-600"
                />
                <span className="text-base text-zinc-700 sm:text-sm">{option.label}</span>
              </label>
            )
          })}
        </div>
      ) : field.kind === 'checkbox' ? (
        <label className="flex items-center gap-2.5 py-1">
          <input
            id={fieldId}
            type="checkbox"
            name={field.key}
            checked={value === true}
            onChange={(event) => onChange(event.target.checked)}
            className="size-4 shrink-0 accent-blue-600"
          />
          <span className="text-base text-zinc-700 sm:text-sm">Yes</span>
        </label>
      ) : field.kind === 'file' ? (
        <input
          id={fieldId}
          type="file"
          name={field.key}
          className="focus-ring min-h-10 w-full rounded-xl bg-white p-2 text-base text-zinc-600 ring-1 ring-zinc-950/10 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 sm:text-sm"
        />
      ) : (
        <input
          id={fieldId}
          type={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : 'text'}
          name={field.key}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={inputClass}
        />
      )}
    </div>
  )
}
