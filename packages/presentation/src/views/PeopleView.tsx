import {
  ArrowDownTrayIcon,
  EnvelopeIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { participationPerson, readinessRows, type Person } from '@crm-library/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  Drawer,
  EmptyState,
  PageHeader,
  ProgressBar,
  StatusBadge,
  cx,
} from '../components/ui.tsx'

type PeopleFilter = 'all' | 'confirmed' | 'unconfirmed' | 'incomplete'

export function PeopleView({ initialPersonId }: { initialPersonId?: string | null }) {
  const { payload, execute, mutating } = useWorkspace()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PeopleFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId ?? null)
  const [adding, setAdding] = useState(false)
  if (!payload) return null
  const { state } = payload
  const rows = readinessRows(state)

  const query = search.trim().toLowerCase()
  const records = state.participations
    .map((participation) => {
      const person = participationPerson(state, participation)!
      const readiness = rows.find((row) => row.participationId === participation.id)!
      return { person, participation, readiness }
    })
    .filter(({ person, participation, readiness }) => {
      if (
        query &&
        !`${person.firstName} ${person.lastName} ${person.email} ${person.company}`
          .toLowerCase()
          .includes(query)
      )
        return false
      if (filter === 'confirmed') return participation.status === 'confirmed'
      if (filter === 'unconfirmed') return participation.status === 'invited'
      if (filter === 'incomplete') return readiness.blockers > 0
      return true
    })
    .sort((left, right) => left.person.lastName.localeCompare(right.person.lastName))

  const selectedPerson = state.people.find((person) => person.id === selectedId) ?? null
  const selectedParticipation = state.participations.find(
    (participation) => participation.personId === selectedId,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Relational CRM"
        title="People"
        description="Persistent people records connected to event-specific roles, sessions, requirements, and activity."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.open('/api/v1/export', '_blank')}>
              <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
              Export
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Add person
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <div
            className="flex w-max items-center gap-1 rounded-lg bg-zinc-100 p-1"
            role="group"
            aria-label="People views"
          >
            {(
              [
                ['all', 'All'],
                ['confirmed', 'Confirmed'],
                ['unconfirmed', 'Awaiting reply'],
                ['incomplete', 'Incomplete'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                className={cx(
                  'focus-ring min-h-9 rounded-md px-3 text-base text-zinc-600 sm:min-h-7 sm:text-sm',
                  filter === value && 'bg-white text-zinc-950 shadow-xs ring-1 ring-black/5',
                )}
                onClick={() => setFilter(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative min-w-0 sm:w-72">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-zinc-400" />
          <input
            type="search"
            name="people-search"
            aria-label="Search people"
            placeholder="Search people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="focus-ring min-h-11 w-full rounded-lg bg-white py-2 pr-3 pl-9 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-9 sm:text-sm"
          />
        </div>
      </div>

      <p className="text-base text-zinc-500 sm:text-sm">
        <span className="font-medium tabular-nums text-zinc-950">{records.length}</span> people in
        this view
      </p>

      {records.length === 0 ? (
        <EmptyState title="No people found" description="Try a different search or saved view." />
      ) : (
        <>
          <div className="hidden sm:block">
            <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap lg:-mx-8">
              <div className="inline-block min-w-full px-6 py-2 align-middle lg:px-8">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-950/10">
                      {['Person', 'Status', 'Role', 'Readiness', 'Sessions', 'Last update'].map(
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
                    {records.map(({ person, participation, readiness }) => (
                      <tr
                        key={person.id}
                        className="group cursor-pointer hover:bg-zinc-950/2"
                        onClick={() => setSelectedId(person.id)}
                      >
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            className="focus-ring flex max-w-full items-center gap-3 rounded-lg text-left"
                            onClick={() => setSelectedId(person.id)}
                          >
                            <Avatar
                              src={person.avatarUrl}
                              name={`${person.firstName} ${person.lastName}`}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-zinc-950">
                                {person.firstName} {person.lastName}
                              </p>
                              <p className="truncate text-sm text-zinc-500">
                                {person.title} · {person.company}
                              </p>
                            </div>
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={participation.status} />
                        </td>
                        <td className="py-3 pr-4 text-sm capitalize text-zinc-600">
                          {participation.roles.join(', ').replaceAll('_', ' ')}
                        </td>
                        <td className="w-40 py-3 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="min-w-20 flex-1">
                              <ProgressBar value={readiness.percent} />
                            </div>
                            <span className="text-sm tabular-nums text-zinc-500">
                              {readiness.percent}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                          {participation.sessionIds.length}
                        </td>
                        <td className="py-3 text-sm text-zinc-500">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(person.updatedAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <ul role="list" className="divide-y divide-zinc-950/5 sm:hidden">
            {records.map(({ person, participation, readiness }) => (
              <li key={person.id}>
                <button
                  type="button"
                  className="focus-ring flex w-full gap-3 rounded-lg py-4 text-left hover:bg-zinc-950/2"
                  onClick={() => setSelectedId(person.id)}
                >
                  <Avatar src={person.avatarUrl} name={`${person.firstName} ${person.lastName}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium text-zinc-950">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="block truncate text-base text-zinc-500">
                          {person.company}
                        </span>
                      </span>
                      <StatusBadge status={participation.status} />
                    </span>
                    <span className="mt-3 flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <ProgressBar value={readiness.percent} />
                      </span>
                      <span className="text-base tabular-nums text-zinc-500">
                        {readiness.percent}%
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <PersonDrawer
        person={selectedPerson}
        open={Boolean(selectedPerson && selectedParticipation)}
        onClose={() => setSelectedId(null)}
      />
      <AddPersonDrawer
        open={adding}
        onClose={() => setAdding(false)}
        execute={execute}
        mutating={mutating}
      />
    </div>
  )
}

function PersonDrawer({
  person,
  open,
  onClose,
}: {
  person: Person | null
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const [tab, setTab] = useState<'details' | 'requirements' | 'activity'>('details')
  if (!payload || !person) return null
  const { state } = payload
  const participation = state.participations.find((entry) => entry.personId === person.id)!
  const instances = state.requirementInstances.filter(
    (entry) => entry.participationId === participation.id,
  )
  const events = state.domainEvents
    .filter(
      (event) =>
        event.aggregate.id === person.id ||
        event.aggregate.id === participation.id ||
        event.data.participationId === participation.id,
    )
    .reverse()
  const tabs = [
    ['details', 'Details'],
    ['requirements', 'Requirements'],
    ['activity', 'Activity'],
  ] as const

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${person.firstName} ${person.lastName}`}
      footer={
        participation.status === 'prospect' ? (
          <Button
            variant="primary"
            disabled={mutating}
            onClick={() =>
              void execute(
                'participation.set-status',
                { participationId: participation.id, status: 'invited' },
                { expectedVersions: { [participation.id]: participation.version } },
                'Invitation status recorded.',
              )
            }
          >
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            Mark invited
          </Button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-4">
          <Avatar
            src={person.avatarUrl}
            name={`${person.firstName} ${person.lastName}`}
            size="large"
          />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-zinc-950">
              {person.firstName} {person.lastName}
            </p>
            <p className="text-base text-zinc-500 sm:text-sm">
              {person.title} at {person.company}
            </p>
            <div className="pt-2">
              <StatusBadge status={participation.status} />
            </div>
          </div>
        </div>

        <div className="min-w-0 overflow-x-auto border-b border-zinc-950/5">
          <div className="flex w-max gap-5" role="group" aria-label="Person details">
            {tabs.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={tab === value}
                className={cx(
                  'focus-ring border-b-2 py-2 text-base sm:text-sm',
                  tab === value
                    ? 'border-emerald-600 text-zinc-950'
                    : 'border-transparent text-zinc-500 hover:text-zinc-950',
                )}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'details' ? (
          <div className="flex flex-col gap-6">
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ['Email', person.email],
                ['Location', person.city || 'Not provided'],
                ['Timezone', person.timezone],
                ['Roles', participation.roles.join(', ').replaceAll('_', ' ')],
              ].map(([term, detail]) => (
                <div key={term}>
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
                  <dd className="text-base text-zinc-500 sm:text-sm">{detail}</dd>
                </div>
              ))}
            </dl>
            <div>
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Public bio</h3>
              <p className="pt-1 text-pretty text-base text-zinc-500 sm:text-sm">{person.bio}</p>
            </div>
            <div>
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Sessions</h3>
              <ul role="list" className="divide-y divide-zinc-950/5 pt-1">
                {participation.sessionIds.map((sessionId) => {
                  const session = state.sessions.find((entry) => entry.id === sessionId)
                  return session ? (
                    <li key={session.id} className="py-2 text-base text-zinc-600 sm:text-sm">
                      {session.title}
                    </li>
                  ) : null
                })}
              </ul>
            </div>
          </div>
        ) : null}

        {tab === 'requirements' ? (
          <ul role="list" className="divide-y divide-zinc-950/5">
            {instances.map((instance) => {
              const definition = state.requirementDefinitions.find(
                (entry) => entry.id === instance.definitionId,
              )!
              return (
                <li key={instance.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {definition.label}
                    </p>
                    <p className="truncate text-base text-zinc-500 sm:text-sm">
                      Due{' '}
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                        new Date(definition.dueAt),
                      )}
                    </p>
                  </div>
                  <StatusBadge status={instance.status} />
                  {instance.status === 'submitted' ? (
                    <Button
                      size="compact"
                      disabled={mutating}
                      onClick={() =>
                        void execute(
                          'requirement.set-status',
                          { requirementInstanceId: instance.id, status: 'approved' },
                          { expectedVersions: { [instance.id]: instance.version } },
                          `${definition.label} approved.`,
                        )
                      }
                    >
                      Approve
                    </Button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : null}

        {tab === 'activity' ? (
          events.length > 0 ? (
            <ol role="list" className="divide-y divide-zinc-950/5">
              {events.map((event) => (
                <li key={event.id} className="py-3">
                  <p className="text-pretty text-base text-zinc-950 sm:text-sm">{event.summary}</p>
                  <p className="text-base text-zinc-500 sm:text-sm">
                    {event.actor.name} ·{' '}
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(event.occurredAt))}
                  </p>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState
              title="No recorded activity"
              description="Accepted operations will appear here."
            />
          )
        ) : null}
      </div>
    </Drawer>
  )
}

function AddPersonDrawer({
  open,
  onClose,
  execute,
  mutating,
}: {
  open: boolean
  onClose: () => void
  execute: ReturnType<typeof useWorkspace>['execute']
  mutating: boolean
}) {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'person.create',
      form,
      undefined,
      `${form.firstName} ${form.lastName} added.`,
    )
    if (!response.ok) return
    setForm({ firstName: '', lastName: '', email: '', company: '', title: '' })
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add person"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="add-person-form" disabled={mutating}>
            Add person
          </Button>
        </>
      }
    >
      <form
        id="add-person-form"
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          This creates a persistent person and a prospect participation for the active event.
        </p>
        {[
          ['firstName', 'First name', 'Robin'],
          ['lastName', 'Last name', 'Sloan'],
          ['email', 'Email', 'robin@example.com'],
          ['company', 'Company', 'Axiom'],
          ['title', 'Title', 'Founder'],
        ].map(([name, label, placeholder]) => (
          <label key={name} className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">{label}</span>
            <input
              type={name === 'email' ? 'email' : 'text'}
              name={name}
              required={name === 'firstName' || name === 'lastName' || name === 'email'}
              value={form[name as keyof typeof form]}
              placeholder={placeholder}
              onChange={(event) =>
                setForm((current) => ({ ...current, [name]: event.target.value }))
              }
              className="focus-ring min-h-11 rounded-lg bg-white px-3 py-2 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-9 sm:text-sm"
            />
          </label>
        ))}
      </form>
    </Drawer>
  )
}
