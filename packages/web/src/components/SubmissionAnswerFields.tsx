import { ChevronUpDownIcon } from '@heroicons/react/16/solid'

import type {
  SubmissionAnswers,
  SubmissionFormField,
  SubmissionFieldPurpose,
} from '@programkit/core'

import { cx, textAreaControl, textControl } from './ui.tsx'

export function SubmissionAnswerFields({
  fields,
  answers,
  errors,
  lockedPurposes = [],
  idPrefix = 'submission-answer',
  fileMode = 'input',
  onChange,
}: {
  fields: SubmissionFormField[]
  answers: SubmissionAnswers
  errors: Record<string, string>
  lockedPurposes?: SubmissionFieldPurpose[]
  idPrefix?: string
  fileMode?: 'input' | 'preserve'
  onChange: (key: string, value: SubmissionAnswers[string]) => void
}) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {fields.map((field) => (
        <SubmissionAnswerField
          key={field.id}
          field={field}
          value={answers[field.key]}
          error={errors[field.key]}
          locked={lockedPurposes.includes(field.purpose)}
          idPrefix={idPrefix}
          fileMode={fileMode}
          onChange={(value) => onChange(field.key, value)}
        />
      ))}
    </div>
  )
}

function SubmissionAnswerField({
  field,
  value,
  error,
  locked,
  idPrefix,
  fileMode,
  onChange,
}: {
  field: SubmissionFormField
  value: SubmissionAnswers[string] | undefined
  error?: string
  locked: boolean
  idPrefix: string
  fileMode: 'input' | 'preserve'
  onChange: (value: SubmissionAnswers[string]) => void
}) {
  const fieldId = `${idPrefix}-${field.id}`
  const descriptionId = field.description ? `${fieldId}-description` : undefined
  const errorId = error ? `${fieldId}-error` : undefined
  const describedBy = [descriptionId, errorId].filter(Boolean).join(' ') || undefined
  const spanWide =
    field.kind === 'long_text' || field.kind === 'file' || field.kind === 'multi_select'

  return (
    <div className={cx('min-w-0', spanWide && 'sm:col-span-2')}>
      <label htmlFor={fieldId} className="flex items-baseline justify-between gap-3">
        <span className="text-base font-medium text-zinc-950 sm:text-sm">{field.label}</span>
        {field.required ? <span className="text-sm text-zinc-400">Required</span> : null}
      </label>
      {field.description ? (
        <p id={descriptionId} className="pb-1.5 text-pretty text-base text-zinc-500 sm:text-sm">
          {field.description}
        </p>
      ) : (
        <div className="h-1.5" />
      )}

      {field.kind === 'long_text' ? (
        <textarea
          id={fieldId}
          name={field.key}
          rows={5}
          required={field.required}
          disabled={locked}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cx(textAreaControl, 'w-full disabled:bg-zinc-50 disabled:text-zinc-500')}
        />
      ) : field.kind === 'select' ? (
        <span className="inline-grid w-full grid-cols-[1fr_--spacing(8)]">
          <select
            id={fieldId}
            name={field.key}
            required={field.required}
            disabled={locked}
            value={typeof value === 'string' ? value : ''}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) => onChange(event.target.value)}
            className={cx(
              textControl,
              'col-span-full row-start-1 appearance-none pr-8 disabled:bg-zinc-50 disabled:text-zinc-500',
            )}
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
            const checked = values.includes(option.value)
            return (
              <CheckboxRow
                key={option.value}
                name={field.key}
                value={option.value}
                label={option.label}
                checked={checked}
                disabled={locked}
                onChange={(checkedNext) =>
                  onChange(
                    checkedNext
                      ? [...values, option.value]
                      : values.filter((entry) => entry !== option.value),
                  )
                }
              />
            )
          })}
        </div>
      ) : field.kind === 'checkbox' ? (
        <CheckboxRow
          id={fieldId}
          name={field.key}
          label="Yes"
          checked={value === true}
          disabled={locked}
          onChange={onChange}
        />
      ) : field.kind === 'file' && fileMode === 'preserve' ? (
        <div
          id={fieldId}
          className="rounded-xl bg-zinc-50 px-3 py-3 text-pretty text-base text-zinc-500 ring-1 ring-zinc-950/5 sm:text-sm"
        >
          Existing files are preserved. File replacements are managed from the speaker portal after
          acceptance.
        </div>
      ) : field.kind === 'file' ? (
        <input
          id={fieldId}
          type="file"
          name={field.key}
          required={field.required}
          disabled={locked}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className="focus-ring min-h-11 w-full rounded-xl bg-white p-2 text-base text-zinc-600 ring-1 ring-zinc-950/10 file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 sm:text-sm"
        />
      ) : (
        <input
          id={fieldId}
          type={field.kind === 'email' ? 'email' : field.kind === 'url' ? 'url' : 'text'}
          name={field.key}
          required={field.required}
          disabled={locked}
          value={typeof value === 'string' ? value : ''}
          placeholder={field.placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          onChange={(event) => onChange(event.target.value)}
          className={cx(textControl, 'w-full disabled:bg-zinc-50 disabled:text-zinc-500')}
        />
      )}

      {locked ? (
        <p className="pt-1 text-base text-zinc-500 sm:text-sm">
          Contact the program team to change this value.
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="pt-1 text-base text-rose-700 sm:text-sm">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function CheckboxRow({
  id,
  name,
  value,
  label,
  checked,
  disabled,
  onChange,
}: {
  id?: string
  name: string
  value?: string
  label: string
  checked: boolean
  disabled: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 rounded-lg py-1">
      <span className="flex h-lh shrink-0 items-center text-base sm:text-sm">
        <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
          <input
            id={id}
            type="checkbox"
            name={name}
            value={value}
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-zinc-200 disabled:bg-zinc-100 disabled:checked:bg-zinc-300 forced-colors:appearance-auto"
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
      <span className="text-base text-zinc-700 sm:text-sm">{label}</span>
    </label>
  )
}
