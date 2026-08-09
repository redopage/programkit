import { handleMcpRequest } from '@programkit/agent'
import { WorkspaceDurableObject } from '@programkit/core/cloudflare'
import type {
  AcceleventsExport,
  CampaignDelivery,
  OperationRequest,
  OperationResponse,
  WorkspaceState,
} from '@programkit/core'

import {
  deliverAcceleventsItem,
  deliverCampaignMessage,
  type EmailSendBinding,
} from './providers.ts'

export { WorkspaceDurableObject }

interface Env {
  ASSETS: Fetcher
  EMAIL?: EmailSendBinding
  PROGRAMKIT_ASSETS: R2Bucket
  PROGRAMKIT_WORKSPACES: DurableObjectNamespace<WorkspaceDurableObject>
  PROGRAMKIT_EMAIL_FROM?: string
  ACCELEVENTS_API_KEY?: string
}

const demoStaffActor = {
  type: 'staff' as const,
  id: 'usr_demo_operator',
  name: 'Demo Operator',
  scopes: ['*'],
}

const agentReaderActor = {
  type: 'agent' as const,
  id: 'agent_programkit',
  name: 'ProgramKit Agent',
  scopes: ['workspace:read'],
}

const providerServiceActor = {
  type: 'service' as const,
  id: 'service_provider_delivery',
  name: 'Provider delivery consumer',
  scopes: ['workspace:read', 'communications:deliver', 'integrations:deliver'],
}

const publicReaderActor = {
  type: 'service' as const,
  id: 'public_web',
  name: 'Public web',
  scopes: [],
}

function participantActor(participationId: string) {
  return {
    type: 'participant' as const,
    id: participationId,
    name: 'Portal participant',
    scopes: ['participations:write', 'requirements:write', 'portal:write', 'assets:write'],
  }
}

const maximumRequirementFileBytes = 8 * 1024 * 1024

function json(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })
}

function safeFilename(value: string) {
  const normalized = value
    .normalize('NFKC')
    .split('')
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0
      return character === '/' || character === '\\' || codePoint < 32 || codePoint === 127
        ? '-'
        : character
    })
    .join('')
    .replace(/\s+/gu, ' ')
    .trim()
  return (normalized || 'upload').slice(0, 160)
}

function participantCanAccessAsset(
  state: WorkspaceState,
  participationId: string,
  assetId: string,
) {
  const participation = state.participations.find((entry) => entry.id === participationId)
  if (!participation) return false
  const submissionIds = new Set(
    state.submissions
      .filter((entry) => entry.convertedParticipationId === participationId)
      .map((entry) => entry.id),
  )
  const asset = state.assets.find((entry) => entry.id === assetId)
  if (!asset) return false
  return (
    (asset.owner.type === 'participation' && asset.owner.id === participationId) ||
    (asset.owner.type === 'person' && asset.owner.id === participation.personId) ||
    (asset.owner.type === 'submission' && submissionIds.has(asset.owner.id))
  )
}

function workspaceStub(env: Env, request: Request) {
  const requested = request.headers.get('x-programkit-workspace-key') ?? 'demo'
  const workspaceKey = /^[a-z0-9][a-z0-9_-]{0,63}$/u.test(requested) ? requested : 'demo'
  return env.PROGRAMKIT_WORKSPACES.get(env.PROGRAMKIT_WORKSPACES.idFromName(workspaceKey))
}

function withActor(request: Request, actor: OperationRequest['actor']) {
  const headers = new Headers(request.headers)
  for (const name of [
    'x-programkit-internal-actor-type',
    'x-programkit-internal-actor-id',
    'x-programkit-internal-actor-name',
    'x-programkit-internal-actor-scopes',
  ]) {
    headers.delete(name)
  }
  if (actor) {
    headers.set('x-programkit-internal-actor-type', actor.type)
    headers.set('x-programkit-internal-actor-id', actor.id)
    headers.set('x-programkit-internal-actor-name', actor.name)
    headers.set('x-programkit-internal-actor-scopes', actor.scopes.join(' '))
  }
  return new Request(request, { headers })
}

