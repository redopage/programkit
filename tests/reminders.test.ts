import { afterEach, describe, expect, it, vi } from 'vitest'

import { executeOperation } from '@programkit/core'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'

import { createSeedState } from '../packages/core/src/seed.ts'
import { MemoryStorage } from './support/cloudflare-workers.ts'

const staff = {
  type: 'staff' as const,
  id: 'staff_test',
  name: 'Jordan Alvarez',
  scopes: ['requirements:write'],
}

const scheduler = {
  type: 'system' as const,
  id: 'scheduler',
  name: 'Automatic reminder scheduler',
  scopes: ['requirements:write'],
}

describe('automatic speaker task reminders', () => {
  afterEach(() => vi.useRealTimers())

  it('queues one personalized reminder for the current due-date window', () => {
    const created = executeOperation(createSeedState(), 'requirement.create', {
      input: {
        label: 'Sign speaker release form',
        dueAt: '2027-01-03T17:00:00.000Z',
        participationIds: ['par_001'],
        automaticReminders: true,
      },
      actor: staff,
    })
    expect(created.response.ok).toBe(true)

    const processed = executeOperation(created.state, 'requirement.process-reminders', {
      input: { at: '2027-01-01T18:00:00.000Z' },
      actor: scheduler,
    })
    expect(processed.response.ok).toBe(true)
    const message = processed.state.outboundMessages?.[0]
    expect(message).toMatchObject({
      kind: 'requirement_reminder',
      status: 'queued',
      recipientEmail: 'robin@axiom.dev',
      attempts: 0,
    })
    expect(message?.subject).toContain('Sign speaker release form')
    expect(message?.body).toContain('January 3, 2027')
    expect(message?.body).toContain('/portal/par_001/')

    const repeated = executeOperation(processed.state, 'requirement.process-reminders', {
      input: { at: '2027-01-01T19:00:00.000Z' },
      actor: scheduler,
    })
    expect(repeated.state.outboundMessages).toHaveLength(1)
  })

  it('stops future reminders when the task is complete', () => {
    const created = executeOperation(createSeedState(), 'requirement.create', {
      input: {
        label: 'Confirm participation',
        dueAt: '2027-01-03T17:00:00.000Z',
        participationIds: ['par_001'],
        automaticReminders: true,
      },
      actor: staff,
    })
    const requirementInstanceId = (
      created.response.data as { requirementInstances: Array<{ id: string }> }
    ).requirementInstances[0].id
    const completed = executeOperation(created.state, 'requirement.set-status', {
      input: { requirementInstanceId, status: 'approved' },
      actor: staff,
    })
    const processed = executeOperation(completed.state, 'requirement.process-reminders', {
      input: { at: '2027-01-03T18:00:00.000Z' },
      actor: scheduler,
    })
    expect(processed.state.outboundMessages).toHaveLength(0)
  })

  it('delivers due reminders from the Durable Object alarm and records the provider result', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T18:00:00.000Z'))
    const storage = new MemoryStorage()
    const sent: Array<Record<string, unknown>> = []
    const workspace = new WorkspaceDurableObject(
      { storage } as unknown as DurableObjectState,
      {
        PROGRAMKIT_APP_ORIGIN: 'https://app.programkit.dev',
        PROGRAMKIT_EMAIL_FROM: 'notifications@mail.programkit.dev',
        PROGRAMKIT_SUPPORT_EMAIL: 'support@programkit.dev',
        EMAIL: {
          async send(message: Record<string, unknown>) {
            sent.push(message)
            return { messageId: 'provider-message-001' }
          },
        },
      } as unknown as Cloudflare.Env,
    )

    const response = await workspace.fetch(
      new Request('http://workspace.internal/api/v1/operations/requirement.create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-programkit-internal-actor-type': 'staff',
          'x-programkit-internal-actor-id': 'staff_test',
          'x-programkit-internal-actor-name': 'Jordan Alvarez',
          'x-programkit-internal-actor-scopes': 'requirements:write workspace:read',
        },
        body: JSON.stringify({
          input: {
            label: 'Complete bio and profile',
            dueAt: '2027-01-03T17:00:00.000Z',
            participationIds: ['par_001'],
            automaticReminders: true,
          },
        }),
      }),
    )
    expect(response.status).toBe(200)
    expect(storage.alarm).not.toBeNull()

    await workspace.alarm()
    expect(sent).toEqual([
      expect.objectContaining({
        to: 'robin@axiom.dev',
        subject: expect.stringContaining('Complete bio and profile'),
        text: expect.stringContaining('https://app.programkit.dev/portal/par_001/'),
      }),
    ])

    const stateResponse = await workspace.fetch(
      new Request('http://workspace.internal/api/v1/state', {
        headers: {
          'x-programkit-internal-actor-type': 'staff',
          'x-programkit-internal-actor-id': 'staff_test',
          'x-programkit-internal-actor-name': 'Jordan Alvarez',
          'x-programkit-internal-actor-scopes': 'workspace:read',
        },
      }),
    )
    const payload = (await stateResponse.json()) as {
      state: ReturnType<typeof createSeedState>
    }
    expect(payload.state.outboundMessages?.[0]).toMatchObject({
      kind: 'requirement_reminder',
      status: 'sent',
      attempts: 1,
      providerMessageId: 'provider-message-001',
    })
  })

  it('persists provider failures and retries them from the next alarm', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-01T18:00:00.000Z'))
    const storage = new MemoryStorage()
    let attempts = 0
    const workspace = new WorkspaceDurableObject(
      { storage } as unknown as DurableObjectState,
      {
        PROGRAMKIT_APP_ORIGIN: 'https://app.programkit.dev',
        PROGRAMKIT_EMAIL_FROM: 'notifications@mail.programkit.dev',
        EMAIL: {
          async send() {
            attempts += 1
            if (attempts === 1) throw new Error('Temporary provider outage')
            return { messageId: 'provider-message-retry' }
          },
        },
      } as unknown as Cloudflare.Env,
    )

    await workspace.fetch(
      new Request('http://workspace.internal/api/v1/operations/requirement.create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-programkit-internal-actor-type': 'staff',
          'x-programkit-internal-actor-id': 'staff_test',
          'x-programkit-internal-actor-name': 'Jordan Alvarez',
          'x-programkit-internal-actor-scopes': 'requirements:write workspace:read',
        },
        body: JSON.stringify({
          input: {
            label: 'Upload final slides',
            dueAt: '2027-01-03T17:00:00.000Z',
            participationIds: ['par_001'],
            automaticReminders: true,
          },
        }),
      }),
    )

    await workspace.alarm()
    const failed = JSON.parse(String(storage.values.get('workspace-state:chunk:0'))) as ReturnType<
      typeof createSeedState
    >
    expect(failed.outboundMessages?.[0]).toMatchObject({
      status: 'failed',
      attempts: 1,
      lastError: 'Temporary provider outage',
      nextAttemptAt: '2027-01-01T18:01:00.000Z',
    })
    expect(storage.alarm).toBe(new Date('2027-01-01T18:01:00.000Z').getTime())

    vi.setSystemTime(new Date('2027-01-01T18:01:00.000Z'))
    await workspace.alarm()
    const delivered = JSON.parse(
      String(storage.values.get('workspace-state:chunk:0')),
    ) as ReturnType<typeof createSeedState>
    expect(delivered.outboundMessages?.[0]).toMatchObject({
      status: 'sent',
      attempts: 2,
      providerMessageId: 'provider-message-retry',
      lastError: null,
      nextAttemptAt: null,
    })
  })
})
