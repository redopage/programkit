import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronUpDownIcon,
  EnvelopeIcon,
  PaperAirplaneIcon,
  PaperClipIcon,
  PlusIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import {
  renderCampaignMessage,
  type Campaign,
  type CampaignDelivery,
  type CampaignStatus,
} from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Checkbox,
  Drawer,
  EmptyState,
  Field,
  FilterTabs,
  PageHeader,
  StatusBadge,
  Toolbar,
  cx,
  selectControl,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

type CampaignFilter = 'all' | Campaign['status']

/**
 * Audience names the organizer chose, not the stored key. `sentenceCase` turns
 * `missing_requirements` into "Missing requirements", which reads like a system
 * value rather than a group of people.
 */
const audienceLabels: Record<Campaign['audience'], string> = {
  all_active: 'All active participants',
  confirmed: 'Confirmed speakers',
  unconfirmed: 'Awaiting confirmation',
  missing_requirements: 'Missing required work',
  custom: 'Hand-picked list',
}

const audienceHints: Record<string, string> = {
  all_active: 'Everyone still taking part, whatever stage they are at.',
  confirmed: 'Speakers who have accepted and confirmed.',
  unconfirmed: 'Invited speakers who have not answered yet.',
  missing_requirements: 'Anyone with an outstanding task on their readiness list.',
}

/**
 * The single next move for a campaign. The table shows the short form so a
 * column of them can be scanned; the drawer shows the sentence.
 */
const nextStepLabels: Record<CampaignStatus, string> = {
  draft: 'Submit for approval',
  awaiting_approval: 'Waiting for an approver',
  approved: 'Add to the outbox',
  queued: 'Waiting on email setup',
  sent: 'Nothing pending',
}

const nextStepDetails: Record<CampaignStatus, string> = {
  draft: 'Submitting recalculates the recipients and freezes that list for review.',
  awaiting_approval: 'An approver reads the frozen recipient list, then signs off.',
  approved: 'Adding it to the outbox writes one record per recipient. Nothing leaves yet.',
  queued:
    'Every recipient is recorded. Sending needs the email provider connected and the sender domain verified.',
  sent: 'The provider returned a final result for every recipient.',
}

const deliveryLabels: Record<CampaignDelivery['status'], string> = {
  pending_provider: 'In outbox',
  delivered: 'Delivered',
  failed: 'Failed',
  suppressed: 'Skipped',
}