async function readWorkspace(stub: DurableObjectStub<WorkspaceDurableObject>) {
  const response = await stub.fetch(
    withActor(new Request('http://workspace.internal/api/v1/state'), agentReaderActor),
  )
  if (!response.ok) throw new Error('The workspace could not be loaded for MCP.')
  const body = (await response.json()) as { state: WorkspaceState }
  return body.state
}

async function executeWorkspaceOperation(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  operation: string,
  request: OperationRequest,
) {
  const { actor, ...publicRequest } = request
  const response = await stub.fetch(
    withActor(
      new Request(`http://workspace.internal/api/v1/operations/${encodeURIComponent(operation)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(publicRequest),
      }),
      actor,
    ),
  )
  return (await response.json()) as OperationResponse
}

function providerFailure(error: unknown) {
  if (!(error instanceof Error)) return 'The provider request failed.'
  const code = 'code' in error && typeof error.code === 'string' ? `${error.code}: ` : ''
  return `${code}${error.message}`.replace(/\s+/gu, ' ').trim().slice(0, 500)
}

async function recordCampaignDelivery(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  delivery: CampaignDelivery,
  result:
    { status: 'delivered'; providerMessageId: string } | { status: 'failed'; lastError: string },
) {
  return executeWorkspaceOperation(stub, 'campaign.record-delivery', {
    actor: providerServiceActor,
    input: { deliveryId: delivery.id, ...result },
    expectedVersions: { [delivery.id]: delivery.version },
    idempotencyKey: `provider-email-${delivery.id}-${delivery.attemptCount + 1}`,
  })
}

async function deliverPendingCampaigns(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  env: Env,
  campaignId: string,
) {
  if (!env.EMAIL || !env.PROGRAMKIT_EMAIL_FROM) return
  const state = await readWorkspace(stub)
  const pending = state.campaignDeliveries.filter(
    (entry) => entry.campaignId === campaignId && entry.status === 'pending_provider',
  )
  for (const delivery of pending) {
    try {
      const providerMessageId = await deliverCampaignMessage(
        env.EMAIL,
        env.PROGRAMKIT_EMAIL_FROM,
        delivery,
      )
      await recordCampaignDelivery(stub, delivery, { status: 'delivered', providerMessageId })
    } catch (error) {
      await recordCampaignDelivery(stub, delivery, {
        status: 'failed',
        lastError: providerFailure(error),
      })
    }
  }
}

async function recordAcceleventsResult(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  batch: AcceleventsExport,
  item: AcceleventsExport['items'][number],
  result: { status: 'delivered'; providerId: string } | { status: 'failed'; lastError: string },
) {
  return executeWorkspaceOperation(stub, 'accelevents.record-result', {
    actor: providerServiceActor,
    input: { exportId: batch.id, itemId: item.id, ...result },
    expectedVersions: { [item.id]: item.version },
    idempotencyKey: `provider-accelevents-${item.id}-${item.attemptCount + 1}`,
  })
}

async function deliverPendingAcceleventsExports(
  stub: DurableObjectStub<WorkspaceDurableObject>,
  env: Env,
  exportId: string,
) {
  if (!env.ACCELEVENTS_API_KEY) return
  const state = await readWorkspace(stub)
  for (const batch of state.acceleventsExports.filter((entry) => entry.id === exportId)) {
    const pending = batch.items.filter((entry) => entry.status === 'pending_provider')
    if (pending.length === 0) continue
    const speakerProviderIds = new Map(
      batch.items
        .filter((entry) => entry.resource === 'speaker' && entry.providerId)
        .map((entry) => [entry.externalKey, entry.providerId!]),
    )
    for (const item of pending) {
      try {
        const providerId = await deliverAcceleventsItem(
          fetch,
          env.ACCELEVENTS_API_KEY,
          batch.eventUrl,
          item,
          speakerProviderIds,
        )
        if (item.resource === 'speaker') speakerProviderIds.set(item.externalKey, providerId)
        await recordAcceleventsResult(stub, batch, item, { status: 'delivered', providerId })
      } catch (error) {
        await recordAcceleventsResult(stub, batch, item, {
          status: 'failed',
          lastError: providerFailure(error),
        })
      }
    }
  }
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)
    const stub = workspaceStub(env, request)

    const portalAssetCollectionMatch = url.pathname.match(/^\/api\/v1\/portal\/([^/]+)\/assets$/u)
    if (request.method === 'POST' && portalAssetCollectionMatch) {
      const participationId = decodeURIComponent(portalAssetCollectionMatch[1])
      const declaredLength = Number(request.headers.get('content-length'))
      if (
        Number.isFinite(declaredLength) &&
        declaredLength > maximumRequirementFileBytes + 128_000
      ) {
        return json({ error: 'Choose a file no larger than 8 MB.' }, { status: 413 })
      }
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        return json({ error: 'The upload form could not be read.' }, { status: 400 })
      }
      const requirementInstanceId = formData.get('requirementInstanceId')
      const upload = formData.get('file')
      if (typeof requirementInstanceId !== 'string' || !(upload instanceof File)) {
        return json({ error: 'Choose a requirement and a file to upload.' }, { status: 400 })
      }
      if (upload.size <= 0 || upload.size > maximumRequirementFileBytes) {
        return json({ error: 'Choose a file between 1 byte and 8 MB.' }, { status: 400 })
      }

      const state = await readWorkspace(stub)
      const requirement = state.requirementInstances.find(
        (entry) => entry.id === requirementInstanceId && entry.participationId === participationId,
      )
      if (!requirement) {
        return json({ error: 'That requirement is not available in this portal.' }, { status: 404 })
      }
      const filename = safeFilename(upload.name)
      const storageKey = `workspaces/${state.workspace.id}/participants/${participationId}/${crypto.randomUUID()}/${filename}`
      try {
        await env.PROGRAMKIT_ASSETS.put(storageKey, upload.stream(), {
          httpMetadata: { contentType: upload.type },
          customMetadata: {
            filename,
            participationId,
            requirementInstanceId,
          },
        })
      } catch {
        return json({ error: 'The file could not be stored. Try again.' }, { status: 502 })
      }

      const actor = participantActor(participationId)
      let operationResponse: Response
      try {
        operationResponse = await stub.fetch(
          withActor(
            new Request(
              `http://workspace.internal/api/v1/portal/${encodeURIComponent(participationId)}/operations/requirement.submit-file`,
              {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                  input: {
                    requirementInstanceId,
                    filename,
                    contentType: upload.type,
                    sizeBytes: upload.size,
                    storageKey,
                  },
                  expectedVersions: { [requirement.id]: requirement.version },
                  idempotencyKey: crypto.randomUUID(),
                }),
              },
            ),
            actor,
          ),
        )
      } catch {
        await env.PROGRAMKIT_ASSETS.delete(storageKey).catch(() => undefined)
        return json({ error: 'The upload could not be recorded. Try again.' }, { status: 502 })
      }
      if (!operationResponse.ok) {
        await env.PROGRAMKIT_ASSETS.delete(storageKey).catch(() => undefined)
      }
      return operationResponse
    }

    const portalAssetMatch = url.pathname.match(
      /^\/api\/v1\/portal\/([^/]+)\/assets\/([^/]+)\/content$/u,
    )
    if (request.method === 'GET' && portalAssetMatch) {
      const participationId = decodeURIComponent(portalAssetMatch[1])
      const assetId = decodeURIComponent(portalAssetMatch[2])
      const state = await readWorkspace(stub)
      if (!participantCanAccessAsset(state, participationId, assetId)) {
        return json({ error: 'File not found.' }, { status: 404 })
      }
      const asset = state.assets.find((entry) => entry.id === assetId)!
      const object = await env.PROGRAMKIT_ASSETS.get(asset.storageKey)
      if (!object) return json({ error: 'File not found.' }, { status: 404 })
      const asciiFilename = asset.filename.replace(/[^\x20-\x7e]/gu, '_').replace(/["\\]/gu, '_')
      const headers = new Headers()
      object.writeHttpMetadata(headers)
      headers.set('cache-control', 'private, no-store')
      headers.set(
        'content-disposition',
        `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(asset.filename)}`,
      )
      headers.set('content-length', String(asset.sizeBytes))
      headers.set('etag', object.httpEtag)
      headers.set('x-content-type-options', 'nosniff')
      return new Response(object.body, { headers })
    }

    if (url.pathname === '/mcp') {
      return handleMcpRequest(request, {
        readState: () => readWorkspace(stub),
        execute: (operation, operationRequest) =>
          executeWorkspaceOperation(stub, operation, operationRequest),
      })
    }

    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/public/')) {
      const portalMatch = url.pathname.match(/^\/api\/v1\/portal\/([^/]+)\//u)
      const reviewerMatch = url.pathname.match(/^\/api\/v1\/reviewers\/([^/]+)\//u)
      const publicSubmissionMatch = url.pathname.match(
        /^\/public\/v1\/submission-forms\/([^/]+)\//u,
      )
      const actor = portalMatch
        ? participantActor(decodeURIComponent(portalMatch[1]))
        : reviewerMatch
          ? ({
              type: 'reviewer' as const,
              id: decodeURIComponent(reviewerMatch[1]),
              name: 'Program reviewer',
              scopes: ['reviews:write'],
            } satisfies OperationRequest['actor'])
          : publicSubmissionMatch
            ? ({
                type: 'submitter' as const,
                id: decodeURIComponent(publicSubmissionMatch[1]),
                name: 'Public submitter',
                scopes: ['submissions:write', 'submissions:submit'],
              } satisfies OperationRequest['actor'])
            : url.pathname.startsWith('/public/')
              ? publicReaderActor
              : demoStaffActor
      const response = await stub.fetch(withActor(request, actor))
      const operatorOperation = url.pathname.startsWith('/api/v1/operations/')
        ? decodeURIComponent(url.pathname.slice('/api/v1/operations/'.length))
        : null
      if (response.ok && operatorOperation) {
        let operationData: Record<string, unknown> = {}
        try {
          const operationResponse = (await response.clone().json()) as OperationResponse
          operationData =
            operationResponse.data && typeof operationResponse.data === 'object'
              ? (operationResponse.data as Record<string, unknown>)
              : {}
        } catch {
          operationData = {}
        }
        if (
          operatorOperation === 'campaign.send' ||
          operatorOperation === 'campaign.retry-deliveries'
        ) {
          const campaign = operationData.campaign
          if (
            campaign &&
            typeof campaign === 'object' &&
            typeof (campaign as Record<string, unknown>).id === 'string'
          ) {
            ctx.waitUntil(
              deliverPendingCampaigns(
                stub,
                env,
                (campaign as Record<string, unknown>).id as string,
              ),
            )
          }
        }
        if (
          operatorOperation === 'accelevents.prepare-export' ||
          operatorOperation === 'accelevents.retry-export'
        ) {
          const acceleventsExport = operationData.export
          if (
            acceleventsExport &&
            typeof acceleventsExport === 'object' &&
            typeof (acceleventsExport as Record<string, unknown>).id === 'string'
          ) {
            ctx.waitUntil(
              deliverPendingAcceleventsExports(
                stub,
                env,
                (acceleventsExport as Record<string, unknown>).id as string,
              ),
            )
          }
        }
      }
      return response
    }

    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
