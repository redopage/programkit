import {
  ChevronUpDownIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  LinkIcon,
} from '@heroicons/react/16/solid'
import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from 'react'

import { scheduleConflicts, type WorkspaceState } from '@programkit/core'

import { eventDateTime, toZonedDateTimeInput, zonedDateTimeInputToIso } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { publicProgramPath } from '../lib/public-links.ts'
import {
  Button,
  Callout,
  Dialog,
  Drawer,
  Field,
  FilterTabs,
  PageHeader,
  Toolbar,
  TrackBadge,
  cx,
  textControl,
} from '../components/ui.tsx'

type ScheduleMode = 'grid' | 'list'
type SharedProgramView = 'agenda' | 'sessions' | 'speakers' | 'itinerary' | 'gallery'

const sharedProgramViews: Array<{ id: SharedProgramView; label: string }> = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'sessions', label: 'Sessions list' },
  { id: 'speakers', label: 'Speakers list' },
  { id: 'itinerary', label: 'Schedule itinerary' },
  { id: 'gallery', label: 'Speaker gallery' },
]

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

interface DropTarget {
  roomId: string
  startsAt: string
}

interface MoveFeedback {
  tone: 'danger' | 'warning'
  title: string
  detail: string
}

function previewPlacementMove(
  state: WorkspaceState,
  placementId: string,
  roomId: string,
  startsAt: string,
) {
  const preview = structuredClone(state)
  const placement = preview.placements.find((entry) => entry.id === placementId)
  if (!placement) return []
  const session = preview.sessions.find((entry) => entry.id === placement.sessionId)
  if (!session) return []
  placement.roomId = roomId
  placement.startsAt = startsAt
  placement.endsAt = new Date(Date.parse(startsAt) + session.durationMinutes * 60_000).toISOString()
  return scheduleConflicts(preview).filter((conflict) =>
    conflict.placementIds.includes(placementId),
  )
}

