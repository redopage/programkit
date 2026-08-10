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
  calendarAttachmentForParticipation,
  campaignPreview,
  participationPerson,
  readinessRows,
  renderCampaignMessage,
  type Campaign,
  type CampaignDelivery,
  type CampaignStatus,
  type OutboundMessage,
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
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

type CampaignFilter = 'all' | Campaign['status']

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

const dayFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

function campaignTimestamp(campaign: Campaign) {
  if (campaign.sentAt) return { label: 'Completed', value: campaign.sentAt }
  if (campaign.queuedAt) return { label: 'Added to outbox', value: campaign.queuedAt }
  if (campaign.approvedAt) return { label: 'Approved', value: campaign.approvedAt }
  return { label: 'Created', value: campaign.createdAt }
}

type CampaignTemplate = {
  id: string
  label: string
  name: string
  subject: string
  body: string
  audience: Campaign['audience']
  includeCalendarInvite: boolean
}

const campaignTemplates: CampaignTemplate[] = [
  {
    id: 'welcome',
    label: 'Welcome speakers',
    name: 'Speaker welcome',
    subject: 'Welcome to {{event_name}}, {{first_name}}',
    body: 'Hi {{first_name}},\n\nWe are glad you are joining us for {{event_name}}. Your session is {{session}}.\n\nOpen your private speaker portal to review the details:\n{{portal_link}}',
    audience: 'all_active',
    includeCalendarInvite: false,
  },
  {
    id: 'portal',
    label: 'Portal invitation',
    name: 'Speaker portal invitation',
    subject: 'Your {{event_name}} speaker portal',
    body: 'Hi {{first_name}},\n\nYour speaker portal is ready. Use it to update your profile and complete your assigned work:\n{{portal_link}}',
    audience: 'all_active',
    includeCalendarInvite: false,
  },
  {
    id: 'requirements',
    label: 'Outstanding tasks',
    name: 'Outstanding speaker tasks',
    subject: 'Tasks to finish for {{event_name}}',
    body: 'Hi {{first_name}},\n\nHere is what still needs your attention:\n\n{{outstanding_tasks}}\n\nOpen your speaker portal to finish these items:\n{{portal_link}}',
    audience: 'missing_requirements',
    includeCalendarInvite: false,
  },
  {
    id: 'calendar',
    label: 'Session calendar invite',
    name: 'Speaker calendar invite',
    subject: 'Add your {{event_name}} sessions to your calendar',
    body: 'Hi {{first_name}},\n\nYour session schedule for {{event_name}} is attached. Open the calendar file to add the confirmed time and room to Google Calendar, Outlook, or Apple Calendar.\n\nYou can also review your speaker workspace here:\n{{portal_link}}',
    audience: 'all_active',
    includeCalendarInvite: true,
  },
]

