<!-- Canonical: https://programkit.dev/docs/developers/repository-tour -->
<!-- Markdown: https://programkit.dev/docs/developers/repository-tour.md -->

# Repository tour

ProgramKit separates reusable product behavior from the supported Cloudflare host. The separation
is an ownership model, not a promise that every package is a standalone product.

## Request flow

```text
browser / REST client / MCP client
               │
               ▼
        Cloudflare Worker
  verifies credential and event scope
               │
        ┌──────┴────────┐
        │               │
        ▼               ▼
  read projection   named operation
        │               │
        └──────┬────────┘
               ▼
     event workspace repository
               │
               ▼
 SQLite-backed Durable Object
```

Files and delivery add host-coordinated effects around the operation commit. The browser never
receives a bucket or email-provider credential.

## `packages/core`

Core owns the product language and invariants:

- domain records in `src/types.ts`;
- operation metadata in `src/manifest.ts`;
- state transitions and authorization in `src/engine.ts`;
- read projections and reports in `src/selectors.ts` and focused modules;
- HTTP-neutral request handling in `src/http.ts`;
- repository interfaces and implementations;
- API key scope definitions;
- export, calendar, review, CRM, forms, and integration contracts.

Cloudflare SDK types do not belong in general core code. A deliberately isolated platform export
can describe a boundary, but the core operation engine must remain host-independent.

## `packages/web`

Web owns the human surfaces:

- route modules under `src/routes`;
- organizer and scoped views under `src/views`;
- shared UI and domain-specific components;
- TanStack Query server state and workspace context;
- responsive and accessible interaction states; and
- public form, reviewer, portal, and agenda projections.

Route modules should stay thin. Put reusable behavior beside the feature and put domain transitions
in core. The route tree is generated.

## `packages/agent`

Agent owns a stateless MCP adapter and portable client package:

- task-shaped tools and read-only resources;
- the Streamable HTTP request contract;
- Agent Plugin manifests and Codex metadata;
- operational skills and references; and
- the bundle generator that writes an installation-specific MCP URL.

The MCP handler receives `readState` and `execute` functions. The Cloudflare Worker supplies them
after authentication. Agent skills guide behavior, but server scopes and operation policy remain
the security boundary.

## `apps/cloudflare`

The Cloudflare app is the only maintained deployment assembly. It owns:

- Worker routing and security headers;
- account, event access, and workspace Durable Objects;
- credential-to-event resolution;
- R2 upload, download, ZIP, and cleanup orchestration;
- email binding and outbox delivery;
- optional Airtable OAuth and webhook composition;
- static asset serving; and
- the official and self-host deployment profiles.

The app imports all three packages and adapts them to Cloudflare services.

## `tests`

Tests are organized around behavior, not package pride. Important changes normally need coverage
for:

- allowed and denied transitions;
- role, event, and object ownership;
- projection minimization;
- idempotency and expected-version conflicts;
- audit events and immutable publication;
- host routing and same-origin behavior;
- file lifecycle and external-effect recovery;
- API and MCP contracts; and
- generated artifact drift.

## `docs`

Audience guides route into canonical product, architecture, deployment, security, and operations
sources. When a behavior changes, update the canonical source and every affected entry point; do
not add a conflicting developer-only explanation.

## Data ownership summary

| Data                                                      | Authoritative owner                                  |
| --------------------------------------------------------- | ---------------------------------------------------- |
| Event program, revisions, and audit state                 | Event Workspace Durable Object                       |
| Staff identity and sessions                               | Account Auth Durable Objects                         |
| Event roles, invitations, participant directory, API keys | Event Access Durable Object                          |
| File bytes                                                | R2                                                   |
| File metadata and tombstones                              | Event workspace                                      |
| Published public program                                  | Immutable release inside event workspace             |
| Optional Airtable business records                        | Experimental acknowledged integration when connected |

Read [Storage and integrations](/docs/architecture/storage-and-integrations.md) before changing this
map.
