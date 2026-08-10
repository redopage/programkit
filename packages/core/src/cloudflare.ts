import { DurableObject } from 'cloudflare:workers'

import { AirtableCachedWorkspaceRepository } from './airtable-repository.ts'
import {
  refreshAirtableOAuthToken,
  type AirtableBaseSummary,
  type AirtableOAuthTokenSet,
} from './airtable-oauth.ts'
import { AIRTABLE_SCHEMA_VERSION } from './airtable-schema.ts'
import { AirtableWorkspaceStore, type AirtableWebhookRegistration } from './airtable-store.ts'
import { verifyAirtableWebhookMac } from './airtable-webhook.ts'
import { executeOperation } from './engine.ts'
import { handleCoreRequest } from './http.ts'
import { nextRequirementReminderAt } from './reminders.ts'
import type { WorkspaceRepository } from './repository.ts'
import { createEmptyWorkspaceState, createSeedState } from './seed.ts'
import type { Actor, WorkspaceState } from './types.ts'

interface DemoMetadata {
  id: string
  createdAt: string
  expiresAt: string
  deletedAt?: string
}

interface EventMetadata {
  id: string
  name: string
  slug: string
  createdAt: string
}

const demoMetadataKey = 'programkit-demo:metadata'
const eventMetadataKey = 'programkit-event:metadata'
const webhookRefreshAtKey = 'airtable-webhook:refresh-at'
const webhookRetryAtKey = 'airtable-webhook:retry-at'

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

