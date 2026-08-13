# Deploying ProgramKit on Cloudflare

Cloudflare is ProgramKit's supported deployment target. The repository ships one explicit
application in `apps/cloudflare`; there is no generated adapter layer and no second host to keep in
sync.

For a task-oriented installation walkthrough, use the
[self-hosting guide](docs/self-hosting/README.md). This document remains the canonical deployment
architecture and production-boundary reference.

This is an opinionated product decision, not an accidental lock-in. It keeps installation,
operations, performance work, and documentation focused enough for a small open-source team to do
well. The domain packages remain clean, and the logical export remains provider-independent, but
the project does not promise an untested deployment matrix.

## The supported stack

```text
Browser
  │
  ▼
Cloudflare Worker ── Workers Static Assets (Vite web build)
  │
  ├── account Durable Object  ── staff sessions and event switcher projection
  ├── event access object     ── authoritative membership, roles, and invitations
  ├── event Durable Object    ── authoritative event records and serialized mutations
  ├── Airtable                 ── optional experimental team integration
  ├── R2                      ── private uploads and generated files
  ├── Durable Object alarm   ── email delivery, retries, and task reminders
  └── Email Service           ── sending domain and app binding (configured)
```

The runnable application currently includes the Worker, static assets, one account-sharded
identity object for hosted users, one access object per event, and one SQLite-backed workspace
object per event. The official demo root creates isolated hosted trials that expire after seven
days. Local development needs no D1 database, R2 bucket, queue, or email binding to run the
deterministic sample workspace. The checked-in top-level profile and generated self-host profiles
both enable the complete account and multi-event assembly without requiring mail.

## One deployment boundary

Self-hosters deploy one Worker and receive one origin:

```text
https://events.example.com/
  ├── operator and participant web app
  ├── /api/v1/*       HTTP API and public projections
  ├── /mcp            remote MCP server
  └── static assets

Worker bindings
  ├── account identity Durable Object
  ├── event access Durable Object
  ├── event workspace Durable Objects
  └── R2 private files
```

The project website and disposable demo are separate official profiles and are not deployed into a
self-host. The Agent Plugin is a client-side installation package that points back to `/mcp`; it is
not another runtime.

## Official hosted environments

The project deploys the same assembly into explicit Wrangler profiles. This keeps product
code, migrations, tests, and documentation together while isolating runtime state.

| Profile | Host                  | Worker             | Purpose                         | Email                     |
| ------- | --------------------- | ------------------ | ------------------------------- | ------------------------- |
| default | Self-host / direct    | `programkit`       | Accounts and event workspaces   | None required             |
| `local` | Local Vite dev        | `programkit-local` | Single deterministic workspace  | None required             |
| `site`  | `programkit.dev`      | `programkit-site`  | Public site, no workspace API   | No binding                |
| `demo`  | `demo.programkit.dev` | `programkit-demo`  | Seven-day sample workspaces     | No binding                |
| `app`   | `app.programkit.dev`  | `programkit-app`   | Staff sessions and event stores | Restricted sender binding |

The site profile serves the small public homepage and rejects workspace APIs. The demo host
rejects operator or API access until a private demo has been created or opened. The app and
generated self-host profiles use password or optional magic-link staff sessions, an account event
index, live role-scoped event membership, and one workspace object per event. Participant and
reviewer access, private files, API keys, and MCP credentials stay scoped to that event.

Deploy the official profiles with:

```bash
pnpm deploy:site
pnpm deploy:demo
pnpm deploy:app
```

A separate demo repository would make schema, migrations, security fixes, and product behavior
drift. Separate runtime profiles provide the useful isolation without duplicating the product.

The production additions are intentionally Cloudflare-native:

| Concern                   | Default                                              | Why                                                                                    |
| ------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Web and API               | Worker + Static Assets                               | One origin, one deploy, no client-side API configuration                               |
| Event business records    | SQLite-backed Durable Object                         | One isolated, transactional, zero-configuration store per event                        |
| Optional team view        | Airtable                                             | Experimental OAuth and schema integration; keep disconnected for the recommended V1    |
| Files                     | R2                                                   | Direct uploads, private objects, lifecycle policies, and no file bytes in domain state |
| Background delivery       | Transactional outbox + Queue or Durable Object alarm | Retryable work that does not hold open a user request                                  |
| Email                     | Cloudflare Email Service binding                     | Native Worker delivery; Resend may remain an optional provider                         |
| Account event index       | Account Durable Object                               | Verified membership and fast event switching without scanning event objects            |
| Event team access         | Event Access Durable Object                          | Live owner, administrator, viewer, invitation, and revocation authority per event      |
| Cross-workspace analytics | D1 projection, only when needed                      | SQL reporting across many workspace objects                                            |

## Why Durable Objects remain in the write path

ProgramKit's important writes span several records: accept a proposal and create its speaker,
participation, requirements, and session; publish one immutable schedule release; approve and
commit a group of changes. A SQLite-backed Durable Object gives each event one serialized,
transactional boundary without another service or connection pool.

The object stores the versioned workspace, idempotency responses, and revision metadata. Normal
reads and writes stay inside that event boundary. The experimental Airtable-backed mode changes
this behavior by acknowledging Airtable writes before advancing the object cache. That mode is
useful for integration testing, but it is not the recommended production path until partial-write
retry and inbound conflict review are complete.

### Where D1 fits

