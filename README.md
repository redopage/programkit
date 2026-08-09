# ProgramKit

An open-source conference-program toolkit for calls for proposals, review, speaker readiness, and published agendas.

**Live demo:** [Create a private seven-day workspace](https://demo.programkit.dev)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit)

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

- `http://localhost:4173/demo` — create an isolated seven-day demo with a private capability link
- `http://localhost:4173/` — operator overview
- `http://localhost:4173/forms` — call-for-proposals form builder and preview
- `http://localhost:4173/submissions` — submission pipeline and decisions
- `http://localhost:4173/reviews` — committee progress and evaluation plan
- `http://localhost:4173/submit/aie-nyc-2026-cfp` — public call for proposals
- `http://localhost:4173/reviewer/rev_001` — one reviewer's focused scorecard workspace
- `http://localhost:4173/schedule` — draft schedule and publication workflow
- `http://localhost:4173/agenda` — public agenda backed only by the latest published release
- `http://localhost:4173/portal/par_003` — one participant's projected portal workspace

The local sample and hosted demo use path-derived actors so every workflow is easy to inspect. The
hosted app has real passwordless staff sessions and verified event selection, but participant,
reviewer, public-link, MCP, and file identity are not complete. Do not use any reference deployment
with real participant data yet; see [Security](SECURITY.md#deployment-security-boundaries).

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

The official hosted environments use the same repository and application assembly:

| Host                                                 | Purpose                                      | Data boundary                                                                  |
| ---------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------ |
| [`programkit.dev`](https://programkit.dev)           | Public project homepage                      | Separate site Worker, no workspace API                                         |
| [`demo.programkit.dev`](https://demo.programkit.dev) | Anonymous seven-day evaluation workspaces    | Separate Worker and Durable Object namespace, no outbound mail binding         |
| [`app.programkit.dev`](https://app.programkit.dev)   | Passwordless staff accounts and event stores | Separate Worker and Durable Object namespace, restricted outbound mail binding |

`app.programkit.dev` sends one-time magic links, stores only token and session hashes, and derives
one event Durable Object from verified account membership. It is not ready for real participant
data until team, participant, reviewer, public-link, MCP, and file authorization are complete.

The `apps/cloudflare` assembly uses one Worker, static assets, an account-sharded identity object
for hosted users, and one SQLite-backed Durable Object per event. The seeded demo needs no external
account. A production installation can add Airtable as an event's durable business-record source
of truth while keeping that event object as its fast coordination and cache layer.

The hosted demo creates one random Durable Object workspace per private capability link. The link
is exchanged for an HTTP-only seven-day cookie and the object deletes itself when it expires. For
local development and self-hosting, the Worker also maps a non-demo
`x-programkit-workspace-key` request header to a Durable Object name; a missing or invalid key uses
`demo`. Inside the object, every operation runs through an atomic repository
`mutate` call. The workspace JSON is chunked across Durable Object storage values, and schedule
publication creates an immutable release snapshot so later draft edits do not change the public
agenda.

The workspace header remains sample routing input, not tenant authentication. The hosted app does
not trust it. It derives both event and staff actor identity from a verified session and account
membership.

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

The official application Worker also has a restricted Cloudflare Email Service binding. The
delivery infrastructure and sending domain are configured, but `campaign.send` still writes only
to the demo outbox until the durable transactional delivery worker is implemented. See the
[email integration guide](docs/integrations/email.md).

## Data ownership

`WorkspaceRepository` keeps domain behavior separate from storage mechanics, and the full logical
export is available at `GET /api/v1/export`. Cloudflare is still the only supported deployment;
clean package boundaries and exportability are not a promise to maintain speculative host adapters.

Before real use, finish team and participant identity, OAuth for MCP, outbound product email and
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
- [Identity, events, and storage ownership](docs/architecture/identity-and-tenancy.md)
- [Deployment](DEPLOYMENT.md)
- [Security](SECURITY.md)
- [Operations](OPERATIONS.md)
- [Contributing](CONTRIBUTING.md)

Licensed under Apache-2.0.
