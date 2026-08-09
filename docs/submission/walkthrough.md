# Judge walkthrough — 8 to 10 minutes

The walkthrough should feel like one program director moving an event from intake to a published,
attendee-ready program. Do not narrate a feature inventory. Show a decision, the evidence it leaves,
and what it unblocks next.

## Before recording

1. Use the final integrated clean checkout and run `pnpm check`.
2. Reset the deterministic demo from `/integrations`.
3. Open the routes below once so fonts and split bundles are warm.
4. Use a 1440px desktop viewport; keep a 375px window ready for the public embeds.
5. Close developer tools, personal tabs, notifications, and anything containing credentials.
6. Verify the public repo and deployed host in a signed-out browser.
7. Record one clean take; edit only dead time, not failure evidence.

## Script

### 0:00–0:40 — Thesis and operating model

Open `/`.

> ProgramKit is an open-source conference-program toolkit. One small team moves an event from call
> for proposals to a published agenda here, and the same named operations run behind the UI, the
> API, and the agent surface, so every one of them lands in the same audit trail.

Point out the current work queue. Say once that the reference app uses deterministic demo
identities, then move on.

### 0:40–1:35 — Conditional CFP and routing

Open `/forms`, select the public CFP, and switch the session format between Talk and Workshop in the
preview. Show the workshop-only plan question. Open `/submit/aie-nyc-2026-cfp`, then return to
`/submissions`.

> The form maps every answer onto something used later: speaker identity, session content, format,
> and track. The same conditional rule that just revealed this question validates the public
> response. And the track chosen here is what routes the session once the proposal is accepted, so
> nobody retypes it downstream.

### 1:35–3:05 — Multi-round review to accepted session

Open `/reviews`. On “The boring parts of trustworthy agents,” click **Advance to Finalist review**.
Call out that the button exists only because the committee round has two completed reviews. Show the
new finalist assignments and the round totals.

Open `/reviewer/rev_002`, choose the finalist assignment, leave a short note, and submit. Repeat in
`/reviewer/rev_001`. Return to `/submissions`, open the proposal, show the two finalist scorecards,
and accept it.

> Advancing a round is a staff-only move that carries the version it was based on, so a stale tab
> cannot undo a newer decision and a double click cannot open a second round. Acceptance stays
> unavailable until the final round clears its threshold. Then one accept creates the person, their
> participation, their readiness work, and the session together — and that is the speaker we follow
> for the rest of this demo.

### 3:05–4:05 — Speaker portal and readiness

Open `/portal/par_003`. Show the public-profile editor, confirmation, outstanding tasks, an allowed
file, and published resources. Keep `/readiness` visible in a second window, change one task, and
show its blocker count refresh within five seconds without a manual reload. Then open the same
speaker in organizer detail.

> This is one record seen from two sides. The speaker gets their own event-scoped profile and their
> own private files and nothing else. The organizer watches the blocker leave the readiness board
> seconds later, without the portal ever exposing internal notes or another speaker's uploads.

### 4:05–5:00 — Communications and calendar

Open `/communications`. Preview the accepted-speaker reminder, show one personalized recipient,
submit and approve the campaign, then inspect the frozen outbox and attachment. In the controlled
provider workspace, show the returned message ID and the received `.ics`; otherwise leave the row
truthfully pending and name Andrew's sender-activation gate on camera. Download the portable public
calendar preview.

> Approval freezes the audience and the copy, and every recipient becomes a durable row before any
> provider call happens. That is why this screen can say pending provider and mean it — a queued
> message never reports itself as sent. Once the sender is activated, the post-commit Cloudflare
> consumer sends the frozen RFC 5545 file as an attachment, the same file Gmail, Outlook, and
> iCal-compatible clients open, and writes the returned message ID back onto this row.

### 5:00–6:35 — Schedule, conflict, undo, and immutable publish

Open `/schedule`. Switch through Session list, Day, Week, Track, and Room, then show the filters and
unscheduled tray. Place or drag a session into a deliberate conflict, show the explanation, fix it,
and use undo. Open the publish preflight and publish only a valid changed draft. Switch to `/agenda`.

> Everything so far is a private draft; attendees are still reading the previous release. The
> preflight is what stands between the two — it refuses missing sessions, hard conflicts,
> duplicates, an empty schedule, and a draft with nothing new in it. Publishing mints an immutable
> release, and the public agenda reads that release and nothing else.

### 6:35–7:30 — Accelevents with real retry evidence

Use only the controlled Accelevents event Andrew approved for smoke testing. Open `/integrations`,
inspect the preflight, and stage the latest release. Show speakers receiving provider IDs before
related sessions, then show a known ID using update on a later release. If a real provider failure
exists, retry it and show the attempt history; do not manufacture or claim a provider result. If no
Enterprise key is active, show the staged batch and its pending rows instead and say so plainly.

> The packet takes the latest published release rather than the draft, and every row carries a
> stable key, so speakers land before the sessions that reference them and a later release updates
> instead of duplicating. A retry resumes this batch. The Enterprise key stays inside the
> owner-managed secret boundary, and staging a packet is never delivery — the row says only what
> actually happened.

### 7:30–8:45 — Resources and attendee embeds

Open `/resources`. Show a guide, the restricted static HTML contract, and the unsafe-content error.
Open the published card in `/portal/par_003`. Switch to a 375px viewport for `/embed/speakers` and
search for Jordan. Open `/embed/itinerary`, save two sessions, reload, and show **My itinerary**.

> Staff can publish a rich card without handing the portal an execution surface: active or remote
> content is rejected at save time rather than cleaned up on the way out. The embeds receive only
> the immutable public program, and the saved itinerary stays in this device's storage — it creates
> no attendee record on our side.

### 8:45–9:30 — Architecture, API, and honest close

Return to `/` or the repository README.

> All of this is one Cloudflare Worker: the React client, the API, SQLite-backed Durable Object
> state, and private R2 files, factored into three publishable packages — core, web, and agent. The
> API exposes the same scoped reads and named writes you just watched, plus an operation manifest,
> health, calendar, and logical export. What we did not do is claim the unfinished parts: Airtable
> runtime sync, production identity, and provider activation are documented as open rather than
> demonstrated. The trade is a smaller product where the path you just saw is the path that works.

End on the public repository URL and `programkit.dev`.

## Recording acceptance criteria

- Total duration is between 8:00 and 10:00.
- Every required competition row is visible or explicitly connected to a visible consequence.
- At least one validation failure, one retry, and one cross-surface state transition are shown.
- No personal data, credentials, private browser chrome, or local filesystem paths appear.
- No statement contradicts `ROADMAP.md`, `SECURITY.md`, or the [evidence matrix](evidence-matrix.md).
