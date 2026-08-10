import { CheckCircleIcon, ClockIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import {
  submissionFormAvailability,
  visibleSubmissionFormFields,
  type SubmissionAnswers,
  type SubmissionContributor,
  type SubmissionFormField,
  type SubmissionKind,
} from '@programkit/core'

import { ProgramKitMark } from '../components/brand.tsx'
import { SubmissionAnswerFields } from '../components/SubmissionAnswerFields.tsx'
import { SubmissionParticipantsEditor } from '../components/SubmissionParticipantsEditor.tsx'
import { Button, cx } from '../components/ui.tsx'
import { useWorkspace } from '../lib/workspace.tsx'

function isSpeakerField(field: SubmissionFormField) {
  return ['first_name', 'last_name', 'email', 'company', 'job_title', 'biography'].includes(
    field.purpose,
  )
}

function formatFormDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
    timeZoneName: 'short',
  }).format(new Date(value))
}

export function PublicSubmissionView({ slug }: { slug: string }) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload?.state
  const form = state?.submissionForms?.find((entry) => entry.slug === slug)
  const event = state?.events.find((entry) => entry.id === form?.eventId)
  const [answers, setAnswers] = useState<SubmissionAnswers>({})
  const [contributors, setContributors] = useState<SubmissionContributor[]>([])
  const [speakerAccessKey, setSpeakerAccessKey] = useState('')
  const [kind, setKind] = useState<SubmissionKind | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmationId, setConfirmationId] = useState<string | null>(null)
  const activeKind = kind ?? form?.allowedKinds[0] ?? 'abstract'
  const visibleFields = useMemo(
    () => (state && form ? visibleSubmissionFormFields(state, form.id, answers) : []),
    [answers, form, state],
  )

  useEffect(() => {
    const stored = window.localStorage.getItem(`programkit:speaker:${slug}`)
    if (stored) setSpeakerAccessKey(stored)
  }, [slug])

  if (!payload || !form || !event) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <div className="max-w-md text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
            This call for proposals is unavailable
          </h1>
          <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
            Check the link or contact the event team for a current submission form.
          </p>
        </div>
      </div>
    )
  }

  function setAnswer(key: string, value: SubmissionAnswers[string]) {
    setAnswers((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function createDraft(successMessage: string) {
    let created = await execute(
      'submission.create',
      {
        formId: form!.id,
        kind: activeKind,
        answers,
        contributors,
        speakerAccessKey: speakerAccessKey || undefined,
      },
      undefined,
      successMessage,
    )
    if (!created.ok && created.error?.code === 'FORBIDDEN' && speakerAccessKey) {
      window.localStorage.removeItem(`programkit:speaker:${slug}`)
      setSpeakerAccessKey('')
      created = await execute(
        'submission.create',
        {
          formId: form!.id,
          kind: activeKind,
          answers,
          contributors,
        },
        undefined,
        successMessage,
      )
    }
    return created
  }

  function createdSubmissionReference(created: Awaited<ReturnType<typeof createDraft>>) {
    const data = created.data as
      | {
          submissionId?: string
          submission?: { id?: string; speakerAccessKey?: string }
        }
      | undefined
    return {
      submissionId: data?.submissionId ?? data?.submission?.id,
      nextSpeakerAccessKey: data?.submission?.speakerAccessKey,
    }
  }

  async function saveDraft() {
    const created = await createDraft('Draft saved.')
    if (!created.ok) {
      setFieldErrors(
        created.error?.fields ?? {
          _form: created.error?.message ?? 'Check the form and try again.',
        },
      )
      return
    }
    const { submissionId, nextSpeakerAccessKey } = createdSubmissionReference(created)
    if (!submissionId || !nextSpeakerAccessKey) {
      setFieldErrors({ _form: 'The draft was saved, but its reference was not returned.' })
      return
    }
    setSpeakerAccessKey(nextSpeakerAccessKey)
    window.localStorage.setItem(`programkit:speaker:${slug}`, nextSpeakerAccessKey)
    window.location.href = `/submit/${slug}/mine/${encodeURIComponent(nextSpeakerAccessKey)}`
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const created = await createDraft('Draft saved.')
    if (!created.ok) {
      setFieldErrors(
        created.error?.fields ?? {
          _form: created.error?.message ?? 'Check the form and try again.',
        },
      )
      return
    }
    const { submissionId, nextSpeakerAccessKey } = createdSubmissionReference(created)
    if (!submissionId || !nextSpeakerAccessKey) {
      setFieldErrors({ _form: 'The draft was saved, but its reference was not returned.' })
      return
    }
    const submitted = await execute(
      'submission.submit',
      { submissionId, speakerAccessKey: nextSpeakerAccessKey },
      undefined,
      'Proposal submitted.',
    )
    if (!submitted.ok) {
      setFieldErrors(
        submitted.error?.fields ?? {
          _form: submitted.error?.message ?? 'Check the form and try again.',
        },
      )
      return
    }
    setSpeakerAccessKey(nextSpeakerAccessKey)
    window.localStorage.setItem(`programkit:speaker:${slug}`, nextSpeakerAccessKey)
    setConfirmationId(submissionId)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (confirmationId) {
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader eventName={event.name} />
        <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:px-6 sm:py-28">
          <CheckCircleIcon className="size-12 shrink-0 fill-emerald-600" />
          <h1 className="max-w-[22ch] pt-6 text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            Thank you for sharing your work
          </h1>
          <p className="max-w-[62ch] pt-4 text-pretty text-base text-zinc-600">
            {form.confirmationMessage}
          </p>
          <div className="mt-8 w-full max-w-md rounded-xl bg-zinc-50 p-5 text-left ring-1 ring-zinc-950/5">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">What happens next</p>
            <ol role="list" className="flex flex-col gap-3 pt-3">
              {[
                'Your email is saved with the proposal for program updates.',
                'The program committee reviews submissions after the call closes.',
                'You will receive a decision and portal link by email.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white font-mono text-sm tabular-nums text-zinc-500 ring-1 ring-zinc-950/10">
                    {index + 1}
                  </span>
                  <p className="text-pretty text-base text-zinc-600 sm:text-sm">{step}</p>
                </li>
              ))}
            </ol>
          </div>
          <p className="pt-6 font-mono text-sm text-zinc-400">Reference {confirmationId}</p>
          <div className="pt-6">
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = `/submit/${slug}/mine/${encodeURIComponent(speakerAccessKey)}`
              }}
            >
              View my submissions
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const availability = submissionFormAvailability(form)
  if (availability !== 'open') {
    const scheduled = availability === 'scheduled'
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader eventName={event.name} />
        <main className="mx-auto flex max-w-3xl flex-col items-start px-4 py-16 sm:px-6 sm:py-24">
          <ClockIcon className="size-10 shrink-0 fill-amber-500" />
          <h1 className="max-w-[22ch] pt-6 text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {scheduled ? 'Submissions open soon' : 'Submissions are closed'}
          </h1>
          <p className="max-w-[58ch] pt-3 text-pretty text-base text-zinc-600">
            {scheduled
              ? `${form.title} opens ${form.opensAt ? formatFormDate(form.opensAt, event.timezone) : 'soon'}.`
              : `The submission window for ${form.title} is no longer open.`}
          </p>
          <dl className="mt-8 grid w-full gap-5 rounded-2xl bg-zinc-50 p-5 ring-1 ring-zinc-950/5 sm:grid-cols-2 sm:p-6">
            <div>
              <dt className="text-sm font-medium text-zinc-950">Event</dt>
              <dd className="pt-1 text-base text-zinc-600 sm:text-sm">{event.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-zinc-950">
                {scheduled ? 'Opens' : 'Deadline'}
              </dt>
              <dd className="pt-1 text-base text-zinc-600 sm:text-sm">
                {scheduled && form.opensAt
                  ? formatFormDate(form.opensAt, event.timezone)
                  : form.closesAt
                    ? formatFormDate(form.closesAt, event.timezone)
                    : 'Set by the program team'}
              </dd>
            </div>
          </dl>
        </main>
      </div>
    )
  }

  const proposalFields = visibleFields.filter((field) => !isSpeakerField(field))
  const speakerFields = visibleFields.filter(isSpeakerField)

  return (
    <div className="min-h-dvh bg-white">
      <PublicHeader eventName={event.name} />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[4fr_7fr] lg:gap-16">
        <aside className="min-w-0 lg:sticky lg:top-10 lg:self-start">
          <h1 className="max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {form.title}
          </h1>
          <p className="max-w-[48ch] pt-4 text-pretty text-base text-zinc-600">
            {form.description}
          </p>
          <dl className="flex flex-col gap-4 border-t border-zinc-950/5 pt-6 mt-6">
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
              <dt className="text-base font-medium text-zinc-950 sm:text-sm">Submissions close</dt>
              <dd className="flex items-center gap-2 text-zinc-500">
                <ClockIcon className="size-4 h-lh shrink-0 fill-current" />
                <p className="text-base sm:text-sm">
                  {form.closesAt ? formatFormDate(form.closesAt, event.timezone) : 'No close date'}
                </p>
              </dd>
            </div>
          </dl>
        </aside>

        <form className="min-w-0" onSubmit={(event) => void submit(event)} noValidate>
          <div className="flex flex-col gap-10">
            {form.allowedKinds.length > 1 ? (
              <fieldset>
                <legend className="text-lg font-semibold text-zinc-950">
                  What are you proposing?
                </legend>
                <div className="grid gap-3 pt-3 sm:grid-cols-2">
                  {form.allowedKinds.map((option) => (
                    <label
                      key={option}
                      className={cx(
                        'flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1',
                        activeKind === option ? 'ring-blue-600' : 'ring-zinc-950/10',
                      )}
                    >
                      <span className="flex h-lh shrink-0 items-center text-base sm:text-sm">
                        <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
                          <input
                            type="radio"
                            name="submission-kind"
                            value={option}
                            checked={activeKind === option}
                            onChange={() => setKind(option)}
                            className="col-start-1 row-start-1 appearance-none rounded-full border border-zinc-300 bg-white checked:border-blue-600 checked:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:border-zinc-300 disabled:bg-zinc-100 disabled:checked:bg-zinc-100 forced-colors:appearance-auto"
                          />
                          <span className="pointer-events-none col-start-1 row-start-1 size-[round(down,40%,1px)] self-center justify-self-center rounded-full bg-white group-not-has-checked:opacity-0" />
                        </span>
                      </span>
                      <span className="min-w-0">
                        <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                          {option === 'abstract' ? 'Open proposal' : 'Invited session'}
                        </span>
                        <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                          {option === 'abstract'
                            ? 'Submit an idea for committee review.'
                            : 'Provide details for a guaranteed program session.'}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <FormSection
              title="Your proposal"
              description="Tell the committee what attendees will learn and how you plan to deliver it."
              fields={proposalFields}
              answers={answers}
              errors={fieldErrors}
              onChange={setAnswer}
            />

            <SubmissionParticipantsEditor contributors={contributors} onChange={setContributors} />

            <FormSection
              title="About you"
              description="This information becomes your speaker profile only if the proposal is accepted."
              fields={speakerFields}
              answers={answers}
              errors={fieldErrors}
              onChange={setAnswer}
            />

            {fieldErrors._form ? (
              <p className="rounded-lg bg-rose-50 p-3 text-pretty text-base text-rose-700 ring-1 ring-rose-700/10 sm:text-sm">
                {fieldErrors._form}
              </p>
            ) : null}

            <div className="flex flex-col gap-3 border-t border-zinc-950/5 pt-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[52ch] text-pretty text-base text-zinc-500 sm:text-sm">
                Save a private draft now, or submit when your proposal is ready for review.
              </p>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Button type="button" disabled={mutating} onClick={() => void saveDraft()}>
                  Save draft
                </Button>
                <Button type="submit" variant="primary" disabled={mutating}>
                  Submit proposal
                </Button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}

function PublicHeader({ eventName }: { eventName: string }) {
  return (
    <header className="border-b border-zinc-950/5 bg-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="/"
          aria-label="ProgramKit homepage"
          className="focus-ring flex items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-zinc-950"
        >
          <ProgramKitMark className="size-6" />
          ProgramKit
        </a>
        <p className="truncate text-base text-zinc-500 sm:text-sm">{eventName}</p>
      </div>
    </header>
  )
}

function FormSection({
  title,
  description,
  fields,
  answers,
  errors,
  onChange,
}: {
  title: string
  description: string
  fields: SubmissionFormField[]
  answers: SubmissionAnswers
  errors: Record<string, string>
  onChange: (key: string, value: SubmissionAnswers[string]) => void
}) {
  if (fields.length === 0) return null
  return (
    <fieldset className="min-w-0">
      <legend className="text-lg font-semibold text-zinc-950">{title}</legend>
      <p className="text-pretty text-base text-zinc-500 sm:text-sm">{description}</p>
      <div className="pt-5">
        <SubmissionAnswerFields
          fields={fields}
          answers={answers}
          errors={errors}
          onChange={onChange}
        />
      </div>
    </fieldset>
  )
}
