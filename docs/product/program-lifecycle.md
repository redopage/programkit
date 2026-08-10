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

## 3. Review consistently

Evaluation plans define criteria, reviewer teams, blind-review policy, and assignment behavior.
Reviewers receive scoped queues and can read only assigned proposals. Blind plans redact answers
that reveal submitter identity. Scorecards validate every criterion before submission.

The committee view aggregates progress and recommendations; it does not replace the underlying
scorecards or silently decide on their behalf.

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

Organizers can also publish event guides, related links, and sandboxed HTTPS embeds into every
speaker portal. Draft and archived resources remain operator-only.

Profiles, releases, headshots, slides, and logistics use the same scoped operation and asset
primitives as the CFP.

## 6. Build and publish the schedule

Sessions are content; placements are mutable draft room/time assignments. Conflict checks run
against the draft. Publishing creates an immutable, versioned `ScheduleRelease` snapshot.

The public agenda reads only the latest release. Moving a draft session after publication cannot
quietly rewrite what attendees already saw; another explicit publication is required.

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