export function ScheduleView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mode, setMode] = useState<ScheduleMode>('grid')
  const [draggedPlacementId, setDraggedPlacementId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharedView, setSharedView] = useState<SharedProgramView>('agenda')
  const [sharedTrackId, setSharedTrackId] = useState('all')
  const [sharedRoomId, setSharedRoomId] = useState('all')
  const [copied, setCopied] = useState<'link' | 'embed' | null>(null)
  if (!payload) return null
  const { state } = payload
  const conflicts = scheduleConflicts(state)
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error')
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const timeLabel = (iso: string) =>
    eventDateTime(iso, event.timezone, { hour: 'numeric', minute: '2-digit' })
  const startTimes = [...new Set(state.placements.map((placement) => placement.startsAt))].sort()
  const draggedSession = draggedPlacementId
    ? state.sessions.find(
        (session) =>
          session.id ===
          state.placements.find((placement) => placement.id === draggedPlacementId)?.sessionId,
      )
    : undefined
  const targetConflicts =
    draggedPlacementId && dropTarget
      ? previewPlacementMove(state, draggedPlacementId, dropTarget.roomId, dropTarget.startsAt)
      : []
  const targetHardConflicts = targetConflicts.filter((conflict) => conflict.severity === 'error')
  const publicUrl = new URL(
    publicProgramPath(state.activeEventId),
    typeof window === 'undefined' ? 'https://app.programkit.dev' : window.location.origin,
  )
  publicUrl.searchParams.set('view', sharedView)
  if (sharedTrackId !== 'all') publicUrl.searchParams.set('track', sharedTrackId)
  if (sharedRoomId !== 'all') publicUrl.searchParams.set('room', sharedRoomId)
  const publicUrlText = publicUrl.toString()
  const embedCode = `<iframe src="${escapeHtmlAttribute(publicUrlText)}" title="${escapeHtmlAttribute(`${event.name} public program`)}" loading="lazy" style="width:100%;min-height:720px;border:0"></iframe>`

  async function copyShareValue(value: string, kind: 'link' | 'embed') {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
    }
    setCopied(kind)
  }

  function startDragging(event: DragEvent<HTMLButtonElement>, placementId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', placementId)
    setDraggedPlacementId(placementId)
    setMoveFeedback(null)
  }

  function stopDragging() {
    setDraggedPlacementId(null)
    setDropTarget(null)
  }

  async function dropPlacement(event: DragEvent<HTMLDivElement>, target: DropTarget) {
    event.preventDefault()
    const placementId = draggedPlacementId ?? event.dataTransfer.getData('text/plain')
    if (!placementId) return
    const placement = state.placements.find((entry) => entry.id === placementId)
    const session = placement
      ? state.sessions.find((entry) => entry.id === placement.sessionId)
      : undefined
    if (!placement || !session) {
      stopDragging()
      return
    }
    const previewConflicts = previewPlacementMove(
      state,
      placementId,
      target.roomId,
      target.startsAt,
    )
    const blocking = previewConflicts.filter((conflict) => conflict.severity === 'error')
    if (blocking.length > 0) {
      setMoveFeedback({
        tone: 'danger',
        title: `${session.title} cannot move there`,
        detail: blocking[0].message,
      })
      stopDragging()
      return
    }
    const warnings = previewConflicts.filter((conflict) => conflict.severity === 'warning')
    const response = await execute(
      'schedule.move-session',
      { placementId, roomId: target.roomId, startsAt: target.startsAt },
      { expectedVersions: { [placementId]: placement.version } },
      `${session.title} moved.`,
    )
    if (response.ok && warnings.length > 0) {
      setMoveFeedback({
        tone: 'warning',
        title: `${session.title} moved with a warning`,
        detail: warnings[0].message,
      })
    }
    stopDragging()
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule studio"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCopied(null)
                setShareOpen(true)
              }}
            >
              <LinkIcon className="size-4 h-lh shrink-0 fill-current" />
              Share program
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate(publicProgramPath(state.activeEventId))}
            >
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

      <Callout
        tone={hardConflicts.length > 0 ? 'danger' : 'success'}
        title={
          hardConflicts.length > 0
            ? `${hardConflicts.length} blocking conflict${hardConflicts.length === 1 ? '' : 's'} before publish`
            : 'The schedule is ready to publish'
        }
      >
        <p>
          {hardConflicts[0]?.message ??
            `${conflicts.length} non-blocking capacity warning${conflicts.length === 1 ? '' : 's'} remain.`}
        </p>
      </Callout>

      {moveFeedback ? (
        <Callout tone={moveFeedback.tone} title={moveFeedback.title}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p>{moveFeedback.detail}</p>
            <Button size="compact" variant="ghost" onClick={() => setMoveFeedback(null)}>
              Dismiss
            </Button>
          </div>
        </Callout>
      ) : null}

      <Toolbar>
        <div className="hidden lg:block">
          <FilterTabs
            label="Schedule view"
            value={mode}
            options={[
              ['grid', 'Room grid'],
              ['list', 'Session list'],
            ]}
            onChange={setMode}
          />
        </div>
        <p id="schedule-drag-help" className="text-pretty text-base text-zinc-500 sm:text-sm">
          {draggedSession
            ? `Moving ${draggedSession.title}. Choose a room and time.`
            : mode === 'grid'
              ? 'Drag a session to move it. Open it for precise date and time controls.'
              : 'Open a session to change its room or start time.'}
        </p>
      </Toolbar>

      {/*
        Rooms are columns and start times are rows, so a session always sits on the
        row of the time it actually starts. Stacking each room independently made
        a 9:00 session line up beside a 10:00 one.
      */}
      <div
        className={cx(
          'hidden min-w-0 grid-cols-[4.5rem_repeat(var(--room-count),minmax(0,1fr))]',
          mode === 'grid' && 'lg:grid',
        )}
        style={{ '--room-count': state.rooms.length } as CSSProperties}
      >
        <div className="border-b border-zinc-950/10 pb-3" />
        {state.rooms.map((room) => (
          <div key={room.id} className="min-w-0 border-b border-zinc-950/10 px-1.5 pb-3">
            <h2 className="truncate text-base font-medium text-zinc-950 sm:text-sm">{room.name}</h2>
            <p className="truncate text-sm tabular-nums text-zinc-500">
              Capacity {room.capacity} ·{' '}
              {state.placements.filter((entry) => entry.roomId === room.id).length} sessions
            </p>
          </div>
        ))}

        {startTimes.map((startsAt) => (
          <Fragment key={startsAt}>
            <div className="border-t border-zinc-950/5 py-2 pr-3">
              <p className="whitespace-nowrap text-sm font-medium tabular-nums text-zinc-500">
                {timeLabel(startsAt)}
              </p>
            </div>
            {state.rooms.map((room, roomIndex) => {
              const placement = state.placements.find(
                (entry) => entry.roomId === room.id && entry.startsAt === startsAt,
              )
              const session = placement
                ? state.sessions.find((entry) => entry.id === placement.sessionId)
                : undefined
              const track = session
                ? state.tracks.find((entry) => entry.id === session.trackId)
                : undefined
              const placementConflicts = placement
                ? conflicts.filter((conflict) => conflict.placementIds.includes(placement.id))
                : []
              return (
                <div
                  key={room.id}
                  onDragEnter={() => {
                    if (draggedPlacementId) setDropTarget({ roomId: room.id, startsAt })
                  }}
                  onDragOver={(event) => {
                    if (!draggedPlacementId) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDropTarget({ roomId: room.id, startsAt })
                  }}
                  onDrop={(event) => void dropPlacement(event, { roomId: room.id, startsAt })}
                  className={cx(
                    'min-w-0 border-t border-zinc-950/5 px-1.5 py-2',
                    roomIndex < state.rooms.length - 1 && 'border-r border-r-zinc-950/5',
                    draggedPlacementId && 'bg-blue-50/30',
                  )}
                >
                  {placement && session && track ? (
                    <button
                      type="button"
                      draggable
                      aria-describedby="schedule-drag-help"
                      onDragStart={(event) => startDragging(event, placement.id)}
                      onDragEnd={stopDragging}
                      className={cx(
                        'focus-ring w-full cursor-grab rounded-xl bg-white p-3 text-left shadow-sm ring-1 motion-safe:transition-transform motion-safe:hover:-translate-y-px active:cursor-grabbing',
                        placementConflicts.some((conflict) => conflict.severity === 'error')
                          ? 'ring-rose-500/40'
                          : 'ring-zinc-950/10',
                        dropTarget?.roomId === room.id &&
                          dropTarget.startsAt === startsAt &&
                          draggedPlacementId &&
                          (targetHardConflicts.length > 0
                            ? 'ring-2 ring-rose-500'
                            : 'ring-2 ring-blue-500'),
                        draggedPlacementId === placement.id && 'opacity-45',
                      )}
                      onClick={() => setSelectedId(placement.id)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm tabular-nums text-zinc-500">
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
                        <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                          {session.expectedAttendance} expected
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div
                      className={cx(
                        'grid min-h-24 place-items-center rounded-xl border border-dashed px-3 text-center',
                        draggedPlacementId
                          ? 'border-blue-300 bg-blue-50/60 text-blue-700'
                          : 'border-transparent text-zinc-400',
                        dropTarget?.roomId === room.id &&
                          dropTarget.startsAt === startsAt &&
                          draggedPlacementId &&
                          (targetHardConflicts.length > 0
                            ? 'border-rose-400 bg-rose-50 text-rose-700'
                            : 'border-blue-500 bg-blue-100/70'),
                      )}
                    >
                      {draggedPlacementId ? (
                        <span className="text-sm font-medium">
                          {dropTarget?.roomId === room.id &&
                          dropTarget.startsAt === startsAt &&
                          targetHardConflicts.length > 0
                            ? 'Conflict here'
                            : `Move to ${room.name}`}
                        </span>
                      ) : (
                        <span className="sr-only">
                          {room.name} is free at {timeLabel(startsAt)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Fragment>
        ))}
      </div>

      <div className={cx(mode === 'grid' ? 'lg:hidden' : '')}>
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
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share the public program"
        description="Choose a published view, then copy a link or an embed snippet."
        footer={
          <>
            <Button variant="secondary" onClick={() => void copyShareValue(publicUrlText, 'link')}>
              <LinkIcon className="size-4" />
              {copied === 'link' ? 'Link copied' : 'Copy link'}
            </Button>
            <Button variant="primary" onClick={() => void copyShareValue(embedCode, 'embed')}>
              <CodeBracketIcon className="size-4" />
              {copied === 'embed' ? 'Embed copied' : 'Copy embed'}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-3">
            <Field label="Program view" htmlFor="shared-program-view">
              <select
                id="shared-program-view"
                value={sharedView}
                onChange={(interaction) => {
                  setSharedView(interaction.target.value as SharedProgramView)
                  setCopied(null)
                }}
                className="focus-ring-control min-h-11 rounded-xl bg-white px-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
              >
                {sharedProgramViews.map((view) => (
                  <option key={view.id} value={view.id}>
                    {view.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Track filter" htmlFor="shared-program-track">
              <select
                id="shared-program-track"
                value={sharedTrackId}
                onChange={(interaction) => {
                  setSharedTrackId(interaction.target.value)
                  setCopied(null)
                }}
                className="focus-ring-control min-h-11 rounded-xl bg-white px-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
              >
                <option value="all">All tracks</option>
                {state.tracks.map((track) => (
                  <option key={track.id} value={track.id}>
                    {track.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Room filter" htmlFor="shared-program-room">
              <select
                id="shared-program-room"
                value={sharedRoomId}
                onChange={(interaction) => {
                  setSharedRoomId(interaction.target.value)
                  setCopied(null)
                }}
                className="focus-ring-control min-h-11 rounded-xl bg-white px-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
              >
                <option value="all">All rooms</option>
                {state.rooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Shareable URL" htmlFor="shared-program-url">
            <input
              id="shared-program-url"
              readOnly
              value={publicUrlText}
              className={cx(textControl, 'w-full font-mono text-sm')}
              onFocus={(interaction) => interaction.currentTarget.select()}
            />
          </Field>

          <div>
            <p className="text-base font-medium text-zinc-950 sm:text-sm">Embed snippet</p>
            <pre className="mt-1.5 max-h-36 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-200">
              <code>{embedCode}</code>
            </pre>
          </div>

          <Callout tone="info" title="One published source">
            The link and embed read the same immutable schedule release as every public program
            view.
          </Callout>
        </div>
      </Dialog>
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
  let previewStartsAt: string | null = null
  try {
    previewStartsAt = startsAt ? zonedDateTimeInputToIso(startsAt, timeZone) : null
  } catch {
    previewStartsAt = null
  }
  const previewConflicts = previewStartsAt
    ? previewPlacementMove(state, placement.id, roomId, previewStartsAt)
    : []
  const previewHardConflicts = previewConflicts.filter((conflict) => conflict.severity === 'error')
  const previewWarnings = previewConflicts.filter((conflict) => conflict.severity === 'warning')

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
          <Button
            variant="primary"
            type="submit"
            form="move-session-form"
            disabled={mutating || !previewStartsAt || previewHardConflicts.length > 0}
          >
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
              className="focus-ring min-h-11 w-full appearance-none rounded-xl bg-white py-2 pr-9 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
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
            className={textControl}
          />
          {timeError ? (
            <span id="move-session-time-error" className="text-sm text-rose-700">
              {timeError}
            </span>
          ) : null}
        </label>
        {previewHardConflicts.length > 0 ? (
          <Callout tone="danger" title="This placement creates a conflict">
            <p>{previewHardConflicts[0].message}</p>
          </Callout>
        ) : previewWarnings.length > 0 ? (
          <Callout tone="warning" title="This placement has a capacity warning">
            <p>{previewWarnings[0].message}</p>
          </Callout>
        ) : previewStartsAt ? (
          <Callout tone="success" title="This placement works">
            <p>No room, speaker, duration, or event-boundary conflicts found.</p>
          </Callout>
        ) : null}
      </form>
    </Drawer>
  )
}
