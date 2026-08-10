import {
  ArrowUturnLeftIcon,
  ChevronUpDownIcon,
  ExclamationTriangleIcon,
  GlobeAltIcon,
} from '@heroicons/react/16/solid'
import {
  Fragment,
  useEffect,
  useState,
  type CSSProperties,
  type DragEvent,
  type FormEvent,
  type ReactNode,
} from 'react'

import {
  scheduleConflicts,
  schedulePublishPreflight,
  type Placement,
  type Session,
  type WorkspaceState,
} from '@programkit/core'

import { eventDateTime, toZonedDateTimeInput, zonedDateTimeInputToIso } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  Toolbar,
  TrackBadge,
  cx,
  textControl,
} from '../components/ui.tsx'

type ScheduleMode = 'list' | 'day' | 'week' | 'track' | 'room'

interface DropTarget {
  roomId: string
  startsAt: string
}

interface MoveFeedback {
  tone: 'danger' | 'warning' | 'success'
  title: string
  detail: string
}

type LastScheduleAction =
  | {
      kind: 'move'
      title: string
      placementId: string
      expectedVersion: number
      previousRoomId: string
      previousStartsAt: string
    }
  | {
      kind: 'place'
      title: string
      placementId: string
      expectedVersion: number
    }

function eventDayKey(iso: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

function eventDayOptions(startsAt: string, endsAt: string, timeZone: string) {
  const start = new Date(`${eventDayKey(startsAt, timeZone)}T12:00:00.000Z`)
  const endKey = eventDayKey(endsAt, timeZone)
  const days: string[] = []
  while (days.length < 14) {
    const key = start.toISOString().slice(0, 10)
    days.push(key)
    if (key === endKey) break
    start.setUTCDate(start.getUTCDate() + 1)
  }
  return days
}

function eventDayLabel(day: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(new Date(`${day}T12:00:00.000Z`))
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
    eventId: session.eventId,
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

export function ScheduleView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedUnscheduledId, setSelectedUnscheduledId] = useState<string | null>(null)
  const [mode, setMode] = useState<ScheduleMode>('week')
  const [dayFilter, setDayFilter] = useState('all')
  const [roomFilter, setRoomFilter] = useState('all')
  const [trackFilter, setTrackFilter] = useState('all')
  const [draggedPlacementId, setDraggedPlacementId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  const [moveFeedback, setMoveFeedback] = useState<MoveFeedback | null>(null)
  const [lastAction, setLastAction] = useState<LastScheduleAction | null>(null)
  if (!payload) return null
  const { state } = payload
  const conflicts = scheduleConflicts(state)
  const preflight = schedulePublishPreflight(state)
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const eventRooms = state.rooms.filter((entry) => entry.eventId === event.id)
  const eventTracks = state.tracks.filter((entry) => entry.eventId === event.id)
  const eventDays = eventDayOptions(event.startsAt, event.endsAt, event.timezone)
  const timeLabel = (iso: string) =>
    eventDateTime(iso, event.timezone, { hour: 'numeric', minute: '2-digit' })
  const slotLabel = (iso: string) =>
    dayFilter === 'all' && eventDays.length > 1
      ? eventDateTime(iso, event.timezone, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })
      : timeLabel(iso)
  const visibleRooms = eventRooms.filter((room) => roomFilter === 'all' || room.id === roomFilter)
  const visiblePlacements = state.placements.filter((placement) => {
    if (placement.eventId !== event.id) return false
    const session = state.sessions.find((entry) => entry.id === placement.sessionId)
    return (
      (dayFilter === 'all' || eventDayKey(placement.startsAt, event.timezone) === dayFilter) &&
      (roomFilter === 'all' || placement.roomId === roomFilter) &&
      (trackFilter === 'all' || session?.trackId === trackFilter)
    )
  })
  const startTimes = [...new Set(visiblePlacements.map((placement) => placement.startsAt))].sort()
  const visibleDayKeys = [
    ...new Set(startTimes.map((startsAt) => eventDayKey(startsAt, event.timezone))),
  ]
  const visibleUnscheduledSessions = preflight.unscheduledSessions.filter(
    (session) => trackFilter === 'all' || session.trackId === trackFilter,
  )
  const filtersActive = dayFilter !== 'all' || roomFilter !== 'all' || trackFilter !== 'all'
  const gridMode = mode === 'day' || mode === 'week'
  const listGroups =
    mode === 'track'
      ? eventTracks
          .map((track) => ({
            id: track.id,
            label: track.name,
            placements: visiblePlacements.filter(
              (placement) =>
                state.sessions.find((session) => session.id === placement.sessionId)?.trackId ===
                track.id,
            ),
          }))
          .filter((group) => group.placements.length > 0)
      : mode === 'room'
        ? eventRooms
            .map((room) => ({
              id: room.id,
              label: room.name,
              placements: visiblePlacements.filter((placement) => placement.roomId === room.id),
            }))
            .filter((group) => group.placements.length > 0)
        : [{ id: 'schedule', label: null, placements: visiblePlacements }]
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

  function startDragging(event: DragEvent<HTMLButtonElement>, placementId: string) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', placementId)
    setDraggedPlacementId(placementId)
    setMoveFeedback(null)
  }

  function selectMode(next: ScheduleMode) {
    setMode(next)
    if (next === 'week') setDayFilter('all')
    if (next === 'day' && dayFilter === 'all') setDayFilter(eventDays[0] ?? 'all')
  }

  function selectDay(next: string) {
    setDayFilter(next)
    if (next === 'all' && mode === 'day') setMode('week')
    if (next !== 'all' && mode === 'week') setMode('day')
  }

  function clearFilters() {
    setDayFilter('all')
    setRoomFilter('all')
    setTrackFilter('all')
    if (mode === 'day') setMode('week')
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
    const movedPlacement = (response.data as { placement?: Placement } | undefined)?.placement
    if (response.ok && movedPlacement) {
      setLastAction({
        kind: 'move',
        title: session.title,
        placementId,
        expectedVersion: movedPlacement.version,
        previousRoomId: placement.roomId,
        previousStartsAt: placement.startsAt,
      })
      setMoveFeedback({
        tone: warnings.length > 0 ? 'warning' : 'success',
        title: warnings.length > 0 ? `${session.title} moved with a warning` : 'Session moved',
        detail: warnings[0]?.message ?? `${session.title} is now in the new room and time.`,
      })
    }
    stopDragging()
  }

  async function undoLastAction() {
    if (!lastAction) return
    const response =
      lastAction.kind === 'move'
        ? await execute(
            'schedule.move-session',
            {
              placementId: lastAction.placementId,
              roomId: lastAction.previousRoomId,
              startsAt: lastAction.previousStartsAt,
            },
            { expectedVersions: { [lastAction.placementId]: lastAction.expectedVersion } },
            `${lastAction.title} restored.`,
          )
        : await execute(
            'schedule.unplace-session',
            { placementId: lastAction.placementId },
            { expectedVersions: { [lastAction.placementId]: lastAction.expectedVersion } },
            `${lastAction.title} returned to the unscheduled tray.`,
          )
    if (!response.ok) return
    setLastAction(null)
    setMoveFeedback({
      tone: 'success',
      title: 'Last schedule change undone',
      detail:
        lastAction.kind === 'move'
          ? `${lastAction.title} is back in its previous room and time.`
          : `${lastAction.title} is back in the unscheduled tray.`,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Schedule studio"
        description="Draft placements stay private until you publish."
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/agenda')}>
              <GlobeAltIcon className="size-4 h-lh shrink-0 fill-current" />
              Preview agenda
            </Button>
            <Button
              variant="primary"
              disabled={mutating || !preflight.canPublish}
              onClick={() => void execute('schedule.publish', {}, undefined, 'Schedule published.')}
            >
              Publish schedule
            </Button>
          </>
        }
      />

      <section aria-labelledby="publish-preflight-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="publish-preflight-heading" className="text-base font-medium text-zinc-950">
              Publish preflight
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              Draft compared with published version {preflight.latestPublishedVersion ?? 'none'}.
            </p>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-zinc-500">
            {preflight.changeCount} unpublished change{preflight.changeCount === 1 ? '' : 's'}
          </p>
        </div>
        <Callout
          tone={
            preflight.hardConflicts.length > 0
              ? 'danger'
              : preflight.unscheduledSessions.length > 0
                ? 'warning'
                : preflight.changeCount === 0
                  ? 'info'
                  : 'success'
          }
          title={
            preflight.hardConflicts.length > 0
              ? 'Resolve schedule conflicts before publishing'
              : preflight.unscheduledSessions.length > 0
                ? 'Place every session before publishing'
                : preflight.changeCount === 0
                  ? 'The published agenda is current'
                  : 'The draft is ready to publish'
          }
        >
          <p>
            {preflight.hardConflicts[0]?.message ??
              (preflight.unscheduledSessions.length > 0
                ? `${preflight.unscheduledSessions[0].title} is still waiting for a room and time.`
                : preflight.changeCount === 0
                  ? 'Move or add a session to create a new immutable release.'
                  : `${preflight.changeCount} reviewed change${preflight.changeCount === 1 ? '' : 's'} will become the next public version.`)}
          </p>
        </Callout>
        {/*
          Four lines of evidence rather than four cards: the numbers behind the
          verdict above should be readable in one pass, not hunted for.
        */}
        <dl className="grid border-y border-zinc-950/5 sm:grid-cols-2">
          {(
            [
              [
                'Sessions placed',
                preflight.unscheduledSessions.length === 0
                  ? `${preflight.placementCount} of ${preflight.sessionCount}`
                  : `${preflight.placementCount} of ${preflight.sessionCount} · ${preflight.unscheduledSessions.length} unplaced`,
                preflight.unscheduledSessions.length === 0 ? 'clear' : 'attention',
              ],
              [
                'Hard conflicts',
                preflight.hardConflicts.length === 0
                  ? 'None'
                  : `${preflight.hardConflicts.length} to resolve`,
                preflight.hardConflicts.length === 0 ? 'clear' : 'blocking',
              ],
              [
                'Capacity warnings',
                preflight.warnings.length === 0
                  ? 'None'
                  : `${preflight.warnings.length} non-blocking`,
                preflight.warnings.length === 0 ? 'clear' : 'attention',
              ],
              [
                'Draft changes',
                preflight.changeCount === 0
                  ? 'Matches published'
                  : `${preflight.addedSessionIds.length} added · ${preflight.movedSessionIds.length} moved · ${preflight.removedSessionIds.length} removed`,
                preflight.changeCount === 0 ? 'idle' : 'clear',
              ],
            ] as const
          ).map(([term, detail, tone], index) => (
            <div
              key={term}
              className={cx(
                'flex items-center justify-between gap-3 py-2.5',
                index % 2 === 0 ? 'sm:pr-5' : 'sm:border-l sm:border-zinc-950/5 sm:pl-5',
                index > 0 && 'border-t border-zinc-950/5',
                index === 1 && 'sm:border-t-0',
              )}
            >
              <dt className="flex min-w-0 items-center gap-2 text-base font-medium text-zinc-950 sm:text-sm">
                <span
                  aria-hidden="true"
                  className={cx(
                    'size-1.5 shrink-0 rounded-full',
                    tone === 'blocking' && 'bg-rose-500',
                    tone === 'attention' && 'bg-amber-500',
                    tone === 'clear' && 'bg-emerald-500',
                    tone === 'idle' && 'bg-zinc-300',
                  )}
                />
                <span className="truncate">{term}</span>
              </dt>
              <dd className="text-right text-base tabular-nums text-zinc-500 sm:text-sm">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {moveFeedback ? (
        <Callout tone={moveFeedback.tone} title={moveFeedback.title}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pt-0.5">
            <p className="min-w-0 flex-1 text-pretty">{moveFeedback.detail}</p>
            <span className="flex shrink-0 items-center gap-1.5">
              {lastAction ? (
                <Button
                  variant="secondary"
                  disabled={mutating}
                  onClick={() => void undoLastAction()}
                >
                  <ArrowUturnLeftIcon className="size-4 h-lh shrink-0 fill-current" />
                  Undo
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setMoveFeedback(null)}>
                Dismiss
              </Button>
            </span>
          </div>
        </Callout>
      ) : null}

      <section
        aria-labelledby="unscheduled-heading"
        className="flex flex-col gap-3 border-t border-zinc-950/5 pt-6"
      >
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div className="min-w-0">
            <h2 id="unscheduled-heading" className="text-base font-medium text-zinc-950">
              Unscheduled sessions
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              Give each ready session a draft room and start time. Nothing reaches the public agenda
              until you publish.
            </p>
          </div>
          <p className="shrink-0 text-sm tabular-nums text-zinc-500">
            {visibleUnscheduledSessions.length === preflight.unscheduledSessions.length
              ? `${preflight.unscheduledSessions.length} remaining`
              : `${visibleUnscheduledSessions.length} of ${preflight.unscheduledSessions.length} shown`}
          </p>
        </div>
        {visibleUnscheduledSessions.length > 0 ? (
          <ul role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
            {visibleUnscheduledSessions.map((session) => {
              const track = eventTracks.find((entry) => entry.id === session.trackId)!
              return (
                <li
                  key={session.id}
                  className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-pretty text-base font-medium text-zinc-950 sm:text-sm">
                      {session.title}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-zinc-500 sm:text-sm">
                      <TrackBadge name={track.name} color={track.color} />
                      <span className="tabular-nums">{session.durationMinutes} min</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{session.expectedAttendance} expected</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full sm:w-auto"
                    onClick={() => setSelectedUnscheduledId(session.id)}
                  >
                    Place session
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : (
          <div>
            <EmptyState
              tone="settled"
              title={
                preflight.unscheduledSessions.length === 0
                  ? 'Every session has a place'
                  : 'No unscheduled sessions match this track'
              }
              description={
                preflight.unscheduledSessions.length === 0
                  ? 'The draft has a room and time for every active session.'
                  : 'Clear the track filter to see the remaining sessions.'
              }
            />
          </div>
        )}
      </section>

      <Toolbar>
        <div className="min-w-0 shrink-0">
          <FilterTabs
            label="Schedule view"
            value={mode}
            options={[
              ['list', 'Session list'],
              ['day', 'Day'],
              ['week', 'Week'],
              ['track', 'Track'],
              ['room', 'Room'],
            ]}
            onChange={selectMode}
          />
        </div>
        {/*
          Two columns at 375px rather than three stacked rows: the day names are
          the long labels, so day takes the full width and room and track pair up.
        */}
        <div className="grid w-full min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:w-auto">
          <ScheduleFilterSelect
            label="Day"
            value={dayFilter}
            onChange={selectDay}
            className="col-span-2 sm:col-span-1"
          >
            <option value="all">All days</option>
            {eventDays.map((day) => (
              <option key={day} value={day}>
                {eventDayLabel(day)}
              </option>
            ))}
          </ScheduleFilterSelect>
          <ScheduleFilterSelect label="Room" value={roomFilter} onChange={setRoomFilter}>
            <option value="all">All rooms</option>
            {eventRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </ScheduleFilterSelect>
          <ScheduleFilterSelect label="Track" value={trackFilter} onChange={setTrackFilter}>
            <option value="all">All tracks</option>
            {eventTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </ScheduleFilterSelect>
        </div>
        {filtersActive ? (
          <Button size="compact" variant="ghost" onClick={clearFilters}>
            Clear filters
          </Button>
        ) : null}
        <p
          id="schedule-drag-help"
          className="text-pretty text-base text-zinc-500 sm:max-w-[34ch] sm:text-sm"
        >
          {draggedSession
            ? `Moving ${draggedSession.title}. Drop it on a room and time.`
            : gridMode
              ? 'Drag a session onto another room or time. Open one for exact date and time controls.'
              : mode === 'track'
                ? 'Sessions are grouped by track. Open one to change its room or start time.'
                : mode === 'room'
                  ? 'Sessions are grouped by room. Open one to change its room or start time.'
                  : 'Open a session to change its room or start time.'}
        </p>
      </Toolbar>

      {/*
        Rooms are columns and start times are rows, so a session always sits on the
        row of the time it actually starts. Stacking each room independently made
        a 9:00 session line up beside a 10:00 one.
      */}
      {visiblePlacements.length === 0 ? (
        <EmptyState
          title={
            filtersActive
              ? 'No scheduled sessions match these filters'
              : 'The draft schedule is empty'
          }
          description={
            filtersActive
              ? 'Clear a filter or choose another day, room, or track.'
              : 'Place a session from the list above to start building the draft.'
          }
          action={
            filtersActive ? (
              <Button variant="secondary" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : null}
      <div
        className={cx(
          'hidden min-w-0 grid-cols-[4.5rem_repeat(var(--room-count),minmax(0,1fr))]',
          gridMode && visiblePlacements.length > 0 && 'lg:grid',
        )}
        style={{ '--room-count': visibleRooms.length } as CSSProperties}
      >
        <div className="border-b border-zinc-950/10 pb-2" />
        {visibleRooms.map((room) => {
          const roomPlacements = visiblePlacements.filter((entry) => entry.roomId === room.id)
          return (
            <div key={room.id} className="min-w-0 border-b border-zinc-950/10 px-1.5 pb-2">
              <h2 className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                {room.name}
              </h2>
              <p className="truncate text-sm tabular-nums text-zinc-500">
                {roomPlacements.length} session{roomPlacements.length === 1 ? '' : 's'} · seats{' '}
                {room.capacity}
              </p>
            </div>
          )
        })}

        {startTimes.map((startsAt, index) => {
          // A day band keeps consecutive days apart in one scan; without it a
          // 9:00 row on Thursday reads as another slot of Wednesday.
          const dayKey = eventDayKey(startsAt, event.timezone)
          const previousStartsAt = index > 0 ? startTimes[index - 1] : undefined
          const startsNewDay =
            visibleDayKeys.length > 1 &&
            (!previousStartsAt || eventDayKey(previousStartsAt, event.timezone) !== dayKey)
          return (
            <Fragment key={startsAt}>
              {startsNewDay ? (
                <div
                  className={cx(
                    'col-span-full pb-1',
                    index > 0 ? 'mt-2 border-t border-zinc-950/10 pt-3' : 'pt-3',
                  )}
                >
                  <p className="text-sm font-medium text-zinc-600">{eventDayLabel(dayKey)}</p>
                </div>
              ) : null}
              <div className="border-t border-zinc-950/5 py-2 pr-3">
                <p className="whitespace-nowrap text-sm font-medium tabular-nums text-zinc-500">
                  {timeLabel(startsAt)}
                </p>
              </div>
              {visibleRooms.map((room, roomIndex) => {
                const placement = visiblePlacements.find(
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
                      roomIndex < visibleRooms.length - 1 && 'border-r border-r-zinc-950/5',
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
                          <span className="truncate text-sm tabular-nums text-zinc-500">
                            {timeLabel(placement.startsAt)}–{timeLabel(placement.endsAt)}
                          </span>
                          {placementConflicts.length > 0 ? (
                            <>
                              <span className="sr-only">Flagged conflict</span>
                              <ExclamationTriangleIcon className="size-4 shrink-0 fill-rose-500" />
                            </>
                          ) : null}
                        </span>
                        <span className="block pt-1.5 text-pretty text-sm font-medium text-zinc-950">
                          {session.title}
                        </span>
                        <span className="mt-2.5 flex items-center justify-between gap-2">
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
                            {room.name} is free at {slotLabel(startsAt)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </Fragment>
          )
        })}
      </div>

      <div className={cx(gridMode ? 'lg:hidden' : '', visiblePlacements.length === 0 && 'hidden')}>
        {listGroups.map((group) => (
          <section
            key={group.id}
            aria-labelledby={group.label ? `schedule-group-${group.id}` : undefined}
          >
            {group.label ? (
              <div className="flex items-end justify-between gap-3 border-b border-zinc-950/10 pt-5 pb-2 first:pt-0">
                <h2
                  id={`schedule-group-${group.id}`}
                  className="text-base font-medium text-zinc-950"
                >
                  {group.label}
                </h2>
                <p className="text-sm tabular-nums text-zinc-500">
                  {group.placements.length} session{group.placements.length === 1 ? '' : 's'}
                </p>
              </div>
            ) : null}
            <ol role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
              {group.placements
                .slice()
                .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
                .map((placement) => {
                  const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
                  const track = state.tracks.find((entry) => entry.id === session.trackId)!
                  const room = state.rooms.find((entry) => entry.id === placement.roomId)!
                  return (
                    <li key={placement.id}>
                      {/*
                    The time stacks above the title at 375px rather than sitting
                    in a fixed column, where a weekday-prefixed label wrapped.
                  */}
                      <button
                        type="button"
                        className="focus-ring flex w-full flex-col gap-1 rounded-lg py-3 text-left hover:bg-zinc-950/2 sm:flex-row sm:items-center sm:gap-4"
                        onClick={() => setSelectedId(placement.id)}
                      >
                        <span className="text-base font-medium tabular-nums text-zinc-950 sm:w-44 sm:shrink-0 sm:text-sm">
                          {slotLabel(placement.startsAt)}–{timeLabel(placement.endsAt)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-pretty text-base font-medium text-zinc-950 sm:text-sm">
                            {session.title}
                          </span>
                          <span className="block truncate text-base text-zinc-500 sm:text-sm">
                            {room.name}
                          </span>
                        </span>
                        <span className="shrink-0">
                          <TrackBadge name={track.name} color={track.color} />
                        </span>
                      </button>
                    </li>
                  )
                })}
            </ol>
          </section>
        ))}
      </div>

      <MoveSessionDrawer
        placementId={selectedId}
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        onMoved={(movedPlacement, session, previous, warnings) => {
          setLastAction({
            kind: 'move',
            title: session.title,
            placementId: movedPlacement.id,
            expectedVersion: movedPlacement.version,
            previousRoomId: previous.roomId,
            previousStartsAt: previous.startsAt,
          })
          setMoveFeedback({
            tone: warnings.length > 0 ? 'warning' : 'success',
            title: warnings.length > 0 ? `${session.title} moved with a warning` : 'Session moved',
            detail: warnings[0] ?? `${session.title} is now in the new room and time.`,
          })
        }}
      />
      <PlaceSessionDrawer
        sessionId={selectedUnscheduledId}
        open={Boolean(selectedUnscheduledId)}
        onClose={() => setSelectedUnscheduledId(null)}
        onPlaced={(placement, session, warnings) => {
          setLastAction({
            kind: 'place',
            title: session.title,
            placementId: placement.id,
            expectedVersion: placement.version,
          })
          setMoveFeedback({
            tone: warnings.length > 0 ? 'warning' : 'success',
            title:
              warnings.length > 0 ? `${session.title} placed with a warning` : 'Session placed',
            detail: warnings[0] ?? `${session.title} now has a room and time.`,
          })
        }}
      />
      <p className="text-pretty text-base text-zinc-500 sm:text-sm">
        Times shown in {event.timezone}. Every accepted move is versioned and added to the audit
        trail; the public agenda changes only when you publish.
      </p>
    </div>
  )
}

function ScheduleFilterSelect({
  label,
  value,
  onChange,
  className,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  children: ReactNode
}) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1', className)}>
      <span className="sr-only">{label}</span>
      <span className="relative">
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="focus-ring min-h-11 w-full appearance-none rounded-lg bg-white py-2 pr-8 pl-3 text-base text-zinc-950 ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
        >
          {children}
        </select>
        <ChevronUpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 fill-zinc-400" />
      </span>
    </label>
  )
}

function MoveSessionDrawer({
  placementId,
  open,
  onClose,
  onMoved,
}: {
  placementId: string | null
  open: boolean
  onClose: () => void
  onMoved: (
    placement: Placement,
    session: Session,
    previous: { roomId: string; startsAt: string },
    warnings: string[],
  ) => void
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
    const previous = { roomId: placement!.roomId, startsAt: placement!.startsAt }
    const response = await execute(
      'schedule.move-session',
      { placementId: placement!.id, roomId, startsAt: iso },
      { expectedVersions: { [placement!.id]: placement!.version } },
      `${session.title} moved.`,
    )
    if (!response.ok) return
    const movedPlacement = (response.data as { placement?: Placement } | undefined)?.placement
    if (movedPlacement) {
      onMoved(
        movedPlacement,
        session,
        previous,
        previewWarnings.map((warning) => warning.message),
      )
    }
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
          <p className="mt-0.5 text-pretty text-base text-zinc-500 sm:text-sm">
            Conflict detection runs again before this move is accepted. The move stays in the draft
            until you publish.
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
          <Callout tone="success" title="No conflicts at this room and time">
            <p>Room, speaker, duration, and event-boundary checks all pass.</p>
          </Callout>
        ) : null}
      </form>
    </Drawer>
  )
}

function PlaceSessionDrawer({
  sessionId,
  open,
  onClose,
  onPlaced,
}: {
  sessionId: string | null
  open: boolean
  onClose: () => void
  onPlaced: (placement: Placement, session: Session, warnings: string[]) => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const session = payload?.state.sessions.find((entry) => entry.id === sessionId)
  const event = payload?.state.events.find((entry) => entry.id === payload.state.activeEventId)
  const timeZone = event?.timezone ?? 'UTC'
  const [roomId, setRoomId] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [timeError, setTimeError] = useState<string | null>(null)

  useEffect(() => {
    if (!payload || !session || !event) return
    const firstRoom = payload.state.rooms.find((room) => room.eventId === event.id)
    const nextDay = Date.parse(event.startsAt) + 24 * 60 * 60_000
    const nextDayEnds = nextDay + session.durationMinutes * 60_000
    const suggestedStart =
      nextDayEnds <= Date.parse(event.endsAt) ? nextDay : Date.parse(event.startsAt)
    setRoomId(firstRoom?.id ?? '')
    setStartsAt(toZonedDateTimeInput(new Date(suggestedStart).toISOString(), timeZone))
    setTimeError(null)
  }, [event, payload, session, timeZone])

  if (!payload || !session || !event) return null
  const { state } = payload
  let previewStartsAt: string | null = null
  try {
    previewStartsAt = startsAt ? zonedDateTimeInputToIso(startsAt, timeZone) : null
  } catch {
    previewStartsAt = null
  }
  const previewConflicts = previewStartsAt
    ? previewSessionPlacement(state, session.id, roomId, previewStartsAt)
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
      'schedule.place-session',
      { sessionId: session!.id, roomId, startsAt: iso },
      { expectedVersions: { [session!.id]: session!.version } },
      `${session!.title} placed.`,
    )
    if (!response.ok) return
    const placement = (response.data as { placement?: Placement } | undefined)?.placement
    if (placement) {
      onPlaced(
        placement,
        session!,
        previewWarnings.map((warning) => warning.message),
      )
    }
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Place session"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="place-session-form"
            disabled={mutating || !roomId || !previewStartsAt || previewHardConflicts.length > 0}
          >
            Place session
          </Button>
        </>
      }
    >
      <form
        id="place-session-form"
        className="flex flex-col gap-5"
        onSubmit={(submitEvent) => void submit(submitEvent)}
      >
        <div>
          <p className="text-base font-medium text-zinc-950 sm:text-sm">{session.title}</p>
          <p className="mt-0.5 text-pretty text-base text-zinc-500 sm:text-sm">
            Choose a draft room and time. The public agenda stays on version{' '}
            {event.publishedScheduleVersion ?? 'none'} until you publish.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Room</span>
          <span className="relative">
            <select
              name="roomId"
              value={roomId}
              onChange={(changeEvent) => setRoomId(changeEvent.target.value)}
              className="focus-ring min-h-11 w-full appearance-none rounded-xl bg-white py-2 pr-9 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
            >
              {state.rooms
                .filter((room) => room.eventId === event.id)
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
            aria-describedby={timeError ? 'place-session-time-error' : undefined}
            onChange={(changeEvent) => {
              setStartsAt(changeEvent.target.value)
              setTimeError(null)
            }}
            className={textControl}
          />
          {timeError ? (
            <span id="place-session-time-error" className="text-sm text-rose-700">
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
          <Callout tone="success" title="No conflicts at this room and time">
            <p>Room, speaker, duration, and event-boundary checks all pass.</p>
          </Callout>
        ) : null}
      </form>
    </Drawer>
  )
}
