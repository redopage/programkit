<p align="center">
  <img src="apps/cloudflare/public/favicon.svg" alt="" width="64" height="66" />
</p>

<h1 align="center">ProgramKit</h1>

<p align="center">
  Open-source conference program management, from the first call for proposals to the published agenda.
</p>

<p align="center">
  <a href="https://programkit.dev">Website</a> ·
  <a href="https://demo.programkit.dev">Try a seven-day demo</a> ·
  <a href="https://forge.smol.ai/andheller/programkit">Forge</a> ·
  <a href="docs/README.md">Documentation</a>
</p>

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit"><img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare" /></a>
</p>

ProgramKit gives organizers one focused workspace to:

- publish conditional call-for-speakers forms;
- collect and evaluate proposals;
- move accepted speakers through bios, headshots, slides, and other requirements;
- build a conflict-aware schedule;
- send confirmations and reminders;
- publish a fast, embeddable public agenda.

It is intentionally smaller than a general CRM or an enterprise event suite. The goal is to make
the conference-program job fast, understandable, and easy to own.

> **Project status:** release candidate. The complete conference-program workflow, scoped staff and
> participant accounts, email-based password recovery, and private R2 files are implemented. A
> public event still needs deployment-specific mail, backup, abuse, file, monitoring, and response
> controls. See [Security](SECURITY.md) and the [roadmap](ROADMAP.md).

## Run it locally

You need Node.js 24 or newer and Git. The npm scripts use the exact pnpm version recorded in
`package.json`, so no global pnpm or Corepack installation is required.

```bash
npm run setup
npm start
```

Open `http://localhost:4173`. Vite starts the React app, Cloudflare Worker, API, and a local
SQLite-backed Durable Object together. The deterministic AIE NYC sample is created on first use.

Useful routes:

| Route                      | What it demonstrates                                                |
| -------------------------- | ------------------------------------------------------------------- |
| `/forms`                   | Call-for-proposals builder and live preview                         |
| `/submit/aie-nyc-2026-cfp` | Public proposal form                                                |
| `/submissions`             | Submission pipeline and decisions                                   |
| `/reviews`                 | Reviewer invite links, assignments, progress, and results           |
| `/readiness`               | Outstanding speaker onboarding work                                 |
| `/schedule`                | Draft schedule and publication workflow                             |
| `/portal/par_003`          | Accepted-speaker portal                                             |
| `/agenda`                  | Agenda, sessions, speakers, itinerary, and gallery from one release |

For a guided first workflow, use [Set up your first event](docs/getting-started/first-event.md).
The focused CFP guide is [Build and publish a CFP](docs/guides/build-and-publish-a-cfp.md), and the
complete setup and reset instructions are in [Local development](docs/guides/local-development.md).

## How it is organized

ProgramKit has three reusable packages and one supported deployment assembly:

| Path              | Responsibility                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core`   | Domain records, named operations, validation, authorization, invariants, selectors, audit events, and repository contracts                |
| `packages/web`    | React 19 interface, TanStack Router routes, TanStack Query state, and scoped organizer, submitter, reviewer, speaker, and public surfaces |
| `packages/agent`  | Optional MCP server, portable Agent Plugin, Codex extension, and operational skills                                                       |
| `apps/cloudflare` | Worker, static assets, API composition, identity, and Durable Object persistence                                                          |

```text
React + TanStack
       │
       ▼
Cloudflare Worker ── event access object ── one workspace object per event
       │                                      │
       ├── scoped HTTP and public routes       └── SQLite state + revisions
       ├── static Vite assets
       └── optional services: mail, R2, Airtable, MCP
