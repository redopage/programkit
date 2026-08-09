# Program lifecycle

ProgramKit is built around one conference-program job:

```text
Configure event → publish CFP → receive proposals → review → decide
                → onboard speakers → schedule sessions → publish program
```

Communications, assets, and readiness support that spine. They are not separate marketing or CRM
products.

## People and surfaces

| Person           | Primary surface    | What they need to accomplish                                                                |
| ---------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| Organizer        | Operator workspace | Configure forms, monitor proposals, make decisions, onboard speakers, schedule, and publish |
| Submitter        | Public CFP         | Understand the request, save accurate answers, and submit with confidence                   |
| Reviewer         | Reviewer workspace | See only assigned proposals, evaluate consistently, and submit a scorecard                  |
| Accepted speaker | Speaker portal     | Confirm participation, maintain a profile, and complete required work                       |
| Attendee         | Public program     | Find the released agenda and speaker/session information without seeing draft operations    |

These are separate data projections and operation allowlists, not cosmetic views of one unrestricted
workspace.

## 1. Configure the event and call for proposals

An organizer first defines the active event identity, venue, dates, timezone, and lifecycle status.
Date changes are rejected when they would leave a scheduled session outside the event. They then
define public form content, submission kinds, ordered questions, required answers, choice options,
and simple conditional visibility. A form moves from `draft` to `open` when published and to
`closed` when submissions stop.

The field editor remains structured on purpose. Domain mappings such as email, biography, proposal
title, and abstract let review, acceptance, and speaker onboarding reuse submitted answers safely.
See [Build and publish a CFP](../guides/build-and-publish-a-cfp.md).

## 2. Submit a proposal

The public surface exposes only one open form and its event. A submitter starts a draft, provides
answers and asset references, and submits only after visible required fields validate. Conditional
questions are evaluated from earlier answers.

ProgramKit currently models asset references, but the reference host does not yet provide a real
private upload pipeline. File restrictions, scanning, signed download, and lifecycle policy are a
production milestone, not an implied capability.

Submission also freezes one confirmation receipt in the same atomic mutation. The submitter sees
the destination address, reference, and actual delivery state. The reference app leaves the
receipt in `pending_provider`; it does not claim delivery before a trusted provider result exists.

## 3. Review consistently

Evaluation plans define ordered rounds, criteria, reviewer teams, blind-review policy, and
assignment behavior. Reviewers receive scoped queues and can read only assigned proposals. Blind
plans redact answers that reveal submitter identity. Scorecards validate every criterion before
submission.

The committee view aggregates progress and recommendations by active round. A proposal advances
only after the current round reaches its minimum completed-review threshold; the transition creates
the next round's assignments once, records an audit event, and remains safe to retry with an
idempotency key. Rejection and waitlisting may close a completed earlier round, while acceptance
requires the completed final round. The view does not replace scorecards or silently decide on the
committee's behalf.

## 4. Decide and create the accepted program

An organizer records `accepted`, `rejected`, or `waitlisted`. Acceptance is one atomic domain
transition: ProgramKit reuses or creates the person, creates event participation and requirements,
and creates the session from mapped submission answers. A partial accepted state cannot be saved.

This is why decision behavior belongs in `@programkit/core`, not in a button handler or an agent
prompt.

## 5. Onboard the speaker

The speaker portal is scoped to one participation. The speaker updates public profile information,
confirms participation, and completes assigned requirements. Organizers see readiness across the
event and can review submitted work.

The portal now persists text and simple form responses and sends participant-owned headshots,
slides, and supporting documents through a private R2 upload/download path with type, size, and
ownership checks. Release approval remains deliberately unavailable until the event team provides
an actual document and response contract. The next production-depth milestone is a shared
cross-surface task renderer plus revision conversations, upload scanning, and lifecycle cleanup.

Organizers can also publish versioned guides and static HTML cards. Participants receive only the
published resources for their event. HTML cards accept no attributes, links, images, forms, or
scripts and render in an iframe sandbox, so this capability does not become an arbitrary code path.

## 6. Communicate with accepted speakers

Organizers can start from an accepted-speaker template, target confirmed speakers, preview rendered
recipient fields, and attach the event's RFC 5545 invite for Google Calendar, Outlook, or Apple
Calendar. Approval freezes the submitted recipient set. Queueing creates one durable delivery row
per recipient with the exact rendered message and complete calendar payload, suppresses unavailable
or undeliverable contacts, and keeps the campaign visibly in the outbox until trusted provider
results are recorded. After the transaction commits, the Cloudflare host invokes its Email Service
consumer when the binding and sender exist; provider IDs or concise failures flow back through the
trusted result operation. Failed rows can be queued again without rebuilding content or losing
attempt counts. Sender-domain verification remains release enablement owned outside the repository.

## 7. Build and publish the schedule

Sessions are content; placements are mutable draft room/time assignments. Conflict checks run
against the draft. Ready sessions without a placement stay in an explicit unscheduled tray.
Organizers can place or move them through timezone-safe forms, switch among list, day, week, track,
and room views, filter by day, room, or track, and undo the last accepted change through another
version-checked operation.

The publish preflight compares the draft with the latest release. It blocks duplicate placements,
hard conflicts, unscheduled active sessions, empty schedules, and unchanged releases, while
showing non-blocking capacity warnings and added, moved, or removed sessions. Publishing creates an
immutable, versioned `ScheduleRelease` snapshot.

The public agenda reads only the latest release. Moving a draft session after publication cannot
quietly rewrite what attendees already saw; another explicit publication is required.

## 8. Stage the published program for Accelevents

The Accelevents preflight reads the latest immutable release, resolves its public speakers, rooms,
tracks, and event-local times, and freezes stable speaker and session items into a delivery batch.
Draft placements and operator-only records are excluded. Each item carries its own provider status,
attempt count, provider ID, error, and version so partial failures can be retried without rebuilding
or duplicating the packet.

The reference host never stores an Accelevents API key in workspace state or client code. When the
owner-managed Worker secret exists, the post-commit consumer uses the official authenticated host
API to create or update speakers first, resolve their provider IDs into session relationships, and
then create or update sessions. Each outcome returns through the trusted result operation. Without
the secret, the same packet remains honestly pending.

## 9. Share the public program as embeds

The speaker gallery and itinerary routes use the same public projection as the agenda: only people
and sessions from the latest immutable release are present, with private contact and organizer data
redacted. The itinerary stores an attendee's saved session IDs only in that browser. It performs no
write against the workspace and makes no claim of cross-device sync.

The final host must allow these routes to be framed by the intended event site. A production
Content Security Policy and cross-origin smoke test remain deployment evidence rather than a core
domain concern.

## Cross-cutting rules

- Every mutation uses a named core operation, regardless of whether a human, REST client, or agent
  initiated it.
- Hosts establish trusted identity, workspace membership, and scopes.
- Scoped surfaces receive the minimum projection and operation allowlist they need.
- Expected versions, idempotency, audit events, and atomic repository mutation apply to every host.
- Agents may read, draft, and propose within policy; approval, sending, committing, publication,
  secrets, and destructive changes remain human responsibilities.

For an honest capability-by-capability assessment, use the canonical
[product status and roadmap](../../ROADMAP.md).
