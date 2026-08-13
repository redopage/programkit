import { describe, expect, it } from 'vitest'

import { createSeedState, executeOperation } from '@programkit/core'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'

import { MemoryStorage } from './support/cloudflare-workers.ts'

function firstPortalParticipation() {
  const state = createSeedState()
  const participation = state.participations.find(
    (entry) => entry.eventId === state.activeEventId && Boolean(entry.portalAccessKey),
  )!
  return { state, participation }
}

describe('outbound communication safety', () => {
  it('suppresses pending and future email until an organizer removes the suppression', () => {
    const { state: initialState, participation } = firstPortalParticipation()
    let result = executeOperation(initialState, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    const queued = (result.state.outboundMessages ?? [])[0]!
    expect(queued.status).toBe('queued')

    result = executeOperation(result.state, 'communications.suppress-email', {
      input: {
        email: `  ${queued.recipientEmail.toUpperCase()}  `,
        reason: 'Recipient asked not to receive event email.',
      },
      expectedVersions: { [queued.id]: queued.version ?? 1 },
    })
    expect(result.response.ok, JSON.stringify(result.response)).toBe(true)
    expect(result.state.emailSuppressions).toEqual([
      expect.objectContaining({
        email: queued.recipientEmail,
        reason: 'Recipient asked not to receive event email.',
      }),
    ])
    expect(
      result.state.outboundMessages?.find((message) => message.id === queued.id),
    ).toMatchObject({
      status: 'suppressed',
      nextAttemptAt: null,
      lastError: 'Suppressed: Recipient asked not to receive event email.',
    })

    result = executeOperation(result.state, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    expect(result.state.outboundMessages?.[0]).toMatchObject({
      recipientEmail: queued.recipientEmail,
      status: 'suppressed',
      attempts: 0,
    })

    const suppression = (result.state.emailSuppressions ?? [])[0]!
    result = executeOperation(result.state, 'communications.remove-suppression', {
      input: { suppressionId: suppression.id },
      expectedVersions: { [suppression.id]: suppression.version },
    })
    expect(result.response.ok, JSON.stringify(result.response)).toBe(true)
    expect(result.state.emailSuppressions).toEqual([])

    result = executeOperation(result.state, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    expect(result.state.outboundMessages?.[0]?.status).toBe('queued')
  })

  it('cancels one unsent message with a guarded version and leaves a durable audit event', () => {
    const { state, participation } = firstPortalParticipation()
    const sent = executeOperation(state, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    const queued = (sent.state.outboundMessages ?? [])[0]!

    const cancelled = executeOperation(sent.state, 'communications.cancel-message', {
      input: { messageId: queued.id },
      expectedVersions: { [queued.id]: queued.version ?? 1 },
    })
    expect(cancelled.response.ok, JSON.stringify(cancelled.response)).toBe(true)
    expect(cancelled.state.outboundMessages?.[0]).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'Alex Morgan',
      nextAttemptAt: null,
    })
    expect(cancelled.state.domainEvents.at(-1)).toMatchObject({
      type: 'communications.message-cancelled',
      aggregate: { id: queued.id },
    })

    const repeated = executeOperation(cancelled.state, 'communications.cancel-message', {
      input: { messageId: queued.id },
    })
    expect(repeated.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    })
  })

  it('cancels a campaign before approval or delivery', () => {
    const state = createSeedState()
    const campaign = state.campaigns.find((entry) => entry.status === 'awaiting_approval')!
    const cancelled = executeOperation(state, 'campaign.cancel', {
      input: { campaignId: campaign.id },
      expectedVersions: { [campaign.id]: campaign.version },
    })

    expect(cancelled.response.ok, JSON.stringify(cancelled.response)).toBe(true)
    expect(cancelled.state.campaigns.find((entry) => entry.id === campaign.id)).toMatchObject({
      status: 'cancelled',
      cancelledBy: 'Alex Morgan',
    })
    expect(
      cancelled.state.outboundMessages?.filter((message) => message.campaignId === campaign.id),
    ).toEqual([])

    const approved = executeOperation(cancelled.state, 'campaign.approve', {
      input: { campaignId: campaign.id },
    })
    expect(approved.response).toMatchObject({
      ok: false,
      error: { code: 'INVALID_TRANSITION' },
    })
  })

  it('never hands cancelled or suppressed messages to the email provider', async () => {
    const { state: initialState, participation } = firstPortalParticipation()
    const first = executeOperation(initialState, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    const firstMessage = (first.state.outboundMessages ?? [])[0]!
    const cancelled = executeOperation(first.state, 'communications.cancel-message', {
      input: { messageId: firstMessage.id },
    })
    const second = executeOperation(cancelled.state, 'campaign.send-portal-invite', {
      input: { participationId: participation.id },
    })
    const secondMessage = (second.state.outboundMessages ?? [])[0]!
    const suppressed = executeOperation(second.state, 'communications.suppress-email', {
      input: { email: secondMessage.recipientEmail, reason: 'No event email.' },
    })

    const storage = new MemoryStorage()
    storage.values.set('workspace-state', suppressed.state)
    const delivered: Array<Record<string, unknown>> = []
    const workspace = new WorkspaceDurableObject(
      { storage } as unknown as DurableObjectState,
      {
        PROGRAMKIT_EMAIL_FROM: 'notifications@mail.programkit.dev',
        EMAIL: {
          async send(message: Record<string, unknown>) {
            delivered.push(message)
            return { messageId: 'provider-should-not-be-called' }
          },
        },
      } as unknown as Cloudflare.Env,
    )

    await workspace.alarm()
    expect(delivered).toEqual([])
  })
})
