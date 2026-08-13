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
                                                                            │
                                         Durable Object SQLite store ◄───────┘
                                                    │
                                                    └── optional integrations
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

`apps/cloudflare/src/worker.ts` is the Cloudflare host. Its routing depends on the deployment
profile:

1. The public-site profile serves the small marketing entry and legal pages. Workspace APIs are
   not exposed.
2. The hosted-demo profile exchanges a random capability link for a same-site cookie and maps that
   capability to one expiring `WorkspaceDurableObject` containing sample data.
3. The hosted-app profile verifies a passwordless session through an account-sharded
   `AuthDurableObject`, checks event membership, and maps the selected event to its own
   `WorkspaceDurableObject`.
4. The self-hosted development path may read `x-programkit-workspace-key`. This remains routing
   input for sample workspaces and is never accepted as hosted-app membership.
5. Every path removes caller-supplied `x-programkit-internal-actor-*` headers and injects an actor
   selected by the host before forwarding to core.

The app session and event cookie are HTTP-only, secure in production, and same-site. Magic-link
and session secrets are stored only as hashes. See
[Identity, events, and storage ownership](docs/architecture/identity-and-tenancy.md) for the exact
boundary and current team-membership limitations.

## Mutation path

Every command reaches `executeOperation` through one operation definition:

1. Resolve the trusted actor and required scopes.
2. Validate required input and expected entity versions.
3. Enforce the actor's agent policy and requested execution mode.
4. Bind an idempotency key to the operation, actor, and request fingerprint.
5. Apply domain invariants to a cloned workspace state.
6. Append domain events and increment the workspace revision.
7. Return the next state and operation response from one repository `mutate` callback.
8. Persist the accepted transition in the event's Durable Object transaction.
9. Return the operation response and let post-commit integrations react to durable intent.

The experimental Airtable-backed repository is a current exception to step 8. When enabled, it
writes Airtable record deltas before advancing its local cache. This mode is documented and tested,
but it is not the recommended V1 store because partial multi-table retry and inbound conflict
review are incomplete.

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

## Event storage and optional Airtable mode

Each Cloudflare event has one logical JSON workspace document in its SQLite-backed Durable Object.
The zero-configuration demo, self-hosted deployment, and every new app event use that object as the
complete authoritative store. Account identity, sessions, and event memberships stay in the
separate account object.

When an operator explicitly enables the experimental Airtable-backed mode, Airtable becomes the
acknowledged persistence backend and the same workspace document becomes the serialized hot cache.
This behavior is optional, does not run on the recommended evaluation path, and is not the
recommended V1 production configuration.

The Airtable version 1 schema stores one non-native workspace snapshot plus native events, people,
participations, submissions, tasks, reviews, sessions, placements, tracks, and rooms. Native
collections are intentionally absent from the snapshot, so a successful restore must reassemble
all managed tables. Stable IDs make full exports and record deltas idempotent.

The object serializes cached documents into values of 200,000 characters plus a metadata record.
Writes, metadata replacement, removal of obsolete chunks, and migration from the original single
storage value occur inside an object storage transaction. A durable hydration marker prevents an
Airtable read after every isolate restart. Normal application reads use the cache and make zero
Airtable requests.

The optional mode favors inspectable records for a reference workload of hundreds of people and
relatively low write concurrency. Airtable does not offer one atomic transaction across tables.
ProgramKit therefore writes idempotent table deltas in the serialized object request, returns an
error without advancing the cache if Airtable rejects them, and still needs a durable retry journal
before that path is production-complete.

## Cloudflare data services

One SQLite-backed Durable Object per event owns business records, serialized operations, and future
live-client fan-out. A separate account object owns identity and the small cross-event membership
index. D1 is not a second primary database. If organization-wide search or analytics warrants it,
D1 receives a rebuildable projection and may lag behind the event transaction.

The current Airtable adapter creates the schema, batch-upserts changed records, rebuilds the cache,
and verifies webhook HMACs. The experimental webhook performs a full refresh. Production work must
move mirroring out of the request path, add the Airtable payload cursor, fetch only affected
records, durably retry, and convert direct edits to named operations or previewable change sets.

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
composed in `apps/cloudflare`. Hosted staff and participant identity, magic-link email, scoped R2
uploads, and the product-delivery outbox are implemented there. Remaining production hardening is
tracked in the identity, file-storage, and integration documents rather than hidden behind a
second runtime path.

See [Storage and integrations](docs/architecture/storage-and-integrations.md) for service ownership
and [Deployment](DEPLOYMENT.md) for the supported Cloudflare stack and production binding sequence.
