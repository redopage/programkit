# Deploying ProgramKit on Cloudflare

Cloudflare is ProgramKit's supported deployment target. The repository ships one explicit
application in `apps/cloudflare`; there is no generated adapter layer and no second host to keep in
sync.

This is an opinionated product decision, not an accidental lock-in. It keeps installation,
operations, performance work, and documentation focused enough for a small open-source team to do
well. The domain packages remain clean, and the logical export remains provider-independent, but
the project does not promise an untested deployment matrix.

## The supported stack

```text
Browser
  │
  ▼
Cloudflare Worker ── Workers Static Assets (Vite web build)
  │
  ├── workspace Durable Object ── SQLite-backed atomic event state
  ├── R2                      ── private participant uploads
  ├── Durable Object outbox   ── frozen messages, calendar payloads, and provider batches
  └── post-commit consumers   ── Email Service + Accelevents calls when host credentials exist
```

The runnable application includes the Worker, static assets, one SQLite-backed Durable Object per
workspace key, a private R2 binding for participant requirement uploads, and a Cloudflare Email
Service binding. Local development emulates the bucket and email send. A remote deployment must
provision `programkit-assets` and onboard the configured sending domain first; it needs no D1
database or queue. The Accelevents consumer remains inert unless the owner supplies its Enterprise
API key as a Worker secret. Both consumers run only after the outbox transaction commits, and only
provider IDs can turn `pending_provider` into delivered evidence.

The production additions are intentionally Cloudflare-native:

| Concern                   | Default                                    | Why                                                                                    |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| Web and API               | Worker + Static Assets                     | One origin, one deploy, no client-side API configuration                               |
| Operational state         | SQLite-backed Durable Object               | Atomic conference workflows and strongly consistent workspace reads                    |
| Files                     | R2                                         | Direct uploads, private objects, lifecycle policies, and no file bytes in domain state |
| Background delivery       | Durable Object outbox + Worker `waitUntil` | Provider work starts after commit; explicit retry operations preserve durable intent   |
| Email                     | Cloudflare Email Service binding           | Native Worker delivery; Resend may remain an optional provider                         |
| Team tables               | Airtable mirror                            | Familiar collaboration without putting Airtable on the request path                    |
| Cross-workspace analytics | D1 projection, only when needed            | SQL reporting across many workspace objects                                            |

## Why Durable Objects are the default database

ProgramKit's important writes are workspace transactions: accept a proposal and create the related
speaker, participation, requirements, and session; publish one immutable schedule release; approve
and commit a group of changes. A SQLite-backed Durable Object gives each workspace a single
coordination boundary with attached transactional storage. That matches the domain today.

The current repository stores one logical workspace JSON document in chunked Durable Object values
and replaces it atomically. This is deliberately simple and inspectable for an event-sized data
set. Moving to normalized SQLite tables inside the same Durable Object is available when query or
document-size evidence justifies it; it does not require a product-level database change.

### Where D1 fits

D1 is not the default source of truth. It becomes useful when ProgramKit needs queries that cross
many workspace objects, such as an organization-wide event index, global search, analytics, or an
administrative control plane.

That future D1 database should be a rebuildable read projection fed by domain events. Event writes
still commit in the workspace object; the projection may lag briefly and must never decide whether
a domain transition is valid.

## How the Airtable integration works

Airtable is an optional, conflict-aware operational workspace. It is valuable because program and
review teams already know how to filter, group, comment on, and edit an Airtable base. It is not
ProgramKit's live application database: every page load and accepted proposal must not depend on a
third-party API limit or retry window.

```text
named operation
      │
      ▼
Durable Object transaction ── domain event + outbox intent
      │                                      │
      │ user receives success                ▼
      │                              Queue / object alarm
      │                                      │
      └────────────────────────────── batch upsert to Airtable
                                             │
                                  webhook / cursor polling
                                             │
                                             ▼
                              three-way reconciliation preview
```

The first mirror should create four tables:

| Airtable table | Stable key      | Useful mirrored fields                                                            |
| -------------- | --------------- | --------------------------------------------------------------------------------- |
| Submissions    | `ProgramKit ID` | title, kind, status, speaker, track, review score, updated time, ProgramKit link  |
| Speakers       | `ProgramKit ID` | name, email, company, confirmation, readiness, session links, portal link         |
| Sessions       | `ProgramKit ID` | title, format, track, duration, status, speakers, scheduled time, ProgramKit link |
| Tasks          | `ProgramKit ID` | speaker, requirement, status, due time, review state, ProgramKit link             |

