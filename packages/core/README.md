# `@crm-library/core`

The portable source of truth for CRM records and behavior. Core contains domain types, one
operation manifest, authorization, invariants, expected-version checks, idempotency, audit events,
change sets, selectors, repository contracts, HTTP handling, deterministic seed data, and the
Cloudflare Durable Object adapter.

It has no React or agent dependency.

## Exports

The package root exports:

- `executeOperation` and the operation manifest;
- `handleCoreRequest` for a Fetch API host;
- `MemoryWorkspaceRepository`;
- `createSeedState`;
- readiness, schedule, agenda, and relationship selectors;
- all public domain and operation types.

`@crm-library/core/cloudflare` separately exports `WorkspaceDurableObject` so non-Cloudflare hosts
do not load the Cloudflare runtime module.

## Direct operation use

```ts
import { createSeedState, executeOperation } from '@crm-library/core'

const state = createSeedState()
const result = executeOperation(state, 'participation.set-status', {
  input: { participationId: 'par_003', status: 'confirmed' },
  idempotencyKey: 'confirm-par-003',
  actor: {
    type: 'staff',
    id: 'usr_example',
    name: 'Example operator',
    scopes: ['participations:write'],
  },
})

if (!result.response.ok) throw new Error(result.response.error?.message)
const nextState = result.state
```

When embedding core directly, always supply a server-verified actor. The built-in default actor is
for the seeded development experience and has wildcard scope.

## HTTP host use

```ts
import { handleCoreRequest, MemoryWorkspaceRepository, type Actor } from '@crm-library/core'

const repository = new MemoryWorkspaceRepository()

export async function fetch(request: Request, actor: Actor) {
  return (
    (await handleCoreRequest(request, repository, { actor })) ??
    new Response('Not found', { status: 404 })
  )
}
```

`CoreRequestContext.actor` is trusted host input. The HTTP handler overwrites any actor in the JSON
operation body with this context actor. Construct it only from a verified session or token and
server-owned scopes.

Participant callers use the dedicated `/api/v1/portal/{participationId}` routes. The handler
requires the actor ID to equal the route ID and projects only that participant's person,
participation, event, and requirement records.

## Repository contract

```ts
interface WorkspaceRepository {
  read(): Promise<WorkspaceState>
  mutate<T>(mutation: (state: WorkspaceState) => { state: WorkspaceState; result: T }): Promise<T>
}
```

`mutate` must be an atomic read/modify/write boundary. `MemoryWorkspaceRepository` serializes
mutations. The Cloudflare adapter runs the callback and persistence inside a Durable Object storage
transaction.

The Cloudflare adapter stores one logical JSON workspace per SQLite-backed object, chunked into
200,000-character values with transactional metadata. This keeps multi-record commands atomic and
avoids relying on one large storage value. It also reads and migrates the original single-value
format.

## Publication and portability

Schedule placements are mutable drafts. Publishing appends an immutable `ScheduleRelease` snapshot;
the public agenda selector reads the latest release rather than draft placements.

To use another database, implement `WorkspaceRepository` with equivalent atomic semantics. Keep
authentication, email, webhook delivery, file storage, and secrets in host adapters rather than
adding provider concerns to the domain package.

## Build

From the repository root:

```bash
pnpm --filter @crm-library/core build
```

The package emits ESM JavaScript and declarations to `dist/`. Published package exports use
`dist/`; the monorepo can select TypeScript source through the `development` export condition.
