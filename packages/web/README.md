# `@programkit/web`

The React web layer for ProgramKit: a responsive operator workspace plus deliberately scoped
submitter, reviewer, speaker, and public-program surfaces.

The package renders core records but never writes persistence directly. TanStack Router provides
typed file-based routes and route-level code splitting. TanStack Query owns canonical request,
retry, refresh, and mutation lifecycle state. Every mutation uses the core operation API and then
invalidates the active workspace projection.

## Exports

- `ProgramKitApp` (`App` is an alias) — isolated application providers and typed router
- `createProgramKitHttpClient` — the default same-origin HTTP implementation
- `ProgramKitClient` — the small host-injection boundary for reads and operations
- `ProgramKitSurface` — the operator, submission, reviewer, speaker, and public-program union
- `surfaceFromPathname` and `surfaceKey` — canonical surface routing helpers
- `WorkspaceProvider` — fetch, mutation, loading, error, and toast state
- `useWorkspace` — access to the current canonical payload and operation helpers
- `@programkit/web/styles.css` — compiled Tailwind and component styles

React and React DOM 19 are peer dependencies.

## Mounting

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { createProgramKitHttpClient, ProgramKitApp } from '@programkit/web'
import '@programkit/web/styles.css'

const client = createProgramKitHttpClient({
  // Optional. Relative same-origin requests are the default.
  baseUrl: 'https://program.example.com',
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ProgramKitApp client={client} />
  </React.StrictMode>,
)
```

Each mounted app owns its own query client and router. A host can instead inject a custom
`ProgramKitClient` to add an SDK transport, authentication refresh, observability, or an embedded
test implementation without teaching React components about a deployment platform.

The default HTTP client expects these routes:

- operator: `/api/v1/state` and `/api/v1/operations/{operationName}`;
- public CFP: `/public/v1/submission-forms/{formSlug}/state` and its restricted operations;
- reviewer: `/api/v1/reviewers/{reviewerId}/state` and its restricted operations;
- speaker: `/api/v1/portal/{participationId}/state` and its restricted operations;
- public program: `/public/v1/program/state` (read-only).

The route is mapped to one `ProgramKitSurface` before any state is fetched. The HTTP client also
rejects operations that do not belong to that surface. The server must still authenticate every
identity and enforce the same boundary independently; a UI route and a client-side allowlist are
not authorization.

## Included routes

- `/` — overview
- `/forms` — call-for-proposals form builder, explicit speaker/session data mappings, publish
  readiness, and draft preview
- `/submissions` — proposal pipeline, review context, and decisions
- `/reviews` — committee progress, multi-round advancement, and evaluation-plan overview
- `/people` — relational people and participation records
- `/readiness` — requirement completion and blockers
- `/sessions` — program content
- `/schedule` — draft placements, conflict checks, and publication
- `/communications` — campaign drafting, approval, and demo send state
- `/changes` — proposed changes and human review
- `/integrations` — integration status and demo reset
- `/agent` — agent tasks and guardrails
- `/agenda` — public agenda from the latest immutable schedule release
- `/resources` — operator management for versioned speaker guides and static HTML cards
- `/embed/speakers` — read-only public speaker gallery
- `/embed/itinerary` — read-only public schedule with device-local saved sessions
- `/submit/{formSlug}` — public submission form
- `/reviewer/{reviewerId}` — scoped reviewer scorecard workspace
- `/portal/{participationId}` — scoped participant profile and requirements

Dense data uses desktop tables and mobile relational lists rather than shrinking a spreadsheet.
Drawers provide focused editing, while keyboard focus management, focus restoration, progress
semantics, and mobile navigation are built into the shared components. The operator command center
opens with `/` or the platform-appropriate `Command-K`/`Control-K`; its intentionally small shortcut
guide opens with `?`. Printable shortcuts are ignored while the user is typing in a form field.
Contenteditable and ARIA textbox editors are covered automatically; custom editor wrappers can use
`data-shortcuts-disabled`.

## Operation behavior

The web client removes any caller-provided `actor` before serializing a command and adds a
fresh idempotency key. Identity and scopes must come from the host. A successful command refreshes
the workspace; errors remain visible in the current view and in a toast.

Draft schedule edits do not alter `/agenda`. Only a successful publication operation creates the
immutable release read by the public view.

## Build

From the repository root:

```bash
pnpm --filter @programkit/web build
```

The package emits React ESM, TypeScript declarations, source maps, and `styles.css` to `dist/`.
Published exports use `dist/`; the Cloudflare application selects TypeScript source so the
TanStack Router Vite plugin can generate and split route modules during the application build.
