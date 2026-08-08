# CRM Library

An open-source foundation for focused, customer-owned operational CRMs.

CRM Library separates the operational truth, the human interface, and the agent interface so they
all use the same commands and invariants. Conference program operations is the included proving
application: it models people, event participation, readiness, communications, sessions,
scheduling, reviewable changes, and publication.

## Three packages

This repository contains exactly three publishable packages:

| Package                     | Responsibility                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `@crm-library/core`         | Records, operation manifest, authorization, invariants, audit events, selectors, repository contracts, and the Cloudflare Durable Object adapter |
| `@crm-library/presentation` | Responsive operator workspace, scoped participant portal, and public agenda                                                                      |
| `@crm-library/agent`        | Stateless MCP server surface and the Program Ops plugin and skills                                                                               |

The root application is a reference assembly of those packages, not a fourth package. Core domain
logic does not depend on React, MCP, or Cloudflare.

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
- `http://localhost:4173/schedule` — draft schedule and publication workflow
- `http://localhost:4173/agenda` — public agenda backed only by the latest published release
- `http://localhost:4173/portal/par_003` — one participant's projected portal workspace
- `http://localhost:4173/agent` — agent activity and review boundary

The operator and portal routes are passwordless demo conveniences. Do not use the reference Worker
with real participant data; see [Security](SECURITY.md#reference-worker-security-boundary).

## Build and verify

```bash
pnpm build:packages
pnpm check
```

`build:packages` emits ESM JavaScript and declarations into each package's `dist/` directory. The
presentation package also emits `dist/styles.css`. `pnpm check` runs tests, linting, formatting,
TypeScript and production builds, and plugin validation.

## Cloudflare reference deployment

```bash
pnpm deploy
```

The reference assembly uses one Worker, static assets, and one SQLite-backed Durable Object per
workspace key. No D1 database or R2 bucket is required for the seeded demo.

The Worker maps the `x-crm-workspace-key` request header to a Durable Object name; a missing or
invalid key uses `demo`. Inside the object, every operation runs through an atomic repository
`mutate` call. The workspace JSON is chunked across Durable Object storage values, and schedule
publication creates an immutable release snapshot so later draft edits do not change the public
agenda.

The workspace header is routing input, not tenant authentication. A production host must derive
both workspace and actor identity from a verified session or token instead of trusting a caller
header.

## Portable by design

`WorkspaceRepository` is the persistence boundary. Another host can provide a SQLite, Postgres, or
other implementation while retaining the same operations, expected-version checks, idempotency,
agent policy, and audit events. The full logical export is available at `GET /api/v1/export`.

Before real use, provide real staff and participant identity, OAuth for MCP, outbound email and
webhook delivery, private file storage, retention and backup policies, and rate limiting. The
complete checklist is in [SECURITY.md](SECURITY.md) and [OPERATIONS.md](OPERATIONS.md).

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
- [Operations](OPERATIONS.md)
- [Contributing](CONTRIBUTING.md)

Licensed under Apache-2.0.
