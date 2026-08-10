import {
  ArrowTopRightOnSquareIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlusIcon,
  UserGroupIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useState, type FormEvent } from 'react'

import type { PortalResource, PortalResourceKind } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  EmptyState,
  PageHeader,
  cx,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

interface ResourceForm {
  title: string
  summary: string
  kind: PortalResourceKind
  body: string
  embedHtml: string
  sortOrder: number
}

const emptyForm: ResourceForm = {
  title: '',
  summary: '',
  kind: 'guide',
  body: '',
  embedHtml: '',
  sortOrder: 30,
}

function formFor(resource: PortalResource): ResourceForm {
  return {
    title: resource.title,
    summary: resource.summary,
    kind: resource.kind,
    body: resource.body,
    embedHtml: resource.embedHtml ?? '',
    sortOrder: resource.sortOrder,
  }
}

export function ResourcesView() {
  const { payload, execute, mutating } = useWorkspace()
  const resources = [...(payload?.state.portalResources ?? [])].sort(
    (left, right) => left.sortOrder - right.sortOrder,
  )
  const initialHash = typeof window === 'undefined' ? '' : window.location.hash.slice(1)
  const [resourceId, setResourceId] = useState<string | null>(
    resources.some((entry) => entry.id === initialHash) ? initialHash : (resources[0]?.id ?? null),
  )
  const selected = resources.find((entry) => entry.id === resourceId) ?? null
  const [form, setForm] = useState<ResourceForm>(selected ? formFor(selected) : emptyForm)

  useEffect(() => {
    setForm(selected ? formFor(selected) : emptyForm)
  }, [selected?.id, selected?.version])

  if (!payload) return null
  const event = payload.state.events.find((entry) => entry.id === payload.state.activeEventId)!
  const published = resources.filter((entry) => entry.status === 'published').length

  function choose(nextId: string | null) {
    setResourceId(nextId)
    window.history.replaceState(null, '', nextId ? `#${nextId}` : '#new')
  }

  async function save(status: PortalResource['status']) {
    const response = await execute(
      'portal-resource.save',
      {
        resourceId: selected?.id,
        eventId: event.id,
        ...form,
        status,
      },
      selected ? { expectedVersions: { [selected.id]: selected.version } } : undefined,
      status === 'published' ? 'Speaker resource published.' : 'Speaker resource saved as a draft.',
    )
    const saved = (response.data as { resource?: PortalResource } | undefined)?.resource
    if (response.ok && saved) choose(saved.id)
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void save(selected?.status ?? 'draft')
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Speaker resources"
        description="Publish guides and safe HTML cards into each speaker’s workspace."
        actions={
          <Button variant="primary" onClick={() => choose(null)}>
            <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
            New resource
          </Button>
        }
      />

      {/* The three numbers answer the only status question this page has: what
          speakers can read today, and what is still ours alone. */}
      <section aria-label="Resource status" className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Resources', value: resources.length, detail: 'In this library' },
          { label: 'Published', value: published, detail: 'Readable in the speaker portal' },
          {
            label: 'Drafts',
            value: resources.length - published,
            detail: 'Visible to the program team only',
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-950/5"
          >
            <p className="text-sm text-zinc-500">{stat.label}</p>
            <p className="pt-1 text-2xl font-semibold tabular-nums text-zinc-950">{stat.value}</p>
            <p className="text-pretty text-sm text-zinc-500">{stat.detail}</p>
          </div>
        ))}
      </section>

      {/* Each destination states what it reads, so nobody has to guess whether
          publishing here changes the public program. It does not. */}
      <section aria-labelledby="destinations-heading" className="min-w-0">
        <h2 id="destinations-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
          Where this shows up
        </h2>
        <p className="max-w-2xl text-pretty text-base text-zinc-500 sm:text-sm">
          A speaker only ever receives published resources for the event they are speaking at.
        </p>
        <ul role="list" className="grid gap-3 pt-3 sm:grid-cols-3">
          {[
            {
              href: '/portal/par_003#resources',
              label: 'Speaker portal',
              detail: 'Published resources, in one speaker’s workspace.',
              Icon: BookOpenIcon,
            },
            {
              href: '/embed/speakers',
              label: 'Speaker gallery',
              detail: 'Public embed of speakers on the published program.',
              Icon: UserGroupIcon,
            },
            {
              href: '/embed/itinerary',
              label: 'Schedule itinerary',
              detail: 'Public embed of the published schedule. Saves stay on the visitor’s device.',
              Icon: CalendarDaysIcon,
            },
          ].map((destination) => (
            <li key={destination.href} className="min-w-0">
              <a
                href={destination.href}
                className="focus-ring flex h-full min-h-14 min-w-0 items-start gap-3 rounded-xl p-4 ring-1 ring-inset ring-zinc-950/10 hover:bg-zinc-50"
              >
                <destination.Icon className="mt-0.5 size-4 h-lh shrink-0 fill-blue-600" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-base font-medium text-zinc-950 sm:text-sm">
                    {destination.label}
                    <ArrowTopRightOnSquareIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
                  </span>
                  <span className="block text-pretty text-sm text-zinc-500">
                    {destination.detail}
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.5fr)]">
        <section aria-labelledby="resource-list-heading" className="min-w-0">
          <h2 id="resource-list-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Resource library
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Pick a resource to edit, or start a new one.
          </p>
          {resources.length === 0 ? (
            <EmptyState
              title="No resources yet"
              description="Write a guide or a safe HTML card, then publish it to the speaker portal."
            />
          ) : (
            <ul role="list" className="mt-3 divide-y divide-zinc-950/5 border-y border-zinc-950/5">
              {resources.map((resource) => {
                const Icon = resource.kind === 'guide' ? DocumentTextIcon : CodeBracketIcon
                return (
                  <li key={resource.id}>
                    <a
                      href={`#${resource.id}`}
                      aria-current={selected?.id === resource.id ? 'page' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        choose(resource.id)
                      }}
                      className={cx(
                        'focus-ring flex min-h-14 items-center gap-3 rounded-lg px-3 py-3',
                        selected?.id === resource.id ? 'bg-blue-50' : 'hover:bg-zinc-50',
                      )}
                    >
                      <Icon className="size-4 h-lh shrink-0 fill-zinc-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                          {resource.title}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">
                          Order {resource.sortOrder}
                        </span>
                      </span>
                      <span
                        className={cx(
                          'rounded-full px-2 py-0.5 text-sm font-medium ring-1 ring-inset',
                          resource.status === 'published'
                            ? 'bg-emerald-50 text-emerald-700 ring-emerald-700/10'
                            : 'bg-zinc-100 text-zinc-600 ring-zinc-950/10',
                        )}
                      >
                        {resource.status === 'published' ? 'Published' : 'Draft'}
                      </span>
                    </a>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <form
          aria-labelledby="resource-editor-heading"
          className="min-w-0 rounded-2xl p-5 ring-1 ring-zinc-950/10 sm:p-6"
          onSubmit={submit}
        >
          <div className="border-b border-zinc-950/5 pb-4">
            <h2 id="resource-editor-heading" className="text-lg font-semibold text-zinc-950">
              {selected ? 'Edit resource' : 'New resource'}
            </h2>
            {/* The next action is different for a live resource than for a
                draft, so the panel says which one is in front of you. */}
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              {selected
                ? selected.status === 'published'
                  ? 'Speakers can read this now. Publish again to send your changes.'
                  : 'A draft stays with the program team until you publish it.'
                : 'Save a draft to keep working, or publish to put it in the speaker portal.'}
            </p>
          </div>

          <div className="grid gap-4 pt-5 sm:grid-cols-2">
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">Title</span>
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                className={textControl}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">Summary</span>
              <input
                required
                maxLength={240}
                value={form.summary}
                onChange={(event) =>
                  setForm((current) => ({ ...current, summary: event.target.value }))
                }
                className={textControl}
              />
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">Format</span>
              <select
                value={form.kind}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    kind: event.target.value as PortalResourceKind,
                  }))
                }
                className={textControl}
              >
                <option value="guide">Guide</option>
                <option value="html_embed">Safe HTML card</option>
              </select>
            </label>
            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">Display order</span>
              <input
                type="number"
                min={0}
                max={10000}
                step={1}
                value={form.sortOrder}
                onChange={(event) =>
                  setForm((current) => ({ ...current, sortOrder: Number(event.target.value) }))
                }
                className={textControl}
              />
            </label>

            {/* Hints sit beside the label rather than inside it, so the long
                safety note never becomes the field's accessible name. */}
            {form.kind === 'guide' ? (
              <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">
                    Guide content
                  </span>
                  <textarea
                    required
                    rows={12}
                    maxLength={12000}
                    value={form.body}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, body: event.target.value }))
                    }
                    className={textAreaControl}
                  />
                </label>
                <p className="text-pretty text-sm text-zinc-500">
                  A blank line starts a new section in the portal, and each section’s first line
                  becomes its heading.
                </p>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
                <label className="flex min-w-0 flex-col gap-1.5">
                  <span className="text-base font-medium text-zinc-950 sm:text-sm">HTML</span>
                  <textarea
                    required
                    rows={12}
                    maxLength={12000}
                    spellCheck={false}
                    value={form.embedHtml}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, embedHtml: event.target.value }))
                    }
                    className={cx(textAreaControl, 'font-mono text-sm')}
                  />
                </label>
                <p className="text-pretty text-sm text-zinc-500">
                  Headings, paragraphs, lists, quotes, and code only — no attributes, links, images,
                  forms, or scripts. The card renders inside a sandboxed frame, never in the page
                  around it.
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              disabled={mutating}
              onClick={() => void save('draft')}
            >
              Save draft
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={mutating}
              onClick={() => void save('published')}
            >
              Publish resource
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
