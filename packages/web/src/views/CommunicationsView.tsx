import {
  CheckIcon,
  ChevronUpDownIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import type { Campaign } from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Drawer,
  FilterTabs,
  PageHeader,
  StatusBadge,
  Toolbar,
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

type CampaignFilter = 'all' | Campaign['status']

export function CommunicationsView() {
  const { payload } = useWorkspace()
  const [filter, setFilter] = useState<CampaignFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [composing, setComposing] = useState(false)
  if (!payload) return null
  const { state } = payload
  const campaigns = state.campaigns.filter(
    (campaign) => filter === 'all' || campaign.status === filter,
  )
  const selected = state.campaigns.find((campaign) => campaign.id === selectedId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communications"
        actions={
          <Button variant="primary" onClick={() => setComposing(true)}>
            <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
            New campaign
          </Button>
        }
      />

      <Toolbar>
        <FilterTabs
          label="Campaign views"
          value={filter}
          onChange={setFilter}
          options={[
            ['all', 'All'],
            ['draft', 'Drafts'],
            ['awaiting_approval', 'Awaiting approval'],
            ['approved', 'Approved'],
            ['sent', 'Sent'],
          ]}
        />
      </Toolbar>

      <div className="hidden sm:block">
        <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap">
          <div className="inline-block min-w-full px-6 py-2 align-middle">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-950/10">
                  {['Campaign', 'Audience', 'Recipients', 'Status', 'Created by', 'Updated'].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="whitespace-nowrap py-2.5 pr-4 text-left text-sm font-medium text-zinc-500"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-950/5">
                {campaigns.map((campaign) => (
                  <tr
                    key={campaign.id}
                    className="cursor-pointer hover:bg-zinc-950/2"
                    onClick={() => setSelectedId(campaign.id)}
                  >
                    <td className="max-w-md py-3 pr-4">
                      <button
                        type="button"
                        className="focus-ring block max-w-full rounded-lg text-left"
                        onClick={() => setSelectedId(campaign.id)}
                      >
                        <span className="block truncate text-sm font-medium text-zinc-950">
                          {campaign.name}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">
                          {campaign.subject}
                        </span>
                      </button>
                    </td>
                    <td className="py-3 pr-4 text-sm text-zinc-600">
                      {sentenceCase(campaign.audience)}
                    </td>
                    <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                      {campaign.recipientParticipationIds.length}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={campaign.status} />
                    </td>
                    <td className="py-3 pr-4 text-sm text-zinc-600">{campaign.createdBy}</td>
                    <td className="py-3 text-sm text-zinc-500">
                      {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
                        new Date(campaign.sentAt ?? campaign.approvedAt ?? campaign.createdAt),
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ul role="list" className="divide-y divide-zinc-950/5 sm:hidden">
        {campaigns.map((campaign) => (
          <li key={campaign.id}>
            <button
              type="button"
              className="focus-ring w-full rounded-lg py-4 text-left hover:bg-zinc-950/2"
              onClick={() => setSelectedId(campaign.id)}
            >
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-zinc-950">
                    {campaign.name}
                  </span>
                  <span className="block truncate text-base text-zinc-500">{campaign.subject}</span>
                  <span className="mt-2 block text-base tabular-nums text-zinc-500">
                    {campaign.recipientParticipationIds.length} recipients
                  </span>
                </span>
                <StatusBadge status={campaign.status} />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <CampaignDrawer
        campaign={selected}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
      />
      <ComposeDrawer open={composing} onClose={() => setComposing(false)} />
    </div>
  )
}

function CampaignDrawer({
  campaign,
  open,
  onClose,
}: {
  campaign: Campaign | null
  open: boolean
  onClose: () => void
}) {
  const { execute, mutating } = useWorkspace()
  if (!campaign) return null
  const footer =
    campaign.status === 'draft' ? (
      <Button
        variant="primary"
        disabled={mutating}
        onClick={() =>
          void execute(
            'campaign.submit',
            { campaignId: campaign.id },
            { expectedVersions: { [campaign.id]: campaign.version } },
            'Campaign submitted for approval.',
          )
        }
      >
        Submit for approval
      </Button>
    ) : campaign.status === 'awaiting_approval' ? (
      <Button
        variant="primary"
        disabled={mutating}
        onClick={() =>
          void execute(
            'campaign.approve',
            { campaignId: campaign.id },
            { expectedVersions: { [campaign.id]: campaign.version } },
            'Campaign approved.',
          )
        }
      >
        <CheckIcon className="size-4 h-lh shrink-0 fill-current" />
        Approve campaign
      </Button>
    ) : campaign.status === 'approved' ? (
      <Button
        variant="primary"
        disabled={mutating}
        onClick={() =>
          void execute(
            'campaign.send',
            { campaignId: campaign.id },
            { expectedVersions: { [campaign.id]: campaign.version } },
            'Campaign marked sent in the demo. No email provider was contacted.',
          )
        }
      >
        <PaperAirplaneIcon className="size-4 h-lh shrink-0 fill-current" />
        Send campaign
      </Button>
    ) : undefined

  return (
    <Drawer open={open} onClose={onClose} title={campaign.name} footer={footer}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={campaign.status} />
          <p className="text-base tabular-nums text-zinc-500 sm:text-sm">
            {campaign.recipientParticipationIds.length} recipients
          </p>
        </div>
        <dl className="grid gap-4">
          <div>
            <dt className="text-base font-medium text-zinc-950 sm:text-sm">Audience</dt>
            <dd className="text-base text-zinc-500 sm:text-sm">
              {sentenceCase(campaign.audience)}
            </dd>
          </div>
          <div>
            <dt className="text-base font-medium text-zinc-950 sm:text-sm">Subject</dt>
            <dd className="text-pretty text-base text-zinc-500 sm:text-sm">{campaign.subject}</dd>
          </div>
        </dl>
        <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <p className="whitespace-pre-wrap text-pretty text-base text-zinc-700 sm:text-sm">
            {campaign.body}
          </p>
        </div>
        <Callout tone="warning" title="Delivery safety">
          <p>
            Recipient membership is recalculated before submission and frozen at approval. Sending
            is idempotent.
          </p>
        </Callout>
      </div>
    </Drawer>
  )
}

function ComposeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { execute, mutating } = useWorkspace()
  const [form, setForm] = useState({
    name: '',
    subject: '',
    body: 'Hi {{first_name}},\n\n',
    audience: 'missing_requirements',
  })

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'campaign.create-draft',
      form,
      undefined,
      'Campaign draft created.',
    )
    if (!response.ok) return
    setForm({
      name: '',
      subject: '',
      body: 'Hi {{first_name}},\n\n',
      audience: 'missing_requirements',
    })
    onClose()
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="New campaign"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="compose-campaign-form" disabled={mutating}>
            <EnvelopeIcon className="size-4 h-lh shrink-0 fill-current" />
            Create draft
          </Button>
        </>
      }
    >
      <form
        id="compose-campaign-form"
        className="flex flex-col gap-5"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          Drafting is safe. A separate human approval is required before any message can be sent.
        </p>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Internal name</span>
          <input
            type="text"
            name="name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className={textControl}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Audience</span>
          <span className="relative">
            <select
              name="audience"
              value={form.audience}
              onChange={(event) =>
                setForm((current) => ({ ...current, audience: event.target.value }))
              }
              className="focus-ring min-h-11 w-full appearance-none rounded-xl bg-white py-2 pr-9 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
            >
              <option value="missing_requirements">Missing required work</option>
              <option value="unconfirmed">Awaiting confirmation</option>
              <option value="all_active">All active participants</option>
            </select>
            <ChevronUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 fill-zinc-400" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Subject</span>
          <input
            type="text"
            name="subject"
            required
            value={form.subject}
            onChange={(event) =>
              setForm((current) => ({ ...current, subject: event.target.value }))
            }
            className={textControl}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Message</span>
          <textarea
            name="body"
            required
            rows={10}
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            className={textAreaControl}
          />
        </label>
      </form>
    </Drawer>
  )
}
