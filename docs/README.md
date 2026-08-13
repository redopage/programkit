# ProgramKit documentation

ProgramKit is an open-source conference-program starter that can be used as hosted software,
self-hosted as one Cloudflare application, or adapted from source. The same repository contains the
organizer interface, participant surfaces, HTTP API, MCP server, portable Agent Plugin, and the
domain rules that keep them consistent.

The documentation is organized by what you are trying to do. Start with one path; follow the links
to shared reference material only when you need the extra depth.

## Start here

| I want to…                                       | Start with                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| Understand what ProgramKit does                  | [Product and user guide](users/README.md)                            |
| Try the complete workflow locally                | [Getting started](getting-started/README.md)                         |
| Rehearse my first event end to end               | [Set up your first event](getting-started/first-event.md)            |
| Deploy my own copy to Cloudflare                 | [Self-hosting overview](self-hosting/README.md)                      |
| Use a managed ProgramKit installation            | [Hosted or self-hosted?](getting-started/choose-a-deployment.md)     |
| Administer accounts, access, files, and recovery | [Self-hosting administration](self-hosting/administration.md)        |
| Integrate through HTTP                           | [HTTP API quickstart](api/quickstart.md)                             |
| Connect Codex or another agent client            | [Connect an agent](agents/connect.md)                                |
| Make documentation readable by an agent          | [Agent-readable docs](developers/agent-readable-documentation.md)    |
| Extend or rebrand the source                     | [Customize the starter](developers/customizing.md)                   |
| Contribute a complete workflow                   | [Contributing](../CONTRIBUTING.md)                                   |
| Help as a coding agent                           | [Agent navigation](agents/README.md) and [`AGENTS.md`](../AGENTS.md) |

## Product and user guides

- [Product and user guide](users/README.md): roles, surfaces, and the complete lifecycle.
- [Set up your first event](getting-started/first-event.md): rehearse every handoff from CFP to
  published program.
- [Organizer workflows](users/organizer-workflows.md): forms, reviews, speakers, files,
  communications, scheduling, CRM, and settings.
- [Participant experiences](users/participant-experiences.md): submitter, reviewer, speaker, and
  attendee views.
- [Roles and access](users/roles-and-access.md): installation owners, event teams, invitations,
  participant accounts, and scoped links.
- [Reporting and exports](users/reporting-and-exports.md): the reporting available today, portable
  exports, feeds, and honest gaps.
- [Program lifecycle](product/program-lifecycle.md): the domain model behind the user journey.

## Self-hosting and administration

- [Self-hosting overview](self-hosting/README.md): what is deployed and which path to choose.
- [Cloudflare deployment](self-hosting/cloudflare.md): one-click deployment and the verified CLI
  walkthrough.
- [First owner and access policy](self-hosting/first-owner.md): claim an installation safely and
  choose open or invite-only organizer signup.
- [Configuration reference](self-hosting/configuration.md): profiles, bindings, variables, secrets,
  custom domains, email, and optional integrations.
- [Administration](self-hosting/administration.md): keys, access, files, exports, updates, recovery,
  and operating boundaries.
- [Troubleshooting](self-hosting/troubleshooting.md): common setup, R2, login, API, MCP, and file
  problems.
- [Launch checklist](self-hosting/launch-checklist.md): decide whether an evaluation, private pilot,
  or public event is ready for real data.
- [Deployment architecture](../DEPLOYMENT.md), [operations](../OPERATIONS.md), and
  [security](../SECURITY.md): canonical production detail.

## Developer and extension guides

- [Developer guide](developers/README.md): setup, repository shape, and change workflow.
- [Customize the starter](developers/customizing.md): exact branding, provider, field, module, and
  fork-maintenance touchpoints.
- [Repository tour](developers/repository-tour.md): package ownership and request flow.
- [Extending ProgramKit](developers/extending-programkit.md): add a workflow, projection, route,
  integration, agent capability, or deployment profile without bypassing invariants.
