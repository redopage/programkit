# `@programkit/core`

The platform-independent source of truth for conference-program records and behavior. Core contains domain types, one
operation manifest, authorization, invariants, expected-version checks, idempotency, audit events,
change sets, selectors, repository contracts, HTTP handling, deterministic seed data, and the
versioned Airtable and Cloudflare Durable Object adapters.

It has no React or agent dependency.

## Exports

The package root exports:

- `executeOperation` and the operation manifest;
- `handleCoreRequest` for a Fetch API host;
- `MemoryWorkspaceRepository`;
- `AirtableWorkspaceStore`, `AirtableCachedWorkspaceRepository`, and the versioned native table
  definitions;
- `createSeedState`;
- readiness, form-publish readiness, mapping compatibility, schedule, agenda, and relationship
  selectors;
- all public domain and operation types.

`@programkit/core/cloudflare` separately exports `WorkspaceDurableObject` so tests, tools, and web
builds do not load the Cloudflare runtime module.

## Direct operation use

```ts
import { createSeedState, executeOperation } from '@programkit/core'

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
import { handleCoreRequest, MemoryWorkspaceRepository, type Actor } from '@programkit/core'

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

`mutate` must serialize the read, validation, and accepted state replacement. The memory repository
uses a promise queue. When Airtable is configured, `AirtableCachedWorkspaceRepository` writes the
record delta before advancing its wrapped cache. Without Airtable, the Cloudflare adapter runs the
callback and persistence inside a Durable Object storage transaction.

The Cloudflare cache stores one logical JSON workspace per SQLite-backed object, chunked into
200,000-character values with transactional metadata. The Airtable adapter separately creates and
validates its schema, batch-upserts stable records, computes state deltas, and rebuilds the full
workspace. It takes credentials through its constructor and does not read environment variables.

## Publication and storage boundary

Schedule placements are mutable drafts. Publishing appends an immutable `ScheduleRelease` snapshot;
the public agenda selector reads the latest release rather than draft placements.

Keep authentication, Cloudflare Email Service delivery, webhook routing, R2 storage, and secrets in
`apps/cloudflare`. The Airtable client stays in core because it implements the repository boundary
with the web-standard Fetch API and is independently testable. The reference host decides whether
to compose it.

## Build

From the repository root:

```bash
pnpm --filter @programkit/core build
```

The package emits ESM JavaScript and declarations to `dist/`. Published package exports use
`dist/`; the monorepo can select TypeScript source through the `development` export condition.
