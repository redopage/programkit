import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  TableCellsIcon,
} from '@heroicons/react/16/solid'
import { useState } from 'react'

import { acceleventsExportPreflight } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Callout, PageHeader, cx, sentenceCase, textControl } from '../components/ui.tsx'

export function IntegrationsView() {
  const { payload, execute, mutating } = useWorkspace()
  const eventSlug = payload?.state.events.find(
    (event) => event.id === payload.state.activeEventId,
  )?.slug
  const [eventUrl, setEventUrl] = useState<string | null>(null)
  const effectiveEventUrl = eventUrl ?? eventSlug ?? ''
  if (!payload) return null
  const { state } = payload
  const airtable = state.integrations.find((integration) => integration.kind === 'airtable')
  const accelevents = state.integrations.find((integration) => integration.kind === 'accelevents')
  const connections = state.integrations.filter(
    (integration) => integration.kind !== 'airtable' && integration.kind !== 'accelevents',
  )
  const acceleventsPreflight = acceleventsExportPreflight(state)
  const latestAcceleventsExport = state.acceleventsExports[0]
  const matchingAcceleventsExport = state.acceleventsExports.find(
    (entry) =>
      entry.scheduleReleaseId === acceleventsPreflight.release?.id &&
      entry.eventUrl === effectiveEventUrl.trim().toLowerCase(),
  )
  const exportCounts = latestAcceleventsExport
    ? {
        speakers: latestAcceleventsExport.items.filter((item) => item.resource === 'speaker')
          .length,
        sessions: latestAcceleventsExport.items.filter((item) => item.resource === 'session')
          .length,
        pending: latestAcceleventsExport.items.filter((item) => item.status === 'pending_provider')
          .length,
        delivered: latestAcceleventsExport.items.filter((item) => item.status === 'delivered')
          .length,
        failed: latestAcceleventsExport.items.filter((item) => item.status === 'failed').length,
        attempts: latestAcceleventsExport.items.reduce(
          (total, item) => total + item.attemptCount,
          0,
        ),
      }
    : null

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Infrastructure & integrations"
        description="Keep ProgramKit authoritative while delivery services work from durable, reviewable outboxes."
        actions={
          <Button variant="secondary" onClick={() => window.open('/api/v1/export', '_blank')}>
            <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
            Download full export
          </Button>
        }
      />

      <section aria-labelledby="deployment-heading">
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 id="deployment-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Deployment shape
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Cloudflare is the supported host. Airtable is an optional, conflict-aware team view; the
            event workspace remains authoritative.
          </p>
        </div>

        <div className="@container pt-5">
          <div className="grid gap-4 @4xl:grid-cols-2">
            <article className="relative overflow-hidden rounded-2xl bg-zinc-950 p-5 text-white sm:p-6">
              <div
                aria-hidden="true"
                className="absolute -right-16 -top-20 size-52 rounded-full bg-blue-400/15 blur-3xl"
              />
              <div className="relative flex h-full flex-col justify-between gap-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <CloudIcon className="size-4 h-lh shrink-0 fill-blue-300" />
                    <div className="min-w-0">
                      <p className="text-base font-medium text-zinc-400 sm:text-sm">
                        Primary runtime
                      </p>
                      <h3 className="text-balance text-lg font-semibold">Cloudflare</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-sm font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
                    Active
                  </span>
                </div>

                <p className="max-w-xl text-pretty text-base text-zinc-300 sm:text-sm">
                  The web app, API, and atomic event workspace deploy together. Organizer actions do
                  not wait on a third-party database round trip.
                </p>

                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Worker', 'App + API'],
                    ['SQLite DO', 'Source of truth'],
                    ['Static Assets', 'Vite build'],
                  ].map(([term, detail]) => (
                    <div key={term} className="min-w-0">
                      <dt className="truncate text-base font-semibold text-white sm:text-sm">
                        {term}
                      </dt>
                      <dd className="text-base text-zinc-400 sm:text-sm">{detail}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </article>

            <article className="rounded-2xl bg-violet-50/70 p-5 ring-1 ring-inset ring-violet-950/10 sm:p-6">
              <div className="flex h-full flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-3">
                    <TableCellsIcon className="size-4 h-lh shrink-0 fill-violet-700" />
                    <div className="min-w-0">
                      <p className="text-base font-medium text-violet-700/70 sm:text-sm">
                        Team workspace
                      </p>
                      <h3 className="text-balance text-lg font-semibold text-zinc-950">Airtable</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-950/10">
                    {airtable?.status === 'connected' ? 'Connected' : 'Optional'}
                  </span>
                </div>

                <p className="text-pretty text-base text-zinc-600 sm:text-sm">
                  Let program teams work in familiar tables. Safe inbound edits become validated
                  proposals; concurrent edits wait in a reconciliation queue.
                </p>

                <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-zinc-700 sm:text-sm">
                  <span className="rounded-lg bg-zinc-950 px-2.5 py-1.5 text-white">
                    ProgramKit
                  </span>
                  <ArrowRightIcon className="size-4 h-lh shrink-0 rotate-180 fill-violet-500" />
                  <ArrowRightIcon className="size-4 h-lh shrink-0 fill-violet-500" />
                  <span className="rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-inset ring-violet-950/10">
                    Airtable
                  </span>
                  <span className="font-normal text-zinc-500">Reconciled after commit</span>
                </div>

                <div className="flex flex-wrap gap-1.5" aria-label="Mirrored tables">
                  {['Submissions', 'Speakers', 'Sessions', 'Tasks'].map((table) => (
                    <span
                      key={table}
                      className="rounded-md bg-violet-100/70 px-2 py-1 text-sm font-medium text-violet-950"
                    >
                      {table}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          </div>
        </div>

        <div className="pt-4">
          <Callout tone="success" title="Why this stays fast">
            <p>
              Writes commit locally in the event workspace; Airtable sync runs afterward with
              retries and never blocks the UI.
            </p>
          </Callout>
        </div>
      </section>

      <section aria-labelledby="accelevents-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-b border-zinc-950/5 pb-2">
          <div className="min-w-0">
            <h2 id="accelevents-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Accelevents export
            </h2>
            <p className="max-w-3xl text-pretty text-base text-zinc-500 sm:text-sm">
              Freeze the latest published speakers and sessions into a one-way delivery batch. No
              API request leaves ProgramKit until a credentialed consumer is connected.
            </p>
          </div>
          <span
            className={cx(
              'rounded-full px-2.5 py-1 text-sm font-semibold ring-1 ring-inset',
              accelevents?.status === 'connected' &&
                'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
              accelevents?.status === 'attention' && 'bg-amber-50 text-amber-700 ring-amber-700/10',
              (!accelevents || accelevents.status === 'not_configured') &&
                'bg-zinc-100 text-zinc-600 ring-zinc-950/10',
            )}
          >
            {accelevents ? sentenceCase(accelevents.status) : 'Not configured'}
          </span>
        </div>

        <Callout
          tone={
            acceleventsPreflight.blockers.length > 0
              ? 'danger'
              : acceleventsPreflight.warnings.length > 0
                ? 'warning'
                : 'success'
          }
          title={
            acceleventsPreflight.blockers.length > 0
              ? 'The published program is not ready to export'
              : `Published schedule version ${acceleventsPreflight.release?.version ?? 'none'} is ready`
          }
        >
          <p>
            {acceleventsPreflight.blockers[0] ??
              acceleventsPreflight.warnings[0] ??
              `${acceleventsPreflight.people.length} speakers and ${acceleventsPreflight.sessions.length} sessions pass the mapping preflight.`}
          </p>
        </Callout>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(20rem,0.8fr)]">
          <div className="min-w-0">
            <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Field mapping</h3>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              Stable ProgramKit IDs become external keys so the provider consumer can upsert instead
              of duplicating records.
            </p>
            <dl className="mt-3 divide-y divide-zinc-950/5 border-y border-zinc-950/5">
              {[
                ['Speaker', 'Name, email, title, company, bio, image, moderator role'],
                ['Session', 'Title, description, local start/end, room, format, capacity, track'],
                [
                  'Relationships',
                  'Session speaker keys reference the speaker records in this batch',
                ],
                ['Source', 'Latest immutable schedule release only; draft changes are excluded'],
              ].map(([term, detail]) => (
                <div key={term} className="grid gap-1 py-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
                  <dd className="text-pretty text-base text-zinc-500 sm:text-sm">{detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <form
            className="flex min-w-0 flex-col gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-inset ring-zinc-950/5"
            onSubmit={(event) => {
              event.preventDefault()
              void execute(
                'accelevents.prepare-export',
                { eventUrl: effectiveEventUrl },
                undefined,
                'Accelevents export staged. No provider request was sent.',
              )
            }}
          >
            <div>
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                Stage a delivery batch
              </h3>
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                Enter the identifier at the end of the Accelevents event URL, not the full URL.
              </p>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-base font-medium text-zinc-950 sm:text-sm">
                Event URL identifier
              </span>
              <input
                required
                value={effectiveEventUrl}
                onChange={(event) => setEventUrl(event.target.value)}
                placeholder="aie-nyc-2026"
                pattern="[A-Za-z0-9](?:[A-Za-z0-9_-]{0,98}[A-Za-z0-9])?"
                title="Use only the Accelevents event identifier: letters, numbers, hyphens, or underscores."
                className={textControl}
              />
            </label>
            <Button
              type="submit"
              variant="primary"
              disabled={
                mutating ||
                !effectiveEventUrl.trim() ||
                !acceleventsPreflight.canPrepare ||
                Boolean(matchingAcceleventsExport)
              }
            >
              <ArrowUpTrayIcon className="size-4 h-lh shrink-0 fill-current" />
              {matchingAcceleventsExport
                ? 'Current release already staged'
                : 'Stage Accelevents export'}
            </Button>
            <p className="text-pretty text-sm text-zinc-500">
              Requires an owner-managed Enterprise API key before a provider consumer can deliver
              the batch.
            </p>
          </form>
        </div>

        {latestAcceleventsExport && exportCounts ? (
          <div className="rounded-xl ring-1 ring-inset ring-zinc-950/10">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-950/5 px-4 py-3">
              <div>
                <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                  Latest delivery batch
                </h3>
                <p className="text-base text-zinc-500 sm:text-sm">
                  Schedule v{latestAcceleventsExport.scheduleVersion} →{' '}
                  {latestAcceleventsExport.eventUrl}
                </p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-sm font-semibold text-zinc-700">
                {sentenceCase(latestAcceleventsExport.status)}
              </span>
            </div>
            <dl className="grid grid-cols-2 divide-x divide-y divide-zinc-950/5 sm:grid-cols-3 lg:grid-cols-6">
              {[
                ['Speakers', exportCounts.speakers],
                ['Sessions', exportCounts.sessions],
                ['Pending', exportCounts.pending],
                ['Delivered', exportCounts.delivered],
                ['Failed', exportCounts.failed],
                ['Attempts', exportCounts.attempts],
              ].map(([term, detail]) => (
                <div key={term} className="px-4 py-3">
                  <dt className="text-sm text-zinc-500">{term}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-zinc-950">{detail}</dd>
                </div>
              ))}
            </dl>
            {latestAcceleventsExport.items.some((item) => item.lastError) ? (
              <ul role="list" className="divide-y divide-zinc-950/5 border-t border-zinc-950/5">
                {latestAcceleventsExport.items
                  .filter((item) => item.lastError)
                  .map((item) => (
                    <li key={item.id} className="px-4 py-3 text-base text-rose-700 sm:text-sm">
                      {item.resource} {item.externalKey}: {item.lastError}
                    </li>
                  ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            No delivery batch has been staged. The published agenda and provider state remain
            unchanged.
          </p>
        )}
      </section>

      <section aria-labelledby="connections-heading">
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 id="connections-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Connections
          </h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            Delivery services around the primary Cloudflare runtime.
          </p>
        </div>
        <ul role="list" className="divide-y divide-zinc-950/5">
          {connections.map((integration) => {
            const Icon =
              integration.status === 'connected'
                ? CheckCircleIcon
                : integration.status === 'attention'
                  ? ExclamationTriangleIcon
                  : MinusCircleIcon
            return (
              <li key={integration.id} className="flex items-start gap-4 py-4">
                <Icon
                  className={cx(
                    'size-4 h-lh shrink-0',
                    integration.status === 'connected' && 'fill-emerald-600',
                    integration.status === 'attention' && 'fill-amber-600',
                    integration.status === 'not_configured' && 'fill-zinc-400',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-medium text-zinc-950 sm:text-sm">
                      {integration.name}
                    </p>
                    <p
                      className={cx(
                        'shrink-0 whitespace-nowrap text-base font-medium sm:text-sm',
                        integration.status === 'connected' && 'text-emerald-700',
                        integration.status === 'attention' && 'text-amber-700',
                        integration.status === 'not_configured' && 'text-zinc-500',
                      )}
                    >
                      {sentenceCase(integration.status)}
                    </p>
                  </div>
                  <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                    {integration.detail}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="endpoints-heading">
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 id="endpoints-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Integration API
          </h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            Predictable event resources for reads; named operations for validated writes.
          </p>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2">
          {[
            ['Events', 'GET /api/v1/events'],
            ['Sessions', 'GET /api/v1/events/{eventId}/sessions'],
            ['Speakers', 'GET /api/v1/events/{eventId}/speakers'],
            ['Submissions', 'GET /api/v1/events/{eventId}/submissions'],
            ['Named writes', 'POST /api/v1/operations/{operationName}'],
            ['Domain event feed', 'GET /api/v1/domain-events'],
            ['Operation manifest', 'GET /api/v1/manifest'],
            ['Logical export', 'GET /api/v1/export'],
          ].map(([term, detail], index) => (
            <div
              key={term}
              className={cx(
                'border-zinc-950/5 py-4',
                index > 0 && 'border-t',
                index === 1 && 'sm:border-t-0',
                index % 2 === 0 ? 'sm:pr-6' : 'sm:border-l sm:pl-6',
              )}
            >
              <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
              <dd className="break-all font-mono text-base text-zinc-500 sm:text-sm">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section
        aria-labelledby="demo-heading"
        className="rounded-xl bg-zinc-50 p-5 ring-1 ring-zinc-950/5"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="demo-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Reset demonstration data
            </h2>
            <p className="text-pretty text-base text-zinc-500 sm:text-sm">
              Restore the deterministic AIE NYC workspace after testing operations.
            </p>
          </div>
          <Button
            variant="danger"
            disabled={mutating}
            onClick={() =>
              void execute('workspace.reset-demo', {}, undefined, 'Demo workspace reset.')
            }
          >
            <ArrowPathIcon className="size-4 h-lh shrink-0 fill-current" />
            Reset demo
          </Button>
        </div>
      </section>
    </div>
  )
}