const messageTokens = [
  '{{first_name}}',
  '{{last_name}}',
  '{{event_name}}',
  '{{event_date}}',
  '{{event_venue}}',
  '{{portal_url}}',
]

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function campaignTimestamp(campaign: Campaign) {
  if (campaign.sentAt) return { label: 'Completed', value: campaign.sentAt }
  if (campaign.queuedAt) return { label: 'Added to outbox', value: campaign.queuedAt }
  if (campaign.approvedAt) return { label: 'Approved', value: campaign.approvedAt }
  return { label: 'Created', value: campaign.createdAt }
}

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
        description="Draft a message, have someone approve it, then stage it for delivery."
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
            ['queued', 'In outbox'],
            ['sent', 'Sent'],
          ]}
        />
      </Toolbar>

      {campaigns.length === 0 ? (
        <EmptyState
          title={filter === 'all' ? 'No campaigns yet' : 'Nothing in this view'}
          description={
            filter === 'all'
              ? 'A campaign starts as a draft. Nobody receives anything until it is approved and staged for delivery.'
              : 'No campaign is at this stage right now.'
          }
          action={
            filter === 'all' ? (
              <Button size="compact" variant="primary" onClick={() => setComposing(true)}>
                <PlusIcon className="size-4 h-lh shrink-0 fill-current" />
                New campaign
              </Button>
            ) : (
              <Button size="compact" onClick={() => setFilter('all')}>
                Show all campaigns
              </Button>
            )
          }
        />
      ) : (
        <>
          <div className="hidden sm:block">
            <div className="-mx-6 -my-2 overflow-x-auto whitespace-nowrap">
              <div className="inline-block min-w-full px-6 py-2 align-middle">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-950/10">
                      {['Campaign', 'Audience', 'Recipients', 'Status', 'Next step', 'Updated'].map(
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
                            <span className="flex min-w-0 items-center gap-1.5 text-sm text-zinc-500">
                              {campaign.includeEventInvite ? (
                                <>
                                  <PaperClipIcon
                                    aria-hidden="true"
                                    className="size-4 h-lh shrink-0 fill-zinc-400"
                                  />
                                  <span className="sr-only">Carries the event invite.</span>
                                </>
                              ) : null}
                              <span className="truncate">{campaign.subject}</span>
                            </span>
                          </button>
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-600">
                          {audienceLabels[campaign.audience]}
                        </td>
                        <td className="py-3 pr-4 text-sm tabular-nums text-zinc-600">
                          {campaign.recipientParticipationIds.length}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={campaign.status} />
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-500">
                          {nextStepLabels[campaign.status]}
                        </td>
                        <td className="py-3 text-sm text-zinc-500">
                          {dayFormat.format(new Date(campaignTimestamp(campaign).value))}
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
                      <span className="flex min-w-0 items-center gap-1.5 text-base text-zinc-500">
                        {campaign.includeEventInvite ? (
                          <>
                            <PaperClipIcon
                              aria-hidden="true"
                              className="size-4 h-lh shrink-0 fill-zinc-400"
                            />
                            <span className="sr-only">Carries the event invite.</span>
                          </>
                        ) : null}
                        <span className="truncate">{campaign.subject}</span>
                      </span>
                      <span className="mt-2 block text-base text-zinc-500">
                        <span className="tabular-nums">
                          {campaign.recipientParticipationIds.length}
                        </span>{' '}
                        recipients · {nextStepLabels[campaign.status]}
                      </span>
                    </span>
                    <StatusBadge status={campaign.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

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
  const { payload, execute, eventCalendarUrl, mutating } = useWorkspace()
  const [messageView, setMessageView] = useState<'preview' | 'template'>('preview')
  if (!campaign) return null
  const deliveries =
    payload?.state.campaignDeliveries.filter((entry) => entry.campaignId === campaign.id) ?? []
  const preview = payload
    ? renderCampaignMessage(payload.state, campaign, campaign.recipientParticipationIds[0] ?? '')
    : null
  const timestamp = campaignTimestamp(campaign)
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
            'Added to the delivery outbox. Nothing sends until the email provider is connected and the sender domain is verified.',
          )
        }
      >
        <PaperAirplaneIcon className="size-4 h-lh shrink-0 fill-current" />
        Add to delivery outbox
      </Button>
    ) : undefined

  return (
    <Drawer open={open} onClose={onClose} title={campaign.name} footer={footer}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <StatusBadge status={campaign.status} />
          <p className="text-pretty text-base text-zinc-600 sm:text-sm">
            {nextStepDetails[campaign.status]}
          </p>
        </div>

        <dl className="grid grid-cols-2 border-y border-zinc-950/5">
          {[
            ['Audience', audienceLabels[campaign.audience]],
            ['Recipients', String(campaign.recipientParticipationIds.length)],
            ['Drafted by', campaign.createdBy],
            [timestamp.label, dayFormat.format(new Date(timestamp.value))],
          ].map(([label, value], index) => (
            <div
              key={label}
              className={cx(
                'min-w-0 border-zinc-950/5 py-3',
                index % 2 === 1 ? 'border-l pl-4' : 'pr-4',
                index > 1 && 'border-t',
              )}
            >
              <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
              <dd className="truncate text-base text-zinc-950 sm:text-sm">{value}</dd>
            </div>
          ))}
        </dl>

        <section aria-labelledby="campaign-message-heading" className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3
              id="campaign-message-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Message
            </h3>
            {preview ? (
              <FilterTabs
                label="Message view"
                value={messageView}
                onChange={setMessageView}
                options={[
                  ['preview', 'Preview'],
                  ['template', 'Template'],
                ]}
              />
            ) : null}
          </div>
          <div className="rounded-xl bg-white ring-1 ring-zinc-950/10">
            <div className="min-w-0 border-b border-zinc-950/5 px-4 py-3">
              <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                {preview && messageView === 'preview' ? preview.subject : campaign.subject}
              </p>
              <p className="truncate text-base text-zinc-500 sm:text-sm">
                {preview && messageView === 'preview'
                  ? `To ${preview.person.firstName} ${preview.person.lastName} · ${preview.person.email}`
                  : 'Fields in braces are filled in for each recipient.'}
              </p>
            </div>
            <p className="whitespace-pre-wrap text-pretty px-4 py-3 text-base text-zinc-700 sm:text-sm">
              {preview && messageView === 'preview' ? preview.body : campaign.body}
            </p>
          </div>
        </section>

        {campaign.includeEventInvite ? (
          <section aria-labelledby="campaign-attachment-heading" className="flex flex-col gap-3">
            <h3
              id="campaign-attachment-heading"
              className="text-base font-medium text-zinc-950 sm:text-sm"
            >
              Attachment
            </h3>
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
              <CalendarDaysIcon aria-hidden="true" className="size-4 h-lh shrink-0 fill-zinc-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                  Event invite (.ics)
                </span>
                <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                  Date, time, and venue, ready to add in Google Calendar, Outlook, or Apple
                  Calendar.
                </span>
              </span>
              <a
                href={eventCalendarUrl(campaign.eventId)}
                className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-base font-medium text-zinc-800 shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-50 sm:min-h-9 sm:text-sm"
              >
                <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
                Download
              </a>
            </div>
          </section>
        ) : null}

        {deliveries.length > 0 ? <DeliveryOutbox deliveries={deliveries} /> : null}

        <Callout
          tone={
            campaign.status === 'queued'
              ? 'warning'
              : campaign.status === 'sent'
                ? 'success'
                : 'info'
          }
          title={
            campaign.status === 'queued'
              ? 'Delivery is not switched on yet'
              : campaign.status === 'sent'
                ? 'The provider finished this campaign'
                : 'How a campaign reaches people'
          }
        >
          <p>
            {campaign.status === 'queued'
              ? 'Recipients, message, and attachment are recorded in the outbox, and nothing has reached an inbox. Two things are still outstanding: no email provider is connected to pick these up, and the sending domain has not been verified.'
              : campaign.status === 'sent'
                ? 'Every recipient below was either confirmed by the provider or skipped. Nothing is still pending.'
                : 'Recipients are recalculated when the draft is submitted, then frozen so approval reviews the exact list. Adding an approved campaign to the outbox twice does not duplicate anyone, and recipients without a usable address are skipped rather than retried.'}
          </p>
        </Callout>
      </div>
    </Drawer>
  )
}

const emptyCampaignForm = {
  name: '',
  subject: '',
  body: 'Hi {{first_name}},\n\n',
  audience: 'missing_requirements',
  includeEventInvite: false,
}

const acceptedSpeakerForm = {
  name: 'Accepted speaker welcome',
  subject: 'You’re confirmed for {{event_name}}',
  body: 'Hi {{first_name}},\n\nWe’re delighted to confirm you as a speaker at {{event_name}}. Your speaker workspace is ready for your bio, headshot, and session materials.\n\nThe event is {{event_date}} at {{event_venue}}. We’ve included a calendar invite.\n\nOpen your workspace: {{portal_url}}\n\nThank you,\nThe program team',
  audience: 'confirmed',
  includeEventInvite: true,
}

const templateOptions = [
  {
    value: 'blank',
    title: 'Blank campaign',
    detail: 'Write the subject and message yourself.',
  },
  {
    value: 'accepted_speaker',
    title: 'Accepted speaker welcome',
    detail: 'Goes to confirmed speakers, points them at their workspace, and carries the invite.',
  },
]

function ComposeDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { execute, mutating } = useWorkspace()
  const [form, setForm] = useState(emptyCampaignForm)
  const [template, setTemplate] = useState('blank')

  function chooseTemplate(value: string) {
    setTemplate(value)
    setForm(value === 'accepted_speaker' ? acceptedSpeakerForm : emptyCampaignForm)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'campaign.create-draft',
      form,
      undefined,
      'Campaign draft created.',
    )
    if (!response.ok) return
    setForm(emptyCampaignForm)
    setTemplate('blank')
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
        className="flex flex-col gap-6"
        onSubmit={(event) => void submit(event)}
      >
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          A draft sends nothing. Someone has to approve it, and it then waits in the outbox until an
          email provider is connected and the sender domain is verified.
        </p>

        <fieldset className="flex min-w-0 flex-col gap-2">
          <legend className="pb-2 text-base font-medium text-zinc-950 sm:text-sm">
            Start from
          </legend>
          {templateOptions.map((option) => (
            <label
              key={option.value}
              className="flex cursor-pointer items-start gap-3 rounded-xl bg-white p-3 ring-1 ring-zinc-950/10 has-checked:bg-blue-50 has-checked:ring-blue-600/30 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-blue-600 hover:bg-zinc-50"
            >
              <input
                type="radio"
                name="campaign-template"
                value={option.value}
                checked={template === option.value}
                onChange={() => chooseTemplate(option.value)}
                className="mt-0.5 size-4 shrink-0 accent-blue-600 focus-visible:outline-none"
              />
              <span className="min-w-0">
                <span className="block text-base font-medium text-zinc-950 sm:text-sm">
                  {option.title}
                </span>
                <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                  {option.detail}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <Field
          label="Internal name"
          htmlFor="campaign-name"
          hint="Only the program team sees this."
        >
          <input
            id="campaign-name"
            type="text"
            name="name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className={textControl}
          />
        </Field>

        <Field label="Audience" htmlFor="campaign-audience" hint={audienceHints[form.audience]}>
          <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
            <select
              id="campaign-audience"
              name="audience"
              value={form.audience}
              onChange={(event) =>
                setForm((current) => ({ ...current, audience: event.target.value }))
              }
              className={selectControl}
            >
              <option value="missing_requirements">{audienceLabels.missing_requirements}</option>
              <option value="confirmed">{audienceLabels.confirmed}</option>
              <option value="unconfirmed">{audienceLabels.unconfirmed}</option>
              <option value="all_active">{audienceLabels.all_active}</option>
            </select>
            <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
          </span>
        </Field>

        <Field label="Subject" htmlFor="campaign-subject">
          <input
            id="campaign-subject"
            type="text"
            name="subject"
            required
            value={form.subject}
            onChange={(event) =>
              setForm((current) => ({ ...current, subject: event.target.value }))
            }
            className={textControl}
          />
        </Field>

        <Field
          label="Message"
          htmlFor="campaign-body"
          hint="Each field is replaced per recipient when the message renders."
        >
          <textarea
            id="campaign-body"
            name="body"
            required
            rows={10}
            value={form.body}
            onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
            className={textAreaControl}
          />
          <span className="flex flex-wrap gap-1.5">
            {messageTokens.map((token) => (
              <span
                key={token}
                className="rounded-full bg-zinc-100 px-2 py-1 font-mono text-sm text-zinc-600 sm:py-0.5"
              >
                {token}
              </span>
            ))}
          </span>
        </Field>

        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-base font-medium text-zinc-950 sm:text-sm">Attachment</p>
          <Checkbox
            id="campaign-include-invite"
            name="includeEventInvite"
            label="Attach the event invite (.ics)"
            checked={form.includeEventInvite}
            onChange={(next) => setForm((current) => ({ ...current, includeEventInvite: next }))}
          />
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">
            Includes the date, time, and venue as a calendar file that opens in Google Calendar,
            Outlook, and Apple Calendar.
          </p>
        </div>
      </form>
    </Drawer>
  )
}

function DeliveryOutbox({ deliveries }: { deliveries: CampaignDelivery[] }) {
  const [expanded, setExpanded] = useState(false)
  const count = (status: CampaignDelivery['status']) =>
    deliveries.filter((entry) => entry.status === status).length
  const visible = expanded ? deliveries : deliveries.slice(0, 6)
  const counts: Array<[string, number]> = [
    ['In outbox', count('pending_provider')],
    ['Delivered', count('delivered')],
    ['Failed', count('failed')],
    ['Skipped', count('suppressed')],
  ]

  return (
    <section aria-labelledby="delivery-outbox-heading" className="flex flex-col gap-3">
      <div>
        <h3 id="delivery-outbox-heading" className="text-base font-medium text-zinc-950 sm:text-sm">
          Delivery outbox
        </h3>
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
          One record per recipient, written when the campaign was staged.
        </p>
      </div>

      <dl className="grid grid-cols-2 border-y border-zinc-950/5 sm:grid-cols-4">
        {counts.map(([label, value], index) => (
          <div
            key={label}
            className={cx(
              'min-w-0 border-zinc-950/5 py-3',
              index % 2 === 1 ? 'border-l pl-4' : 'pr-4',
              index > 1 && 'border-t sm:border-t-0',
              index === 2 && 'sm:border-l sm:pl-4',
            )}
          >
            <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums text-zinc-950">{value}</dd>
          </div>
        ))}
      </dl>

      <ul role="list" className="divide-y divide-zinc-950/5 rounded-xl ring-1 ring-zinc-950/10">
        {visible.map((delivery) => (
          <li key={delivery.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <span className="min-w-0">
              <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                {delivery.recipientName}
              </span>
              <span className="block truncate text-base text-zinc-500 sm:text-sm">
                {delivery.recipientEmail || 'No email address on file'}
              </span>
              {delivery.lastError ? (
                <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
                  {delivery.lastError}
                </span>
              ) : null}
            </span>
            <span
              className={cx(
                'shrink-0 rounded-full px-2 py-1 text-sm font-medium ring-1 sm:py-0.5',
                delivery.status === 'pending_provider' &&
                  'bg-zinc-100 text-zinc-700 ring-zinc-950/5',
                delivery.status === 'delivered' &&
                  'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
                delivery.status === 'failed' && 'bg-rose-50 text-rose-700 ring-rose-700/10',
                delivery.status === 'suppressed' && 'bg-amber-50 text-amber-700 ring-amber-700/10',
              )}
            >
              {deliveryLabels[delivery.status]}
            </span>
          </li>
        ))}
      </ul>

      {deliveries.length > 6 ? (
        <Button size="compact" className="self-start" onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Show fewer' : `Show all ${deliveries.length} recipients`}
        </Button>
      ) : null}
    </section>
  )
}
