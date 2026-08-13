<!-- Canonical: https://programkit.dev/docs -->
<!-- Markdown: https://programkit.dev/docs.md -->

# ProgramKit documentation

ProgramKit runs a conference program from the call for proposals to the published agenda: intake,
review, decisions, speaker onboarding, scheduling, and the public program. One repository holds the
organizer app, the participant pages, the HTTP API, and the MCP server.

## Run it

```bash
git clone https://forge.smol.ai/andheller/programkit.git
cd programkit
npm run setup
npm start
```

Open `http://localhost:4173`. The sample data is seeded and deterministic. Nothing else is needed —
no Cloudflare account, no email provider, no API key.

Prefer not to install anything? Open the [disposable demo](https://demo.programkit.dev), or read
[Choose how to run ProgramKit](/docs/getting-started/choose-a-deployment.md) to compare the hosted app,
the demo, and your own installation.

## Where to go next

- **[Getting started](/docs/getting-started.md)** — the local sample, then
  [a full event rehearsal](/docs/getting-started/first-event.md) that crosses every role from CFP to
  published agenda.
- **[Use ProgramKit](/docs/users.md)** — what organizers, submitters, reviewers, speakers, and
  attendees each see and can do.
- **[Self-hosting](/docs/self-hosting.md)** — deploy one Cloudflare Worker into your own account,
  then operate it.
- **[Developers](/docs/developers.md)** — how the repository is laid out, where a change belongs,
  and which extension points are supported.
- **[API and agents](/docs/api/quickstart.md)** — HTTP integration, [MCP](/docs/agents/connect.md), and the
  portable Agent Plugin.
- **Reference** — [routes and surfaces](/docs/reference/routes-and-surfaces.md),
  [glossary](/docs/reference/glossary.md), and the architecture notes behind
  [identity](/docs/architecture/identity-and-tenancy.md) and
  [storage](/docs/architecture/storage-and-integrations.md).

## Before you trust it with real data

ProgramKit is a release candidate for evaluation and controlled conference-team pilots.
[`ROADMAP.md`](https://forge.smol.ai/andheller/programkit/blob/main/ROADMAP.md) states what works today and separates the four production acceptance
gates from optional future extensions. Every page here uses the same
[capability status vocabulary](/docs/reference/capability-status.md), so "included," "optional,"
"experimental," and "planned" mean the same thing wherever you read them.

Read [Security](https://forge.smol.ai/andheller/programkit/blob/main/SECURITY.md) and work through the
[launch checklist](/docs/self-hosting/launch-checklist.md) before a real event.
