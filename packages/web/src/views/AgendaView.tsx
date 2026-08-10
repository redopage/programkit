import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'

import { publicAgenda } from '@programkit/core'

import { ProgramKitMark } from '../components/brand.tsx'
import { Button, Drawer, TrackBadge, cx, sentenceCase } from '../components/ui.tsx'
import { eventDateTime, eventTimeZoneLabel } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'

type AgendaItem = ReturnType<typeof publicAgenda>[number]
type PublishedSession = AgendaItem & { session: NonNullable<AgendaItem['session']> }
type ProgramView = 'agenda' | 'sessions' | 'speakers' | 'itinerary' | 'gallery'

interface PublicSpeaker {
  id: string
  name: string
  company: string
  title: string
  avatarUrl: string
  bio: string
  sessions: PublishedSession[]
}

const programViews: Array<{ id: ProgramView; label: string }> = [
  { id: 'agenda', label: 'Agenda' },
  { id: 'sessions', label: 'Sessions' },
  { id: 'speakers', label: 'Speakers' },
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'gallery', label: 'Gallery' },
]

function initialProgramView(): ProgramView {
  if (typeof window === 'undefined') return 'agenda'
  const requested = new URLSearchParams(window.location.search).get('view')
  return programViews.some((view) => view.id === requested) ? (requested as ProgramView) : 'agenda'
}

function initialTrack() {
  if (typeof window === 'undefined') return 'all'
  return new URLSearchParams(window.location.search).get('track') ?? 'all'
}

function initialRoom() {
  if (typeof window === 'undefined') return 'all'
  return new URLSearchParams(window.location.search).get('room') ?? 'all'
}

function initialAccent() {
  if (typeof window === 'undefined') return '#2563eb'
  const requested = new URLSearchParams(window.location.search).get('accent') ?? ''
  return /^#[\da-f]{6}$/iu.test(requested) ? requested : '#2563eb'
}

function initialShowDescriptions() {
  if (typeof window === 'undefined') return true
  return new URLSearchParams(window.location.search).get('descriptions') !== 'hide'
}

function isPublishedSession(item: AgendaItem): item is PublishedSession {
  return item.session != null
}

function eventDayKey(value: string, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone,
    })
      .formatToParts(new Date(value))
      .map((part) => [part.type, part.value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function eventDayLabel(value: string, timeZone: string, long = false) {
  return eventDateTime(value, timeZone, {
    weekday: long ? 'long' : 'short',
    month: long ? 'long' : 'short',
    day: 'numeric',
  })
}

function eventTimeRange(item: PublishedSession, timeZone: string) {
  const start = eventDateTime(item.placement.startsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  })
  const end = eventDateTime(item.placement.endsAt, timeZone, {
    hour: 'numeric',
    minute: '2-digit',
  })
  return `${start} to ${end}`
}

function searchableSession(item: PublishedSession) {
  return [
    item.session.title,
    item.session.summary,
    item.session.format,
    item.track?.name,
    item.room?.name,
    ...item.speakers.flatMap((speaker) => [speaker.name, speaker.company, speaker.title]),
  ]
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase()
}

function lastName(name: string) {
  return name.trim().split(/\s+/u).at(-1) ?? name
}

function initials(name: string) {
  return name
    .split(/\s+/u)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toLocaleUpperCase()
}

function PublicAvatar({
  speaker,
  large = false,
  gallery = false,
}: {
  speaker: PublicSpeaker
  large?: boolean
  gallery?: boolean
}) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [speaker.avatarUrl])

  if (speaker.avatarUrl && !failed) {
    return (
      <img
        src={speaker.avatarUrl}
        alt=""
        onError={() => setFailed(true)}
        className={cx(
          'shrink-0 bg-zinc-100 object-cover',
          gallery
            ? 'h-full w-full transition-transform duration-300 group-hover:scale-[1.02]'
            : 'rounded-full outline-1 -outline-offset-1 outline-black/10',
          !gallery && (large ? 'size-14' : 'size-9'),
        )}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={cx(
        'inline-flex shrink-0 items-center justify-center font-semibold',
        gallery
          ? 'h-full w-full bg-zinc-100 text-3xl text-zinc-400'
          : 'rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-950/10',
        !gallery && (large ? 'size-14 text-base' : 'size-9 text-sm'),
      )}
    >
      {initials(speaker.name)}
    </span>
  )
}

