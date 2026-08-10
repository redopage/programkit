import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowUpTrayIcon,
  ArrowsRightLeftIcon,
  EnvelopeIcon,
  PlusIcon,
  TagIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import {
  contactConnections,
  crmDashboard,
  crmSegmentMembers,
  duplicateContactGroups,
  type OperationRequest,
  type OperationResponse,
  type Person,
  type SpeakerPipelineEntry,
  type SpeakerPipelineStage,
  type WorkspaceState,
} from '@programkit/core'

import {
  Avatar,
  Button,
  Dialog,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  SectionHeading,
  StatGrid,
  Toolbar,
  cx,
  selectControl,
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'
import { parseSpeakerCsv, type SpeakerCsvRow } from '../lib/speaker-csv.ts'
import { useWorkspace } from '../lib/workspace.tsx'

type CrmTab = 'overview' | 'directory' | 'pipeline' | 'segments'
type ExecuteOperation = (
  operation: string,
  input: Record<string, unknown>,
  options?: Omit<OperationRequest, 'input'>,
  successMessage?: string,
) => Promise<OperationResponse>

const pipelineStages: SpeakerPipelineStage[] = [
  'researching',
  'identified',
  'contacted',
  'interested',
  'confirmed',
  'declined',
]

export function CrmView() {
  const { payload, execute, mutating } = useWorkspace()
  const [tab, setTab] = useState<CrmTab>('overview')
  const [search, setSearch] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [personId, setPersonId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [savingSegment, setSavingSegment] = useState(false)
  const [outreachIds, setOutreachIds] = useState<string[] | null>(null)
  const [reviewingDuplicates, setReviewingDuplicates] = useState(false)
  if (!payload) return null
  const { state } = payload
  const dashboard = crmDashboard(state)
  const duplicateGroups = duplicateContactGroups(state)
  const companies = [
    ...new Set(state.people.map((person) => person.company).filter(Boolean)),
  ].sort()
  const tags = [...new Set(state.people.flatMap((person) => person.tags))].sort()
  const query = search.trim().toLocaleLowerCase()
  const contacts = state.people
    .filter((person) => {
      const haystack =
        `${person.firstName} ${person.lastName} ${person.email} ${person.company} ${person.title}`.toLocaleLowerCase()
      return (
        (!query || haystack.includes(query)) &&
        (!company || person.company === company) &&
        (!title || person.title.toLocaleLowerCase().includes(title.toLocaleLowerCase())) &&
        (!tag || person.tags.includes(tag))
      )
    })
    .sort((left, right) =>
      `${left.lastName} ${left.firstName}`.localeCompare(`${right.lastName} ${right.firstName}`),
    )
  const selectedPerson = state.people.find((person) => person.id === personId) ?? null
  const allVisibleSelected =
    contacts.length > 0 && contacts.every((person) => selectedIds.includes(person.id))

  const toggleSelected = (nextPersonId: string) => {
    setSelectedIds((current) =>
      current.includes(nextPersonId)
        ? current.filter((id) => id !== nextPersonId)
        : [...current, nextPersonId],
    )
  }

  const enrollSelected = async () => {
    const alreadyEnrolled = new Set(state.speakerPipeline.map((entry) => entry.personId))
    for (const selectedPersonId of selectedIds.filter((id) => !alreadyEnrolled.has(id))) {
      await execute(
        'crm.pipeline.enroll',
        { personId: selectedPersonId, stage: 'identified' },
        undefined,
        'Added to the speaker pipeline.',
      )
    }
    setSelectedIds([])
    setTab('pipeline')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Speaker CRM"
        actions={
          <>
            {selectedIds.length > 0 ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => void enrollSelected()}
                  disabled={mutating}
                >
                  <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
                  Add to pipeline
                </Button>
                <Button variant="secondary" onClick={() => setOutreachIds([...selectedIds])}>
                  <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
                  Email {selectedIds.length}
                </Button>
              </>
            ) : null}
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
              Import
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Add contact
            </Button>
          </>
        }
      />

      <FilterTabs
        label="CRM views"
        value={tab}
        onChange={setTab}
        options={[
          ['overview', 'Overview'],
          ['directory', 'Directory'],
          ['pipeline', 'Pipeline'],
          ['segments', 'Segments'],
        ]}
      />

      {tab === 'overview' ? (
        <CrmOverview
          state={state}
          dashboard={dashboard}
          duplicateCount={duplicateGroups.length}
          onOpenDirectory={() => setTab('directory')}
          onOpenPerson={setPersonId}
          onReviewDuplicates={() => setReviewingDuplicates(true)}
        />
      ) : null}

      {tab === 'directory' ? (
        <div className="flex flex-col gap-4">
          <Toolbar>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
              <label className="grid min-w-44 grid-cols-1">
                <span className="sr-only">Filter by company</span>
                <select
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  className={selectControl}
                >
                  <option value="">All companies</option>
                  {companies.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <label className="grid min-w-40 grid-cols-1">
                <span className="sr-only">Filter by tag</span>
                <select
                  value={tag}
                  onChange={(event) => setTag(event.target.value)}
                  className={selectControl}
                >
                  <option value="">All tags</option>
                  {tags.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <input
                aria-label="Filter by title"
                placeholder="Title contains"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className={cx(textControl, 'w-44')}
              />
              {company || title || tag ? (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setCompany('')
                    setTitle('')
                    setTag('')
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <SearchInput
              label="Search contacts"
              name="crm-search"
              placeholder="Search contacts"
              value={search}
              onChange={setSearch}
            />
          </Toolbar>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base text-zinc-500 sm:text-sm">
              <span className="font-medium tabular-nums text-zinc-950">{contacts.length}</span>{' '}
              {contacts.length === 1 ? 'contact' : 'contacts'}
            </p>
            <div className="flex gap-2">
              <Button size="compact" variant="secondary" onClick={() => setSavingSegment(true)}>
                Save segment
              </Button>
              {duplicateGroups.length > 0 ? (
                <Button
                  size="compact"
                  variant="secondary"
                  onClick={() => setReviewingDuplicates(true)}
                >
                  <ArrowsRightLeftIcon className="size-4 h-lh shrink-0 fill-current" />
                  {duplicateGroups.length} possible duplicate
                  {duplicateGroups.length === 1 ? '' : 's'}
                </Button>
              ) : null}
            </div>
          </div>
          <ContactTable
            contacts={contacts}
            state={state}
            selectedIds={selectedIds}
            allSelected={allVisibleSelected}
            onToggleAll={() =>
              setSelectedIds(allVisibleSelected ? [] : contacts.map((person) => person.id))
            }
            onToggle={toggleSelected}
            onOpen={setPersonId}
          />
        </div>
      ) : null}

      {tab === 'pipeline' ? (
        <PipelineBoard state={state} execute={execute} mutating={mutating} onOpen={setPersonId} />
      ) : null}

      {tab === 'segments' ? (
        state.crmSegments.length === 0 ? (
          <EmptyState
            title="No saved segments"
            description="Filter the directory, then save the result for outreach or planning."
            action={<Button onClick={() => setTab('directory')}>Open directory</Button>}
          />
        ) : (
          <div className="divide-y divide-zinc-950/5 rounded-2xl ring-1 ring-zinc-950/8">
            {state.crmSegments.map((segment) => {
              const members = crmSegmentMembers(state, segment)
              return (
                <div
                  key={segment.id}
                  className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-zinc-950">{segment.name}</p>
                    <p className="text-base text-zinc-500 sm:text-sm">
                      {members.length} {members.length === 1 ? 'contact' : 'contacts'} ·{' '}
                      {segment.mode}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="compact"
                      onClick={() => {
                        setOutreachIds(members.map((person) => person.id))
                      }}
                    >
                      <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
                      Email segment
                    </Button>
                    <Button
                      size="compact"
                      onClick={() => {
                        setCompany(segment.filters.company ?? '')
                        setTitle(segment.filters.title ?? '')
                        setTag(segment.filters.tag ?? '')
                        setSearch('')
                        setTab('directory')
                      }}
                    >
                      View
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )
      ) : null}

      <AddContactDialog
        open={adding}
        onClose={() => setAdding(false)}
        execute={execute}
        mutating={mutating}
      />
      <ImportContactsDialog
        open={importing}
        onClose={() => setImporting(false)}
        execute={execute}
        mutating={mutating}
      />
      <SaveSegmentDialog
        open={savingSegment}
        onClose={() => setSavingSegment(false)}
        execute={execute}
        mutating={mutating}
        filters={{ company, title, tag }}
        selectedIds={selectedIds}
      />
      <OutreachDialog
        open={outreachIds !== null}
        onClose={() => setOutreachIds(null)}
        execute={execute}
        mutating={mutating}
        people={state.people.filter((person) => outreachIds?.includes(person.id))}
      />
      <DuplicateDialog
        open={reviewingDuplicates}
        onClose={() => setReviewingDuplicates(false)}
        execute={execute}
        mutating={mutating}
        groups={duplicateGroups}
      />
      {selectedPerson ? (
        <ContactDrawer
          key={selectedPerson.id}
          person={selectedPerson}
          state={state}
          execute={execute}
          mutating={mutating}
          onClose={() => setPersonId(null)}
        />
      ) : null}
    </div>
  )
}

function CrmOverview({
  state,
  dashboard,
  duplicateCount,
  onOpenDirectory,
  onOpenPerson,
  onReviewDuplicates,
}: {
  state: WorkspaceState
  dashboard: ReturnType<typeof crmDashboard>
  duplicateCount: number
  onOpenDirectory: () => void
  onOpenPerson: (id: string) => void
  onReviewDuplicates: () => void
}) {
  const recent = [...state.people]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 5)
  return (
    <div className="flex flex-col gap-8">
      <StatGrid
        stats={[
          { label: 'Contacts', value: dashboard.totalContacts },
          { label: 'Events', value: dashboard.eventCount },
          { label: 'Returning speakers', value: dashboard.returningSpeakers },
          { label: 'Active prospects', value: dashboard.pipelineProspects },
        ]}
      />
      <div className="grid gap-8 lg:grid-cols-2">
        <div>
          <SectionHeading title="Top companies" />
          <ol className="divide-y divide-zinc-950/5 pt-1">
            {dashboard.topCompanies.map((item, index) => (
              <li key={item.label} className="flex items-center gap-3 py-2.5 text-base sm:text-sm">
                <span className="w-5 tabular-nums text-zinc-400">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate font-medium text-zinc-800">
                  {item.label}
                </span>
                <span className="tabular-nums text-zinc-500">{item.count}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <SectionHeading title="Top tags" />
          <div className="flex flex-wrap gap-2 pt-3">
            {dashboard.topTags.length > 0 ? (
              dashboard.topTags.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-medium text-zinc-700"
                >
                  <TagIcon className="size-3.5 fill-zinc-400" /> {item.label}{' '}
                  <span className="text-zinc-400">{item.count}</span>
                </span>
              ))
            ) : (
              <p className="text-base text-zinc-500 sm:text-sm">
                Add tags to make the directory easier to reuse.
              </p>
            )}
          </div>
        </div>
      </div>
      <div>
        <SectionHeading
          title="Recently updated"
          action={
            <Button size="compact" variant="ghost" onClick={onOpenDirectory}>
              View directory
            </Button>
          }
        />
        <div className="divide-y divide-zinc-950/5">
          {recent.map((person) => (
            <button
              key={person.id}
              type="button"
              className="focus-ring flex w-full items-center gap-3 rounded-lg py-3 text-left hover:bg-zinc-950/2"
              onClick={() => onOpenPerson(person.id)}
            >
              <Avatar src={person.avatarUrl} name={`${person.firstName} ${person.lastName}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                  {person.firstName} {person.lastName}
                </span>
                <span className="block truncate text-base text-zinc-500 sm:text-sm">
                  {[person.title, person.company].filter(Boolean).join(' at ') || person.email}
                </span>
              </span>
              <ArrowRightIcon className="size-4 shrink-0 fill-zinc-400" />
            </button>
          ))}
        </div>
      </div>
      {duplicateCount > 0 ? (
        <button
          type="button"
          className="focus-ring flex items-center justify-between gap-4 rounded-2xl bg-amber-50 px-4 py-3 text-left ring-1 ring-amber-900/10"
          onClick={onReviewDuplicates}
        >
          <span>
            <span className="block font-medium text-amber-950">
              {duplicateCount} possible duplicate{duplicateCount === 1 ? '' : 's'}
            </span>
            <span className="text-base text-amber-800/75 sm:text-sm">
              Review matches before event history splits across profiles.
            </span>
          </span>
          <ArrowRightIcon className="size-4 shrink-0 fill-amber-700" />
        </button>
      ) : null}
    </div>
  )
}

function ContactTable({
  contacts,
  state,
  selectedIds,
  allSelected,
  onToggleAll,
  onToggle,
  onOpen,
}: {
  contacts: Person[]
  state: WorkspaceState
  selectedIds: string[]
  allSelected: boolean
  onToggleAll: () => void
  onToggle: (personId: string) => void
  onOpen: (personId: string) => void
}) {
  if (contacts.length === 0)
    return <EmptyState title="No contacts found" description="Try a different search or filter." />
  return (
    <>
      <div className="divide-y divide-zinc-950/5 sm:hidden">
        <label className="flex items-center gap-3 border-b border-zinc-950/10 py-3 text-sm font-medium text-zinc-500">
          <input
            aria-label="Select visible contacts"
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="size-4 rounded border-zinc-300 text-blue-600"
          />
          Select all {contacts.length}
        </label>
        {contacts.map((person) => {
          const connections = contactConnections(state, person.id)
          return (
            <div key={person.id} className="flex items-start gap-3 py-3">
              <input
                aria-label={`Select ${person.firstName} ${person.lastName}`}
                type="checkbox"
                checked={selectedIds.includes(person.id)}
                onChange={() => onToggle(person.id)}
                className="mt-3 size-4 shrink-0 rounded border-zinc-300 text-blue-600"
              />
              <button
                type="button"
                className="focus-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left"
                onClick={() => onOpen(person.id)}
              >
                <Avatar src={person.avatarUrl} name={`${person.firstName} ${person.lastName}`} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-zinc-950">
                    {person.firstName} {person.lastName}
                  </span>
                  <span className="block truncate text-sm text-zinc-500">
                    {[person.title, person.company].filter(Boolean).join(' at ') || person.email}
                  </span>
                  <span className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-zinc-400">
                    <span className="truncate">{person.email}</span>
                    <span aria-hidden="true">·</span>
                    <span className="shrink-0">
                      {connections.length} {connections.length === 1 ? 'event' : 'events'}
                    </span>
                  </span>
                </span>
                <ArrowRightIcon className="size-4 shrink-0 fill-zinc-400" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[48rem]">
          <thead>
            <tr className="border-b border-zinc-950/10">
              <th className="w-10 py-2.5 pr-3">
                <input
                  aria-label="Select visible contacts"
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="size-4 rounded border-zinc-300 text-blue-600"
                />
              </th>
              {['Contact', 'Company', 'Tags', 'Events', 'Last update'].map((heading) => (
                <th
                  key={heading}
                  className="py-2.5 pr-4 text-left text-sm font-medium text-zinc-500"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-950/5">
            {contacts.map((person) => {
              const connections = contactConnections(state, person.id)
              return (
                <tr key={person.id} className="hover:bg-zinc-950/2">
                  <td className="py-3 pr-3">
                    <input
                      aria-label={`Select ${person.firstName} ${person.lastName}`}
                      type="checkbox"
                      checked={selectedIds.includes(person.id)}
                      onChange={() => onToggle(person.id)}
                      className="size-4 rounded border-zinc-300 text-blue-600"
                    />
                  </td>
                  <td className="py-3 pr-4">
                    <button
                      type="button"
                      className="focus-ring flex items-center gap-3 rounded-lg text-left"
                      onClick={() => onOpen(person.id)}
                    >
                      <Avatar
                        src={person.avatarUrl}
                        name={`${person.firstName} ${person.lastName}`}
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-zinc-950">
                          {person.firstName} {person.lastName}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">{person.email}</span>
                      </span>
                    </button>
                  </td>
                  <td className="py-3 pr-4 text-sm text-zinc-600">
                    <span className="block">{person.company || '—'}</span>
                    <span className="block text-zinc-400">{person.title}</span>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex max-w-56 flex-wrap gap-1">
                      {person.tags.slice(0, 3).map((value) => (
                        <span
                          key={value}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600"
                        >
                          {value}
                        </span>
                      ))}
                      {person.tags.length === 0 ? (
                        <span className="text-sm text-zinc-400">—</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                    {connections.length}
                  </td>
                  <td className="py-3 text-sm text-zinc-500">
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    }).format(new Date(person.updatedAt))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

function PipelineBoard({
  state,
  execute,
  mutating,
  onOpen,
}: {
  state: WorkspaceState
  execute: ExecuteOperation
  mutating: boolean
  onOpen: (personId: string) => void
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
      <div className="grid min-w-[63rem] grid-cols-6 gap-3 pb-2">
        {pipelineStages.map((stage) => {
          const entries = state.speakerPipeline.filter((entry) => entry.stage === stage)
          return (
            <section
              key={stage}
              aria-label={sentenceCase(stage)}
              className="min-h-96 rounded-2xl bg-zinc-50 p-2 ring-1 ring-zinc-950/5"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                const entryId = event.dataTransfer.getData('text/programkit-pipeline')
                const entry = state.speakerPipeline.find((candidate) => candidate.id === entryId)
                if (!entry || entry.stage === stage || mutating) return
                void execute(
                  'crm.pipeline.move',
                  { entryId, stage },
                  { expectedVersions: { [entry.id]: entry.version } },
                  `Moved to ${sentenceCase(stage)}.`,
                )
              }}
            >
              <div className="flex items-center justify-between px-1 py-1.5">
                <h2 className="text-sm font-medium text-zinc-700">{sentenceCase(stage)}</h2>
                <span className="text-xs tabular-nums text-zinc-400">{entries.length}</span>
              </div>
              <div className="flex flex-col gap-2 pt-1">
                {entries.map((entry) => {
                  const person = state.people.find((candidate) => candidate.id === entry.personId)
                  if (!person) return null
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      draggable
                      onDragStart={(event) =>
                        event.dataTransfer.setData('text/programkit-pipeline', entry.id)
                      }
                      onClick={() => onOpen(person.id)}
                      className="focus-ring cursor-grab rounded-xl bg-white p-3 text-left shadow-xs ring-1 ring-zinc-950/8 active:cursor-grabbing"
                    >
                      <span className="block truncate text-sm font-medium text-zinc-950">
                        {person.firstName} {person.lastName}
                      </span>
                      <span className="block truncate text-xs text-zinc-500">
                        {person.title || person.company || person.email}
                      </span>
                      {entry.score !== null ? (
                        <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                          Fit {entry.score}
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function AddContactDialog({
  open,
  onClose,
  execute,
  mutating,
}: {
  open: boolean
  onClose: () => void
  execute: ExecuteOperation
  mutating: boolean
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const response = await execute(
      'person.create',
      {
        firstName: data.get('firstName'),
        lastName: data.get('lastName'),
        email: data.get('email'),
        company: data.get('company'),
        title: data.get('title'),
        addToActiveEvent: false,
      },
      undefined,
      'Contact added.',
    )
    if (response.ok) onClose()
  }
  return (
    <Dialog open={open} onClose={onClose} title="Add contact" footer={null}>
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">First name</span>
            <input name="firstName" required className={textControl} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Last name</span>
            <input name="lastName" required className={textControl} />
          </label>
        </div>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Email</span>
          <input name="email" type="email" required className={textControl} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Company</span>
            <input name="company" className={textControl} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium">Title</span>
            <input name="title" className={textControl} />
          </label>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="submit" variant="primary" disabled={mutating}>
            Add contact
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function ImportContactsDialog({
  open,
  onClose,
  execute,
  mutating,
}: {
  open: boolean
  onClose: () => void
  execute: ExecuteOperation
  mutating: boolean
}) {
  const [rows, setRows] = useState<SpeakerCsvRow[]>([])
  const [error, setError] = useState('')
  const choose = async (file?: File) => {
    if (!file) return
    try {
      setRows(parseSpeakerCsv(await file.text()))
      setError('')
    } catch (caught) {
      setRows([])
      setError(caught instanceof Error ? caught.message : 'The CSV could not be read.')
    }
  }
  const submit = async () => {
    const response = await execute(
      'person.import',
      { people: rows, addToActiveEvent: false },
      undefined,
      `${rows.length} contacts imported.`,
    )
    if (response.ok) {
      setRows([])
      onClose()
    }
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Import contacts"
      description="Use name or first_name and last_name, plus email. Company, title, and bio are optional."
    >
      <div className="grid gap-4">
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void choose(event.target.files?.[0])}
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:font-medium"
        />
        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {rows.length > 0 ? (
          <p className="text-sm text-zinc-600">Ready to import {rows.length} contacts.</p>
        ) : null}
        <div className="flex gap-2">
          <Button
            variant="primary"
            disabled={mutating || rows.length === 0}
            onClick={() => void submit()}
          >
            <ArrowUpTrayIcon className="size-4 h-lh fill-current" />
            Import
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Dialog>
  )
}

function SaveSegmentDialog({
  open,
  onClose,
  execute,
  mutating,
  filters,
  selectedIds,
}: {
  open: boolean
  onClose: () => void
  execute: ExecuteOperation
  mutating: boolean
  filters: { company: string; title: string; tag: string }
  selectedIds: string[]
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const mode = selectedIds.length > 0 ? 'static' : 'dynamic'
    const response = await execute(
      'crm.segment.create',
      { name: data.get('name'), mode, filters, personIds: selectedIds },
      undefined,
      'Segment saved.',
    )
    if (response.ok) onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Save segment"
      description={
        selectedIds.length > 0
          ? `Save the ${selectedIds.length} selected contacts.`
          : 'Save the current company, title, and tag filters.'
      }
    >
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Name</span>
          <input name="name" required autoFocus className={textControl} />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={mutating}>
            Save
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function OutreachDialog({
  open,
  onClose,
  execute,
  mutating,
  people,
}: {
  open: boolean
  onClose: () => void
  execute: ExecuteOperation
  mutating: boolean
  people: Person[]
}) {
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const response = await execute(
      'crm.outreach.queue',
      {
        personIds: people.map((person) => person.id),
        subject: data.get('subject'),
        body: data.get('body'),
      },
      undefined,
      `Outreach queued for ${people.length} ${people.length === 1 ? 'contact' : 'contacts'}.`,
    )
    if (response.ok) onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Email ${people.length} contact${people.length === 1 ? '' : 's'}`}
      description="Use {{first_name}} to personalize each message."
    >
      <form className="grid gap-4" onSubmit={(event) => void submit(event)}>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Subject</span>
          <input name="subject" required className={textControl} />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Message</span>
          <textarea
            name="body"
            required
            rows={7}
            defaultValue={'Hi {{first_name}},\n\n'}
            className={textAreaControl}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="primary" disabled={mutating || people.length === 0}>
            <EnvelopeIcon className="size-4 h-lh fill-current" />
            Queue messages
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Dialog>
  )
}

function DuplicateDialog({
  open,
  onClose,
  execute,
  mutating,
  groups,
}: {
  open: boolean
  onClose: () => void
  execute: ExecuteOperation
  mutating: boolean
  groups: Person[][]
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Possible duplicates"
      description="Merge only when both profiles belong to the same person."
      size="wide"
    >
      <div className="divide-y divide-zinc-950/5">
        {groups.map((group) => (
          <div
            key={group.map((person) => person.id).join(':')}
            className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"
          >
            <div className="flex flex-wrap gap-3">
              {group.map((person) => (
                <div
                  key={person.id}
                  className="rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-zinc-950/5"
                >
                  <p className="text-sm font-medium">
                    {person.firstName} {person.lastName}
                  </p>
                  <p className="text-sm text-zinc-500">{person.email}</p>
                </div>
              ))}
            </div>
            <Button
              size="compact"
              variant="secondary"
              disabled={mutating}
              onClick={() =>
                void execute(
                  'person.merge',
                  { primaryPersonId: group[0].id, duplicatePersonId: group[1].id },
                  undefined,
                  'Contacts merged.',
                )
              }
            >
              <ArrowsRightLeftIcon className="size-4 h-lh fill-current" />
              Merge into {group[0].firstName}
            </Button>
          </div>
        ))}
      </div>
    </Dialog>
  )
}

function ContactDrawer({
  person,
  state,
  execute,
  mutating,
  onClose,
}: {
  person: Person
  state: WorkspaceState
  execute: ExecuteOperation
  mutating: boolean
  onClose: () => void
}) {
  const connections = contactConnections(state, person.id)
  const notes = state.contactNotes.filter((note) => note.personId === person.id)
  const pipeline: SpeakerPipelineEntry | undefined = state.speakerPipeline.find(
    (entry) => entry.personId === person.id,
  )
  const availableEvents = state.events.filter(
    (event) => !connections.some((connection) => connection.event?.id === event.id),
  )
  const saveTags = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await execute(
      'person.update',
      { personId: person.id, tags: String(data.get('tags') ?? '').split(',') },
      { expectedVersions: { [person.id]: person.version } },
      'Tags saved.',
    )
  }
  const addNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    const response = await execute(
      'person.add-note',
      { personId: person.id, body: data.get('body') },
      undefined,
      'Note added.',
    )
    if (response.ok) form.reset()
  }
  const addPipelineNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!pipeline) return
    const form = event.currentTarget
    const data = new FormData(form)
    const response = await execute(
      'crm.pipeline.add-note',
      { entryId: pipeline.id, body: data.get('body') },
      { expectedVersions: { [pipeline.id]: pipeline.version } },
      'Sourcing note added.',
    )
    if (response.ok) form.reset()
  }
  return (
    <Drawer open onClose={onClose} title={`${person.firstName} ${person.lastName}`}>
      <div className="flex flex-col gap-7">
        <div className="flex items-start gap-4">
          <Avatar
            src={person.avatarUrl}
            name={`${person.firstName} ${person.lastName}`}
            size="large"
          />
          <div className="min-w-0">
            <p className="text-lg font-semibold text-zinc-950">
              {person.firstName} {person.lastName}
            </p>
            <p className="text-base text-zinc-500 sm:text-sm">
              {[person.title, person.company].filter(Boolean).join(' at ') || person.email}
            </p>
            <a href={`mailto:${person.email}`} className="text-sm text-blue-600 hover:underline">
              {person.email}
            </a>
          </div>
        </div>
        <form className="grid gap-2" onSubmit={(event) => void saveTags(event)}>
          <label className="text-sm font-medium" htmlFor="crm-tags">
            Tags
          </label>
          <div className="flex gap-2">
            <input
              id="crm-tags"
              name="tags"
              defaultValue={person.tags.join(', ')}
              placeholder="keynote, ai, returning"
              className={cx(textControl, 'min-w-0 flex-1')}
            />
            <Button size="compact" type="submit" disabled={mutating}>
              Save
            </Button>
          </div>
        </form>
        <div>
          <SectionHeading title="Event history" />
          {connections.length > 0 ? (
            <div className="divide-y divide-zinc-950/5">
              {connections.map((connection) => (
                <div key={connection.participation.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium text-zinc-950">
                      {connection.event?.name ?? 'Event'}
                    </p>
                    <span className="text-sm text-zinc-500">
                      {sentenceCase(connection.participation.status)}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500">
                    {connection.sessions.length}{' '}
                    {connection.sessions.length === 1 ? 'session' : 'sessions'} ·{' '}
                    {connection.participation.roles.map(sentenceCase).join(', ')}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="pt-3 text-sm text-zinc-500">Not yet added to an event.</p>
          )}
          {availableEvents.length > 0 ? (
            <form
              className="flex gap-2 pt-3"
              onSubmit={(event) => {
                event.preventDefault()
                const data = new FormData(event.currentTarget)
                void execute(
                  'person.add-to-event',
                  { personId: person.id, eventId: data.get('eventId') },
                  undefined,
                  'Added to event.',
                )
              }}
            >
              <label className="grid min-w-0 flex-1 grid-cols-1">
                <span className="sr-only">Event</span>
                <select name="eventId" className={selectControl}>
                  {availableEvents.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button size="compact" type="submit" disabled={mutating}>
                Add to event
              </Button>
            </form>
          ) : null}
        </div>
        <div>
          <SectionHeading title="Sourcing" />
          {pipeline ? (
            <div className="grid gap-3 pt-3">
              <label className="grid gap-1.5">
                <span className="text-sm font-medium">Stage</span>
                <select
                  value={pipeline.stage}
                  className={selectControl}
                  disabled={mutating}
                  onChange={(event) =>
                    void execute(
                      'crm.pipeline.move',
                      { entryId: pipeline.id, stage: event.target.value },
                      { expectedVersions: { [pipeline.id]: pipeline.version } },
                      'Pipeline stage updated.',
                    )
                  }
                >
                  {pipelineStages.map((stage) => (
                    <option key={stage} value={stage}>
                      {sentenceCase(stage)}
                    </option>
                  ))}
                </select>
              </label>
              {pipeline.rationale ? (
                <p className="text-sm text-zinc-500">{pipeline.rationale}</p>
              ) : null}
              <form className="grid gap-2" onSubmit={(event) => void addPipelineNote(event)}>
                <label className="text-sm font-medium" htmlFor="crm-pipeline-note">
                  Sourcing note
                </label>
                <textarea
                  id="crm-pipeline-note"
                  name="body"
                  required
                  rows={2}
                  placeholder="Add context for the next follow-up"
                  className={textAreaControl}
                />
                <div>
                  <Button size="compact" type="submit" disabled={mutating}>
                    Add note
                  </Button>
                </div>
              </form>
              {pipeline.notes.length > 0 ? (
                <div className="divide-y divide-zinc-950/5 rounded-xl bg-zinc-50 px-3 ring-1 ring-zinc-950/5">
                  {pipeline.notes.map((note) => (
                    <div key={note.id} className="py-3">
                      <p className="whitespace-pre-wrap text-sm text-zinc-700">{note.body}</p>
                      <p className="pt-1 text-xs text-zinc-400">
                        {note.createdBy} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(new Date(note.createdAt))}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}
              <div>
                <p className="text-sm font-medium text-zinc-950">Stage history</p>
                <ol className="mt-2 divide-y divide-zinc-950/5 rounded-xl bg-zinc-50 px-3 ring-1 ring-zinc-950/5">
                  {[...pipeline.history].reverse().map((transition) => (
                    <li
                      key={`${transition.changedAt}:${transition.from ?? 'new'}:${transition.to}`}
                      className="py-3"
                    >
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
                        {transition.from ? (
                          <>
                            <span>{sentenceCase(transition.from)}</span>
                            <ArrowRightIcon className="size-3.5 shrink-0 fill-zinc-400" />
                          </>
                        ) : null}
                        <span>{sentenceCase(transition.to)}</span>
                      </div>
                      <p className="pt-1 text-xs text-zinc-400">
                        {transition.changedBy} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(new Date(transition.changedAt))}
                      </p>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          ) : (
            <Button
              className="mt-3"
              size="compact"
              disabled={mutating}
              onClick={() =>
                void execute(
                  'crm.pipeline.enroll',
                  { personId: person.id, stage: 'identified' },
                  undefined,
                  'Added to the speaker pipeline.',
                )
              }
            >
              Add to pipeline
            </Button>
          )}
        </div>
        <div>
          <SectionHeading title="Notes" />
          <form className="grid gap-2 pt-3" onSubmit={(event) => void addNote(event)}>
            <textarea
              name="body"
              required
              rows={3}
              placeholder="Add a private note"
              className={textAreaControl}
            />
            <div>
              <Button size="compact" type="submit" disabled={mutating}>
                Add note
              </Button>
            </div>
          </form>
          <div className="divide-y divide-zinc-950/5 pt-2">
            {notes.map((note) => (
              <div key={note.id} className="py-3">
                <p className="whitespace-pre-wrap text-sm text-zinc-700">{note.body}</p>
                <p className="pt-1 text-xs text-zinc-400">
                  {note.createdBy} ·{' '}
                  {new Intl.DateTimeFormat('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  }).format(new Date(note.createdAt))}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  )
}
