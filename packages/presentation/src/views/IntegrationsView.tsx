import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MinusCircleIcon,
} from '@heroicons/react/16/solid'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, PageHeader, cx } from '../components/ui.tsx'

export function IntegrationsView() {
  const { payload, execute, mutating } = useWorkspace()
  if (!payload) return null
  const { state } = payload

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Portable by default"
        title="Integrations"
        description="Inspect delivery boundaries, webhook health, and the complete departure path from one operational surface."
        actions={
          <Button variant="primary" onClick={() => window.open('/api/v1/export', '_blank')}>
            <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
            Download full export
          </Button>
        }
      />

      <section aria-labelledby="connections-heading">
        <div className="border-b border-zinc-950/5 pb-3">
          <h2 id="connections-heading" className="text-lg font-semibold text-zinc-950">
            Connections
          </h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            Provider adapters and runtime endpoints.
          </p>
        </div>
        <ul role="list" className="divide-y divide-zinc-950/5">
          {state.integrations.map((integration) => {
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
                    <p className="text-base capitalize text-zinc-500 sm:text-sm">
                      {integration.status.replaceAll('_', ' ')}
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
        <div className="border-b border-zinc-950/5 pb-3">
          <h2 id="endpoints-heading" className="text-lg font-semibold text-zinc-950">
            Capability surface
          </h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            All clients enter through the same operation processor.
          </p>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2">
          {[
            ['Operation API', 'POST /api/v1/operations/{operationName}'],
            ['MCP endpoint', 'POST /mcp'],
            ['Event feed', 'GET /api/v1/events'],
            ['Operation manifest', 'GET /api/v1/manifest'],
            ['Portable export', 'GET /api/v1/export'],
            ['Public agenda', 'GET /public/agenda.json'],
          ].map(([term, detail], index) => (
            <div
              key={term}
              className={cx(
                'border-zinc-950/5 py-4',
                index > 0 && 'border-t',
                index % 2 === 0 ? 'sm:pr-6' : 'sm:border-l sm:pl-6',
              )}
            >
              <dt className="text-base font-medium text-zinc-950 sm:text-sm">{term}</dt>
              <dd className="break-all font-mono text-sm text-zinc-500">{detail}</dd>
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
            <h2 id="demo-heading" className="text-base font-semibold text-zinc-950">
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
