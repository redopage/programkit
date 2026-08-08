# Contribution playbook

Use this sequence for a complete ProgramKit workflow change. Small changes can skip layers they do
not affect, but they should not relocate responsibilities to avoid the proper layer.

## 1. State the outcome and trust boundary

Name the person, surface, record, and transition. Decide whether the request is operator-only,
public, reviewer-scoped, speaker-scoped, or agent-accessible. Check the
[roadmap](../../ROADMAP.md) before creating a new module or platform abstraction.

## 2. Model records and transitions in core

- Add or adjust records in `packages/core/src/types.ts`.
- Define the named operation and policy in `packages/core/src/manifest.ts`.
- Validate input and enforce invariants in `packages/core/src/engine.ts`.
- Emit domain events from the accepted transition.
- Add selectors when several consumers need the same derivation.

Never let a React event handler, Worker route, or agent prompt become the only implementation of a
business rule.

## 3. Expose the smallest projection

Update `packages/core/src/http.ts` or the relevant host boundary with only the records the surface
needs. Add an operation allowlist and ownership checks for every non-operator surface. Treat route
parameters and client-supplied identity as untrusted.

## 4. Connect the web workflow

- Put typed route modules in `packages/web/src/routes`; never edit `routeTree.gen.ts`.
- Put reusable interaction primitives in `packages/web/src/components`.
- Keep server state and mutation lifecycle in the client/workspace boundary.
- Give every action visible loading, error, success, and retry behavior.
- Preserve stable URLs for objects a human may share, revisit, or ask an agent to open.

Test keyboard use, focus management, empty and failure states, 320 px layout, content overflow, and
realistic record density. A desktop happy-path screenshot is not a completed surface.

## 5. Compose Cloudflare services in the host

Platform bindings, auth/session resolution, blob providers, mail providers, queues, and deployment
configuration belong in `apps/cloudflare`. Keep Cloudflare SDK imports out of generic domain
modules. Preserve atomic mutation, idempotency, expected versions, audit evidence, and logical
export. Do not extract a general adapter package from the one supported host.

## 6. Add the agent surface only when useful

Finish the human workflow before adding broad MCP coverage. Agent tools should be task-shaped,
schema-validated, least-privilege projections of core behavior. Prefer read, draft, and propose;
keep approval, commit, send, publish, secrets, and destructive work human-only.

## 7. Verify and document

Add focused tests for valid and invalid transitions, scopes and ownership, exposed data, stale
versions, idempotency, events, and publication immutability as relevant.

```bash
pnpm check
```

For UI work, also verify the affected routes in a browser at desktop and 320–390 px widths, including
keyboard focus and scrolling. Update the canonical source named in [the documentation map](../README.md)
and any task guide whose steps changed.
