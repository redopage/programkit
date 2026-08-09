import { CalendarDaysIcon, CheckIcon, MapPinIcon, PlusIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { publicAgenda } from '@programkit/core'

import { eventDateTime, eventTimeZoneLabel } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { EmptyState, TrackBadge, cx } from '../components/ui.tsx'

const itineraryStorageKey = 'programkit:aie-nyc-2026:itinerary'

function initialSavedSessions() {
  if (typeof window === 'undefined') return [] as string[]
  try {
    const value = JSON.parse(window.localStorage.getItem(itineraryStorageKey) ?? '[]') as unknown
    return Array.isArray(value) && value.every((entry) => typeof entry === 'string') ? value : []
  } catch {
    return []
  }
}

export function ItineraryEmbedView() {
  const { payload } = useWorkspace()
  const [savedIds, setSavedIds] = useState<string[]>(initialSavedSessions)
  const [savedOnly, setSavedOnly] = useState(false)
  const [trackId, setTrackId] = useState('all')

  useEffect(() => {
    window.localStorage.setItem(itineraryStorageKey, JSON.stringify(savedIds))
  }, [savedIds])

  if (!payload) return null
  const { state } = payload
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const agenda = publicAgenda(state).filter(
    (item) =>
      (trackId === 'all' || item.track?.id === trackId) &&
      (!savedOnly || savedIds.includes(item.session?.id ?? '')),
  )
  const groups = Object.entries(
    agenda.reduce<Record<string, typeof agenda>>((result, item) => {
      const day = eventDateTime(item.placement.startsAt, event.timezone, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      })
      result[day] = [...(result[day] ?? []), item]
      return result
    }, {}),
  )

  function toggle(sessionId: string) {
    setSavedIds((current) =>
      current.includes(sessionId)
        ? current.filter((entry) => entry !== sessionId)
        : [...current, sessionId],
    )
  }

  return (
    <div className="min-h-dvh bg-white text-zinc-950">
      <header className="border-b border-zinc-950/5 bg-zinc-50">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="flex items-center gap-2 text-base font-medium text-blue-700 sm:text-sm">
            <CalendarDaysIcon className="size-4 h-lh fill-current" />
            {event.name}
          </p>
          <h1 className="pt-2 text-3xl font-semibold tracking-tight">Build your itinerary</h1>
          <p className="max-w-2xl pt-1 text-pretty text-base text-zinc-600 sm:text-sm">
            Save the sessions you want to attend. Your picks stay on this device and never change
            the published program.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-5">
            <button
              type="button"
              aria-pressed={savedOnly}
              className={cx(
                'focus-ring min-h-11 rounded-lg px-3 text-base font-medium ring-1 ring-inset sm:text-sm',
                savedOnly
                  ? 'bg-zinc-950 text-white ring-zinc-950'
                  : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-100',
              )}
              onClick={() => setSavedOnly((current) => !current)}
            >
              My itinerary · {savedIds.length}
            </button>
            {/* The label only reaches assistive technology if the row is a
                group; a bare div drops it. */}
            <div
              role="group"
              className="flex min-w-0 gap-2 overflow-x-auto"
              aria-label="Filter by track"
            >
              {[{ id: 'all', name: 'All tracks' }, ...state.tracks].map((track) => (
                <button
                  key={track.id}
                  type="button"
                  aria-pressed={trackId === track.id}
                  className={cx(
                    'focus-ring min-h-11 shrink-0 rounded-lg px-3 text-base ring-1 ring-inset sm:text-sm',
                    trackId === track.id
                      ? 'bg-blue-50 font-medium text-blue-800 ring-blue-700/20'
                      : 'bg-white text-zinc-600 ring-zinc-950/10 hover:bg-zinc-100',
                  )}
                  onClick={() => setTrackId(track.id)}
                >
                  {track.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {groups.length === 0 ? (
          <EmptyState
            title={savedOnly ? 'Your itinerary is empty' : 'No sessions match'}
            description={
              savedOnly
                ? 'Turn off My itinerary to see the full program, then save the sessions you want.'
                : 'Choose another track to see more of the published program.'
            }
          />
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map(([day, items]) => (
              <section
                key={day}
                aria-labelledby={`day-${day.replaceAll(/\W+/gu, '-').toLowerCase()}`}
              >
                <h2
                  id={`day-${day.replaceAll(/\W+/gu, '-').toLowerCase()}`}
                  className="border-b border-zinc-950/5 pb-2 text-lg font-semibold"
                >
                  {day}
                </h2>
                <ol role="list" className="divide-y divide-zinc-950/5">
                  {items.map((item) => {
                    const sessionId = item.session!.id
                    const saved = savedIds.includes(sessionId)
                    return (
                      <li
                        key={item.placement.id}
                        className="grid gap-3 py-5 sm:grid-cols-[7rem_1fr_auto]"
                      >
                        {/* Time and zone share a line on a phone, where the
                            column is the full width, and stack once the row
                            gets its own time column. */}
                        <div className="flex items-baseline gap-2 sm:block">
                          <p className="text-base font-semibold tabular-nums">
                            {eventDateTime(item.placement.startsAt, event.timezone, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </p>
                          <p className="text-sm text-zinc-500">
                            {eventTimeZoneLabel(item.placement.startsAt, event.timezone)}
                          </p>
                        </div>
                        <div className="min-w-0">
                          {item.track ? (
                            <TrackBadge name={item.track.name} color={item.track.color} />
                          ) : null}
                          <h3 className="pt-2 text-lg font-semibold">{item.session?.title}</h3>
                          <p className="flex items-center gap-1.5 pt-1 text-base text-zinc-500 sm:text-sm">
                            <MapPinIcon className="size-4 h-lh shrink-0 fill-current" />
                            {item.room?.name}
                          </p>
                          <p className="pt-2 text-pretty text-base text-zinc-600 sm:text-sm">
                            {item.speakers.map((speaker) => speaker.name).join(', ')}
                          </p>
                        </div>
                        <button
                          type="button"
                          aria-pressed={saved}
                          aria-label={`${saved ? 'Remove' : 'Add'} ${item.session?.title} ${saved ? 'from' : 'to'} your itinerary`}
                          className={cx(
                            'focus-ring inline-flex min-h-11 items-center justify-center gap-1.5 self-start rounded-lg px-3 text-base font-medium ring-1 ring-inset sm:text-sm',
                            saved
                              ? 'bg-emerald-50 text-emerald-800 ring-emerald-700/20'
                              : 'bg-white text-zinc-700 ring-zinc-950/10 hover:bg-zinc-100',
                          )}
                          onClick={() => toggle(sessionId)}
                        >
                          {saved ? (
                            <CheckIcon className="size-4 h-lh fill-current" />
                          ) : (
                            <PlusIcon className="size-4 h-lh fill-current" />
                          )}
                          {saved ? 'Saved' : 'Save'}
                        </button>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
        <p className="pt-8 text-center text-sm text-zinc-400">Powered by ProgramKit</p>
      </main>
    </div>
  )
}
