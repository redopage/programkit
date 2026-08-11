import {
  ChevronUpDownIcon,
  CodeBracketIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
  LinkIcon,
  SparklesIcon,
} from '@heroicons/react/16/solid'
import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
} from 'react'

import { scheduleConflicts, type ProgramEmbed, type WorkspaceState } from '@programkit/core'

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
  selectControl,
  textControl,
} from '../components/ui.tsx'

type ScheduleMode = 'grid' | 'list'
type SharedProgramView = 'agenda' | 'sessions' | 'speakers' | 'itinerary' | 'gallery'
type SharedOutputFormat = 'link' | 'script' | 'embed' | 'json' | 'xml' | 'ical'

const sharedProgramViews: Array<{ id: SharedProgramView; label: string }> = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'sessions', label: 'Sessions list' },
  { id: 'speakers', label: 'Speakers list' },
  { id: 'itinerary', label: 'Schedule itinerary' },
  { id: 'gallery', label: 'Speaker gallery' },
]

const sharedOutputFormats: Array<{ id: SharedOutputFormat; label: string }> = [
  { id: 'link', label: 'Hosted view' },
  { id: 'script', label: 'Styled script' },
  { id: 'embed', label: 'Basic HTML' },
  { id: 'json', label: 'JSON feed' },
  { id: 'xml', label: 'XML feed' },
  { id: 'ical', label: 'iCal feed' },
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

function previewSessionPlacement(
  state: WorkspaceState,
  sessionId: string,
  roomId: string,
  startsAt: string,
) {
  const preview = structuredClone(state)
  const session = preview.sessions.find((entry) => entry.id === sessionId)
  if (!session) return []
  const placementId = 'plc_preview'
  preview.placements.push({
    id: placementId,
    eventId: preview.activeEventId,
    sessionId,
    roomId,
    startsAt,
    endsAt: new Date(Date.parse(startsAt) + session.durationMinutes * 60_000).toISOString(),
    scheduleVersion: 0,
    published: false,
    version: 1,
  })
  return scheduleConflicts(preview).filter((conflict) =>
    conflict.placementIds.includes(placementId),
  )
}

function calendarDays(startsAt: string, endsAt: string, timeZone: string) {
  const first = toZonedDateTimeInput(startsAt, timeZone).slice(0, 10)
  const last = toZonedDateTimeInput(endsAt, timeZone).slice(0, 10)
  const days: string[] = []
  let cursor = first
  while (cursor <= last && days.length < 31) {
    days.push(cursor)
    const next = new Date(`${cursor}T12:00:00.000Z`)
    next.setUTCDate(next.getUTCDate() + 1)
    cursor = next.toISOString().slice(0, 10)
  }
  return days
}

function calendarDayLabel(day: string, index: number) {
  const date = new Date(`${day}T12:00:00.000Z`)
  const label = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date)
  return `Day ${index + 1} · ${label}`
}

