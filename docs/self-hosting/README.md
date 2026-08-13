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
flow when you want the fewest local steps. Cloudflare clones the public repository, lets you choose
resource names, provisions supported bindings, builds the application, and creates a repository you
can continue changing.

### Clone and guided CLI

Use the guided CLI when you want collision checks, repeatable names, a selected Cloudflare account,
or a custom domain in the generated configuration:

```bash
pnpm selfhost
```

This is the path the project verifies end to end. Follow [Cloudflare deployment](cloudflare.md).

### Fork and customize

Fork or clone the repository when ProgramKit is a starter for your own product. Keep your changes in
source control and deploy the same assembly from your fork. Use the
[customization guide](../developers/customizing.md), then read
[Extending ProgramKit](../developers/extending-programkit.md) before changing domain rules or trust
boundaries.

## Prerequisites

- a Cloudflare account;
- an active R2 subscription on that account;
- Git, Node.js 24 or newer, and Corepack for the CLI path; and
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

See [First owner and access policy](first-owner.md) for the security model.

## Before real participant data

The repository is production-shaped but still marked active alpha. A production operator must own
the remaining deployment-specific controls: account recovery and ownership transfer, MFA or OIDC
where required, edge abuse protection, malware scanning and retention, complete backups, restore
drills, monitoring, alerting, and incident response.

Read [Security](../../SECURITY.md) and [Administration](administration.md) before opening a public
event. Record the decision with the [self-host launch checklist](launch-checklist.md).
