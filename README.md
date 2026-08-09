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
- `http://localhost:4173/resources` — operator library for speaker guides and static HTML cards
- `http://localhost:4173/embed/speakers` — embeddable public speaker gallery
- `http://localhost:4173/embed/itinerary` — embeddable, private-on-device itinerary builder
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

The `apps/cloudflare` assembly uses one Worker, static assets, one SQLite-backed Durable Object per
workspace key, and a private R2 binding for participant requirement files. Local development
emulates the bucket; before a remote deploy, create the checked-in `programkit-assets` bucket. No D1
database, queue, or email binding is required for the seeded demo. Campaign queueing and public
proposal submission create durable delivery records without pretending delivery occurred, and
accepted-speaker messages can include a downloadable RFC 5545 event invite. Activating outbound
delivery still requires a verified sender domain and a Cloudflare Email Service consumer.

The Worker maps the `x-programkit-workspace-key` request header to a Durable Object name; a missing or
invalid key uses `demo`. Inside the object, every operation runs through an atomic repository
`mutate` call. The workspace JSON is chunked across Durable Object storage values, and schedule
publication creates an immutable release snapshot so later draft edits do not change the public
agenda.

The workspace header is routing input, not tenant authentication. A production host must derive
both workspace and actor identity from a verified session or token instead of trusting a caller
header.

### D1 and Airtable

Durable Object SQLite remains the authoritative database because accepting proposals, onboarding
speakers, and publishing schedules are atomic event-workspace operations. D1 is reserved for a
later cross-workspace search or analytics projection; adding it now would duplicate the primary
database without improving the golden path.

Airtable is planned as an optional, asynchronously reconciled team workspace for submissions,
speakers, sessions, and tasks. Safe inbound edits become validated proposals; concurrent edits wait
for a human instead of using last-write-wins. Airtable never sits in the request path or silently
overwrites ProgramKit. See [Deployment](DEPLOYMENT.md#how-the-airtable-integration-works) and the
[Airtable guide](docs/integrations/airtable.md).

## Data ownership

`WorkspaceRepository` keeps domain behavior separate from storage mechanics, and the full logical
export is available at `GET /api/v1/export`. Cloudflare is still the only supported deployment;
clean package boundaries and exportability are not a promise to maintain speculative host adapters.

Before real use, provide real staff and participant identity, OAuth for MCP, outbound email and
webhook delivery, upload scanning, retention and backup policies, and rate limiting. The complete
checklist is in [Security](SECURITY.md) and [Operations](OPERATIONS.md).

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
