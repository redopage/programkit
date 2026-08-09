# ProgramKit

An open-source conference-program toolkit for calls for proposals, review, speaker readiness, and published agendas.

**Live demo:** [programkit.dev](https://programkit.dev)

ProgramKit separates the operational truth, the human interface, and the agent interface so they
all use the same commands and invariants. Conference program operations is the included proving
application: it models people, event participation, readiness, communications, sessions,
scheduling, reviewable changes, and publication.

## Three packages

This repository contains exactly three publishable packages:

| Package             | Responsibility                                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@programkit/core`  | Records, operation manifest, authorization, invariants, audit events, selectors, repository contracts, and the current Durable Object adapter           |
| `@programkit/web`   | Responsive React application with typed TanStack routes, an injectable client, and explicit operator, submitter, reviewer, speaker, and public surfaces |
| `@programkit/agent` | Stateless MCP server surface and the ProgramKit plugin and skills                                                                                       |

`apps/cloudflare` is the private reference assembly of those packages, not a fourth publishable
layer. It is the supported deployment: one Cloudflare Worker composes the web app, API, Durable
Object persistence, and optional agent surface.

## Quick start

The repository uses Node.js and pnpm.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. The Cloudflare Vite runtime starts the React application, Worker, and
a local SQLite-backed Durable Object together. The deterministic AIE NYC workspace is seeded on
first access.

Useful demo routes include:

- `http://localhost:4173/` — operator overview
- `http://localhost:4173/forms` — call-for-proposals form builder and preview
- `http://localhost:4173/submissions` — submission pipeline and decisions
- `http://localhost:4173/reviews` — committee progress and evaluation plan
- `http://localhost:4173/submit/aie-nyc-2026-cfp` — public call for proposals
- `http://localhost:4173/reviewer/rev_001` — one reviewer's focused scorecard workspace
- `http://localhost:4173/schedule` — draft schedule and publication workflow
- `http://localhost:4173/agenda` — public agenda backed only by the latest published release
- `http://localhost:4173/portal/par_003` — one participant's projected portal workspace

Every identity in the reference Worker is a passwordless demo convenience. Its separate surface
projections and operation allowlists are real server boundaries, but its path-derived actors are
not authentication. Do not use it with real participant data; see
[Security](SECURITY.md#reference-worker-security-boundary).

## Build and verify

```bash
pnpm build:packages
pnpm check
```

`build:packages` emits ESM JavaScript and declarations into each package's `dist/` directory. The
web package also emits `dist/styles.css`. The complete build then creates the private
`apps/cloudflare` Worker and client bundles. `pnpm check` runs tests, linting, formatting,
TypeScript, production builds, and plugin validation.

## Cloudflare deployment

```bash
pnpm deploy
```

The `apps/cloudflare` assembly uses one Worker, static assets, and one SQLite-backed Durable Object
per workspace key. The seeded demo needs no external account. A production installation can add
Airtable as durable source of truth while keeping the Durable Object as its fast coordination and
cache layer.

The Worker maps the `x-programkit-workspace-key` request header to a Durable Object name; a missing or
invalid key uses `demo`. Inside the object, every operation runs through an atomic repository
`mutate` call. The workspace JSON is chunked across Durable Object storage values, and schedule
publication creates an immutable release snapshot so later draft edits do not change the public
agenda.

The workspace header is routing input, not tenant authentication. A production host must derive
both workspace and actor identity from a verified session or token instead of trusting a caller
header.

### Airtable and D1

ProgramKit now includes a versioned Airtable schema and persistence adapter. With Airtable
credentials configured, Airtable holds the reconstructable workspace and native event, people,
participation, submission, task, review, session, placement, track, and room records. The Durable
Object serializes mutations, keeps the hot cache, and makes normal page loads without Airtable API
calls. App writes reach Airtable before the new cache revision is acknowledged.

Without Airtable credentials, the Durable Object remains a complete zero-configuration local and
demo store. D1 is reserved for later cross-workspace search or analytics rather than duplicating
the single-workspace write model. See [Deployment](DEPLOYMENT.md#how-the-airtable-integration-works)
and the [Airtable guide](docs/integrations/airtable.md) for setup, measured request use, current
limits, and the webhook path.

## Data ownership

`WorkspaceRepository` keeps domain behavior separate from storage mechanics, and the full logical
export is available at `GET /api/v1/export`. Cloudflare is still the only supported deployment;
clean package boundaries and exportability are not a promise to maintain speculative host adapters.

Before real use, provide real staff and participant identity, OAuth for MCP, outbound email and
webhook delivery, private file storage, retention and backup policies, and rate limiting. The
complete checklist is in [SECURITY.md](SECURITY.md) and [OPERATIONS.md](OPERATIONS.md).

## Documentation

- [Documentation map](docs/README.md) — choose a product, operator, contributor, or agent path
- [Program lifecycle](docs/product/program-lifecycle.md) — the end-to-end conference workflow
- [Build and publish a CFP](docs/guides/build-and-publish-a-cfp.md) — first product task
- [Product evidence showcase](showcase/index.html) — screenshot comparison with the supplied brief
- [HTTP API](docs/api/README.md) — event resources, named writes, and integration conventions
- [Agent navigation](docs/agents/README.md) — help a human from the same canonical sources
- [Product status and roadmap](ROADMAP.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [Security](SECURITY.md)
- [Operations](OPERATIONS.md)
- [Contributing](CONTRIBUTING.md)

Licensed under Apache-2.0.