export function CommunicationsView({
  initialCompose = null,
}: {
  initialCompose?: 'reminder' | null
}) {
  const { payload } = useWorkspace()
  const [filter, setFilter] = useState<CampaignFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null)
  const [composeTemplateId, setComposeTemplateId] = useState(
    initialCompose === 'reminder' ? 'requirements' : 'welcome',
  )
  const [composing, setComposing] = useState(Boolean(initialCompose))
  if (!payload) return null
  const { state } = payload
  const campaigns = state.campaigns.filter(
    (campaign) => filter === 'all' || campaign.status === filter,
  )
  const selected = state.campaigns.find((campaign) => campaign.id === selectedId) ?? null
  const messages = (state.outboundMessages ?? []).filter(
    (message) => message.eventId === state.activeEventId,
  )
  const selectedMessage = messages.find((message) => message.id === selectedMessageId) ?? null

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Communications"
        description="Draft a message, have someone approve it, then stage it for delivery."
        actions={
          <Button
            variant="primary"
            onClick={() => {
              setComposeTemplateId('welcome')
              setComposing(true)
            }}
          >
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
                              {campaign.includeCalendarInvite ? (
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
                        {campaign.includeCalendarInvite ? (
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

      <section aria-labelledby="delivery-log-heading" className="pt-2">
        <div className="flex items-center justify-between gap-4 border-b border-zinc-950/10 pb-3">
          <h2 id="delivery-log-heading" className="text-lg font-semibold text-zinc-950">
            Delivery log
          </h2>
          <span className="text-sm tabular-nums text-zinc-500">
            {messages.length} message{messages.length === 1 ? '' : 's'}
          </span>
        </div>
        {messages.length > 0 ? (
          <>
            <div className="hidden sm:block">
              <div className="-mx-6 overflow-x-auto whitespace-nowrap px-6">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-950/10">
                      {['Recipient', 'Subject', 'Trigger', 'Status', 'Queued'].map((heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="whitespace-nowrap py-2.5 pr-4 text-left text-sm font-medium text-zinc-500"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-950/5">
                    {messages.map((message) => (
                      <tr key={message.id} className="hover:bg-zinc-950/2">
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            className="focus-ring rounded-lg text-left"
                            onClick={() => setSelectedMessageId(message.id)}
                          >
                            <span className="block text-sm font-medium text-zinc-950">
                              {message.recipientName}
                            </span>
                            <span className="block text-sm text-zinc-500">
                              {message.recipientEmail}
                            </span>
                          </button>
                        </td>
                        <td className="max-w-md py-3 pr-4 text-sm text-zinc-700">
                          <span className="block truncate">{message.subject}</span>
                        </td>
                        <td className="py-3 pr-4 text-sm text-zinc-500">
                          {sentenceCase(message.kind)}
                        </td>
                        <td className="py-3 pr-4">
                          <StatusBadge status={message.status} />
                        </td>
                        <td className="py-3 text-sm text-zinc-500">
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(message.queuedAt))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <ul role="list" className="divide-y divide-zinc-950/5 sm:hidden">
              {messages.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    className="focus-ring flex w-full items-start justify-between gap-3 rounded-lg py-4 text-left"
                    onClick={() => setSelectedMessageId(message.id)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-base font-medium text-zinc-950">
                        {message.subject}
                      </span>
                      <span className="block truncate text-base text-zinc-500">
                        {message.recipientName} · {message.recipientEmail}
                      </span>
                    </span>
                    <StatusBadge status={message.status} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="py-6 text-sm text-zinc-500">
            Submitted proposals, decisions, reminders, and campaigns will appear here.
          </p>
        )}
      </section>

      <CampaignDrawer
        campaign={selected}
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
      />
      <MessageDrawer
        message={selectedMessage}
        open={Boolean(selectedMessage)}
        onClose={() => setSelectedMessageId(null)}
      />
      <ComposeDrawer
        key={composeTemplateId}
        open={composing}
        initialTemplateId={composeTemplateId}
        onClose={() => setComposing(false)}
      />
    </div>
  )
}

function MessageDrawer({
  message,
  open,
  onClose,
}: {
  message: OutboundMessage | null
  open: boolean
  onClose: () => void
}) {
  if (!message) return null
  return (
    <Drawer open={open} onClose={onClose} title={message.subject}>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={message.status} />
          <span className="text-sm text-zinc-500">{sentenceCase(message.kind)}</span>
        </div>
        <dl className="grid gap-4">
          <div>
            <dt className="text-sm font-medium text-zinc-950">Recipient</dt>
            <dd className="text-sm text-zinc-500">
              {message.recipientName} · {message.recipientEmail}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-zinc-950">
              {message.status === 'sent' ? 'Sent' : 'Queued'}
            </dt>
            <dd className="text-sm text-zinc-500">
              {new Intl.DateTimeFormat('en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              }).format(new Date(message.sentAt ?? message.queuedAt))}
            </dd>
          </div>
          {(message.attempts ?? 0) > 0 ? (
            <div>
              <dt className="text-sm font-medium text-zinc-950">Delivery attempts</dt>
              <dd className="text-sm text-zinc-500">{message.attempts}</dd>
            </div>
          ) : null}
          {message.providerMessageId ? (
            <div>
              <dt className="text-sm font-medium text-zinc-950">Provider message</dt>
              <dd className="break-all text-sm text-zinc-500">{message.providerMessageId}</dd>
            </div>
          ) : null}
        </dl>
        <div className="rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <p className="whitespace-pre-wrap text-pretty text-sm text-zinc-700">{message.body}</p>
        </div>
        {message.calendarAttachment ? (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm text-blue-950 ring-1 ring-blue-600/10">
            <CalendarDaysIcon className="size-4 shrink-0 fill-blue-600" />
            <span className="min-w-0 truncate">{message.calendarAttachment.filename}</span>
            <span className="ml-auto shrink-0 text-blue-700">
              {message.calendarAttachment.eventCount}{' '}
              {message.calendarAttachment.eventCount === 1 ? 'session' : 'sessions'}
            </span>
          </div>
        ) : null}
        {message.status === 'sent' ? (
          <Callout tone="success" title="Delivered">
            <p>ProgramKit sent this message and recorded the provider result.</p>
          </Callout>
        ) : message.status === 'failed' ? (
          <Callout tone="warning" title="Delivery needs attention">
            <p>{message.lastError ?? 'The provider did not accept this message.'}</p>
            {message.nextAttemptAt ? (
              <p className="mt-1">
                ProgramKit will retry at{' '}
                {new Intl.DateTimeFormat('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                }).format(new Date(message.nextAttemptAt))}
                .
              </p>
            ) : null}
          </Callout>
        ) : (
          <Callout tone="info" title="Queued safely">
            <p>ProgramKit recorded the resolved recipient and will deliver it asynchronously.</p>
          </Callout>
        )}
      </div>
    </Drawer>
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
            'Campaign queued for delivery.',
          )
        }
      >
        <PaperAirplaneIcon className="size-4 h-lh shrink-0 fill-current" />
        Add to delivery outbox
      </Button>
    ) : campaign.status === 'queued' ? (
      <Button
        variant="primary"
        disabled={mutating}
        onClick={() =>
          void execute(
            'campaign.retry-deliveries',
            { campaignId: campaign.id },
            { expectedVersions: { [campaign.id]: campaign.version } },
            'Pending and failed recipients were queued for the email consumer.',
          )
        }
      >
        <PaperAirplaneIcon className="size-4 h-lh shrink-0 fill-current" />
        Retry pending delivery
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
          {campaign.includeCalendarInvite ? (
            <div>
              <dt className="text-base font-medium text-zinc-950 sm:text-sm">Calendar invite</dt>
              <dd className="text-pretty text-base text-zinc-500 sm:text-sm">
                Each scheduled speaker receives their own published sessions as an .ics file.
              </dd>
            </div>
          ) : null}
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

        {campaign.includeCalendarInvite ? (
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
                  Each deliverable recipient gets a personalized calendar request. This portable
                  preview opens in Google Calendar, Outlook, and Apple Calendar.
                </span>
              </span>
              <a
                href={eventCalendarUrl(campaign.eventId)}
                className="focus-ring inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-3 py-2 text-base font-medium text-zinc-800 shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-50 sm:min-h-9 sm:text-sm"
              >
                <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
                Download preview
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
              ? 'Provider confirmation is pending'
              : campaign.status === 'sent'
                ? 'The provider finished this campaign'
                : 'How a campaign reaches people'
          }
        >
          <p>
            {campaign.status === 'queued'
              ? 'The exact recipient, message, and calendar attachment are frozen in each row. A configured Cloudflare Email binding delivers them in the background and writes its message ID back here. Until that provider result exists, ProgramKit does not call the message delivered.'
              : campaign.status === 'sent'
                ? 'Every recipient below was either confirmed by the provider or skipped. Nothing is still pending.'
                : 'Recipients are recalculated when the draft is submitted, then frozen so approval reviews the exact list. Adding an approved campaign to the outbox twice does not duplicate anyone, and recipients without a usable address are skipped rather than retried.'}
          </p>
        </Callout>
      </div>
    </Drawer>
  )
}

function ComposeDrawer({
  open,
  initialTemplateId,
  onClose,
}: {
  open: boolean
  initialTemplateId: string
  onClose: () => void
}) {
  const { payload, execute, mutating } = useWorkspace()
  const defaultTemplate =
    campaignTemplates.find((template) => template.id === initialTemplateId) ?? campaignTemplates[0]
  const [templateId, setTemplateId] = useState<string>(defaultTemplate.id)
  const [previewId, setPreviewId] = useState('')
  const [form, setForm] = useState<{
    name: string
    subject: string
    body: string
    audience: Campaign['audience']
    includeCalendarInvite: boolean
  }>({
    name: defaultTemplate.name,
    subject: defaultTemplate.subject,
    body: defaultTemplate.body,
    audience: defaultTemplate.audience,
    includeCalendarInvite: defaultTemplate.includeCalendarInvite,
  })
  if (!payload) return null
  const { state } = payload
  const missingRequirementIds = new Set(
    readinessRows(state)
      .filter((row) => row.blockers > 0 && row.status !== 'prospect')
      .map((row) => row.participationId),
  )
  const previewRecipients = state.participations
    .filter(
      (participation) =>
        participation.eventId === state.activeEventId &&
        participation.status !== 'declined' &&
        participation.status !== 'withdrawn' &&
        participation.status !== 'prospect' &&
        (form.audience !== 'unconfirmed' || participation.status === 'invited') &&
        (form.audience !== 'missing_requirements' || missingRequirementIds.has(participation.id)),
    )
    .map((participation) => ({
      participation,
      person: participationPerson(state, participation),
    }))
    .filter((entry) => Boolean(entry.person))
  const resolvedPreviewId = previewRecipients.some((entry) => entry.participation.id === previewId)
    ? previewId
    : (previewRecipients[0]?.participation.id ?? '')
  const preview = resolvedPreviewId
    ? campaignPreview(state, { subject: form.subject, body: form.body }, resolvedPreviewId)
    : null
  const previewCalendar = resolvedPreviewId
    ? calendarAttachmentForParticipation(state, resolvedPreviewId)
    : null
  const scheduledRecipientCount = previewRecipients.filter(({ participation }) =>
    calendarAttachmentForParticipation(state, participation.id),
  ).length

  function applyTemplate(nextTemplateId: string) {
    const template = campaignTemplates.find((entry) => entry.id === nextTemplateId)
    if (!template) return
    setTemplateId(template.id)
    setForm((current) => ({
      ...current,
      name: template.name,
      subject: template.subject,
      body: template.body,
      audience: template.audience,
      includeCalendarInvite: template.includeCalendarInvite,
    }))
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
    setForm({
      name: defaultTemplate.name,
      subject: defaultTemplate.subject,
      body: defaultTemplate.body,
      audience: defaultTemplate.audience,
      includeCalendarInvite: defaultTemplate.includeCalendarInvite,
    })
    setTemplateId(defaultTemplate.id)
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
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Template</span>
          <span className="relative">
            <select
              value={templateId}
              onChange={(event) => applyTemplate(event.target.value)}
              className="focus-ring min-h-11 w-full appearance-none rounded-xl bg-white py-2 pr-9 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 sm:min-h-9 sm:text-sm"
            >
              {campaignTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.label}
                </option>
              ))}
            </select>
            <ChevronUpDownIcon className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 fill-zinc-400" />
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Internal name</span>
          <input
            id="campaign-name"
            type="text"
            name="name"
            required
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            className={textControl}
          />
        </label>

        <Field label="Audience" htmlFor="campaign-audience" hint={audienceHints[form.audience]}>
          <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
            <select
              id="campaign-audience"
              name="audience"
              value={form.audience}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  audience: event.target.value as Campaign['audience'],
                }))
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
        </Field>
        <div className="flex flex-col gap-1.5 rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <Checkbox
            id="campaign-calendar-invite"
            name="includeCalendarInvite"
            label="Attach each speaker's published schedule"
            checked={form.includeCalendarInvite}
            onChange={(includeCalendarInvite) =>
              setForm((current) => ({ ...current, includeCalendarInvite }))
            }
          />
          <p className="pl-7 text-sm text-zinc-500 sm:pl-6">
            {scheduledRecipientCount} of {previewRecipients.length} recipients currently have a
            published session. Calendar files work with Google Calendar, Outlook, and Apple
            Calendar.
          </p>
        </div>
        <div className="rounded-2xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">Recipient preview</p>
            {previewRecipients.length > 0 ? (
              <label className="relative">
                <span className="sr-only">Preview recipient</span>
                <select
                  value={resolvedPreviewId}
                  onChange={(event) => setPreviewId(event.target.value)}
                  className="focus-ring min-h-9 appearance-none rounded-full bg-white py-1.5 pr-8 pl-3 text-sm text-zinc-700 shadow-xs ring-1 ring-zinc-950/10"
                >
                  {previewRecipients.map(({ participation, person }) => (
                    <option key={participation.id} value={participation.id}>
                      {person!.firstName} {person!.lastName}
                    </option>
                  ))}
                </select>
                <ChevronUpDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 fill-zinc-400" />
              </label>
            ) : null}
          </div>
          {preview ? (
            <div className="mt-4 flex flex-col gap-3">
              <div>
                <p className="text-sm text-zinc-500">To</p>
                <p className="text-sm font-medium text-zinc-800">
                  {preview.recipientName} · {preview.recipientEmail}
                </p>
              </div>
              <div>
                <p className="text-sm text-zinc-500">Subject</p>
                <p className="text-pretty text-sm font-medium text-zinc-800">{preview.subject}</p>
              </div>
              <p className="whitespace-pre-wrap text-pretty text-sm text-zinc-700">
                {preview.body}
              </p>
              {form.includeCalendarInvite ? (
                previewCalendar ? (
                  <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-zinc-700 ring-1 ring-zinc-950/10">
                    <CalendarDaysIcon className="size-4 shrink-0 fill-blue-600" />
                    <span className="min-w-0 truncate">{previewCalendar.filename}</span>
                    <span className="ml-auto shrink-0 text-zinc-500">
                      {previewCalendar.eventCount}{' '}
                      {previewCalendar.eventCount === 1 ? 'session' : 'sessions'}
                    </span>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    This speaker has no session in the published schedule yet.
                  </p>
                )
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-zinc-500">
              Add a speaker to preview merge fields with real data.
            </p>
          )}
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
