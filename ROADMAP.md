# Product status and roadmap

ProgramKit is building one dependable conference-program lifecycle, not a general CRM or a clone
of every enterprise event product.

```text
Publish CFP → receive proposal → review → decide → onboard speaker → schedule → publish program
```

Communications and readiness span that lifecycle. The seeded AIE NYC workspace proves the whole
spine, but a visible screen is not automatically a production-complete capability. This document
is the source of truth for that distinction.

## Current capability map

| Workflow           | Trustworthy today                                                                                                                                                                                                                                                                                                                    | Still needed for production depth                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Event setup        | Active-event identity, slug, venue, city, dates, timezone, lifecycle status, version checks and schedule-boundary validation                                                                                                                                                                                                         | Multi-event switching, administrator membership, branding and public theme controls                                 |
| CFP                | Multiple event forms, editable public content, ordered fields, choice options, required fields, explicit speaker/session data mappings, shared publish readiness, conditional visibility, track/category routing into accepted sessions, draft preview, public submission, frozen confirmation receipts, and truthful delivery state | File restrictions, richer validation rules, published-version comparison and branch-coverage tests                  |
| Review             | Reviewer teams, ordered assignment rounds, guarded and idempotent round advancement, scoped reviewer projection, scorecards, blind-review redaction, active-round summaries, final-round acceptance policy, audit evidence, and accepted-record conversion                                                                           | Conflict-of-interest declarations, saved committee filters, assignment balancing controls                           |
| Speaker onboarding | Scoped participant projection, profile editing, typed text/form/file requirement submission, private R2 uploads and downloads, due dates, organizer review states, published guides, and sandboxed static HTML cards                                                                                                                 | Shared cross-surface task renderer, release documents, revision conversations, logistics templates, upload scanning |
| Communications     | Accepted-speaker template, audience preview, approval, frozen personalized messages, truthful recipient outbox, provider-result recording, calendar downloads, and submission-receipt outbox                                                                                                                                         | Provider activation, test sends, scheduling, retry controls, and richer attempt history                             |
| Scheduling         | Draft placements, unscheduled tray, timezone-safe place/move forms, accessible drag-and-drop, safe undo, day/room/track filters, conflict previews, full draft-versus-published preflight, immutable releases, public projection                                                                                                     | Reusable time-block templates, travel/buffer constraints, track locking, and richer collaborative draft history     |
| Readiness          | Participant matrix, due dates in the domain, blocker counts, submitted-item approval, speaker detail                                                                                                                                                                                                                                 | Overdue explanations, saved filters, bulk reminders/approval and communication history                              |
| Integrations       | Versioned API/export, Accelevents published-program mapping preflight, frozen per-item outbox, provider result/retry evidence, and conflict-aware Airtable reconciliation primitive                                                                                                                                                  | Accelevents credentialed consumer and provider smoke test; Airtable runtime delivery and cursor UI                  |
| Public program     | Immutable agenda, read-only public projection, embeddable mobile speaker gallery, and private-on-device itinerary                                                                                                                                                                                                                    | Host-site theme controls, richer session detail, and production embed/CSP smoke tests                               |

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
- SQLite-backed Durable Object persistence for the supported Cloudflare host and a testable atomic
  repository contract in core.
- Event-scoped, paginated read APIs for sessions, speakers, and submissions, with named operations
  as the single write path.
- An explicit storage decision: Durable Objects are authoritative; D1 and Airtable are downstream
  projections for different use cases.

The reference host still uses passwordless, path-derived demo actors. These projections reduce
data exposure and enforce capability shape, but they do not replace real authentication or tenant
membership. See [Security](SECURITY.md).

## Convergence milestones

### 1. Finish shared form primitives

- Extract the public renderer and organizer field editor into shared form modules.
- Add task-form definitions and submitted answers without conflating task and CFP lifecycles.
- Add validation schemas, file rules and exhaustive conditional-branch tests.
- Add explicit published-version comparison.

### 2. Add one real asset pipeline

- Done: define asset metadata, owner-scoped validation, and a named file-submission operation in
  core.
