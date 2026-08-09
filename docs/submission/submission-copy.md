# Submission-form copy

Replace every bracketed field only after the final public links pass from a signed-out browser.

## Project name

ProgramKit

## One-line description

An open-source conference-program toolkit that turns a call for proposals into a reviewed,
speaker-ready, published program through one dependable workflow.

## Short description

ProgramKit gives a small conference team one place to build conditional CFPs, route and review
proposals across multiple rounds, onboard speakers and files, manage readiness and reminders,
schedule without conflicts, publish an immutable agenda, prepare a one-way Accelevents export, and
embed a mobile speaker gallery and private-on-device itinerary.

The core distinction is trustworthiness: browser, API, and agent surfaces use the same scoped,
versioned, idempotent operations and audit trail. Provider queues remain visibly pending until a
trusted result exists, public pages never read draft program data, and participant/reviewer
projections expose only the records they own.

## Why this product should win

Most event tools either stop at a polished mockup or hide operational gaps behind integrations.
ProgramKit focuses on what a program team would actually use: clear next work, safe transitions,
honest delivery state, mobile public surfaces, and evidence that survives a retry or a second
operator. It is intentionally smaller than an event CRM and deeper along the conference-program
spine.

## What to try

1. Change a CFP format and watch the workshop-only question appear.
2. Advance a proposal from committee review to finalist review, submit two scoped scorecards, and
   accept it into the program.
3. Complete a speaker task or private file in the portal and inspect the readiness consequence.
4. Trigger a schedule conflict, fix it, publish, and compare the immutable public agenda.
5. Stage an Accelevents packet, record a failure, and retry without duplicating items.
6. Search the mobile speaker gallery and save a device-local itinerary.

## Technology

- TypeScript and React
- TanStack Router and TanStack Query
- Cloudflare Worker and Static Assets
- SQLite-backed Durable Objects for atomic workspace state
- Private R2 objects for participant-owned files
- Three publishable packages: `@programkit/core`, `@programkit/web`, and `@programkit/agent`
- Apache-2.0 license

## Links

- Live product: `[FINAL HTTPS URL — Andrew]`
- Open-source repository: `[FINAL PUBLIC REPOSITORY URL — Andrew]`
- Walkthrough video: `[FINAL WALKTHROUGH URL]`
- Documentation: `[FINAL REPOSITORY URL]/tree/main/docs`

## Honest limitations

The reference deployment uses deterministic, passwordless demo identities and sample data. It does
not claim production authentication, sender-domain activation, upload scanning, Airtable runtime
sync, or provider credentials. Those host requirements are documented explicitly. Optional AI
review assistance is not simulated.
