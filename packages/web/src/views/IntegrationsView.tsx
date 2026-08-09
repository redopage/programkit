import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
  TableCellsIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Callout, PageHeader, cx, selectControl, sentenceCase } from '../components/ui.tsx'

interface AirtableSetupStatus {
  available: boolean
  connected: boolean
  mode: 'oauth' | 'token' | 'none'
  base: { id: string; name: string } | null
  bases: Array<{ id: string; name: string; permissionLevel: string }>
  liveSync: {
    status: 'active' | 'unavailable'
    expiresAt: string | null
    error: string | null
  } | null
}

export function IntegrationsView() {
  const { payload, execute, mutating, refresh } = useWorkspace()
  const [setup, setSetup] = useState<AirtableSetupStatus | null>(null)
  const [selectedBaseId, setSelectedBaseId] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/v1/integrations/airtable/status', {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Airtable status could not be loaded.')
        return (await response.json()) as AirtableSetupStatus
      })
      .then((status) => {
        setSetup(status)
        setSelectedBaseId((current) => current || status.bases[0]?.id || '')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setSetupError(
          error instanceof Error ? error.message : 'Airtable status could not be loaded.',
        )
      })
    return () => controller.abort()
  }, [])

  const query = new URLSearchParams(window.location.search)
  const oauthStatus = query.get('airtable')
  const oauthMessage = query.get('message')

  if (!payload) return null
  const { state } = payload
  const airtable = state.integrations.find((integration) => integration.kind === 'airtable')
  const connections = state.integrations.filter((integration) => integration.kind !== 'airtable')
  const airtableConnected = setup?.connected ?? airtable?.status === 'connected'

  async function connectAirtable() {
    if (!selectedBaseId) return
    setSetupBusy(true)
    setSetupError(null)
    try {
      const response = await fetch('/api/v1/integrations/airtable/connect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ baseId: selectedBaseId }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) throw new Error(body.error ?? 'Airtable setup failed.')
      await refresh()
      window.location.replace('/integrations?airtable=connected')
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Airtable setup failed.')
      setSetupBusy(false)
    }
  }

  async function disconnectAirtable() {
    if (!window.confirm('Disconnect Airtable? ProgramKit will keep its current local cache.'))
      return
    setSetupBusy(true)
    setSetupError(null)
    try {
      const response = await fetch('/api/v1/integrations/airtable/disconnect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
      })
      if (!response.ok) throw new Error('Airtable could not be disconnected.')
      window.location.replace('/integrations?airtable=disconnected')
    } catch (error) {
      setSetupError(error instanceof Error ? error.message : 'Airtable could not be disconnected.')
      setSetupBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Infrastructure & API"
        description="Deploy on Cloudflare, keep durable records in Airtable, and export through the API."
        actions={
          <Button variant="primary" onClick={() => window.open('/api/v1/export', '_blank')}>
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
            Cloudflare is the supported host. Airtable can own durable records while the event
            workspace stays fast through a local coordination cache.
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
                      <h3 className="text-balance text-lg font-semibold">Cloudflare</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-sm font-semibold text-emerald-200 ring-1 ring-inset ring-emerald-300/20">
                    Active
                  </span>
                </div>

                <p className="max-w-xl text-pretty text-base text-zinc-300 sm:text-sm">
                  The web app, API, and serialized event workspace deploy together. Cached reads do
                  not wait on a third-party database round trip.
                </p>

                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['Worker', 'App + API'],
                    ['SQLite DO', 'Hot cache'],
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
                      <h3 className="text-balance text-lg font-semibold text-zinc-950">Airtable</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-950/10">
                    {airtableConnected ? 'Connected' : 'Not configured'}
                  </span>
                </div>

                <p className="text-pretty text-base text-zinc-600 sm:text-sm">
                  A versioned base holds reconstructable program records. Stable IDs support exact
                  restore, batched writes, and direct team edits.
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
                  <span className="font-normal text-zinc-500">
                    Acknowledged writes + cached reads
                  </span>
                </div>

                <div className="flex flex-wrap gap-1.5" aria-label="Managed tables">
                  {['People', 'Submissions', 'Tasks', 'Sessions', 'Schedule'].map((table) => (
                    <span
                      key={table}
                      className="rounded-md bg-violet-100/70 px-2 py-1 text-sm font-medium text-violet-950"
                    >
                      {table}
                    </span>
                  ))}
                </div>

                {oauthStatus === 'error' || setupError ? (
                  <p role="alert" className="text-pretty text-sm font-medium text-red-700">
                    {setupError ?? oauthMessage ?? 'Airtable authorization did not finish.'}
                  </p>
                ) : null}

                {setup && setup.bases.length > 0 && !setup.connected ? (
                  <div className="rounded-xl bg-white/80 p-3 ring-1 ring-inset ring-violet-950/10">
                    <label
                      htmlFor="airtable-base"
                      className="block text-sm font-medium text-zinc-950"
                    >
                      Choose the base ProgramKit should use
                    </label>
                    <p className="pt-0.5 text-sm text-zinc-500">
                      A dedicated blank base is recommended. Unrelated tables are left alone.
                    </p>
                    <div className="flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
                      <span className="grid min-w-0 flex-1 grid-cols-1">
                        <select
                          id="airtable-base"
                          className={selectControl}
                          value={selectedBaseId}
                          onChange={(event) => setSelectedBaseId(event.target.value)}
                        >
                          {setup.bases.map((base) => (
                            <option key={base.id} value={base.id}>
                              {base.name}
                            </option>
                          ))}
                        </select>
                      </span>
                      <Button
                        variant="primary"
                        disabled={setupBusy || !selectedBaseId}
                        onClick={() => void connectAirtable()}
                      >
                        {setupBusy ? 'Preparing base…' : 'Use this base'}
                      </Button>
                    </div>
                  </div>
                ) : airtableConnected ? (
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm text-zinc-600">
                        {setup?.base?.name ?? 'Airtable base'} is the durable source of truth.
                      </p>
                      {setup?.liveSync?.status === 'active' ? (
                        <p className="pt-0.5 text-sm text-emerald-700">
                          Direct Airtable edits sync back automatically.
                        </p>
                      ) : setup?.mode === 'oauth' ? (
                        <p className="pt-0.5 text-sm text-amber-700">
                          {setup.liveSync?.error ??
                            'Automatic inbound sync is unavailable. Reconnect from the deployed HTTPS app.'}
                        </p>
                      ) : null}
                    </div>
                    {setup?.mode === 'oauth' ? (
                      <Button
                        variant="ghost"
                        size="compact"
                        disabled={setupBusy}
                        onClick={() => void disconnectAirtable()}
                      >
                        Disconnect
                      </Button>
                    ) : null}
                  </div>
                ) : setup?.available ? (
                  <div>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        window.location.assign('/api/v1/integrations/airtable/oauth/start')
                      }
                    >
                      <TableCellsIcon className="size-4 h-lh shrink-0 fill-violet-600" />
                      Connect Airtable
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">
                    Add an Airtable OAuth client or installation token to this deployment.
                  </p>
                )}
              </div>
            </article>
          </div>
        </div>

        <div className="pt-4">
          <Callout tone="success" title="Why this stays fast">
            <p>
              Page loads use the Durable Object cache and make zero Airtable calls. A simple edit
              writes only the workspace revision and changed native record.
            </p>
          </Callout>
        </div>
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
