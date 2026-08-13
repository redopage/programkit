<!-- Canonical: https://programkit.dev/docs/reference/routes-and-surfaces -->
<!-- Markdown: https://programkit.dev/docs/reference/routes-and-surfaces.md -->

# Routes and surfaces

This reference describes stable route families. Route modules under `packages/web/src/routes` and
the Worker router remain executable sources of truth.

## Organizer workspace

| Route             | Surface                    | Access                         |
| ----------------- | -------------------------- | ------------------------------ |
| `/`               | Overview                   | Staff event membership         |
| `/forms`          | CFP forms                  | Staff event membership         |
| `/submissions`    | Proposal pipeline          | Staff event membership         |
| `/reviews`        | Evaluation workspace       | Staff event membership         |
| `/sessions`       | Accepted sessions          | Staff event membership         |
| `/schedule`       | Draft and publish agenda   | Staff event membership         |
| `/crm`            | Organization CRM           | Staff membership and org scope |
| `/people`         | Event speakers             | Staff event membership         |
| `/readiness`      | Tasks and readiness        | Staff event membership         |
| `/files`          | Files and resources        | Staff event membership         |
| `/communications` | Communications             | Staff event membership         |
| `/integrations`   | Data & connections         | Staff; controls vary by role   |
| `/settings`       | Event and account settings | Staff; controls vary by role   |
| `/changes`        | Proposed change sets       | Staff event membership         |
| `/agent`          | Agent workspace            | Staff event membership         |

The hosted Worker redirects unauthenticated organizer requests to `/login`. Local deterministic
development uses a sample actor instead.

## Participant and public surfaces

| Route family                                  | Surface                       | Boundary                         |
| --------------------------------------------- | ----------------------------- | -------------------------------- |
| `/login`                                      | Organizer sign-in             | Account auth                     |
| `/access`                                     | Participant access recovery   | Event participant session        |
| `/submit/{formSlug}`                          | Public CFP                    | Open form projection             |
| `/submit/{formSlug}/mine/{speakerAccessKey}`  | Submitter's saved work        | Record-scoped capability/session |
| `/reviewer/{reviewerId}/{reviewerAccessKey}`  | Reviewer queue and scorecards | Reviewer-scoped capability       |
| `/portal/{participationId}/{portalAccessKey}` | Accepted-speaker portal       | Participation-scoped capability  |
| `/agenda`                                     | Public published program      | Immutable public release         |
| `/privacy`                                    | Privacy page                  | Public                           |
| `/terms`                                      | Terms page                    | Public                           |

The first public request for a hosted event can include `?event={eventId}`. The Worker validates
the public event metadata and sets routing context. That event value does not grant staff access.

Local sample routes may omit access keys for convenience. Those shortcuts are for deterministic
sample data and are not the hosted authorization model.

## HTTP and machine surfaces

| Path family                 | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `/api/v1/*`                 | Browser and event-scoped integration API             |
| `/public/v1/*`              | Public and participant projections and operations    |
| `/mcp`                      | Authenticated stateless MCP endpoint                 |
| `/agent-plugin.zip`         | Public plugin package generated for the current host |
| `/public/agenda.json`       | Published program JSON projection                    |
| public XML/iCal/embed paths | Published machine and embedded program views         |

API keys may call only the explicit REST and MCP allowlist. They cannot administer accounts,
memberships, keys, Airtable, or raw R2 objects.

See [HTTP API](/docs/api.md) for endpoints and
[`@programkit/agent`](https://forge.smol.ai/andheller/programkit/blob/main/packages/agent/README.md) for MCP methods.
