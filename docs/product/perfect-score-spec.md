# Perfect-score specification

Companion to [competition-endgame.md](competition-endgame.md). That document says where we are;
this one defines, item by item, what a **full-credit** result looks like for all 96 rubric items
(178 required points + 19 extra credit) and what has to exist for the evaluator to observe it.

## How the evaluation actually runs — four facts that change everything

Read `killmysaas-evals` closely and the picture is different from "point the agent at our demo":

1. **The evaluator builds its own event.** Scenario CFP-S1 signs up as organizer **Jordan
   Alvarez**, creates **DevFlow Conf 2027** (2027-05-12 → 05-14, Moscone West SF), configures
   three tracks, five session formats, and four rooms, and builds the CFP form itself. Our seeded
   AIE NYC workspace is _not_ what gets scored. **Every capability must work from an empty
   workspace through the UI.** A seed-only feature scores zero.

2. **All personas use email + password.** The fixtures carry passwords
   (`SbekTest!2027-org/spk/spk2/rev`), every scenario can read those fixture values, and the brief
   is explicit: _the agent has no inbox_. The accounts are not pre-created for us. Magic links
   score only through a painful manual side
   channel. Perfect score requires **open email+password signup and sign-in for organizer,
   speaker, reviewer, and attendee — on one origin.** Priya's CFP submitter account and her
   speaker-portal account are the _same account_, linked by email when the organizer rosters her.

3. **Scenarios chain on one deployment.** Area 01 closes the CFP; area 02 reopens it. Area 01
   rejects a talk; area 05 flips it to Accepted so it can be scheduled. Area 04 renames a session
   and reverts it. State transitions must be freely reversible by the organizer, and nothing may
   hard-lock.

4. **"Manual verification" items are graded by a human afterwards — and an in-app outbox
   passes.** CFP-08 says verbatim: _"if the clone exposes an in-app email log/outbox, a logged
   message with correct recipient and title also passes."_ A visible **Email log / Outbox page**
   plus real delivery via a provider converts nearly every side-effect item from unverifiable to
   full credit.

Also structural: the agent is a Playwright browser with ~70 turns per scenario. It finds features
by trying conventional names (`/admin`, `/dashboard`, "Speakers", "Tasks", "Import", "Publish").
Discoverability is scored de facto: a working feature the agent cannot find in three clicks is a
zero with a screenshot of our navigation attached.

---

## Platform prerequisites (blockers for more than one area)

