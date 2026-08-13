<!-- Canonical: https://programkit.dev/docs/self-hosting -->
<!-- Markdown: https://programkit.dev/docs/self-hosting.md -->

# Self-hosting ProgramKit

ProgramKit's supported self-host is one Cloudflare Worker deployment. It is deliberately not a
collection of services that a new operator must wire together.

```text
your ProgramKit origin
  ├── organizer and participant web app
  ├── public forms, portals, agenda, embeds, and feeds
  ├── /api/v1/*  HTTP API
  ├── /mcp       agent endpoint
  └── /agent-plugin.zip

Cloudflare bindings
  ├── account identity Durable Objects
  ├── event access Durable Objects
  ├── one transactional workspace Durable Object per event
  └── R2 bucket for private files
```

The disposable ProgramKit demo and project website are official service profiles; they are not
parts of your self-host. The Agent Plugin is downloaded into an agent client and points back to
your `/mcp` endpoint. It is not another server.

## Choose a deployment path

### Deploy button

Use the repository's
[Deploy to Cloudflare](https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit)
flow when you want the fewest steps. It needs no local checkout, Node.js, pnpm, Corepack, or terminal.
Cloudflare clones the public repository, lets you choose resource names, provisions supported
bindings, builds the application, and creates a repository you can continue changing. The initial
result uses a `workers.dev` address; attaching a domain already active in the same Cloudflare
account is a short follow-up step.

### Clone and guided CLI

Use the guided CLI when you want collision checks, repeatable names, a selected Cloudflare account,
or a custom domain in the generated configuration:

```bash
npm run cloudflare:login
npm run selfhost
```

This is the path the project verifies end to end. Follow [Cloudflare deployment](/docs/self-hosting/cloudflare.md).

### Fork and customize

Fork or clone the repository when ProgramKit is a starter for your own product. Keep your changes in
source control and deploy the same assembly from your fork. Use the
[customization guide](/docs/developers/customizing.md), then read
[Extending ProgramKit](/docs/developers/extending-programkit.md) before changing domain rules or trust
boundaries.

## Prerequisites

- a Cloudflare account;
- an active R2 subscription on that account;
- Git and Node.js 24 or newer for the CLI path; and
- authority to create Workers, Durable Objects, R2 buckets, routes, and secrets.

Cloudflare may require completing its R2 checkout even when expected usage fits the included free
allowance. ProgramKit does not create or manage the Cloudflare billing relationship.

## What works without optional services

A fresh self-host supports:

- password accounts and multiple isolated events;
- owner, administrator, and viewer event membership;
- invite-only or open organizer signup;
- proposals, review, speakers, requirements, files, communications state, scheduling, and public
  pages;
- private R2 uploads and mediated downloads;
- event-scoped API keys and OpenAPI endpoints; and
- the hosted MCP endpoint and generated plugin download.

Email is optional for a single-owner installation. Without it, password sign-in works, but
ProgramKit cannot deliver magic links, team invitations, confirmations, reminders, or campaigns.
Configure email before adding event teammates. Airtable is optional and experimental.

## First-run sequence

1. Deploy the Worker and retain the generated first-owner setup code.
2. Open the Worker URL.
3. Create the first owner account with the same setup code.
4. Name the first event and confirm its dates and timezone.
5. Leave organizer signup invite-only or explicitly choose open signup.
6. Add tracks, rooms, and team members.
7. Configure email only if the installation needs real delivery.
8. Exercise the public, reviewer, speaker, file, API, and MCP handoffs before importing real data.

See [First owner and access policy](/docs/self-hosting/first-owner.md) for the security model,
[Configuration](/docs/self-hosting/configuration.md) for bindings, variables, secrets, and custom domains, and
[Troubleshooting](/docs/self-hosting/troubleshooting.md) when a step does not behave as described.

## Before real participant data

The application is a release candidate; production approval is deployment-specific. A public event
operator must test email recovery, name an ownership-transfer contact, and own edge abuse
protection, file scanning and retention, complete backups, restore drills, monitoring, alerting, and
incident response. MFA or external OIDC is required only when the deployment's assurance policy
calls for it.

Read [Security](https://forge.smol.ai/andheller/programkit/blob/main/SECURITY.md) and [Administration](/docs/self-hosting/administration.md) before opening a public
event. Record the decision with the [self-host launch checklist](/docs/self-hosting/launch-checklist.md).
