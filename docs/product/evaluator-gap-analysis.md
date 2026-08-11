# Competition evaluator readiness

This is the current capability audit against `killmysaas-evals` commit
`d99935c3e3c6c50c6b9292220260ccfe2df6d6d4`: 96 rubric items across 20 browser
scenarios. It is not a claimed score. The detailed implementation and verification map for each
area lives in [`evals`](evals/README.md).

## Current position

| Area                | Product coverage                                                                | Remaining evidence or risk                                                 |
| ------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Call for Papers     | All 16 browser criteria implemented                                             | Live confirmation and decision-email delivery                              |
| Abstract Management | All applicable criteria implemented; AI evaluation intentionally not advertised | Keep AI claims absent                                                      |
| Speaker Management  | All 16 browser criteria implemented                                             | Live invite, bulk mail, automatic reminder, and calendar-import evidence   |
| Content Management  | All 14 browser criteria implemented                                             | Live reminder delivery and downloaded ZIP inspection                       |
| AI Agenda           | All 8 browser criteria implemented                                              | Full fresh-workspace browser chain and publish evidence                    |
| Public Widgets      | All 16 browser criteria implemented                                             | Cross-origin iframe check and real calendar import                         |
| Speaker CRM         | All 12 optional criteria implemented                                            | Full chained browser evidence after fresh import and second-event creation |

“Implemented” means the product has a real user action, an authorized server transition, persisted
state, and focused automated coverage. It does not replace the evaluator's own screenshots or the
manual mailbox, calendar, download, and cross-origin checks.

## How the evaluator reaches the product

The V1 runner is browser-only, uses strict same-origin navigation, and does not bring usable inbox
credentials. The official evaluation target should therefore be `app.programkit.dev`, where:

- an organizer can create an email/password account without leaving the origin;
- every event is stored in a separate Workspace Durable Object;
- public CFP and agenda links retain validated event context on the same origin;
- submitters create event-scoped accounts and recover only their own proposal destinations;
- reviewer and speaker workspaces use copyable same-origin record capability links; and
- participant sessions never authorize operator endpoints.

The anonymous seven-day demo remains useful for a fast walkthrough, but it is not the proof of
hosted identity or event membership.

## Evidence still required before submission

1. Start with a new organizer account and create the fixture event through the UI.
2. Run all 20 scenarios in order without directly modifying state.
3. Reload after every round-trip action the rubric explicitly checks.
4. Use the same origin for organizer, public, reviewer, speaker, and attendee surfaces.
5. Inspect downloaded CSV, ZIP, and iCal artifacts rather than counting the click alone.
6. Send the required messages to mailboxes we control and record subject, personalization,
   attachment, timestamp, and delivery state.
7. Paste the generated iframe into another origin and verify interactivity and filters.
8. Repeat the entire chain from a second disposable organizer account and retain the stronger
   report. Never reset a collaborator's event in place.

## Product risks outside the score

The evaluator does not score backup policy, account recovery, MFA, abuse controls, malware
scanning, observability, API lifecycle, or Airtable safety. Those still matter for a real product
and remain on the [roadmap](../../ROADMAP.md).

Airtable, Cloudflare, API breadth, Forge hosting, and speed are bonus or product-quality signals,
not replacements for a complete browser workflow. Durable Object SQLite remains the recommended
authoritative store. Airtable stays optional and disconnected during evaluator runs.

## Buyer-brief work outside the V1 rubric

The original brief also asks for one-way Accelevents transfer and speaker resources with trusted
embeds. ProgramKit includes both: a published-program Accelevents export package and organizer-
authored portal resource pages with sandboxed HTTPS embeds.
