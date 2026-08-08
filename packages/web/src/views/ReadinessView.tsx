import {
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MinusIcon,
} from '@heroicons/react/16/solid'
import { useState } from 'react'

import { readinessRows } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  Drawer,
  FilterTabs,
  PageHeader,
  ProgressBar,
  SearchInput,
  StatGrid,
  StatusBadge,
  Toolbar,
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
  const description = `${label}: ${status.replaceAll('_', ' ')}`
  return (
    <span title={description} className="inline-flex h-lh items-center">
      <Icon
        className={cx(
          'size-4 shrink-0',
          status === 'approved' && 'fill-emerald-600',
          status === 'waived' && 'fill-sky-600',
          status === 'submitted' && 'fill-amber-500',
          status === 'revision_requested' && 'fill-rose-600',
          status === 'not_started' && 'fill-zinc-300',
        )}
      />
      <span className="sr-only">{description}</span>
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
        title="Readiness"
        description="See who is ready, what is missing, and what needs review."
        actions={
          <Button variant="primary" onClick={() => navigate('/communications')}>
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            Draft reminder
          </Button>
        }
      />

      <StatGrid
        stats={[
          { label: 'Average readiness', value: `${derived.readiness.readinessPercent}%` },
          { label: 'Fully ready', value: derived.readiness.ready },
          { label: 'Hard blockers', value: derived.readiness.blockers },
          { label: 'Awaiting review', value: derived.readiness.awaitingReview },
        ]}
      />

      <Toolbar>
        <FilterTabs
          label="Readiness views"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'All'],
            ['blockers', 'Blockers'],
            ['review', 'Awaiting review'],
            ['ready', 'Ready'],
          ]}
        />
        <SearchInput
          label="Search readiness"
          name="readiness-search"
          placeholder="Search participants"
          value={search}
          onChange={setSearch}
        />
      </Toolbar>

      <div className="hidden sm:block">
        <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap">
          <div className="inline-block min-w-full px-6 py-2 align-middle">
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
