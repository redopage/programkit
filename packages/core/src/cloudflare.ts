import { DurableObject } from 'cloudflare:workers'

import { handleCoreRequest } from './http.ts'
import { normalizeWorkspaceState } from './migrations.ts'
import type { WorkspaceRepository } from './repository.ts'
import { createSeedState } from './seed.ts'
import type { Actor, WorkspaceState } from './types.ts'

function actorFromRequest(request: Request): Actor {
  const type = request.headers.get('x-programkit-internal-actor-type')
  const allowedTypes = [
    'staff',
    'participant',
    'reviewer',
    'submitter',
    'agent',
    'service',
    'system',
  ] as const
  const actorType = allowedTypes.find((entry) => entry === type) ?? 'service'
  return {
    type: actorType,
    id: request.headers.get('x-programkit-internal-actor-id') ?? 'anonymous',
    name: request.headers.get('x-programkit-internal-actor-name') ?? 'Anonymous',
    scopes: (request.headers.get('x-programkit-internal-actor-scopes') ?? '')
      .split(' ')
      .filter(Boolean),
  }
}

class DurableObjectRepository implements WorkspaceRepository {
  constructor(private readonly storage: DurableObjectStorage) {}

  async #readFrom(storage: DurableObjectStorage | DurableObjectTransaction) {
    const metadata = await storage.get<{ chunks: number }>('workspace-state:meta')
    if (metadata) {
      let serialized = ''
      for (let index = 0; index < metadata.chunks; index += 1) {
        const chunk = await storage.get<string>(`workspace-state:chunk:${index}`)
        if (typeof chunk !== 'string') throw new Error('Workspace storage is incomplete.')
        serialized += chunk
      }
      return JSON.parse(serialized) as WorkspaceState
    }

    const legacy = await storage.get<WorkspaceState>('workspace-state')
    return legacy
  }

  async #writeTo(storage: DurableObjectStorage | DurableObjectTransaction, state: WorkspaceState) {
    const serialized = JSON.stringify(state)
    const chunkSize = 200_000
    const chunks = Math.max(1, Math.ceil(serialized.length / chunkSize))
    const previous = await storage.get<{ chunks: number }>('workspace-state:meta')
    for (let index = 0; index < chunks; index += 1) {
      await storage.put(
        `workspace-state:chunk:${index}`,
        serialized.slice(index * chunkSize, (index + 1) * chunkSize),
      )
    }
    for (let index = chunks; index < (previous?.chunks ?? 0); index += 1) {
      await storage.delete(`workspace-state:chunk:${index}`)
    }
    await storage.put('workspace-state:meta', { chunks })
    await storage.delete('workspace-state')
  }

  async read() {
    return this.storage.transaction(async (transaction) => {
      const current = await this.#readFrom(transaction)
      if (current) {
        const needsWrite =
          current.schemaVersion < 9 ||
          !Array.isArray(current.portalResources) ||
          !Array.isArray(current.acceleventsExports) ||
          !Array.isArray(current.submissionReceiptDeliveries) ||
          !Array.isArray(current.campaignDeliveries) ||
          current.campaigns.some(
            (campaign) =>
              campaign.includeEventInvite === undefined || campaign.queuedAt === undefined,
          )
        normalizeWorkspaceState(current)
        if (needsWrite) await this.#writeTo(transaction, current)
        return current
      }
      const seeded = createSeedState()
      await this.#writeTo(transaction, seeded)
      return seeded
    })
  }

  async mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }) {
    return this.storage.transaction(async (transaction) => {
      const current = normalizeWorkspaceState(
        (await this.#readFrom(transaction)) ?? createSeedState(),
      )
      const next = mutation(current)
      if (next.state !== current) await this.#writeTo(transaction, next.state)
      return next.result
    })
  }
}

export class WorkspaceDurableObject extends DurableObject {
  readonly #repository: WorkspaceRepository

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.#repository = new DurableObjectRepository(ctx.storage)
  }

  async fetch(request: Request) {
    const response = await handleCoreRequest(request, this.#repository, {
      actor: actorFromRequest(request),
    })
    return response ?? new Response('Not found.', { status: 404 })
  }
}
