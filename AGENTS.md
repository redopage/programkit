# ProgramKit agent guide

## Reading order

- Use [`docs/README.md`](docs/README.md) to find the canonical product, architecture, deployment,
  security, and operations source for the task.
- Read [`ROADMAP.md`](ROADMAP.md) before expanding product scope.
- Read [`docs/architecture/storage-and-integrations.md`](docs/architecture/storage-and-integrations.md)
  before changing Durable Object persistence, Airtable, D1, R2, mail, or background jobs.
- Read [`docs/product/interface-craft.md`](docs/product/interface-craft.md) before changing UI; it
  carries the four quality standards, the shared state primitives, and the review checklist.
- Use [`docs/agents/contribution-playbook.md`](docs/agents/contribution-playbook.md) for a vertical
  change across core, projections, web, hosts, tests, and docs.
- Do not create a parallel agent-only version of facts already documented canonically. Agent docs
  add routing and execution guardrails, then link to the source of truth.

## Repository map

- `apps/cloudflare` is the runnable host and the only supported deployment assembly.
- `packages/core` owns domain types, validation, authorization, operations, selectors, events, and
  repository contracts.
- `packages/web` owns React UI, TanStack Router routes, TanStack Query server state, portals, and
  public views.
- `packages/agent` owns the optional MCP surface and bundled operational skills.
- `tests` verifies domain, HTTP, and MCP behavior.
- Forge is the primary source host. GitHub is the synchronized mirror used by Cloudflare's deploy
  button.

## Invariants

- Every mutation from a human, REST client, or agent must use a named core operation.
- Host code supplies trusted actors and tenancy. Never trust public identity headers or a body
  `actor` field.
- Public agenda data comes from an immutable published schedule release, never the live draft.
- Cloudflare bindings and SDKs stay in `apps/cloudflare` or a deliberately isolated platform export.
- Preserve logical export, idempotency, expected-version checks, domain events, and atomic mutation
  semantics when changing Durable Object persistence.
- Do not edit `packages/web/src/routeTree.gen.ts`; the TanStack Router Vite plugin generates it from
  `packages/web/src/routes`.
- Existing uncommitted work belongs to the user. Do not discard unrelated changes.

## Commands

```bash
pnpm dev
pnpm test
pnpm lint
pnpm format:check
pnpm docs:check
pnpm build
pnpm check
```

`pnpm dev` runs the Cloudflare reference assembly on `http://localhost:4173`. `pnpm check` is the
required full verification before handoff. `pnpm docs:check` verifies documentation H1s, local
targets, and heading fragments during focused documentation work.

## Change placement

- Put state transitions and business rules in `packages/core` first.
- Put route modules in `packages/web/src/routes` and reusable screens/components beside the web
  package.
- Put Cloudflare Worker bindings, Durable Object composition, and Wrangler configuration in
  `apps/cloudflare`.
- Add focused tests for authorization, atomicity, idempotency, projections, and new state
  transitions.
