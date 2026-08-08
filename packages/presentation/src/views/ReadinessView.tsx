import {
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
  MinusIcon,
} from '@heroicons/react/16/solid'
import { useState } from 'react'

import { readinessRows } from '@crm-library/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  Drawer,
  PageHeader,
  ProgressBar,
  StatusBadge,
  cx,
} from '../components/ui.tsx'

type ReadinessFilter = 'all' | 'blockers' | 'review' | 'ready'

const statusIcon = {
  approved: CheckIcon,
  waived: MinusIcon,
  submitted: ClockIcon,
  revision_requested: ExclamationTriangleIcon,
  not_started: MinusIcon,
} as const

function ReadinessCell({ status, label }: { status: keyof typeof statusIcon; label: string }) {
  const Icon = statusIcon[status]
  return (
    <span
      title={`${label}: ${status.replaceAll('_', ' ')}`}
      className={cx(
        'inline-flex size-7 items-center justify-center rounded-md',
        status === 'approved' && 'bg-emerald-50 text-emerald-700',
        status === 'waived' && 'bg-sky-50 text-sky-700',
        status === 'submitted' && 'bg-amber-50 text-amber-700',
        status === 'revision_requested' && 'bg-rose-50 text-rose-700',
        status === 'not_started' && 'bg-zinc-100 text-zinc-400',
      )}
    >
      <Icon className="size-4 shrink-0 fill-current" />
      <span className="sr-only">{`${label}: ${status.replaceAll('_', ' ')}`}</span>
    </span>
  )
}

