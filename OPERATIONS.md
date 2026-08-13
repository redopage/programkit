# Operations

For the self-hoster's routine checklist, start with
[Administer a self-hosted installation](docs/self-hosting/administration.md). This document is the
canonical command and recovery-boundary reference.

## Prerequisites

- Node.js with Corepack available
- pnpm `11.20.0` (declared in `package.json`)
- A Cloudflare account and Wrangler login only when deploying

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. The Cloudflare Vite plugin runs the React application, Worker, and a
local SQLite-backed Durable Object in one process. The first access seeds the deterministic AIE NYC
workspace.

### Demo routes

- `/demo` — create an isolated workspace locally or on a self-hosted installation
- `/` — operator overview
- `/people`, `/readiness`, `/sessions`, `/schedule`, `/communications`, `/changes` — operator work
- `/integrations` — integration state and demo reset
- `/agent` — agent work and human review boundary
- `/agenda` — public agenda using the latest immutable published release
- `/portal/par_003` — example participant portal using a server-side data projection

The private `/demo/{capability}` link grants edit access to its workspace. The demo operator has no
login, and the participant ID in the portal URL acts as identity in this sample surface. Use sample
data only. Copy or delete the workspace from the sidebar or banner. Expiry and early deletion remove local state
and authorization but never delete records in a connected Airtable base.

On the official hosted demo, `https://demo.programkit.dev/` is the creation screen. `/demo`
redirects to `/` there so the hostname and path do not repeat the same idea. Private collaboration
links still use `/demo/{capability}` because that segment identifies a capability exchange, not a
normal application page.

### Experimental Airtable-backed mode

The local demo and recommended V1 deployment use the event Durable Object as the complete store.
To test the optional Airtable integration, register a development OAuth integration with the
localhost callback, copy the example, add its client ID, and start ProgramKit:

```bash
cp apps/cloudflare/.dev.vars.example .dev.vars
# Add AIRTABLE_OAUTH_CLIENT_ID and the optional client secret.
pnpm dev
```

Open `/integrations`, connect Airtable, grant a base, and let ProgramKit initialize or import it.

The operator-token fallback remains useful for scripts and integration tests:

```bash
# Add AIRTABLE_TOKEN and AIRTABLE_BASE_ID to .dev.vars.
pnpm airtable:setup
pnpm airtable:seed
pnpm airtable:verify
```

`airtable:verify` reconstructs the complete workspace from the base and reports collection counts.
The detailed scopes, tables, request budget, failure modes, and webhook boundary are in the
[Airtable integration guide](docs/integrations/airtable.md).

### HTTP endpoints

- `GET /api/health` or `GET /healthz` — public process health for uptime monitors
- `GET /api/v1/health`
- `GET /api/v1/state`
- `GET /api/v1/manifest`
- `POST /api/v1/operations/{operationName}`
- `GET /api/v1/events`
- `GET /api/v1/events/{eventId}/sessions`
- `GET /api/v1/events/{eventId}/speakers`
- `GET /api/v1/events/{eventId}/submissions`
- `GET /api/v1/portal/{participationId}/state`
- `POST /api/v1/portal/{participationId}/operations/{operationName}`
- `GET /api/v1/domain-events?limit=50`
- `GET /api/v1/export`
- `GET /api/v1/recovery` — hosted event owners only; inspect the workspace object's current PITR bookmark
- `POST /api/v1/recovery/bookmark` — hosted event owners only; resolve an approximate bookmark for a time in the previous 30 days
- `GET /public/agenda.json`
- `POST /mcp`

The operation body has the shape:

```json
{
  "input": {},
  "mode": "execute",
  "idempotencyKey": "one-key-per-logical-command",
  "expectedVersions": {}
}
```

The host supplies the actor. An `actor` in this public JSON is ignored by the HTTP layer.

### File deletion recovery

