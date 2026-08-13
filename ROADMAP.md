# Product status and roadmap

ProgramKit is one focused conference-program system:

```text
Publish CFP → receive proposal → review → decide → onboard speaker → schedule → publish program
```

The current alpha implements that complete spine. This roadmap separates working product from the
remaining work required for a dependable public service. The evaluator evidence is maintained in
[`docs/product/evals`](docs/product/evals/README.md).

## Working product

| Workflow                    | Current capability                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accounts and events         | Email/password and magic-link staff accounts, authenticated password changes, active-session review and revocation, owner/admin/viewer membership, email-bound invitations, revocation, event creation, isolated event switching, and participant accounts that recover only matching submissions, reviews, and speaker portals |
| CFP                         | Multiple forms, mapped speaker and session fields, required and conditional questions, category routing, open/close windows, public draft save/resume/edit/submit, co-speakers, attachments, and decision status                                                                                                                |
| Review                      | Independent rounds, reviewer teams, routed and exact assignments, weighted numeric/select/text scorecards, blind projection, reviewer caps, progress, reminders, recusal, two-way sorting, CSV export, and reversible decisions                                                                                                 |
| Speakers and tasks          | Searchable roster, CSV import and deduplication, lifecycle status, reusable profiles, multi-assignee tasks, due dates, readiness filters, logistics, invitations, private speaker portal, resources, and linked sessions                                                                                                        |
| Files and content           | Private R2 headshots and deliverables, type and size rules, version history, comments, authorized downloads, owner-only version deletion with durable tombstones and retriable R2 cleanup, organizer replacement, files library, selected ZIP export, session editing/history/restore, and approval gating                      |
| Communications              | Templates, merge preview, audience selection, review and approval, frozen recipients, durable outbox records, Cloudflare Email delivery, retry state, history, task reminders, and iCal attachments                                                                                                                             |
| Schedule and public program | Multi-day room grid, session list, unscheduled tray, room/track inventory, conflict naming, accessible move form, drag and drop, auto-place, clear/undo, publish preflight, immutable releases, and five public views with embeds and JSON/XML/iCal feeds                                                                       |
| Speaker CRM                 | Cross-event directory, search and multi-criteria filters, tags, notes, event history, CSV import, duplicate merge, saved dynamic/static segments, six-stage sourcing, event reuse, personalized outreach, and organization analytics                                                                                            |
| API and agents              | Event-scoped copy-once API keys, generated OpenAPI 3.1 contract, documented read endpoints and named writes, logical ZIP/CSV export, optional MCP server, plugin, and operational skills                                                                                                                                        |

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

## Remaining release work

### 1. Prove the hosted journeys

- Run the complete evaluator chain twice against a fresh `app.programkit.dev` account.
- Verify organizer, submitter, reviewer, speaker, and attendee handoffs without leaving the origin.
- Capture live-provider evidence for confirmations, reviewer reminders, speaker invitations, bulk
  mail, scheduled task reminders, and iCal import.
- Add repeatable disposable-account fixture provisioning and a run checklist. Never expose the
  seeded demo reset inside a hosted event.

### 2. Harden identity and operations

- Add account recovery, ownership transfer, and an optional MFA or external OIDC policy.
- Add OAuth for delegated multi-account API and MCP installations; retain scoped API keys for
  owner-managed clients.
- Add edge abuse controls and an operator-visible security event log.
- Document backup, restore, retention, and disaster-recovery drills for event and identity objects.
- Add structured production metrics, tracing, alerting, and a small status/runbook surface.

### 3. Harden files and delivery

- Add malware scanning, orphan cleanup, age-based retention and workspace-offboarding policy,
  legal holds, and R2 usage observability. Explicit owner deletion is implemented.
- Verify sender-domain reputation and bounce handling for the official Cloudflare Email path.
- Add scheduled campaign controls, recipient self-service unsubscribe, and provider
  bounce/complaint ingestion. Manual suppression and safe cancellation before provider delivery are
  implemented.

### 4. Finish the public API contract

- Keep the published generated OpenAPI document synchronized with the canonical operation manifest;
  drift and request examples are validated in CI.
- Add signed webhook subscriptions with retry, replay protection, and delivery history.
- Add cursor-based bulk endpoints only where the browser and integration use cases require them.
- Document API-key rotation and least-privilege recipes for common integrations.

### 5. Make the optional integrations honest

- Keep Airtable disconnected by default.
- Replace synchronous Airtable acknowledgement with a durable outbound mirror and observable retry
  journal before calling it a production team view.
- Convert inbound Airtable edits into proposed named operations with explicit conflict review.
- Validate the existing Accelevents package against a real import, then implement a native one-way
  connector only from an account-supported contract. Prefer the documented source API-key and event
  ID pull shape when Accelevents can register ProgramKit as a source; otherwise require documented
  Enterprise write endpoints from the event owner.

### 6. Final product craft

- Complete keyboard, screen-reader, 320 px, and reduced-motion acceptance passes on every role.
- Add first-run guidance and intentional empty states without turning the product into a tour.
- Keep page copy short, remove redundant labels, and preserve the fast, dense operating surfaces.
- Retake the website screenshots from the final build and keep the capture recipe outside the public
  repository.

## Deliberate non-goals

- Payments and ticketing
- Marketing automation unrelated to the program workflow
- Multilingual authoring in V1
- Awards, digital posters, attendee networking, and other enterprise-suite breadth
- A maintained Vercel, Node, or general deployment-adapter matrix
- Querying Airtable on page load or last-write-wins two-way sync
- Pixel-for-pixel Sessionboard compatibility

## Definition of done

A workflow is complete only when it has a scoped read projection, an authorized idempotent write,
visible validation and retry state, a stable deep link, keyboard and mobile operation, durable audit
evidence, focused ownership tests, and documented production dependencies.

That standard is intentionally stricter than “the screen exists.” ProgramKit should stay small
enough to understand and complete enough to trust.
