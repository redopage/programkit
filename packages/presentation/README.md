# `@crm-library/presentation`

The React presentation layer for the CRM Library reference application: a responsive operator
workspace, a scoped participant portal, and a public agenda.

The package renders core records but never writes persistence directly. Every mutation uses the
core operation API and then refreshes canonical state.

## Exports

- `App` — route-aware application UI
- `WorkspaceProvider` — fetch, mutation, loading, error, and toast state
- `useWorkspace` — access to the current canonical payload and operation helpers
- `@crm-library/presentation/styles.css` — compiled Tailwind and component styles

React and React DOM 19 are peer dependencies.

## Mounting

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { App, WorkspaceProvider } from '@crm-library/presentation'
import '@crm-library/presentation/styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>,
)
```

The host must provide same-origin Fetch API routes and SPA fallback. The UI expects:

- operator state at `GET /api/v1/state`;
- operator commands at `POST /api/v1/operations/{operationName}`;
- participant state and commands under `/api/v1/portal/{participationId}`;
- the browser application to be available at all UI routes.

When the browser path starts with `/portal/{participationId}`, the provider automatically uses the
participant endpoints. The API must authenticate that participant independently; the UI route is
not a security boundary.

## Included routes

- `/` — overview
- `/people` — relational people and participation records
- `/readiness` — requirement completion and blockers
- `/sessions` — program content
- `/schedule` — draft placements, conflict checks, and publication
- `/communications` — campaign drafting, approval, and demo send state
- `/changes` — proposed changes and human review
- `/integrations` — integration status and demo reset
- `/agent` — agent tasks and guardrails
- `/agenda` — public agenda from the latest immutable schedule release
- `/portal/{participationId}` — scoped participant profile and requirements

Dense data uses desktop tables and mobile relational lists rather than shrinking a spreadsheet.
Drawers provide focused editing, while keyboard focus management, focus restoration, progress
semantics, and mobile navigation are built into the shared components.

## Operation behavior

The presentation client removes any caller-provided `actor` before serializing a command and adds a
fresh idempotency key. Identity and scopes must come from the host. A successful command refreshes
the workspace; errors remain visible in the current view and in a toast.

Draft schedule edits do not alter `/agenda`. Only a successful publication operation creates the
immutable release read by the public view.

## Build

From the repository root:

```bash
pnpm --filter @crm-library/presentation build
```

The package emits React ESM, TypeScript declarations, source maps, and `styles.css` to `dist/`.
Published exports use `dist/`; the monorepo can select TypeScript source through the `development`
condition.