Files exposes permanent deletion to the authenticated event owner. The request first commits a
metadata tombstone, which makes the version unavailable, and then removes the event-rooted R2
object. A successful object delete is recorded by an internal system operation. If R2 fails after
the tombstone commits, the Files page shows **Storage cleanup pending** and an owner can retry; do
not restore access to the file merely because cleanup is delayed. A key outside the active event
prefix is intentionally refused and requires an operator-led reconciliation.

This path does not implement malware scanning or automatic retention. MIME and size validation are
only upload constraints. Production operators still need a scanner/quarantine provider, orphan
cleanup, legal-hold rules, an offboarding policy, and R2 usage alerts.

`/api/health` and `/healthz` deliberately return only service readiness and require no account or
event. `/api/v1/health` is the authenticated workspace check; it includes that workspace's schema
version and revision and should not be used as the public uptime target.

The Worker also serves `robots.txt` with app-wide crawler exclusion and
`/.well-known/security.txt` with the repository's reporting contact. Unknown `.well-known` files
return a plain 404 instead of the SPA shell.

### Workspace routing

The reference Worker selects non-capability development workspaces with
`x-programkit-workspace-key`:

```bash
curl http://localhost:4173/api/v1/health \
  -H 'x-programkit-workspace-key: demo'
```

Valid keys contain lowercase letters, numbers, underscores, or hyphens, begin with a letter or
number, and are at most 64 characters. Missing or invalid keys use `demo`.

This header creates or selects isolated Durable Object state, but it does not authenticate the
caller. It cannot select a hosted capability demo. Production routing must derive the workspace
from verified membership instead.

### Reset the demo

Use **Reset demo workspace** under `/integrations`, or run:

```bash
curl -X POST http://localhost:4173/api/v1/operations/workspace.reset-demo \
  -H 'content-type: application/json' \
  -d '{"input":{}}'
```

Reset replaces the selected workspace with the deterministic seed while advancing its revision.
Do not expose this administrative operation through a production wildcard actor.

## Build and verification

Build only the three publishable packages:

```bash
pnpm build:packages
```

This emits ESM JavaScript and TypeScript declarations into each `packages/*/dist` directory, plus
`packages/web/dist/styles.css`.

