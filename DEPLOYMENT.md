# Deploying ProgramKit on Cloudflare

Cloudflare is ProgramKit's supported deployment target. The repository ships one explicit
application in `apps/cloudflare`; there is no generated adapter layer and no second host to keep in
sync.

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
deterministic sample workspace. The production self-host walkthrough provisions R2 and enables the
complete account and multi-event assembly without requiring mail.

## Official hosted environments

The project deploys the same assembly into four explicit Wrangler profiles. This keeps product
code, migrations, tests, and documentation together while isolating runtime state.

| Profile | Host                  | Worker            | Purpose                         | Email                     |
| ------- | --------------------- | ----------------- | ------------------------------- | ------------------------- |
| default | Local or private test | `programkit`      | Single deterministic workspace  | None required             |
| `site`  | `programkit.dev`      | `programkit-site` | Public site, no workspace API   | No binding                |
| `demo`  | `demo.programkit.dev` | `programkit-demo` | Seven-day sample workspaces     | No binding                |
| `app`   | `app.programkit.dev`  | `programkit-app`  | Staff sessions and event stores | Restricted sender binding |

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

The version 1 schema has one `ProgramKit State` record and ten native tables for events, people,
participations, submissions, tasks, reviews, sessions, placements, tracks, and rooms. Stable IDs,
deterministic sort values, native columns, and lossless JSON make the full workspace reconstructable
without relying on Durable Object storage.

The checked-in adapter creates and validates that schema, batch-upserts by stable ID, removes stale
managed rows, writes record-level deltas, restores the complete state, and verifies Airtable webhook
HMACs. The current seed uses 171 records. Measured steady-state costs are zero Airtable requests per
page load, two requests for a simple one-record mutation, and eleven requests for an explicit full
restore.

The OAuth flow registers an HMAC-signed webhook and renews it with a Durable Object alarm. Inbound
edits currently perform a debounced full refresh. Production work still needs payload cursors,
narrow record fetches, durable partial-write retries, and conversion of direct edits through named
operations or reviewable change sets. See the
[Airtable integration guide](docs/integrations/airtable.md) for setup, failure modes, and the exact
current boundary. The preferred future team-view design is an asynchronous outbound mirror with
reviewable inbound changes. That design is not implemented yet.

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

## Local development

Prerequisites are Node.js, Corepack, and pnpm. Wrangler authentication is only needed for remote
development or deployment.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4173`. The Cloudflare Vite plugin runs the React app, Worker, and local
SQLite-backed Durable Object together in `workerd`.

## Deploy

### Recommended self-host walkthrough

For a production-style installation from a local checkout, authenticate Wrangler and run:

```bash
pnpm selfhost:setup
pnpm selfhost:deploy
```

The setup command asks for a Worker name, an R2 bucket name, and an optional custom domain. It:

- verifies the active Cloudflare account;
- refuses to overwrite an existing Worker or reuse an unrelated R2 bucket without an explicit
  override;
- creates the R2 bucket when needed;
- generates an ignored `.programkit/wrangler.json` with all three Durable Object bindings,
  migrations, static assets, R2, and the authenticated `hosted-app` profile.

The resulting deployment has open password sign-up and does not require an email provider. Add a
Cloudflare Email binding later if you want magic links and transactional mail. Each event gets its
own Durable Object, while the account object provides a fast event switcher without cross-event
scans.

For a repeatable non-interactive setup:

```bash
pnpm selfhost:setup -- \
  --name my-programkit \
  --bucket my-programkit-assets \
  --domain events.example.com
```

Rerunning the command reuses the names recorded in `.programkit/self-host.json`. If you deliberately
want to adopt existing resources, pass `--reuse-worker` and/or `--reuse-bucket`. Use
`--no-provision` only to generate and inspect the configuration without contacting Cloudflare.

ProgramKit serves the web app, HTTP API, public forms and agenda, and `/mcp` from this one Worker.
An operator can create an **Agent operations** API key under **Infrastructure & API** and connect an
AI client to `https://YOUR_HOST/mcp`; no second service or plugin deployment is required. The
portable plugin bundle can be generated for that same domain. See
[Agent Plugins and MCP](docs/integrations/agent-plugins.md).

### One-click local sample

Use the Deploy to Cloudflare button for the shortest path:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit)

Cloudflare clones the public repository, builds it, and provisions the SQLite Durable Object from
the root `wrangler.jsonc`. This path intentionally starts the single deterministic workspace and is
best for trying the code. Use the walkthrough above when you need accounts, multiple events, R2
files, and event-scoped API keys. Airtable remains an optional follow-up because every self-hosted
callback domain needs its own Airtable OAuth registration.

For the checked-in single-workspace profile, review `wrangler.jsonc`, then run:

```bash
pnpm deploy
```

The command builds the three public packages, type-checks the workspace, builds the Vite client and
Worker, and deploys the checked-in Cloudflare application.

### Enable Airtable on a deployment

Register an OAuth integration with the exact callback
`https://YOUR_HOST/api/v1/integrations/airtable/oauth/callback`, then add the client ID and optional
client secret as Worker secrets. Open **Integrations** and choose **Connect Airtable**. The full
consent and base-selection flow is documented in the
[Airtable integration guide](docs/integrations/airtable.md#connect-airtable).

After deploying, verify:

```bash
curl https://YOUR_HOST/api/v1/health
curl https://YOUR_HOST/api/v1/events
curl https://YOUR_HOST/public/agenda.json
```

Then open the operator app, public CFP, reviewer workspace, speaker portal, and public program.

### Email on the official application host

Inbound `support@programkit.dev` mail is forwarded through Cloudflare Email Routing. Outbound mail
uses the dedicated `mail.programkit.dev` sending domain so application reputation is separate from
normal human mail. Only the `app` profile receives the `EMAIL` binding, and Wrangler restricts it
to `notifications@mail.programkit.dev`.

Magic-link sign-in and product notifications use this binding. Product operations persist one
resolved outbox record per recipient with the domain transaction. The event Durable Object alarm
delivers outside the transaction, stores the provider message ID and attempt history, and retries
failures up to five times. Anonymous demos have no outbound binding. See the
[email guide](docs/integrations/email.md).

## Production bindings, in order

The golden-path production work should land in this sequence:

1. Add participant and reviewer magic-link sessions, then complete account recovery and ownership
   transfer for hosted staff.
2. Add OAuth and workspace-scoped authorization to MCP and API tokens.
3. Add R2 upload initiation, direct upload, finalize/scanning, private download, and lifecycle
   cleanup.
4. Add suppression, unsubscribe, dead-letter recovery, and calendar attachment support to the
   transactional email outbox.
5. Add webhook delivery from a durable outbox, with signed payloads, retries, and delivery history.
6. Move Airtable toward a non-blocking mirror, then add webhook payload cursors, durable retry,
   inbound change sets, and actual last-success, quota, lag, conflict, and error state.
7. Add scheduled encrypted logical exports and test restore into a separate workspace key.

Do not call email, delivery webhooks, or optional mirrors while a domain transaction is open. The
current experimental Airtable-backed repository still performs acknowledged writes in the request
path. That limitation is one reason it is not the recommended V1 store.

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
