# Operations

## Prerequisites

- Node.js with Corepack available
- pnpm `10.33.0` (declared in `package.json`)
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

- `/` — operator overview
- `/people`, `/readiness`, `/sessions`, `/schedule`, `/communications`, `/changes` — operator work
- `/integrations` — integration state and demo reset
- `/agent` — agent work and human review boundary
- `/agenda` — public agenda using the latest immutable published release
- `/portal/par_003` — example participant portal using a server-side data projection

The operator has no login, and the participant ID in the portal URL acts as identity in this demo.
Use sample data only.

### HTTP endpoints

- `GET /api/v1/health`
- `GET /api/v1/state`
- `GET /api/v1/manifest`
- `POST /api/v1/operations/{operationName}`
- `GET /api/v1/portal/{participationId}/state`
- `POST /api/v1/portal/{participationId}/operations/{operationName}`
- `GET /api/v1/events?limit=50`
- `GET /api/v1/export`
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

### Workspace routing

The reference Worker selects the Durable Object with `x-crm-workspace-key`:

```bash
curl http://localhost:4173/api/v1/health \
  -H 'x-crm-workspace-key: demo'
```

Valid keys contain lowercase letters, numbers, underscores, or hyphens, begin with a letter or
number, and are at most 64 characters. Missing or invalid keys use `demo`.

This header creates or selects isolated Durable Object state, but it does not authenticate the
caller. Production routing must derive the workspace from verified membership instead.

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
`packages/presentation/dist/styles.css`.

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

Authenticate Wrangler, review the account and Worker name in `wrangler.jsonc`, then run:

```bash
pnpm deploy
```

The configuration declares:

- the `worker.ts` entry point;
- static assets with SPA fallback and Worker-first routing;
- the `CRM_WORKSPACES` Durable Object binding;
- the SQLite Durable Object migration;
- Worker observability.

The seeded demonstration needs neither a D1 database ID nor an R2 bucket. Add a custom domain with
a `routes` entry in `wrangler.jsonc` or the Cloudflare dashboard.

After deployment, verify at least:

```bash
curl https://YOUR_HOST/api/v1/health
curl https://YOUR_HOST/public/agenda.json
```

Then open the operator, public agenda, and scoped portal routes. Confirm a draft schedule change
does not affect the agenda until publication creates a new release.

## Production enablement

The reference deployment is passwordless and uses a fixed staff actor with wildcard scope. Before
pointing a real domain or real data at it:

- replace demo actor and workspace routing with verified staff and participant identity;
- add OAuth and workspace-scoped authorization to `/mcp`;
- add real outbound email and webhook adapters through a transactional outbox;
- add private object storage, scanning, signed downloads, and lifecycle policies;
- remove wildcard scopes and restrict administrative operations;
- configure rate limits, alerts, structured logs, and incident procedures;
- establish retention, deletion, legal-hold, backup, and restore policies;
- complete every item in `SECURITY.md`.

`campaign.send` currently records a demo outbox event and marks the campaign sent; no external
email is delivered. Integration rows are demonstrative status records, not provider connections.

## Backup, restore, and departure

`GET /api/v1/export` returns the selected workspace with an explicit schema version. Recent
idempotency response caches are omitted. A production system should schedule encrypted exports
outside the primary Durable Object, record their workspace and schema version, and test restoration
into a separate environment.

A non-Cloudflare adapter should preserve the repository's atomic `mutate` contract and migrate
older schema versions explicitly. File objects are not part of this demo; a future storage adapter
must export and restore them alongside their logical record IDs.
