import {
  CheckIcon,
  ClockIcon,
  EnvelopeIcon,
  ExclamationTriangleIcon,
  MinusIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

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
  textAreaControl,
  textControl,
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
  const [addingTask, setAddingTask] = useState(false)
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
  const speakerTasks = state.requirementDefinitions.filter(
    (definition) => definition.eventId === state.activeEventId && definition.systemKey === null,
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Readiness"
        actions={
          <>
            <Button variant="secondary" onClick={() => setAddingTask(true)}>
              <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Add task
            </Button>
            <Button onClick={() => navigate('/communications?compose=reminder')}>
              <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
              Draft reminder
            </Button>
          </>
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

      {speakerTasks.length > 0 ? (
        <section aria-labelledby="speaker-tasks-heading">
          <div className="flex items-end justify-between gap-4 border-b border-zinc-950/10 pb-3">
            <div>
              <h2 id="speaker-tasks-heading" className="text-lg font-semibold text-zinc-950">
                Speaker tasks
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">
                Assign action items or files, then follow every speaker’s progress.
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-2xl">
              <thead>
                <tr className="border-b border-zinc-950/10">
                  {['Task', 'Due', 'Assigned to', 'Progress'].map((heading) => (
                    <th
                      key={heading}
                      scope="col"
                      className="py-2.5 pr-6 text-left text-sm font-medium text-zinc-500 last:pr-0 last:text-right"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/5">
                {speakerTasks.map((definition) => {
                  const instances = state.requirementInstances.filter(
                    (instance) => instance.definitionId === definition.id,
                  )
                  const assignees = instances
                    .map((instance) => {
                      const participation = state.participations.find(
                        (entry) => entry.id === instance.participationId,
                      )
                      const person = participation
                        ? state.people.find((entry) => entry.id === participation.personId)
                        : null
                      return person ? `${person.firstName} ${person.lastName}` : null
                    })
                    .filter((name): name is string => Boolean(name))
                  const completed = instances.filter(
                    (instance) => instance.status === 'approved' || instance.status === 'waived',
                  ).length
                  return (
                    <tr key={definition.id}>
                      <td className="py-3 pr-6">
                        <p className="text-sm font-medium text-zinc-950">{definition.label}</p>
                        {definition.description ? (
                          <p className="max-w-md truncate text-sm text-zinc-500">
                            {definition.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap py-3 pr-6 text-sm text-zinc-600">
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }).format(new Date(definition.dueAt))}
                      </td>
                      <td className="py-3 pr-6 text-sm text-zinc-600">{assignees.join(', ')}</td>
                      <td className="whitespace-nowrap py-3 text-right text-sm font-medium tabular-nums text-zinc-950">
                        {completed} of {instances.length}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

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
                        const status = row.requirementStatuses[definition.id]
                        return (
                          <td key={definition.id} className="px-2 py-3 text-center">
                            {status ? (
                              <ReadinessCell status={status} label={definition.label} />
                            ) : (
                              <span className="text-zinc-300" title="Not assigned">
                                —<span className="sr-only">{definition.label}: not assigned</span>
                              </span>
                            )}
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
                      {state.requirementDefinitions.map((definition) => {
                        const status = row.requirementStatuses[definition.id]
                        return status ? (
                          <ReadinessCell
                            key={definition.id}
                            status={status}
                            label={definition.label}
                          />
                        ) : null
                      })}
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
      <AddTaskDrawer open={addingTask} onClose={() => setAddingTask(false)} />
    </div>
  )
}

function AddTaskDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [form, setForm] = useState({
    label: '',
    description: '',
    dueDate: '',
    kind: 'confirmation' as 'confirmation' | 'file',
    sessionId: '',
    maxSizeMb: '20',
    participationIds: [] as string[],
  })
  if (!payload) return null
  const { state } = payload
  const people = state.participations
    .map((participation) => ({
      participation,
      person: state.people.find((entry) => entry.id === participation.personId)!,
    }))
    .sort((left, right) => left.person.lastName.localeCompare(right.person.lastName))

  function toggleParticipant(participationId: string) {
    setForm((current) => ({
      ...current,
      participationIds: current.participationIds.includes(participationId)
        ? current.participationIds.filter((id) => id !== participationId)
        : [...current.participationIds, participationId],
    }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'requirement.create',
      {
        label: form.label,
        description: form.description,
        kind: form.kind,
        sessionId: form.sessionId || undefined,
        acceptedContentTypes:
          form.kind === 'file'
            ? [
                'application/pdf',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
              ]
            : undefined,
        maxSizeBytes: form.kind === 'file' ? Number(form.maxSizeMb) * 1_000_000 : undefined,
        dueAt: `${form.dueDate}T23:59:59.000Z`,
        participationIds: form.participationIds,
      },
      undefined,
      `${form.label} assigned to ${form.participationIds.length} ${
        form.participationIds.length === 1 ? 'person' : 'people'
      }.`,
    )
    if (!response.ok) return
    setForm({
      label: '',
      description: '',
      dueDate: '',
      kind: 'confirmation',
      sessionId: '',
      maxSizeMb: '20',
      participationIds: [],
    })
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Add speaker task"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="add-speaker-task-form"
            disabled={mutating || form.participationIds.length === 0}
          >
            Add task
          </Button>
        </>
      }
    >
      <form
        id="add-speaker-task-form"
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-medium text-zinc-950 sm:text-sm">Task type</legend>
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-zinc-100 p-1">
            {(
              [
                ['confirmation', 'Action item'],
                ['file', 'File request'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.kind === value}
                className={cx(
                  'focus-ring rounded-xl px-3 py-2 text-sm font-medium transition',
                  form.kind === value
                    ? 'bg-white text-zinc-950 shadow-xs ring-1 ring-zinc-950/5'
                    : 'text-zinc-600 hover:text-zinc-950',
                )}
                onClick={() => setForm((current) => ({ ...current, kind: value }))}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Task</span>
          <input
            type="text"
            name="label"
            required
            placeholder="Complete bio and profile"
            value={form.label}
            onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))}
            className={textControl}
          />
        </label>
        {form.kind === 'file' ? (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">
                Session <span className="font-normal text-zinc-500">(optional)</span>
              </span>
              <select
                name="sessionId"
                value={form.sessionId}
                onChange={(event) => {
                  const sessionId = event.target.value
                  const eligibleIds = new Set(
                    sessionId
                      ? state.participations
                          .filter((participation) => participation.sessionIds.includes(sessionId))
                          .map((participation) => participation.id)
                      : state.participations.map((participation) => participation.id),
                  )
                  setForm((current) => ({
                    ...current,
                    sessionId,
                    participationIds: current.participationIds.filter((id) => eligibleIds.has(id)),
                  }))
                }}
                className={textControl}
              >
                <option value="">General event task</option>
                {state.sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">Maximum size</span>
              <select
                name="maxSizeMb"
                value={form.maxSizeMb}
                onChange={(event) =>
                  setForm((current) => ({ ...current, maxSizeMb: event.target.value }))
                }
                className={textControl}
              >
                <option value="10">10 MB</option>
                <option value="20">20 MB</option>
                <option value="50">50 MB</option>
              </select>
              <span className="text-sm text-zinc-500">Accepts PDF and PowerPoint files.</span>
            </label>
          </>
        ) : null}
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Due date</span>
          <input
            type="date"
            name="dueDate"
            required
            value={form.dueDate}
            onChange={(event) =>
              setForm((current) => ({ ...current, dueDate: event.target.value }))
            }
            className={textControl}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">
            Instructions <span className="font-normal text-zinc-500">(optional)</span>
          </span>
          <textarea
            name="description"
            rows={4}
            value={form.description}
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            className={textAreaControl}
          />
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-base font-medium text-zinc-950 sm:text-sm">Assign to</legend>
          <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-950/10">
            {people
              .filter(
                ({ participation }) =>
                  !form.sessionId || participation.sessionIds.includes(form.sessionId),
              )
              .map(({ participation, person }) => (
                <label
                  key={participation.id}
                  className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-zinc-950/5 px-4 py-2.5 last:border-b-0 hover:bg-zinc-950/2"
                >
                  <input
                    type="checkbox"
                    name="participationIds"
                    value={participation.id}
                    checked={form.participationIds.includes(participation.id)}
                    onChange={() => toggleParticipant(participation.id)}
                    className="focus-ring size-4 rounded border-zinc-300 text-blue-600"
                  />
                  <Avatar
                    src={person.avatarUrl}
                    name={`${person.firstName} ${person.lastName}`}
                    size="small"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {person.firstName} {person.lastName}
                    </span>
                    <span className="block truncate text-base text-zinc-500 sm:text-sm">
                      {person.email}
                    </span>
                  </span>
                </label>
              ))}
          </div>
          <p className="text-base text-zinc-500 sm:text-sm">
            {form.participationIds.length === 0
              ? 'Choose one or more speakers.'
              : `${form.participationIds.length} selected`}
          </p>
        </fieldset>
      </form>
    </Drawer>
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
