<!-- Canonical: https://programkit.dev/docs/users/reporting-and-exports -->
<!-- Markdown: https://programkit.dev/docs/users/reporting-and-exports.md -->

# Reporting and exports

ProgramKit reports around operational decisions instead of presenting a separate analytics product.
The current product has useful live reports and portable exports, but it does not yet include a
free-form report builder or a cross-installation warehouse.

## Reporting available in the product

| Question                                       | Where to answer it              |
| ---------------------------------------------- | ------------------------------- |
| What needs attention now?                      | **Overview**                    |
| How many proposals are in each decision state? | **Submissions**                 |
| Is review assigned and complete?               | **Review**                      |
| Which speakers are blocked or overdue?         | **Tasks** and readiness filters |
| Which files are missing or awaiting review?    | **Files**                       |
| Is the schedule publishable?                   | **Agenda** preflight            |
| What has been delivered or retried?            | **Communications** history      |
| Who has participated across events?            | **CRM** analytics and segments  |
| Are storage, email, and calendar connected?    | **Data & connections**          |

These reports read the live event state. The public program remains a separate immutable release.

## Portable exports

**Data & connections** provides a full logical ProgramKit export. It contains the versioned
workspace and CSV representations for operational records. Use it for audit, departure, analysis,
or restore planning.

Other exports include:

- reviewer and evaluation CSV data;
- selected latest speaker files as a structured ZIP;
- speaker and session handoff CSVs for Accelevents;
- public agenda JSON/XML projections;
- public iCal feeds and attendee calendar downloads; and
- the generated OpenAPI contract for integration clients.

R2 file bytes are a separate recovery boundary from logical workspace data. A complete departure
or backup plan must export both the logical records and file objects with a manifest relating them.

## Reports for an agent

The MCP server exposes task-shaped reads for submission pipeline, people, readiness, sessions,
schedule validation, publication preflight, and proposed change sets. The agent receives minimized
operational data and cannot publish, send, approve, commit, or perform destructive actions.

Use [Connect an agent](/docs/agents/connect.md) for setup and the
[`@programkit/agent` reference](https://forge.smol.ai/andheller/programkit/src/branch/main/packages/agent/README.md) for the exact tool inventory.

## What is not included yet

- a drag-and-drop report builder;
- scheduled report delivery;
- arbitrary SQL over all customer installations;
- a production D1 analytics projection across large numbers of event objects; or
- a guaranteed restore that coordinates event state, identity, access, and R2 automatically.

A future cross-event analytics store should be a rebuildable D1 projection fed by domain events,
not another source of truth. Current status and remaining work live in the
[roadmap](https://forge.smol.ai/andheller/programkit/src/branch/main/ROADMAP.md).
