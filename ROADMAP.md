# Product status and roadmap

ProgramKit is building one dependable conference-program lifecycle, not a general CRM or a clone
of every enterprise event product.

```text
Publish CFP → receive proposal → review → decide → onboard speaker → schedule → publish program
```

Communications and readiness span that lifecycle. The seeded AIE NYC workspace proves the whole
spine, but a visible screen is not automatically a production-complete capability. This document
is the source of truth for that distinction.

The [competition evaluator gap analysis](docs/product/evaluator-gap-analysis.md) maps the complete
96-item rubric to current evidence and the highest-value missing workflows.

## Current capability map

| Workflow           | Trustworthy today                                                                                                                                                                                                                                                                  | Still needed for production depth                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Event setup        | Passwordless staff sign-in, live event membership, owner/admin/viewer roles, email-bound invitations, immediate revocation, isolated event creation and switching, identity, slug, venue, city, dates, timezone, lifecycle status, version checks and schedule-boundary validation | Account recovery, ownership transfer, onboarding, branding and public theme controls                                 |
| CFP                | Multiple event forms, editable public content, ordered fields, choice options, required fields, explicit speaker/session data mappings, shared publish readiness, conditional visibility, draft preview, event-scoped public links, submission and confirmation state              | File restrictions, richer validation rules, category routing, published-version comparison and branch-coverage tests |
| Review             | Reviewer teams, assignment rounds, scoped reviewer projection, scorecards, blind-review redaction, decision rules, accepted-record conversion                                                                                                                                      | Assignment UI, conflicts of interest, saved committee filters, multi-round release policy                            |
| Speaker onboarding | Scoped participant projection, profile editing, requirements, due dates, organizer review states                                                                                                                                                                                   | Shared task-form renderer, real uploads, revision conversations, logistics and release templates                     |
| Communications     | Draft, audience calculation, approval, frozen recipients, idempotent demo send                                                                                                                                                                                                     | Provider delivery, templates, merge-variable browser, test sends, scheduling, failures and message history           |
| Scheduling         | Draft placements, timezone-safe editing, accessible drag-and-drop over an explicit move form, conflict previews, room/list views, immutable releases, public projection                                                                                                            | Unscheduled tray, undo, day/track filters and fuller publish preflight                                               |
| Readiness          | Participant matrix, due dates in the domain, blocker counts, submitted-item approval, speaker detail                                                                                                                                                                               | Overdue explanations, saved filters, bulk reminders/approval and communication history                               |

## Foundation already in place

- Exactly three publishable packages: `core`, `web`, and `agent`.
- One private Cloudflare composition root under `apps/cloudflare`.
- Named operations with scope checks, expected versions, idempotency, audit events, dry runs, and
  reviewable change sets.
- Separate web projections for operator, public submission, reviewer, speaker, and public program
  surfaces.
- Surface-specific operation allowlists; public and reviewer routes cannot call arbitrary operator
  commands.
- An injected `ProgramKitClient`, with same-origin HTTP as the default implementation.
- Typed, split TanStack routes and TanStack Query server-state lifecycle.
- Stable URL state for form/field selection, proposal selection and filtering, people detail, and
  reviewer assignment selection.
- A testable repository contract, SQLite-backed Durable Object store, and versioned experimental
  Airtable adapter for the supported Cloudflare host.
- Event-scoped, paginated read APIs for sessions, speakers, and submissions, with named operations
  as the single write path.
- An explicit storage decision: one SQLite-backed Durable Object is the recommended V1 store per
  event, Airtable is optional and experimental, and D1 is a future cross-workspace projection.

The hosted app now resolves a verified passwordless staff session, authoritative event membership,
server-owned role scopes, one workspace object per event, and event-scoped public CFP and agenda
links. The anonymous demo still uses capability and path-derived actors so every sample workflow is
easy to inspect. Participant and reviewer identity, account recovery, MCP OAuth, and private file
storage remain before real conference data is appropriate. See
[Security](SECURITY.md).

## Convergence milestones

### 1. Finish shared form primitives

- Extract the public renderer and organizer field editor into shared form modules.
- Add task-form definitions and submitted answers without conflating task and CFP lifecycles.
- Add validation schemas, file rules and exhaustive conditional-branch tests.
- Add explicit published-version comparison.

### 2. Add one real asset pipeline

- Define file metadata and upload lifecycle contracts in core.
- Add authenticated upload initiation, type/size validation, progress, retry, cancellation,
  replace/remove, and private download authorization.
- Implement private R2 storage in `apps/cloudflare`.
- Use the same asset UI for proposal files, video, headshots and slides.

### 3. Turn requirements into assigned work

- Render profile, text, checkbox, file and custom form requirements in the speaker portal.
- Persist submitted values and asset references.
- Show organizer review, revision reasons, due/overdue state and direct task links.

### 4. Complete two communication automations

- Submission confirmation.
- Accepted-speaker reminder with calendar preview.

Both must have recipient preview, suppression handling, test delivery, durable job state, provider
result, and message history before broader automation work. Cloudflare Email Service is the default
provider; provider calls run after a transactional outbox commit.

### 5. Finish the scheduling studio

- Add an unscheduled-session tray and day/room/track filters.
- Add undo and a complete publication preflight with draft-versus-published evidence.

### 6. Polish the operating queue

- Explain every blocker in plain language.
- Add saved readiness filters and safe bulk actions.
- Deep-link every work item and proposed change.
- Add hibernating workspace WebSockets for revision invalidation and durable in-app notifications.

### 7. Make Airtable a safe optional team view

- Done: versioned additive schema for the workspace plus ten native operational tables.
- Done: stable-ID batch upserts, exact reconstruction, record-level deltas, cached reads, and
  Airtable-before-cache acknowledgement.
- Done: OAuth webhook registration, HMAC verification, source filtering, debounce, and renewal
  alarms.
- Move outbound synchronization out of the user request path and persist retryable sync intent.
- Add webhook payload cursors and fetch only affected records instead of a full refresh.
- Add a durable retry journal or alarm for partially completed multi-table writes.
- Route allowlisted inbound edits through named operations or human-approved change sets.
- Use the tested three-way comparison to surface concurrent field edits without choosing a winner.
- Show real last-success, quota, lag, webhook expiry, attempt, conflict, and error state in the web
  application.

## Deliberate non-goals for the golden path

- Payments and ticketing
- Marketing automation or a generalized CRM
- Multilingual content management
- Enterprise awards, digital posters, or attendee networking
- A maintained Vercel, Node, or general deployment-adapter matrix
- Querying Airtable on every page load or unvalidated last-write-wins two-way sync
- Broad MCP expansion before the human workflows are complete
- Pixel-for-pixel Sessionboard compatibility

## Definition of a trustworthy workflow

A workflow is complete only when it has:

1. a scoped read projection;
2. an authorized, idempotent transition;
3. visible validation, loading, failure and success states;
4. a stable deep link to the affected work;
5. keyboard and mobile operation;
6. audit evidence and safe retry behavior;
7. focused tests for ownership, invalid transitions and data exposure; and
8. documented host capabilities required in production.

That definition keeps the project honest: the goal is a small product whose golden path is deeply
reliable, not a large collection of convincing mock screens.