```

Every human, API, or agent write uses the same named operation engine. Public agenda data comes
from an immutable schedule release, not the mutable draft. Host code supplies trusted identity and
event scope. Hosted organizers can create hashed, event-scoped API keys with copy-once secrets and
explicit read or write permissions.

Read [Architecture](ARCHITECTURE.md) for the full model and
[Storage and integrations](docs/architecture/storage-and-integrations.md) for the database
decision.

## Deploy it

Cloudflare is the supported runtime. One Worker serves the app and API, Workers Static Assets
serves the Vite build, and one SQLite-backed Durable Object owns each event. The deploy button is
the shortest production-style path: Cloudflare provisions the Worker, R2 bucket, and three Durable
Object bindings declared by the repository.

After deployment, use the private setup code to claim the first owner account and event in the
browser. The installation becomes invite-only after that claim unless the owner explicitly enables
open organizer signup. That same origin serves the operator app, public pages, HTTP API, `/mcp`,
and a deployment-specific Agent Plugin download; the demo site is not part of a self-host.

Use the local walkthrough when you want collision checks, repeatable resource names, or a custom
domain from the start:

```bash
npm run cloudflare:login
npm run selfhost
```

The walkthrough checks Cloudflare access, protects existing Worker and R2 names, creates the upload
bucket, deploys the code and setup secret together, and verifies public health and the plugin
download. The deployed app includes password sign-up, multiple event workspaces, private R2
uploads, event-scoped API keys, and the MCP endpoint on the same origin. Email and Airtable are
optional follow-up integrations.
Under **Data & connections**, a self-hoster can create an Agent operations key and download a
plugin bundle already configured for that deployment. The plugin is installed in the agent client;
it is not another hosted service.

Use `npm start` when you only want the deterministic local sample without accounts or Cloudflare
resources. See [Deployment](DEPLOYMENT.md) for non-interactive flags, custom domains, and the exact
self-hosted boundary.

The official environments use the same code with isolated runtime state:

| Host                                               | Purpose                                            |
| -------------------------------------------------- | -------------------------------------------------- |
| [programkit.dev](https://programkit.dev)           | Project homepage                                   |
| [demo.programkit.dev](https://demo.programkit.dev) | Anonymous, disposable seven-day workspaces         |
| [app.programkit.dev](https://app.programkit.dev)   | Staff accounts, event workspaces, and public flows |

The one-click Cloudflare button uses the GitHub mirror because Cloudflare's deploy flow does not
currently accept Forge repositories. Forge is the primary collaboration host. A release must push
the same candidate commit to both `main` branches and confirm the GitHub mirror is anonymously
readable before advertising the button.

Airtable is optional and experimental. The recommended V1 store is the event Durable Object. The
current Airtable-backed mode is useful for integration testing, but it still needs a durable retry
journal, narrow webhook processing, conflict review, and clearer ownership controls before real
conference data. It is not required for local development or deployment.

See [Deployment](DEPLOYMENT.md) for Cloudflare setup, environment profiles, and production bindings,
then use the [self-host launch checklist](docs/self-hosting/launch-checklist.md) before real
participant data.

## Verify a change

```bash
npm run verify
```

This runs tests, linting, formatting and documentation-link verification, TypeScript, package
builds, the production Worker build, generated-contract checks, and plugin validation.

## Documentation

- [Documentation map](docs/README.md)
- [Getting started](docs/getting-started/README.md)
- [Set up your first event](docs/getting-started/first-event.md)
- [Product and user guide](docs/users/README.md)
- [Self-hosting](docs/self-hosting/README.md)
- [Self-host launch checklist](docs/self-hosting/launch-checklist.md)
- [Developer guide](docs/developers/README.md)
- [Customize the starter](docs/developers/customizing.md)
- [Program lifecycle](docs/product/program-lifecycle.md)
- [Product status and roadmap](ROADMAP.md)
- [Architecture](ARCHITECTURE.md)
- [Deployment](DEPLOYMENT.md)
- [HTTP API quickstart](docs/api/quickstart.md) and [reference](docs/api/README.md)
- [Agent Plugins and MCP](docs/integrations/agent-plugins.md)
- [Security](SECURITY.md)
- [Operations](OPERATIONS.md)
- [Agent navigation](docs/agents/README.md)
- [Connect an agent](docs/agents/connect.md)
- [Agent recipes](docs/agents/recipes.md)
- [Contributing](CONTRIBUTING.md)

The agent guides point back to the same canonical product and architecture documents humans use.
They add navigation and execution guardrails instead of maintaining a second version of the facts.

## Contributing

Issues and pull requests are welcome on
[Forge](https://forge.smol.ai/andheller/programkit). Start with
[CONTRIBUTING.md](CONTRIBUTING.md), keep changes focused on one complete workflow, and run
`pnpm check` before handoff.

ProgramKit is licensed under the [Apache License 2.0](LICENSE).
