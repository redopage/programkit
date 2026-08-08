# Architecture

ProgramKit has three publishable package boundaries and private host applications. The current
`apps/cloudflare` application is the reference assembly.

```text
Operator workspace ────────┐
Public CFP ─────────────────┤
Reviewer workspace ─────────┼── host ── trusted actor context ── operation processor
Speaker portal ─────────────┤    │                                      │
Public program ─────────────┤    └── tenant key ── workspace gateway ──┤
REST clients ───────────────┤                                           ├── domain events
Agent MCP + skills ─────────┘                                           └── workspace state
```

## Package responsibilities

### `@programkit/core`

Core owns domain types, the operation manifest, validation, scope checks, state transitions,
optimistic entity versions, idempotency, append-only domain events, reviewable change sets,
selectors, the testable repository contract, HTTP request handling, and the Cloudflare Durable
Object adapter.

No web or agent code writes storage directly.

### `@programkit/web`

Web owns the responsive operator, public-CFP, reviewer, speaker, and public-program experiences.
It maps the browser URL to an explicit `ProgramKitSurface` before reading data. The injected
`ProgramKitClient` is the host boundary; its default implementation selects the corresponding HTTP
projection and restricted operation route. TanStack Router owns the typed file-based route tree
and route-level code splitting. TanStack Query owns canonical request, retry, refresh, and mutation
lifecycle state.

### `@programkit/agent`

Agent owns the stateless MCP transport, a curated projection of core capabilities, contextual
resources, and the repository plugin containing procedural skills. Tools call the same core
operation path as the human UI. Skills add operating judgment; they do not reimplement domain
rules.

The MCP endpoint implements the current `2026-07-28` protocol surface and deliberately rejects
legacy initialization.

## Reference request routing

`apps/cloudflare/src/worker.ts` is the Cloudflare host:

1. It reads `x-programkit-workspace-key` and accepts only lowercase letters, numbers, underscores, and
   hyphens, up to 64 characters. Missing or invalid values fall back to `demo`.
2. It resolves that key with `DurableObjectNamespace.idFromName`, producing one strong-consistency
   boundary per workspace key.
3. It removes any caller-supplied `x-programkit-internal-actor-*` headers and injects an actor selected by
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
- Public submission-form state returns only the requested open form, its fields, and its event.
  Its operation route accepts only draft creation and submission for that same form.
- Reviewer state returns only that reviewer, their assignments, assigned proposals, applicable
  forms and evaluation plans, and their own scorecards. Blind plans redact identity-purpose
  answers. Its operation route accepts only scorecards for that reviewer.
- Public-program state returns only the active event, latest published release, released sessions,
  public speaker fields, tracks, and rooms. It never contains the live draft or operational
  collections.
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

## Cloudflare data services

The authoritative metadata boundary is one SQLite-backed Durable Object per workspace. D1 is not a
second primary database. If organization-wide search or analytics warrants it, D1 receives a
rebuildable projection from domain events and may lag behind the workspace transaction.

Airtable is also downstream of accepted operations. A transactional outbox will wake a Queue or
Durable Object alarm that batch-upserts selected read models and records its cursor, attempts, and
errors. Inbound edits are compared against the last-synced baseline. Safe allowlisted changes become
named operations or previewable change sets; concurrent changes become explicit conflicts. Airtable
never overwrites ProgramKit state silently.

R2 will own private file bytes. Domain `Asset` records store opaque object keys and safe metadata;
upload and download routes recheck workspace and record ownership. Cloudflare Email Service will
be the default outbound transport behind the same delivery outbox, with provider identifiers and
attempt history stored as operational records.

The workspace object can also own hibernating WebSocket connections. After a transaction commits,
it broadcasts a small revision and topic hint; each authorized web surface invalidates and refetches
its existing HTTP projection. Full workspace state never travels over the socket, and expected
versions remain the concurrency boundary. See [Live workspace updates](docs/architecture/live-updates.md).

## Build and platform boundaries

Each package builds independently with its `tsconfig.build.json`:

- core emits the root API and a separate `@programkit/core/cloudflare` export;
- web emits React ESM, declarations, and `styles.css`;
- agent emits its MCP ESM and declarations and packages the plugin directory.

Package exports point to `dist/` by default and to TypeScript source under the `development`
condition used in the workspace.

`WorkspaceRepository` is the testable boundary between domain transitions and Durable Object
storage. Identity, email, webhooks, R2, queues, Airtable credentials, and secret management are
composed in `apps/cloudflare` and are not provided by the reference demo.

See [Deployment](DEPLOYMENT.md) for the supported Cloudflare stack, D1 decision, Airtable mirror,
and production binding sequence.
