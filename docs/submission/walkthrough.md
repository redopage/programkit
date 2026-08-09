# Judge walkthrough — 8 to 10 minutes

The walkthrough should feel like one program director moving an event from intake to a published,
attendee-ready program. Do not narrate a feature inventory. Show a decision, its evidence, and the
next downstream consequence.

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

> ProgramKit is an open-source conference-program toolkit. It gives a small team one dependable
> workflow from call for proposals to a published agenda, with the same scoped operations and audit
> rules behind the human UI, API, and agent surface.

Point out the current work queue. Briefly say the reference app uses deterministic demo identities,
then move on.

### 0:40–1:35 — Conditional CFP and routing

Open `/forms`, select the public CFP, and switch the session format between Talk and Workshop in the
preview. Show the workshop-only plan question. Open `/submit/aie-nyc-2026-cfp`, then return to
`/submissions`.

> The form owns explicit mappings for speaker identity, session content, format, and track. The same
> conditional rules validate the public response. When an accepted proposal becomes a session, its
> selected track is the category-routing contract—not a later manual copy.

### 1:35–3:05 — Multi-round review to accepted session

Open `/reviews`. On “The boring parts of trustworthy agents,” click **Advance to Finalist review**.
Call out that the button exists only because the committee round has two completed reviews. Show the
new finalist assignments and the round totals.

Open `/reviewer/rev_002`, choose the finalist assignment, leave a short note, and submit. Repeat in
`/reviewer/rev_001`. Return to `/submissions`, open the proposal, show the two finalist scorecards,
and accept it.

> Advancement is a staff-scoped, versioned, idempotent operation. Acceptance stays unavailable
> until the final threshold is met. One accepted decision atomically creates or reuses the person,
> participation, readiness work, and session.

### 3:05–4:05 — Speaker portal and readiness

Open `/portal/par_003`. Show the public-profile editor, confirmation, outstanding tasks, an allowed
file, and published resources. Then open `/readiness` and the same speaker.

> The participant sees only their event-scoped record and private assets. Organizers see the
> readiness consequence without giving the portal access to internal notes or anyone else's files.

### 4:05–5:00 — Communications and calendar

Open `/communications`. Preview the accepted-speaker reminder, show one personalized recipient,
submit and approve the campaign, then inspect the frozen outbox. Download the calendar invite.

> Sending records durable recipient intent before any provider call. The demo truthfully says
> pending provider; it never turns a queued message into a fake success. The RFC 5545 invite opens
> in Gmail, Outlook, and iCal-compatible clients.

### 5:00–6:35 — Schedule, conflict, undo, and immutable publish

Open `/schedule`. Show the unscheduled tray and filters. Place or drag a session into a deliberate
conflict, show the explanation, fix it, and use undo. Open the publish preflight and publish only a
valid changed draft. Switch to `/agenda`.

> Draft edits stay private. Publication rejects missing sessions, hard conflicts, duplicates, empty
> schedules, and unchanged drafts. The public agenda reads only the new immutable release.

### 6:35–7:30 — Accelevents with real retry evidence

Open `/integrations`. Inspect the Accelevents preflight, stage the latest release, expand a speaker
and session item, record a provider failure, then retry and show the attempt history.

> The packet uses stable keys and only the latest published release. Credentials remain in the
> owner-managed provider boundary. Staging a packet is not described as delivery.

### 7:30–8:45 — Resources and attendee embeds

Open `/resources`. Show a guide, the restricted static HTML contract, and the unsafe-content error.
Open the published card in `/portal/par_003`. Switch to a 375px viewport for `/embed/speakers` and
search for Jordan. Open `/embed/itinerary`, save two sessions, reload, and show **My itinerary**.

> Public embeds receive only the immutable public program. The itinerary stays on this device; it
> does not create an attendee tracking record.

### 8:45–9:30 — Architecture, API, and honest close

Return to `/` or the repository README.

> ProgramKit ships three publishable packages—core, web, and agent—inside one supported Cloudflare
> Worker assembly with Durable Object state and private R2 files. The API exposes scoped reads,
> named writes, an operation manifest, health, calendar, and logical export. We deliberately did not
> claim unfinished Airtable runtime sync, production identity, or provider activation. The result is
> a smaller product whose demonstrated path is inspectable and dependable.

End on the public repository URL and `programkit.dev`.

## Recording acceptance criteria

- Total duration is between 8:00 and 10:00.
- Every required competition row is visible or explicitly connected to a visible consequence.
- At least one validation failure, one retry, and one cross-surface state transition are shown.
- No personal data, credentials, private browser chrome, or local filesystem paths appear.
- No statement contradicts `ROADMAP.md`, `SECURITY.md`, or the [evidence matrix](evidence-matrix.md).
