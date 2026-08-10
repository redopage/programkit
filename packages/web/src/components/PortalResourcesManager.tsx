import {
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  PencilSquareIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import type { PortalResourcePage } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Dialog,
  EmptyState,
  StatusBadge,
  selectControl,
  textAreaControl,
  textControl,
} from './ui.tsx'

interface ResourceDraft {
  title: string
  summary: string
  body: string
  embed: string
  linkUrl: string
  status: PortalResourcePage['status']
}

const emptyDraft: ResourceDraft = {
  title: '',
  summary: '',
  body: '',
  embed: '',
  linkUrl: '',
  status: 'draft',
}

function draftFromResource(resource: PortalResourcePage): ResourceDraft {
  return {
    title: resource.title,
    summary: resource.summary,
    body: resource.body,
    embed: resource.embedUrl,
    linkUrl: resource.linkUrl,
    status: resource.status,
  }
}

function normalizeEmbedUrl(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!trimmed.startsWith('<')) return trimmed
  const document = new DOMParser().parseFromString(trimmed, 'text/html')
  return document.querySelector('iframe')?.getAttribute('src')?.trim() ?? ''
}

export function PortalResourcesManager() {
  const { payload, execute, mutating } = useWorkspace()
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<ResourceDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)
  if (!payload) return null

  const resources = [...(payload.state.portalResourcePages ?? [])]
    .filter((resource) => resource.eventId === payload.state.activeEventId)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const editing = resources.find((resource) => resource.id === editingId)

  function createResource() {
    setEditingId(null)
    setDraft(emptyDraft)
    setError(null)
    setOpen(true)
  }

  function editResource(resource: PortalResourcePage) {
    setEditingId(resource.id)
    setDraft(draftFromResource(resource))
    setError(null)
    setOpen(true)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const embedUrl = normalizeEmbedUrl(draft.embed)
    if (draft.embed.trim() && !embedUrl) {
      setError('Paste an HTTPS embed URL or iframe embed code.')
      return
    }
    const operation = editing ? 'portal-resource.update' : 'portal-resource.create'
    const response = await execute(
      operation,
      {
        ...(editing ? { resourceId: editing.id } : {}),
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        embedUrl,
        linkUrl: draft.linkUrl,
        status: draft.status,
      },
      editing ? { expectedVersions: { [editing.id]: editing.version } } : undefined,
      editing ? 'Speaker resource updated.' : 'Speaker resource created.',
    )
    if (response.ok) setOpen(false)
  }

  return (
    <section aria-labelledby="portal-resources-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 border-b border-zinc-950/5 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="portal-resources-heading" className="text-lg font-semibold text-zinc-950">
            Speaker resources
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Guides, links, and trusted embeds shown in every speaker portal.
          </p>
        </div>
        <Button variant="secondary" size="compact" onClick={createResource}>
          <PlusIcon className="size-4 fill-current" />
          Add resource
        </Button>
      </div>

      {resources.length === 0 ? (
        <EmptyState
          title="No speaker resources yet"
          description="Add a guide, venue note, link, or embedded document for accepted speakers."
          action={
            <Button variant="secondary" onClick={createResource}>
              Add resource
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="flex min-w-0 flex-col gap-4 rounded-2xl p-4 ring-1 ring-zinc-950/10"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="truncate text-sm font-medium text-zinc-950">{resource.title}</p>
                  <StatusBadge status={resource.status} />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-zinc-500">
                  {resource.summary || resource.body || 'Embedded speaker resource'}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  {resource.embedUrl ? (
                    <>
                      <CodeBracketIcon className="size-3.5 fill-zinc-400" /> Embed
                    </>
                  ) : resource.linkUrl ? (
                    <>
                      <ArrowTopRightOnSquareIcon className="size-3.5 fill-zinc-400" /> Link
                    </>
                  ) : (
                    'Guide'
                  )}
                </span>
                <Button size="compact" variant="ghost" onClick={() => editResource(resource)}>
                  <PencilSquareIcon className="size-4 fill-current" />
                  Edit
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Edit speaker resource' : 'Add speaker resource'}
        description="Published resources appear in every speaker portal for this event."
        size="wide"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form="portal-resource-form"
              disabled={mutating || !draft.title.trim()}
            >
              {mutating ? 'Saving…' : 'Save resource'}
            </Button>
          </>
        }
      >
        <form
          id="portal-resource-form"
          className="grid gap-4"
          onSubmit={(event) => void save(event)}
        >
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-950">Title</span>
            <input
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({ ...current, title: event.target.value }))
              }
              className={textControl}
              required
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-950">Summary</span>
            <input
              value={draft.summary}
              onChange={(event) =>
                setDraft((current) => ({ ...current, summary: event.target.value }))
              }
              className={textControl}
              placeholder="One sentence speakers can scan"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-950">Page content</span>
            <textarea
              rows={7}
              value={draft.body}
              onChange={(event) =>
                setDraft((current) => ({ ...current, body: event.target.value }))
              }
              className={textAreaControl}
              placeholder="Arrival details, expectations, instructions, or other speaker guidance"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-zinc-950">Related link</span>
              <input
                type="url"
                value={draft.linkUrl}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, linkUrl: event.target.value }))
                }
                className={textControl}
                placeholder="https://…"
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-sm font-medium text-zinc-950">Status</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    status: event.target.value as PortalResourcePage['status'],
                  }))
                }
                className={selectControl}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </label>
          </div>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-950">Embed</span>
            <textarea
              rows={3}
              value={draft.embed}
              onChange={(event) =>
                setDraft((current) => ({ ...current, embed: event.target.value }))
              }
              className={textAreaControl}
              placeholder="Paste an HTTPS embed URL or iframe code"
            />
            <span className="text-sm text-zinc-500">
              ProgramKit keeps only the secure iframe source and renders it in a sandbox.
            </span>
          </label>
          {error ? (
            <p role="alert" className="text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </section>
  )
}
