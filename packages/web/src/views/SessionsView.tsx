import { CalendarDaysIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

import { useWorkspace } from '../lib/workspace.tsx'
import { eventDateTime } from '../lib/date.ts'
import {
  Avatar,
  Button,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  Toolbar,
  TrackBadge,
  sentenceCase,
} from '../components/ui.tsx'

export function SessionsView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [search, setSearch] = useState('')
  const [trackId, setTrackId] = useState('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
        description="Manage accepted sessions before they are placed on the agenda."
        actions={
          <Button variant="primary" onClick={() => navigate('/schedule')}>
            <CalendarDaysIcon className="size-4 h-lh shrink-0 fill-current" />
            Open schedule
          </Button>
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
      />
    </div>
  )
}

function SessionDrawer({
  sessionId,
  open,
  onClose,
}: {
  sessionId: string | null
  open: boolean
  onClose: () => void
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
        <div className="flex items-center gap-2">
          <TrackBadge name={track.name} color={track.color} />
          <span className="text-base text-zinc-500 sm:text-sm">
            {sentenceCase(session.format)} · {session.durationMinutes} min
          </span>
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