function initializeEventState(metadata: EventMetadata) {
  return createEmptyWorkspaceState({
    eventId: metadata.id,
    eventName: metadata.name,
    eventSlug: metadata.slug,
    createdAt: metadata.createdAt,
  })
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
  readonly #cache: DurableObjectRepository
  readonly #ctx: DurableObjectState
  readonly #env: {
    AIRTABLE_TOKEN?: string
    AIRTABLE_BASE_ID?: string
    AIRTABLE_OAUTH_CLIENT_ID?: string
    AIRTABLE_OAUTH_CLIENT_SECRET?: string
    PROGRAMKIT_APP_ORIGIN?: string
    PROGRAMKIT_EMAIL_FROM?: string
    PROGRAMKIT_SUPPORT_EMAIL?: string
    EMAIL?: {
      send(message: {
        to: string | string[]
        from: string
        subject: string
        text?: string
        replyTo?: string
      }): Promise<{ messageId: string }>
    }
  }
  #airtableRepository: AirtableCachedWorkspaceRepository | null = null
  #repositoryFingerprint = 'cache'
  #hydration: Promise<void> | null = null
  #refreshingToken: Promise<StoredAirtableConnection> | null = null

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.#ctx = ctx
    this.#cache = new DurableObjectRepository(ctx.storage)
    this.#env = env as unknown as {
      AIRTABLE_TOKEN?: string
      AIRTABLE_BASE_ID?: string
      AIRTABLE_OAUTH_CLIENT_ID?: string
      AIRTABLE_OAUTH_CLIENT_SECRET?: string
      PROGRAMKIT_APP_ORIGIN?: string
      PROGRAMKIT_EMAIL_FROM?: string
      PROGRAMKIT_SUPPORT_EMAIL?: string
      EMAIL?: {
        send(message: {
          to: string | string[]
          from: string
          subject: string
          text?: string
          replyTo?: string
        }): Promise<{ messageId: string }>
      }
    }
  }

  async #demoMetadata() {
    return (await this.#ctx.storage.get<DemoMetadata>(demoMetadataKey)) ?? null
  }

  async #scheduleNextAlarm() {
    const due: number[] = []
    const demo = await this.#demoMetadata()
    if (demo) due.push(Date.parse(demo.expiresAt))

    const refreshAt = await this.#ctx.storage.get<number>(webhookRefreshAtKey)
    const retryAt = await this.#ctx.storage.get<number>(webhookRetryAtKey)
    if (typeof refreshAt === 'number') due.push(refreshAt)
    if (typeof retryAt === 'number') due.push(retryAt)

    const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
      'airtable-oauth:connection',
    )
    if (connection?.webhook?.expirationTime) {
      due.push(Date.parse(connection.webhook.expirationTime) - 24 * 60 * 60 * 1_000)
    }

    const state = await this.#cache.read()
    const reminderAt = nextRequirementReminderAt(state)
    if (reminderAt != null) due.push(reminderAt)
    if (this.#env.EMAIL && this.#env.PROGRAMKIT_EMAIL_FROM) {
      for (const message of state.outboundMessages ?? []) {
        const attempts = message.attempts ?? 0
        if (message.status === 'queued') due.push(Date.now())
        if (
          message.status === 'failed' &&
          attempts < 5 &&
          message.nextAttemptAt &&
          Date.parse(message.nextAttemptAt) <= Date.now()
        ) {
          due.push(Date.now())
        } else if (message.status === 'failed' && attempts < 5 && message.nextAttemptAt) {
          due.push(Date.parse(message.nextAttemptAt))
        }
      }
    }

    const next = due.filter(Number.isFinite).sort((left, right) => left - right)[0]
    if (next == null) {
      await this.#ctx.storage.deleteAlarm()
      return
    }
    await this.#ctx.storage.setAlarm(Math.max(Date.now() + 500, next))
  }

  async #removeAirtableConnection() {
    const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
      'airtable-oauth:connection',
    )
    if (connection?.webhook) {
      try {
        const store = new AirtableWorkspaceStore({
          token: connection.accessToken,
          baseId: connection.baseId,
        })
        await store.deleteWebhook(connection.webhook.id)
      } catch {
        // Local deletion must still succeed if Airtable is unavailable.
      }
    }
    await this.#ctx.storage.delete('airtable-oauth:connection')
    await this.#ctx.storage.delete('airtable-oauth:pending-connection')
    await this.#ctx.storage.delete('airtable-cache:hydrated')
    await this.#ctx.storage.delete(webhookRefreshAtKey)
    await this.#ctx.storage.delete(webhookRetryAtKey)
    this.#airtableRepository = null
    this.#repositoryFingerprint = 'cache'
    this.#hydration = null
  }

  async #expireDemo(metadata: DemoMetadata) {
    await this.#removeAirtableConnection()
    await this.#ctx.storage.deleteAll()
    return metadata
  }

  async #assertActiveDemo() {
    const metadata = await this.#demoMetadata()
    if (!metadata) return null
    if (metadata.deletedAt || Date.parse(metadata.expiresAt) <= Date.now()) {
      if (!metadata.deletedAt) await this.#expireDemo(metadata)
      throw new Error('This demo has expired.')
    }
    return metadata
  }

  async #freshConnection() {
    const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
      'airtable-oauth:connection',
    )
    if (!connection) return null
    if (Date.parse(connection.expiresAt) > Date.now() + 60_000) return connection
    if (Date.parse(connection.refreshExpiresAt) <= Date.now()) {
      await this.#ctx.storage.put('airtable-oauth:connection', {
        ...connection,
        webhookError: 'The Airtable authorization expired. Reconnect Airtable to continue.',
      } satisfies StoredAirtableConnection)
      return null
    }
    if (!this.#env.AIRTABLE_OAUTH_CLIENT_ID) {
      await this.#ctx.storage.put('airtable-oauth:connection', {
        ...connection,
        webhookError: 'The Airtable OAuth client is not configured on this deployment.',
      } satisfies StoredAirtableConnection)
      return null
    }
    this.#refreshingToken ??= refreshAirtableOAuthToken(connection.refreshToken, {
      clientId: this.#env.AIRTABLE_OAUTH_CLIENT_ID,
      clientSecret: this.#env.AIRTABLE_OAUTH_CLIENT_SECRET,
    })
      .then(async (token) => {
        const next = { ...connection, ...token }
        await this.#ctx.storage.put('airtable-oauth:connection', next)
        this.#airtableRepository = null
        this.#repositoryFingerprint = 'cache'
        return next
      })
      .finally(() => {
        this.#refreshingToken = null
      })
    try {
      return await this.#refreshingToken
    } catch (error) {
      await this.#ctx.storage.put('airtable-oauth:connection', {
        ...connection,
        webhookError:
          error instanceof Error ? error.message : 'Airtable authorization could not be refreshed.',
      } satisfies StoredAirtableConnection)
      return null
    }
  }

  async #repository() {
    const connection = await this.#freshConnection()
    const demo = await this.#demoMetadata()
    const binding = connection
      ? { baseId: connection.baseId, token: connection.accessToken, mode: 'oauth' }
      : !demo && this.#env.AIRTABLE_TOKEN && this.#env.AIRTABLE_BASE_ID
        ? {
            baseId: this.#env.AIRTABLE_BASE_ID,
            token: this.#env.AIRTABLE_TOKEN,
            mode: 'token',
          }
        : null
    if (!binding) {
      this.#airtableRepository = null
      this.#repositoryFingerprint = 'cache'
      return this.#cache
    }
    const fingerprint = `${binding.mode}:${binding.baseId}:${binding.token}`
    if (!this.#airtableRepository || fingerprint !== this.#repositoryFingerprint) {
      const store = new AirtableWorkspaceStore({ token: binding.token, baseId: binding.baseId })
      this.#airtableRepository = new AirtableCachedWorkspaceRepository(this.#cache, store)
      this.#repositoryFingerprint = fingerprint
      this.#hydration = null
    }
    return this.#airtableRepository
  }

  async #activeBaseId() {
    const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
      'airtable-oauth:connection',
    )
    if (connection) return connection.baseId
    return (await this.#demoMetadata()) ? null : (this.#env.AIRTABLE_BASE_ID ?? null)
  }

  async #hydrateFromAirtable(force = false) {
    const repository = await this.#repository()
    if (!(repository instanceof AirtableCachedWorkspaceRepository)) return
    const baseId = await this.#activeBaseId()
    if (!baseId) return
    if (!force) {
      const marker = await this.#ctx.storage.get<{ schemaVersion: number; baseId: string }>(
        'airtable-cache:hydrated',
      )
      if (marker?.schemaVersion === AIRTABLE_SCHEMA_VERSION && marker.baseId === baseId) return
    }
    await repository.replaceCacheFromAirtable()
    await this.#ctx.storage.put('airtable-cache:hydrated', {
      schemaVersion: AIRTABLE_SCHEMA_VERSION,
      baseId,
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

  async #status() {
    const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
      'airtable-oauth:connection',
    )
    const demo = await this.#demoMetadata()
    const pending = await this.#ctx.storage.get<PendingAirtableConnection>(
      'airtable-oauth:pending-connection',
    )
    return {
      available: Boolean(this.#env.AIRTABLE_OAUTH_CLIENT_ID),
      mode: connection
        ? 'oauth'
        : !demo && this.#env.AIRTABLE_TOKEN && this.#env.AIRTABLE_BASE_ID
          ? 'token'
          : 'none',
      connected: Boolean(
        connection || (!demo && this.#env.AIRTABLE_TOKEN && this.#env.AIRTABLE_BASE_ID),
      ),
      base: connection
        ? { id: connection.baseId, name: connection.baseName }
        : !demo && this.#env.AIRTABLE_BASE_ID
          ? { id: this.#env.AIRTABLE_BASE_ID, name: 'Configured base' }
          : null,
      bases: pending?.bases ?? [],
      authorizedAt: pending?.authorizedAt ?? null,
      liveSync: connection?.webhook
        ? {
            status: 'active',
            expiresAt: connection.webhook.expirationTime ?? null,
            error: null,
          }
        : connection
          ? { status: 'unavailable', expiresAt: null, error: connection.webhookError ?? null }
          : null,
    }
  }

  async #scheduleWebhookRenewal(connection: StoredAirtableConnection) {
    const expiration = connection.webhook?.expirationTime
    if (!expiration) return
    await this.#scheduleNextAlarm()
  }

  async #connectPendingBase(baseId: string, webhookUrl?: string) {
    const pending = await this.#ctx.storage.get<PendingAirtableConnection>(
      'airtable-oauth:pending-connection',
    )
    if (!pending) throw new Error('The Airtable authorization is no longer available.')
    const base = pending.bases.find((candidate) => candidate.id === baseId)
    if (!base) throw new Error('Choose a base that was granted to ProgramKit.')
    const store = new AirtableWorkspaceStore({ token: pending.accessToken, baseId })
    const tables = await store.schema()
    const managedNames = new Set([
      'ProgramKit State',
      'Events',
      'People',
      'Participations',
      'Submissions',
      'Tasks',
      'Reviews',
      'Sessions',
      'Placements',
      'Tracks',
      'Rooms',
    ])
    const existingManagedTables = tables.filter((table) => managedNames.has(table.name))
    const hasProgramKitState = tables.some((table) => table.name === 'ProgramKit State')
    if (!hasProgramKitState && existingManagedTables.length > 0) {
      throw new Error(
        `This base already has tables named ${existingManagedTables.map((table) => table.name).join(', ')}. Choose a dedicated base or rename those tables first.`,
      )
    }

    let imported = false
    let recordCount = 0
    if (hasProgramKitState) {
      const issues = await store.ensureSchema()
      if (issues.length > 0) {
        throw new Error(`The existing ProgramKit schema is incompatible: ${JSON.stringify(issues)}`)
      }
      const restored = await store.rebuildWorkspace()
      await this.#cache.mutate(() => ({ state: restored, result: undefined }))
      imported = true
    } else {
      const current = await this.#cache.read()
      const exported = await store.exportWorkspace(current)
      recordCount = exported.recordCount
    }

    let webhook: AirtableWebhookRegistration | undefined
    let webhookError: string | undefined
    if (webhookUrl) {
      try {
        webhook = await store.createWebhook(webhookUrl)
      } catch (error) {
        webhookError =
          error instanceof Error ? error.message : 'Airtable live sync could not be enabled.'
      }
    }

    const connection: StoredAirtableConnection = {
      baseId,
      baseName: base.name,
      connectedAt: new Date().toISOString(),
      accessToken: pending.accessToken,
      refreshToken: pending.refreshToken,
      expiresAt: pending.expiresAt,
      refreshExpiresAt: pending.refreshExpiresAt,
      scopes: pending.scopes,
      webhook,
      webhookError,
    }
    await this.#ctx.storage.put('airtable-oauth:connection', connection)
    await this.#ctx.storage.delete('airtable-oauth:pending-connection')
    await this.#ctx.storage.put('airtable-cache:hydrated', {
      schemaVersion: AIRTABLE_SCHEMA_VERSION,
      baseId,
      refreshedAt: new Date().toISOString(),
    })
    this.#airtableRepository = null
    this.#repositoryFingerprint = 'cache'
    this.#hydration = null
    await this.#scheduleWebhookRenewal(connection)
    return {
      base: { id: base.id, name: base.name },
      imported,
      recordCount,
      liveSync: webhook ? 'active' : webhookUrl ? 'unavailable' : 'manual',
      warning: webhookError,
    }
  }

  async #refreshWebhook(connection: StoredAirtableConnection) {
    if (!connection.webhook) return connection
    const store = new AirtableWorkspaceStore({
      token: connection.accessToken,
      baseId: connection.baseId,
    })
    const refreshed = await store.refreshWebhook(connection.webhook.id)
    const next: StoredAirtableConnection = {
      ...connection,
      webhook: {
        ...connection.webhook,
        expirationTime: refreshed.expirationTime ?? undefined,
      },
      webhookError: undefined,
    }
    await this.#ctx.storage.put('airtable-oauth:connection', next)
    await this.#scheduleWebhookRenewal(next)
    return next
  }

  async #processRequirementReminders(at: string) {
    const repository = await this.#repository()
    return repository.mutate((state) => {
      const result = executeOperation(state, 'requirement.process-reminders', {
        input: { at },
        actor: {
          type: 'system',
          id: 'automatic-reminder-scheduler',
          name: 'Automatic reminder scheduler',
          scopes: ['requirements:write'],
        },
      })
      return { state: result.state, result: result.response }
    })
  }

  #absoluteMessageBody(body: string) {
    const origin = this.#env.PROGRAMKIT_APP_ORIGIN
    if (!origin) return body
    return body.replace(/\/portal\/[^\s]+/gu, (path) => new URL(path, origin).toString())
  }

  async #deliverOutboundMessages(at: string) {
    if (!this.#env.EMAIL || !this.#env.PROGRAMKIT_EMAIL_FROM) return
    const repository = await this.#repository()
    const now = Date.parse(at)
    const state = await repository.read()
    const due = (state.outboundMessages ?? []).filter((message) => {
      const attempts = message.attempts ?? 0
      if (attempts >= 5) return false
      if (message.status === 'queued') return true
      return (
        message.status === 'failed' &&
        Boolean(message.nextAttemptAt) &&
        Date.parse(message.nextAttemptAt!) <= now
      )
    })

    for (const candidate of due) {
      const attempt = await repository.mutate((current) => {
        const next = structuredClone(current)
        const message = next.outboundMessages?.find((entry) => entry.id === candidate.id)
        if (!message || message.status === 'sent' || (message.attempts ?? 0) >= 5) {
          return { state: current, result: null }
        }
        message.attempts = (message.attempts ?? 0) + 1
        message.lastAttemptAt = at
        message.nextAttemptAt = null
        message.lastError = null
        next.revision += 1
        return { state: next, result: structuredClone(message) }
      })
      if (!attempt) continue

      try {
        const delivered = await this.#env.EMAIL.send({
          to: attempt.recipientEmail,
          from: this.#env.PROGRAMKIT_EMAIL_FROM,
          replyTo: this.#env.PROGRAMKIT_SUPPORT_EMAIL,
          subject: attempt.subject,
          text: this.#absoluteMessageBody(attempt.body),
        })
        await repository.mutate((current) => {
          const next = structuredClone(current)
          const message = next.outboundMessages?.find((entry) => entry.id === attempt.id)
          if (!message) return { state: current, result: undefined }
          message.status = 'sent'
          message.sentAt = at
          message.providerMessageId = delivered.messageId
          message.nextAttemptAt = null
          message.lastError = null
          next.revision += 1
          return { state: next, result: undefined }
        })
      } catch (error) {
        await repository.mutate((current) => {
          const next = structuredClone(current)
          const message = next.outboundMessages?.find((entry) => entry.id === attempt.id)
          if (!message) return { state: current, result: undefined }
          const attempts = message.attempts ?? 1
          const retryMinutes = [1, 5, 30, 120][Math.min(attempts - 1, 3)] ?? 120
          message.status = 'failed'
          message.lastError = error instanceof Error ? error.message : 'Email delivery failed.'
          message.nextAttemptAt =
            attempts < 5 ? new Date(now + retryMinutes * 60_000).toISOString() : null
          next.revision += 1
          return { state: next, result: undefined }
        })
      }
    }
  }

  async alarm() {
    const demo = await this.#demoMetadata()
    if (demo && Date.parse(demo.expiresAt) <= Date.now()) {
      await this.#expireDemo(demo)
      return
    }

    const now = new Date().toISOString()
    await this.#processRequirementReminders(now)
    await this.#deliverOutboundMessages(now)

    const refreshAt = await this.#ctx.storage.get<number>(webhookRefreshAtKey)
    const retryAt = await this.#ctx.storage.get<number>(webhookRetryAtKey)
    if (
      (typeof refreshAt === 'number' && refreshAt <= Date.now()) ||
      (typeof retryAt === 'number' && retryAt <= Date.now())
    ) {
      try {
        await this.#hydrateFromAirtable(true)
        await this.#ctx.storage.delete(webhookRefreshAtKey)
        await this.#ctx.storage.delete(webhookRetryAtKey)
      } catch {
        await this.#ctx.storage.put(webhookRetryAtKey, Date.now() + 60_000)
        await this.#scheduleNextAlarm()
        return
      }
    }

    const connection = await this.#freshConnection()
    if (!connection?.webhook) {
      await this.#scheduleNextAlarm()
      return
    }
    const expiresAt = connection.webhook.expirationTime
      ? Date.parse(connection.webhook.expirationTime)
      : Number.POSITIVE_INFINITY
    if (expiresAt <= Date.now() + 24 * 60 * 60 * 1_000) {
      try {
        await this.#refreshWebhook(connection)
      } catch (error) {
        await this.#ctx.storage.put('airtable-oauth:connection', {
          ...connection,
          webhookError:
            error instanceof Error ? error.message : 'Airtable live sync renewal failed.',
        } satisfies StoredAirtableConnection)
        await this.#ctx.storage.put(webhookRetryAtKey, Date.now() + 60 * 60 * 1_000)
      }
    }
    await this.#scheduleNextAlarm()
  }

  async fetch(request: Request) {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/internal/event/initialize') {
      const input = (await request.json()) as EventMetadata
      if (!input.id || !input.name || !input.slug || !input.createdAt) {
        return Response.json({ ok: false, error: 'Invalid event metadata.' }, { status: 400 })
      }
      const existing = await this.#ctx.storage.get<EventMetadata>(eventMetadataKey)
      if (existing) {
        return existing.id === input.id
          ? Response.json({ ok: true, event: existing })
          : Response.json(
              { ok: false, error: 'This event is already initialized.' },
              { status: 409 },
            )
      }
      await this.#cache.mutate(() => ({ state: initializeEventState(input), result: undefined }))
      await this.#ctx.storage.put(eventMetadataKey, input)
      return Response.json({ ok: true, event: input }, { status: 201 })
    }
    if (request.method === 'GET' && url.pathname === '/internal/event/status') {
      const event = await this.#ctx.storage.get<EventMetadata>(eventMetadataKey)
      return event
        ? Response.json({ ok: true, event })
        : Response.json({ ok: false }, { status: 404 })
    }
    if (request.method === 'POST' && url.pathname === '/internal/demo/initialize') {
      const input = (await request.json()) as DemoMetadata
      if (
        !input.id ||
        !input.createdAt ||
        !input.expiresAt ||
        Date.parse(input.expiresAt) <= Date.now()
      ) {
        return Response.json({ ok: false, error: 'Invalid demo lifetime.' }, { status: 400 })
      }
      const existing = await this.#demoMetadata()
      if (existing) {
        return Response.json(
          { ok: false, error: 'This demo capability already exists.' },
          { status: 409 },
        )
      }
      const metadata: DemoMetadata = {
        id: input.id,
        createdAt: input.createdAt,
        expiresAt: input.expiresAt,
      }
      await this.#ctx.storage.put(demoMetadataKey, metadata)
      await this.#cache.read()
      await this.#scheduleNextAlarm()
      return Response.json({ ok: true, demo: metadata })
    }

    if (request.method === 'GET' && url.pathname === '/internal/demo/status') {
      const metadata = await this.#demoMetadata()
      if (!metadata) return Response.json({ ok: false, active: false }, { status: 404 })
      const active = !metadata.deletedAt && Date.parse(metadata.expiresAt) > Date.now()
      if (!active && !metadata.deletedAt) await this.#expireDemo(metadata)
      return Response.json({ ok: active, active, demo: metadata }, { status: active ? 200 : 410 })
    }

    if (request.method === 'POST' && url.pathname === '/internal/demo/delete') {
      const metadata = await this.#demoMetadata()
      if (!metadata) return Response.json({ ok: false, active: false }, { status: 404 })
      await this.#removeAirtableConnection()
      await this.#ctx.storage.deleteAll()
      const tombstone: DemoMetadata = { ...metadata, deletedAt: new Date().toISOString() }
      await this.#ctx.storage.put(demoMetadataKey, tombstone)
      await this.#scheduleNextAlarm()
      return Response.json({ ok: true, active: false, demo: tombstone })
    }

    try {
      await this.#assertActiveDemo()
    } catch (error) {
      return Response.json(
        { ok: false, error: error instanceof Error ? error.message : 'This demo has expired.' },
        { status: 410 },
      )
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/oauth/start') {
      const pending = (await request.json()) as PendingAirtableAuthorization
      if (
        !pending.state ||
        !pending.codeVerifier ||
        !pending.redirectUri ||
        Date.parse(pending.expiresAt) <= Date.now()
      ) {
        return Response.json({ ok: false, error: 'Invalid OAuth request.' }, { status: 400 })
      }
      await this.#ctx.storage.put(`airtable-oauth:authorization:${pending.state}`, pending)
      return Response.json({ ok: true })
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/oauth/consume') {
      const { state } = (await request.json()) as { state?: string }
      if (!state) return Response.json({ ok: false }, { status: 400 })
      const key = `airtable-oauth:authorization:${state}`
      const pending = await this.#ctx.storage.get<PendingAirtableAuthorization>(key)
      await this.#ctx.storage.delete(key)
      if (!pending || Date.parse(pending.expiresAt) <= Date.now()) {
        return Response.json(
          { ok: false, error: 'OAuth state is invalid or expired.' },
          { status: 400 },
        )
      }
      return Response.json({ ok: true, authorization: pending })
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/oauth/pending') {
      const pending = (await request.json()) as PendingAirtableConnection
      if (!pending.accessToken || !pending.refreshToken || !Array.isArray(pending.bases)) {
        return Response.json({ ok: false, error: 'Invalid Airtable token set.' }, { status: 400 })
      }
      await this.#ctx.storage.put('airtable-oauth:pending-connection', pending)
      return Response.json({ ok: true })
    }

    if (request.method === 'GET' && url.pathname === '/internal/airtable/status') {
      return Response.json(await this.#status())
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/connect') {
      try {
        const { baseId, webhookUrl } = (await request.json()) as {
          baseId?: string
          webhookUrl?: string
        }
        if (!baseId) throw new Error('Choose an Airtable base.')
        return Response.json({
          ok: true,
          ...(await this.#connectPendingBase(baseId, webhookUrl)),
        })
      } catch (error) {
        return Response.json(
          { ok: false, error: error instanceof Error ? error.message : 'Airtable setup failed.' },
          { status: 400 },
        )
      }
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/disconnect') {
      await this.#removeAirtableConnection()
      await this.#scheduleNextAlarm()
      return Response.json({ ok: true })
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/webhook') {
      const connection = await this.#ctx.storage.get<StoredAirtableConnection>(
        'airtable-oauth:connection',
      )
      if (!connection?.webhook) return new Response(null, { status: 404 })
      const body = await request.arrayBuffer()
      if (
        !(await verifyAirtableWebhookMac(
          body,
          request.headers.get('x-airtable-content-mac'),
          connection.webhook.macSecretBase64,
        ))
      ) {
        return new Response(null, { status: 401 })
      }
      const notification = JSON.parse(new TextDecoder().decode(body)) as {
        base?: { id?: string }
        webhook?: { id?: string }
      }
      if (
        notification.base?.id !== connection.baseId ||
        (notification.webhook?.id && notification.webhook.id !== connection.webhook.id)
      ) {
        return new Response(null, { status: 403 })
      }
      await this.#ctx.storage.put(webhookRefreshAtKey, Date.now() + 1_500)
      await this.#scheduleNextAlarm()
      return new Response(null, { status: 204 })
    }

    if (request.method === 'POST' && url.pathname === '/internal/airtable/refresh') {
      const repository = await this.#repository()
      if (!(repository instanceof AirtableCachedWorkspaceRepository)) {
        return Response.json({ ok: false, error: 'Airtable is not configured.' }, { status: 409 })
      }
      await this.#hydrateFromAirtable(true)
      return Response.json({ ok: true })
    }

    await this.#ensureHydrated()
    const repository = await this.#repository()
    const response = await handleCoreRequest(request, repository, {
      actor: actorFromRequest(request),
    })
    if (request.method === 'POST') await this.#scheduleNextAlarm()
    return response ?? new Response('Not found.', { status: 404 })
  }
}

interface PendingAirtableAuthorization {
  state: string
  codeVerifier: string
  redirectUri: string
  expiresAt: string
}

interface PendingAirtableConnection extends AirtableOAuthTokenSet {
  bases: AirtableBaseSummary[]
  authorizedAt: string
}

interface StoredAirtableConnection extends AirtableOAuthTokenSet {
  baseId: string
  baseName: string
  connectedAt: string
  webhook?: AirtableWebhookRegistration
  webhookError?: string
}
