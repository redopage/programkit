# Airtable source of truth with a Durable Object cache

ProgramKit now has a working Airtable persistence adapter. The recommended production direction is:

```text
Airtable base
  durable workspace records and reconstructable state
        │
        │ cold restore, acknowledged writes, webhook refresh
        ▼
SQLite-backed Durable Object
  hot workspace cache, serialized mutations, live connections
        │
        ├── React application
        ├── HTTP API
        └── agent tools
```

Airtable is the durable source of truth when its three runtime variables are configured. The
Durable Object is not a second independent database. It is the low-latency coordination and cache
layer that keeps ordinary reads fast and avoids spending Airtable API calls on page loads.

Without Airtable variables, the same repository runs in local-first demo mode and the Durable
Object remains self-contained. This preserves the one-command contributor experience.

## What works now

The version 1 schema contains one reconstructable workspace record plus ten native operational
tables:

| Table            | Seed records | Purpose                                   |
| ---------------- | ------------ | ----------------------------------------- |
| ProgramKit State | 1            | Versioned non-native workspace snapshot   |
| Events           | 1            | Event identity and timing                 |
| People           | 16           | Speaker and participant identities        |
| Participations   | 16           | Per-event speaker lifecycle               |
| Submissions      | 6            | Proposal pipeline                         |
| Tasks            | 96           | Speaker onboarding requirements           |
| Reviews          | 8            | Reviewer assignments                      |
| Sessions         | 10           | Accepted and guaranteed program content   |
| Placements       | 10           | Draft and published room/time assignments |
| Tracks           | 4            | Program categories                        |
| Rooms            | 3            | Scheduling inventory                      |

Every native row has a stable `ProgramKit ID`, deterministic `ProgramKit Sort`, useful columns for
humans, and `ProgramKit JSON` for lossless reconstruction. The snapshot intentionally omits the ten
native collections. A restore therefore cannot succeed from the snapshot alone. It must read and
reassemble the Airtable tables.

The adapter currently provides:

- additive, versioned schema setup and validation;
- batch upsert and stale managed-row cleanup;
- exact logical export and rebuild;
- field allowlists for a small set of direct Airtable edits;
- delta writes that acknowledge the app mutation only after Airtable accepts it;
- an HMAC-verified Airtable webhook endpoint at `/webhooks/airtable`;
- a Durable Object refresh endpoint used only by the verified Worker webhook;
- deterministic tests for round-trip restoration, native edits, schema mismatch, cache behavior,
  and rejected writes.

## Measured request budget

The checked-in AIE NYC seed uses 171 Airtable records, well below the Free plan's 1,000-record base
limit. Live testing against a new base measured:

| Action                                      | Airtable API requests |
| ------------------------------------------- | --------------------: |
| Normal application page load                |                     0 |
| One person edit plus workspace revision     |                     2 |
| Explicit full rebuild of all managed tables |                    11 |
| Full 171-record export after schema setup   |                    34 |

The full export is a setup, repair, and test operation. It must not run on every app mutation. A
typical mutation updates the `ProgramKit State` record and one native record in two requests. A
multi-aggregate operation such as accepting a submission uses one request per affected table,
with records batched ten at a time.

## Set up a base

Create a blank Airtable base and a personal access token scoped only to that base. The setup token
needs these scopes:

- `data.records:read`
- `data.records:write`
- `schema.bases:read`
- `schema.bases:write`
- `webhook:manage` if you will enable direct Airtable edit notifications

Copy the example variables and add the token and base ID:

```bash
cp apps/cloudflare/.dev.vars.example apps/cloudflare/.dev.vars
```

Then create or repair the versioned schema, populate the deterministic demo, and prove it can be
restored:

```bash
pnpm airtable:setup
pnpm airtable:seed
pnpm airtable:verify
```

`airtable:setup` is additive. It creates managed tables and missing fields but does not remove
unknown tables or fields. `airtable:seed` reconciles every managed row with the deterministic demo
and removes stale rows from managed tables. Do not run it against a base containing data you want
to keep.

For a deployed Worker, store all three values with Wrangler rather than committing them:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_TOKEN
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_BASE_ID
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_WEBHOOK_MAC_SECRET
```

The base ID is not sensitive, but keeping all installation-specific values out of source makes the
reference repository easier to fork.

## Runtime behavior

When Airtable is configured, the Durable Object checks a durable cache marker. A missing marker
causes one full rebuild from Airtable, followed by local cached reads. The marker and cached state
survive object eviction, so a new isolate does not reread Airtable on every cold start.

For an app mutation:

1. The Durable Object serializes the mutation.
2. Core validates the named operation and produces the next workspace state.
3. The Airtable adapter computes record-level differences.
4. Changed records are idempotently upserted in batches of ten.
5. Only after every Airtable request succeeds is the Durable Object cache updated and success
   returned.

If Airtable rejects a write, ProgramKit returns an error and retains the previous cache revision.
Because each upsert uses a stable ID, retrying a partially completed multi-table write converges
instead of duplicating records.

## Direct edits and webhooks

Airtable notification pings are HMAC verified using the `X-Airtable-Content-MAC` header and the
base64 MAC secret returned when the webhook is created. The Worker responds with an empty `204`
and refreshes the cache through the Durable Object binding.

Use an Airtable webhook filter with `fromSources: ["client"]`. It observes edits made in the
Airtable interface while ignoring ProgramKit's own Public API writes, which prevents a write loop
at the source.

This webhook path is an experimental first pass. It currently performs an 11-request full refresh
and applies only top-level columns declared in each table's `editableFields` map over the preserved
JSON entity. Before using real conference data, finish the payload cursor, convert inbound edits to
named domain operations or change sets, and make protected-field and deletion policy explicit.

Airtable webhooks expire after seven days unless payload listing or refresh extends them. A
production installation also needs an alarm that refreshes the webhook and records its cursor,
last transaction number, and latest error.

## Why this is not D1

D1 would be useful for organization-wide analytics or search across many event workspaces. It does
not add value to this single-workspace persistence path. Airtable owns durable business records,
while the workspace Durable Object supplies serialized coordination, cached reads, and eventual
WebSocket fan-out. File bytes still belong in R2, with only safe metadata and object references in
Airtable.

## Current boundary

This is a credible source-of-truth vertical slice, not the end of the integration. The remaining
production work is:

- webhook payload cursors and narrow record fetches instead of a full refresh;
- a durable retry journal or alarm for partially completed multi-table writes;
- conversion of every inbound edit through named operations and expected versions;
- protected fields, archive semantics, and a visible conflict queue;
- OAuth installation for a hosted multi-tenant service instead of one owner's token;
- operational status, quota, lag, webhook expiry, and retry visibility in the web application.
