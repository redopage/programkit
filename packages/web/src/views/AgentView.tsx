import {
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CpuChipIcon,
  LockClosedIcon,
  ShieldCheckIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import { readinessSummary } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, PageHeader } from '../components/ui.tsx'

export function AgentView({ navigate }: { navigate: (to: string) => void }) {
  const { payload, execute, mutating } = useWorkspace()
  const [prompt, setPrompt] = useState(
    'Prepare a reminder for speakers with blocking requirements.',
  )
  if (!payload) return null
  const { state } = payload
  const summary = readinessSummary(state)

  async function runTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const scheduleTask = prompt.toLowerCase().includes('schedule')
    if (scheduleTask) {
      const response = await execute(
        'change-set.create',
        {
          title: 'Move Small models, serious work to Main stage',
          description:
            'A reviewable schedule proposal generated from current room capacity and placement constraints.',
          operations: [
            {
              operation: 'schedule.move-session',
              input: {
                placementId: 'plc_007',
                roomId: 'rom_main',
                startsAt: '2026-10-04T17:00:00.000Z',
              },
              expectedVersions: {
                plc_007:
                  state.placements.find((placement) => placement.id === 'plc_007')?.version ?? 1,
              },
            },
          ],
        },
        undefined,
        'Agent proposal created for review.',
      )
      if (!response.ok) return
      navigate('/changes')
      return
    }

    const response = await execute(
      'campaign.create-draft',
      {
        name: 'Agent readiness reminder',
        subject: 'A few items remain in your AIE NYC speaker workspace',
        body: 'Hi {{first_name}},\n\nA few required items still need your attention. Please open your speaker workspace to finish them before the deadline.',
        audience: 'missing_requirements',
      },
      undefined,
      'Agent drafted a reminder. Human approval is still required.',
    )
    if (!response.ok) return
    navigate('/communications')
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Agent workspace"
        description="Draft safely with the same data and approval rules as the web app."
      />

      <section
        aria-labelledby="task-heading"
        className="rounded-2xl bg-zinc-950 p-5 text-white shadow-xl ring-1 ring-black/10 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <CpuChipIcon className="size-4 h-lh shrink-0 fill-emerald-400" />
          <div className="min-w-0 flex-1">
            <h2 id="task-heading" className="text-base font-medium sm:text-sm">
              Run a seeded agent task
            </h2>
            <p className="max-w-[70ch] text-pretty text-base text-zinc-300 sm:text-sm">
              This runner exercises the same operations exposed through MCP. Try a readiness
              reminder or a schedule proposal.
            </p>
          </div>
        </div>
        <form
          className="flex flex-col gap-3 pt-5 sm:flex-row"
          onSubmit={(event) => void runTask(event)}
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Agent task</span>
            <input
              type="text"
              name="agent-task"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              className="focus-visible:outline-blue-400 min-h-11 w-full rounded-xl bg-white/10 px-3 py-2 text-base text-white ring-1 ring-white/15 placeholder:text-zinc-500 focus-visible:outline-2 -outline-offset-1 sm:min-h-9 sm:text-sm"
            />
          </label>
          <Button type="submit" variant="primary" disabled={mutating || prompt.trim().length === 0}>
            Run task
            <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
          </Button>
        </form>
        <div className="flex flex-wrap gap-2 pt-3">
          {['Prepare a readiness reminder.', 'Propose a schedule improvement.'].map(
            (suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="focus-ring rounded-full bg-white/5 px-3 py-1.5 text-sm text-zinc-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"
                onClick={() => setPrompt(suggestion)}
              >
                {suggestion}
              </button>
            ),
          )}
        </div>
      </section>

      <div className="grid gap-8 xl:grid-cols-[7fr_5fr]">
        <section aria-labelledby="brief-heading">
          <div className="border-b border-zinc-950/5 pb-2">
            <h2 id="brief-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Current operational brief
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              Every count resolves to workspace records.
            </p>
          </div>
          <dl className="divide-y divide-zinc-950/5">
            {[
              ['Active participants', summary.participants, 'people and participation records'],
              ['Hard readiness blockers', summary.blockers, 'requirement instances'],
              ['Awaiting requirement review', summary.awaitingReview, 'submitted participant work'],
              ['Unconfirmed invitations', summary.unconfirmed, 'invited participation records'],
            ].map(([label, value, detail]) => (
              <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 py-4">
                <dt className="col-start-1 row-start-1 min-w-0 text-base font-medium text-zinc-950 sm:text-sm">
                  {label}
                </dt>
                <dd className="col-start-1 row-start-2 min-w-0 text-pretty text-base text-zinc-500 sm:text-sm">
                  {detail}
                </dd>
                <dd className="col-start-2 row-span-2 row-start-1 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-labelledby="policy-heading">
          <div className="border-b border-zinc-950/5 pb-2">
            <h2 id="policy-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Default agent policy
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              Enforced by scopes and operation policy.
            </p>
          </div>
          <ul role="list" className="divide-y divide-zinc-950/5">
            {[
              [CheckCircleIcon, 'Read and analyze records', 'Allowed', 'fill-emerald-600'],
              [ShieldCheckIcon, 'Draft campaigns and proposals', 'Allowed', 'fill-emerald-600'],
              [ShieldCheckIcon, 'Move sessions or merge people', 'Proposal only', 'fill-amber-600'],
              [LockClosedIcon, 'Send, publish, or manage secrets', 'Human only', 'fill-zinc-500'],
            ].map(([Icon, label, policy, color]) => (
              <li key={String(label)} className="flex items-start gap-3 py-3">
                <Icon className={`size-4 h-lh shrink-0 ${String(color)}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-base font-medium text-zinc-950 sm:text-sm">{String(label)}</p>
                  <p className="text-base text-zinc-500 sm:text-sm">{String(policy)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-labelledby="skills-heading">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-zinc-950/5 pb-2">
          <div>
            <h2 id="skills-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
              Agent Plugin
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">
              Portable Agent Plugins 1.0 skills and an MCP connection.
            </p>
          </div>
          <a
            href="https://forge.smol.ai/andheller/programkit/tree/main/packages/agent/plugin/programkit"
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-3 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/10 hover:bg-zinc-50"
          >
            View plugin
            <ArrowTopRightOnSquareIcon className="size-4 shrink-0 fill-current" />
          </a>
        </div>
        <div className="grid gap-px overflow-hidden rounded-xl bg-zinc-950/5 ring-1 ring-zinc-950/5 sm:grid-cols-2">
          {[
            [
              'Import and reconcile',
              'Map inconsistent files, preview changes, and explain ambiguous matches.',
            ],
            [
              'Manage readiness',
              'Find blockers, segment participants, and draft precise reminders.',
            ],
            [
              'Resolve schedule conflicts',
              'Validate constraints and propose reviewable placement changes.',
            ],
            [
              'Preflight publication',
              'Verify readiness, schedule integrity, exports, and remaining warnings.',
            ],
            [
              'Reconcile Airtable',
              'Compare a separately authorized base and prepare a field-level plan before writes.',
            ],
          ].map(([title, description]) => (
            <div key={title} className="bg-white p-5">
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">{title}</h3>
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">{description}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
