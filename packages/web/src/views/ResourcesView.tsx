import {
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
  DocumentTextIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useState, type FormEvent } from 'react'

import type { PortalResource, PortalResourceKind } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Callout, PageHeader, cx, textAreaControl, textControl } from '../components/ui.tsx'

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
        description="Publish practical guides and safe HTML cards into every speaker workspace."
        actions={
          <Button variant="primary" onClick={() => choose(null)}>
            <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
            New resource
          </Button>
        }
      />

      <section aria-label="Resource status" className="grid gap-3 sm:grid-cols-3">
        {[
          ['Resources', resources.length],
          ['Published', published],
          ['Drafts', resources.length - published],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-950/5">
            <p className="text-sm text-zinc-500">{label}</p>
            <p className="pt-1 text-2xl font-semibold tabular-nums text-zinc-950">{value}</p>
          </div>
        ))}
      </section>

      <Callout tone="info" title="Walkthrough surfaces">
        <p>
          Published resources appear in the speaker portal. The public speaker gallery and personal
          itinerary are isolated, read-only embeds.
        </p>
        <div className="flex flex-wrap gap-4 pt-3">
          {[
            ['/portal/par_003#resources', 'Speaker portal'],
            ['/embed/speakers', 'Speaker gallery'],
            ['/embed/itinerary', 'Schedule itinerary'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-md font-medium text-blue-700 hover:text-blue-900"
            >
              {label}
              <ArrowTopRightOnSquareIcon className="size-4 h-lh fill-current" />
            </a>
          ))}
        </div>
      </Callout>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.5fr)]">
        <section aria-labelledby="resource-list-heading" className="min-w-0">
          <h2 id="resource-list-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Resource library
          </h2>
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
            <p className="text-base text-zinc-500 sm:text-sm">
              HTML cards allow only static text structure and render in a sandbox without scripts,
              links, forms, images, or attributes.
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

            {form.kind === 'guide' ? (
              <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
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
            ) : (
              <label className="flex min-w-0 flex-col gap-1.5 sm:col-span-2">
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