| #   | Prerequisite                          | Perfect-score definition                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | **Password identity**                 | Open signup + sign-in with email/password for all four personas on the submission origin. Role routing: organizer signup → workspace + event creation; speaker signup from the public CFP → submitter/speaker account; reviewer is provisioned by the organizer **with a password set directly in the UI or a copyable on-screen invite link** (CFP-10 requires "usable credentials" without email). `/admin`, `/dashboard`, `/organizer`, `/login` all resolve. |
| P2  | **Event + inventory creation**        | Create event with name, dates (→ 3 days), venue/city; manage tracks, session formats (the five fixture labels are formats, a first-class concept we don't have), and rooms from the UI, usable immediately after creation.                                                                                                                                                                                                                                       |
| P3  | **Real mail + visible outbox**        | One provider (Resend or Cloudflare Email) sending to arbitrary real inboxes, behind a transactional outbox. An organizer-visible **Communications history / Email log** listing every message: recipient, subject, body, timestamp, trigger (manual/automated). Merge tokens (`{speaker_name}`, `{talk_title}`, portal link) with per-recipient resolved preview.                                                                                                |
| P4  | **File pipeline on R2**               | Upload with visible constraints (accepted types + max size), versions (latest flagged, old versions individually accessible), per-file comment threads with author+timestamp, private authorized download, central files library, multi-select ZIP of latest versions with grouping options. One shared component reused everywhere a file appears.                                                                                                              |
| P5  | **Session CRUD + approval + history** | Create/edit sessions (title, abstract, speakers, track, format, room, time); per-session content-approval status gating public output; field-level change history with editor attribution, timestamps, and restore.                                                                                                                                                                                                                                              |
| P6  | **Scheduled jobs**                    | **Have:** per-event Durable Object alarms schedule automatic due-date reminders, queue one personalized message per reached window, skip completed work, deliver through Cloudflare Email, retry failures, and persist delivery history. A controlled live-inbox acceptance run remains.                                                                                                                                                                         |
| P7  | **Robot ergonomics**                  | Every drag interaction has a click equivalent; result counts rendered; statuses as text labels not just color; toasts persist ≥ a few seconds; no feature behind hover-only affordances.                                                                                                                                                                                                                                                                         |

---

## Area 01 — Call for Papers (20/20)

Strong base: builder, conditional fields, public form, organizer round-trip all exist. Perfect
requires the submitter side and the window rules.

| Item       | Full credit means                                                                                                             | Build                                                                     |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| CFP-01 (3) | Add text/long-text/dropdown fields with required flags; they render publicly; empty-required blocked with visible error       | **Have.** Verify error styling is unmissable in screenshots               |
| CFP-02 (1) | "Workshop prerequisites" toggles with format selection, both directions, no reload                                            | **Have.** Ensure format is a form field the builder can key conditions on |
| CFP-03 (3) | Portal logged-out shows event name, **visible deadline**, track+format dropdowns with exact fixture options                   | Add deadline display to public form header                                |
| CFP-04 (2) | Close date in past ⇒ public portal shows closed state, no way to start                                                        | Enforce window server-side + closed-state page                            |
| CFP-05 (3) | Speaker creates account from portal, submits, sees confirmation, finds proposal in **"My submissions" dashboard with status** | P1 + submitter dashboard (new view)                                       |
| CFP-06 (3) | Organizer list + detail shows title, abstract, track, format, audience level, custom fields verbatim                          | **Have.** Confirm custom-field values render in detail                    |
| CFP-07 (1) | Save draft with only a title; resume prompt or pre-filled on return                                                           | Have draft save; add resume-on-return for a signed-in submitter           |
| CFP-08 (1) | Confirmation email logged in outbox with recipient + title (in-app log passes explicitly)                                     | P3 + auto-send on submit                                                  |
| CFP-09 (2) | Speaker edits open submission; edit persists and is what organizer sees                                                       | Submitter edit flow (currently no edit after submit)                      |
| CFP-10 (2) | Reviewer provisioned with usable credentials; reviewer dashboard shows **no admin nav**                                       | P1 reviewer provisioning + strip Shell nav for reviewer role              |
| CFP-11 (2) | Rating 4 + comment persist; reviewer dashboard flips to completed; organizer sees both                                        | **Mostly have.** Verify organizer surfacing of scorecard content          |
| CFP-12 (3) | Accept + Reject recorded; distinct statuses in list                                                                           | **Have**                                                                  |
| CFP-13 (2) | Priya's dashboard shows Accepted / Rejected per proposal                                                                      | Submitter dashboard reflects decisions                                    |
| CFP-14 (2) | Notify action with accept/reject templates + merge fields; UI confirms sent/queued; log entries                               | P3 + decision-notification flow using fixture template                    |
| CFP-15 (2) | Accepted proposal becomes session with title/speaker/track carried, zero re-typing                                            | **Have** (verify from agent-created event, not seed)                      |
| CFP-16 (2) | After close, speaker's submission is read-only; no edit can be saved                                                          | Server-side lock + read-only UI state                                     |

## Area 02 — Abstract Management (20/20)

The domain model (plans, rounds, teams, blind review) exists with almost no administration UI.
This area is mostly **new organizer surfaces over existing domain concepts**.

| Item       | Full credit means                                                                                                                                                     | Build                                                                                                                                        |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| ABS-01 (3) | Two rounds, each with own name, open/close dates, scorecard; persists across reload                                                                                   | Round editor UI                                                                                                                              |
| ABS-02 (2) | Reviewer pools attached **per round**, not globally                                                                                                                   | Pool management per round                                                                                                                    |
| ABS-03 (3) | Scorecard editor builds numeric (1–5, 1–10), dropdown (Accept/Maybe/Reject), free-text; all three render reviewer-side and store values                               | Scorecard field editor + dynamic reviewer form                                                                                               |
| ABS-04 (1) | Per-criterion weights persist; displayed aggregate matches weighted math (≈3.33 not 3.0) or is labeled "weighted"                                                     | Weight input + weighted aggregate in results                                                                                                 |
| ABS-05 (3) | Sam's queue lists exactly the two assigned, not "Docs That Answer Back"                                                                                               | Assignment UI (domain supports it) + strict queue projection                                                                                 |
| ABS-06 (2) | At least one of: per-reviewer cap, auto-distribute, track-filtered bulk assignment — exercised without error                                                          | Build **auto-distribute + track filter** (two of three, cheap once assignment UI exists)                                                     |
| ABS-07 (2) | Blind round: reviewer view contains none of "Priya Raman", "Marcus Okafor", "Latticework Systems" — the agent greps the whole page; organizer view shows them         | Extend redaction to co-authors, company, avatar initials, email; audit every string on the reviewer page                                     |
| ABS-08 (2) | Progress dashboard: 2 assigned/0 complete → 2/2 after submissions                                                                                                     | Progress view over live scorecard state                                                                                                      |
| ABS-09 (1) | Select lagging reviewer, send reminder, success confirmation                                                                                                          | P3 + reminder action on progress view                                                                                                        |
| ABS-10 (3) | Aggregate per submission in a results table, sortable **both directions**, values consistent                                                                          | Results table with sort toggle                                                                                                               |
| ABS-11 (2) | Co-author with role label visible speaker-side and in organizer review views                                                                                          | Co-author capture on submission + display both sides                                                                                         |
| ABS-12 (1) | Declare-conflict/recuse control in the reviewer scoring view; flags or removes the item                                                                               | Recusal operation + control                                                                                                                  |
| ABS-13 (2) | Score export triggers a CSV whose rows match the on-screen table (manual half opens the file)                                                                         | CSV export endpoint with title, per-criterion, aggregate, recommendation, status                                                             |
| ABS-14 (1) | AI review: numeric score + rationale that references the abstract's actual content (CI/builds/monorepo), visually distinct from human scores, human override persists | Workers AI / Claude call producing a stored AI scorecard + override flow. Judged only if we claim AI — we should claim it and do it properly |

## Area 03 — Speaker Management (15/15)

| Item       | Full credit means                                                                                              | Build                                                                                              |
| ---------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| SPK-01 (3) | Roster with name + title/company; search narrows and clears                                                    | **Have** (verify title/company columns visible)                                                    |
| SPK-02 (3) | Add-speaker form: name, email, title, company, bio; sentinel bio edit survives reload                          | **Have** (verify all fields present in add form)                                                   |
| SPK-03 (2) | speakers.csv imports; Dana Kowalski appears; dedupe of Priya/Marcus acceptable                                 | CSV import with column mapping + email dedupe                                                      |
| SPK-04 (2) | Status change persists; status filter narrows                                                                  | Participation status control + roster filter (domain has status)                                   |
| SPK-05 (2) | Create 3 general tasks with due dates assigned to **both** speakers via multi-select                           | Requirement-definition create UI with multi-assign                                                 |
| SPK-06 (2) | Portal-invite control per speaker; success state; entry in comms history                                       | P3 + invite send (contains portal link)                                                            |
| SPK-07 (3) | Priya's login lands in a speaker portal with only her data; Marcus/Dana absent everywhere                      | P1 + portal scoped by session (not URL param)                                                      |
| SPK-08 (3) | Portal saves sentinel bio + headshot.png; organizer record shows both                                          | P4 headshot upload in portal profile                                                               |
| SPK-09 (2) | Three tasks with due dates in portal; two completed persist; one stays open                                    | **Mostly have** (requirement.set-status) — verify due dates render portal-side                     |
| SPK-10 (2) | Headshot listed organizer-side with filename + uploader/timestamp; download works                              | P4 file listing on speaker record                                                                  |
| SPK-11 (2) | Session link visible on organizer speaker record **and** inside portal                                         | Portal "My sessions" section (verify) + record link                                                |
| SPK-12 (2) | List-level matrix: Priya 2 complete/1 open, Marcus 0 — visible without opening records; filters narrow         | Readiness matrix (have) + complete/incomplete filters                                              |
| SPK-13 (2) | Bulk email to all speakers with fixture subject; success; history entry with recipients + timestamp            | P3 bulk compose from roster                                                                        |
| SPK-14 (1) | Template with tokens + per-recipient preview resolving to "Priya"                                              | P3 merge preview                                                                                   |
| SPK-15 (1) | Travel/logistics or generic custom field persists the sample text                                              | Custom field on person record                                                                      |
| SPK-16 (1) | Unattended reminder email for an incomplete task near/past due, referencing task + due date, logged in history | **Have:** P6 event alarm + durable reminder job; run the live-inbox acceptance case before grading |

## Area 04 — Content Management (15/15)

Almost entirely new; every item flows from P4 + P5.

| Item       | Full credit means                                                                                                                    | Build                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| CNT-01 (3) | File-request task type with **instructions** + due date, assigned to speakers                                                        | Extend requirement definitions with type=file + instructions                      |
| CNT-02 (3) | Portal shows both tasks; slides.pdf upload attaches to task; status flips to uploaded                                                | P4 upload against requirement                                                     |
| CNT-03 (3) | No Marcus data in Priya's portal; `/admin`-style routes denied for speaker session                                                   | P1 role guards on operator routes                                                 |
| CNT-04 (2) | Second upload creates v2; latest flagged; v1 still individually viewable                                                             | P4 version chain                                                                  |
| CNT-05 (2) | Speaker comment (name + timestamp) visible to organizer; organizer reply lands in same thread                                        | P4 comment thread                                                                 |
| CNT-06 (1) | Constraint statement visible at upload point ("PDF/PNG up to 25 MB")                                                                 | P4 constraint display                                                             |
| CNT-07 (3) | Dashboard: all speaker×task pairs with due dates; reflects S2 state; filter changes visible set                                      | Deliverables view (extend readiness)                                              |
| CNT-08 (2) | Bulk reminder from the dashboard's incomplete set + send confirmation; manual: real emails naming the outstanding task + due date    | P3                                                                                |
| CNT-09 (2) | Session title/abstract edits persist across navigation; list shows new title                                                         | P5                                                                                |
| CNT-10 (2) | Organizer edits Priya's bio + replaces headshot from admin; persists                                                                 | P5 + P4                                                                           |
| CNT-11 (2) | History: ≥2 timestamped entries attributed to Jordan; restore drops 2nd edit, keeps 1st                                              | P5 field-history with restore — **restore must be per-version, not blanket undo** |
| CNT-12 (3) | Approval status control on sessions; public agenda shows approved (with updated title), omits unapproved                             | P5 gate wired into the public projection                                          |
| CNT-13 (1) | Files library: slides.pdf with session, speaker, date, version count 2; per-session Files tab                                        | P4 library view                                                                   |
| CNT-14 (2) | Multi-select → ZIP with grouping option + deselect; generation confirmation; manual: ZIP has only latest versions, grouped as chosen | P4 ZIP (have `createStoredZip` primitive already)                                 |

## Area 05 — AI Agenda (10/10)

| Item       | Full credit means                                                                     | Build                                                                                    |
| ---------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AIA-01 (3) | Builder shows time axis + room/track structure + **day navigation across three days** | Multi-day studio: day tabs + room-column grid (current view is a single-day list)        |
| AIA-02 (2) | Rooms and tracks created in UI become immediately schedulable                         | P2 inventory UI                                                                          |
| AIA-03 (3) | Unscheduled session placed at Day 1 10:00 Room 2A; survives reload                    | Unscheduled tray + click-to-place (move op exists)                                       |
| AIA-04 (3) | Overlapping Priya sessions ⇒ visible warning **naming the speaker or sessions**, live | Have conflict engine — make the badge wording explicit ("Priya Raman is double-booked…") |
| AIA-05 (2) | Same room + time blocked or clearly flagged                                           | Have — verify wording + visibility                                                       |
| AIA-06 (2) | Moves clear conflicts; new positions survive reload                                   | Have — verify live clearing                                                              |
| AIA-07 (2) | Publish reports success; sessions observable on public surface                        | Have                                                                                     |
| AIA-08 (1) | Auto-schedule control places the unscheduled session in one action                    | Deterministic auto-place (first conflict-free slot); label it "Auto-schedule"            |

## Area 06 — Public Widgets (20/20)

Strongest area. Perfect closes eight small deltas:

- **EMB-01**: session cards need speaker **job title + company** and a Show-more description
  expansion. **EMB-02**: search must match speaker names too, and show a result count.
- **EMB-03** full credit needs **Track + Format + Location** facets (room facet missing today).
- **EMB-04/EMB-12**: order directories **alphabetically by surname**; gallery needs a
  missing-photo fallback that degrades gracefully.
- **EMB-05/EMB-08/EMB-13**: detail views must show each session's **title, date/time, and room**;
  agenda detail needs the full start–end range; Back must restore state.
- **EMB-06** full credit prefers a **grid with room columns and a time gutter** — build it once and
  share it with the AIA-01 builder.
- **EMB-09**: itinerary cards must list **every speaker with title and company**.
- **EMB-10/11**: have (localStorage + ICS); add a remove-updates-view check and confirm the ICS
  imports into a real calendar (manual half).
- **EMB-15** full credit needs an **Embeds studio**: widget-type picker covering all five, output
  formats **styled HTML script tag + basic HTML + JSON + XML + iCal**, plus branding/color,
  content-filter, and field-selection options. The manual half pastes the snippet on a foreign
  origin: the script embed must actually render cross-origin (CSP `frame-ancestors`/CORS on the
  data endpoints).
- **EMB-16** — ⚠ **architectural decision.** The manual half edits a session organizer-side and
  expects the public widget to update **without republishing**. Our immutable-release model
  contradicts this. Resolution that keeps both properties: placements stay release-pinned, but
  public surfaces read session/speaker **content** (title, abstract, bio, headshot) live from
  approved records — or content edits auto-refresh the release. Decide before building anything
  else in this area.

## Area 07 — Speaker CRM (19/19 extra credit)

All-new, org-level (outside any event): directory with search + multi-criteria filters (CRM-01/02),
contact profiles with persistent notes + linked-events history (CRM-03), custom-field creation
("Speaker Type" dropdown) or tags (CRM-04), CSV import (CRM-05, reuse SPK-03), same-name duplicate
detection with side-by-side merge (CRM-06), kanban pipeline with ≥4 named stages including
Confirmed/Declined, enroll dialog with score + rationale, drag/move persisting across reload
(CRM-07), card detail with notes + timestamped stage history (CRM-08), saved segments (CRM-09),
add-to-event handoff carrying name/email/company/bio (CRM-10), bulk email with merge preview + log
(CRM-11, reuse P3), and a dashboard with KPI counts consistent with the directory + one analytics
widget with drill-through (CRM-12).

Worth building **only after** every required area above is at full credit — but note it is 19 points
of pure upside on a 178-point required pool, and most of it composes from P3/P4 + the people model.

---

## Evidence and discoverability engineering

The judge is an LLM reading screenshots. Features must _photograph well_:

- Statuses as labeled chips with text ("Accepted", "2 of 2 complete"), never color alone.
- Result counts on every list that can be searched or filtered.
- Deadline, due dates, and timestamps rendered where the rubric expects them.
- Conflict warnings that name the speaker/room in words.
- After every write: a visible confirmation state that survives long enough to screenshot.
- Navigation labels from the agent's search vocabulary: "Speakers", "Tasks", "Reviews",
  "Agenda", "Files", "Communications", "Embeds", "Import", "Publish". Alias redirects for
  `/admin`, `/dashboard`, `/organizer`, `/login`.
- The root URL must present, without scrolling: the public event content and Sign in / Sign up.

## Submission-config strategy

- Submit the app origin (not the marketing site). Provide the pre-seeded organizer credentials in
  `evalconfig` `credentials.organizer` **and** support open signup so either path works.
- The deployment starts effectively empty (the agent builds DevFlow Conf 2027); keep a reset
  mechanism so we can re-run the full 20-scenario chain ourselves before submitting.
- Fill `submissionNotes` with the route map, role model, outbox location, and reset instructions.
- Before submitting: run the eval kit end-to-end at least twice (`npm run eval -- --url …`), fix
  every item where the agent got lost, and keep the best `report.html` as our own evidence.
