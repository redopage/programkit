<!-- Canonical: https://programkit.dev/docs -->
<!-- Markdown: https://programkit.dev/docs.md -->

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
| Understand what ProgramKit does                  | [Product and user guide](/docs/users.md)                            |
| Try the complete workflow locally                | [Getting started](/docs/getting-started.md)                         |
| Rehearse my first event end to end               | [Set up your first event](/docs/getting-started/first-event.md)            |
| Deploy my own copy to Cloudflare                 | [Self-hosting overview](/docs/self-hosting.md)                      |
| Use a managed ProgramKit installation            | [Hosted or self-hosted?](/docs/getting-started/choose-a-deployment.md)     |
| Administer accounts, access, files, and recovery | [Self-hosting administration](/docs/self-hosting/administration.md)        |
| Integrate through HTTP                           | [HTTP API quickstart](/docs/api/quickstart.md)                             |
| Connect Codex or another agent client            | [Connect an agent](/docs/agents/connect.md)                                |
| Make documentation readable by an agent          | [Agent-readable docs](/docs/developers/agent-readable-documentation.md)    |
| Extend or rebrand the source                     | [Customize the starter](/docs/developers/customizing.md)                   |
| Contribute a complete workflow                   | [Contributing](https://forge.smol.ai/andheller/programkit/src/branch/main/CONTRIBUTING.md)                                   |
| Help as a coding agent                           | [Agent navigation](/docs/agents.md) and [`AGENTS.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/AGENTS.md) |

## Product and user guides

- [Product and user guide](/docs/users.md): roles, surfaces, and the complete lifecycle.
- [Set up your first event](/docs/getting-started/first-event.md): rehearse every handoff from CFP to
  published program.
- [Organizer workflows](/docs/users/organizer-workflows.md): forms, reviews, speakers, files,
  communications, scheduling, CRM, and settings.
- [Participant experiences](/docs/users/participant-experiences.md): submitter, reviewer, speaker, and
  attendee views.
- [Roles and access](/docs/users/roles-and-access.md): installation owners, event teams, invitations,
  participant accounts, and scoped links.
- [Reporting and exports](/docs/users/reporting-and-exports.md): the reporting available today, portable
  exports, feeds, and honest gaps.
- [Program lifecycle](/docs/product/program-lifecycle.md): the domain model behind the user journey.

## Self-hosting and administration

- [Self-hosting overview](/docs/self-hosting.md): what is deployed and which path to choose.
- [Cloudflare deployment](/docs/self-hosting/cloudflare.md): one-click deployment and the verified CLI
  walkthrough.
- [First owner and access policy](/docs/self-hosting/first-owner.md): claim an installation safely and
  choose open or invite-only organizer signup.
- [Configuration reference](/docs/self-hosting/configuration.md): profiles, bindings, variables, secrets,
  custom domains, email, and optional integrations.
- [Administration](/docs/self-hosting/administration.md): keys, access, files, exports, updates, recovery,
  and operating boundaries.
- [Troubleshooting](/docs/self-hosting/troubleshooting.md): common setup, R2, login, API, MCP, and file
  problems.
- [Launch checklist](/docs/self-hosting/launch-checklist.md): decide whether an evaluation, private pilot,
  or public event is ready for real data.
- [Deployment architecture](https://forge.smol.ai/andheller/programkit/src/branch/main/DEPLOYMENT.md), [operations](https://forge.smol.ai/andheller/programkit/src/branch/main/OPERATIONS.md), and
  [security](https://forge.smol.ai/andheller/programkit/src/branch/main/SECURITY.md): canonical production detail.

## Developer and extension guides

- [Developer guide](/docs/developers.md): setup, repository shape, and change workflow.
- [Customize the starter](/docs/developers/customizing.md): exact branding, provider, field, module, and
  fork-maintenance touchpoints.
- [Repository tour](/docs/developers/repository-tour.md): package ownership and request flow.
- [Extending ProgramKit](/docs/developers/extending-programkit.md): add a workflow, projection, route,
  integration, agent capability, or deployment profile without bypassing invariants.
- [Architecture](https://forge.smol.ai/andheller/programkit/src/branch/main/ARCHITECTURE.md): domain engine, persistence, projections, and platform
  boundaries.
- [Contribution playbook](/docs/agents/contribution-playbook.md): trace one vertical change from core to
  docs.
- [Interface craft](/docs/product/interface-craft.md): UI quality and state standards.
- [Contributing documentation](/docs/contributing-documentation.md): audience routing, page patterns,
  status language, and validation.

## API, agents, and integrations

- [HTTP API quickstart](/docs/api/quickstart.md), complete [HTTP API](/docs/api.md), and generated
  [OpenAPI 3.1 contract](/docs/api/openapi.json).
- [Connect an agent](/docs/agents/connect.md): direct MCP or the portable plugin package.
- [Agent recipes](/docs/agents/recipes.md): safe prompts for readiness, reminders, scheduling,
  publication, and reconciliation.
- [Agent Plugins and MCP](/docs/integrations/agent-plugins.md): packaging, client-managed authentication,
  and distribution.
- [Agent-readable documentation](/docs/developers/agent-readable-documentation.md): `llms.txt`, Markdown
  pages, content negotiation, server logs, and the JavaScript boundary.
- [`@programkit/agent`](https://forge.smol.ai/andheller/programkit/src/branch/main/packages/agent/README.md): protocol, tool, and resource reference.
- [Airtable](/docs/integrations/airtable.md): optional experimental integration.
- [Email](/docs/integrations/email.md): optional delivery and magic-link configuration.
- [Accelevents handoff](/docs/integrations/accelevents.md): portable published-program package.

## Reference

- [Routes and surfaces](/docs/reference/routes-and-surfaces.md): stable human-facing paths and their trust
  boundaries.
- [Glossary](/docs/reference/glossary.md): ProgramKit product and architecture terms.
- [Capability status vocabulary](/docs/reference/capability-status.md): included, optional, experimental,
  operator-supplied, planned, and out-of-scope claims.
- [Product status and roadmap](https://forge.smol.ai/andheller/programkit/src/branch/main/ROADMAP.md): what works, what is deliberately absent, and what
  still needs production hardening.
- [Identity and tenancy](/docs/architecture/identity-and-tenancy.md): account, membership, event, and file
  ownership.
- [Storage and integrations](/docs/architecture/storage-and-integrations.md): Durable Objects, R2,
  Airtable, D1, and portability.

## Sources of truth

ProgramKit keeps one canonical fact and links to it from audience guides. This avoids a user guide,
developer guide, and agent guide silently describing different products.

| Question                                           | Canonical document or code                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| What is in scope and what is complete?             | [`ROADMAP.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/ROADMAP.md)                                                              |
| What is the end-to-end product journey?            | [`program-lifecycle.md`](/docs/product/program-lifecycle.md)                                     |
| Why are packages and hosts separated?              | [`ARCHITECTURE.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/ARCHITECTURE.md)                                                    |
| How does the supported Cloudflare deployment work? | [`DEPLOYMENT.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/DEPLOYMENT.md)                                                        |
| Which service owns each kind of data?              | [`storage-and-integrations.md`](/docs/architecture/storage-and-integrations.md)                  |
| Who owns identity, event routing, and file state?  | [`identity-and-tenancy.md`](/docs/architecture/identity-and-tenancy.md)                          |
| How is an installation operated?                   | [`OPERATIONS.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/OPERATIONS.md)                                                        |
| What must be hardened before sensitive data?       | [`SECURITY.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/SECURITY.md)                                                            |
| Which named operations exist?                      | `packages/core/src/manifest.ts`                                                            |
| Which HTTP resources exist?                        | [`docs/api/README.md`](/docs/api.md) and [`openapi.json`](/docs/api/openapi.json)               |
| What does the domain store?                        | `packages/core/src/types.ts`                                                               |
| Which browser routes exist?                        | `packages/web/src/routes` and [`routes-and-surfaces.md`](/docs/reference/routes-and-surfaces.md) |
| Which MCP tools and resources exist?               | [`packages/agent/README.md`](https://forge.smol.ai/andheller/programkit/src/branch/main/packages/agent/README.md)                                  |

When code, tests, and prose disagree, verify the executable behavior, update the canonical source,
and fix the incoming links in the same change. Do not resolve drift by adding another summary.
