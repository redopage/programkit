import {
  ArrowDownTrayIcon,
  ArrowRightIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardDocumentIcon,
  CloudIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  MinusCircleIcon,
  TableCellsIcon,
  TrashIcon,
} from '@heroicons/react/16/solid'
import { agentApiKeyScopes, createAcceleventsExport } from '@programkit/core'
import { useEffect, useState } from 'react'

import { ProgramKitMark } from '../components/brand.tsx'
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

interface ApiKeyRecord {
  id: string
  eventId: string
  name: string
  prefix: string
  scopes: string[]
  createdAt: string
  expiresAt: string | null
  revokedAt: string | null
  lastUsedAt: string | null
}

const apiScopeGroups = [
  {
    id: 'agent',
    label: 'Agent operations',
    detail: 'Read program data, draft messages, and propose schedule changes.',
    scopes: agentApiKeyScopes,
  },
  {
    id: 'read',
    label: 'Read program data',
    detail: 'Events, submissions, speakers, sessions, and change history.',
    scopes: [
      'workspace:read',
      'events:read',
      'people:read',
      'participations:read',
      'requirements:read',
      'schedule:read',
      'changes:read',
    ],
  },
  {
    id: 'export',
    label: 'Download exports',
    detail: 'Create portable ZIP and JSON workspace exports.',
    scopes: ['workspace:export'],
  },
  {
    id: 'submissions',
    label: 'Manage submissions',
    detail: 'Forms, incoming proposals, and submission decisions.',
    scopes: [
      'submission-forms:write',
      'submission-forms:publish',
      'submissions:write',
      'submissions:submit',
      'reviews:configure',
      'reviews:write',
      'reviews:decide',
    ],
  },
  {
    id: 'program',
    label: 'Manage program',
    detail: 'Tracks, rooms, sessions, schedule, and publishing.',
    scopes: ['events:write', 'sessions:write', 'schedule:draft', 'schedule:publish'],
  },
  {
    id: 'speakers',
    label: 'Manage speakers',
    detail: 'People, participation, onboarding tasks, and files.',
    scopes: [
      'people:write',
      'participations:write',
      'requirements:write',
      'assets:write',
      'portal:write',
    ],
  },
  {
    id: 'communications',
    label: 'Send communications',
    detail: 'Create campaigns and send event messages.',
    scopes: [
      'communications:write',
      'communications:draft',
      'communications:approve',
      'communications:send',
    ],
  },
] as const

