import { ArrowLeftIcon, CalendarDaysIcon, MapPinIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

import { publicAgenda } from '@crm-library/core'

import { eventDateTime, eventTimeZoneLabel } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { Avatar, TrackBadge, cx } from '../components/ui.tsx'

export function AgendaView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [trackId, setTrackId] = useState('all')
  if (!payload) return null
  const { state } = payload
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const agenda = publicAgenda(state).filter(
    (item) => trackId === 'all' || item.track?.id === trackId,
  )
  const groups = Object.entries(
    agenda.reduce<Record<string, typeof agenda>>((result, item) => {
      const time = item.placement.startsAt
      result[time] = [...(result[time] ?? []), item]
      return result
    }, {}),
  ).sort(([left], [right]) => left.localeCompare(right))

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-950/5 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <a
            href="/agenda"
            aria-label="Homepage"
            className="focus-ring text-base font-semibold tracking-tight text-zinc-950"
            onClick={(event) => event.preventDefault()}
          >
            AIE NYC 2026
          </a>
          <button
            type="button"
            className="focus-ring flex items-center gap-2 rounded-lg text-base text-zinc-500 hover:text-zinc-950 sm:text-sm"
            onClick={() => navigate('/')}
          >
            <ArrowLeftIcon className="size-4 h-lh shrink-0 fill-current" />
            Operator workspace
          </button>
        </div>
      </header>

      <main>
        <section className="border-b border-zinc-950/5 bg-zinc-50 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="font-mono text-sm tracking-wide text-emerald-700 uppercase">
              Program preview
            </p>
            <h1 className="max-w-[18ch] text-balance text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
              The people building what comes next
            </h1>
            <p className="max-w-[65ch] pt-4 text-pretty text-lg text-zinc-600 sm:text-base">
              Two days of practical sessions on useful AI, better product systems, and the
              operational work between prototype and impact.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pt-6 text-zinc-600">
              <p className="flex items-center gap-2 text-base sm:text-sm">
                <CalendarDaysIcon className="size-4 h-lh shrink-0 fill-current" />
                October 4–5, 2026
              </p>
              <p className="flex items-center gap-2 text-base sm:text-sm">
                <MapPinIcon className="size-4 h-lh shrink-0 fill-current" />
                {event.venue}, {event.city}
              </p>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="min-w-0 overflow-x-auto border-b border-zinc-950/5">
              <div className="flex w-max gap-5" role="group" aria-label="Agenda tracks">
                {[{ id: 'all', name: 'All tracks' }, ...state.tracks].map((track) => (
                  <button
                    key={track.id}
                    type="button"
                    aria-pressed={trackId === track.id}
                    className={cx(
                      'focus-ring border-b-2 py-3 text-base sm:text-sm',
                      trackId === track.id
                        ? 'border-emerald-600 text-zinc-950'
                        : 'border-transparent text-zinc-500 hover:text-zinc-950',
                    )}
                    onClick={() => setTrackId(track.id)}
                  >
                    {track.name}
                  </button>
                ))}
              </div>
            </div>

            <ol role="list" className="divide-y divide-zinc-950/5">
              {groups.map(([startsAt, items]) => (
                <li key={startsAt} className="grid min-w-0 gap-4 py-7 md:grid-cols-[9rem_1fr]">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold tabular-nums text-zinc-950">
                      {eventDateTime(startsAt, event.timezone, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                    <p className="text-base text-zinc-500 sm:text-sm">
                      {eventTimeZoneLabel(startsAt, event.timezone)}
                    </p>
                  </div>
                  <div className="grid min-w-0 max-w-full gap-4 xl:grid-cols-2">
                    {items.map((item) => (
                      <article
                        key={item.placement.id}
                        className="min-w-0 max-w-full overflow-hidden rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-950/10"
                      >
                        <div className="flex items-center justify-between gap-3">
                          {item.track ? (
                            <TrackBadge name={item.track.name} color={item.track.color} />
                          ) : null}
                          <p className="text-base text-zinc-500 sm:text-sm">{item.room?.name}</p>
                        </div>
                        <h2 className="pt-4 text-balance text-xl font-semibold text-zinc-950">
                          {item.session?.title}
                        </h2>
                        <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
                          {item.session?.summary}
                        </p>
                        <ul role="list" className="flex flex-col gap-3 pt-5">
                          {item.speakers.map((speaker) => (
                            <li key={speaker.id} className="flex items-center gap-3">
                              <Avatar src={speaker.avatarUrl} name={speaker.name} />
                              <div className="min-w-0">
                                <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                                  {speaker.name}
                                </p>
                                <p className="truncate text-base text-zinc-500 sm:text-sm">
                                  {speaker.title}, {speaker.company}
                                </p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>
    </div>
  )
}