- Done: implement private R2 storage, participant-owned upload, private download authorization, and
  type/size validation in `apps/cloudflare`.
- Next: replace the passwordless demo actor with authenticated upload initiation and add progress,
  retry, cancellation, replace/remove, scanning, and lifecycle cleanup.
- Use the same asset UI for proposal files, video, headshots and slides.

### 3. Turn requirements into assigned work

- Done: render text, file, and simple form requirements in the speaker portal and preserve explicit
  server-backed review states.
- Done: persist submitted values and private asset references through named core operations.
- Next: render release/approval tasks only when an actual document and response contract exist.
- Show organizer review, revision reasons, due/overdue state and direct task links.

### 4. Complete two communication automations

- Done: accepted-speaker template, confirmed-speaker audience, field rendering, recipient preview,
  suppression safeguards, durable recipient jobs, provider-result recording, and RFC 5545 calendar
  attachment/download.
- Done: freeze one submitter-owned confirmation receipt during proposal submission, surface its
  truthful outbox state to submitters and organizers, and record trusted provider outcomes.
- Next: add operator-triggered test delivery and connect the retrying Cloudflare Email Service
  consumer after sender-domain verification.

Provider calls must run only after the outbox commit. Domain events already preserve queue and
provider-result history; a richer per-message attempt timeline remains production depth.

### 5. Finish the scheduling studio

- Done: add an unscheduled-session tray and day/room/track filters.
- Done: add safe last-change undo and a publication preflight with draft-versus-published evidence.
- Next: add reusable time-block templates, travel/buffer constraints, track locking, and richer
  collaborative draft history when pilot evidence requires them.

### 6. Polish the operating queue

- Explain every blocker in plain language.
- Add saved readiness filters and safe bulk actions.
- Deep-link every work item and proposed change.
- Add hibernating workspace WebSockets for revision invalidation and durable in-app notifications.

### 7. Add the Airtable team mirror

- Provide a documented base template for submissions, speakers, sessions, and tasks.
- Batch-upsert by stable ProgramKit ID from the delivery outbox with backoff and a durable cursor.
- Accept only allowlisted inbound edits and route them through named operations or human-approved
  change sets.
- Use the tested three-way comparison to surface concurrent field edits without choosing a winner.
- Show real last-success, lag, attempt, conflict, and error state on the integrations screen.

### 8. Complete the Accelevents provider boundary

- Done: map only the latest immutable schedule release into stable speaker and session records.
- Done: freeze versioned per-item delivery state with provider IDs, failure evidence, and retries.
- Done: expose the preflight, mapping, packet status, and honest credential boundary to operators.
- Next: connect the owner-managed Enterprise API key in a Cloudflare consumer and retain a
  provider-confirmed smoke-test receipt.

### 9. Publish speaker resources and public embeds

- Done: versioned guide and static HTML-card records with a staff-only save operation.
- Done: participant projection includes only published resources for the matching event.
- Done: HTML cards reject attributes and active content, then render in a scriptless sandbox.
- Done: mobile speaker-gallery and itinerary routes read only the public immutable release; saved
  itinerary choices remain on the attendee's device.
- Next: verify embedding from the final host's Content Security Policy and add theme controls only
  if pilot evidence requires them.

### 10. Make review rounds operable

- Done: seed an ordered committee and finalist review plan with explicit completion thresholds.
- Done: advance eligible proposals through a staff-scoped, version-checked, idempotent operation
  that creates the next assignments once and emits domain evidence.
- Done: summarize the active round, expose round progress to operators, and keep acceptance hidden
  until finalist scorecards are complete.
- Next: add conflict-of-interest declarations and assignment balancing only after real committee
  policy is available.

## Deliberate non-goals for the golden path

- Payments and ticketing
- Marketing automation or a generalized CRM
- Multilingual content management
- Enterprise awards, digital posters, or attendee networking
- A maintained Vercel, Node, or general deployment-adapter matrix
- Airtable as the live application database or last-write-wins two-way sync
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
