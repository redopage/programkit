import { DurableObject } from 'cloudflare:workers'

import { AirtableCachedWorkspaceRepository } from './airtable-repository.ts'
import { AIRTABLE_SCHEMA_VERSION } from './airtable-schema.ts'
import { AirtableWorkspaceStore } from './airtable-store.ts'
import { handleCoreRequest } from './http.ts'
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
      if (current) return current
      const seeded = createSeedState()
      await this.#writeTo(transaction, seeded)
      return seeded
    })
  }

  async mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }) {
    return this.storage.transaction(async (transaction) => {
      const current = (await this.#readFrom(transaction)) ?? createSeedState()
      const next = mutation(current)
      if (next.state !== current) await this.#writeTo(transaction, next.state)
      return next.result
    })
  }
}

export class WorkspaceDurableObject extends DurableObject {
  readonly #repository: WorkspaceRepository
  readonly #airtableRepository: AirtableCachedWorkspaceRepository | null
  readonly #ctx: DurableObjectState
  #hydration: Promise<void> | null = null

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.#ctx = ctx
    const cache = new DurableObjectRepository(ctx.storage)
    const airtableEnv = env as unknown as {
      AIRTABLE_TOKEN?: string
      AIRTABLE_BASE_ID?: string
    }
    if (airtableEnv.AIRTABLE_TOKEN && airtableEnv.AIRTABLE_BASE_ID) {
      const store = new AirtableWorkspaceStore({
        token: airtableEnv.AIRTABLE_TOKEN,
        baseId: airtableEnv.AIRTABLE_BASE_ID,
      })
      this.#airtableRepository = new AirtableCachedWorkspaceRepository(cache, store)
      this.#repository = this.#airtableRepository
    } else {
      this.#airtableRepository = null
      this.#repository = cache
    }
  }

  async #hydrateFromAirtable(force = false) {
    if (!this.#airtableRepository) return
    if (!force) {
      const marker = await this.#ctx.storage.get<{ schemaVersion: number }>(
        'airtable-cache:hydrated',
      )
      if (marker?.schemaVersion === AIRTABLE_SCHEMA_VERSION) return
    }
    await this.#airtableRepository.replaceCacheFromAirtable()
    await this.#ctx.storage.put('airtable-cache:hydrated', {
      schemaVersion: AIRTABLE_SCHEMA_VERSION,
      refreshedAt: new Date().toISOString(),
    })
  }

  #ensureHydrated() {
    this.#hydration ??= this.#hydrateFromAirtable().catch((error: unknown) => {
      this.#hydration = null
      throw error
    })
    return this.#hydration
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/internal/airtable/refresh') {
      if (!this.#airtableRepository) {
        return Response.json({ ok: false, error: 'Airtable is not configured.' }, { status: 409 })
      }
      await this.#hydrateFromAirtable(true)
      return Response.json({ ok: true })
    }

    await this.#ensureHydrated()
    const response = await handleCoreRequest(request, this.#repository, {
      actor: actorFromRequest(request),
    })
    return response ?? new Response('Not found.', { status: 404 })
  }
}
