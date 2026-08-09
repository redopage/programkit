import { CalendarDaysIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useEffect, useState, type FormEvent } from 'react'

import { useWorkspace } from '../lib/workspace.tsx'
import { eventDateTime } from '../lib/date.ts'
import {
  Avatar,
  Button,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  FilterTabs,
  PageHeader,
  SearchInput,
  selectControl,
  textControl,
  Toolbar,
  TrackBadge,
  sentenceCase,
} from '../components/ui.tsx'

export function SessionsView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [search, setSearch] = useState('')
  const [trackId, setTrackId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editorId, setEditorId] = useState<'new' | string | null>(null)
  if (!payload) return null
  const { state } = payload
  const query = search.trim().toLowerCase()
  const sessions = state.sessions.filter((session) => {
    if (trackId !== 'all' && session.trackId !== trackId) return false
    return !query || `${session.title} ${session.format}`.toLowerCase().includes(query)
  })
  const selected = state.sessions.find((session) => session.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Sessions"
        actions={
          <div className="flex items-center gap-2">
            <Button onClick={() => navigate('/schedule')}>
              <CalendarDaysIcon className="size-4 h-lh shrink-0 fill-current" />
              Open schedule
            </Button>
            <Button variant="primary" onClick={() => setEditorId('new')}>
              <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
              New session
            </Button>
          </div>
        }
      />

      <Toolbar>
        <FilterTabs
          label="Track filters"
          value={trackId}
          onChange={setTrackId}
          options={[{ id: 'all', name: 'All tracks' }, ...state.tracks].map(
            (track) => [track.id, track.name] as const,
          )}
        />
        <SearchInput
          label="Search sessions"
          name="session-search"
          placeholder="Search sessions"
          value={search}
          onChange={setSearch}
        />
      </Toolbar>

      {sessions.length === 0 ? (
        <EmptyState
          title="No sessions in this track"
          description="Accepted proposals become sessions, or add one directly from this page."
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap">
              <div className="inline-block min-w-full px-6 py-2 align-middle">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-950/10">
                      {['Session', 'Track', 'Format', 'People', 'Duration', 'Expected'].map(
                        (heading) => (
                          <th
                            key={heading}
                            scope="col"
                            className="whitespace-nowrap py-2.5 pr-4 text-left text-sm font-medium text-zinc-500"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-950/5">
                    {sessions.map((session) => {
                      const track = state.tracks.find((entry) => entry.id === session.trackId)!
                      const participants = session.participantIds
                        .map((id) => state.participations.find((entry) => entry.id === id))
                        .filter(Boolean)
                      return (
                        <tr
                          key={session.id}
                          className="cursor-pointer hover:bg-zinc-950/2"
                          onClick={() => setSelectedId(session.id)}
                        >
                          <td className="max-w-md py-3 pr-4">
                            <button
                              type="button"
                              className="focus-ring block max-w-full rounded-lg text-left"
                              onClick={() => setSelectedId(session.id)}
                            >
                              <span className="block truncate text-sm font-medium text-zinc-950">
                                {session.title}
                              </span>
                              <span className="block truncate text-sm text-zinc-500">
                                {session.summary}
                              </span>
                            </button>
                          </td>
                          <td className="py-3 pr-4">
                            <TrackBadge name={track.name} color={track.color} />
                          </td>
                          <td className="py-3 pr-4 text-sm text-zinc-600">
                            {sentenceCase(session.format)}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex -space-x-2">
                              {participants.slice(0, 4).map((participation) => {
                                const person = state.people.find(
                                  (entry) => entry.id === participation!.personId,
                                )!
                                return (
                                  <span key={person.id} className="rounded-full ring-2 ring-white">
                                    <Avatar
                                      src={person.avatarUrl}
                                      name={`${person.firstName} ${person.lastName}`}
                                      size="small"
                                    />
                                  </span>
                                )
                              })}
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                            {session.durationMinutes} min
                          </td>
                          <td className="py-3 text-sm tabular-nums text-zinc-600">
                            {session.expectedAttendance}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <ul role="list" className="divide-y divide-zinc-950/5 sm:hidden">
            {sessions.map((session) => {
              const track = state.tracks.find((entry) => entry.id === session.trackId)!
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    className="focus-ring w-full rounded-lg py-4 text-left hover:bg-zinc-950/2"
                    onClick={() => setSelectedId(session.id)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block text-pretty text-base font-medium text-zinc-950">
                          {session.title}
                        </span>
                        <span className="block text-base text-zinc-500">
                          {sentenceCase(session.format)} · {session.durationMinutes} min
                        </span>
                      </span>
                      <TrackBadge name={track.name} color={track.color} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}

      <SessionDrawer
        sessionId={selected?.id ?? null}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        onEdit={() => {
          if (!selected) return
          setSelectedId(null)
          setEditorId(selected.id)
        }}
      />
      <SessionEditor
        key={editorId ?? 'closed'}
        sessionId={editorId === 'new' ? null : editorId}
        open={editorId !== null}
        onClose={() => setEditorId(null)}
      />
    </div>
  )
}

function SessionDrawer({
  sessionId,
  open,
  onClose,
  onEdit,
}: {
  sessionId: string | null
  open: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const { payload } = useWorkspace()
  if (!payload || !sessionId) return null
  const { state } = payload
  const session = state.sessions.find((entry) => entry.id === sessionId)!
  const track = state.tracks.find((entry) => entry.id === session.trackId)!
  const placement = state.placements.find((entry) => entry.sessionId === session.id)
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  return (
    <Drawer open={open} onClose={onClose} title={session.title}>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <TrackBadge name={track.name} color={track.color} />
            <span className="text-base text-zinc-500 sm:text-sm">
              {sentenceCase(session.format)} · {session.durationMinutes} min
            </span>
            <span className="rounded-full bg-zinc-950/5 px-2 py-0.5 text-sm text-zinc-600">
              {session.status === 'ready' ? 'Approved' : sentenceCase(session.status)}
            </span>
          </div>
          <Button size="compact" onClick={onEdit}>
            <PencilSquareIcon className="size-4 shrink-0 fill-current" />
            Edit
          </Button>
        </div>
        <p className="text-pretty text-base text-zinc-600 sm:text-sm">{session.summary}</p>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-base font-medium text-zinc-950 sm:text-sm">Expected attendance</dt>
            <dd className="text-base tabular-nums text-zinc-500 sm:text-sm">
              {session.expectedAttendance}
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium text-zinc-950 sm:text-sm">Schedule</dt>
            <dd className="text-base text-zinc-500 sm:text-sm">
              {placement
                ? eventDateTime(placement.startsAt, event.timezone, {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })
                : 'Not placed'}
            </dd>
          </div>
        </dl>
        <div>
          <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Participants</h3>
          <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
            {session.participantIds.map((participationId) => {
              const participation = state.participations.find(
                (entry) => entry.id === participationId,
              )!
              const person = state.people.find((entry) => entry.id === participation.personId)!
              return (
                <li key={participation.id} className="flex items-center gap-3 py-3">
                  <Avatar src={person.avatarUrl} name={`${person.firstName} ${person.lastName}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="truncate text-base text-zinc-500 sm:text-sm">
                      {sentenceCase(participation.roles.join(', '))}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </Drawer>
  )
}

type SessionDraft = {
  title: string
  summary: string
  format: 'keynote' | 'talk' | 'lightning' | 'panel' | 'workshop' | 'break'
  trackId: string
  participantIds: string[]
  durationMinutes: string
  expectedAttendance: string
  status: 'draft' | 'ready' | 'cancelled'
}

const emptySessionDraft: SessionDraft = {
  title: '',
  summary: '',
  format: 'talk',
  trackId: '',
  participantIds: [],
  durationMinutes: '30',
  expectedAttendance: '100',
  status: 'draft',
}

function SessionEditor({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string | null
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const session = payload?.state.sessions.find((entry) => entry.id === sessionId) ?? null
  const [draft, setDraft] = useState<SessionDraft>(emptySessionDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!payload || !open) return
    setDraft(
      session
        ? {
            title: session.title,
            summary: session.summary,
            format: session.format,
            trackId: session.trackId,
            participantIds: [...session.participantIds],
            durationMinutes: String(session.durationMinutes),
            expectedAttendance: String(session.expectedAttendance),
            status: session.status,
          }
        : { ...emptySessionDraft, trackId: payload.state.tracks[0]?.id ?? '' },
    )
    setErrors({})
  }, [open, payload, session])

  if (!payload) return null
  const { state } = payload
  const speakers = state.participations
    .filter(
      (participation) =>
        participation.eventId === state.activeEventId && participation.status !== 'withdrawn',
    )
    .map((participation) => ({
      participation,
      person: state.people.find((person) => person.id === participation.personId)!,
    }))
    .filter((entry) => Boolean(entry.person))
    .sort((left, right) =>
      `${left.person.firstName} ${left.person.lastName}`.localeCompare(
        `${right.person.firstName} ${right.person.lastName}`,
      ),
    )

  function update<Key extends keyof SessionDraft>(key: Key, value: SessionDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function save(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    const durationMinutes = Number(draft.durationMinutes)
    const expectedAttendance = Number(draft.expectedAttendance)
    const nextErrors: Record<string, string> = {}
    if (!draft.trackId) nextErrors.trackId = 'Create and choose a track first.'
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5) {
      nextErrors.durationMinutes = 'Enter at least 5 minutes.'
    }
    if (!Number.isInteger(expectedAttendance) || expectedAttendance < 1) {
      nextErrors.expectedAttendance = 'Enter at least 1 attendee.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    const input = { ...draft, durationMinutes, expectedAttendance }
    const response = session
      ? await execute(
          'session.update',
          { sessionId: session.id, ...input },
          { expectedVersions: { [session.id]: session.version } },
          'Session updated.',
        )
      : await execute('session.create', input, undefined, 'Session created.')
    if (!response.ok) {
      setErrors(response.error?.fields ?? { form: response.error?.message ?? 'Could not save.' })
      return
    }
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={session ? 'Edit session' : 'New session'}
      description="Shape the program content first. Schedule it when the session is ready."
      size="wide"
      footer={
        <>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="session-editor-form"
            variant="primary"
            disabled={mutating || state.tracks.length === 0}
          >
            {mutating ? 'Saving…' : session ? 'Save session' : 'Create session'}
          </Button>
        </>
      }
    >
      <form
        id="session-editor-form"
        className="grid gap-5 sm:grid-cols-2"
        onSubmit={(submitEvent) => void save(submitEvent)}
      >
        <div className="sm:col-span-2">
          <Field label="Session title" htmlFor="session-title">
            <input
              id="session-title"
              required
              value={draft.title}
              onChange={(event) => update('title', event.target.value)}
              className={textControl}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Abstract" htmlFor="session-summary">
            <textarea
              id="session-summary"
              required
              rows={5}
              value={draft.summary}
              onChange={(event) => update('summary', event.target.value)}
              className={textControl}
            />
          </Field>
        </div>
        <Field label="Format" htmlFor="session-format">
          <select
            id="session-format"
            value={draft.format}
            onChange={(event) => update('format', event.target.value as SessionDraft['format'])}
            className={selectControl}
          >
            <option value="keynote">Keynote</option>
            <option value="talk">Talk</option>
            <option value="lightning">Lightning talk</option>
            <option value="panel">Panel</option>
            <option value="workshop">Workshop</option>
            <option value="break">Break</option>
          </select>
        </Field>
        <Field label="Track" htmlFor="session-track">
          <select
            id="session-track"
            required
            value={draft.trackId}
            aria-invalid={Boolean(errors.trackId)}
            onChange={(event) => update('trackId', event.target.value)}
            className={selectControl}
          >
            <option value="">Choose a track</option>
            {state.tracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
          {errors.trackId ? <p className="text-sm text-rose-700">{errors.trackId}</p> : null}
        </Field>
        <Field label="Duration" htmlFor="session-duration" hint="Minutes">
          <input
            id="session-duration"
            type="number"
            min={5}
            max={480}
            required
            value={draft.durationMinutes}
            aria-invalid={Boolean(errors.durationMinutes)}
            onChange={(event) => update('durationMinutes', event.target.value)}
            className={textControl}
          />
          {errors.durationMinutes ? (
            <p className="text-sm text-rose-700">{errors.durationMinutes}</p>
          ) : null}
        </Field>
        <Field label="Expected attendance" htmlFor="session-attendance">
          <input
            id="session-attendance"
            type="number"
            min={1}
            max={100000}
            required
            value={draft.expectedAttendance}
            aria-invalid={Boolean(errors.expectedAttendance)}
            onChange={(event) => update('expectedAttendance', event.target.value)}
            className={textControl}
          />
          {errors.expectedAttendance ? (
            <p className="text-sm text-rose-700">{errors.expectedAttendance}</p>
          ) : null}
        </Field>
        <Field label="Status" htmlFor="session-status">
          <select
            id="session-status"
            value={draft.status}
            onChange={(event) => update('status', event.target.value as SessionDraft['status'])}
            className={selectControl}
          >
            <option value="draft">Draft</option>
            <option value="ready">Approved</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-base font-medium text-zinc-950 sm:text-sm">Speakers</legend>
          {speakers.length === 0 ? (
            <p className="pt-2 text-base text-zinc-500 sm:text-sm">
              Add a speaker first, or create this session without one.
            </p>
          ) : (
            <div className="mt-2 grid max-h-56 gap-1 overflow-y-auto rounded-2xl bg-zinc-950/2 p-2 ring-1 ring-zinc-950/8 sm:grid-cols-2">
              {speakers.map(({ participation, person }) => (
                <label
                  key={participation.id}
                  className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 hover:bg-white sm:min-h-9"
                >
                  <input
                    type="checkbox"
                    checked={draft.participantIds.includes(participation.id)}
                    onChange={(event) =>
                      update(
                        'participantIds',
                        event.target.checked
                          ? [...draft.participantIds, participation.id]
                          : draft.participantIds.filter((id) => id !== participation.id),
                      )
                    }
                    className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="min-w-0 truncate text-base text-zinc-700 sm:text-sm">
                    {person.firstName} {person.lastName}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>
        {errors.form ? <p className="sm:col-span-2 text-sm text-rose-700">{errors.form}</p> : null}
      </form>
    </Dialog>
  )
}
