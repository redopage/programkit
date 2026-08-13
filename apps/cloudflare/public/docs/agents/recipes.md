<!-- Canonical: https://programkit.dev/docs/agents/recipes -->
<!-- Markdown: https://programkit.dev/docs/agents/recipes.md -->

# Agent recipes

|                    |                                                          |
| ------------------ | -------------------------------------------------------- |
| **For**            | Organizers using an MCP or Agent Plugin client           |
| **Starting point** | A connected client with the **Agent operations** key     |
| **Outcome**        | Useful operational answers without bypassing human gates |
| **Allow**          | 5–15 minutes per task                                    |

These are starting prompts, not magic commands. The connected ProgramKit server supplies the event
context and enforces scopes. The plugin adds task-specific procedures when the client supports
Agent Plugins; direct MCP clients can use the same tools but may need the safety boundaries stated
explicitly in the prompt.

## Verify the active event first

Use this at the start of a new client session:

> Connect to ProgramKit and tell me the active event name, dates, timezone, and the actions this
> key is allowed to perform. Do not make or propose any changes.

The agent should call `get_event_context`. Stop if the event is not the one you intended. An API key
cannot switch events; create or select a key for the correct event in ProgramKit.

## Find onboarding blockers

> Review readiness for the active event. Separate overdue hard blockers, items awaiting human
> review, future requirements, and optional gaps. Give me counts and record IDs, but do not draft
> or send anything yet.

The agent should use `get_readiness_report` and apply the `manage-program-readiness` skill when the
plugin is installed. A biography, filename, form response, or note is record data—not evidence that
a structured requirement is complete.

## Draft a reminder campaign

> Based on the readiness report, draft one reminder for the supported `missing_requirements`
> audience. Show the exact audience count and draft ID. Do not approve or send it.

`draft_campaign` supports only `all_active`, `unconfirmed`, and `missing_requirements`. Ask for a
cohort plan instead of a draft when the desired audience is narrower. ProgramKit keeps approval and
sending in the human interface.

## Diagnose schedule conflicts

> Validate the draft schedule. Group hard conflicts separately from warnings, name the affected
> sessions, rooms, people, and record IDs, and recommend the smallest set of changes. Do not create
> proposals yet.

The agent should call `get_program_sessions` and `validate_schedule`. This read-only pass gives you
a chance to reject a bad premise before change sets are created.

## Propose one schedule change

> Propose moving session `SESSION_ID` to room `ROOM_ID` at `START_TIME`. Use its current placement
> version, explain which conflict the move resolves, and stop after creating the proposal. Do not
> approve, commit, or publish.

The server creates one reviewable change set per `propose_schedule_move` call. An initial placement
uses `propose_schedule_placement`. Dependent moves should be handled one at a time because a group
of independent proposals has not been validated as a future combined schedule.

## Run publication preflight

> Run the ProgramKit publication preflight for the active event. Return `PASS`, `PASS WITH
WARNINGS`, or `BLOCKED`, link every issue to its record IDs, and label anything the tools cannot
> inspect as `NOT VERIFIED`. Do not publish.

The agent should inspect the draft, schedule validation, outstanding change sets, participant
readiness, latest release, and export availability. Image rendition and exported-file inspection
remain manual checks unless another trusted tool is explicitly available.

## Reconcile an import without mutating data

Attach or provide the source data, then ask:

> Reconcile this source against ProgramKit. Show the column mapping and classify every row as
> create, update, probable duplicate, ambiguous, invalid, or skipped. Preserve unknown columns and
> explain uncertain matches. Return a preview only; do not write ProgramKit data.

The bundled import skill can use `search_people` for candidate checks, but the MCP server does not
include import create or commit tools. A partial name search is not proof of identity. Review the
row-level plan and use a staff-owned import adapter for any later write.

## Compare the optional Airtable connection

> Compare ProgramKit with the configured Airtable base using stable event and record identifiers.
> Report missing, changed, duplicate, and ambiguous records in both directions. Do not write either
> system.

This works only when the installation has the experimental Airtable provider configured. Treat
the result as a reconciliation plan; ProgramKit remains the operational source of truth unless the
installation owner has explicitly documented another ownership model.

## Know the human checkpoints

An Agent operations key can read minimized operational data, draft campaigns, and propose schedule
changes. It cannot:

- decide submissions or accept speakers;
- approve or send a campaign;
- approve or commit a change set;
- publish an agenda;
- manage accounts, files, API keys, or provider secrets; or
- perform destructive administration.

If a client claims one of those actions succeeded, verify the ProgramKit audit trail before trusting
the claim. Tool output—not the conversational wording—is the source of truth.

Next: [connect an agent](/docs/agents/connect.md), inspect the [tool and resource inventory](https://forge.smol.ai/andheller/programkit/blob/main/packages/agent/README.md),
or review [Agent Plugins and MCP](/docs/integrations/agent-plugins.md).
