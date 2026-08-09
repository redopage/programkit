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
  ├── Airtable                 ── durable workspace records (recommended production)
  ├── workspace Durable Object ── serialized mutations, hot cache, live clients
  ├── R2                      ── private uploads and generated files (next)
  ├── Queue / object alarm    ── email, webhooks, and mirrors (next)
  └── Email Service           ── confirmations and reminders (next)
```

The runnable application currently includes the Worker, static assets, and one SQLite-backed
Durable Object per workspace key. It needs no D1 database, R2 bucket, queue, or email binding to run
the deterministic demo.

The production additions are intentionally Cloudflare-native:

| Concern                   | Default                                              | Why                                                                                    |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Web and API               | Worker + Static Assets                               | One origin, one deploy, no client-side API configuration                               |
| Durable business records  | Airtable                                             | Familiar source of truth the program team can inspect and work with                    |
| Coordination and cache    | SQLite-backed Durable Object                         | Serialized workspace writes and fast reads with zero Airtable calls on page load       |
| Files                     | R2                                                   | Direct uploads, private objects, lifecycle policies, and no file bytes in domain state |
| Background delivery       | Transactional outbox + Queue or Durable Object alarm | Retryable work that does not hold open a user request                                  |
| Email                     | Cloudflare Email Service binding                     | Native Worker delivery; Resend may remain an optional provider                         |
| Cross-workspace analytics | D1 projection, only when needed                      | SQL reporting across many workspace objects                                            |

## Why Durable Objects remain in the write path

ProgramKit's important writes span several records: accept a proposal and create its speaker,
participation, requirements, and session; publish one immutable schedule release; approve and
commit a group of changes. Airtable is excellent durable, inspectable storage but does not provide
one atomic multi-table application transaction. A SQLite-backed Durable Object gives each
workspace the missing serialized coordination boundary.

When Airtable is configured, the object stores a durable hot cache and hydration marker. It
validates one operation at a time, computes a record delta, sends idempotent Airtable upserts, and
updates the cache only after every required Airtable write succeeds. Reads then stay inside the
object. Without Airtable configuration, the same chunked JSON cache is the complete local demo
store.

### Where D1 fits

D1 is not a source of truth. It becomes useful when ProgramKit needs queries that cross
many workspace objects, such as an organization-wide event index, global search, analytics, or an
administrative control plane.

That future D1 database should be a rebuildable read projection. It may lag briefly and must never
decide whether a domain transition is valid.

## How the Airtable integration works

Airtable is ProgramKit's recommended production source of truth because program and review teams
already know how to filter, group, comment on, and edit a base. It is not queried on every page
load. The Durable Object cache isolates the application from routine API latency and quota use.

```text
named operation
      │
      ▼
Durable Object serializer and current cache
      │
      ├── validate operation and compute record delta
      ├── batch upsert changed Airtable records
      ├── update cache after Airtable acknowledgement
      └── return success

direct Airtable edit ── verified webhook ── cache refresh
```

The version 1 schema has one `ProgramKit State` record and ten native tables for events, people,
participations, submissions, tasks, reviews, sessions, placements, tracks, and rooms. Stable IDs,
deterministic sort values, native columns, and lossless JSON make the full workspace reconstructable
without relying on Durable Object storage.

The checked-in adapter creates and validates that schema, batch-upserts by stable ID, removes stale
managed rows, writes record-level deltas, restores the complete state, and verifies Airtable webhook
HMACs. The current seed uses 171 records. Measured steady-state costs are zero Airtable requests per
page load, two requests for a simple one-record mutation, and eleven requests for an explicit full
restore.

The inbound webhook currently performs a full refresh and is intentionally marked experimental.
Production work still needs payload cursors, narrow record fetches, durable partial-write retries,
and conversion of direct edits through named operations or reviewable change sets. See the
[Airtable integration guide](docs/integrations/airtable.md) for setup and the exact current boundary.

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

Authenticate Wrangler, review `apps/cloudflare/wrangler.jsonc`, then run:

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
```

Then open the operator app, public CFP, reviewer workspace, speaker portal, and public program.

## Production bindings, in order

The golden-path production work should land in this sequence:

1. Replace the demo workspace header and fixed actors with verified sessions, API tokens, and
   workspace membership.
2. Add R2 upload initiation, direct upload, finalize/scanning, private download, and lifecycle
   cleanup.
3. Add a transactional delivery outbox and Cloudflare Email Service for submission confirmations
   and accepted-speaker reminders.
4. Add webhook delivery from the same outbox, with signed payloads, retries, and delivery history.
5. Finish Airtable webhook payload cursors, durable partial-write retry, inbound change sets, and
   actual last-success, quota, lag, conflict, and error state in the integrations screen.
6. Add scheduled encrypted logical exports and test restore into a separate workspace key.

Do not call email or delivery webhooks while a domain transaction is open. Airtable persistence is
the exception because its acknowledgement defines whether a source-of-truth write succeeded. Its
record upserts are idempotent, the local cache advances only after acknowledgement, and the next
production step is a durable retry journal for partial multi-table failures.

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
