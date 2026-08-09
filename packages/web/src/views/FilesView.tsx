import { ArrowDownTrayIcon, ChatBubbleLeftRightIcon, DocumentIcon } from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import type { Asset, WorkspaceState } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Drawer,
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  StatusBadge,
  Toolbar,
  textControl,
} from '../components/ui.tsx'

type FileFilter = 'all' | 'review' | 'approved'

export function FilesView() {
  const { payload, execute, mutating } = useWorkspace()
  const [filter, setFilter] = useState<FileFilter>('all')
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [openRequirementId, setOpenRequirementId] = useState<string | null>(null)
  const [comment, setComment] = useState('')
  if (!payload) return null
  const { state } = payload
  const latestAssets = state.assets.filter(
    (asset) => asset.owner.type === 'requirement' && asset.isLatest !== false,
  )
  const query = search.trim().toLowerCase()
  const rows = latestAssets
    .map((asset) => fileContext(state, asset))
    .filter((row) => {
      if (filter === 'review' && row.instance?.status !== 'submitted') return false
      if (filter === 'approved' && row.instance?.status !== 'approved') return false
      return !query || row.searchable.includes(query)
    })
  const selectedSet = new Set(selectedIds)
  const exportIds = selectedIds.length > 0 ? selectedIds : latestAssets.map((asset) => asset.id)
  const openAssets = openRequirementId
    ? state.assets
        .filter(
          (asset) => asset.owner.type === 'requirement' && asset.owner.id === openRequirementId,
        )
        .sort((left, right) => (right.version ?? 1) - (left.version ?? 1))
    : []
  const openContext = openAssets[0] ? fileContext(state, openAssets[0]) : null
  const openAssetIds = new Set(openAssets.map((asset) => asset.id))
  const comments = (state.assetComments ?? [])
    .filter((entry) => openAssetIds.has(entry.assetId))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt))

  function toggleAsset(assetId: string) {
    setSelectedIds((current) =>
      current.includes(assetId) ? current.filter((id) => id !== assetId) : [...current, assetId],
    )
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const latest = openAssets.find((asset) => asset.isLatest) ?? openAssets[0]
    if (!latest || !comment.trim()) return
    const response = await execute(
      'asset.comment',
      { assetId: latest.id, body: comment.trim() },
      undefined,
      'Reply added.',
    )
    if (response.ok) setComment('')
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Files"
        actions={
          latestAssets.length > 0 ? (
            <a
              href={`/api/v1/assets/export?ids=${encodeURIComponent(exportIds.join(','))}`}
              className="focus-ring inline-flex min-h-10 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm hover:bg-zinc-800"
            >
              <ArrowDownTrayIcon className="size-4 fill-current" />
              {selectedIds.length > 0
                ? `Export selected (${selectedIds.length})`
                : 'Export latest versions'}
            </a>
          ) : null
        }
      />

      <Toolbar>
        <FilterTabs
          label="File status"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', `All ${latestAssets.length}`],
            [
              'review',
              `Awaiting review ${latestAssets.filter((asset) => fileContext(state, asset).instance?.status === 'submitted').length}`,
            ],
            [
              'approved',
              `Approved ${latestAssets.filter((asset) => fileContext(state, asset).instance?.status === 'approved').length}`,
            ],
          ]}
        />
        <SearchInput
          label="Search files"
          name="file-search"
          value={search}
          onChange={setSearch}
          placeholder="Search files or speakers"
        />
      </Toolbar>

      {rows.length === 0 ? (
        <EmptyState
          title={latestAssets.length === 0 ? 'No files yet' : 'No files match this view'}
          description={
            latestAssets.length === 0
              ? 'Create a file request from Tasks. Speaker uploads will appear here with version history.'
              : 'Try a different search or status.'
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl ring-1 ring-zinc-950/10">
          <table className="w-full min-w-3xl">
            <thead className="bg-zinc-50">
              <tr className="border-b border-zinc-950/10">
                <th className="w-12 px-4 py-3 text-left">
                  <span className="sr-only">Select</span>
                </th>
                {['File', 'Speaker', 'Session', 'Uploaded', 'Status'].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="px-3 py-3 text-left text-sm font-medium text-zinc-500 last:pr-4"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-950/5">
              {rows.map((row) => (
                <tr key={row.asset.id} className="hover:bg-zinc-950/2">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.asset.filename}`}
                      checked={selectedSet.has(row.asset.id)}
                      onChange={() => toggleAsset(row.asset.id)}
                      className="size-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-3">
                    <button
                      type="button"
                      className="focus-ring flex min-w-0 items-center gap-3 rounded-lg text-left"
                      onClick={() => setOpenRequirementId(row.asset.owner.id)}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
                        <DocumentIcon className="size-4 fill-current" />
                      </span>
                      <span className="min-w-0">
                        <span className="block max-w-xs truncate text-sm font-medium text-zinc-950">
                          {row.asset.filename}
                        </span>
                        <span className="block text-sm text-zinc-500">
                          {row.definition?.label ?? 'File'} · {row.versionCount}{' '}
                          {row.versionCount === 1 ? 'version' : 'versions'}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3 text-sm text-zinc-700">{row.personName}</td>
                  <td className="max-w-xs truncate px-3 py-3 text-sm text-zinc-600">
                    {row.session?.title ?? 'Event-wide'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-sm text-zinc-500">
                    {new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    }).format(new Date(row.asset.createdAt))}
                  </td>
                  <td className="px-3 py-3 pr-4">
                    {row.instance ? <StatusBadge status={row.instance.status} /> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Drawer
        open={Boolean(openContext)}
        onClose={() => setOpenRequirementId(null)}
        title={openContext?.definition?.label ?? 'File details'}
      >
        {openContext ? (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-zinc-950">{openContext.personName}</p>
              <p className="text-sm text-zinc-500">
                {openContext.session?.title ?? 'Event-wide task'}
              </p>
            </div>
            {openContext.instance ? (
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={openContext.instance.status} />
                {openContext.instance.status === 'submitted' ? (
                  <>
                    <Button
                      size="compact"
                      disabled={mutating}
                      onClick={() =>
                        void execute(
                          'requirement.set-status',
                          {
                            requirementInstanceId: openContext.instance!.id,
                            status: 'approved',
                          },
                          {
                            expectedVersions: {
                              [openContext.instance!.id]: openContext.instance!.version,
                            },
                          },
                          'File approved.',
                        )
                      }
                    >
                      Approve
                    </Button>
                    <Button
                      size="compact"
                      variant="secondary"
                      disabled={mutating}
                      onClick={() =>
                        void execute(
                          'requirement.set-status',
                          {
                            requirementInstanceId: openContext.instance!.id,
                            status: 'revision_requested',
                          },
                          {
                            expectedVersions: {
                              [openContext.instance!.id]: openContext.instance!.version,
                            },
                          },
                          'Revision requested.',
                        )
                      }
                    >
                      Request revision
                    </Button>
                  </>
                ) : null}
              </div>
            ) : null}
            <section>
              <h3 className="text-sm font-semibold text-zinc-950">Version history</h3>
              <ul className="mt-2 divide-y divide-zinc-950/5 overflow-hidden rounded-2xl ring-1 ring-zinc-950/10">
                {openAssets.map((asset) => (
                  <li key={asset.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {asset.filename}{' '}
                        {asset.isLatest ? (
                          <span className="ml-1 text-xs font-medium text-blue-600">Latest</span>
                        ) : null}
                      </p>
                      <p className="text-sm text-zinc-500">
                        Version {asset.version ?? 1} · {(asset.sizeBytes / 1_000_000).toFixed(1)} MB
                      </p>
                    </div>
                    <a
                      href={`/api/v1/assets/${encodeURIComponent(asset.id)}`}
                      className="focus-ring rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/10 hover:bg-zinc-50"
                    >
                      Download
                    </a>
                  </li>
                ))}
              </ul>
            </section>
            <section className="flex flex-col gap-3">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-950">
                <ChatBubbleLeftRightIcon className="size-4 fill-zinc-400" />
                Comments
              </h3>
              {comments.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {comments.map((entry) => (
                    <li key={entry.id} className="rounded-xl bg-zinc-50 px-3 py-2">
                      <p className="text-sm text-zinc-700">{entry.body}</p>
                      <p className="pt-1 text-xs text-zinc-500">
                        {entry.author.name} ·{' '}
                        {new Intl.DateTimeFormat('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        }).format(new Date(entry.createdAt))}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No comments yet.</p>
              )}
              <form className="flex gap-2" onSubmit={(event) => void submitComment(event)}>
                <input
                  type="text"
                  aria-label="Reply to file thread"
                  placeholder="Reply to the speaker"
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  className={textControl}
                />
                <Button type="submit" size="compact" disabled={mutating || !comment.trim()}>
                  Reply
                </Button>
              </form>
            </section>
          </div>
        ) : null}
      </Drawer>
    </div>
  )
}

function fileContext(state: WorkspaceState, asset: Asset) {
  const instance =
    asset.owner.type === 'requirement'
      ? state.requirementInstances.find((entry) => entry.id === asset.owner.id)
      : undefined
  const definition = instance
    ? state.requirementDefinitions.find((entry) => entry.id === instance.definitionId)
    : undefined
  const participation = instance
    ? state.participations.find((entry) => entry.id === instance.participationId)
    : undefined
  const person = participation
    ? state.people.find((entry) => entry.id === participation.personId)
    : undefined
  const session = definition?.sessionId
    ? state.sessions.find((entry) => entry.id === definition.sessionId)
    : undefined
  const personName = person ? `${person.firstName} ${person.lastName}` : 'Unknown speaker'
  const versionCount = state.assets.filter(
    (entry) => entry.owner.type === 'requirement' && entry.owner.id === asset.owner.id,
  ).length
  return {
    asset,
    instance,
    definition,
    participation,
    person,
    personName,
    session,
    versionCount,
    searchable:
      `${asset.filename} ${definition?.label ?? ''} ${personName} ${session?.title ?? ''}`.toLowerCase(),
  }
}
