import { CheckIcon, CpuChipIcon, UserIcon, XMarkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

import type { ChangeSet } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Drawer,
  EmptyState,
  PageHeader,
  StatusBadge,
  sentenceCase,
} from '../components/ui.tsx'

export function ChangesView() {
  const { payload } = useWorkspace()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (!payload) return null
  const { state } = payload
  const selected = state.changeSets.find((changeSet) => changeSet.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Change review"
        description="Review proposed changes before they affect the live program."
      />

      {state.changeSets.length === 0 ? (
        <EmptyState
          title="No proposed changes"
          description="Agent, import, and human proposals will collect here before they affect operational truth."
        />
      ) : (
        <ul role="list" className="divide-y divide-zinc-950/5">
          {state.changeSets.map((changeSet) => (
            <li key={changeSet.id}>
              <button
                type="button"
                className="focus-ring flex w-full items-start gap-4 rounded-lg py-4 text-left hover:bg-zinc-950/2"
                onClick={() => setSelectedId(changeSet.id)}
              >
                {changeSet.origin === 'agent' ? (
                  <CpuChipIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
                ) : (
                  <UserIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <span className="min-w-0">
                      <span className="block text-pretty text-base font-medium text-zinc-950 sm:text-sm">
                        {changeSet.title}
                      </span>
                      <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                        {changeSet.description}
                      </span>
                    </span>
                    <StatusBadge status={changeSet.status} />
                  </span>
                  <span className="mt-2 block text-base text-zinc-500 sm:text-sm">
                    {changeSet.operations.length} operation
                    {changeSet.operations.length === 1 ? '' : 's'} · Proposed by{' '}
                    {changeSet.createdBy}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <ChangeDrawer
        changeSet={selected}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
      />
    </div>
  )
}

function ChangeDrawer({
  changeSet,
  open,
  onClose,
}: {
  changeSet: ChangeSet | null
  open: boolean
  onClose: () => void
}) {
  const { execute, mutating } = useWorkspace()
  if (!changeSet) return null
  const footer =
    changeSet.status === 'awaiting_approval' ? (
      <>
        <Button
          variant="danger"
          disabled={mutating}
          onClick={() =>
            void execute(
              'change-set.reject',
              { changeSetId: changeSet.id },
              { expectedVersions: { [changeSet.id]: changeSet.version } },
              'Proposal rejected.',
            )
          }
        >
          <XMarkIcon className="size-4 h-lh shrink-0 fill-current" />
          Reject
        </Button>
        <Button
          variant="primary"
          disabled={mutating}
          onClick={() =>
            void execute(
              'change-set.approve',
              { changeSetId: changeSet.id },
              { expectedVersions: { [changeSet.id]: changeSet.version } },
              'Proposal approved. Commit when ready.',
            )
          }
        >
          <CheckIcon className="size-4 h-lh shrink-0 fill-current" />
          Approve
        </Button>
      </>
    ) : changeSet.status === 'approved' ? (
      <Button
        variant="primary"
        disabled={mutating}
        onClick={() =>
          void execute(
            'change-set.commit',
            { changeSetId: changeSet.id },
            { expectedVersions: { [changeSet.id]: changeSet.version } },
            'Proposal committed.',
          )
        }
      >
        Commit operations
      </Button>
    ) : undefined

  return (
    <Drawer open={open} onClose={onClose} title={changeSet.title} footer={footer}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={changeSet.status} />
          <p className="text-base text-zinc-500 sm:text-sm">
            {sentenceCase(changeSet.origin)} proposal
          </p>
        </div>
        <p className="text-pretty text-base text-zinc-600 sm:text-sm">{changeSet.description}</p>

        <section aria-labelledby="impact-heading">
          <h3 id="impact-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Expected impact
          </h3>
          <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
            {changeSet.impactSummary.map((impact) => (
              <li key={impact} className="flex gap-3 py-3">
                <CheckIcon className="size-4 h-lh shrink-0 fill-emerald-600" />
                <p className="text-pretty text-base text-zinc-600 sm:text-sm">{impact}</p>
              </li>
            ))}
          </ul>
        </section>

        {changeSet.warnings.length > 0 ? (
          <Callout tone="warning" title="Before you approve">
            <ul role="list" className="flex flex-col gap-1 pt-1">
              {changeSet.warnings.map((warning) => (
                <li key={warning} className="text-pretty">
                  {warning}
                </li>
              ))}
            </ul>
          </Callout>
        ) : null}

        <section aria-labelledby="operations-heading">
          <h3 id="operations-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
            Operations
          </h3>
          <ol role="list" className="flex flex-col gap-2 pt-2">
            {changeSet.operations.map((operation, index) => (
              <li
                key={`${operation.operation}-${index}`}
                className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5"
              >
                <p className="font-mono text-sm font-medium text-zinc-950">{operation.operation}</p>
                <dl className="grid gap-2 pt-3 sm:grid-cols-2">
                  {Object.entries(operation.input).map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-sm font-medium text-zinc-950">
                        {key.replaceAll('_', ' ')}
                      </dt>
                      <dd className="break-words text-sm text-zinc-500">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </Drawer>
  )
}