Every mirrored row also carries `ProgramKit Revision` and `Last Synced At`. Sync uses Airtable batch
requests, exponential backoff, and a per-workspace cursor. Secrets stay in Worker secrets. File
bytes stay in R2; Airtable receives only authorized ProgramKit links or safe metadata.

Inbound edits use an explicit field allowlist and a saved last-synced baseline. A safe Airtable-only
edit becomes a named operation or previewable change set. A ProgramKit-only edit is exported. If a
field changed differently on both sides, neither side silently wins: the integration creates a
reconciliation item for a human. Protected fields are repaired from ProgramKit, and row deletion
never hard-deletes domain data. See [the Airtable integration guide](docs/integrations/airtable.md)
for the field policy, loop prevention, and tested comparison primitive.

## Local development

Prerequisites are Node.js, Corepack, and pnpm. Wrangler authentication is only needed for remote
development or deployment.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. The Cloudflare Vite plugin runs the React app, Worker, and local
SQLite-backed Durable Object together in `workerd`.

## Deploy

Authenticate Wrangler, review `apps/cloudflare/wrangler.jsonc`, and provision the private asset
bucket once for the target account:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler login
pnpm --filter @programkit/app-cloudflare exec wrangler r2 bucket create programkit-assets
```

Then run:

```bash
pnpm deploy
```

The command builds the three public packages, type-checks the workspace, builds the Vite client and
Worker, and deploys the checked-in Cloudflare application. No deployment files are generated behind
the scenes.

After deploying, verify:

```bash
curl https://YOUR_HOST/api/v1/health
curl https://YOUR_HOST/api/v1/events
curl https://YOUR_HOST/public/agenda.json
curl -OJ https://YOUR_HOST/public/v1/events/evt_nyc_2026/calendar.ics
```

Outbound email activation is a separate release-enablement step. The binding and consumer are
checked in. Onboard the sender domain, complete its DNS verification, confirm
`PROGRAMKIT_EMAIL_FROM` is an allowed address, deploy, and exercise one campaign containing only
controlled smoke recipients. Until a provider message ID returns, the product intentionally reports
the row as pending or failed rather than sent.

Accelevents activation is also external to the repository. Store the owner-managed Enterprise key
only in the Worker secret store:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler secret put ACCELEVENTS_API_KEY
```

Use a controlled Accelevents event for the first staged release and retain its provider IDs and
ProgramKit batch evidence. Do not put the key in `.env`, `wrangler.jsonc`, screenshots, or logs.

Then open the operator app, public CFP, reviewer workspace, speaker portal, and public program. In
the speaker portal, verify an allowed file can be uploaded and downloaded only through the owning
participant session. Open `/embed/speakers` and `/embed/itinerary` from the intended parent site and
verify the deployed Content Security Policy allows only that framing relationship. In the
speaker portal, confirm published resources render and a rejected HTML card cannot execute active
content.

## Production bindings, in order

The golden-path production work should land in this sequence:

1. Replace the demo workspace header and fixed actors with verified sessions, API tokens, and
   workspace membership.
2. Evolve the current participant-owned R2 upload and private-download path into authenticated
   upload initiation with progress, retry, cancellation, replacement, scanning, and lifecycle
   cleanup.
3. Connect the separate submission-confirmation outbox to the checked-in Email Service transport;
   accepted-speaker reminders already use it.
4. Add webhook delivery from the same outbox, with signed payloads, retries, and delivery history.
5. Add the optional Airtable batch mirror, inbound reconciliation queue, and actual cursor, last
   success, conflict, and error state in the integrations screen.
6. Add scheduled encrypted logical exports and test restore into a separate workspace key.

Do not call email, webhook, or Airtable APIs while a domain transaction is open. The state
transition and outbox intent commit together; external delivery is idempotent and retryable.

## Repository hosting and Forge

ProgramKit does not depend on a GitHub-specific runtime. Forge, GitHub, or another Git server can
host the repository because the deploy command uses the local checkout and Wrangler. CI examples
currently live under `.github`, but repository hosting is a contributor workflow choice, not a
product architecture boundary.

The small Forge bonus is not worth splitting issue history or making the quick start less familiar
before the product workflow is complete. A Forge mirror is reasonable later if it can run the same
`pnpm check` and preserve an obvious contribution path.

## Leaving Cloudflare

ProgramKit promises ownership of the data, not a maintained second deployment. `GET /api/v1/export`
returns a versioned logical workspace document without recent idempotency response caches. A
production installation must also export R2 objects and a manifest relating object keys to asset
records.

The domain operation engine and web-standard HTTP handler do not depend on React or MCP. That makes
a future host possible, but another deployment is accepted only when a maintainer is prepared to
implement and operate its transactional storage, files, jobs, mail, identity, tests, and docs—not
as a speculative adapter package.
