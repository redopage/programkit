import { describe, expect, it } from 'vitest'

import {
  handleCoreRequest,
  MemoryWorkspaceRepository,
  type OperationResponse,
  type WorkspaceState,
} from '@crm-library/core'

describe('operation HTTP surface', () => {
  it('serves state, manifest, public agenda, and a portable export', async () => {
    const repository = new MemoryWorkspaceRepository()
    const stateResponse = await handleCoreRequest(
      new Request('http://local/api/v1/state'),
      repository,
    )
    expect(stateResponse?.status).toBe(200)
    const stateBody = (await stateResponse?.json()) as { state: { people: unknown[] } }
    expect(stateBody.state.people).toHaveLength(16)

    const manifestResponse = await handleCoreRequest(
      new Request('http://local/api/v1/manifest'),
      repository,
    )
    const manifestBody = (await manifestResponse?.json()) as { operations: unknown[] }
    expect(manifestBody.operations.length).toBeGreaterThan(10)

    const agendaResponse = await handleCoreRequest(
      new Request('http://local/public/agenda.json'),
      repository,
    )
    const agendaBody = (await agendaResponse?.json()) as { agenda: unknown[] }
    expect(agendaBody.agenda).toHaveLength(10)

    const exportResponse = await handleCoreRequest(
      new Request('http://local/api/v1/export'),
      repository,
    )
    expect(exportResponse?.headers.get('content-disposition')).toContain('aie-export.json')
  })

  it('returns a participant-specific projection without operator-only records', async () => {
    const repository = new MemoryWorkspaceRepository()
    const actor = {
      type: 'participant' as const,
      id: 'par_003',
      name: 'Jordan Bell',
      scopes: ['participations:write', 'requirements:write', 'portal:write'],
    }
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/portal/par_003/state'),
      repository,
      { actor },
    )
    expect(response?.status).toBe(200)
    const body = (await response?.json()) as { state: WorkspaceState }
    expect(body.state.people).toHaveLength(1)
    expect(body.state.participations).toHaveLength(1)
    expect(body.state.participations[0].internalNotes).toBe('')
    expect(body.state.campaigns).toHaveLength(0)
    expect(body.state.integrations).toHaveLength(0)
    expect(body.state.changeSets).toHaveLength(0)
    expect(body.state.domainEvents).toHaveLength(0)
  })

  it('ignores caller-supplied actors and uses the trusted request context', async () => {
    const repository = new MemoryWorkspaceRepository()
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/operations/workspace.reset-demo', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          input: {},
          actor: { type: 'staff', id: 'forged', name: 'Forged', scopes: ['*'] },
        }),
      }),
      repository,
      {
        actor: {
          type: 'participant',
          id: 'par_003',
          name: 'Participant',
          scopes: ['portal:write'],
        },
      },
    )
    const body = (await response?.json()) as OperationResponse
    expect(body.ok).toBe(false)
    expect(body.error?.code).toBe('FORBIDDEN')
  })

  it('serializes concurrent mutations through the repository boundary', async () => {
    const repository = new MemoryWorkspaceRepository()
    const create = (firstName: string, email: string) =>
      handleCoreRequest(
        new Request('http://local/api/v1/operations/person.create', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ input: { firstName, lastName: 'Concurrent', email } }),
        }),
        repository,
      )
    await Promise.all([
      create('First', 'first.concurrent@example.com'),
      create('Second', 'second.concurrent@example.com'),
    ])
    const state = await repository.read()
    expect(state.people.some((person) => person.email === 'first.concurrent@example.com')).toBe(
      true,
    )
    expect(state.people.some((person) => person.email === 'second.concurrent@example.com')).toBe(
      true,
    )
  })

  it('rejects declared oversized requests before buffering them', async () => {
    const repository = new MemoryWorkspaceRepository()
    const response = await handleCoreRequest(
      new Request('http://local/api/v1/operations/person.create', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'content-length': '200000',
        },
        body: JSON.stringify({ input: {} }),
      }),
      repository,
    )
    expect(response?.status).toBe(400)
    expect(await response?.json()).toMatchObject({ error: 'Request body is too large.' })
  })
})
