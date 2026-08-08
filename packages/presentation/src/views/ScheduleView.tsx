import {
  CheckCircleIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useState, type FormEvent } from 'react'

import { scheduleConflicts } from '@crm-library/core'

import { eventDateTime, toZonedDateTimeInput, zonedDateTimeInputToIso } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Drawer, PageHeader, TrackBadge, cx } from '../components/ui.tsx'

export function ScheduleView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!payload) return null
  const { state } = payload
  const conflicts = scheduleConflicts(state)
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error')
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const draftVersion =
    state.placements.length > 0
      ? Math.max(...state.placements.map((placement) => placement.scheduleVersion))
      : 0
  const timeLabel = (iso: string) =>
    eventDateTime(iso, event.timezone, { hour: 'numeric', minute: '2-digit' })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={`Draft version ${draftVersion}`}
        title="Schedule studio"
        description="Place sessions manually with immediate participant, room, and capacity checks. Publication remains a separate human action."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/agenda')}>
              <GlobeAltIcon className="size-4 h-lh shrink-0 fill-current" />
              Preview agenda
            </Button>
            <Button
              variant="primary"
              disabled={mutating || hardConflicts.length > 0}
              onClick={() => void execute('schedule.publish', {}, undefined, 'Schedule published.')}
            >
              Publish schedule
            </Button>
          </>
        }
      />

      <div
        className={cx(
          'flex items-start gap-3 rounded-xl p-4 ring-1',
          hardConflicts.length > 0
            ? 'bg-rose-50 text-rose-900 ring-rose-900/10'
            : 'bg-emerald-50 text-emerald-900 ring-emerald-900/10',
        )}
      >
        {hardConflicts.length > 0 ? (
          <ExclamationTriangleIcon className="size-4 h-lh shrink-0 fill-rose-600" />
        ) : (
          <CheckCircleIcon className="size-4 h-lh shrink-0 fill-emerald-600" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-medium sm:text-sm">
            {hardConflicts.length > 0
              ? `${hardConflicts.length} blocking conflict${hardConflicts.length === 1 ? '' : 's'} before publish`
              : 'The schedule is ready to publish'}
          </p>
          <p className="text-pretty text-base opacity-75 sm:text-sm">
            {hardConflicts[0]?.message ??
              `${conflicts.length} non-blocking capacity warning${conflicts.length === 1 ? '' : 's'} remain.`}
          </p>
        </div>
      </div>

      <div className="hidden min-w-0 grid-cols-3 gap-3 lg:grid">
        {state.rooms.map((room) => (
          <section key={room.id} aria-labelledby={`room-${room.id}`} className="min-w-0">
            <div className="flex items-end justify-between gap-3 border-b border-zinc-950/10 pb-3">
              <div className="min-w-0">
                <h2
                  id={`room-${room.id}`}
                  className="truncate text-base font-semibold text-zinc-950"
                >
                  {room.name}
                </h2>
                <p className="text-sm tabular-nums text-zinc-500">Capacity {room.capacity}</p>
              </div>
              <p className="text-sm tabular-nums text-zinc-500">
                {state.placements.filter((entry) => entry.roomId === room.id).length} sessions
              </p>
            </div>
            <ol role="list" className="flex flex-col gap-2 pt-3">
              {state.placements
                .filter((placement) => placement.roomId === room.id)
                .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
                .map((placement) => {
                  const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
                  const track = state.tracks.find((entry) => entry.id === session.trackId)!
                  const placementConflicts = conflicts.filter((conflict) =>
                    conflict.placementIds.includes(placement.id),
                  )
                  return (
                    <li key={placement.id}>
                      <button
                        type="button"
                        className={cx(
                          'focus-ring w-full rounded-xl bg-white p-3 text-left shadow-sm ring-1 hover:-translate-y-px',
                          placementConflicts.some((conflict) => conflict.severity === 'error')
                            ? 'ring-rose-500/40'
                            : 'ring-zinc-950/10',
                        )}
                        onClick={() => setSelectedId(placement.id)}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium tabular-nums text-zinc-500">
                            {timeLabel(placement.startsAt)}–{timeLabel(placement.endsAt)}
                          </span>
                          {placementConflicts.length > 0 ? (
                            <ExclamationTriangleIcon className="size-4 shrink-0 fill-rose-500" />
                          ) : null}
                        </span>
                        <span className="block pt-2 text-pretty text-sm font-medium text-zinc-950">
                          {session.title}
                        </span>
                        <span className="mt-3 flex items-center justify-between gap-2">
                          <TrackBadge name={track.name} color={track.color} />
                          <span className="text-sm tabular-nums text-zinc-500">
                            {session.expectedAttendance} expected
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ol>
          </section>
        ))}
      </div>

      <div className="lg:hidden">
        <ol role="list" className="divide-y divide-zinc-950/5">
          {state.placements
            .slice()
            .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
            .map((placement) => {
              const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
              const track = state.tracks.find((entry) => entry.id === session.trackId)!
              const room = state.rooms.find((entry) => entry.id === placement.roomId)!
              return (
                <li key={placement.id}>
                  <button
                    type="button"
                    className="focus-ring flex w-full gap-4 rounded-lg py-4 text-left hover:bg-zinc-950/2"
                    onClick={() => setSelectedId(placement.id)}
                  >
                    <span className="w-20 shrink-0 text-base font-medium tabular-nums text-zinc-950">
                      {timeLabel(placement.startsAt)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-pretty text-base font-medium text-zinc-950">
                        {session.title}
                      </span>
                      <span className="block text-base text-zinc-500">{room.name}</span>
                      <span className="mt-2 block">
                        <TrackBadge name={track.name} color={track.color} />
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
        </ol>
      </div>

      <MoveSessionDrawer
        placementId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
      />
      <p className="text-base text-zinc-500 sm:text-sm">
        Times shown in {event.timezone}. Every accepted move is versioned and added to the audit
        trail.
      </p>
    </div>
  )
}

function MoveSessionDrawer({
  placementId,
  open,
  onClose,
}: {
  placementId: string | null
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const placement = payload?.state.placements.find((entry) => entry.id === placementId)
  const timeZone =
    payload?.state.events.find((entry) => entry.id === payload.state.activeEventId)?.timezone ??
    'UTC'
  const [roomId, setRoomId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)

  useEffect(() => {
    if (!placement) return
    setRoomId(placement.roomId)
    setStartsAt(toZonedDateTimeInput(placement.startsAt, timeZone))
    setTimeError(null)
  }, [placement, timeZone])

  if (!payload || !placement) return null
  const { state } = payload
  const session = state.sessions.find((entry) => entry.id === placement.sessionId)!

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    let iso: string
    try {
      iso = zonedDateTimeInputToIso(startsAt, timeZone)
      setTimeError(null)
    } catch (error) {
      setTimeError(error instanceof Error ? error.message : 'Enter a valid local date and time.')
      return
    }
    const response = await execute(
      'schedule.move-session',
      { placementId: placement!.id, roomId, startsAt: iso },
      { expectedVersions: { [placement!.id]: placement!.version } },
      `${session.title} moved.`,
    )
    if (!response.ok) return
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Move session"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="move-session-form" disabled={mutating}>
            Move session
          </Button>
        </>
      }
    >
      <form
        id="move-session-form"
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <div>
          <p className="text-base font-medium text-zinc-950 sm:text-sm">{session.title}</p>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Conflict detection runs again before this move is accepted.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Room</span>
          <span className="relative">
            <select
              name="roomId"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              className="focus-ring min-h-11 w-full appearance-none rounded-lg bg-white py-2 pr-9 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
            >
              {state.rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity}
                </option>
              ))}
            </select>
            <ChevronUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 fill-zinc-400" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Start time</span>
          <input
            type="datetime-local"
            name="startsAt"
            required
            value={startsAt}
            aria-invalid={Boolean(timeError)}
            aria-describedby={timeError ? 'move-session-time-error' : undefined}
            onChange={(event) => {
              setStartsAt(event.target.value)
              setTimeError(null)
            }}
            className="focus-ring min-h-11 rounded-lg bg-white px-3 py-2 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
          />
          {timeError ? (
            <span id="move-session-time-error" className="text-sm text-rose-700">
              {timeError}
            </span>
          ) : null}
        </label>
      </form>
    </Drawer>
  )
}
