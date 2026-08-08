import { ChevronUpDownIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { toZonedDateTimeInput, zonedDateTimeInputToIso } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Field,
  PageHeader,
  SectionHeading,
  selectControl,
  textControl,
} from '../components/ui.tsx'

interface EventSettingsDraft {
  name: string
  slug: string
  venue: string
  city: string
  timezone: string
  startsAt: string
  endsAt: string
  status: 'planning' | 'active' | 'complete'
}

const emptyDraft: EventSettingsDraft = {
  name: '',
  slug: '',
  venue: '',
  city: '',
  timezone: 'UTC',
  startsAt: '',
  endsAt: '',
  status: 'planning',
}

function draftFromEvent(event: {
  name: string
  slug: string
  venue: string
  city: string
  timezone: string
  startsAt: string
  endsAt: string
  status: EventSettingsDraft['status']
}) {
  return {
    name: event.name,
    slug: event.slug,
    venue: event.venue,
    city: event.city,
    timezone: event.timezone,
    startsAt: toZonedDateTimeInput(event.startsAt, event.timezone),
    endsAt: toZonedDateTimeInput(event.endsAt, event.timezone),
    status: event.status,
  }
}

export function SettingsView() {
  const { payload, execute, mutating } = useWorkspace()
  const event = payload?.state.events.find((entry) => entry.id === payload.state.activeEventId)
  const [draft, setDraft] = useState<EventSettingsDraft>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!event) return
    setDraft(draftFromEvent(event))
    setErrors({})
  }, [event])

  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
    }
  }, [])

  if (!payload || !event) return null
  const savedDraft = draftFromEvent(event)
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)
  const eventId = event.id
  const eventVersion = event.version ?? 1

  function update<Key extends keyof EventSettingsDraft>(key: Key, value: EventSettingsDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    let startsAt: string
    let endsAt: string
    try {
      startsAt = zonedDateTimeInputToIso(draft.startsAt, draft.timezone)
      endsAt = zonedDateTimeInputToIso(draft.endsAt, draft.timezone)
    } catch (error) {
      setErrors({
        startsAt: error instanceof Error ? error.message : 'Enter valid event dates.',
      })
      return
    }
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      setErrors({ endsAt: 'Choose a time after the event starts.' })
      return
    }
    const response = await execute(
      'event.update',
      { eventId, ...draft, startsAt, endsAt },
      { expectedVersions: { [eventId]: eventVersion } },
      'Event settings saved.',
    )
    if (!response.ok) setErrors(response.error?.fields ?? {})
  }

  return (
    <form
      id="event-settings-form"
      className="flex w-full flex-col gap-8"
      onSubmit={(submitEvent) => void submit(submitEvent)}
    >
      <PageHeader
        title="Event settings"
        actions={
          <Button
            variant="primary"
            type="submit"
            form="event-settings-form"
            disabled={mutating || !dirty}
          >
            {mutating ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-details-heading">
        <SectionHeading id="event-details-heading" title="Event details" />
        <div className="grid gap-5 pt-5 sm:grid-cols-2">
          <Field label="Event name" htmlFor="event-name">
            <input
              id="event-name"
              name="name"
              required
              value={draft.name}
              onChange={(inputEvent) => update('name', inputEvent.target.value)}
              className={textControl}
            />
          </Field>
          <Field
            label="Event slug"
            htmlFor="event-slug"
            hint="Lowercase letters, numbers, and hyphens."
          >
            <input
              id="event-slug"
              name="slug"
              required
              value={draft.slug}
              aria-invalid={Boolean(errors.slug)}
              onChange={(inputEvent) => update('slug', inputEvent.target.value)}
              className={textControl}
            />
            {errors.slug ? <p className="text-sm text-rose-700">{errors.slug}</p> : null}
          </Field>
          <Field label="Venue" htmlFor="event-venue">
            <input
              id="event-venue"
              name="venue"
              required
              value={draft.venue}
              onChange={(inputEvent) => update('venue', inputEvent.target.value)}
              className={textControl}
            />
          </Field>
          <Field label="City" htmlFor="event-city">
            <input
              id="event-city"
              name="city"
              required
              value={draft.city}
              onChange={(inputEvent) => update('city', inputEvent.target.value)}
              className={textControl}
            />
          </Field>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-dates-heading">
        <SectionHeading
          id="event-dates-heading"
          title="Dates and timezone"
          description="Schedule times and public program dates use this timezone."
        />
        <div className="grid gap-5 pt-5 sm:grid-cols-2">
          <Field label="Starts" htmlFor="event-starts-at">
            <input
              id="event-starts-at"
              name="startsAt"
              type="datetime-local"
              required
              value={draft.startsAt}
              aria-invalid={Boolean(errors.startsAt)}
              onChange={(inputEvent) => update('startsAt', inputEvent.target.value)}
              className={textControl}
            />
            {errors.startsAt ? <p className="text-sm text-rose-700">{errors.startsAt}</p> : null}
          </Field>
          <Field label="Ends" htmlFor="event-ends-at">
            <input
              id="event-ends-at"
              name="endsAt"
              type="datetime-local"
              required
              value={draft.endsAt}
              aria-invalid={Boolean(errors.endsAt)}
              onChange={(inputEvent) => update('endsAt', inputEvent.target.value)}
              className={textControl}
            />
            {errors.endsAt ? <p className="text-sm text-rose-700">{errors.endsAt}</p> : null}
          </Field>
          <Field label="Timezone" htmlFor="event-timezone" width="regular">
            <input
              id="event-timezone"
              name="timezone"
              list="event-timezones"
              required
              value={draft.timezone}
              aria-invalid={Boolean(errors.timezone)}
              onChange={(inputEvent) => update('timezone', inputEvent.target.value)}
              className={textControl}
            />
            <datalist id="event-timezones">
              {timeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone} />
              ))}
            </datalist>
            {errors.timezone ? <p className="text-sm text-rose-700">{errors.timezone}</p> : null}
          </Field>
        </div>
        <div className="pt-4">
          <Callout tone="info" title="Schedule-safe changes">
            <p>ProgramKit will not save event dates that leave a scheduled session outside them.</p>
          </Callout>
        </div>
      </section>

      <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-status-heading">
        <SectionHeading id="event-status-heading" title="Status" />
        <div className="pt-5">
          <Field label="Event status" htmlFor="event-status" width="compact">
            <span className="relative grid">
              <select
                id="event-status"
                name="status"
                value={draft.status}
                onChange={(inputEvent) =>
                  update('status', inputEvent.target.value as EventSettingsDraft['status'])
                }
                className={selectControl}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
              </select>
              <ChevronUpDownIcon className="pointer-events-none col-start-1 row-start-1 mr-3 size-4 self-center justify-self-end fill-zinc-400" />
            </span>
          </Field>
        </div>
      </section>
    </form>
  )
}
