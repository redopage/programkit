# Contributing

Thank you for helping make focused conference-program software easier to own and adapt. ProgramKit
welcomes bug fixes, tests, documentation, accessibility improvements, Cloudflare operations work,
and carefully scoped workflow additions.

## Before a large change

Open an issue that describes the user workflow, the invariant it introduces, and the smallest
complete outcome. Check [Product status and roadmap](ROADMAP.md) first: convergence on the six
golden-path workflows takes priority over adding another broad module.

The [documentation map](docs/README.md) routes product, architecture, deployment, and operations
questions. The [contribution playbook](docs/agents/contribution-playbook.md) traces a complete
vertical change without duplicating those sources of truth.

## Local setup

ProgramKit uses the Node.js version supported by the current pnpm release and records the exact
package manager in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

The reference app runs at `http://localhost:4173` with a local Worker and SQLite-backed Durable
Object. The seed is deterministic; resetting it never requires private fixture data.

## Where changes belong

- Put records, validation, state transitions, selectors, and authorization in `packages/core`.
- Put React surfaces, shared form/UI primitives, and typed routes in `packages/web`.
- Put MCP transport and procedural agent skills in `packages/agent`.
- Put Cloudflare bindings and runtime composition in `apps/cloudflare`.
- Keep agent tools task-shaped and narrower than the raw operation catalog.

Every mutation from a human, API client, automation, or agent must use a named core operation.
Every new non-operator surface must define a least-privilege projection, an operation allowlist,
and ownership tests. UI hiding is not an authorization boundary.

Route files live in `packages/web/src/routes`. Do not edit
`packages/web/src/routeTree.gen.ts`; the TanStack Router Vite plugin generates it.

## Tests and verification

Add focused tests for relevant behavior:

- valid and invalid transitions;
- actor scope and object ownership;
- projection data exposure;
- expected-version conflicts and idempotency;
- audit events and immutable publication;
- keyboard, narrow-screen, loading, empty and failure states for UI work.

Run the complete gate before opening a pull request:

```bash
pnpm check
```

This runs Vitest, oxlint, Prettier verification, package declarations, the Cloudflare production
build, and plugin validation. CI runs the same command.

## Pull-request checklist

- The change has one clear workflow outcome.
- Core invariants are not duplicated in web or agent code.
- Public/scoped projections expose only records the surface needs.
- New Cloudflare SDK code stays in the host or an explicit platform export.
- Documentation and the roadmap capability claim remain accurate.
- `pnpm check` passes from a clean install.

Do not commit real participant data, credentials, copied proprietary interfaces, or assets without
clear redistribution rights. Report security vulnerabilities through the process in
[Security](SECURITY.md), not a public issue.
