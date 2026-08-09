import { PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import type { ReactNode } from 'react'

import type { SubmissionContributor, SubmissionContributorRole } from '@programkit/core'

import { Button, selectControl, textAreaControl, textControl } from './ui.tsx'

const roleOptions: Array<{ value: SubmissionContributorRole; label: string }> = [
  { value: 'co_speaker', label: 'Co-speaker' },
  { value: 'co_presenter', label: 'Co-presenter' },
  { value: 'co_author', label: 'Co-author' },
]

function emptyContributor(): SubmissionContributor {
  return {
    id: crypto.randomUUID(),
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    biography: '',
    role: 'co_speaker',
  }
}

export function SubmissionParticipantsEditor({
  contributors,
  onChange,
  compact = false,
}: {
  contributors: SubmissionContributor[]
  onChange: (contributors: SubmissionContributor[]) => void
  compact?: boolean
}) {
  function update(id: string, patch: Partial<SubmissionContributor>) {
    onChange(contributors.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  return (
    <section aria-labelledby="additional-speakers-heading">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <h2
            id="additional-speakers-heading"
            className="text-lg font-semibold tracking-tight text-zinc-950"
          >
            Additional speakers
          </h2>
          <p className="max-w-xl pt-1 text-pretty text-base text-zinc-500 sm:text-sm">
            Add everyone presenting this proposal. Their role stays attached through review and
            scheduling.
          </p>
        </div>
        <Button
          type="button"
          size="compact"
          onClick={() => onChange([...contributors, emptyContributor()])}
        >
          <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
          Add speaker
        </Button>
      </div>

      {contributors.length === 0 ? (
        <div className="mt-4 rounded-2xl bg-zinc-50 px-5 py-4 ring-1 ring-zinc-950/5">
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            You are currently listed as the only speaker.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4 pt-4">
          {contributors.map((contributor, index) => (
            <fieldset
              key={contributor.id}
              className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 sm:p-5"
            >
              <legend className="sr-only">Additional speaker {index + 1}</legend>
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                    {contributor.firstName || contributor.lastName
                      ? `${contributor.firstName} ${contributor.lastName}`.trim()
                      : `Additional speaker ${index + 1}`}
                  </p>
                  <p className="text-base text-zinc-500 sm:text-sm">
                    {roleOptions.find((option) => option.value === contributor.role)?.label}
                  </p>
                </div>
                <Button
                  type="button"
                  size="compact"
                  variant="danger"
                  aria-label={`Remove additional speaker ${index + 1}`}
                  onClick={() =>
                    onChange(contributors.filter((entry) => entry.id !== contributor.id))
                  }
                >
                  <TrashIcon className="size-4 h-lh shrink-0 fill-current" />
                  Remove
                </Button>
              </div>

              <div className="grid gap-4 pt-5 sm:grid-cols-2">
                <Field label="First name">
                  <input
                    className={textControl}
                    value={contributor.firstName}
                    required
                    autoComplete="given-name"
                    onChange={(event) => update(contributor.id, { firstName: event.target.value })}
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className={textControl}
                    value={contributor.lastName}
                    required
                    autoComplete="family-name"
                    onChange={(event) => update(contributor.id, { lastName: event.target.value })}
                  />
                </Field>
                <Field label="Email">
                  <input
                    className={textControl}
                    value={contributor.email}
                    required
                    type="email"
                    autoComplete="email"
                    onChange={(event) => update(contributor.id, { email: event.target.value })}
                  />
                </Field>
                <Field label="Role">
                  <select
                    className={selectControl}
                    value={contributor.role}
                    onChange={(event) =>
                      update(contributor.id, {
                        role: event.target.value as SubmissionContributorRole,
                      })
                    }
                  >
                    {roleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Company">
                  <input
                    className={textControl}
                    value={contributor.company}
                    autoComplete="organization"
                    onChange={(event) => update(contributor.id, { company: event.target.value })}
                  />
                </Field>
                <Field label="Job title">
                  <input
                    className={textControl}
                    value={contributor.title}
                    autoComplete="organization-title"
                    onChange={(event) => update(contributor.id, { title: event.target.value })}
                  />
                </Field>
                {!compact ? (
                  <div className="sm:col-span-2">
                    <Field label="Biography" optional>
                      <textarea
                        className={textAreaControl}
                        rows={3}
                        value={contributor.biography}
                        onChange={(event) =>
                          update(contributor.id, { biography: event.target.value })
                        }
                      />
                    </Field>
                  </div>
                ) : null}
              </div>
            </fieldset>
          ))}
        </div>
      )}
    </section>
  )
}

function Field({
  label,
  optional = false,
  children,
}: {
  label: string
  optional?: boolean
  children: ReactNode
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-baseline justify-between gap-3 text-base font-medium text-zinc-950 sm:text-sm">
        {label}
        {optional ? <span className="font-normal text-zinc-400">Optional</span> : null}
      </span>
      <span className="block pt-1.5">{children}</span>
    </label>
  )
}
