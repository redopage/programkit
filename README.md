# ProgramKit

Open-source conference program management, from the first call for proposals to the published
agenda.

[Website](https://programkit.dev) · [Try a seven-day demo](https://demo.programkit.dev) ·
[Forge](https://forge.smol.ai/andheller/programkit) ·
[GitHub mirror](https://github.com/redopage/programkit) · [Documentation](docs/README.md)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit)

ProgramKit gives organizers one focused workspace to:

- publish conditional call-for-speakers forms;
- collect and evaluate proposals;
- move accepted speakers through bios, headshots, slides, and other requirements;
- build a conflict-aware schedule;
- send confirmations and reminders;
- publish a fast, embeddable public agenda.

It is intentionally smaller than a general CRM or an enterprise event suite. The goal is to make
the conference-program job fast, understandable, and easy to own.

> **Project status:** active alpha. The seeded demo is safe to explore, but the hosted app is not
> ready for real participant data until participant and reviewer identity, private file storage,
> production mail delivery, rate limiting, and backup policy are complete. See
> [Security](SECURITY.md) and the [roadmap](ROADMAP.md).

## Run it locally

You need Node.js 24 or newer and Corepack. The exact pnpm version is recorded in `package.json`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4173`. Vite starts the React app, Cloudflare Worker, API, and a local
SQLite-backed Durable Object together. The deterministic AIE NYC sample is created on first use.

Useful routes:

| Route                      | What it demonstrates                            |
| -------------------------- | ----------------------------------------------- |
| `/forms`                   | Call-for-proposals builder and live preview     |
| `/submit/aie-nyc-2026-cfp` | Public proposal form                            |
| `/submissions`             | Submission pipeline and decisions               |
| `/reviews`                 | Reviewer assignments and evaluation progress    |
| `/reviewer/rev_001`        | One reviewer's scorecard workspace              |
| `/readiness`               | Outstanding speaker onboarding work             |
| `/schedule`                | Draft schedule and publication workflow         |
| `/portal/par_003`          | Accepted-speaker portal                         |
| `/agenda`                  | Public agenda from the latest immutable release |

For a guided first workflow, use [Build and publish a CFP](docs/guides/build-and-publish-a-cfp.md).
The complete setup and reset instructions are in
[Local development](docs/guides/local-development.md).

## How it is organized

ProgramKit has three reusable packages and one supported deployment assembly:

| Path              | Responsibility                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Domain records, named operations, validation, authorization, invariants, selectors, audit events, and repository contracts                |
| `packages/web`    | React 19 interface, TanStack Router routes, TanStack Query state, and scoped organizer, submitter, reviewer, speaker, and public surfaces |
| `packages/agent`  | Optional MCP server, plugin manifest, and operational skills                                                                              |
| `apps/cloudflare` | Worker, static assets, API composition, identity, and Durable Object persistence                                                          |

```text
React + TanStack
       │
       ▼
Cloudflare Worker ── named core operations ── one Durable Object per event
       │                                           │
       ├── scoped HTTP and public routes            └── SQLite state + revisions
       ├── static Vite assets
       └── optional services: mail, R2, Airtable, MCP
```

Every human, API, or agent write uses the same named operation engine. Public agenda data comes
from an immutable schedule release, not the mutable draft. Host code supplies trusted identity and
event scope.

Read [Architecture](ARCHITECTURE.md) for the full model and
[Storage and integrations](docs/architecture/storage-and-integrations.md) for the database
decision.

## Deploy it

Cloudflare is the supported runtime. One Worker serves the app and API, Workers Static Assets
serves the Vite build, and one SQLite-backed Durable Object owns each event.

```bash
pnpm check
pnpm deploy
```

The official environments use the same code with isolated runtime state:

| Host                                               | Purpose                                          |
| -------------------------------------------------- | ------------------------------------------------ |
| [programkit.dev](https://programkit.dev)           | Project homepage                                 |
| [demo.programkit.dev](https://demo.programkit.dev) | Anonymous, disposable seven-day workspaces       |
| [app.programkit.dev](https://app.programkit.dev)   | Passwordless staff accounts and event workspaces |

The one-click Cloudflare button uses the public GitHub mirror because Cloudflare's deploy flow does
not currently accept Forge repositories. Forge is the primary collaboration host; the two remotes
contain the same `main` branch.

Airtable is optional and experimental. The recommended V1 store is the event Durable Object. The
current Airtable-backed mode is useful for integration testing, but it still needs a durable retry
journal, narrow webhook processing, conflict review, and clearer ownership controls before real
conference data. It is not required for local development or deployment.

See [Deployment](DEPLOYMENT.md) for Cloudflare setup, environment profiles, and production
bindings.

## Verify a change

```bash
pnpm check
```

This runs tests, linting, formatting verification, TypeScript, package builds, the production
Worker build, and plugin validation.

## Documentation

- [Documentation map](docs/README.md)
- [Program lifecycle](docs/product/program-lifecycle.md)
- [Product status and roadmap](ROADMAP.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [HTTP API](docs/api/README.md)
- [Security](SECURITY.md)
- [Operations](OPERATIONS.md)
- [Agent navigation](docs/agents/README.md)
- [Contributing](CONTRIBUTING.md)

The agent guides point back to the same canonical product and architecture documents humans use.
They add navigation and execution guardrails instead of maintaining a second version of the facts.

## Contributing

Issues and pull requests are welcome on
[Forge](https://forge.smol.ai/andheller/programkit). Start with
[CONTRIBUTING.md](CONTRIBUTING.md), keep changes focused on one complete workflow, and run
`pnpm check` before handoff.

ProgramKit is licensed under the [Apache License 2.0](LICENSE).
