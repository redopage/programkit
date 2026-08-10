# Submission-form copy

Replace every bracketed field only after the final public links pass from a signed-out browser.

## Project name

ProgramKit

## One-line description

An open-source toolkit that runs one conference program end to end — from proposals and review
through speaker prep, a published agenda, and attendee embeds.

## Short description

ProgramKit gives a small program team one place to run an event. Conditional CFP forms collect
proposals, and the track chosen on the form is what routes the session later. Multi-round review
moves a proposal from committee to finalists to an accepted session, and that one acceptance also
creates the speaker's participation and readiness work. The speaker gets a portal for their profile,
private files, and outstanding tasks; organizers watch those same tasks clear on a readiness board.
Reminders and calendar invitations are frozen before they are queued. The schedule catches conflicts
before publication, and publishing mints an immutable release that feeds the public agenda, a
one-way Accelevents export, the portal resource library, and a mobile speaker gallery with a
device-local itinerary.

It ships as a single Cloudflare Worker with Durable Object state and private R2 files, and the same
named operations sit behind the browser, the API, and the agent surface, so a run done in the UI can
be replayed through the API against the same audit trail. Provider queues stay visibly pending until
a real result comes back, public pages never read draft program data, and participants and reviewers
see only the records they own.

## Why this product should win

ProgramKit is built around the parts of running a program that usually leak into spreadsheets and
inboxes: who still owes a headshot, which proposal is waiting on a second score, whether the agenda
a speaker saw is the one attendees will get. Each of those has a place in the product, and each
state change leaves evidence a second operator can read a week later. Retrying a queued send or a
staged export resumes the same batch rather than starting a new one, so recovering from a failure
does not cost anyone a duplicate. The scope is deliberately narrow — one conference program, from
call for proposals to published agenda — instead of a general event platform.

## What to try

1. Open the CFP in `/forms`, switch the session format from Talk to Workshop, and watch the
   workshop-only planning question appear. `/submit/aie-nyc-2026-cfp` applies the same rule to a
   public response.
2. In `/reviews`, advance “The boring parts of trustworthy agents” to finalist review, score it from
   `/reviewer/rev_002` and `/reviewer/rev_001`, then accept it in `/submissions` and find the
   session that acceptance created.
3. Complete a task or upload a private file in `/portal/par_003`, and watch the blocker count on
   `/readiness` fall without reloading.
4. Approve a reminder campaign in `/communications`, then read the outbox: each row shows the frozen
   message and calendar attachment it will send and stays pending until a provider result exists.
   Without an activated sender there is no external record to check, and that pending row is the
   honest evidence.
5. In `/schedule`, drag a session into a conflict, read the explanation, undo it, then run the
   publish preflight and compare `/agenda`.
6. In `/integrations`, stage the latest release and inspect the batch: mapped speakers and sessions,
   stable keys, and per-row status. With provider credentials configured the same batch shows
   returned IDs and a retry that reuses them; without credentials it stays staged and pending.
7. Search `/embed/speakers` in a phone-width window, then save two sessions in `/embed/itinerary`
   and reload to see them persist on the device.

## Technology

- TypeScript and React
- TanStack Router and TanStack Query
- One Cloudflare Worker with Static Assets serving the client and API
- SQLite-backed Durable Objects for atomic workspace state
- Private R2 objects for participant-owned files
- Cloudflare Email Service delivery with frozen RFC 5545 attachments
- Native Accelevents speaker/session create-update adapter behind an owner-managed secret
- Three publishable packages: `@programkit/core`, `@programkit/web`, and `@programkit/agent`
- Apache-2.0 license

## Links

- Live product: `[FINAL HTTPS URL — Andrew]`
- Open-source repository: `[FINAL PUBLIC REPOSITORY URL — Andrew]`
- Walkthrough video: `[FINAL WALKTHROUGH URL]`
- Documentation: `[FINAL REPOSITORY URL]/tree/main/docs`

## Honest limitations

The reference deployment runs on deterministic, passwordless demo identities and sample data. It
does not claim production account hardening, sender-domain activation, upload scanning, or provider
credentials; each of those is documented as a host requirement. An experimental Airtable-backed
mode is available for integration testing but remains optional and disconnected during evaluator
runs. Optional AI review assistance is left out rather than simulated.
