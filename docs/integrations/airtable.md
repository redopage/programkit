# Airtable as a conflict-aware team workspace (design only)

**Status: design only. Not implemented.** ProgramKit ships no Airtable mirror, API client, provider
credential path, delivery outbox or cursor, webhook, poller, or reconciliation queue screen. There
is nothing here for an operator to install, connect, configure, or enable, and no live sync evidence
exists. This document is a proposal for an optional future bonus.

The one exception is `reconcileAirtableRecord` in `@programkit/core`: a real, unit-tested comparison
function. It is a pure primitive with no transport, no Airtable SDK import, and no user interface —
described separately in [The one part that exists today](#the-one-part-that-exists-today).

ProgramKit's supported installation has one source of truth: the SQLite-backed Durable Object for
an event workspace. That is authoritative today and would remain authoritative if this design were
built. Airtable is proposed as an optional collaboration surface for teams that prefer its tables,
views, comments, and lightweight editing. It would never be required to render a ProgramKit page or
accept an organizer action.

Two-way is useful, but it would not mean that both systems silently win writes. The design treats an
inbound Airtable edit as a proposed domain change: validated through the same named operations as
the web application, with risky or conflicting edits waiting for human approval.

## Proposed behavior

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

Each mirrored row would store these protected columns:

- `ProgramKit ID` — stable record identity; never inferred from a row name.
- `ProgramKit Revision` — the source revision included in the last successful export.
- `ProgramKit Updated At` — useful for people reading the table.
- `Last Synced At` — time the complete baseline was acknowledged.
- `ProgramKit URL` — deep link to the canonical record.

The integration would also keep the exact last-synced field values in ProgramKit's integration
state. That baseline is what makes a three-way comparison possible between the last acknowledged
copy, current ProgramKit state, and current Airtable state.

## The one part that exists today

`reconcileAirtableRecord` in `@programkit/core` implements that three-way comparison and is covered
by unit tests in `tests/airtable.test.ts`. Given a last-synced baseline, the current ProgramKit
values, the current Airtable values, and an editable-field allowlist, it returns four lists: fields
to push to Airtable, safe inbound edits to propose to ProgramKit, conflicts carrying all three
values, and fields both sides changed to the same value. Structured values compare independently of
object key order.

That is the whole of it. The function does not import the Airtable SDK, hold credentials, make
network calls, schedule work, or render anything. The mirror, outbox, cursor, webhook or poller,
and reconciliation queue described in the rest of this document are unbuilt; the primitive is the
decision logic they would call, written and tested ahead of the transport.

## Proposed editable and protected fields

The design would start with a small allowlist of low-risk editable fields:

| Table       | Reasonable inbound edits                      | Protected ProgramKit fields                                       |
| ----------- | --------------------------------------------- | ----------------------------------------------------------------- |
| Submissions | committee notes, suggested track, tags        | ID, status, score aggregates, submitter identity, decision        |
| Speakers    | public title/company, organizer notes, tags   | ID, email identity, portal token, task state, confirmation status |
| Sessions    | summary, suggested track, expected attendance | ID, accepted submission link, placement, published version        |
| Tasks       | organizer note, suggested due date            | ID, owner, approval state, submitted asset, audit fields          |

Changing a protected field in Airtable would cause an outbound repair. A safe editable field that
only changed in Airtable would become a proposed ProgramKit operation. If the same field changed
differently on both sides, neither value would win: the integration would record a conflict with the
baseline and both candidate values.

Deletes would never cascade. Deleting an Airtable row would create an archive proposal or cause the
mirror to restore the row, depending on policy. ProgramKit would not hard-delete a submission,
speaker, session, or task because a row disappeared from a third-party view.

## Proposed delivery and loop prevention

None of this transport exists. In the design, the Cloudflare host would own credentials, Airtable
webhooks or cursor polling, batching, retry policy, and the durable outbox. Every job would carry an
origin, workspace key, record ID, source revision, and idempotency key. When an inbound edit was
applied, the resulting ProgramKit event would keep its Airtable origin so the exporter could
acknowledge the new revision without bouncing the same edit forever.

No external request would run inside the Durable Object state transaction. The transaction would
commit the domain change and outbox intent together; a Queue consumer or object alarm would perform
the Airtable request afterward. If an Airtable panel is ever added to the integrations screen, it
must show the real last success, cursor lag, pending conflict count, attempts, and latest error —
today there is no such panel because there is nothing to report.

## Proposed installation policy

Airtable cannot be installed or enabled today; there is no base ID input, no credential binding, and
no consumer to receive one. The design's intent is that the default quick start and production
deployment would still not require Airtable. An operator would opt in by providing one base ID, a
scoped personal access token through Worker secrets, and an explicit field policy, and ProgramKit
would ship one versioned base template rather than asking each installation to invent table names
and protected columns.

Written down this way, the project keeps one simple deployment path — Durable Object SQLite is and
stays authoritative — while leaving room for a well-behaved Airtable bonus later. Until that work is
built, teams cannot work in Airtable through ProgramKit.
