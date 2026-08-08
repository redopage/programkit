import { describe, expect, it } from 'vitest'

import { createSeedState, executeOperation, type WorkspaceState } from '@programkit/core'
import { handleMcpRequest } from '@programkit/agent'

function harness() {
  let state = createSeedState()
  return {
    get state() {
      return state
    },
    context: {
      readState: async () => structuredClone(state),
      execute: async (operation: string, request: Parameters<typeof executeOperation>[2]) => {
        const result = executeOperation(state, operation, request)
        state = result.state
        return result.response
      },
    },
  }
}

function modernRequest(
  method: string,
  params: Record<string, unknown>,
  id: string | number = 1,
  options: { clientCapabilities?: unknown; headerName?: string } = {},
) {
  const name =
    method === 'tools/call' ? params.name : method === 'resources/read' ? params.uri : null
  return new Request('http://localhost:4173/mcp', {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
      ...(name ? { 'mcp-name': options.headerName ?? String(name) } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'test', version: '1.0.0' },
          ...(!('clientCapabilities' in options)
            ? { 'io.modelcontextprotocol/clientCapabilities': {} }
            : options.clientCapabilities === undefined
              ? {}
              : {
                  'io.modelcontextprotocol/clientCapabilities': options.clientCapabilities,
                }),
        },
      },
    }),
  })
}