export function ScheduleView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState('')
  const [placingSessionId, setPlacingSessionId] = useState<string | null>(null)
  const [mode, setMode] = useState<ScheduleMode>('grid')
  const [draggedPlacementId, setDraggedPlacementId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [sharedView, setSharedView] = useState<SharedProgramView>('agenda')
  const [sharedOutputFormat, setSharedOutputFormat] = useState<SharedOutputFormat>('embed')
  const [sharedTrackId, setSharedTrackId] = useState('all')
  const [sharedRoomId, setSharedRoomId] = useState('all')
  const [sharedAccent, setSharedAccent] = useState('#2563eb')
  const [sharedShowDescriptions, setSharedShowDescriptions] = useState(true)
  const [sharedName, setSharedName] = useState('')
  const [copied, setCopied] = useState(false)
  const eventForDay = payload?.state.events.find(
    (entry) => entry.id === payload.state.activeEventId,
  )
  useEffect(() => {
    if (!eventForDay) return
    const firstDay = toZonedDateTimeInput(eventForDay.startsAt, eventForDay.timezone).slice(0, 10)
    setSelectedDay((current) => current || firstDay)
  }, [eventForDay])
  if (!payload) return null
  const { state } = payload
  const conflicts = scheduleConflicts(state)
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error')
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const activeRooms = state.rooms.filter((room) => room.eventId === state.activeEventId)
  const activeTracks = state.tracks.filter((track) => track.eventId === state.activeEventId)
  const activePlacements = state.placements.filter(
    (placement) => placement.eventId === state.activeEventId,
  )
  const savedEmbeds = (state.programEmbeds ?? []).filter(
    (embed) => embed.eventId === state.activeEventId,
  )
  const timeLabel = (iso: string) =>
    eventDateTime(iso, event.timezone, { hour: 'numeric', minute: '2-digit' })
  const days = calendarDays(event.startsAt, event.endsAt, event.timezone)
  const activeDay = selectedDay || days[0]
  const generatedStartTimes = Array.from({ length: 11 }, (_, index) => index + 8)
    .map((hour) => {
      try {
        return zonedDateTimeInputToIso(
          `${activeDay}T${String(hour).padStart(2, '0')}:00`,
          event.timezone,
        )
      } catch {
        return null
      }
    })
    .filter(
      (startsAt): startsAt is string =>
        Boolean(startsAt) &&
        Date.parse(startsAt!) >= Date.parse(event.startsAt) &&
        Date.parse(startsAt!) + 5 * 60_000 <= Date.parse(event.endsAt),
    )
  const dayPlacements = activePlacements.filter(
    (placement) =>
      toZonedDateTimeInput(placement.startsAt, event.timezone).slice(0, 10) === activeDay,
  )
  const startTimes = [
    ...new Set([...generatedStartTimes, ...dayPlacements.map((placement) => placement.startsAt)]),
  ].sort()
  const placedSessionIds = new Set(activePlacements.map((placement) => placement.sessionId))
  const unscheduled = state.sessions.filter(
    (session) =>
      session.eventId === state.activeEventId &&
      session.status !== 'cancelled' &&
      !placedSessionIds.has(session.id),
  )
  const draggedSession = draggedPlacementId
    ? state.sessions.find(
        (session) =>
          session.eventId === state.activeEventId &&
          session.id ===
            activePlacements.find((placement) => placement.id === draggedPlacementId)?.sessionId,
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
  publicUrl.searchParams.set('accent', sharedAccent)
  if (!sharedShowDescriptions) publicUrl.searchParams.set('descriptions', 'hide')
  const publicUrlText = publicUrl.toString()
  const embedCode = `<iframe src="${escapeHtmlAttribute(publicUrlText)}" title="${escapeHtmlAttribute(`${event.name} public program`)}" loading="lazy" style="width:100%;min-height:720px;border:0"></iframe>`
  const scriptCode = `<div data-programkit-embed data-src="${escapeHtmlAttribute(publicUrlText)}" data-title="${escapeHtmlAttribute(`${event.name} public program`)}"></div>\n<script async src="${escapeHtmlAttribute(new URL('/programkit-embed.js', publicUrl.origin).toString())}"></script>`
  const feedExtension =
    sharedOutputFormat === 'ical' ? 'ics' : sharedOutputFormat === 'xml' ? 'xml' : 'json'
  const feedUrl = new URL(
    `/public/v1/program.${feedExtension}`,
    typeof window === 'undefined' ? 'https://app.programkit.dev' : window.location.origin,
  )
  feedUrl.searchParams.set('event', state.activeEventId)
  if (sharedTrackId !== 'all') feedUrl.searchParams.set('track', sharedTrackId)
  if (sharedRoomId !== 'all') feedUrl.searchParams.set('room', sharedRoomId)
  if (!sharedShowDescriptions) feedUrl.searchParams.set('descriptions', 'hide')
  const shareValue =
    sharedOutputFormat === 'link'
      ? publicUrlText
      : sharedOutputFormat === 'script'
        ? scriptCode
        : sharedOutputFormat === 'embed'
          ? embedCode
          : feedUrl.toString()
  const outputLabel =
    sharedOutputFormats.find((format) => format.id === sharedOutputFormat)?.label ?? 'Output'

  async function copyShareValue(value: string) {
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
    setCopied(true)
  }

  async function saveProgramEmbed() {
    const response = await execute(
      'program-embed.create',
      {
        name: sharedName,
        view: sharedView,
        output: sharedOutputFormat,
        trackId: sharedTrackId,
        roomId: sharedRoomId,
        accent: sharedAccent,
        showDescriptions: sharedShowDescriptions,
      },
      undefined,
      'Embed saved.',
    )
    if (response.ok) setSharedName('')
  }

  function loadProgramEmbed(embed: ProgramEmbed) {
    setSharedName(embed.name)
    setSharedView(embed.view)
    setSharedOutputFormat(embed.output)
    setSharedTrackId(embed.trackId ?? 'all')
    setSharedRoomId(embed.roomId ?? 'all')
    setSharedAccent(embed.accent)
    setSharedShowDescriptions(embed.showDescriptions)
    setCopied(false)
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
    const placement = activePlacements.find((entry) => entry.id === placementId)
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
    const blocking = previewConflicts.filter(
      (conflict) => conflict.severity === 'error' && conflict.type !== 'person_overlap',
    )
    if (blocking.length > 0) {
      setMoveFeedback({
        tone: 'danger',
        title: `${session.title} cannot move there`,
        detail: blocking[0].message,
      })
      stopDragging()
      return
    }
    const warnings = previewConflicts.filter(
      (conflict) => conflict.severity === 'warning' || conflict.type === 'person_overlap',
    )
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
                setCopied(false)
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
        tone={hardConflicts.length > 0 ? 'danger' : unscheduled.length > 0 ? 'info' : 'success'}
        title={
          hardConflicts.length > 0
            ? `${hardConflicts.length} blocking conflict${hardConflicts.length === 1 ? '' : 's'} before publish`
            : unscheduled.length > 0
              ? `${unscheduled.length} session${unscheduled.length === 1 ? '' : 's'} still ${unscheduled.length === 1 ? 'needs' : 'need'} a time`
              : 'The schedule is ready to publish'
        }
      >
        <p>
          {hardConflicts[0]?.message ??
            (unscheduled.length > 0
              ? 'Assign them one at a time or let ProgramKit find open slots.'
              : `${conflicts.length} non-blocking capacity warning${conflicts.length === 1 ? '' : 's'} remain.`)}
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
        <FilterTabs
          label="Event day"
          value={activeDay}
          options={days.map((day, index) => [day, calendarDayLabel(day, index)])}
          onChange={setSelectedDay}
        />
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

      <section aria-labelledby="unscheduled-sessions-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="unscheduled-sessions-heading" className="text-base font-medium text-zinc-950">
              Unscheduled sessions
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              {unscheduled.length === 0
                ? 'Every active session has a room and time.'
                : 'Choose a session to place it precisely.'}
            </p>
          </div>
          {unscheduled.length > 0 ? (
            <Button
              disabled={mutating || activeRooms.length === 0}
              onClick={() =>
                void execute('schedule.auto-place', {}, undefined, 'Unscheduled sessions placed.')
              }
            >
              <SparklesIcon className="size-4 shrink-0 fill-violet-500" />
              Auto-place
            </Button>
          ) : null}
        </div>
        {unscheduled.length > 0 ? (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {unscheduled.map((session) => {
              const track = state.tracks.find((entry) => entry.id === session.trackId)
              return (
                <button
                  key={session.id}
                  type="button"
                  className="focus-ring min-w-64 rounded-2xl bg-white p-3 text-left shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-50"
                  onClick={() => setPlacingSessionId(session.id)}
                >
                  <span className="block text-pretty text-base font-medium text-zinc-950 sm:text-sm">
                    {session.title}
                  </span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    {track ? <TrackBadge name={track.name} color={track.color} /> : <span />}
                    <span className="text-sm tabular-nums text-zinc-500">
                      {session.durationMinutes} min
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

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
        style={{ '--room-count': activeRooms.length } as CSSProperties}
      >
        <div className="border-b border-zinc-950/10 pb-3" />
        {activeRooms.map((room) => {
          const roomSessionCount = activePlacements.filter(
            (entry) => entry.roomId === room.id,
          ).length
          return (
            <div key={room.id} className="min-w-0 border-b border-zinc-950/10 px-1.5 pb-3">
              <h2 className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                {room.name}
              </h2>
              <p className="truncate text-sm tabular-nums text-zinc-500">
                Capacity {room.capacity} · {roomSessionCount}{' '}
                {roomSessionCount === 1 ? 'session' : 'sessions'}
              </p>
            </div>
          )
        })}

        {startTimes.map((startsAt) => (
          <Fragment key={startsAt}>
            <div className="border-t border-zinc-950/5 py-2 pr-3">
              <p className="whitespace-nowrap text-sm font-medium tabular-nums text-zinc-500">
                {timeLabel(startsAt)}
              </p>
            </div>
            {activeRooms.map((room, roomIndex) => {
              const cellPlacements = activePlacements.filter(
                (entry) => entry.roomId === room.id && entry.startsAt === startsAt,
              )
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
                    roomIndex < activeRooms.length - 1 && 'border-r border-r-zinc-950/5',
                    draggedPlacementId && 'bg-blue-50/30',
                  )}
                >
                  {cellPlacements.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {cellPlacements.map((placement) => {
                        const session = state.sessions.find(
                          (entry) => entry.id === placement.sessionId,
                        )
                        const track = session
                          ? state.tracks.find((entry) => entry.id === session.trackId)
                          : undefined
                        const placementConflicts = conflicts.filter((conflict) =>
                          conflict.placementIds.includes(placement.id),
                        )
                        return (
                          <button
                            key={placement.id}
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
                              {placementConflicts.length > 0 || !session ? (
                                <ExclamationTriangleIcon className="size-4 shrink-0 fill-rose-500" />
                              ) : null}
                            </span>
                            <span className="block pt-2 text-pretty text-sm font-medium text-zinc-950">
                              {session?.title ?? 'Missing session'}
                            </span>
                            {session ? (
                              <span className="mt-3 flex items-center justify-between gap-2">
                                {track ? (
                                  <TrackBadge name={track.name} color={track.color} />
                                ) : (
                                  <span className="text-sm text-rose-700">Missing track</span>
                                )}
                                <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                                  {session.expectedAttendance} expected
                                </span>
                              </span>
                            ) : null}
                          </button>
                        )
                      })}
                    </div>
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
          {dayPlacements
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
      <PlaceSessionDialog
        key={placingSessionId ?? 'closed'}
        sessionId={placingSessionId}
        defaultDay={activeDay}
        open={Boolean(placingSessionId)}
        onClose={() => setPlacingSessionId(null)}
      />
      <Dialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share the public program"
        description="Choose a view, format, and the fields you want to publish."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShareOpen(false)}>
              Done
            </Button>
            <Button
              variant="secondary"
              disabled={mutating || !sharedName.trim()}
              onClick={() => void saveProgramEmbed()}
            >
              Save embed
            </Button>
            <Button variant="primary" onClick={() => void copyShareValue(shareValue)}>
              {sharedOutputFormat === 'embed' || sharedOutputFormat === 'script' ? (
                <CodeBracketIcon className="size-4" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              {copied
                ? 'Copied'
                : `Copy ${sharedOutputFormat === 'embed' || sharedOutputFormat === 'script' ? 'code' : 'URL'}`}
            </Button>
          </>
        }
      >
        <div className="space-y-6">
          {savedEmbeds.length > 0 ? (
            <section aria-labelledby="saved-embeds-heading">
              <div className="flex items-center justify-between gap-3">
                <h3 id="saved-embeds-heading" className="text-base font-medium text-zinc-950">
                  Saved embeds
                </h3>
                <span className="text-sm text-zinc-500">{savedEmbeds.length} saved</span>
              </div>
              <ul className="mt-2 divide-y divide-zinc-950/5 rounded-2xl bg-zinc-950/2 px-3 ring-1 ring-zinc-950/5">
                {savedEmbeds.map((embed) => (
                  <li
                    key={embed.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-950">{embed.name}</p>
                      <p className="text-sm text-zinc-500">
                        {sharedProgramViews.find((view) => view.id === embed.view)?.label} ·{' '}
                        {sharedOutputFormats.find((format) => format.id === embed.output)?.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="compact"
                        variant="ghost"
                        onClick={() => loadProgramEmbed(embed)}
                      >
                        Get code
                      </Button>
                      <Button
                        size="compact"
                        variant="secondary"
                        aria-pressed={embed.enabled}
                        disabled={mutating}
                        onClick={() =>
                          void execute(
                            'program-embed.update',
                            { embedId: embed.id, enabled: !embed.enabled },
                            { expectedVersions: { [embed.id]: embed.version } },
                            `${embed.name} ${embed.enabled ? 'disabled' : 'enabled'}.`,
                          )
                        }
                      >
                        {embed.enabled ? 'Enabled' : 'Disabled'}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <Field label="Embed name" htmlFor="shared-program-name">
            <input
              id="shared-program-name"
              value={sharedName}
              onChange={(interaction) => setSharedName(interaction.target.value)}
              placeholder={`${sharedProgramViews.find((view) => view.id === sharedView)?.label ?? 'Program'} for event site`}
              className={textControl}
            />
          </Field>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Output" htmlFor="shared-output-format">
              <select
                id="shared-output-format"
                value={sharedOutputFormat}
                onChange={(interaction) => {
                  setSharedOutputFormat(interaction.target.value as SharedOutputFormat)
                  setCopied(false)
                }}
                className={selectControl}
              >
                {sharedOutputFormats.map((format) => (
                  <option key={format.id} value={format.id}>
                    {format.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Program view" htmlFor="shared-program-view">
              <select
                id="shared-program-view"
                value={sharedView}
                disabled={
                  sharedOutputFormat !== 'link' &&
                  sharedOutputFormat !== 'embed' &&
                  sharedOutputFormat !== 'script'
                }
                onChange={(interaction) => {
                  setSharedView(interaction.target.value as SharedProgramView)
                  setCopied(false)
                }}
                className={selectControl}
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
                  setCopied(false)
                }}
                className={selectControl}
              >
                <option value="all">All tracks</option>
                {activeTracks.map((track) => (
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
                  setCopied(false)
                }}
                className={selectControl}
              >
                <option value="all">All rooms</option>
                {activeRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field label="Accent color" htmlFor="shared-program-accent">
              <div className="flex min-h-11 items-center gap-3 rounded-xl bg-white px-3 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9">
                <input
                  id="shared-program-accent"
                  type="color"
                  value={sharedAccent}
                  disabled={
                    sharedOutputFormat !== 'link' &&
                    sharedOutputFormat !== 'embed' &&
                    sharedOutputFormat !== 'script'
                  }
                  onChange={(interaction) => {
                    setSharedAccent(interaction.target.value)
                    setCopied(false)
                  }}
                  className="h-6 w-8 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-40"
                />
                <span className="font-mono text-sm text-zinc-600">{sharedAccent}</span>
              </div>
            </Field>
            <Field label="Fields" htmlFor="shared-program-descriptions">
              <label
                htmlFor="shared-program-descriptions"
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 text-base text-zinc-700 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
              >
                <input
                  id="shared-program-descriptions"
                  type="checkbox"
                  checked={sharedShowDescriptions}
                  onChange={(interaction) => {
                    setSharedShowDescriptions(interaction.target.checked)
                    setCopied(false)
                  }}
                  className="size-4 rounded border-zinc-300 accent-blue-600"
                />
                Show session descriptions
              </label>
            </Field>
          </div>

          <div>
            <p className="text-base font-medium text-zinc-950 sm:text-sm">{outputLabel}</p>
            <pre className="mt-1.5 max-h-36 overflow-auto whitespace-pre-wrap rounded-2xl bg-zinc-950 p-4 text-sm text-zinc-200">
              <code>{shareValue}</code>
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

function PlaceSessionDialog({
  sessionId,
  defaultDay,
  open,
  onClose,
}: {
  sessionId: string | null
  defaultDay: string
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const session = payload?.state.sessions.find((entry) => entry.id === sessionId)
  const event = payload?.state.events.find((entry) => entry.id === payload.state.activeEventId)
  const [roomId, setRoomId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)

  useEffect(() => {
    if (!payload || !open) return
    setRoomId(
      payload.state.rooms.find((room) => room.eventId === payload.state.activeEventId)?.id ?? '',
    )
    setStartsAt(`${defaultDay}T10:00`)
    setTimeError(null)
  }, [defaultDay, open, payload])

  if (!payload || !session || !event) return null
  let previewStartsAt: string | null = null
  try {
    previewStartsAt = startsAt ? zonedDateTimeInputToIso(startsAt, event.timezone) : null
  } catch {
    previewStartsAt = null
  }
  const previewConflicts =
    previewStartsAt && roomId
      ? previewSessionPlacement(payload.state, session.id, roomId, previewStartsAt)
      : []
  const blocking = previewConflicts.filter(
    (conflict) => conflict.severity === 'error' && conflict.type !== 'person_overlap',
  )
  const speakerConflicts = previewConflicts.filter((conflict) => conflict.type === 'person_overlap')
  const warnings = previewConflicts.filter((conflict) => conflict.severity === 'warning')

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    let iso: string
    try {
      iso = zonedDateTimeInputToIso(startsAt, event!.timezone)
      setTimeError(null)
    } catch (error) {
      setTimeError(error instanceof Error ? error.message : 'Enter a valid date and time.')
      return
    }
    const response = await execute(
      'schedule.place-session',
      { sessionId: session!.id, roomId, startsAt: iso },
      undefined,
      `${session!.title} placed.`,
    )
    if (response.ok) onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Place ${session.title}`}
      description="Choose its day, local start time, and room."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            form="place-session-form"
            variant="primary"
            disabled={mutating || !roomId || !previewStartsAt || blocking.length > 0}
          >
            Place session
          </Button>
        </>
      }
    >
      <form
        id="place-session-form"
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(submitEvent) => void submit(submitEvent)}
      >
        <Field label="Room" htmlFor="place-session-room">
          <select
            id="place-session-room"
            required
            value={roomId}
            onChange={(event) => setRoomId(event.target.value)}
            className={selectControl}
          >
            <option value="">Choose a room</option>
            {payload.state.rooms
              .filter((room) => room.eventId === payload.state.activeEventId)
              .map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name} · {room.capacity} seats
                </option>
              ))}
          </select>
        </Field>
        <Field label="Starts" htmlFor="place-session-starts">
          <input
            id="place-session-starts"
            type="datetime-local"
            required
            value={startsAt}
            aria-invalid={Boolean(timeError || blocking.length > 0)}
            onInput={(event) => {
              setStartsAt(event.currentTarget.value)
              setTimeError(null)
            }}
            className={textControl}
          />
          {timeError ? <p className="text-sm text-rose-700">{timeError}</p> : null}
        </Field>
        {blocking.length > 0 ? (
          <div className="sm:col-span-2">
            <Callout tone="danger" title="That slot is not available">
              {blocking[0].message}
            </Callout>
          </div>
        ) : speakerConflicts.length > 0 ? (
          <div className="sm:col-span-2">
            <Callout tone="warning" title="Speaker conflict">
              {speakerConflicts[0].message}
            </Callout>
          </div>
        ) : warnings.length > 0 ? (
          <div className="sm:col-span-2">
            <Callout tone="warning" title="Capacity warning">
              {warnings[0].message}
            </Callout>
          </div>
        ) : null}
      </form>
    </Dialog>
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
  const placement = payload?.state.placements.find(
    (entry) => entry.id === placementId && entry.eventId === payload.state.activeEventId,
  )
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
  const previewHardConflicts = previewConflicts.filter(
    (conflict) => conflict.severity === 'error' && conflict.type !== 'person_overlap',
  )
  const previewSpeakerConflicts = previewConflicts.filter(
    (conflict) => conflict.type === 'person_overlap',
  )
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
              {state.rooms
                .filter((room) => room.eventId === state.activeEventId)
                .map((room) => (
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
            onInput={(event) => {
              setStartsAt(event.currentTarget.value)
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
        ) : previewSpeakerConflicts.length > 0 ? (
          <Callout tone="warning" title="Speaker conflict">
            <p>{previewSpeakerConflicts[0].message}</p>
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