export function IntegrationsView() {
  const { payload, execute, mutating, refresh } = useWorkspace()
  const [setup, setSetup] = useState<AirtableSetupStatus | null>(null)
  const [selectedBaseId, setSelectedBaseId] = useState('')
  const [setupBusy, setSetupBusy] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [acceleventsMessage, setAcceleventsMessage] = useState<string | null>(null)
  const activeEventId = payload?.state.activeEventId ?? ''
  const hostedApp =
    document
      .querySelector('meta[name="programkit-deployment-profile"]')
      ?.getAttribute('content') === 'hosted-app'
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[] | null>(null)
  const [apiKeysError, setApiKeysError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!hostedApp || !activeEventId) return
    const controller = new AbortController()
    void fetch(`/api/v1/events/${encodeURIComponent(activeEventId)}/api-keys`, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          ok?: boolean
          apiKeys?: ApiKeyRecord[]
          error?: string
        }
        if (!response.ok || !body.ok) throw new Error(body.error ?? 'API keys could not be loaded.')
        setApiKeys(body.apiKeys ?? [])
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setApiKeysError(error instanceof Error ? error.message : 'API keys could not be loaded.')
      })
    return () => controller.abort()
  }, [activeEventId, hostedApp])

  const query = new URLSearchParams(window.location.search)
  const oauthStatus = query.get('airtable')
  const oauthMessage = query.get('message')

  if (!payload) return null
  const { state } = payload
  const airtable = state.integrations.find((integration) => integration.kind === 'airtable')
  const connections = state.integrations.filter((integration) => integration.kind !== 'airtable')
  const airtableConnected = setup?.connected ?? airtable?.status === 'connected'
  const activeEvent = state.events.find((event) => event.id === state.activeEventId)
  const publishedRelease = state.scheduleReleases
    .filter((release) => release.eventId === state.activeEventId)
    .sort((left, right) => right.version - left.version)[0]

  function downloadAcceleventsExport() {
    setAcceleventsMessage(null)
    try {
      const result = createAcceleventsExport(state, new Date().toISOString())
      const bytes = new Uint8Array(result.archive.byteLength)
      bytes.set(result.archive)
      const blob = new Blob([bytes.buffer], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = result.filename
      anchor.click()
      URL.revokeObjectURL(url)
      setAcceleventsMessage(
        `${result.sessionCount} sessions and ${result.speakerCount} speakers are ready to import.`,
      )
    } catch (error) {
      setAcceleventsMessage(
        error instanceof Error ? error.message : 'The Accelevents package could not be created.',
      )
    }
  }

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
        description="Cloudflare runtime, data ownership, exports, and optional connections."
        actions={
          <Button variant="primary" onClick={() => window.location.assign('/api/v1/export')}>
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
            Cloudflare is the supported host. Each event lives in its own SQLite-backed Durable
            Object. Other services are optional.
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
                      <h3 className="text-balance text-lg font-semibold text-zinc-950">Airtable</h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-sm font-semibold text-violet-700 ring-1 ring-inset ring-violet-950/10">
                    {airtableConnected ? 'Connected · experimental' : 'Experimental'}
                  </span>
                </div>

                <p className="text-pretty text-base text-zinc-600 sm:text-sm">
                  The optional Airtable-backed mode provides reconstructable program records and
                  direct team edits. It is not the recommended V1 store yet.
                </p>

                <div className="flex flex-wrap items-center gap-2 text-base font-semibold text-zinc-700 sm:text-sm">
                  <span className="flex items-center gap-1.5 rounded-lg bg-zinc-950 px-2.5 py-1.5 text-white">
                    <ProgramKitMark className="size-4" />
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
                        {setup?.base?.name ?? 'Airtable base'} is the acknowledged persistence
                        backend for this experimental mode.
                      </p>
                      {setup?.liveSync?.status === 'active' ? (
                        <p className="pt-0.5 text-sm text-emerald-700">
                          Webhook refresh is active. Conflict-review hardening is still required.
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
          <Callout tone="success" title="Cached reads">
            <p>
              Page loads use the Durable Object cache and make zero Airtable calls. A simple edit
              writes only the workspace revision and changed native record.
            </p>
          </Callout>
        </div>
      </section>

      <section aria-labelledby="accelevents-heading">
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 id="accelevents-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Accelevents handoff
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Move a published program into Accelevents without changing where it is managed.
          </p>
        </div>
        <div className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">
              {activeEvent?.name ?? 'Current event'}
            </p>
            <p className="max-w-2xl text-pretty text-base text-zinc-500 sm:text-sm">
              Download Accelevents-ready speaker and session CSVs, a room mapping sheet, and a short
              import guide. The package uses the latest published schedule.
            </p>
            {acceleventsMessage ? (
              <p role="status" className="pt-2 text-sm font-medium text-zinc-700">
                {acceleventsMessage}
              </p>
            ) : null}
          </div>
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={!publishedRelease}
            onClick={downloadAcceleventsExport}
          >
            <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
            {publishedRelease ? 'Download Accelevents package' : 'Publish agenda first'}
          </Button>
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

      {hostedApp ? (
        <ApiKeysSection
          eventId={state.activeEventId}
          apiKeys={apiKeys}
          loadError={apiKeysError}
          onChange={setApiKeys}
        />
      ) : null}

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

      {!hostedApp ? (
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
      ) : null}
    </div>
  )
}

function ApiKeysSection({
  eventId,
  apiKeys,
  loadError,
  onChange,
}: {
  eventId: string
  apiKeys: ApiKeyRecord[] | null
  loadError: string | null
  onChange: (apiKeys: ApiKeyRecord[]) => void
}) {
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [selectedGroups, setSelectedGroups] = useState<string[]>(['read'])
  const [expiry, setExpiry] = useState('90')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const [newSecretIsAgent, setNewSecretIsAgent] = useState(false)
  const [copied, setCopied] = useState(false)

  const selectedScopes = apiScopeGroups
    .filter((group) => selectedGroups.includes(group.id))
    .flatMap((group) => [...group.scopes])

  async function createKey() {
    setBusy(true)
    setError(null)
    try {
      const expiresAt =
        expiry === 'never'
          ? null
          : new Date(Date.now() + Number(expiry) * 24 * 60 * 60 * 1_000).toISOString()
      const response = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/api-keys`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, scopes: selectedScopes, expiresAt }),
      })
      const body = (await response.json()) as {
        ok?: boolean
        apiKey?: ApiKeyRecord
        token?: string
        error?: string
      }
      if (!response.ok || !body.ok || !body.apiKey || !body.token) {
        throw new Error(body.error ?? 'API key could not be created.')
      }
      onChange([body.apiKey, ...(apiKeys ?? [])])
      setNewSecret(body.token)
      setNewSecretIsAgent(selectedGroups.includes('agent'))
      setName('')
      setSelectedGroups(['read'])
      setExpiry('90')
      setCreating(false)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'API key could not be created.')
    } finally {
      setBusy(false)
    }
  }

  async function revokeKey(apiKey: ApiKeyRecord) {
    if (!window.confirm(`Revoke “${apiKey.name}”? Requests using it will stop immediately.`)) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/v1/events/${encodeURIComponent(eventId)}/api-keys/${encodeURIComponent(apiKey.id)}`,
        { method: 'DELETE' },
      )
      const body = (await response.json()) as {
        ok?: boolean
        apiKey?: ApiKeyRecord
        error?: string
      }
      if (!response.ok || !body.ok || !body.apiKey) {
        throw new Error(body.error ?? 'API key could not be revoked.')
      }
      onChange((apiKeys ?? []).map((entry) => (entry.id === apiKey.id ? body.apiKey! : entry)))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'API key could not be revoked.')
    } finally {
      setBusy(false)
    }
  }

  async function copySecret() {
    if (!newSecret) return
    await navigator.clipboard.writeText(newSecret)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <section aria-labelledby="api-keys-heading">
      <div className="flex flex-col gap-3 border-b border-zinc-950/5 pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="api-keys-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            API keys
          </h2>
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Event-scoped access for your website, scripts, and integrations.
          </p>
        </div>
        <Button variant="secondary" size="compact" onClick={() => setCreating((value) => !value)}>
          <KeyIcon className="size-4 h-lh shrink-0 fill-current" />
          {creating ? 'Cancel' : 'Create key'}
        </Button>
      </div>

      {newSecret ? (
        <div className="mt-5 rounded-2xl bg-zinc-950 p-5 text-white">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h3 className="text-base font-medium sm:text-sm">Copy your new key now</h3>
              <p className="pt-1 text-base text-zinc-400 sm:text-sm">
                It will not be shown again. Store it in a secrets manager or encrypted environment
                variable.
              </p>
            </div>
            <Button
              variant="secondary"
              size="compact"
              className="bg-white text-zinc-950 hover:bg-zinc-100"
              onClick={() => void copySecret()}
            >
              <ClipboardDocumentIcon className="size-4 h-lh shrink-0 fill-current" />
              {copied ? 'Copied' : 'Copy key'}
            </Button>
          </div>
          <code className="mt-4 block overflow-x-auto rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/10">
            {newSecret}
          </code>
          {newSecretIsAgent ? (
            <div className="mt-4 border-t border-white/10 pt-4">
              <p className="text-sm font-medium text-white">Connect Codex</p>
              <p className="pt-1 text-sm text-zinc-400">
                Save the key as <code>PROGRAMKIT_API_KEY</code>, then register this event-scoped
                endpoint.
              </p>
              <code className="mt-3 block overflow-x-auto rounded-xl bg-white/10 px-3 py-2 text-sm text-zinc-100 ring-1 ring-inset ring-white/10">
                {`codex mcp add programkit --url ${window.location.origin}/mcp --bearer-token-env-var PROGRAMKIT_API_KEY`}
              </code>
            </div>
          ) : null}
          <button
            type="button"
            className="focus-ring mt-3 rounded-lg text-sm font-medium text-zinc-400 hover:text-white"
            onClick={() => setNewSecret(null)}
          >
            I saved it
          </button>
        </div>
      ) : null}

      {creating ? (
        <div className="mt-5 rounded-2xl bg-zinc-50 p-5 ring-1 ring-inset ring-zinc-950/5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.7fr)]">
            <div>
              <label
                htmlFor="api-key-name"
                className="text-base font-medium text-zinc-950 sm:text-sm"
              >
                Key name
              </label>
              <input
                id="api-key-name"
                className="focus-ring mt-2 min-h-10 w-full rounded-xl border border-zinc-950/10 bg-white px-3 text-base text-zinc-950 shadow-xs sm:text-sm"
                placeholder="Website sync"
                maxLength={60}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="api-key-expiry"
                className="text-base font-medium text-zinc-950 sm:text-sm"
              >
                Expires
              </label>
              <select
                id="api-key-expiry"
                className={`${selectControl} mt-2`}
                value={expiry}
                onChange={(event) => setExpiry(event.target.value)}
              >
                <option value="30">In 30 days</option>
                <option value="90">In 90 days</option>
                <option value="365">In one year</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>

          <fieldset className="pt-5">
            <legend className="text-base font-medium text-zinc-950 sm:text-sm">Access</legend>
            <div className="grid gap-2 pt-2 sm:grid-cols-2 lg:grid-cols-3">
              {apiScopeGroups.map((group) => {
                const checked = selectedGroups.includes(group.id)
                return (
                  <label
                    key={group.id}
                    className={cx(
                      'flex cursor-pointer gap-3 rounded-xl p-3 ring-1 ring-inset transition-colors',
                      checked
                        ? 'bg-blue-50 ring-blue-600/20'
                        : 'bg-white ring-zinc-950/10 hover:bg-zinc-50',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-blue-600"
                      checked={checked}
                      onChange={() =>
                        setSelectedGroups((current) =>
                          checked
                            ? current.filter((id) => id !== group.id)
                            : [...current, group.id],
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                        {group.label}
                      </span>
                      <span className="block text-sm text-zinc-500">{group.detail}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          {error ? (
            <p role="alert" className="pt-4 text-sm font-medium text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex items-center gap-2 pt-5">
            <Button
              variant="primary"
              disabled={busy || name.trim().length < 2 || selectedScopes.length === 0}
              onClick={() => void createKey()}
            >
              {busy ? 'Creating…' : 'Create key'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setCreating(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {loadError ? (
        <p role="alert" className="py-5 text-sm font-medium text-red-700">
          {loadError}
        </p>
      ) : apiKeys === null ? (
        <p className="py-5 text-base text-zinc-500 sm:text-sm">Loading API keys…</p>
      ) : apiKeys.length === 0 ? (
        <p className="py-5 text-base text-zinc-500 sm:text-sm">
          No API keys yet. Create one when an integration needs private access.
        </p>
      ) : (
        <ul role="list" className="divide-y divide-zinc-950/5">
          {apiKeys.map((apiKey) => {
            const expired = apiKey.expiresAt !== null && Date.parse(apiKey.expiresAt) <= Date.now()
            const inactive = apiKey.revokedAt !== null || expired
            return (
              <li key={apiKey.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
                <KeyIcon
                  className={cx(
                    'size-4 h-lh shrink-0',
                    inactive ? 'fill-zinc-400' : 'fill-blue-600',
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-base font-medium text-zinc-950 sm:text-sm">{apiKey.name}</p>
                    <span className="text-sm text-zinc-400">
                      {apiKey.revokedAt ? 'Revoked' : expired ? 'Expired' : 'Active'}
                    </span>
                  </div>
                  <p className="truncate font-mono text-sm text-zinc-500">{apiKey.prefix}…</p>
                  <p className="text-sm text-zinc-400">
                    {apiKey.lastUsedAt
                      ? `Last used ${new Date(apiKey.lastUsedAt).toLocaleString()}`
                      : 'Never used'}
                    {apiKey.expiresAt
                      ? ` · Expires ${new Date(apiKey.expiresAt).toLocaleDateString()}`
                      : ' · No expiry'}
                  </p>
                </div>
                {!inactive ? (
                  <Button
                    variant="ghost"
                    size="compact"
                    disabled={busy}
                    onClick={() => void revokeKey(apiKey)}
                  >
                    <TrashIcon className="size-4 h-lh shrink-0 fill-current" />
                    Revoke
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