describe('MCP server', () => {
  it('implements current stateless discovery and a curated tool catalog', async () => {
    const test = harness()
    const discovery = await handleMcpRequest(modernRequest('server/discover', {}), test.context)
    const discoveryBody = (await discovery.json()) as { result: { supportedVersions: string[] } }
    expect(discoveryBody.result.supportedVersions).toContain('2026-07-28')
    expect((discoveryBody.result as Record<string, unknown>)._meta).toMatchObject({
      'io.modelcontextprotocol/serverInfo': { name: 'programkit' },
    })

    const listed = await handleMcpRequest(modernRequest('tools/list', {}), test.context)
    const listedBody = (await listed.json()) as {
      result: { resultType: string; tools: Array<{ name: string }> }
    }
    expect(listedBody.result.resultType).toBe('complete')
    expect(listedBody.result.tools.map((tool) => tool.name)).toContain('get_readiness_report')
    expect(listedBody.result.tools.map((tool) => tool.name)).not.toContain('send_campaign')
    expect(listedBody.result.tools.map((tool) => tool.name)).not.toContain('publish_schedule')
  })

  it('returns structured readiness evidence', async () => {
    const test = harness()
    const response = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'get_readiness_report',
        arguments: { onlyBlockers: true },
      }),
      test.context,
    )
    const body = (await response.json()) as {
      result: {
        structuredContent: {
          generatedAt: string
          summary: { blockers: number }
          requirementDefinitions: Array<{
            id: string
            label: string
            required: boolean
            dueAt?: string
          }>
          rows: unknown[]
        }
      }
    }
    expect(Number.isNaN(Date.parse(body.result.structuredContent.generatedAt))).toBe(false)
    expect(body.result.structuredContent.summary.blockers).toBeGreaterThan(0)
    expect(body.result.structuredContent.requirementDefinitions).toEqual(
      test.state.requirementDefinitions.map((definition) => ({
        id: definition.id,
        label: definition.label,
        required: definition.required,
        ...(definition.dueAt ? { dueAt: definition.dueAt } : {}),
      })),
    )
    expect(body.result.structuredContent.rows.length).toBeGreaterThan(0)
  })

  it('lists and filters change sets while enforcing the declared status schema', async () => {
    const test = harness()
    const listed = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'list_change_sets',
        arguments: { status: 'awaiting_approval' },
      }),
      test.context,
    )
    const listedBody = (await listed.json()) as {
      result: {
        isError: boolean
        structuredContent: {
          count: number
          changeSets: Array<{
            id: string
            status: string
            operations: string[]
            warnings: string[]
          }>
        }
        _meta: Record<string, unknown>
      }
    }
    expect(listedBody.result.isError).toBe(false)
    expect(listedBody.result.structuredContent.count).toBe(1)
    expect(listedBody.result.structuredContent.changeSets[0]).toMatchObject({
      id: 'chg_agent_001',
      status: 'awaiting_approval',
      operations: ['schedule.move-session'],
    })
    expect(listedBody.result._meta).toMatchObject({
      'io.modelcontextprotocol/serverInfo': { name: 'programkit', version: '0.1.0' },
    })

    const invalid = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'list_change_sets',
        arguments: { status: 'pending' },
      }),
      test.context,
    )
    const invalidBody = (await invalid.json()) as {
      result: { isError: boolean; structuredContent: { error: string } }
    }
    expect(invalidBody.result.isError).toBe(true)
    expect(invalidBody.result.structuredContent.error).toContain('status must be one of')
  })

  it('returns the mutable schedule draft alongside the immutable published release', async () => {
    const test = harness()
    const publishedRoomId = test.state.scheduleReleases[0].placements[0].roomId
    test.state.scheduleReleases.unshift({
      ...structuredClone(test.state.scheduleReleases[0]),
      id: 'sch_nyc_2026_v4',
      version: 4,
    })
    test.state.scheduleReleases.push({
      ...structuredClone(test.state.scheduleReleases[0]),
      id: 'sch_other_event_v99',
      eventId: 'evt_other',
      version: 99,
    })
    test.state.placements.push({
      ...structuredClone(test.state.placements[0]),
      id: 'plc_other_event',
      eventId: 'evt_other',
    })
    test.state.placements[0].roomId = 'rom_studio'

    const response = await handleMcpRequest(
      modernRequest('tools/call', { name: 'get_schedule', arguments: {} }),
      test.context,
    )
    const body = (await response.json()) as {
      result: {
        isError: boolean
        structuredContent: {
          placements: Array<{
            placement: { id: string; roomId: string }
            room: { id: string } | null
          }>
          latestPublishedRelease: {
            id: string
            version: number
            placements: Array<{ id: string; roomId: string }>
          }
          revision: number
        }
      }
    }
    const draft = body.result.structuredContent.placements.find(
      (entry) => entry.placement.id === 'plc_001',
    )
    const released = body.result.structuredContent.latestPublishedRelease.placements.find(
      (entry) => entry.id === 'plc_001',
    )
    expect(body.result.isError).toBe(false)
    expect(
      body.result.structuredContent.placements.some(
        (entry) => entry.placement.id === 'plc_other_event',
      ),
    ).toBe(false)
    expect(draft).toMatchObject({ placement: { roomId: 'rom_studio' }, room: { id: 'rom_studio' } })
    expect(released?.roomId).toBe(publishedRoomId)
    expect(body.result.structuredContent.latestPublishedRelease).toMatchObject({
      id: 'sch_nyc_2026_v4',
      version: 4,
    })
    expect(body.result.structuredContent.revision).toBe(test.state.revision)
  })

  it('exposes publication preflight through both the tool and typed resource', async () => {
    const test = harness()
    test.state.scheduleReleases.push({
      ...structuredClone(test.state.scheduleReleases[0]),
      id: 'sch_other_event_v99',
      eventId: 'evt_other',
      version: 99,
    })
    const toolResponse = await handleMcpRequest(
      modernRequest('tools/call', { name: 'preflight_program_publish', arguments: {} }),
      test.context,
    )
    const toolBody = (await toolResponse.json()) as {
      result: {
        isError: boolean
        structuredContent: {
          status: string
          blockers: string[]
          warnings: string[]
          hardConflicts: unknown[]
          participantBlockers: Array<{ participationId: string; issues: string[] }>
          pendingChangeSets: Array<{ id: string; status: string }>
          latestPublishedRelease: string | null
          exportAvailable: boolean
        }
        _meta: Record<string, unknown>
      }
    }
    expect(toolBody.result.isError).toBe(false)
    expect(toolBody.result.structuredContent).toMatchObject({
      status: 'BLOCKED',
      hardConflicts: [],
      latestPublishedRelease: 'sch_nyc_2026_v3',
      exportAvailable: true,
    })
    expect(toolBody.result.structuredContent.participantBlockers.length).toBeGreaterThan(0)
    expect(toolBody.result.structuredContent.pendingChangeSets).toContainEqual({
      id: 'chg_agent_001',
      title: 'Give Small models, serious work more room',
      status: 'awaiting_approval',
    })
    expect(toolBody.result._meta).toMatchObject({
      'io.modelcontextprotocol/serverInfo': { name: 'programkit', version: '0.1.0' },
    })

    const resources = await handleMcpRequest(modernRequest('resources/list', {}), test.context)
    const resourcesBody = (await resources.json()) as {
      result: { resources: Array<{ uri: string; mimeType: string }> }
    }
    expect(resourcesBody.result.resources).toContainEqual(
      expect.objectContaining({
        uri: 'ops://events/current/preflight',
        mimeType: 'application/json',
      }),
    )

    const resourceResponse = await handleMcpRequest(
      modernRequest('resources/read', { uri: 'ops://events/current/preflight' }),
      test.context,
    )
    const resourceBody = (await resourceResponse.json()) as {
      result: {
        resultType: string
        contents: Array<{ uri: string; mimeType: string; text: string }>
        _meta: Record<string, unknown>
      }
    }
    expect(resourceBody.result.resultType).toBe('complete')
    expect(resourceBody.result._meta).toMatchObject({
      'io.modelcontextprotocol/serverInfo': { name: 'programkit', version: '0.1.0' },
    })
    expect(resourceBody.result.contents[0]).toMatchObject({
      uri: 'ops://events/current/preflight',
      mimeType: 'application/json',
    })
    expect(JSON.parse(resourceBody.result.contents[0].text)).toEqual(
      toolBody.result.structuredContent,
    )
  })

  it('creates a schedule proposal without mutating placements', async () => {
    const test = harness()
    const before = structuredClone(test.state) as WorkspaceState
    const response = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'propose_schedule_move',
        arguments: {
          placementId: 'plc_007',
          roomId: 'rom_main',
          startsAt: '2026-10-04T17:00:00.000Z',
          reason: 'Increase room capacity.',
          expectedVersion: 1,
        },
      }),
      test.context,
    )
    const body = (await response.json()) as { result: { isError: boolean } }
    expect(body.result.isError).toBe(false)
    expect(test.state.placements.find((placement) => placement.id === 'plc_007')?.roomId).toBe(
      before.placements.find((placement) => placement.id === 'plc_007')?.roomId,
    )
    expect(test.state.changeSets[0].status).toBe('awaiting_approval')
  })

  it('rejects missing capabilities and routing-header mismatches with modern error codes', async () => {
    const test = harness()
    const missingCapabilities = await handleMcpRequest(
      modernRequest('tools/list', {}, 1, { clientCapabilities: undefined }),
      test.context,
    )
    const missingBody = (await missingCapabilities.json()) as { error: { code: number } }
    expect(missingCapabilities.status).toBe(400)
    expect(missingBody.error.code).toBe(-32021)

    const mismatch = await handleMcpRequest(
      modernRequest('tools/call', { name: 'get_readiness_report', arguments: {} }, 2, {
        headerName: 'wrong-tool',
      }),
      test.context,
    )
    const mismatchBody = (await mismatch.json()) as { error: { code: number } }
    expect(mismatch.status).toBe(400)
    expect(mismatchBody.error.code).toBe(-32020)
  })

  it('accepts sentinel-encoded routing names and stamps server identity', async () => {
    const test = harness()
    const name = 'get_readiness_report'
    const encoded = `=?base64?${btoa(name)}?=`
    const response = await handleMcpRequest(
      modernRequest('tools/call', { name, arguments: {} }, 1, { headerName: encoded }),
      test.context,
    )
    const body = (await response.json()) as {
      result: { isError: boolean; _meta: Record<string, unknown> }
    }
    expect(body.result.isError).toBe(false)
    expect(body.result._meta).toMatchObject({
      'io.modelcontextprotocol/serverInfo': { name: 'programkit', version: '0.1.0' },
    })
  })

  it('validates tool schemas and proposed domain references before storing a change set', async () => {
    const test = harness()
    const before = test.state.changeSets.length
    const invalidArguments = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'get_readiness_report',
        arguments: { onlyBlockers: 'yes', extra: true },
      }),
      test.context,
    )
    const invalidArgumentsBody = (await invalidArguments.json()) as {
      result: { isError: boolean }
    }
    expect(invalidArgumentsBody.result.isError).toBe(true)

    const invalidReference = await handleMcpRequest(
      modernRequest('tools/call', {
        name: 'propose_schedule_move',
        arguments: {
          placementId: 'plc_007',
          roomId: 'missing-room',
          startsAt: '2026-10-04T17:00:00.000Z',
          reason: 'Test invalid reference.',
          expectedVersion: 1,
        },
      }),
      test.context,
    )
    const invalidReferenceBody = (await invalidReference.json()) as {
      result: { isError: boolean }
    }
    expect(invalidReferenceBody.result.isError).toBe(true)
    expect(test.state.changeSets).toHaveLength(before)
  })

  it('uses current resource errors and rejects legacy initialization', async () => {
    const test = harness()
    const missing = await handleMcpRequest(
      modernRequest('resources/read', { uri: 'ops://missing' }),
      test.context,
    )
    const missingBody = (await missing.json()) as { error: { code: number } }
    expect(missingBody.error.code).toBe(-32602)

    const initialize = await handleMcpRequest(modernRequest('initialize', {}), test.context)
    const initializeBody = (await initialize.json()) as { error: { code: number } }
    expect(initializeBody.error.code).toBe(-32601)
  })
})