- [Architecture](../ARCHITECTURE.md): domain engine, persistence, projections, and platform
  boundaries.
- [Contribution playbook](agents/contribution-playbook.md): trace one vertical change from core to
  docs.
- [Interface craft](product/interface-craft.md): UI quality and state standards.
- [Contributing documentation](contributing-documentation.md): audience routing, page patterns,
  status language, and validation.

## API, agents, and integrations

- [HTTP API quickstart](api/quickstart.md), complete [HTTP API](api/README.md), and generated
  [OpenAPI 3.1 contract](api/openapi.json).
- [Connect an agent](agents/connect.md): direct MCP or the portable plugin package.
- [Agent recipes](agents/recipes.md): safe prompts for readiness, reminders, scheduling,
  publication, and reconciliation.
- [Agent Plugins and MCP](integrations/agent-plugins.md): packaging, client-managed authentication,
  and distribution.
- [Agent-readable documentation](developers/agent-readable-documentation.md): `llms.txt`, Markdown
  pages, content negotiation, server logs, and the JavaScript boundary.
- [`@programkit/agent`](../packages/agent/README.md): protocol, tool, and resource reference.
- [Airtable](integrations/airtable.md): optional experimental integration.
- [Email](integrations/email.md): optional delivery and magic-link configuration.
- [Accelevents handoff](integrations/accelevents.md): portable published-program package.

## Reference

- [Routes and surfaces](reference/routes-and-surfaces.md): stable human-facing paths and their trust
  boundaries.
- [Glossary](reference/glossary.md): ProgramKit product and architecture terms.
- [Capability status vocabulary](reference/capability-status.md): included, optional, experimental,
  operator-supplied, planned, and out-of-scope claims.
- [Product status and roadmap](../ROADMAP.md): what works, what is deliberately absent, and what
  still needs production hardening.
- [Identity and tenancy](architecture/identity-and-tenancy.md): account, membership, event, and file
  ownership.
- [Storage and integrations](architecture/storage-and-integrations.md): Durable Objects, R2,
  Airtable, D1, and portability.

## Sources of truth

ProgramKit keeps one canonical fact and links to it from audience guides. This avoids a user guide,
developer guide, and agent guide silently describing different products.

| Question                                           | Canonical document or code                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| What is in scope and what is complete?             | [`ROADMAP.md`](../ROADMAP.md)                                                              |
| What is the end-to-end product journey?            | [`program-lifecycle.md`](product/program-lifecycle.md)                                     |
| Why are packages and hosts separated?              | [`ARCHITECTURE.md`](../ARCHITECTURE.md)                                                    |
| How does the supported Cloudflare deployment work? | [`DEPLOYMENT.md`](../DEPLOYMENT.md)                                                        |
| Which service owns each kind of data?              | [`storage-and-integrations.md`](architecture/storage-and-integrations.md)                  |
| Who owns identity, event routing, and file state?  | [`identity-and-tenancy.md`](architecture/identity-and-tenancy.md)                          |
| How is an installation operated?                   | [`OPERATIONS.md`](../OPERATIONS.md)                                                        |
| What must be hardened before sensitive data?       | [`SECURITY.md`](../SECURITY.md)                                                            |
| Which named operations exist?                      | `packages/core/src/manifest.ts`                                                            |
| Which HTTP resources exist?                        | [`docs/api/README.md`](api/README.md) and [`openapi.json`](api/openapi.json)               |
| What does the domain store?                        | `packages/core/src/types.ts`                                                               |
| Which browser routes exist?                        | `packages/web/src/routes` and [`routes-and-surfaces.md`](reference/routes-and-surfaces.md) |
| Which MCP tools and resources exist?               | [`packages/agent/README.md`](../packages/agent/README.md)                                  |

When code, tests, and prose disagree, verify the executable behavior, update the canonical source,
and fix the incoming links in the same change. Do not resolve drift by adding another summary.