export function ReadinessView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [filter, setFilter] = useState<ReadinessFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedParticipationId, setSelectedParticipationId] = useState<string | null>(null)
  if (!payload) return null
  const { state, derived } = payload
  const query = search.trim().toLowerCase()
  const rows = readinessRows(state).filter((row) => {
    if (query && !`${row.personName} ${row.company}`.toLowerCase().includes(query)) return false
    if (filter === 'blockers') return row.blockers > 0
    if (filter === 'review') return Object.values(row.requirementStatuses).includes('submitted')
    if (filter === 'ready') return row.percent === 100
    return true
  })
  const selected =
    state.participations.find((entry) => entry.id === selectedParticipationId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Operational checklist"
        title="Readiness"
        description="One place to see who is ready, what is missing, and which submitted items need a decision."
        actions={
          <Button variant="primary" onClick={() => navigate('/communications')}>
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            Draft reminder
          </Button>
        }
      />

      <div className="@container">
        <dl className="grid grid-cols-2 border-b border-zinc-950/5 pb-5 @3xl:grid-cols-4">
          {[
            ['Average readiness', `${derived.readiness.readinessPercent}%`],
            ['Fully ready', derived.readiness.ready],
            ['Hard blockers', derived.readiness.blockers],
            ['Awaiting review', derived.readiness.awaitingReview],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={`border-zinc-950/5 py-2 ${index % 2 === 1 ? 'border-l pl-5' : 'pr-5'} ${index > 1 ? 'border-t pt-5 @3xl:border-t-0 @3xl:pt-2' : ''} ${index === 2 ? '@3xl:border-l @3xl:pl-5' : ''}`}
            >
              <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
              <dd className="pt-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 overflow-x-auto">
          <div
            className="flex w-max items-center gap-1 rounded-lg bg-zinc-100 p-1"
            role="group"
            aria-label="Readiness views"
          >
            {(
              [
                ['all', 'All'],
                ['blockers', 'Blockers'],
                ['review', 'Awaiting review'],
                ['ready', 'Ready'],
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
            name="readiness-search"
            aria-label="Search readiness"
            placeholder="Search participants"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="focus-ring min-h-11 w-full rounded-lg bg-white py-2 pr-3 pl-9 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-9 sm:text-sm"
          />
        </div>
      </div>

      <div className="hidden sm:block">
        <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap lg:-mx-8">
          <div className="inline-block min-w-full px-6 py-2 align-middle lg:px-8">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-950/10">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 whitespace-nowrap bg-white py-2.5 pr-6 text-left text-sm font-medium text-zinc-500"
                  >
                    Participant
                  </th>
                  {state.requirementDefinitions.map((definition) => (
                    <th
                      key={definition.id}
                      scope="col"
                      className="whitespace-nowrap px-2 py-2.5 text-center text-sm font-medium text-zinc-500"
                    >
                      {definition.label}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="whitespace-nowrap py-2.5 pl-6 text-right text-sm font-medium text-zinc-500"
                  >
                    Ready
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/5">
                {rows.map((row) => {
                  const person = state.people.find((entry) => entry.id === row.personId)!
                  return (
                    <tr
                      key={row.participationId}
                      className="group cursor-pointer hover:bg-zinc-950/2"
                      onClick={() => setSelectedParticipationId(row.participationId)}
                    >
                      <td className="sticky left-0 z-10 bg-white py-3 pr-6 group-hover:bg-zinc-50">
                        <button
                          type="button"
                          className="focus-ring flex max-w-full items-center gap-3 rounded-lg text-left"
                          onClick={() => setSelectedParticipationId(row.participationId)}
                        >
                          <Avatar src={person.avatarUrl} name={row.personName} size="small" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-zinc-950">
                              {row.personName}
                            </p>
                            <p className="truncate text-sm text-zinc-500">{row.company}</p>
                          </div>
                        </button>
                      </td>
                      {state.requirementDefinitions.map((definition) => {
                        const status = row.requirementStatuses[definition.id] ?? 'not_started'
                        return (
                          <td key={definition.id} className="px-2 py-3 text-center">
                            <ReadinessCell status={status} label={definition.label} />
                          </td>
                        )
                      })}
                      <td className="py-3 pl-6 text-right">
                        <span className="text-sm font-medium tabular-nums text-zinc-950">
                          {row.percent}%
                        </span>
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
        {rows.map((row) => {
          const person = state.people.find((entry) => entry.id === row.personId)!
          return (
            <li key={row.participationId}>
              <button
                type="button"
                className="focus-ring w-full rounded-lg py-4 text-left hover:bg-zinc-950/2"
                onClick={() => setSelectedParticipationId(row.participationId)}
              >
                <span className="flex items-start gap-3">
                  <Avatar src={person.avatarUrl} name={row.personName} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium text-zinc-950">
                          {row.personName}
                        </span>
                        <span className="block truncate text-base text-zinc-500">
                          {row.company}
                        </span>
                      </span>
                      <span className="shrink-0 text-base font-medium tabular-nums text-zinc-950">
                        {row.percent}%
                      </span>
                    </span>
                    <span className="mt-3 block">
                      <ProgressBar value={row.percent} />
                    </span>
                    <span className="mt-3 flex flex-wrap gap-1.5">
                      {state.requirementDefinitions.map((definition) => (
                        <ReadinessCell
                          key={definition.id}
                          status={row.requirementStatuses[definition.id] ?? 'not_started'}
                          label={definition.label}
                        />
                      ))}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <ReadinessDrawer
        participationId={selected?.id ?? null}
        open={Boolean(selected)}
        onClose={() => setSelectedParticipationId(null)}
      />
    </div>
  )
}

function ReadinessDrawer({
  participationId,
  open,
  onClose,
}: {
  participationId: string | null
  open: boolean
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  if (!payload || !participationId) return null
  const { state } = payload
  const participation = state.participations.find((entry) => entry.id === participationId)!
  const person = state.people.find((entry) => entry.id === participation.personId)!
  const instances = state.requirementInstances.filter(
    (entry) => entry.participationId === participationId,
  )
  const row = readinessRows(state).find((entry) => entry.participationId === participationId)!
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`${person.firstName} ${person.lastName} readiness`}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Avatar
            src={person.avatarUrl}
            name={`${person.firstName} ${person.lastName}`}
            size="large"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="truncate text-lg font-semibold text-zinc-950">
                {person.firstName} {person.lastName}
              </p>
              <span className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                {row.percent}%
              </span>
            </div>
            <div className="pt-2">
              <ProgressBar value={row.percent} />
            </div>
          </div>
        </div>
        <ul role="list" className="divide-y divide-zinc-950/5">
          {instances.map((instance) => {
            const definition = state.requirementDefinitions.find(
              (entry) => entry.id === instance.definitionId,
            )!
            return (
              <li
                key={instance.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-zinc-950 sm:text-sm">
                    {definition.label}
                  </p>
                  <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                    {definition.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
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
                  {instance.status === 'revision_requested' ? (
                    <Button
                      size="compact"
                      disabled={mutating}
                      onClick={() =>
                        void execute(
                          'requirement.set-status',
                          { requirementInstanceId: instance.id, status: 'waived' },
                          { expectedVersions: { [instance.id]: instance.version } },
                          `${definition.label} waived.`,
                        )
                      }
                    >
                      Waive
                    </Button>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </Drawer>
  )
}
