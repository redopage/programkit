import { CheckCircleIcon, ClockIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'

import {
  submissionFormAvailability,
  submissionAnswerErrors,
  visibleSubmissionFormFields,
  type Event as ProgramEvent,
  type SubmissionAnswers,
  type SubmissionContributor,
  type SubmissionForm,
  type SubmissionFormField,
  type SubmissionFieldPurpose,
  type SubmissionKind,
  type SubmissionReceiptDeliveryStatus,
} from '@programkit/core'

import { ProgramKitMark } from '../components/brand.tsx'
import { ExternalAccessForm } from '../components/ExternalAccessForm.tsx'
import { SubmissionAnswerFields } from '../components/SubmissionAnswerFields.tsx'
import { SubmissionParticipantsEditor } from '../components/SubmissionParticipantsEditor.tsx'
import { Button, StatusBadge, cx } from '../components/ui.tsx'
import { useExternalAccess } from '../lib/external-access.ts'
import { speakerSubmissionsPath } from '../lib/public-links.ts'
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

function configuredOptions(fields: SubmissionFormField[], purpose: SubmissionFieldPurpose) {
  return fields.find((field) => field.purpose === purpose)?.options ?? []
}

export function PublicSubmissionView({ slug }: { slug: string }) {
  const { payload, execute, mutating } = useWorkspace()
  const state = payload?.state
  const form = state?.submissionForms?.find((entry) => entry.slug === slug)
  const event = state?.events.find((entry) => entry.id === form?.eventId)
  const externalAccess = useExternalAccess(event?.id ?? '', slug)
  const [answers, setAnswers] = useState<SubmissionAnswers>({})
  const [contributors, setContributors] = useState<SubmissionContributor[]>([])
  const [speakerAccessKey, setSpeakerAccessKey] = useState('')
  const [kind, setKind] = useState<SubmissionKind | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [confirmation, setConfirmation] = useState<{
    submissionId: string
    recipientEmail: string
    receiptStatus: SubmissionReceiptDeliveryStatus | null
  } | null>(null)
  const focusErrorsRef = useRef(false)
  const activeKind = kind ?? form?.allowedKinds[0] ?? 'abstract'
  const visibleFields = useMemo(
    () => (state && form ? visibleSubmissionFormFields(state, form.id, answers) : []),
    [answers, form, state],
  )

  useEffect(() => {
    const stored = window.localStorage.getItem(`programkit:speaker:${slug}`)
    if (stored) setSpeakerAccessKey(stored)
  }, [slug])

  useEffect(() => {
    const email = externalAccess.session.identity?.email
    if (!email || !state || !form) return
    const emailField = state.submissionFormFields.find(
      (field) => field.formId === form.id && field.purpose === 'email',
    )
    if (emailField) {
      setAnswers((current) =>
        current[emailField.key] === email ? current : { ...current, [emailField.key]: email },
      )
    }
    if (externalAccess.session.submissionAccessKey) {
      setSpeakerAccessKey(externalAccess.session.submissionAccessKey)
    }
  }, [externalAccess.session, form, state])

  useEffect(() => {
    if (!focusErrorsRef.current) return
    const firstInvalidField = visibleFields.find((field) => fieldErrors[field.key])
    if (!firstInvalidField) return
    document.getElementById(`submission-answer-${firstInvalidField.id}`)?.focus()
    focusErrorsRef.current = false
  }, [fieldErrors, visibleFields])

  if (!payload || !form || !event) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white px-6 pt-[max(--spacing(6),env(safe-area-inset-top))] pb-[max(--spacing(6),env(safe-area-inset-bottom))]">
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
    window.location.href = speakerSubmissionsPath(event!.id, slug, nextSpeakerAccessKey)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = submissionAnswerErrors(state!, form!.id, answers)
    if (Object.keys(errors).length > 0) {
      focusErrorsRef.current = true
      setFieldErrors(errors)
      return
    }
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
    const submittedData = submitted.data as
      | {
          receiptDelivery?: {
            recipientEmail?: string
            status?: SubmissionReceiptDeliveryStatus
          }
        }
      | undefined
    setConfirmation({
      submissionId,
      recipientEmail: submittedData?.receiptDelivery?.recipientEmail ?? '',
      receiptStatus: submittedData?.receiptDelivery?.status ?? null,
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (confirmation) {
    const receiptStatus = confirmation.receiptStatus
    const receiptBadgeLabel =
      receiptStatus === 'delivered'
        ? 'Delivered'
        : receiptStatus === 'failed'
          ? 'Not delivered'
          : receiptStatus === 'suppressed'
            ? 'No email receipt'
            : 'Not sent yet'
    const receiptSummary =
      receiptStatus === 'delivered'
        ? 'Your confirmation receipt was delivered.'
        : receiptStatus === 'failed'
          ? 'Your confirmation receipt was prepared, but the delivery attempt did not go through. The event team can retry it.'
          : receiptStatus === 'suppressed'
            ? 'No confirmation receipt could be prepared for this submission, so no email will arrive.'
            : 'Your confirmation receipt is prepared and waiting in the outbox. It has not been delivered.'
    const recipientLabel =
      receiptStatus === 'delivered'
        ? 'Delivered to'
        : receiptStatus === 'failed'
          ? 'Addressed to'
          : 'Prepared for'
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader eventName={event.name} />
        <main className="mx-auto flex max-w-xl flex-col px-4 py-12 sm:px-6 sm:py-16">
          <CheckCircleIcon className="size-10 shrink-0 fill-emerald-600" />
          <h1 className="pt-5 text-balance text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
            Proposal submitted
          </h1>
          <p className="pt-3 text-pretty text-base text-zinc-600">{form.confirmationMessage}</p>
          <p className="pt-2 text-pretty text-base text-zinc-600">
            It is saved for the {event.name} program committee now. Nothing further is needed from
            you.
          </p>

          <div className="mt-8 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">Your reference</p>
            <p className="break-all pt-1 font-mono text-lg text-zinc-950">
              {confirmation.submissionId}
            </p>
            <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
              Save this now. It identifies your proposal to the event team even if no email ever
              reaches you.
            </p>
          </div>

          {receiptStatus ? (
            <section
              aria-labelledby="receipt-heading"
              className="mt-8 border-t border-zinc-950/5 pt-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <h2 id="receipt-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
                  Email receipt
                </h2>
                <StatusBadge status={receiptStatus} label={receiptBadgeLabel} />
              </div>
              <p className="pt-2 text-pretty text-base text-zinc-600 sm:text-sm">
                {receiptSummary}
              </p>
              {confirmation.recipientEmail ? (
                <div className="mt-3 border-l-2 border-zinc-950/10 pl-3">
                  <p className="text-sm text-zinc-500">{recipientLabel}</p>
                  <p className="break-all text-base text-zinc-950 sm:text-sm">
                    {confirmation.recipientEmail}
                  </p>
                </div>
              ) : null}
              {receiptStatus === 'pending_provider' ? (
                <p className="pt-3 text-pretty text-base text-zinc-500 sm:text-sm">
                  Email starts flowing only after the event team connects an email provider and
                  verifies the sending domain. Both are required, so treat your reference above as
                  the record of this submission.
                </p>
              ) : null}
            </section>
          ) : null}

          <section aria-labelledby="next-heading" className="mt-8 border-t border-zinc-950/5 pt-6">
            <h2 id="next-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              What happens next
            </h2>
            <ol role="list" className="flex flex-col gap-3 pt-3">
              {[
                'Your proposal and contact details are saved for the program committee.',
                'The committee reviews proposals after the call for proposals closes.',
                'The event team contacts you about the outcome.',
              ].map((step, index) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-zinc-100 font-mono text-sm tabular-nums text-zinc-600">
                    {index + 1}
                  </span>
                  <p className="text-pretty text-base text-zinc-600 sm:text-sm">{step}</p>
                </li>
              ))}
            </ol>
          </section>
          <div className="pt-6">
            <Button
              variant="primary"
              onClick={() => {
                window.location.href = speakerSubmissionsPath(event.id, slug, speakerAccessKey)
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

  if (externalAccess.enabled && externalAccess.loading) {
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader eventName={event.name} />
        <main className="grid min-h-[calc(100dvh-4rem)] place-items-center px-6 py-16">
          <p className="text-base text-zinc-500 sm:text-sm">Loading proposal access…</p>
        </main>
      </div>
    )
  }

  if (externalAccess.enabled && !externalAccess.session.authenticated) {
    const formatOptions = configuredOptions(visibleFields, 'session_format')
    const trackOptions = configuredOptions(visibleFields, 'track')
    return (
      <div className="min-h-dvh bg-white">
        <PublicHeader eventName={event.name} />
        <main className="mx-auto grid min-h-[calc(100dvh-4rem)] max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[4fr_7fr] lg:gap-16">
          <SubmissionIntroduction
            form={form}
            event={event}
            formatOptions={formatOptions}
            trackOptions={trackOptions}
          />
          <ExternalAccessForm
            title="Start your proposal"
            onSubmit={async (input) => {
              const result = await externalAccess.authenticate(input)
              if (input.intent === 'signin' && result.submissionAccessKey) {
                const destination = result.destinations?.find(
                  (entry) => entry.kind === 'submissions',
                )
                if (destination) window.location.href = destination.href
              }
            }}
          />
        </main>
      </div>
    )
  }

  const proposalFields = visibleFields.filter((field) => !isSpeakerField(field))
  const speakerFields = visibleFields.filter(isSpeakerField)
  const formatOptions = configuredOptions(visibleFields, 'session_format')
  const trackOptions = configuredOptions(visibleFields, 'track')

  return (
    <div className="min-h-dvh bg-white">
      <PublicHeader
        eventName={event.name}
        accountEmail={externalAccess.session.identity?.email}
        onSignOut={
          externalAccess.enabled
            ? async () => {
                await externalAccess.logout()
                window.location.reload()
              }
            : undefined
        }
      />
      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[4fr_7fr] lg:gap-16">
        <SubmissionIntroduction
          form={form}
          event={event}
          formatOptions={formatOptions}
          trackOptions={trackOptions}
          sticky
        />

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
              lockedPurposes={externalAccess.session.identity ? ['email'] : []}
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

function SubmissionIntroduction({
  form,
  event,
  formatOptions,
  trackOptions,
  sticky = false,
}: {
  form: SubmissionForm
  event: ProgramEvent
  formatOptions: Array<{ value: string; label: string }>
  trackOptions: Array<{ value: string; label: string }>
  sticky?: boolean
}) {
  return (
    <aside className={cx('min-w-0', sticky && 'lg:sticky lg:top-10 lg:self-start')}>
      <h1 className="max-w-[18ch] text-balance text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
        {form.title}
      </h1>
      <p className="max-w-[48ch] pt-4 text-pretty text-base text-zinc-600">{form.description}</p>
      <dl className="mt-6 flex flex-col gap-4 border-t border-zinc-950/5 pt-6">
        <div>
          <dt className="text-base font-medium text-zinc-950 sm:text-sm">Event</dt>
          <dd className="text-base text-zinc-500 sm:text-sm">{event.name}</dd>
        </div>
        {event.venue || event.city ? (
          <div>
            <dt className="text-base font-medium text-zinc-950 sm:text-sm">Location</dt>
            <dd className="text-base text-zinc-500 sm:text-sm">
              {[event.venue, event.city].filter(Boolean).join(' · ')}
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-base font-medium text-zinc-950 sm:text-sm">Submissions close</dt>
          <dd className="flex items-center gap-2 text-zinc-500">
            <ClockIcon className="size-4 h-lh shrink-0 fill-current" />
            <span className="text-base sm:text-sm">
              {form.closesAt ? formatFormDate(form.closesAt, event.timezone) : 'No close date'}
            </span>
          </dd>
        </div>
        {formatOptions.length > 0 ? (
          <SubmissionOptionSummary label="Formats" options={formatOptions} />
        ) : null}
        {trackOptions.length > 0 ? (
          <SubmissionOptionSummary label="Tracks" options={trackOptions} />
        ) : null}
      </dl>
    </aside>
  )
}

function SubmissionOptionSummary({
  label,
  options,
}: {
  label: string
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div>
      <dt className="text-base font-medium text-zinc-950 sm:text-sm">{label}</dt>
      <dd className="flex flex-wrap gap-1.5 pt-1.5">
        {options.map((option) => (
          <span
            key={option.value}
            className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm text-zinc-600 ring-1 ring-zinc-950/5"
          >
            {option.label}
          </span>
        ))}
      </dd>
    </div>
  )
}

function PublicHeader({
  eventName,
  accountEmail,
  onSignOut,
}: {
  eventName: string
  accountEmail?: string
  onSignOut?: () => Promise<void>
}) {
  return (
    <header className="border-b border-zinc-950/5 bg-white pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a
          href="/"
          aria-label="ProgramKit homepage"
          className="focus-ring flex items-center gap-2 rounded-lg text-base font-semibold tracking-tight text-zinc-950"
        >
          <ProgramKitMark className="size-6" />
          ProgramKit
        </a>
        <div className="flex min-w-0 items-center gap-3">
          <p className="truncate text-base text-zinc-500 sm:text-sm">{accountEmail ?? eventName}</p>
          {onSignOut ? (
            <button
              type="button"
              className="focus-ring shrink-0 rounded-lg text-base font-medium text-zinc-600 hover:text-zinc-950 sm:text-sm"
              onClick={() => void onSignOut()}
            >
              Sign out
            </button>
          ) : null}
        </div>
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
  lockedPurposes,
  onChange,
}: {
  title: string
  description: string
  fields: SubmissionFormField[]
  answers: SubmissionAnswers
  errors: Record<string, string>
  lockedPurposes?: SubmissionFieldPurpose[]
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
          lockedPurposes={lockedPurposes}
          onChange={onChange}
        />
      </div>
    </fieldset>
  )
}
