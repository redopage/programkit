# Airtable as a conflict-aware team workspace

ProgramKit's recommended installation has one source of truth: the SQLite-backed Durable Object
for an event workspace. Airtable is an optional collaboration surface for teams that prefer its
tables, views, comments, and lightweight editing. It is never required to render a ProgramKit page
or accept an organizer action.

Two-way is useful, but it does not mean that both systems silently win writes. ProgramKit treats an
inbound Airtable edit as a proposed domain change. The proposal is validated through the same named
operations as the web application, and risky or conflicting edits wait for human approval.

## Recommended behavior

```text
ProgramKit operation
        │
        ├── atomic workspace commit + domain event + outbox intent
        │
        └── background batch upsert ───────────────► Airtable
                                                        │
                            webhook or cursor poll ◄────┘
                                      │
                                      ▼
                         three-way field comparison
                         /          |              \
                 safe inbound   outbound repair   conflict
                      │               │               │
                      ▼               ▼               ▼
              named operation    batch upsert   reconciliation queue
              or change set                     and human decision
```

Each mirrored row stores these protected columns:

- `ProgramKit ID` — stable record identity; never inferred from a row name.
- `ProgramKit Revision` — the source revision included in the last successful export.
- `ProgramKit Updated At` — useful for people reading the table.
- `Last Synced At` — time the complete baseline was acknowledged.
- `ProgramKit URL` — deep link to the canonical record.

The integration also keeps the exact last-synced field values in ProgramKit's integration state.
That baseline enables a three-way comparison between the last acknowledged copy, current
ProgramKit state, and current Airtable state. `reconcileAirtableRecord` in `@programkit/core`
implements and tests that comparison without importing the Airtable SDK.

## Editable and protected fields

Start with a small allowlist of low-risk editable fields:

| Table       | Reasonable inbound edits                      | Protected ProgramKit fields                                       |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Submissions | committee notes, suggested track, tags        | ID, status, score aggregates, submitter identity, decision        |
| Speakers    | public title/company, organizer notes, tags   | ID, email identity, portal token, task state, confirmation status |
| Sessions    | summary, suggested track, expected attendance | ID, accepted submission link, placement, published version        |
| Tasks       | organizer note, suggested due date            | ID, owner, approval state, submitted asset, audit fields          |

Changing a protected field in Airtable causes an outbound repair. A safe editable field that only
changed in Airtable becomes a proposed ProgramKit operation. If the same field changed differently
on both sides, neither value wins: the integration records a conflict with the baseline and both
candidate values.

Deletes never cascade. Deleting an Airtable row creates an archive proposal or causes the mirror
to restore the row, depending on policy. ProgramKit does not hard-delete a submission, speaker,
session, or task because a row disappeared from a third-party view.

## Delivery and loop prevention

The Cloudflare host owns credentials, Airtable webhooks or cursor polling, batching, retry policy,
and the durable outbox. Every job carries an origin, workspace key, record ID, source revision, and
idempotency key. When an inbound edit is applied, the resulting ProgramKit event keeps its Airtable
origin so the exporter can acknowledge the new revision without bouncing the same edit forever.

No external request runs inside the Durable Object state transaction. The transaction commits the
domain change and outbox intent together; a Queue consumer or object alarm performs the Airtable
request afterward. The integrations screen must show the real last success, cursor lag, pending
conflict count, attempts, and latest error.

## Installation policy

The default quick start and production deployment do not require Airtable. An operator opts in by
providing one base ID, a scoped personal access token through Worker secrets, and an explicit field
policy. ProgramKit should ship one versioned base template rather than asking each installation to
invent table names and protected columns.

This gives the project one simple deployment path while preserving a high-quality Airtable bonus:
teams can work in Airtable, ProgramKit remains fast and live, and concurrent edits are visible
instead of destructive.