Run individual or complete checks:

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
pnpm plugin:validate
pnpm check
```

`pnpm build` builds the packages, runs the root TypeScript check, and creates the production
Vite/Worker bundle. `pnpm check` runs the full sequence: domain and MCP tests, lint, formatting,
production build, and plugin validation.

## Cloudflare deployment

Authenticate Wrangler, review the account and Worker name in `wrangler.jsonc`, then
run:

```bash
pnpm deploy
```

The ProgramKit-owned hosted environments use named profiles:

```bash
pnpm deploy:site
pnpm deploy:demo
pnpm deploy:app
```

`programkit.dev`, `demo.programkit.dev`, and `app.programkit.dev` are separate Workers. The public
site exposes no workspace API. The demo has its own event-object namespace and no outbound email.
The app has account and event-object namespaces plus a sender-restricted Cloudflare Email Service
binding. It verifies staff and participant sessions, live event membership, record-scoped
reviewer/speaker capabilities, event-scoped API keys, and private file access. Review the remaining
account recovery, invitation lifecycle, file scanning/retention, backup, and monitoring requirements
in `SECURITY.md` before using sensitive participant data.

The configuration declares:

- the `apps/cloudflare/src/worker.ts` entry point;
- static assets with SPA fallback and Worker-first routing;
- the `PROGRAMKIT_WORKSPACES` Durable Object binding;
- the `PROGRAMKIT_AUTH` account Durable Object binding for hosted-app profiles;
- the `PROGRAMKIT_EVENT_ACCESS` membership, participant directory, and API-key Durable Object
  binding for hosted-app profiles;
- the `PROGRAMKIT_FILES` private R2 binding for hosted and self-hosted uploads;
- SQLite Durable Object migrations;
- Worker observability.

The seeded demonstration needs neither a D1 database ID nor an R2 bucket. Add a custom domain with
a `routes` entry in `wrangler.jsonc` or the Cloudflare dashboard.

After deployment, verify at least:

```bash
curl https://YOUR_HOST/api/health
curl --head https://YOUR_HOST/agent-plugin.zip
```

Then use an authenticated browser or event-scoped API key to check `/api/v1/health`. Open the
operator, public agenda, and scoped portal routes. Confirm a draft schedule change does not affect
the agenda until publication creates a new release.

## Production enablement

The hosted app verifies staff sessions, participant sessions, event membership, record capabilities,
and event-scoped API keys. Before pointing sensitive real data at it:

- add account recovery, ownership transfer, and deployment-appropriate MFA or external OIDC;
- complete short-lived reviewer and speaker invitation exchange, rotation, and revocation;
- add delegated OAuth before offering third-party MCP installation across many customer accounts;
- add signed outbound webhooks with durable retry, replay protection, and delivery history;
- complete email provider idempotency, bounce/complaint ingestion, recipient unsubscribe, and
  dead-letter operations around the existing transactional outbox;
- add malware scanning/quarantine, orphan cleanup, automatic retention and offboarding, storage
  observability, and any deployment-specific signed-download policy around the existing private R2
  upload, mediated download, and explicit owner-deletion path;
- configure rate limits, alerts, structured logs, and incident procedures;
- establish retention, deletion, legal-hold, backup, and restore policies;
- complete every item in `SECURITY.md`.

The anonymous demo still records inspectable delivery state without an outbound binding. The
official app and a configured self-host use the durable outbox and provider binding. The Airtable
persistence adapter is real but remains experimental until it has durable partial-write recovery,
narrow webhook cursors, and human-visible conflict review.

### Email operations

The official app Worker may send only from `notifications@mail.programkit.dev`. Its sending domain
has Cloudflare-managed bounce, SPF, DKIM, and DMARC records. `support@programkit.dev` is an inbound
Email Routing address and is not the automated sender.

One direct delivery smoke test should be run after changing the domain, binding, or DNS. Do not
send from the public demo Worker. ProgramKit already stores durable outbox records, retry attempts,
provider IDs, suppression, and operator-visible failures; the deployment operator must verify that
path and complete the remaining provider controls listed above. Full setup and self-hosting guidance is in
[Cloudflare email](docs/integrations/email.md).

## Backup, restore, and departure

`GET /api/v1/export` returns the selected workspace with an explicit schema version. Recent
idempotency response caches are omitted. An Airtable-enabled installation can also run
`pnpm airtable:verify` to prove source reconstruction. A production system should schedule
encrypted logical exports outside both Airtable and the cache, record their workspace and schema
version, and test restoration into a separate environment.

The logical export includes file metadata and retained deletion tombstones, not R2 bytes. A
production backup or departure package must export active R2 objects with a manifest relating each
object key to its asset record. A purged object cannot be reconstructed from the logical export or
workspace PITR. D1 and Airtable projections are rebuildable and are not backup sources.

### SQLite Durable Object recovery

The official hosted app uses Cloudflare's 30-day point-in-time recovery history for each SQLite
Durable Object. A signed-in event owner can inspect the active event workspace without changing it:

```bash
curl https://app.programkit.dev/api/v1/recovery \
  --cookie 'programkit_session=...'

curl https://app.programkit.dev/api/v1/recovery/bookmark \
  --request POST \
  --header 'content-type: application/json' \
  --header 'origin: https://app.programkit.dev' \
  --cookie 'programkit_session=...' \
  --data '{"timestamp":"2026-08-12T12:00:00.000Z"}'
```

The second endpoint calls `getBookmarkForTime` and returns Cloudflare's approximate bookmark. Both
endpoints are owner-only, reject API keys, and use `Cache-Control: no-store`. ProgramKit does not
expose a restore endpoint: a restore is an incident operation and needs an export, an explicit
target bookmark, confirmation, an operator audit record, and post-restore validation first.

PITR is not a full-event reset. One restore affects only the event workspace Durable Object. Staff
identity, event-access records, R2 file bytes, and external systems have separate owners and must be
reconciled independently. PITR is unavailable in local development. For evaluator reruns, create a
fresh event or hosted demo rather than restoring or deleting a live event.