function ProgramSearch({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  return (
    <div className="relative min-w-0 sm:w-72">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-zinc-400" />
      <input
        type="search"
        aria-label="Search the public program"
        placeholder="Search the program"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-11 w-full rounded-full bg-white py-2 pr-4 pl-9 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-9 sm:text-sm"
      />
    </div>
  )
}

function ProgramFilters({
  trackId,
  roomId,
  format,
  tracks,
  rooms,
  formats,
  onTrackChange,
  onRoomChange,
  onFormatChange,
}: {
  trackId: string
  roomId: string
  format: string
  tracks: Array<{ id: string; name: string }>
  rooms: Array<{ id: string; name: string }>
  formats: string[]
  onTrackChange: (next: string) => void
  onRoomChange: (next: string) => void
  onFormatChange: (next: string) => void
}) {
  const control =
    'focus-ring min-h-11 rounded-full bg-white px-4 text-base text-zinc-700 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm'
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <select
        aria-label="Filter by track"
        value={trackId}
        onChange={(event) => onTrackChange(event.target.value)}
        className={control}
      >
        <option value="all">All tracks</option>
        {tracks.map((track) => (
          <option key={track.id} value={track.id}>
            {track.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by format"
        value={format}
        onChange={(event) => onFormatChange(event.target.value)}
        className={control}
      >
        <option value="all">All formats</option>
        {formats.map((value) => (
          <option key={value} value={value}>
            {sentenceCase(value)}
          </option>
        ))}
      </select>
      <select
        aria-label="Filter by room"
        value={roomId}
        onChange={(event) => onRoomChange(event.target.value)}
        className={control}
      >
        <option value="all">All rooms</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
    </div>
  )
}

function DayPicker({
  days,
  activeDay,
  timeZone,
  onChange,
}: {
  days: PublishedSession[]
  activeDay: string
  timeZone: string
  onChange: (next: string) => void
}) {
  const dayKeys = days.map((item) => eventDayKey(item.placement.startsAt, timeZone))
  const currentIndex = Math.max(0, dayKeys.indexOf(activeDay))
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-full bg-zinc-950/4 p-1">
      <button
        type="button"
        aria-label="Previous day"
        disabled={currentIndex <= 0}
        className="focus-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white hover:text-zinc-950 disabled:pointer-events-none disabled:opacity-30 sm:size-8"
        onClick={() => onChange(dayKeys[currentIndex - 1])}
      >
        <ChevronLeftIcon className="size-4" />
      </button>
      <div className="min-w-0 px-2 text-center text-base font-medium text-zinc-800 sm:text-sm">
        {eventDayLabel(days[currentIndex].placement.startsAt, timeZone, true)}
      </div>
      <button
        type="button"
        aria-label="Next day"
        disabled={currentIndex >= days.length - 1}
        className="focus-ring inline-flex size-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white hover:text-zinc-950 disabled:pointer-events-none disabled:opacity-30 sm:size-8"
        onClick={() => onChange(dayKeys[currentIndex + 1])}
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  )
}

function ScheduleButton({ selected, onClick }: { selected: boolean; onClick: () => void }) {
  return (
    <Button variant={selected ? 'secondary' : 'ghost'} size="compact" onClick={onClick}>
      {selected ? <CheckIcon className="size-4" /> : <PlusIcon className="size-4" />}
      {selected ? 'In my schedule' : 'Add to schedule'}
    </Button>
  )
}

export function AgendaView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [view, setView] = useState<ProgramView>(initialProgramView)
  const [query, setQuery] = useState('')
  const [trackId, setTrackId] = useState(initialTrack)
  const [roomId, setRoomId] = useState(initialRoom)
  const [format, setFormat] = useState('all')
  const [programAccent] = useState(initialAccent)
  const [showDescriptions] = useState(initialShowDescriptions)
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(null)
  const [expandedSessionIds, setExpandedSessionIds] = useState<string[]>([])
  const [personalSessionIds, setPersonalSessionIds] = useState<string[]>([])
  const [loadedItineraryEventId, setLoadedItineraryEventId] = useState<string | null>(null)
  const [personalOnly, setPersonalOnly] = useState(false)

  const state = payload?.state
  const eventId = state?.activeEventId
  const published = useMemo(
    () => (state ? publicAgenda(state).filter(isPublishedSession) : []),
    [state],
  )

  useEffect(() => {
    if (!eventId) return
    try {
      const stored = window.localStorage.getItem(`programkit:itinerary:${eventId}`)
      const parsed = stored ? (JSON.parse(stored) as unknown) : []
      setPersonalSessionIds(
        Array.isArray(parsed)
          ? parsed.filter((value): value is string => typeof value === 'string')
          : [],
      )
    } catch {
      setPersonalSessionIds([])
    }
    setLoadedItineraryEventId(eventId)
  }, [eventId])

  useEffect(() => {
    if (!eventId || loadedItineraryEventId !== eventId) return
    window.localStorage.setItem(
      `programkit:itinerary:${eventId}`,
      JSON.stringify(personalSessionIds),
    )
  }, [eventId, loadedItineraryEventId, personalSessionIds])

  if (!state || !eventId) return null
  const event = state.events.find((entry) => entry.id === eventId)!
  const dayItems = Array.from(
    new Map(
      published.map((item) => [eventDayKey(item.placement.startsAt, event.timezone), item]),
    ).values(),
  )
  const dayKeys = dayItems.map((item) => eventDayKey(item.placement.startsAt, event.timezone))
  const activeDay = dayKeys.includes(selectedDay) ? selectedDay : (dayKeys[0] ?? '')
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const formats = Array.from(new Set(published.map((item) => item.session.format))).sort()
  const filteredSessions = published.filter(
    (item) =>
      (trackId === 'all' || item.track?.id === trackId) &&
      (roomId === 'all' || item.room?.id === roomId) &&
      (format === 'all' || item.session.format === format) &&
      (!normalizedQuery || searchableSession(item).includes(normalizedQuery)),
  )
  const speakers = Array.from(
    published
      .flatMap((item) => item.speakers)
      .reduce<Map<string, PublicSpeaker>>((result, speaker) => {
        if (result.has(speaker.id)) return result
        const person = state.people.find((entry) => entry.id === speaker.id)
        result.set(speaker.id, {
          ...speaker,
          bio: person?.bio ?? '',
          sessions: published.filter((item) =>
            item.speakers.some((entry) => entry.id === speaker.id),
          ),
        })
        return result
      }, new Map())
      .values(),
  ).sort((left, right) =>
    lastName(left.name).localeCompare(lastName(right.name), undefined, { sensitivity: 'base' }),
  )
  const filteredSpeakers = speakers.filter((speaker) =>
    [speaker.name, speaker.title, speaker.company, speaker.bio]
      .join(' ')
      .toLocaleLowerCase()
      .includes(normalizedQuery),
  )
  const selectedSession = published.find((item) => item.session.id === selectedSessionId) ?? null
  const selectedSpeaker = speakers.find((speaker) => speaker.id === selectedSpeakerId) ?? null
  const agendaSessions = filteredSessions.filter(
    (item) => eventDayKey(item.placement.startsAt, event.timezone) === activeDay,
  )
  const itinerarySessions = agendaSessions.filter(
    (item) => !personalOnly || personalSessionIds.includes(item.session.id),
  )
  const speakerCount = speakers.length

  function togglePersonalSession(sessionId: string) {
    setPersonalSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((entry) => entry !== sessionId)
        : [...current, sessionId],
    )
  }

  function updateShareableView(nextView: ProgramView) {
    setView(nextView)
    const url = new URL(window.location.href)
    url.searchParams.set('view', nextView)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function updateShareableTrack(nextTrackId: string) {
    setTrackId(nextTrackId)
    const url = new URL(window.location.href)
    if (nextTrackId === 'all') url.searchParams.delete('track')
    else url.searchParams.set('track', nextTrackId)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function updateShareableRoom(nextRoomId: string) {
    setRoomId(nextRoomId)
    const url = new URL(window.location.href)
    if (nextRoomId === 'all') url.searchParams.delete('room')
    else url.searchParams.set('room', nextRoomId)
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }

  function toggleExpanded(sessionId: string) {
    setExpandedSessionIds((current) =>
      current.includes(sessionId)
        ? current.filter((entry) => entry !== sessionId)
        : [...current, sessionId],
    )
  }

  function exportCalendar() {
    const chosen = published.filter((item) => personalSessionIds.includes(item.session.id))
    if (chosen.length === 0) return
    const icsDate = (value: string) =>
      new Date(value).toISOString().replaceAll(/[-:]/gu, '').replace('.000', '')
    const escaped = (value: string) =>
      value
        .replaceAll('\\', '\\\\')
        .replaceAll(',', '\\,')
        .replaceAll(';', '\\;')
        .replaceAll('\n', '\\n')
    const body = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//ProgramKit//Personal schedule//EN',
      ...chosen.flatMap((item) => [
        'BEGIN:VEVENT',
        `UID:${item.session.id}@programkit.dev`,
        `DTSTAMP:${icsDate(new Date().toISOString())}`,
        `DTSTART:${icsDate(item.placement.startsAt)}`,
        `DTEND:${icsDate(item.placement.endsAt)}`,
        `SUMMARY:${escaped(item.session.title)}`,
        `DESCRIPTION:${escaped(item.session.summary)}`,
        `LOCATION:${escaped(item.room?.name ?? event.venue)}`,
        'END:VEVENT',
      ]),
      'END:VCALENDAR',
    ].join('\r\n')
    const url = URL.createObjectURL(new Blob([body], { type: 'text/calendar;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `${event.slug}-my-schedule.ics`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div
      className="min-h-dvh bg-white text-zinc-950"
      style={{ '--program-accent': programAccent } as CSSProperties}
    >
      <header className="sticky top-0 z-30 border-b border-zinc-950/5 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <ProgramKitMark className="size-7" />
            <span className="truncate text-base font-semibold tracking-tight">{event.name}</span>
          </div>
          <button
            type="button"
            aria-label="Manage event"
            className="focus-ring flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-base text-zinc-500 hover:bg-zinc-950/4 hover:text-zinc-950 sm:text-sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeftIcon className="size-4 shrink-0 fill-current" />
            <span className="hidden sm:inline">Manage event</span>
          </button>
        </div>
      </header>

      <main>
        <section className="border-b border-zinc-950/5 bg-zinc-50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="grid gap-10 lg:grid-cols-[7fr_5fr] lg:items-end lg:gap-16">
              <div className="min-w-0">
                <h1 className="max-w-[18ch] text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                  The people building what comes next
                </h1>
                <p className="max-w-[65ch] pt-4 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                  Explore the sessions, meet the speakers, and build a schedule for your day.
                </p>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 text-zinc-600">
                  <p className="flex items-center gap-2 text-base sm:text-sm">
                    <CalendarDaysIcon className="size-4 shrink-0 fill-current" />
                    {eventDayLabel(event.startsAt, event.timezone, true)} to{' '}
                    {eventDayLabel(event.endsAt, event.timezone, true)}
                  </p>
                  <p className="flex items-center gap-2 text-base sm:text-sm">
                    <MapPinIcon className="size-4 shrink-0 fill-current" />
                    {event.venue}, {event.city}
                  </p>
                </div>
              </div>
              <dl className="grid min-w-0 grid-cols-2 gap-y-6">
                {(
                  [
                    ['Sessions', published.length],
                    ['Speakers', speakerCount],
                    ['Tracks', state.tracks.length],
                    ['Stages', state.rooms.length],
                  ] as const
                ).map(([label, value], index) => (
                  <div
                    key={label}
                    className={cx('border-zinc-950/10', index % 2 === 1 ? 'border-l pl-5' : 'pr-5')}
                  >
                    <dt className="truncate text-base text-zinc-500 sm:text-sm">{label}</dt>
                    <dd className="pt-1 text-3xl font-semibold tracking-tight tabular-nums">
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <section className="border-b border-zinc-950/5 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <nav aria-label="Public program views" className="min-w-0 overflow-x-auto">
              <div className="flex min-w-max gap-5">
                {programViews.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={view === item.id}
                    className={cx(
                      'focus-ring border-b-2 py-4 text-base sm:text-sm',
                      view === item.id
                        ? 'font-medium text-zinc-950'
                        : 'border-transparent text-zinc-500 hover:text-zinc-950',
                    )}
                    style={view === item.id ? { borderColor: programAccent } : undefined}
                    onClick={() => updateShareableView(item.id)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {(view === 'agenda' || view === 'itinerary') && dayItems.length > 0 ? (
              <div className="flex min-w-0 flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
                <DayPicker
                  days={dayItems}
                  activeDay={activeDay}
                  timeZone={event.timezone}
                  onChange={setSelectedDay}
                />
                {view === 'agenda' ? (
                  <ProgramFilters
                    trackId={trackId}
                    roomId={roomId}
                    format={format}
                    tracks={state.tracks}
                    rooms={state.rooms}
                    formats={formats}
                    onTrackChange={updateShareableTrack}
                    onRoomChange={updateShareableRoom}
                    onFormatChange={setFormat}
                  />
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={personalOnly ? 'secondary' : 'ghost'}
                      size="compact"
                      onClick={() => setPersonalOnly((current) => !current)}
                    >
                      My schedule ({personalSessionIds.length})
                    </Button>
                    <Button
                      variant="secondary"
                      size="compact"
                      disabled={personalSessionIds.length === 0}
                      onClick={exportCalendar}
                    >
                      <ArrowDownTrayIcon className="size-4" />
                      Add to calendar
                    </Button>
                  </div>
                )}
              </div>
            ) : null}

            {view === 'agenda' ? (
              <AgendaSchedule
                sessions={agendaSessions}
                timeZone={event.timezone}
                onOpen={(item) => setSelectedSessionId(item.session.id)}
              />
            ) : null}

            {view === 'sessions' ? (
              <div>
                <div className="flex min-w-0 flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <ProgramSearch value={query} onChange={setQuery} />
                  <ProgramFilters
                    trackId={trackId}
                    roomId={roomId}
                    format={format}
                    tracks={state.tracks}
                    rooms={state.rooms}
                    formats={formats}
                    onTrackChange={updateShareableTrack}
                    onRoomChange={updateShareableRoom}
                    onFormatChange={setFormat}
                  />
                </div>
                <p className="pb-3 text-base text-zinc-500 sm:text-sm">
                  {filteredSessions.length} {filteredSessions.length === 1 ? 'session' : 'sessions'}
                </p>
                <div className="grid min-w-0 gap-4 lg:grid-cols-2">
                  {filteredSessions.map((item) => {
                    const expanded = expandedSessionIds.includes(item.session.id)
                    return (
                      <article
                        key={item.session.id}
                        className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-zinc-950/10"
                      >
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          {item.track ? (
                            <TrackBadge name={item.track.name} color={item.track.color} />
                          ) : null}
                          <span className="text-sm text-zinc-500">
                            {sentenceCase(item.session.format)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="focus-ring mt-4 block max-w-full rounded-md text-left text-xl font-semibold text-zinc-950 hover:text-blue-700"
                          onClick={() => setSelectedSessionId(item.session.id)}
                        >
                          {item.session.title}
                        </button>
                        <p className="pt-2 text-base font-medium text-zinc-600">
                          {eventDayLabel(item.placement.startsAt, event.timezone)} ·{' '}
                          {eventTimeRange(item, event.timezone)} · {item.room?.name}
                        </p>
                        {showDescriptions ? (
                          <>
                            <p
                              className={cx(
                                'pt-3 text-pretty text-base/7 text-zinc-600',
                                !expanded && 'line-clamp-2',
                              )}
                            >
                              {item.session.summary}
                            </p>
                            <button
                              type="button"
                              className="focus-ring mt-1 rounded-md text-base font-medium hover:opacity-75 sm:text-sm"
                              style={{ color: programAccent }}
                              onClick={() => toggleExpanded(item.session.id)}
                            >
                              {expanded ? 'Show less' : 'Show more'}
                            </button>
                          </>
                        ) : null}
                        <div className="flex min-w-0 flex-col gap-4 pt-5 sm:flex-row sm:items-end sm:justify-between">
                          <ul role="list" className="min-w-0 space-y-2">
                            {item.speakers.map((speaker) => (
                              <li key={speaker.id}>
                                <button
                                  type="button"
                                  className="focus-ring max-w-full truncate rounded-md text-left text-base font-medium text-zinc-800 hover:text-blue-700 sm:text-sm"
                                  onClick={() => setSelectedSpeakerId(speaker.id)}
                                >
                                  {speaker.name} · {speaker.title}, {speaker.company}
                                </button>
                              </li>
                            ))}
                          </ul>
                          <ScheduleButton
                            selected={personalSessionIds.includes(item.session.id)}
                            onClick={() => togglePersonalSession(item.session.id)}
                          />
                        </div>
                      </article>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {view === 'speakers' || view === 'gallery' ? (
              <div>
                <div className="flex min-w-0 flex-col gap-3 pb-6 sm:flex-row sm:items-center sm:justify-between">
                  <ProgramSearch value={query} onChange={setQuery} />
                  <p className="text-base text-zinc-500 sm:text-sm">
                    {filteredSpeakers.length}{' '}
                    {filteredSpeakers.length === 1 ? 'speaker' : 'speakers'}
                  </p>
                </div>
                {view === 'speakers' ? (
                  <ul role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
                    {filteredSpeakers.map((speaker) => (
                      <li key={speaker.id}>
                        <button
                          type="button"
                          className="focus-ring flex min-h-20 w-full min-w-0 items-center gap-4 rounded-xl px-2 py-3 text-left hover:bg-zinc-50 sm:px-3"
                          onClick={() => setSelectedSpeakerId(speaker.id)}
                        >
                          <PublicAvatar speaker={speaker} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-semibold text-zinc-950">
                              {speaker.name}
                            </span>
                            <span className="block truncate text-base text-zinc-500 sm:text-sm">
                              {speaker.title}, {speaker.company}
                            </span>
                          </span>
                          <span className="shrink-0 text-base text-zinc-400 sm:text-sm">
                            {speaker.sessions.length}{' '}
                            {speaker.sessions.length === 1 ? 'session' : 'sessions'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul
                    role="list"
                    className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4"
                  >
                    {filteredSpeakers.map((speaker) => (
                      <li key={speaker.id} className="min-w-0">
                        <button
                          type="button"
                          className="group focus-ring block w-full rounded-2xl text-left"
                          onClick={() => setSelectedSpeakerId(speaker.id)}
                        >
                          <span className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-2xl bg-zinc-100 ring-1 ring-zinc-950/8">
                            <PublicAvatar speaker={speaker} gallery />
                          </span>
                          <span className="block truncate pt-3 text-base font-semibold text-zinc-950">
                            {speaker.name}
                          </span>
                          <span className="block truncate text-base text-zinc-500 sm:text-sm">
                            {speaker.title}, {speaker.company}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            {view === 'itinerary' ? (
              <ol role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
                {itinerarySessions.map((item) => (
                  <li
                    key={item.session.id}
                    className="grid min-w-0 gap-4 py-6 md:grid-cols-[9rem_1fr_auto]"
                  >
                    <div className="min-w-0">
                      <p className="text-lg font-semibold tabular-nums">
                        {eventTimeRange(item, event.timezone)}
                      </p>
                      <p className="text-base text-zinc-500 sm:text-sm">{item.room?.name}</p>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.track ? (
                          <TrackBadge name={item.track.name} color={item.track.color} />
                        ) : null}
                        <span className="text-sm text-zinc-500">
                          {sentenceCase(item.session.format)}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="focus-ring mt-3 max-w-full rounded-md text-left text-xl font-semibold hover:text-blue-700"
                        onClick={() => setSelectedSessionId(item.session.id)}
                      >
                        {item.session.title}
                      </button>
                      {showDescriptions ? (
                        <p className="pt-2 text-pretty text-base/7 text-zinc-600">
                          {item.session.summary}
                        </p>
                      ) : null}
                      <p className="pt-3 text-base text-zinc-500 sm:text-sm">
                        {item.speakers
                          .map(
                            (speaker) => `${speaker.name}, ${speaker.title} at ${speaker.company}`,
                          )
                          .join(' · ')}
                      </p>
                    </div>
                    <div className="md:pt-1">
                      <ScheduleButton
                        selected={personalSessionIds.includes(item.session.id)}
                        onClick={() => togglePersonalSession(item.session.id)}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : null}

            {(view === 'sessions' && filteredSessions.length === 0) ||
            ((view === 'speakers' || view === 'gallery') && filteredSpeakers.length === 0) ||
            (view === 'itinerary' && itinerarySessions.length === 0) ||
            (view === 'agenda' && agendaSessions.length === 0) ? (
              <div className="rounded-2xl bg-zinc-50 px-5 py-14 text-center ring-1 ring-zinc-950/5">
                <p className="text-base font-medium text-zinc-800">Nothing matches this view.</p>
                <p className="pt-1 text-base text-zinc-500 sm:text-sm">
                  Clear a filter or choose another day.
                </p>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <Drawer
        open={selectedSession != null}
        onClose={() => setSelectedSessionId(null)}
        title={selectedSession?.session.title ?? 'Session'}
      >
        {selectedSession ? (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {selectedSession.track ? (
                <TrackBadge name={selectedSession.track.name} color={selectedSession.track.color} />
              ) : null}
              <span className="text-base text-zinc-500 sm:text-sm">
                {sentenceCase(selectedSession.session.format)}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
              <div>
                <dt className="text-base text-zinc-500 sm:text-sm">Date and time</dt>
                <dd className="pt-1 text-base font-medium text-zinc-950">
                  {eventDayLabel(selectedSession.placement.startsAt, event.timezone, true)}
                  <br />
                  {eventTimeRange(selectedSession, event.timezone)}{' '}
                  {eventTimeZoneLabel(selectedSession.placement.startsAt, event.timezone)}
                </dd>
              </div>
              <div>
                <dt className="text-base text-zinc-500 sm:text-sm">Room</dt>
                <dd className="pt-1 text-base font-medium text-zinc-950">
                  {selectedSession.room?.name}
                </dd>
              </div>
            </dl>
            {showDescriptions ? (
              <div>
                <h3 className="text-base font-semibold text-zinc-950">About this session</h3>
                <p className="pt-2 text-pretty text-base/7 text-zinc-600">
                  {selectedSession.session.summary}
                </p>
              </div>
            ) : null}
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Speakers</h3>
              <ul role="list" className="space-y-2 pt-3">
                {selectedSession.speakers.map((speaker) => (
                  <li key={speaker.id}>
                    <button
                      type="button"
                      className="focus-ring w-full rounded-xl px-3 py-2 text-left hover:bg-zinc-50"
                      onClick={() => {
                        setSelectedSessionId(null)
                        setSelectedSpeakerId(speaker.id)
                      }}
                    >
                      <span className="block text-base font-medium text-zinc-950">
                        {speaker.name}
                      </span>
                      <span className="block text-base text-zinc-500 sm:text-sm">
                        {speaker.title}, {speaker.company}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <ScheduleButton
              selected={personalSessionIds.includes(selectedSession.session.id)}
              onClick={() => togglePersonalSession(selectedSession.session.id)}
            />
          </div>
        ) : null}
      </Drawer>

      <Drawer
        open={selectedSpeaker != null}
        onClose={() => setSelectedSpeakerId(null)}
        title={selectedSpeaker?.name ?? 'Speaker'}
      >
        {selectedSpeaker ? (
          <div className="space-y-6">
            <div className="flex min-w-0 items-center gap-4">
              <PublicAvatar speaker={selectedSpeaker} large />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-zinc-950">
                  {selectedSpeaker.name}
                </p>
                <p className="truncate text-base text-zinc-500">
                  {selectedSpeaker.title}, {selectedSpeaker.company}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Biography</h3>
              <p className="pt-2 text-pretty text-base/7 text-zinc-600">
                {selectedSpeaker.bio || 'Biography coming soon.'}
              </p>
            </div>
            <div>
              <h3 className="text-base font-semibold text-zinc-950">Sessions</h3>
              <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
                {selectedSpeaker.sessions.map((item) => (
                  <li key={item.session.id} className="py-3">
                    <button
                      type="button"
                      className="focus-ring max-w-full rounded-md text-left font-medium text-zinc-950 hover:text-blue-700"
                      onClick={() => {
                        setSelectedSpeakerId(null)
                        setSelectedSessionId(item.session.id)
                      }}
                    >
                      {item.session.title}
                    </button>
                    <p className="pt-1 text-base text-zinc-500 sm:text-sm">
                      {eventDayLabel(item.placement.startsAt, event.timezone)} ·{' '}
                      {eventTimeRange(item, event.timezone)} · {item.room?.name}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

function AgendaSchedule({
  sessions,
  timeZone,
  onOpen,
}: {
  sessions: PublishedSession[]
  timeZone: string
  onOpen: (item: PublishedSession) => void
}) {
  const groups = Object.entries(
    sessions.reduce<Record<string, PublishedSession[]>>((result, item) => {
      const time = item.placement.startsAt
      result[time] = [...(result[time] ?? []), item]
      return result
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right))

  return (
    <ol role="list" className="divide-y divide-zinc-950/5 border-y border-zinc-950/5">
      {groups.map(([startsAt, items]) => (
        <li key={startsAt} className="grid min-w-0 gap-4 py-7 md:grid-cols-[9rem_1fr]">
          <div className="min-w-0">
            <p className="text-lg font-semibold tabular-nums">
              {eventDateTime(startsAt, timeZone, { hour: 'numeric', minute: '2-digit' })}
            </p>
            <p className="text-base text-zinc-500 sm:text-sm">
              {eventTimeZoneLabel(startsAt, timeZone)}
            </p>
          </div>
          <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <button
                key={item.placement.id}
                type="button"
                className="focus-ring min-w-0 max-w-full overflow-hidden rounded-2xl bg-white p-5 text-left shadow-sm ring-1 ring-zinc-950/10 hover:ring-zinc-950/20"
                onClick={() => onOpen(item)}
              >
                <span className="flex min-w-0 items-center justify-between gap-3">
                  {item.track ? (
                    <TrackBadge name={item.track.name} color={item.track.color} />
                  ) : null}
                  <span className="truncate text-base text-zinc-500 sm:text-sm">
                    {item.room?.name}
                  </span>
                </span>
                <span className="block pt-4 text-balance text-xl font-semibold">
                  {item.session.title}
                </span>
                <span className="block pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
                  {sentenceCase(item.session.format)} · {eventTimeRange(item, timeZone)}
                </span>
              </button>
            ))}
          </div>
        </li>
      ))}
    </ol>
  )
}
