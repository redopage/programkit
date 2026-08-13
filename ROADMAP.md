# Product status and roadmap

ProgramKit is one focused conference-program system:

```text
Publish CFP → receive proposal → review → decide → onboard speaker → schedule → publish program
```

The current release candidate implements that complete spine. It is ready for evaluation, local
use, and controlled team pilots. Production approval depends on the deployment and data involved;
it is not a second product backlog.

## Working product

| Workflow                    | Current capability                                                                                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accounts and events         | Email/password and magic-link staff accounts, email-based password recovery, active-session review and revocation, owner/admin/viewer membership, email-bound invitations, revocation, event creation, isolated event switching, and participant accounts that recover only matching submissions, reviews, and speaker portals |
| CFP                         | Multiple forms, mapped speaker and session fields, required and conditional questions, category routing, open/close windows, public draft save/resume/edit/submit, co-speakers, attachments, and decision status                                                                                                               |
| Review                      | Independent rounds, reviewer teams, routed and exact assignments, weighted numeric/select/text scorecards, blind projection, reviewer caps, progress, reminders, recusal, two-way sorting, CSV export, and reversible decisions                                                                                                |
| Speakers and tasks          | Searchable roster, CSV import and deduplication, lifecycle status, reusable profiles, multi-assignee tasks, due dates, readiness filters, logistics, invitations, private speaker portal, resources, and linked sessions                                                                                                       |
| Files and content           | Private R2 headshots and deliverables, type and size rules, version history, comments, authorized downloads, owner-only version deletion with durable tombstones and retriable R2 cleanup, organizer replacement, files library, selected ZIP export, session editing/history/restore, and approval gating                     |
| Communications              | Templates, merge preview, audience selection, review and approval, frozen recipients, durable outbox records, Cloudflare Email delivery, retry state, history, task reminders, and iCal attachments                                                                                                                            |
| Schedule and public program | Multi-day room grid, session list, unscheduled tray, room/track inventory, conflict naming, accessible move form, drag and drop, auto-place, clear/undo, publish preflight, immutable releases, and five public views with embeds and JSON/XML/iCal feeds                                                                      |
| Speaker CRM                 | Cross-event directory, search and multi-criteria filters, tags, notes, event history, CSV import, duplicate merge, saved dynamic/static segments, six-stage sourcing, event reuse, personalized outreach, and organization analytics                                                                                           |
| API and agents              | Event-scoped copy-once API keys, generated OpenAPI 3.1 contract, documented read endpoints and named writes, logical ZIP/CSV export, optional MCP server, plugin, and operational skills                                                                                                                                       |

## Architecture that is settled

- Three reusable packages: `core`, `web`, and `agent`.
- One supported Cloudflare assembly under `apps/cloudflare`.
- One authoritative SQLite-backed Workspace Durable Object per event.
- Separate Account and Event Access Durable Objects for identity and membership.
- R2 for private file bytes and event records for metadata.
- Every human, API, and agent write goes through the same named operation engine with authorization,
  idempotency, expected versions, audit events, and dry-run/change-set support.
- Public pages and feeds expose only approved records from the latest immutable schedule release.
- Airtable is optional and experimental. It is not on the recommended request path.
- D1 is reserved for a future rebuildable cross-event projection, not another primary database.

## Release status

| Use                                                | Status            | Go-live requirement                                                                   |
| -------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------- |
| Disposable demo or local evaluation                | Ready             | Sample data only                                                                      |
| Hosted product evaluation                          | Ready             | Fresh account and controlled email addresses                                          |
| Private conference-team pilot                      | Ready with review | Verified email, named owner, external export, and an operator watching the deployment |
| Public event with real participant data            | Operator approval | Complete the deployment-specific launch checklist below                               |
| Regulated, enterprise, or public multi-tenant SaaS | Not claimed       | Separate security, compliance, identity, support, and service-level program           |

## Production acceptance gates

These are deployment controls, not missing conference workflows:

1. **Release acceptance:** run organizer, submitter, reviewer, speaker, file, schedule, and public
   agenda handoffs against the exact deployed revision. Verify the real sender, calendar file, and
   exports the event will use.
2. **Recovery and operations:** store logical event exports and R2 objects outside the runtime,
   rehearse an isolated restore, name the event and technical owners, and configure monitoring,
   alerts, rollback, and incident contacts. Email-based password recovery is included; ownership
   transfer remains an operator-assisted procedure.
3. **Public-input protection:** apply Cloudflare edge abuse controls and retention appropriate to
   the CFP. Use malware scanning or quarantine when accepting untrusted files, and monitor R2
   usage and pending cleanup.
4. **Delivery policy:** verify the sender domain and controlled inbox delivery. Events using bulk
   campaigns must also own unsubscribe, bounce, and complaint handling; installations using only
   transactional mail can keep campaigns disabled.

The executable checklist is [Self-host launch checklist](docs/self-hosting/launch-checklist.md),
with exact recovery boundaries in [Operations](OPERATIONS.md) and security controls in
[Security](SECURITY.md).

## Possible later extensions

These are intentionally outside the release definition until a customer or supported provider
requires them:

- MFA, enterprise SSO, and delegated OAuth for third-party multi-account installations;
- signed outbound webhooks and new bulk endpoints for a demonstrated integration;
- a durable two-way Airtable team view; and
- a native Accelevents connector based on documented, account-supported endpoints.

## Deliberate non-goals

- Payments and ticketing
- Marketing automation unrelated to the program workflow
- Multilingual authoring in V1
- Awards, digital posters, attendee networking, and other enterprise-suite breadth
- A maintained Vercel, Node, or general deployment-adapter matrix
- Querying Airtable on page load or last-write-wins two-way sync
- Pixel-for-pixel Sessionboard compatibility

## Product standard

Released workflows use scoped read projections, authorized idempotent writes, visible validation
and retry state, stable deep links, durable audit evidence, focused ownership tests, and documented
production dependencies. Changes are expected to preserve keyboard and mobile operation.

This is the maintenance bar, not a list of features waiting to be built. ProgramKit should stay
small enough to understand and complete enough to trust.
