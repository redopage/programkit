# Architecture

CRM Library has three publishable package boundaries and one Cloudflare reference assembly.

```text
Operator UI ───────────────┐
Participant portal ────────┼── Worker host ── trusted actor context ── operation processor
REST clients ──────────────┤       │                                      │
Agent MCP + skills ────────┘       └── workspace key ── Durable Object ───┤
Public agenda ───────────────────────── read-only published projection     ├── domain events
                                                                           └── workspace state
```

## Package responsibilities

### `@crm-library/core`

Core owns domain types, the operation manifest, validation, scope checks, state transitions,
optimistic entity versions, idempotency, append-only domain events, reviewable change sets,
selectors, the portable repository contract, HTTP request handling, and the Cloudflare Durable
Object adapter.

No presentation or agent code writes storage directly.

### `@crm-library/presentation`

Presentation owns the responsive operator workspace, participant portal, and public agenda. It
reads canonical state and submits mutations through `/api/v1/operations/{operationName}`. When the
path starts with `/portal/{participationId}`, it uses the dedicated projected-state and participant
operation routes instead.

### `@crm-library/agent`

Agent owns the stateless MCP transport, a curated projection of core capabilities, contextual
resources, and the repository plugin containing procedural skills. Tools call the same core
operation path as the human UI. Skills add operating judgment; they do not reimplement domain
rules.

The MCP endpoint implements the current `2026-07-28` protocol surface and deliberately rejects
legacy initialization.

## Reference request routing

The root `worker.ts` is the Cloudflare host:

1. It reads `x-crm-workspace-key` and accepts only lowercase letters, numbers, underscores, and
   hyphens, up to 64 characters. Missing or invalid values fall back to `demo`.
2. It resolves that key with `DurableObjectNamespace.idFromName`, producing one strong-consistency
   boundary per workspace key.
3. It removes any caller-supplied `x-crm-internal-actor-*` headers and injects an actor selected by
   the host.
4. It forwards API, public, and MCP work to the selected `WorkspaceDurableObject`; other requests go
   to the static asset binding.

Both choices are intentionally simple in the demo. The workspace header is not proof of tenancy,
and the fixed actors are not authentication. A production host must derive workspace membership,
actor identity, and scopes from a verified session or token.

## Mutation path

Every command reaches `executeOperation` through one operation definition:

1. Resolve the trusted actor and required scopes.
2. Validate required input and expected entity versions.
3. Enforce the actor's agent policy and requested execution mode.
4. Bind an idempotency key to the operation, actor, and request fingerprint.
5. Apply domain invariants to a cloned workspace state.
6. Append domain events and increment the workspace revision.
7. Return the next state and operation response from one repository `mutate` callback.
8. Commit the accepted transition atomically.

A dry run returns a preview without mutation. In propose mode, core first validates the proposed
operation against a cloned state, then stores it in a change set. Approval and commit are separate
human operations; commit rechecks scopes, required input, and expected versions before applying
the nested commands.

The in-memory repository serializes mutations with a promise queue. The Cloudflare repository runs
each read/modify/write cycle inside a Durable Object storage transaction.

## Read projections

The HTTP layer has deliberately different projections:

- Operator state requires `workspace:read` and returns the operational workspace without stored
  idempotency responses.
- Participant state requires a participant actor whose ID exactly matches the route participation
  ID. It returns only that person, participation, event, and requirements; internal notes are
  cleared and campaigns, schedule data, integrations, changes, events, and command results are
  omitted.
- The public agenda returns placements from the latest published schedule release, never the live
  draft.
- Logical export requires `workspace:export` and excludes recent idempotency response caches.

The HTTP request body may contain an `actor` field for the portable operation type, but
`handleCoreRequest` replaces it with the actor supplied through `CoreRequestContext`. The host owns
identity; callers do not.

## Reference data model

- `Person`: persistent identity across events
- `Participation`: one person's role and lifecycle in one event
- `Session`: program content independent of schedule placement
- `Placement`: the mutable draft room and time assignment
- `ScheduleRelease`: an immutable, versioned snapshot of published placements
- `RequirementDefinition`: the reusable thing an event needs
- `RequirementInstance`: one participant's state for that requirement
- `Campaign`: exact content, audience, approval, and demo send state
- `ChangeSet`: a reviewable group of proposed operations
- `DomainEvent`: append-only evidence of an accepted mutation

Separating people from participation supports multiple events, sessions, roles, assistants, event
history, and independent confirmation and readiness lifecycles without collapsing them into a
single speaker record.

## Schedule publication

Draft placements remain mutable and private. `schedule.publish` validates the current draft and
appends a new `ScheduleRelease` containing readonly placement copies, publisher identity,
publication time, and a monotonically increasing version. The public agenda selector reads the
latest release for the active event. Moving a draft placement after publication cannot rewrite a
previous release.

## Durable Object persistence

The Cloudflare adapter stores one logical JSON workspace document per SQLite-backed Durable Object.
It serializes the document and splits it into values of 200,000 characters plus a metadata record.
Writes, metadata replacement, removal of obsolete chunks, and migration from the original single
storage value occur inside the object's storage transaction.

This design favors inspectable, atomic multi-record operations for the reference workload of
hundreds of people and relatively low write concurrency. Chunking avoids relying on one large
Durable Object value, but it is not a substitute for retention limits, capacity monitoring, or an
external file store.

## Build and portability boundaries

Each package builds independently with its `tsconfig.build.json`:

- core emits the root API and a separate `@crm-library/core/cloudflare` export;
- presentation emits React ESM, declarations, and `styles.css`;
- agent emits its MCP ESM and declarations and packages the plugin directory.

Package exports point to `dist/` by default and to TypeScript source under the `development`
condition used in the workspace.

`WorkspaceRepository` is the persistence portability seam. A conventional deployment can
implement its atomic `read` and `mutate` contract with SQLite or Postgres. Identity, email,
webhooks, object storage, queues, and secret management belong to host adapters and are not
provided by the reference demo.