D1 is not a source of truth. The signed-in user's small event index already lives in their account
object. D1 becomes useful for organization-wide search, analytics, or an administrative control
plane across many accounts and event objects.

That future D1 database should be a rebuildable read projection. It may lag briefly and must never
decide whether a domain transition is valid.

## Experimental Airtable-backed mode

Program and review teams already know how to filter, group, comment on, and edit an Airtable base,
so ProgramKit includes a working OAuth, schema, persistence, and webhook vertical slice. It is not
enabled by default and is not queried on every page load. When enabled, the Durable Object cache
isolates reads from routine API latency and quota use.

```text
named operation
      │
      ▼
Durable Object serializer and current cache
      │
      ├── validate operation and compute record delta
      ├── batch upsert changed Airtable records
      ├── update cache after Airtable acknowledgement
      └── return success

direct Airtable edit ── verified webhook ── cache refresh
```

The mode acknowledges Airtable writes before advancing the object cache, which is why it is not
the recommended V1 store: partial-write retry and inbound conflict review are incomplete. The
preferred future design is an asynchronous outbound mirror with reviewable inbound changes, and it
is not implemented yet.

The schema inventory, measured request budget, webhook behavior, setup, and the exact current
boundary are documented once in the
[Airtable integration guide](docs/integrations/airtable.md). The reasoning behind choosing the
event Durable Object over Airtable or D1 is in
[Storage and integrations](docs/architecture/storage-and-integrations.md#airtable-decision).

## Hosted demo lifecycle

The root of `demo.programkit.dev` creates a random 192-bit capability and initializes a seeded
Durable Object before the link is returned. Opening `/demo/{capability}` verifies that object,
exchanges the capability for an
HTTP-only same-site cookie, and redirects to `/` so the secret is not left in the address bar.

The object keeps its expiration alongside its workspace state and uses its single alarm for the
earliest pending lifecycle event: demo expiry, Airtable webhook refresh, or webhook renewal. A
compact banner shows the remaining time, copies the private link, and supports early deletion.
Natural and manual deletion remove local state, cached OAuth credentials, and the ProgramKit
webhook. They never delete a connected Airtable base or any records in it.

This is an evaluation surface, not production identity. Possession of the capability grants edit
access to the demo, so it must contain sample data only. See
[Hosted demos](docs/architecture/hosted-demos.md) for the exact boundary.

## Hosted app identity and events

The app profile sends a short-lived, single-use magic link through the app-only Email Service
binding. It stores only token and session hashes in an account-sharded Auth Durable Object. A
successful sign-in sets HTTP-only, secure, same-site cookies for the session and active event.

Each event is a separate workspace object. Creating and switching events goes through verified
account membership, and a new event starts empty. The complete boundary is documented in
[Identity, events, and storage ownership](docs/architecture/identity-and-tenancy.md).

## Installation and operation guides

This document is the deployment architecture and production-boundary reference. The
step-by-step installation paths live with the other task guides so there is one canonical copy of
each procedure:

| Task                                          | Guide                                                         |
| --------------------------------------------- | ------------------------------------------------------------- |
| Run the sample locally                        | [Local development](docs/guides/local-development.md)         |
| Deploy with the button or the CLI walkthrough | [Cloudflare deployment](docs/self-hosting/cloudflare.md)      |
| Bindings, variables, secrets, custom domains  | [Configuration reference](docs/self-hosting/configuration.md) |
| Connect Airtable                              | [Airtable integration](docs/integrations/airtable.md)         |
| Configure outbound mail                       | [Email](docs/integrations/email.md)                           |
| Decide whether an install is ready for data   | [Launch checklist](docs/self-hosting/launch-checklist.md)     |

## Production acceptance boundary

The application assembly is complete for evaluation and controlled pilots. A production operator
still owns the environment around it: external backups and restore rehearsal, monitoring and
incident contacts, edge abuse controls, file scanning/retention appropriate to public uploads, and
sender-domain operations appropriate to transactional or bulk mail. Use the
[launch checklist](docs/self-hosting/launch-checklist.md) for the go/no-go decision.

MFA or SSO, delegated third-party OAuth, outbound webhooks, a durable Airtable mirror, and a native
Accelevents connector are optional extensions, not missing bindings in the supported Cloudflare
assembly. Do not add them until the target deployment or provider contract requires them.

## Repository hosting and Forge

ProgramKit does not depend on a GitHub-specific runtime. Forge is the primary public repository at
`forge.smol.ai/andheller/programkit`, and GitHub is a synchronized mirror. Cloudflare's deploy
button currently accepts public GitHub and GitLab repositories, so the button points at the GitHub
mirror while normal contribution and source links point at Forge.

The application runtime remains on Cloudflare. Moving it to Forge Sites would replace the Worker,
Durable Object, R2, and mail-service assumptions that the reference assembly intentionally tests.
Forge hosts the source and collaboration surface; Wrangler deploys the same checkout to Cloudflare.

## Leaving Cloudflare

ProgramKit promises ownership of the data, not a maintained second deployment. `GET /api/v1/export`
returns a versioned logical workspace document without recent idempotency response caches. A
production installation must also export R2 objects and a manifest relating object keys to asset
records.

The domain operation engine and web-standard HTTP handler do not depend on React or MCP. That makes
a future host possible, but another deployment is accepted only when a maintainer is prepared to
implement and operate its transactional storage, files, jobs, mail, identity, tests, and docs—not
as a speculative adapter package.
