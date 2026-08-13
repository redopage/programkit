# Getting started

ProgramKit can be explored without an account, deployed as one Cloudflare application, or cloned
as an open-source starter. All three paths run the same product packages.

## Choose the shortest useful path

| Goal                             | Time to first screen | External account | Use this path                                          |
| -------------------------------- | -------------------- | ---------------- | ------------------------------------------------------ |
| Evaluate the hosted application  | Immediate            | ProgramKit       | [Choose how to run ProgramKit](choose-a-deployment.md) |
| Try a disposable hosted sample   | Immediate            | None             | [Open the demo](https://demo.programkit.dev)           |
| Inspect a deterministic sample   | A few minutes        | None             | [Run locally](../guides/local-development.md)          |
| Own the runtime and stored data  | About 10–20 minutes  | Cloudflare       | [Deploy to Cloudflare](../self-hosting/cloudflare.md)  |
| Rebrand or add product behavior  | After local setup    | None             | [Developer guide](../developers/README.md)             |
| Connect an AI client to an event | A few minutes        | Running install  | [Connect an agent](../agents/connect.md)               |

The local sample is deterministic and uses sample data. A self-host includes real account and
event isolation, but production operators should still review [Security](../../SECURITY.md) before
accepting sensitive participant data.

## Run the complete sample locally

Prerequisites: Git, Node.js 24 or newer, and Corepack.

```bash
git clone https://forge.smol.ai/andheller/programkit.git
cd programkit
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4173`. One process starts the React application, Cloudflare Worker, and
local SQLite-backed Durable Objects. It does not need a Cloudflare login, R2, email, Airtable, or an
API key.

Try the lifecycle in this order:

1. Build or inspect a call for proposals in **Forms**.
2. Submit a proposal through the public form.
3. Assign and complete a review.
4. Accept the proposal and inspect the resulting speaker, task, and session.
5. Complete work in the speaker portal.
6. Place the session, run schedule preflight, and publish.
7. Open the public agenda and confirm it reads the immutable release.

Use [Set up your first event](first-event.md) for the role-crossing rehearsal and the detailed
[local development walkthrough](../guides/local-development.md) for sample routes, reset
instructions, and verification commands.

## Deploy your own installation

The quickest path is the repository's **Deploy to Cloudflare** button. The most repeatable path is
the guided CLI:

```bash
pnpm selfhost
```

Both produce one origin containing the web app, accounts, events, public pages, HTTP API, MCP
server, and plugin download. Continue with the [self-hosting overview](../self-hosting/README.md),
then use the [launch checklist](../self-hosting/launch-checklist.md) before real participant data.

## Understand the product before configuring it

ProgramKit follows one spine:

```text
configure event → publish CFP → receive proposals → review → decide
                → onboard speakers → schedule sessions → publish program
```

The organizer, submitter, reviewer, speaker, and attendee do not see one unrestricted database.
They receive separate projections and operation allowlists. Read the [user guide](../users/README.md)
for the surfaces and [program lifecycle](../product/program-lifecycle.md) for the underlying model.

## Verify a source change

Run the same complete gate used by CI:

```bash
pnpm check
```

It runs tests, linting, formatting checks, generated plugin drift checks, TypeScript and production
builds, OpenAPI drift checks, and plugin validation.
