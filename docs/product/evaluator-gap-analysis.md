# Competition evaluator readiness

This is the current capability audit against `killmysaas-evals` commit
`2b0f7956ab0c6f4868d41356e495b3a225badaab`: 98 rubric items across 20 browser
scenarios. It is not a claimed score. The detailed implementation and verification map for each
area lives in [`evals`](evals/README.md).

## Current position

| Area                | Product coverage                                                                | Remaining evidence or risk                                                 |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Call for Papers     | All 18 browser criteria implemented                                             | Full fresh-account evaluator replay                                        |
| Abstract Management | All applicable criteria implemented; AI evaluation intentionally not advertised | Keep AI claims absent                                                      |
| Speaker Management  | All 16 browser criteria implemented                                             | Real calendar-import evidence                                              |
| Content Management  | All 14 browser criteria implemented                                             | Full fresh-account evaluator replay                                        |
| AI Agenda           | All 8 browser criteria implemented                                              | Full fresh-account conflict-resolution replay                              |
| Public Widgets      | All 16 browser criteria implemented                                             | Real calendar import                                                       |
| Speaker CRM         | All 12 optional criteria implemented                                            | Full chained browser evidence after fresh import and second-event creation |

“Implemented” means the product has a real user action, an authorized server transition, persisted
state, and focused automated coverage. It does not replace the evaluator's own screenshots or the
manual mailbox, calendar, download, and cross-origin checks.

## Manual browser audit — 11 August 2026

A browser-only evaluator rehearsal at the runner's `1280 × 800` viewport completed the connected
CFP path through organizer setup, public form rendering, speaker draft/resume, two submitted
proposals, exact reviewer assignment, reviewer scoring, organizer review visibility, and acceptance
handoff. No model API or evaluator API was used.

The rehearsal found and fixed two real operator blockers:

- review-round dates are required, but the setup form did not say so; the fields now expose visible
  `Required` labels and stable accessible names;
- a review plan correctly blocks ordinary decisions until its minimum is met, but the operator UI
  did not expose the server's reasoned override for an intentionally unreviewed proposal; the
  submission drawer now offers `Record decision early`, requires a reason, and supports accept,
  waitlist, or decline without weakening the normal review gate.

One deployment-state blocker remains outside the product UI: the default fixture organizer address
already exists on production while its fixture password is no longer valid. A fresh plus-addressed
organizer completed the rehearsal, proving open signup works, but the official evaluator must be
given unused `personaEmails` (preferred) or the stale fixture identities must be cleaned up before
the final run. The two UI fixes also require deployment before they can be scored on production.

## How the evaluator reaches the product

The V1 runner is browser-only, permits the target origin and sibling subdomains of the same site,
and does not bring usable inbox credentials. The official evaluation target should be
`app.programkit.dev`, where:

- an organizer can create an email/password account without leaving the origin;
- every event is stored in a separate Workspace Durable Object;
- public CFP and agenda links retain validated event context on the target site;
- submitters create event-scoped accounts and recover only their own proposal destinations;
- reviewer and speaker workspaces use copyable record capability links on the target site; and
- participant sessions never authorize operator endpoints.

The anonymous seven-day demo remains useful for a fast walkthrough, but it is not the proof of
hosted identity or event membership.

## Evidence still required before submission

1. Start with a new organizer account and create the fixture event through the UI.
2. Run all 20 scenarios in order without directly modifying state.
3. Reload after every round-trip action the rubric explicitly checks.
4. Keep organizer, public, reviewer, speaker, and attendee surfaces on `programkit.dev` or its
   sibling subdomains so the runner's containment policy can follow them.
5. Inspect downloaded CSV, ZIP, and iCal artifacts rather than counting the click alone.
6. Send the required messages to mailboxes we control and record subject, personalization,
   attachment, timestamp, and delivery state.
7. Re-run the generated iframe on another origin after the final freeze and retain a screenshot.
8. Repeat the entire chain from a second disposable organizer account and retain the stronger
   report. Never reset a collaborator's event in place.
9. Set unused `personaEmails` in the evaluator configuration before either run; do not rely on the
   shared placeholder identities in `fixtures/sample-data.json`.

## Product risks outside the score

The evaluator does not score backup policy, account recovery, MFA, abuse controls, malware
scanning, observability, API lifecycle, or Airtable safety. Those still matter for a real product
and remain on the [roadmap](../../ROADMAP.md).

Airtable, Cloudflare, API breadth, Forge hosting, and speed are bonus or product-quality signals,
not replacements for a complete browser workflow. Durable Object SQLite remains the recommended
authoritative store. Airtable stays optional and disconnected during evaluator runs.

## Buyer-brief work outside the V1 rubric

The original brief also asks for a native, one-way Accelevents integration and speaker resources
with trusted embeds. ProgramKit fully implements the resource pages with sandboxed HTTPS embeds.
For Accelevents, it currently provides a reviewable published-program package using the official
speaker and session CSV shapes. That removes re-entry, but it is an import handoff rather than a
native credentialed connector, so the native integration remains the one material brief gap outside
the V1 evaluator.

Do not close that gap by guessing at undocumented Accelevents write endpoints. The supported
Sessionboard integration is configured inside Accelevents with a source API key and event ID, while
Accelevents' public API is an Enterprise feature. The next implementation should be based on a
validated customer account contract: either a ProgramKit source API that Accelevents can pull from,
or documented Accelevents write endpoints supplied by the event owner.
