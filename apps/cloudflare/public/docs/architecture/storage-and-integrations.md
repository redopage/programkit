<!-- Canonical: https://programkit.dev/docs/architecture/storage-and-integrations -->
<!-- Markdown: https://programkit.dev/docs/architecture/storage-and-integrations.md -->

# Storage and integrations

ProgramKit has one recommended V1 data path:

```text
one event
   │
   ▼
SQLite-backed Durable Object
   ├── authoritative workspace state
   ├── serialized named operations
   ├── revisions and idempotency
   └── delivery alarms and durable message state
```

This is the default for local development, hosted demos, self-hosting, and the official app. It is
fast, requires no database provisioning, and gives each event an isolated transaction boundary.

## Service ownership

| Concern                             | Recommended owner                        | Status                                    |
| ----------------------------------- | ---------------------------------------- | ----------------------------------------- |
| Event business records              | SQLite-backed Durable Object             | Working default                           |
| Staff identity and event membership | Account and Event Access Durable Objects | Working owner, admin, and viewer roles    |
| File bytes                          | R2                                       | Working scoped, versioned upload pipeline |
| Email and webhook attempts          | Transactional outbox plus object alarm   | Working delivery state and retry path     |
| Cross-event search and analytics    | Rebuildable D1 projection                | Add only when needed                      |
| Airtable team view                  | Optional integration                     | Experimental Airtable-backed mode exists  |

R2, mail, Airtable, and MCP are integrations around the event store. They do not change the core
operation contract.

## Recovery boundary

Cloudflare retains point-in-time recovery history for each SQLite Durable Object for 30 days. The
hosted app exposes owner-only inspection of the active event workspace's current bookmark and an
approximate bookmark for a requested time. It intentionally does not expose restoration as a
normal product or agent action.

The recovery unit is one Durable Object, not one logical event across every service:

- the event workspace object contains program business state;
- account objects contain staff identity and event links;
- event-access objects contain roles, invitations, and API keys;
- R2 contains file bytes.

Restoring the workspace object alone can therefore create cross-service inconsistencies. A future
operator restore runbook must capture a pre-restore export, record Cloudflare's undo bookmark,
restore only after explicit owner confirmation, restart the object session, reconcile access and
files, and verify the event before reopening writes. Logical exports remain the portability and
departure mechanism; PITR is an incident-recovery layer.

## File lifecycle and scan boundary

Live upload routes write private objects below the active event prefix and then register metadata
through `asset.register`. Explicit deletion is a host-coordinated, two-phase operation because an
event-record transaction cannot include an R2 mutation:

1. An authenticated event owner invokes `asset.delete`. Core records who deleted the version, the
   time and optional reason, marks storage cleanup pending, repairs the current-version pointer,
   and reopens or returns the related requirement to review. The tombstone and domain events remain
   in the logical workspace export.
2. The Worker immediately denies downloads and removes the tombstone from participant and public
   projections. It refuses to turn a legacy or cross-event object key into an arbitrary R2 delete.
3. The Worker deletes the event-rooted R2 object and invokes the internal, system-only
   `asset.confirm-deletion` operation. That confirmation records the purge time and a second domain
   event.

R2 deletion is idempotent. If it fails after the tombstone commits, Files shows a cleanup-pending
record that an owner can retry; the file stays unavailable in the meantime. Deterministic
`demo/...` assets are generated fixtures with no R2 bytes, so they follow the same metadata flow
without an object-store call.

This is explicit per-version deletion, not a complete retention program. ProgramKit does not yet
apply age-based retention, legal holds, automatic workspace-offboarding cleanup, orphan discovery,
or R2 usage alerts. Deleted metadata and audit events are retained in workspace state; purged bytes
cannot be reconstructed from a logical export or Durable Object point-in-time recovery.

Upload type and size checks are not malware scanning. There is currently no scanner provider,
quarantine state, or scan-before-availability gate. Do not accept sensitive participant files at
scale until a production deployment supplies and verifies that boundary.

## Airtable decision

The repository includes a real OAuth flow, versioned schema, native operational tables, delta
writes, cache restoration, and signed webhooks. When an operator enables that experimental mode,
Airtable becomes the acknowledged persistence backend and the event object becomes its serialized
hot cache.

That path is not the recommended production default yet. Airtable has no atomic transaction across
the tables touched by operations such as accepting a proposal. The current adapter can partially
complete a multi-table write before a later request fails, and inbound webhook refreshes still need
payload cursors, expected-version checks, and human-visible conflict review.

For V1, keep Airtable disconnected unless the integration itself is under test. A production team
view should eventually work as a non-blocking outbound mirror with reviewable inbound changes:

```text
Durable Object commit
       │
       ├── returns success to the product
       └── records durable sync intent
                    │
                    ▼
              Airtable mirror

Airtable edit ── webhook ── proposed named operations ── human review
```

That direction preserves product availability, makes retries observable, and prevents a direct
spreadsheet edit from bypassing domain invariants. It is future architecture, not a claim about the
current runtime.

## D1 decision

D1 is not another primary database. A future D1 database may index multiple event objects for
organization-wide search, reporting, or administrative views. It must be rebuildable and may lag
behind an event transaction.

## Portability

The domain engine and logical export do not depend on Cloudflare. The supported deployment still
does. A second runtime needs an equivalent implementation for transactions, identity, files,
background jobs, mail, live updates, tests, and operations. ProgramKit will not advertise a host
until that complete path is maintained.

Use [Deployment](https://forge.smol.ai/andheller/programkit/blob/main/DEPLOYMENT.md) for the runnable Cloudflare assembly and the
[Airtable guide](/docs/integrations/airtable.md) for the exact experimental behavior.
