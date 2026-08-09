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

Airtable is the durable source of truth after a workspace connects through OAuth or an operator
configures the single-install token fallback. The Durable Object is not a second independent
database. It is the low-latency coordination and cache layer that keeps ordinary reads fast and
avoids spending Airtable API calls on page loads.

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
- OAuth webhook registration, HMAC verification, renewal alarms, and debounced cache refresh;
- the environment-configured `/webhooks/airtable` fallback for operator-owned tokens;
- deterministic tests for round-trip restoration, native edits, schema mismatch, cache behavior,
  and rejected writes.

## Measured request budget

The checked-in AIE NYC seed uses 171 Airtable records, well below the Free plan's 1,000-record base
limit. Live testing against a new base measured:

| Action                                      | Airtable API requests |
| ------------------------------------------- | --------------------: |
| Normal application page load                |                     0 |
| One person edit plus workspace revision     |                     2 |
| OAuth webhook registration or renewal       |                     1 |
| Explicit full rebuild of all managed tables |                    11 |
| Full 171-record export after schema setup   |                    34 |

The full export is a setup, repair, and test operation. It must not run on every app mutation. A
typical mutation updates the `ProgramKit State` record and one native record in two requests. A
multi-aggregate operation such as accepting a submission uses one request per affected table,
with records batched ten at a time.

## Connect Airtable

### Hosted ProgramKit

Open **Integrations**, choose **Connect Airtable**, and approve access in Airtable. Choose custom
access when you want to grant only one base. After Airtable returns to ProgramKit, select the base
that should hold the workspace.

The hosted flow uses OAuth with PKCE. Access and rotating refresh tokens are stored only in the
workspace Durable Object and never reach the browser. ProgramKit refreshes an expiring access token
once inside the object's serialized execution boundary, preventing refresh-token races.

OAuth installation behaves predictably:

- A blank base receives the versioned ProgramKit tables and the current workspace.
- A base with a compatible `ProgramKit State` table is imported instead of overwritten.
- Unrelated tables and fields are left alone.
- A base with unrelated tables that collide with ProgramKit's managed names is rejected instead of
  being modified.
- A deployed HTTPS connection registers a signed webhook so direct Airtable edits refresh the
  ProgramKit cache automatically.
- Disconnecting removes ProgramKit's webhook and stored authorization. The last local cache
  remains available.

A dedicated base is recommended, but it is not mandatory. ProgramKit does not create a new base
because that would require broader workspace permissions. Create a blank base in Airtable first,
then grant it during consent.

### Self-hosted OAuth

Each self-hosted domain should register its own OAuth integration in Airtable's Builder Hub. This
keeps the deployment independent and gives its operator control over consent and token lifecycle.

1. Register an OAuth integration.
2. Add the exact callback `https://YOUR_HOST/api/v1/integrations/airtable/oauth/callback`.
   Local development may also use
   `http://localhost:4173/api/v1/integrations/airtable/oauth/callback`.
3. Add `https://YOUR_HOST/privacy`, `https://YOUR_HOST/terms`, and a working support email before
   requesting production use from Airtable.
4. Grant `data.records:read`, `data.records:write`, `schema.bases:read`,
   `schema.bases:write`, and `webhook:manage`.
5. Add the client ID and optional server-side client secret as Worker secrets:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_OAUTH_CLIENT_ID
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_OAUTH_CLIENT_SECRET
```

PKCE works without a client secret. A server-side deployment should add one when the OAuth client
uses it. Never commit the value.

### Operator-owned token fallback

A personal access token remains available for a single self-hosted installation or automated
testing. It is an environment-only operator secret, not a hosted setup form. Hosted ProgramKit must
not ask users to paste personal access tokens.

Create a blank base and a token scoped only to that base, then copy the example variables:

```bash
cp apps/cloudflare/.dev.vars.example .dev.vars
```

Then create or repair the schema, populate the deterministic demo, and prove restoration:

```bash
pnpm airtable:setup
pnpm airtable:seed
pnpm airtable:verify
```

`airtable:setup` is additive. It creates managed tables and missing fields but does not remove
unknown tables or fields. `airtable:seed` reconciles every managed row with the deterministic demo
and removes stale rows from managed tables. Do not run it against a base containing data you want
to keep.

For a deployed Worker, store installation values with Wrangler rather than committing them:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_TOKEN
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_BASE_ID
pnpm --filter @programkit/app-cloudflare exec wrangler secret put AIRTABLE_WEBHOOK_MAC_SECRET
```

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
base64 MAC secret returned when the webhook is created. The hosted callback routes the ping to the
correct workspace object without exposing that secret. The object responds with an empty `204`,
debounces closely spaced pings, and refreshes its cache after 1.5 seconds.

ProgramKit registers a webhook filter for client, Airtable form, automation, and sync changes. It
intentionally omits `publicApi`, which prevents ProgramKit's own acknowledged writes from creating
a refresh loop.

The inbound path is a safe but deliberately simple first pass. It currently performs an 11-request
full refresh and applies only top-level columns declared in each table's `editableFields` map over
the preserved JSON entity. Before using real conference data, finish the payload cursor, convert
inbound edits to named domain operations or change sets, and make protected-field and deletion
policy explicit.

OAuth webhooks expire after seven days. ProgramKit schedules a Durable Object alarm one day before
expiry, refreshes the registration, stores the new expiry, and retries a failed renewal one hour
later. Payload cursors, last transaction numbers, and a detailed operator-visible error history
remain future work.

## Why this is not D1

D1 would be useful for organization-wide analytics or search across many event workspaces. It does
not add value to this single-workspace persistence path. Airtable owns durable business records,
while the workspace Durable Object supplies serialized coordination, cached reads, and eventual
WebSocket fan-out. File bytes still belong in R2, with only safe metadata and object references in
Airtable.

## Current boundary

This is a working source-of-truth and OAuth vertical slice, not the end of the integration. The
remaining production work is:

- webhook payload cursors and narrow record fetches instead of a full refresh;
- a durable retry journal or alarm for partially completed multi-table writes;
- conversion of every inbound edit through named operations and expected versions;
- protected fields, archive semantics, and a visible conflict queue;
- verified organization membership so multiple people can share one hosted workspace safely;
- operational status, quota, lag, webhook expiry, and retry visibility in the web application.
