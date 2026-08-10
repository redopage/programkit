import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ArrowTopRightOnSquareIcon,
  ClipboardDocumentIcon,
  EnvelopeIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { participationPerson, readinessRows, type Person } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { speakerPortalPath } from '../lib/public-links.ts'
import { parseSpeakerCsv, type SpeakerCsvRow } from '../lib/speaker-csv.ts'
import {
  Avatar,
  Button,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  ProgressBar,
  SearchInput,
  StatusBadge,
  Toolbar,
  cx,
  sentenceCase,
  textControl,
  textAreaControl,
} from '../components/ui.tsx'

type PeopleFilter = 'all' | 'confirmed' | 'unconfirmed' | 'incomplete'

export function PeopleView({ initialPersonId }: { initialPersonId?: string | null }) {
  const { payload, execute, mutating } = useWorkspace()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<PeopleFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(initialPersonId ?? null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
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
        title="People"
        actions={
          <>
            <Button variant="secondary" onClick={() => window.open('/api/v1/export', '_blank')}>
              <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
              Export
            </Button>
            <Button variant="secondary" onClick={() => setImporting(true)}>
              <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
              Import CSV
            </Button>
            <Button variant="primary" onClick={() => setAdding(true)}>
              <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
              Add person
            </Button>
          </>
        }
      />

      <Toolbar>
        <FilterTabs
          label="People views"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'All'],
            ['confirmed', 'Confirmed'],
            ['unconfirmed', 'Awaiting reply'],
            ['incomplete', 'Incomplete'],
          ]}
        />
        <SearchInput
          label="Search people"
          name="people-search"
          placeholder="Search people"
          value={search}
          onChange={setSearch}
        />
      </Toolbar>

      <p className="text-base text-zinc-500 sm:text-sm">
        <span className="font-medium tabular-nums text-zinc-950">{records.length}</span>{' '}
        {records.length === 1 ? 'person' : 'people'} in this view
      </p>

      {records.length === 0 ? (
        <EmptyState title="No people found" description="Try a different search or saved view." />
      ) : (
        <>
          <div className="hidden sm:block">
            <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap">
              <div className="inline-block min-w-full px-6 py-2 align-middle">
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
                              {person.title || person.company ? (
                                <p className="truncate text-sm text-zinc-500">
                                  {[person.title, person.company].filter(Boolean).join(' · ')}
                                </p>
                              ) : null}
                            </div>
                          </button>
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={participation.status} />
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">
                          {sentenceCase(participation.roles.join(', '))}
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
      <ImportSpeakersDrawer
        open={importing}
        onClose={() => setImporting(false)}
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
  const { payload, execute, mutating, refresh } = useWorkspace()
  const [tab, setTab] = useState<'details' | 'requirements' | 'activity'>('details')
  const [editing, setEditing] = useState(false)
  const [copied, setCopied] = useState(false)
  const [inviteDrafted, setInviteDrafted] = useState(false)
  const [uploadingHeadshot, setUploadingHeadshot] = useState(false)
  const [headshotError, setHeadshotError] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    city: '',
    timezone: '',
    bio: '',
  })
  if (!payload || !person) return null
  const currentPerson = person
  const { state } = payload
  const participation = state.participations.find((entry) => entry.personId === person.id)!
  const instances = state.requirementInstances.filter(
    (entry) => entry.participationId === participation.id,
  )
  const headshots = state.assets
    .filter(
      (asset) =>
        asset.kind === 'headshot' && asset.owner.type === 'person' && asset.owner.id === person.id,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
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
  const portalHref = participation.portalAccessKey
    ? speakerPortalPath(state.activeEventId, participation.id, participation.portalAccessKey)
    : null
  const statusOptions = {
    prospect: ['prospect', 'invited', 'confirmed', 'withdrawn'],
    invited: ['invited', 'confirmed', 'declined', 'withdrawn'],
    confirmed: ['confirmed', 'withdrawn'],
    declined: ['declined', 'invited'],
    withdrawn: ['withdrawn', 'invited'],
  }[participation.status]

  function startEditing() {
    setEditForm({
      firstName: currentPerson.firstName,
      lastName: currentPerson.lastName,
      email: currentPerson.email,
      company: currentPerson.company,
      title: currentPerson.title,
      city: currentPerson.city,
      timezone: currentPerson.timezone,
      bio: currentPerson.bio,
    })
    setEditing(true)
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'person.update',
      { personId: currentPerson.id, ...editForm },
      { expectedVersions: { [currentPerson.id]: currentPerson.version } },
      `${editForm.firstName} ${editForm.lastName} updated.`,
    )
    if (response.ok) setEditing(false)
  }

  async function saveLogistics(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const internalNotes = String(new FormData(event.currentTarget).get('internalNotes') ?? '')
    await execute(
      'participation.update-logistics',
      { participationId: participation.id, internalNotes },
      { expectedVersions: { [participation.id]: participation.version } },
      'Travel and logistics saved.',
    )
  }

  async function copyPortalLink() {
    if (!portalHref) return
    await navigator.clipboard.writeText(new URL(portalHref, window.location.origin).toString())
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  async function draftPortalInvite() {
    if (!portalHref) return
    const event = state.events.find((entry) => entry.id === state.activeEventId)
    const portalUrl = new URL(portalHref, window.location.origin).toString()
    const response = await execute(
      'campaign.create-draft',
      {
        name: `Portal invitation: ${currentPerson.firstName} ${currentPerson.lastName}`,
        subject: `Your ${event?.name ?? 'event'} speaker portal`,
        body: `Hi ${currentPerson.firstName},\n\nYour speaker portal is ready. Use this private link to confirm your participation, update your profile, and complete your tasks:\n\n${portalUrl}\n\nPlease keep this link private.`,
        audience: 'custom',
        recipientParticipationIds: [participation.id],
      },
      undefined,
      'Portal invitation drafted in Communications.',
    )
    if (!response.ok) return
    setInviteDrafted(true)
    window.setTimeout(() => setInviteDrafted(false), 1800)
  }

  async function uploadHeadshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const value = new FormData(form).get('file')
    if (!(value instanceof File) || value.size === 0) {
      setHeadshotError('Choose an image to upload.')
      return
    }
    setUploadingHeadshot(true)
    setHeadshotError(null)
    try {
      const body = new FormData()
      body.set('file', value)
      const response = await fetch(
        `/api/v1/people/${encodeURIComponent(currentPerson.id)}/assets/headshot`,
        { method: 'POST', body },
      )
      const result = (await response.json()) as {
        ok?: boolean
        error?: string | { message?: string }
      }
      if (!response.ok || !result.ok) {
        setHeadshotError(
          typeof result.error === 'string'
            ? result.error
            : (result.error?.message ?? 'The headshot could not be uploaded.'),
        )
        return
      }
      form.reset()
      await refresh()
    } catch {
      setHeadshotError('The headshot could not be uploaded. Try again.')
    } finally {
      setUploadingHeadshot(false)
    }
  }

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
            {person.title || person.company ? (
              <p className="text-base text-zinc-500 sm:text-sm">
                {[person.title, person.company].filter(Boolean).join(' at ')}
              </p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <StatusBadge status={participation.status} />
              <label>
                <span className="sr-only">Change speaker status</span>
                <select
                  aria-label="Change speaker status"
                  value={participation.status}
                  disabled={mutating}
                  onChange={(event) =>
                    void execute(
                      'participation.set-status',
                      { participationId: participation.id, status: event.target.value },
                      { expectedVersions: { [participation.id]: participation.version } },
                      `Speaker status changed to ${sentenceCase(event.target.value)}.`,
                    )
                  }
                  className="focus-ring min-h-8 appearance-none rounded-full bg-white px-3 text-sm font-medium text-zinc-700 shadow-xs ring-1 ring-zinc-950/10"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>
                      {sentenceCase(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            size="compact"
            disabled={!portalHref || mutating}
            onClick={() => void draftPortalInvite()}
          >
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            {inviteDrafted ? 'Draft created' : 'Draft portal invite'}
          </Button>
          <Button size="compact" disabled={!portalHref} onClick={() => void copyPortalLink()}>
            <ClipboardDocumentIcon className="size-4 h-lh shrink-0 fill-current" />
            {copied ? 'Copied' : 'Copy portal link'}
          </Button>
          {portalHref ? (
            <a
              href={portalHref}
              target="_blank"
              rel="noreferrer"
              className="touch-target focus-ring inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-700 shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-950/5"
            >
              Open portal
              <ArrowTopRightOnSquareIcon className="size-4 h-lh shrink-0 fill-current" />
            </a>
          ) : (
            <p className="self-center text-sm text-zinc-500">Available after the next save.</p>
          )}
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
                    ? 'border-blue-600 text-zinc-950'
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
            <div className="flex justify-end">
              <Button size="compact" onClick={startEditing}>
                <PencilSquareIcon className="size-4 h-lh shrink-0 fill-current" />
                Edit details
              </Button>
            </div>
            {editing ? (
              <form className="flex flex-col gap-4" onSubmit={(event) => void saveDetails(event)}>
                <div className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['firstName', 'First name'],
                    ['lastName', 'Last name'],
                    ['email', 'Email'],
                    ['title', 'Title'],
                    ['company', 'Company'],
                    ['city', 'City'],
                    ['timezone', 'Time zone'],
                  ].map(([name, label]) => (
                    <label key={name} className="flex flex-col gap-1.5">
                      <span className="text-base font-medium text-zinc-950 sm:text-sm">
                        {label}
                      </span>
                      <input
                        type={name === 'email' ? 'email' : 'text'}
                        required={['firstName', 'lastName', 'email', 'timezone'].includes(name)}
                        value={editForm[name as keyof typeof editForm]}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            [name]: event.target.value,
                          }))
                        }
                        className={textControl}
                      />
                    </label>
                  ))}
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">Public bio</span>
                  <textarea
                    rows={6}
                    value={editForm.bio}
                    onChange={(event) =>
                      setEditForm((current) => ({ ...current, bio: event.target.value }))
                    }
                    className={textAreaControl}
                  />
                </label>
                <div className="flex gap-2">
                  <Button variant="primary" type="submit" disabled={mutating}>
                    Save details
                  </Button>
                  <Button type="button" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <>
                <dl className="grid gap-4 sm:grid-cols-2">
                  {[
                    ['Email', person.email],
                    ['Location', person.city || 'Not provided'],
                    ['Timezone', person.timezone],
                    ['Roles', sentenceCase(participation.roles.join(', '))],
                  ].map(([term, detail]) => (
                    <div key={term}>
                      <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
                      <dd className="text-base text-zinc-500 sm:text-sm">{detail}</dd>
                    </div>
                  ))}
                </dl>
                <div>
                  <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Public bio</h3>
                  <p className="pt-1 text-pretty text-base text-zinc-500 sm:text-sm">
                    {person.bio || 'No bio yet.'}
                  </p>
                </div>
                <form
                  key={`logistics-${participation.id}-${participation.version}`}
                  className="flex flex-col gap-2"
                  onSubmit={(event) => void saveLogistics(event)}
                >
                  <label className="flex flex-col gap-1.5">
                    <span className="text-base font-medium text-zinc-950 sm:text-sm">
                      Travel and logistics
                    </span>
                    <textarea
                      name="internalNotes"
                      rows={4}
                      defaultValue={participation.internalNotes}
                      placeholder="Arrival, accessibility, dietary, or lodging notes"
                      className={textAreaControl}
                    />
                    <span className="text-sm text-zinc-500">
                      Private to the event team. Speakers do not see these notes.
                    </span>
                  </label>
                  <div className="flex justify-start">
                    <Button type="submit" size="compact" disabled={mutating}>
                      Save logistics
                    </Button>
                  </div>
                </form>
                <div>
                  <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Speaker files</h3>
                  <form
                    className="mt-2 flex flex-col gap-2 rounded-2xl bg-zinc-50 p-3 ring-1 ring-zinc-950/5"
                    onSubmit={(event) => void uploadHeadshot(event)}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={currentPerson.avatarUrl}
                        name={`${currentPerson.firstName} ${currentPerson.lastName}`}
                      />
                      <div className="min-w-0 flex-1">
                        <label
                          className="block text-sm font-medium text-zinc-950"
                          htmlFor="headshot-file"
                        >
                          Replace headshot
                        </label>
                        <p className="text-sm text-zinc-500">JPEG, PNG, or WebP up to 8 MB.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        id="headshot-file"
                        name="file"
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="min-w-0 flex-1 text-sm text-zinc-600 file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1.5 file:font-medium file:text-zinc-700 file:shadow-xs file:ring-1 file:ring-zinc-950/10"
                      />
                      <Button type="submit" size="compact" disabled={uploadingHeadshot}>
                        <ArrowUpTrayIcon className="size-4 h-lh shrink-0 fill-current" />
                        {uploadingHeadshot ? 'Uploading' : 'Upload'}
                      </Button>
                    </div>
                    {headshotError ? (
                      <p role="alert" className="text-sm text-red-700">
                        {headshotError}
                      </p>
                    ) : null}
                  </form>
                  {headshots.length > 0 ? (
                    <ul role="list" className="divide-y divide-zinc-950/5 pt-1">
                      {headshots.map((asset) => (
                        <li key={asset.id} className="flex items-center justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <p className="truncate text-base text-zinc-700 sm:text-sm">
                              {asset.filename}
                            </p>
                            <p className="text-sm text-zinc-500">
                              Headshot · {(asset.sizeBytes / 1_000).toFixed(0)} KB ·{' '}
                              {new Intl.DateTimeFormat('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              }).format(new Date(asset.createdAt))}
                            </p>
                          </div>
                          <a
                            href={`/public/v1/assets/${encodeURIComponent(asset.id)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="focus-ring rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/10 hover:bg-zinc-50"
                          >
                            View
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="pt-1 text-base text-zinc-500 sm:text-sm">No files yet.</p>
                  )}
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
              </>
            )}
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
    bio: '',
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
    setForm({ firstName: '', lastName: '', email: '', company: '', title: '', bio: '' })
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
              className={textControl}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Public bio</span>
          <textarea
            name="bio"
            rows={5}
            value={form.bio}
            placeholder="A short biography for the public program"
            onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
            className={textAreaControl}
          />
        </label>
      </form>
    </Drawer>
  )
}

function ImportSpeakersDrawer({
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
  const [rows, setRows] = useState<SpeakerCsvRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')

  async function chooseFile(file: File | undefined) {
    if (!file) return
    try {
      const parsed = parseSpeakerCsv(await file.text())
      setRows(parsed)
      setFileName(file.name)
      setError('')
    } catch (caught) {
      setRows([])
      setFileName(file.name)
      setError(caught instanceof Error ? caught.message : 'The CSV could not be read.')
    }
  }

  async function importRows() {
    const response = await execute(
      'person.import',
      { people: rows },
      undefined,
      `${rows.length} speaker${rows.length === 1 ? '' : 's'} imported.`,
    )
    if (!response.ok) return
    setRows([])
    setFileName('')
    setError('')
    onClose()
  }

  function close() {
    setRows([])
    setFileName('')
    setError('')
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={close}
      title="Import speakers"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={mutating || rows.length === 0}
            onClick={() => void importRows()}
          >
            Import {rows.length > 0 ? rows.length : ''}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          Choose a CSV with name, email, title, company, and bio columns. Existing email addresses
          are skipped.
        </p>
        <label className="focus-ring flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-zinc-950/15 bg-zinc-950/2 p-6 text-center hover:bg-zinc-950/4">
          <ArrowUpTrayIcon className="size-5 fill-zinc-500" />
          <span className="text-base font-medium text-zinc-950 sm:text-sm">
            {fileName || 'Choose a CSV file'}
          </span>
          <span className="text-base text-zinc-500 sm:text-sm">Up to 500 people</span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
        </label>
        {error ? (
          <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        {rows.length > 0 ? (
          <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-950/10">
            <div className="flex items-center justify-between bg-zinc-950/2 px-4 py-3">
              <p className="text-sm font-medium text-zinc-950">Preview</p>
              <p className="text-sm tabular-nums text-zinc-500">{rows.length} people</p>
            </div>
            <ul role="list" className="max-h-80 divide-y divide-zinc-950/5 overflow-y-auto">
              {rows.slice(0, 20).map((row) => (
                <li key={row.email} className="px-4 py-3">
                  <p className="text-sm font-medium text-zinc-950">
                    {row.firstName} {row.lastName}
                  </p>
                  <p className="truncate text-sm text-zinc-500">
                    {row.email}
                    {row.company ? ` · ${row.company}` : ''}
                  </p>
                </li>
              ))}
            </ul>
            {rows.length > 20 ? (
              <p className="border-t border-zinc-950/5 px-4 py-3 text-sm text-zinc-500">
                And {rows.length - 20} more
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}
