<!-- Canonical: https://programkit.dev/docs/developers/extending-programkit -->
<!-- Markdown: https://programkit.dev/docs/developers/extending-programkit.md -->

# Extending ProgramKit

ProgramKit is meant to be adapted. A safe extension preserves the product's operation and
projection boundaries even when the workflow, interface, brand, or provider changes.

## Start with the extension contract

Before editing code, write down:

1. the user and job being supported;
2. the records the user may read;
3. the actions the user may take;
4. the server-owned identity and scope that authorize each action;
5. the invariant that must remain true after failure or retry; and
6. the smallest end-to-end outcome that is useful.

If the extension cannot state these boundaries, it is not ready to become another module.

## Add a domain workflow

1. Add or extend records in `packages/core/src/types.ts`.
2. Define operation metadata, scopes, risk, reversibility, agent policy, and emitted events in
   `packages/core/src/manifest.ts`.
3. Implement validation and transition logic in core.
4. Add a minimized selector or projection for every new surface.
5. Add repository/serialization support without bypassing atomic mutation.
6. Test success, invalid state, denied scope, wrong owner/event, retry, stale version, and audit
   output.
7. Regenerate OpenAPI if the operation is API-key grantable.

Do not start with a button and later reverse-engineer the invariant into core.

## Add a web surface

1. Add the route module under `packages/web/src/routes`.
2. Reuse the existing shell, tokens, form controls, empty/loading/error states, and responsive
   patterns.
3. Fetch only the projection the surface needs.
4. Invoke named operations through the existing client behavior.
5. Provide stable deep links, keyboard operation, narrow-screen behavior, and visible mutation
   feedback.
6. Let the TanStack Router plugin regenerate `routeTree.gen.ts`.

For a participant, reviewer, speaker, or public route, define an explicit route-to-actor check and
operation allowlist in the host. Hiding organizer controls is not authorization.

## Add a read API

Prefer a conventional, event-scoped resource when external clients need a stable read model. Keep
the response smaller than the internal workspace and derive event scope from the credential.

For writes, use a named operation path so external clients receive the same validation,
idempotency, versioning, and audit behavior as the web app. Update the generated OpenAPI contract,
examples, and API guide together.

## Add an agent capability

An agent tool should represent a useful task, not expose the entire internal command catalog.

1. Decide whether the capability is read, draft, or proposal-only.
2. Add only the required scopes to the agent preset.
3. Minimize records and untrusted content in the result.
4. Keep approval, commit, send, publish, secret management, and destructive work human-only.
5. Add an operational skill only when procedural guidance materially improves safe use.
6. Update the plugin manifests or bundled assets, regenerate the embedded source, and validate the
   package.

Never treat a prompt or skill file as the authorization boundary.

## Add an external integration

Place provider credentials, SDKs, webhooks, and retry orchestration in the Cloudflare host or a
deliberately isolated adapter. The core package may own provider-neutral contracts and records.

Use this effect pattern:

```text
domain transaction commits intent
        │
        ▼
durable outbox / alarm / queue
        │
        ▼
provider call with idempotency and retry state
```

Do not hold a domain transaction open while calling email, webhooks, or optional mirrors. If an
inbound provider edit can violate domain rules, convert it into proposed named operations or a
reviewable change set.

## Change persistence

Another repository implementation must preserve:

- serialized and atomic mutation for one event;
- expected-version checks;
- idempotency response retention;
- revision and domain-event append;
- logical export;
- failure behavior around external effects; and
- ownership isolation.

ProgramKit does not advertise another host merely because core compiles there. A maintained host
must also implement identity, files, jobs, mail, routing, security, tests, deployment, and
operations.

## Add reporting

Start from a decision the organizer needs to make. Add a selector or rebuildable projection, define
freshness, and show the relevant empty/loading/error states. Cross-event analytics should consume
domain events into a rebuildable D1 projection when the current bounded fan-out no longer fits.

Do not make a reporting database another source of truth.

## Rebrand or specialize the starter

- Replace ProgramKit-owned logos, icons, screenshots, names, and domains with assets you have the
  right to use.
- Centralize new visual tokens rather than scattering product colors.
- Preserve visible focus, contrast, responsive layouts, and state behavior.
- Update plugin metadata, web manifest, email sender identity, legal pages, and documentation.
- Keep the Apache-2.0 license and required notices for upstream ProgramKit code.

Do not copy a competitor's proprietary assets or produce a pixel-for-pixel clone.

## Add a deployment profile

Use a profile only when it represents an operated environment with a clear routing and data
boundary. Keep migrations consistent across profiles and isolate runtime resources. A second Worker
application should not be added merely to separate the API or MCP endpoint; the supported
self-host intentionally keeps them on one origin.

## Extension definition of done

- user outcome and trust boundary are documented;
- core operation and projection rules are centralized;
- authorization is tested at the host boundary;
- retries, conflicts, and failure states are visible;
- API and agent surfaces remain least-privilege;
- accessibility and narrow-screen states are exercised;
- generated contracts are current; and
- `pnpm check` passes.
