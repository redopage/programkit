import { MagnifyingGlassIcon, UserGroupIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

import { publicAgenda } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Avatar, EmptyState, textControl } from '../components/ui.tsx'

export function SpeakerGalleryEmbedView() {
  const { payload } = useWorkspace()
  const [query, setQuery] = useState('')
  if (!payload) return null
  const { state } = payload
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const publishedPersonIds = new Set(
    publicAgenda(state).flatMap((entry) => entry.speakers.map((speaker) => speaker.id)),
  )
  const speakers = state.people
    .filter((person) => publishedPersonIds.has(person.id))
    .map((person) => {
      const participation = state.participations.find((entry) => entry.personId === person.id)!
      return {
        id: person.id,
        name: `${person.firstName} ${person.lastName}`,
        title: participation.publicTitle,
        company: participation.publicCompany,
        bio: person.bio,
        avatarUrl: person.avatarUrl,
      }
    })
    .filter((speaker) =>
      `${speaker.name} ${speaker.title} ${speaker.company}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((left, right) => left.name.localeCompare(right.name))

  return (
    <div className="min-h-dvh bg-white text-zinc-950">
      <header className="border-b border-zinc-950/5 bg-zinc-50">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <p className="flex items-center gap-2 text-base font-medium text-blue-700 sm:text-sm">
            <UserGroupIcon className="size-4 h-lh fill-current" />
            {event.name}
          </p>
          <div className="flex flex-col gap-5 pt-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Speaker gallery</h1>
              <p className="max-w-xl pt-1 text-pretty text-base text-zinc-600 sm:text-sm">
                Meet the people sharing practical work across the published program.
              </p>
            </div>
            <label className="relative block min-w-0 sm:w-72">
              <span className="sr-only">Search speakers</span>
              <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 fill-zinc-400" />
              <input
                type="search"
                value={query}
                placeholder="Search speakers"
                onChange={(event) => setQuery(event.target.value)}
                className={`${textControl} pl-9`}
              />
            </label>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {speakers.length === 0 ? (
          <EmptyState title="No speakers match" description="Try a name, title, or company." />
        ) : (
          <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {speakers.map((speaker) => (
              <li key={speaker.id} className="min-w-0 rounded-2xl p-5 ring-1 ring-zinc-950/10">
                <div className="flex items-center gap-3">
                  <Avatar src={speaker.avatarUrl} name={speaker.name} size="large" />
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{speaker.name}</h2>
                    <p className="truncate text-base text-zinc-500 sm:text-sm">
                      {speaker.title}, {speaker.company}
                    </p>
                  </div>
                </div>
                <p className="line-clamp-4 pt-4 text-pretty text-base text-zinc-600 sm:text-sm">
                  {speaker.bio}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="pt-8 text-center text-sm text-zinc-400">Powered by ProgramKit</p>
      </main>
    </div>
  )
}
