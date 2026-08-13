window.PROGRAMKIT_EVALS = {
  sourceUrl:
    'https://docs.google.com/document/d/1rBHJtiNKHv4i43tdf2Rm0sDEYuIcajhmAPoBKR_Az-A/edit?tab=t.0#heading=h.oweg08fz1q1z',
  brief: [
    {
      index: 1,
      requirement: 'Custom call-for-speakers forms',
      areas: ['CFP', 'ABS'],
    },
    {
      index: 2,
      requirement: 'Self-service speaker portal',
      areas: ['SPK', 'CNT'],
    },
    {
      index: 3,
      requirement: 'Templated communications, reminders, and calendar delivery',
      areas: ['SPK', 'CNT', 'EMB'],
    },
    {
      index: 4,
      requirement: 'Multi-round evaluation and scoring',
      areas: ['CFP', 'ABS'],
    },
    {
      index: 5,
      requirement: 'Schedule building and conflict detection',
      areas: ['AIA', 'EMB'],
    },
    {
      index: 6,
      requirement: 'Outstanding-speaker readiness dashboard',
      areas: ['SPK', 'CNT'],
    },
    {
      index: 7,
      requirement: 'One-way Accelevents handoff',
      areas: ['Outside V1 evals'],
    },
    {
      index: 8,
      requirement: 'Speaker resource and wiki pages',
      areas: ['SPK', 'CNT'],
    },
    {
      index: 9,
      requirement: 'Embeddable speaker gallery and itinerary',
      areas: ['EMB'],
    },
  ],
  areas: [
    {
      area: 'call-for-papers',
      title: 'Call for Papers',
      prefix: 'CFP',
      areaWeight: 20,
      optional: false,
      overview:
        "SessionBoard's Call for Papers module runs the submission side of the proposal lifecycle end-to-end. Organizers build a custom submission form (multiple field types, required flags, conditional logic keyed to track or session format), set open/close dates, and publish it on a branded public portal. Speakers create submitter accounts, optionally save drafts, submit proposals, receive on-screen and email confirmation, and can view and edit their submissions from a personal dashboard until the close date. Organizers assign committee reviewers, who score assigned submissions (rating plus comment) from an isolated reviewer dashboard; organizers then record accept/reject decisions, dispatch decision notification emails, and hand accepted talks off to the sessions/agenda area without re-entry. Review DEPTH (multi-round review, blind/anonymized review, weighted scorecards, aggregate score tables, bulk reviewer operations, exact reviewer-queue scoping, co-authors) is owned by the abstract-management spec and is deliberately not scored here. Note: a scenario's persona is its STARTING identity — scenarios may sign out and switch identities mid-run; the harness supplies all fixture credentials to every scenario.",
      scenarios: [
        {
          id: 'CFP-S1',
          name: 'Organizer builds and publishes the CFP',
          persona: 'organizer',
          steps: [
            'Navigate to the app root. Find the organizer/admin entry point — try obvious routes (/admin, /dashboard, /organizer) and nav links ("Admin", "Dashboard", "Organizer", "Sign up", "Get started"). If open signup exists, sign up as the organizer identity Jordan Alvarez from the sample data; otherwise sign in with the organizer fixture credentials.',
            'Create the event "DevFlow Conf 2027" (2027-05-12 to 2027-05-14, Moscone West, San Francisco) if no event exists yet. If the clone is single-event or comes pre-seeded, use the existing event.',
            'Find the call-for-papers setup area — it may be called "Call for Papers", "CFP", "Submissions", "Submission form", "Forms", or "Apply". Screenshot it.',
            'Configure the three fixture tracks (AI Engineering, Platform & Infra, Developer Experience) and the five session formats exactly as labeled in the fixtures — "Keynote (45 min)", "Talk (30 min)", "Lightning Talk (10 min)", "Workshop (120 min)", "Panel (45 min)" — wherever tracks/formats are managed.',
            'In the form builder, ensure the form has at minimum: session title (required text), abstract (required long text), track (dropdown), format (dropdown), speaker bio (long text). Then ADD two custom fields: a required short-text field named "Key takeaway", and a dropdown named "Audience level" with options Beginner / Intermediate / Advanced. Screenshot the builder showing the added fields and their required/optional flags.',
            'Add a conditional field: a long-text field "Workshop prerequisites" configured to show only when the format answer is "Workshop (120 min)". If the builder has no conditional/show-when capability, record that observation explicitly and continue.',
            'Set the submission window: open now, close date 2027-04-30 (any clearly future date is acceptable). Screenshot the open/close date settings.',
            'Publish the CFP and capture the public portal URL (copy-link button, "View public form", or the visible address). Record the exact URL as an observation — later scenarios reuse it.',
            'Sign out. Load the public portal WITHOUT being logged in. Screenshot the page showing event branding/name, the submission deadline, and the form (or its start button).',
            'On the public form, open the track dropdown, the format dropdown, and the "Audience level" dropdown; screenshot each open so the options are visible (the three fixture tracks, the five fixture formats, and Beginner/Intermediate/Advanced). Then test the conditional field: select format "Workshop (120 min)" and screenshot showing "Workshop prerequisites" visible; switch to "Talk (30 min)" and screenshot showing it hidden. Record whether visibility changed without a full page reload. If the form cannot be interacted with while logged out (account required first), record that — these checks are repeated in CFP-S2 as the speaker.',
            'Attempt to submit (or advance past the page containing required fields) with "Key takeaway" and other required fields left empty. Screenshot the validation error. If the form requires creating an account before it can be filled, record that and leave validation testing to the speaker scenario.',
            'MULTI-EVENT PROBE. Sign back in as the organizer and look for a way to run a SECOND event alongside the first: an events list, an event switcher, a "New event"/"Create event" control. If one exists, create a second event named "Forward Summit 2028" and screenshot it listed alongside the first. Then open the second event\'s submissions/abstracts area and screenshot it, confirming whether it is empty (data scoped per event) or shows the first event\'s submissions (data leaking across events). If NO way to create or switch events exists, record an explicit observation naming every place you looked and stating that the app appears to be single-event — do not skip this step silently.',
          ],
        },
        {
          id: 'CFP-S2',
          name: 'Speaker drafts, submits, and edits proposals',
          persona: 'speaker',
          steps: [
            'Open the public CFP portal (the URL recorded in CFP-S1; otherwise find it from the app\'s public homepage — look for "Submit a talk", "Call for Papers", "CFP", "Apply", or "Submissions").',
            'Create a submitter account as the speaker identity Priya Raman from the sample data (signup may happen before the form or as part of submitting). Screenshot the signup/login step.',
            'Draft test: start a new submission and enter ONLY the title "Taming 40-Minute CI: Incremental Builds at Monorepo Scale". Look for a "Save as draft" / "Save draft" / "Save and finish later" control and use it. Screenshot any draft banner/indicator. Navigate away (or sign out and back in), return to the form, and verify the draft is offered for resume or the title is pre-filled; screenshot that. If no draft capability exists, record its absence and continue with a fresh submission.',
            'Before completing the form, attempt to submit/advance with the abstract and "Key takeaway" empty; screenshot the required-field validation error.',
            'If CFP-S1 could not exercise the public form logged-out (account required first), run the deferred checks here before filling in: screenshot the open track, format, and "Audience level" dropdowns showing their options, then select format "Workshop (120 min)" and screenshot "Workshop prerequisites" visible, switch to "Talk (30 min)" and screenshot it hidden.',
            'Complete the full "Taming 40-Minute CI" proposal from the sample data: abstract, track "Platform & Infra", format "Talk (30 min)", audience level "Intermediate", speaker bio from Priya\'s fixture bio, and for "Key takeaway" enter "A decision framework for which incremental-build investments pay off". Screenshot the filled form, then submit.',
            'Screenshot the confirmation state (confirmation page, banner, or thank-you message). Record its exact wording, including any mention that a confirmation email was sent.',
            'Find the submitter dashboard — "My submissions", "My sessions", "My proposals" — and verify the proposal is listed with a status label (e.g. Submitted / Under Review / Pending). Screenshot the dashboard row and record the status text.',
            'Edit test: open the submission from the dashboard (look for an Edit or "View Submission" affordance), append the sentence "Updated: now includes 2026 benchmark data." to the end of the abstract, and save. Reload the page and reopen the submission; screenshot proving the appended sentence persisted.',
            'Submit a second complete proposal from the sample data: "Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale" (track "AI Engineering", format "Talk (30 min)", audience level "Advanced"). For "Key takeaway" enter "Verification patterns that scale beyond code review".',
            'Screenshot the submitter dashboard showing BOTH proposals listed with statuses.',
          ],
        },
        {
          id: 'CFP-S3',
          name: 'Organizer assigns a reviewer; reviewer scores',
          persona: 'organizer',
          steps: [
            'Sign in as the organizer Jordan Alvarez.',
            'Open the submissions list for the event. Verify both proposals from CFP-S2 are listed. Screenshot the list. Open the "Taming 40-Minute CI" submission detail and verify the field values round-tripped intact (title, track "Platform & Infra", format, audience level) AND that the abstract ends with "Updated: now includes 2026 benchmark data." (the speaker\'s edit). Screenshot the detail.',
            'Find reviewer management — "Reviewers", "Committee", "Review", "Evaluations", "Assignments". Create or invite a reviewer for Sam Whitfield using the reviewer fixture identity. If the flow lets you set a password directly, use the fixture password; if it is invite-by-email only, look for a copyable invite/magic link or any way to provision credentials, and record exactly what the flow offers.',
            'Assign Sam Whitfield ONLY the "Taming 40-Minute CI" submission — explicitly not the "AI Pair Programmer" one. Screenshot the assignment screen showing which submissions are assigned to him.',
            'Sign out. Sign in as the reviewer Sam Whitfield (fixture credentials, or the invite link captured in step 3).',
            'Screenshot the reviewer dashboard. Verify it lists exactly one submission ("Taming 40-Minute CI") and exposes no admin navigation. Attempt to reach the unassigned "Your AI Pair Programmer Is Lying to You" submission — search the reviewer UI for it, and if submission URLs follow a guessable pattern, try swapping the identifier. Screenshot/record the outcome (not listed, access denied, 404, etc.).',
            'Open the assigned submission. Fill the scorecard: give a rating of 4 (if the scorecard has multiple criteria, rate each 4) and enter the fixture review comment ("Strong practical content and a clear narrative arc; abstract could name the specific tooling used. Recommend accept for the Platform track."). Screenshot the filled scorecard, then submit it.',
            'Verify the reviewer dashboard now shows the item as reviewed/completed (status chip, checkmark, or moved to a done list). Screenshot it.',
          ],
        },
        {
          id: 'CFP-S4',
          name: 'Organizer decides, notifies, hands off, and closes the CFP',
          persona: 'organizer',
          steps: [
            'Sign in as the organizer Jordan Alvarez and open the "Taming 40-Minute CI" submission. Verify Sam Whitfield\'s review is visible — the rating of 4 and his comment text from CFP-S3. Screenshot it.',
            'Record decisions: mark "Taming 40-Minute CI" as Accepted and "Your AI Pair Programmer Is Lying to You" as Rejected (per-row status control, detail-page action, or bulk action — use whatever the UI offers). Screenshot the submissions list showing the two different decision statuses side by side.',
            'Find the decision-notification step — "Send notifications", "Notify speakers", "Send decision emails", possibly template-based. If a template or compose step appears, use the fixture acceptance subject/body from the sample data communications for the acceptance; the fixtures have no rejection template, so any brief rejection subject/body is fine. Trigger the send for both the accepted and rejected submissions. Screenshot the compose/confirm step AND the sent/queued confirmation (sent count, per-submission "notified" indicator, or an email log). If no notification feature exists, record its absence.',
            'Navigate to the sessions/agenda area of the event ("Sessions", "Agenda", "Schedule", "Program"). Verify a session titled "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" exists with speaker Priya Raman and track "Platform & Infra" carried over. If the UI requires an explicit "convert to session" / "move to agenda" action on the accepted submission, perform it first. Screenshot the session entry.',
            'Return to CFP settings and set the submission close date to a past date (e.g. yesterday). Save and screenshot the setting.',
            'Sign out. Load the public portal URL logged-out and verify it now shows a closed state — a "submissions closed" message or otherwise no way to start a new submission. Screenshot it.',
            'Sign in as the speaker Priya Raman. Screenshot her dashboard showing "Taming 40-Minute CI" as Accepted and "Your AI Pair Programmer Is Lying to You" as Rejected (record the exact status labels used).',
            'Open one of her submissions and verify editing is no longer possible now that the CFP is closed — the form is read-only, the edit control is gone, or an "editing closed" message appears. If a field still accepts input, attempt to save a change and record/screenshot the rejection. Screenshot the locked state.',
          ],
        },
      ],
      criteria: [
        {
          id: 'CFP-01',
          criterion:
            'Organizer can build a custom submission form — adding fields of at least 3 types (short text, long text, dropdown) with required/optional flags — and the changes render on the public form with required-field validation enforced',
          weight: 3,
          type: 'crud',
          scenarios: ['CFP-S1', 'CFP-S2'],
          passCriteria:
            "The added fields ('Key takeaway' required text, 'Audience level' dropdown with 3 options) appear on the public form with correct types and options, and attempting to submit with a required field empty is blocked with a visible validation error",
          expectedEvidence:
            'Builder screenshot showing the added fields and required flags; public-form screenshot showing them rendered; screenshot of a validation error on an empty required field (from S1 logged-out or S2 as the speaker)',
          productStatus: 'Verified',
          programkitEvidence:
            'The form builder adds text, long-text, select, file, and other question types, including required flags. The public renderer and operation boundary validate visible required fields.',
        },
        {
          id: 'CFP-02',
          criterion:
            "Submission form supports conditional logic: a field configured to show only for a given session format (or track) appears and disappears based on the submitter's selection",
          weight: 1,
          type: 'depth',
          scenarios: ['CFP-S1', 'CFP-S2'],
          passCriteria:
            "A field configured to depend on the session format appears for the workshop-style format and disappears for the talk-style format — visibility follows the controlling answer in both directions. The app's own format vocabulary counts (e.g. 'Workshop' / 'Break Out'); the fixture's duration-labelled names are illustrative, not required",
          expectedEvidence:
            'Two public-form screenshots, one per format selection, showing the dependent field present then absent (from CFP-S1 logged-out, or CFP-S2 as the speaker if the form requires an account first); builder screenshot of the show-when configuration if the UI exposes one',
          productStatus: 'Verified',
          programkitEvidence:
            'Fields can depend on another answer through equals, not-equals, or includes rules. The same visibility selector drives the builder preview, public form, and submit validation.',
        },
        {
          id: 'CFP-03',
          criterion:
            'A public CFP portal is reachable without any login and shows event branding/name, the submission deadline, and the configured tracks and formats as selectable options',
          weight: 3,
          type: 'exists',
          scenarios: ['CFP-S1', 'CFP-S2'],
          passCriteria:
            'The portal URL loads in a logged-out context showing the event name, a visible deadline/close date, and a form (or entry point) whose track and format options match the fixture configuration',
          expectedEvidence:
            'Logged-out screenshot of the portal with event name and deadline; screenshot of the open track/format dropdowns showing the fixture options (from CFP-S1, or CFP-S2 if the form requires an account first); the recorded portal URL observation',
          productStatus: 'Verified',
          programkitEvidence:
            'The public route requires no login and shows event identity, location, close date, configured form fields, tracks, formats, and select options.',
        },
        {
          id: 'CFP-04',
          criterion:
            'The portal enforces the configured submission window: once the close date is in the past, the public portal blocks new submissions with a closed state',
          weight: 2,
          type: 'rule',
          scenarios: ['CFP-S4'],
          passCriteria:
            "After the organizer sets the close date to a past date, the logged-out portal shows a closed/'submissions closed' state with no way to start or submit a new proposal",
          expectedEvidence:
            'Screenshot of the close-date setting saved with a past date; logged-out screenshot of the portal in its closed state (contrast with the open-portal screenshot from CFP-S1)',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizers edit opening and closing times in the event timezone. Scheduled and closed forms remain readable publicly while create, update, and submit operations reject writes outside the window.',
        },
        {
          id: 'CFP-05',
          criterion:
            'A speaker can create a submitter account from the portal, complete and submit a proposal, see an on-screen confirmation, and find the submission listed with a status in their own dashboard',
          weight: 3,
          type: 'crud',
          scenarios: ['CFP-S2'],
          passCriteria:
            "Account creation succeeds, the 'Taming 40-Minute CI' fixture proposal submits, a confirmation state is shown, and the submitter dashboard lists the proposal with a status label (Submitted / Under Review / Pending or equivalent)",
          expectedEvidence:
            'Screenshots of the signup step, the filled form pre-submit, the confirmation state, and the dashboard row with its status text',
          productStatus: 'Verified',
          programkitEvidence:
            'A speaker capability is created on first draft, stored locally, and returned in the private dashboard URL. A completed proposal submits with an on-screen confirmation and status.',
        },
        {
          id: 'CFP-06',
          criterion:
            "Submitted data round-trips to the organizer: the submission appears in the organizer's list with title, abstract, track, format, and custom-field values intact",
          weight: 3,
          type: 'roundtrip',
          scenarios: ['CFP-S2', 'CFP-S3'],
          passCriteria:
            "The organizer's submissions list shows both fixture proposals, and the detail view of 'Taming 40-Minute CI' shows the same title, track 'Platform & Infra', format, audience level, and abstract text the speaker entered, with no lost or mangled fields",
          expectedEvidence:
            'Screenshot of the organizer submissions list with both titles; screenshot of the submission detail whose field values match the fixture data entered in CFP-S2',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizer submission detail resolves the same stored answers, participants, track, format, and custom fields supplied through the public form. Core and HTTP tests cover the round trip.',
        },
        {
          id: 'CFP-07',
          criterion:
            'The public form supports saving an in-progress submission as a draft (with as little as a title) and resuming it on return',
          weight: 1,
          type: 'depth',
          scenarios: ['CFP-S2'],
          passCriteria:
            'With only the title entered, a save-as-draft action succeeds, some draft indicator is shown, and on returning to the form the draft is offered for resume or the saved data is pre-filled',
          expectedEvidence:
            'Screenshot of the draft banner/indicator after saving; screenshot after returning showing the resume prompt or the pre-filled title; agent observation if the feature is absent',
          productStatus: 'Verified',
          programkitEvidence:
            'A title-only proposal can be saved as a private draft, resumed through its speaker link, completed, saved again, and submitted. Core, HTTP, and browser journeys exercise the lifecycle.',
        },
        {
          id: 'CFP-08',
          criterion:
            'Submitting a proposal triggers an automated confirmation email to the submitter referencing the submission',
          weight: 1,
          type: 'side-effect',
          scenarios: [],
          passCriteria:
            "A confirmation email arrives at the submitter's address within a few minutes of submitting, referencing the event and the submitted title; if the clone exposes an in-app email log/outbox, a logged message with correct recipient and title also passes",
          expectedEvidence:
            'Screenshot of the received email (or in-app email log entry) showing recipient, subject, and the submission title',
          productStatus: 'Verified',
          programkitEvidence:
            'Submission creates a durable `submission_confirmation` outbox item with the submitter, event, and proposal title. A production message reached a controlled Gmail inbox in one provider attempt.',
        },
        {
          id: 'CFP-09',
          criterion:
            'A submitter can edit an existing submission while the CFP is open, and the edited content is what the organizer subsequently sees (inferred norm from Sessionize/EasyChair, confirmed by SessionBoard participant docs)',
          weight: 2,
          type: 'roundtrip',
          scenarios: ['CFP-S2', 'CFP-S3'],
          passCriteria:
            "The appended abstract sentence ('Updated: now includes 2026 benchmark data.') persists across reload in the speaker's view and appears verbatim in the organizer's view of the same submission",
          expectedEvidence:
            'Speaker-side screenshot of the edited abstract after reload (CFP-S2); organizer-side screenshot of the submission detail containing the same sentence (CFP-S3)',
          productStatus: 'Verified',
          programkitEvidence:
            'Speakers can edit their own submitted proposal while the call is open. Expected versions protect concurrent edits and the organizer reads the same updated record.',
        },
        {
          id: 'CFP-10',
          criterion:
            "Organizer can provision a reviewer (create/invite with usable credentials) and the reviewer role is separated from admin: signed in as the reviewer, a reviewer-facing dashboard is shown with no organizer/admin navigation or capability exposed. Exact assigned-queue scoping ('the queue contains exactly the assigned set, nothing else') is deliberately deferred to abstract-management's ABS-05 and not scored here.",
          weight: 2,
          type: 'scoping',
          scenarios: ['CFP-S3'],
          passCriteria:
            'Sam Whitfield is created/invited with credentials the agent can use, signs in successfully, and lands on a reviewer-facing dashboard that exposes no admin navigation or organizer capability. Whether his queue contains exactly the assigned submissions is graded once, by ABS-05 — do not double-count it here.',
          expectedEvidence:
            'Screenshot of the reviewer provisioning/invite flow; screenshot of the reviewer dashboard signed in as Sam showing a reviewer-scoped view with no admin navigation',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizers create reviewers, group them into pools, and optionally route each proposal category to a different pool. Automatic assignments use the submitted track and reviewer links expose only the assigned queue.',
        },
        {
          id: 'CFP-11',
          criterion:
            "A reviewer can record a review on an assigned submission (a rating plus a text comment) and the recorded review is visible to the organizer, with completion state updating on the reviewer dashboard. Scorecard field-type depth (numeric/dropdown/free-text criteria editors) is graded by abstract-management's ABS-03, not here.",
          weight: 2,
          type: 'roundtrip',
          scenarios: ['CFP-S3', 'CFP-S4'],
          passCriteria:
            "The rating of 4 and the fixture comment are accepted and persist; the reviewer dashboard marks the item reviewed/completed; the organizer's view of the submission shows the same rating and comment. No scorecard field-type variety is required here (see ABS-03).",
          expectedEvidence:
            'Screenshot of the filled scorecard before submit; screenshot of the completed state on the reviewer dashboard; organizer-side screenshot (CFP-S4) showing rating 4 and the comment text',
          productStatus: 'Verified',
          programkitEvidence:
            'Assigned reviewers submit ratings and comments, completion updates immediately, and organizers see the same scorecard in submission review detail.',
        },
        {
          id: 'CFP-12',
          criterion:
            'Organizer can record accept and reject decisions on submissions, and the admin list reflects the distinct decision statuses',
          weight: 3,
          type: 'crud',
          scenarios: ['CFP-S4'],
          passCriteria:
            "'Taming 40-Minute CI' is marked Accepted and 'Your AI Pair Programmer Is Lying to You' is marked Rejected; both statuses persist and are shown distinctly in the organizer's submissions list",
          expectedEvidence:
            'Screenshot of the decision control being used; screenshot of the submissions list showing one Accepted and one Rejected row',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizer decisions support accepted, rejected, and waitlisted states, including explicit override reasons where review minimums are not met. Distinct statuses persist in the list.',
        },
        {
          id: 'CFP-13',
          criterion:
            "Decision statuses propagate to the submitter: the speaker's own dashboard reflects Accepted/Rejected for the corresponding proposals",
          weight: 2,
          type: 'roundtrip',
          scenarios: ['CFP-S4'],
          passCriteria:
            'Signed in as Priya Raman after decisions were recorded, her dashboard shows the CI talk as Accepted and the AI talk as Rejected (or unambiguous equivalents of those statuses)',
          expectedEvidence:
            'Screenshot of the speaker dashboard with both status labels visible; recorded exact status wording',
          productStatus: 'Verified',
          programkitEvidence:
            'The private speaker dashboard reads the same submission record, so organizer decisions appear as Accepted, Rejected, or Waitlisted without a second status store.',
        },
        {
          id: 'CFP-14',
          criterion:
            'The platform can send (or queue) acceptance and rejection notification emails to decided submitters, with the UI confirming dispatch',
          weight: 2,
          type: 'side-effect',
          scenarios: ['CFP-S4'],
          passCriteria:
            'A notify/send-decisions action exists, accepts or provides accept/reject templates (merge-field support like {speaker_name}/{talk_title} is a plus, inferred), and after triggering it the UI reports the messages as sent/queued for the correct recipient sets; NOT auto-verified: actual delivery and body personalization',
          expectedEvidence:
            'Screenshot of the compose/template step (using the fixture acceptance subject/body if offered) and of the sent/queued confirmation, per-submission notified indicator, or email log entries',
          productStatus: 'Verified',
          programkitEvidence:
            'Decision notification includes an editable merge-field template and resolved recipient preview before queueing. The production acceptance message reached Gmail in one provider attempt.',
        },
        {
          id: 'CFP-15',
          criterion:
            'An accepted submission becomes available as a session in the sessions/agenda area with its metadata (title, speaker, track) intact, without re-entering the data',
          weight: 2,
          type: 'handoff',
          scenarios: ['CFP-S4'],
          passCriteria:
            "After acceptance (plus an explicit convert/move action only if the UI requires one), the sessions/agenda area contains a session titled 'Taming 40-Minute CI: Incremental Builds at Monorepo Scale' with speaker Priya Raman and track 'Platform & Infra' carried over with no manual re-typing of those fields",
          expectedEvidence:
            'Screenshot of the accepted submission detail; screenshot of the matching session entry in the sessions/agenda area showing the same title, speaker, and track',
          productStatus: 'Verified',
          programkitEvidence:
            'Accepting a proposal atomically creates or reuses people, participation records, requirements, and a session carrying the proposal title, speakers, track, format, duration, and description.',
        },
        {
          id: 'CFP-16',
          criterion:
            'Submission editing locks after the CFP close date: the speaker can no longer modify a submission once the call is closed',
          weight: 2,
          type: 'rule',
          scenarios: ['CFP-S4'],
          passCriteria:
            "With the close date in the past, the speaker's submission opens read-only, hides its edit affordance, or shows an editing-closed message — and no edit can be saved",
          expectedEvidence:
            'Speaker-side screenshot of the locked/read-only submission (or editing-closed message), taken after the close date was moved to the past — contrast with the successful edit in CFP-S2',
          productStatus: 'Verified',
          programkitEvidence:
            'The speaker dashboard removes editing outside the submission window, and the operation boundary independently rejects update and submit attempts after close.',
        },
        {
          id: 'CFP-17',
          criterion:
            'The app supports more than one event: an organizer can create a second event and both events coexist, each reachable via an events list or event switcher',
          weight: 2,
          type: 'exists',
          scenarios: ['CFP-S1'],
          passCriteria:
            "A second event ('Forward Summit 2028') is created and both events appear together in an events list or switcher. A single-event app with no event-creation or switching UI anywhere fails this item — an agent observation naming the places checked is sufficient evidence of absence",
          expectedEvidence:
            "Screenshot of the events list or switcher showing both events; or the agent's explicit observation that no event creation/switching UI exists, listing where it looked",
          productStatus: 'Verified',
          programkitEvidence:
            'A fresh organizer account can create a second event from the event switcher, and both events remain available in that switcher. Each event is backed by its own Workspace Durable Object.',
        },
        {
          id: 'CFP-18',
          criterion:
            'Event data is scoped per event: submissions, sessions and speakers belonging to one event do not appear inside another event',
          weight: 2,
          type: 'scoping',
          scenarios: ['CFP-S1'],
          passCriteria:
            "The second event's submissions/abstracts area is empty (or contains only its own records) rather than showing the first event's submissions. Cross-event leakage of records is a fail",
          expectedEvidence:
            "Screenshot of the second event's submissions/abstracts list contrasted with the first event's populated list",
          productStatus: 'Verified',
          programkitEvidence:
            "Switching into a newly created event shows empty submissions, sessions, and speakers rather than the first event's records. This was exercised against the hosted app with “Forward Summit 2028.”",
        },
      ],
      proof: [
        {
          title: 'Build the form',
          image: './screenshots/programkit/form-builder.jpg',
          route: '/forms',
        },
        {
          title: 'Add a custom question',
          image: './screenshots/programkit/form-builder-add-question.jpg',
          route: '/forms',
        },
        {
          title: 'Check conditional logic',
          image: './screenshots/programkit/public-cfp-conditional.jpg',
          route: '/submit/aie-nyc-2026-cfp',
        },
        {
          title: 'Confirm submission',
          image: './screenshots/programkit/public-cfp-confirmation.jpg',
          route: '/submit/aie-nyc-2026-cfp',
        },
        {
          title: 'Inspect organizer detail',
          image: './screenshots/programkit/submission-detail.jpg',
          route: '/submissions',
        },
        {
          title: 'Convert an acceptance',
          image: './screenshots/programkit/accepted-session-conversion.jpg',
          route: '/submissions',
        },
      ],
    },
    {
      area: 'abstract-management',
      title: 'Abstract Management (Review Depth & Disposition)',
      prefix: 'ABS',
      areaWeight: 20,
      optional: false,
      overview:
        "Abstract management is the review-and-disposition engine that sits behind the call for papers. Organizers configure evaluation plans with multiple independent review rounds, each carrying its own scorecard (numeric, dropdown, and free-text criteria, optionally weighted), its own open/close dates, its own anonymization setting, and its own reviewer pool. Submissions are distributed to reviewers at scale with per-reviewer caps, auto-distribution or track-filtered bulk assignment, and a real-time progress dashboard with bulk reminders keeps the committee on schedule. Reviewers score their assigned abstracts (blinded when the round requires it, with conflict-of-interest recusal where supported), and chairs work from an aggregate score table they can sort, export for the committee, and optionally seed with AI first-pass triage scores. Basic form building, the submitter portal, and simple accept/reject flows are owned by the call-for-papers spec; this spec grades the depth of the review workflow itself. Note: a scenario's persona is its STARTING identity — scenarios may sign out and switch identities mid-run; the harness supplies all fixture credentials to every scenario.",
      scenarios: [
        {
          id: 'ABS-S1',
          name: 'Speaker seeds submissions with a co-author',
          persona: 'speaker',
          steps: [
            'Navigate to the target site. Find the public call-for-papers / submission area — it may be called Apply, CFP, Submit a talk, Call for Speakers, Submissions, or Proposals, and may live behind the event "DevFlow Conf 2027" if the site hosts multiple events. CHAINED-RUN PRECONDITION: if the portal shows a CLOSED state (area 01 deliberately closes the CFP at its end), first sign in as the organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password), move the CFP close date back into the future (e.g. 2027-04-30), save, sign out, and return here before continuing.',
            'Sign up as the speaker identity Priya Raman (priya.speaker@sbek-test.example.com, fixture password, title/company/bio from the sample data). If the account already exists (e.g. created in area 01), sign in instead.',
            'Ensure the "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" proposal exists with a co-author. If it already exists from area 01, REUSE it — do not submit a duplicate: open it from the speaker dashboard and add the co-author by EDITING the existing submission. Otherwise submit it fresh from the sample data (format Talk, track Platform & Infra, abstract and audience-level text from the fixture). Either way, look for an add co-author / co-presenter / additional speaker / participant control. If present, add Marcus Okafor from the sample data (marcus.speaker@sbek-test.example.com, Staff Developer Advocate at Cloudreach Labs) and assign him a role if role labels are offered (Co-author, Co-speaker, Co-presenter, or similar). Screenshot the form or edited submission INCLUDING the participants/co-author section before saving/submitting, then screenshot the confirmation or saved state. If no co-author control exists anywhere in the flow, record that observation explicitly.',
            'Ensure the second proposal "Your AI Pair Programmer Is Lying to You: Verification Patterns That Scale" exists. If it already exists from area 01 (it may even carry a Rejected decision), reuse it as-is — do not submit a duplicate. Otherwise submit it from the sample data (Talk, AI Engineering), no co-author.',
            'Submit the third proposal "Docs That Answer Back: Retrieval-Grounded Documentation Sites" from the sample data (Lightning Talk, Developer Experience), no co-author. This is the only proposal guaranteed not to exist yet — always submit it fresh.',
            "Open the speaker's submissions list / dashboard and screenshot it showing all three submissions with their status labels.",
            'Open the detail view of "Taming 40-Minute CI" and screenshot the participants list. Record whether Marcus Okafor appears with a role label alongside Priya Raman.',
          ],
        },
        {
          id: 'ABS-S2',
          name: 'Organizer configures rounds, pools, assignments, reminders',
          persona: 'organizer',
          steps: [
            'Navigate to the target site and find the organizer/admin area — try obvious nav links first, then routes like /admin, /dashboard, /organizer. Sign up as Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password) if the site has open signup; otherwise sign in with the fixture organizer credentials.',
            'Locate the event "DevFlow Conf 2027". If it does not exist, create it from the sample data (2027-05-12 to 2027-05-14, Moscone West SF, tracks AI Engineering / Platform & Infra / Developer Experience, session formats from the fixture).',
            'Open the submissions/proposals list and confirm the three ABS-S1 submissions are visible. Screenshot the list.',
            'Find the review/evaluation configuration area — it may be called Evaluation Plans, Review Rounds, Review Workflow, Review Settings, or Scorecards. Create a first round named "Initial Review" with open date 2026-08-01 and close date 2026-10-15. Enable anonymization / blind review / double-blind for this round if the option exists (screenshot the toggle). Build its scorecard with four fields — numeric 1-5 "Originality", numeric 1-5 "Relevance", dropdown "Recommendation" with options Accept / Maybe / Reject, and a long-text "Comments" field. If the editor supports per-criterion weights, set Originality to weight 2 and Relevance to weight 1 and screenshot the weight configuration; if not, record that weights are unsupported. Screenshot the completed scorecard editor.',
            'Create a second round named "Final Review" with open date 2026-10-16 and close date 2026-11-30 and a DIFFERENT scorecard: numeric 1-10 "Final Score" plus a "Comments" text field. If reviewer pools are configured per round, give this round a pool distinct from round 1 (it may be empty or contain only the organizer). Save everything, then reload the evaluation-plan page and screenshot it showing both rounds with their distinct names, date ranges, and scorecards.',
            'Add Sam Whitfield (sam.reviewer@sbek-test.example.com, fixture identity) as a reviewer in the Round 1 "Initial Review" pool — via invite reviewer, add reviewer, or team/committee management. If an invitation link is displayed on screen, record it as an observation. Screenshot the reviewer-pool state showing Sam Whitfield attached to Round 1 and, if pools are per-round, Round 2\'s separate (possibly empty) pool; if reviewers can only be added globally rather than per round, record that observation explicitly.',
            'Open the reviewer-assignment area. Assign exactly TWO of the three submissions to Sam Whitfield: "Taming 40-Minute CI" and "Your AI Pair Programmer Is Lying to You". Deliberately leave "Docs That Answer Back" unassigned. While here, look for at-scale assignment tooling — a per-reviewer cap / max-assignments setting, auto-distribute / auto-assign, or assign-by-track filtering. Exercise whichever exists (e.g. set a cap of 5, or filter by track before assigning) and screenshot it. Confirm the assignments and screenshot the final assignment state.',
            'Open the review progress dashboard / monitoring view. Screenshot the baseline state showing Sam Whitfield with 2 assigned and 0 completed (or equivalent counts/percentages).',
            'From the progress view (or reviewer list), select the lagging reviewer Sam Whitfield and trigger the bulk / send-reminder action. Screenshot the confirmation that a reminder was sent. Do not expect to verify the email itself.',
            'If the site advertises AI evaluation / AI triage / AI reviewer features, enable or run it on "Taming 40-Minute CI" (configuring a persona if required). Screenshot any AI-produced score and its written reasoning, plus any override control. If no AI feature exists, record that observation.',
          ],
        },
        {
          id: 'ABS-S3',
          name: 'Reviewer scores blind; organizer checks aggregates and export',
          persona: 'reviewer',
          steps: [
            'Navigate to the target site and sign in as Sam Whitfield (sam.reviewer@sbek-test.example.com, fixture password). If no account exists yet, sign up with the fixture reviewer identity, or use any reviewer-invitation link that was displayed on screen during ABS-S2. If the reviewer portal is magic-link-only (no reviewer password sign-in or signup anywhere), sign in as the organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password), look for a copyable reviewer-portal link or a "view as reviewer" / impersonate control for Sam Whitfield, record it, sign out, and open that link. If no such on-screen path exists either, record that reviewer access requires an emailed link that cannot be verified, and stop this scenario.',
            'Open the reviewer queue / review portal. Screenshot it. Record exactly which submission titles appear: it should list the two assigned submissions ("Taming 40-Minute CI..." and "Your AI Pair Programmer...") and must NOT list the unassigned "Docs That Answer Back".',
            'Open the review view for "Taming 40-Minute CI". Scan the entire visible page for the author identity: the names "Priya Raman" and "Marcus Okafor" and the company "Latticework Systems". Screenshot the page and record explicitly whether author identity is hidden (round 1 was configured as blinded in ABS-S2) and whether any other reviewer\'s scores are visible.',
            'While in the review view, look for a conflict-of-interest control — "Declare conflict", "Recuse", "I have a conflict", "Cannot review", or similar. Screenshot it if present and record its exact wording; only click it if the UI clearly shows the action is reversible or scoped to a single submission you can still see. Record its absence otherwise.',
            'Fill the round-1 scorecard for "Taming 40-Minute CI": Originality = 4 (the sample review rating), Relevance = 2, Recommendation = Accept (the sample decision), and paste the sample review comment into Comments. If Sam already reviewed this submission in an earlier area (CFP-S3 records an all-4s review), submit this scorecard within the Round 1 "Initial Review" plan created in ABS-S2 — and if the clone allows only one review per reviewer per submission, edit/replace the prior review with these values instead. Screenshot the filled scorecard, submit it, and verify the item is marked complete in the queue. Then reopen the submitted review and screenshot it showing the stored values (4, 2, Accept, and the comment) so storage — not just the completion badge — is captured.',
            'Open "Your AI Pair Programmer Is Lying to You" and submit a second evaluation: Originality = 5, Relevance = 5, Recommendation = Accept, brief comment "Excellent fit for the AI Engineering track." Screenshot, submit, and screenshot the queue showing both items complete.',
            'Sign out. Sign in as the organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password) and open the review results / scores / decisions area for DevFlow Conf 2027.',
            "Verify an aggregate (average/total) score is displayed per submission. Record the displayed aggregates for both reviewed submissions. Note for the judge: with Originality 4 and Relevance 2, an unweighted average is 3.0 while the weighted average configured in ABS-S2 (Originality x2) is approximately 3.33; record which the site shows. If the clone pooled an earlier-area review into the aggregate (e.g. CFP-S3's all-4s scorecard), record the arithmetic INCLUDING that review rather than treating the differing number as an error. Screenshot the results table.",
            'Sort the results table by aggregate score — click the score column header or use a sort control — in descending then ascending order. Screenshot both orderings and record the row order each time ("Your AI Pair Programmer" should rank above "Taming 40-Minute CI" on score).',
            'Open "Taming 40-Minute CI" in the organizer\'s review/results context and screenshot the participants: author identity (Priya Raman, Marcus Okafor with his role, Latticework Systems) should be fully visible to the organizer, in contrast to the blinded reviewer view from step 3.',
            'Open the progress dashboard again and screenshot it now showing Sam Whitfield with 2 of 2 reviews complete (or 100%).',
            'Find an export / download control for scores or review results (CSV/XLSX), in the results table or a reports area. Trigger it, screenshot the control and any confirmation or download indication, and record the filename if shown. Do not attempt to open the downloaded file.',
            'If AI scores were produced in ABS-S2, verify in the results view that the AI score is visually distinguishable from human reviewer scores, and if an override control exists, override the AI score to a different value, save, reload, and screenshot the persisted override.',
          ],
        },
      ],
      criteria: [
        {
          id: 'ABS-01',
          criterion:
            'Organizer can configure an evaluation plan with two or more independent review rounds, each with its own name, open/close dates, and its own scorecard, and the configuration persists.',
          weight: 3,
          type: 'crud',
          scenarios: ['ABS-S2'],
          passCriteria:
            "After saving and reloading, both rounds ('Initial Review' 2026-08-01..2026-10-15 and 'Final Review' 2026-10-16..2026-11-30) are listed with visibly distinct names, date ranges, and scorecards; a single global review setup with no round concept fails.",
          expectedEvidence:
            'Screenshot of the reloaded evaluation-plan screen showing both named rounds with their differing dates and scorecard contents.',
          productStatus: 'Verified',
          programkitEvidence:
            'The evaluation-plan drawer creates independent rounds with names, open/close dates, and round-specific scorecards. Core tests reload the resulting state.',
        },
        {
          id: 'ABS-02',
          criterion:
            'Review rounds can each have their own reviewer pool, so a reviewer scoped to round 1 is not automatically a reviewer for round 2.',
          weight: 2,
          type: 'scoping',
          scenarios: ['ABS-S2'],
          passCriteria:
            'The UI attaches reviewers (or a pool/committee) to a specific round rather than only globally, and Sam Whitfield could be added to the Round 1 pool while Round 2 shows a different (possibly empty) pool.',
          expectedEvidence:
            'Screenshots of per-round reviewer-pool configuration showing Round 1 containing Sam Whitfield and Round 2 configured separately; agent observation of where reviewer membership is scoped.',
          productStatus: 'Verified',
          programkitEvidence:
            'Every round selects its own default reviewer team and can override the pool by proposal category. Teams and routes persist by round ID without rewriting existing assignments.',
        },
        {
          id: 'ABS-03',
          criterion:
            'The scorecard editor supports numeric rating, dropdown, and free-text criteria, and all three field types render on the reviewer side and store submitted values.',
          weight: 3,
          type: 'crud',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            'Organizer could build the round-1 scorecard with numeric Originality/Relevance, a Recommendation dropdown (Accept/Maybe/Reject), and a Comments text area; the reviewer view rendered all three types; the submitted evaluation (values 4, 2, Accept, sample comment) is stored and visible after submission.',
          expectedEvidence:
            'Scorecard-editor screenshot from ABS-S2 plus the filled reviewer scorecard and its completed/stored state from ABS-S3.',
          productStatus: 'Verified',
          programkitEvidence:
            'The editor and reviewer surface support numeric, select, and long-text criteria. Stored answers are covered by core tests.',
        },
        {
          id: 'ABS-04',
          criterion:
            'Scoring criteria can carry weights and the per-submission aggregate reflects the weighting (inferred — SessionBoard marketing references weighted criteria only for AI personas; aggregation method unspecified).',
          weight: 1,
          type: 'depth',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            "Weight configuration exists in the scorecard editor and persists (Originality weight 2, Relevance weight 1); full credit if the displayed aggregate for 'Taming 40-Minute CI' matches the weighted math (approximately 3.33 rather than the plain 3.0 average) or is explicitly labeled as weighted; no weight concept anywhere fails. If an earlier-area review (CFP-S3's all-4s scorecard) is folded into the displayed aggregate, judge the arithmetic including it per the agent's recorded observation rather than failing the item.",
          expectedEvidence:
            "Screenshot of the weight configuration in the editor and the results-table aggregate value for the submission scored 4 and 2, with the agent's recorded arithmetic observation.",
          productStatus: 'Verified',
          programkitEvidence:
            'Numeric criteria carry weights. Results and exports use the weighted aggregate and label it accordingly.',
        },
        {
          id: 'ABS-05',
          criterion:
            "Organizer can assign specific submissions to a specific reviewer, and the reviewer's queue contains exactly the assigned submissions and nothing else.",
          weight: 3,
          type: 'scoping',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            "Sam Whitfield's queue lists 'Taming 40-Minute CI' and 'Your AI Pair Programmer' and does NOT list the unassigned 'Docs That Answer Back'; a portal that exposes all submissions to every reviewer fails.",
          expectedEvidence:
            "ABS-S2 assignment-state screenshot plus the ABS-S3 reviewer-queue screenshot; agent's recorded list of titles visible in the queue.",
          productStatus: 'Verified',
          programkitEvidence:
            "Organizers select exact proposals for one reviewer. The reviewer projection contains only that person's assignments.",
        },
        {
          id: 'ABS-06',
          criterion:
            'Assignment tooling works at scale — at least one of per-reviewer caps/limits, auto-distribution of submissions across reviewers, or track-filtered bulk assignment is present and functional.',
          weight: 2,
          type: 'bulk',
          scenarios: ['ABS-S2'],
          passCriteria:
            'The assignment UI offers a per-reviewer limit, an auto-assign/distribute action, or track/bulk filtering, and the agent exercised it without error; assignment strictly one-submission-at-a-time with no caps, filters, or auto-distribution fails.',
          expectedEvidence:
            "Screenshot of the cap setting, auto-distribute control, or track filter in use during ABS-S2 step 7, with the agent's observation of what happened.",
          productStatus: 'Verified',
          programkitEvidence:
            'Bulk assignment supports a track filter and per-reviewer maximum. The selected track automatically limits eligible reviewers to its routed pool. Both paths are exercised by tests.',
        },
        {
          id: 'ABS-07',
          criterion:
            "With anonymization enabled on a round, the reviewer's view hides author and co-author identity while the organizer's view of the same submission shows it.",
          weight: 2,
          type: 'scoping',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            "A per-round anonymization/blind setting exists (ABS-S2 step 4) and the blinded reviewer view of 'Taming 40-Minute CI' contains none of 'Priya Raman', 'Marcus Okafor', or 'Latticework Systems', while the organizer view (ABS-S3 step 10) shows them; author names leaking anywhere in the reviewer view fails.",
          expectedEvidence:
            "Contrasting screenshots: blinded reviewer view vs organizer view of the same submission; agent's explicit observation from scanning for the three identity strings.",
          productStatus: 'Verified',
          programkitEvidence:
            'Blindness is round-specific. Reviewer projections remove author, co-author, company, job title, biography, and email fields; organizer views retain them.',
        },
        {
          id: 'ABS-08',
          criterion:
            'A review progress dashboard shows per-reviewer completion counts or percentages that match the actual review state in real time.',
          weight: 2,
          type: 'roundtrip',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            'The dashboard showed Sam Whitfield at 2 assigned / 0 complete before any reviews (ABS-S2 step 8) and 2 of 2 complete (or 100%) after both evaluations were submitted (ABS-S3 step 11); stale or absent counts fail.',
          expectedEvidence:
            'Before/after progress-dashboard screenshots from the two scenarios with matching reviewer name and counts.',
          productStatus: 'Verified',
          programkitEvidence:
            '/reviews` derives assigned, completed, outstanding, and percentage values from live assignments and scorecards.',
        },
        {
          id: 'ABS-09',
          criterion:
            'Organizer can select reviewers with outstanding reviews and send them a bulk reminder from the progress or reviewer view.',
          weight: 1,
          type: 'bulk',
          scenarios: ['ABS-S2'],
          passCriteria:
            'A reminder/nudge action is available against the lagging reviewer (Sam at 0 of 2 complete), and triggering it reports success (confirmation toast, sent status, or log entry).',
          expectedEvidence:
            'Screenshot of the reminder control and the sent confirmation from ABS-S2 step 9.',
          productStatus: 'Verified',
          programkitEvidence:
            'The organizer selects lagging reviewers, reviews an editable message, sees personalized counts and links, and queues one email per reviewer. The delivery test verifies an absolute private workspace link reaches the provider adapter.',
        },
        {
          id: 'ABS-10',
          criterion:
            'Organizer sees an aggregate score per submission in a results table and can sort submissions by that score.',
          weight: 3,
          type: 'roundtrip',
          scenarios: ['ABS-S3'],
          passCriteria:
            "Both reviewed submissions display aggregates consistent with the entered scores ('Your AI Pair Programmer' at 5.0 outranking 'Taming 40-Minute CI' at ~3.0-3.33), and toggling the sort visibly reorders rows correctly in both directions; a list with raw per-review data but no aggregate or no working sort fails. If an earlier-area review is folded into the aggregate (per the agent's recorded arithmetic in step 8), judge consistency including that review rather than requiring the exact 3.0/3.33 values.",
          expectedEvidence:
            "Results-table screenshots in descending and ascending score order plus the agent's recorded row orders and aggregate values.",
          productStatus: 'Verified',
          programkitEvidence:
            'The results table shows weighted aggregates and toggles between ascending and descending score order.',
        },
        {
          id: 'ABS-11',
          criterion:
            'Co-authors/co-presenters added at submission time persist with their role labels and are visible on the submission in organizer-side review and results views.',
          weight: 2,
          type: 'crud',
          scenarios: ['ABS-S1', 'ABS-S3'],
          passCriteria:
            "Marcus Okafor appears alongside Priya Raman on 'Taming 40-Minute CI' with a role label in the speaker-side detail (ABS-S1) and in the organizer's review/results context (ABS-S3 step 10); no co-author support at all fails; partial credit if co-authors persist but without role labels.",
          expectedEvidence:
            'Submission-detail screenshots from both scenarios showing the participants list with names and roles.',
          productStatus: 'Verified',
          programkitEvidence:
            'Submission participants include primary and co-speaker roles in speaker and organizer detail views. Acceptance converts every participant.',
        },
        {
          id: 'ABS-12',
          criterion:
            'Reviewer can declare a conflict of interest / recuse themselves on an assigned submission (inferred — not documented in SessionBoard marketing; category norm from peer review tools).',
          weight: 1,
          type: 'depth',
          scenarios: ['ABS-S3'],
          passCriteria:
            "A conflict-of-interest or recusal control is present in the reviewer's scoring view (screenshot with wording recorded); full credit if exercising it flags the submission or removes it from the reviewer's actionable queue.",
          expectedEvidence:
            "Screenshot of the COI/recuse control from ABS-S3 step 4 and the agent's recorded wording; if exercised, the resulting flagged/removed state.",
          productStatus: 'Verified',
          programkitEvidence:
            'A reviewer can declare a proposal-scoped conflict and undo it. Both API behavior and the browser transition are exercised.',
        },
        {
          id: 'ABS-13',
          criterion:
            'Review scores and statuses can be exported to a downloadable file (CSV/XLSX) from the results or reports area.',
          weight: 2,
          type: 'side-effect',
          scenarios: ['ABS-S3'],
          passCriteria:
            'An export/download control exists for review results and triggering it initiates a download or reports success without error.',
          expectedEvidence:
            'Screenshot of the export control and any confirmation/download indication from ABS-S3 step 12, plus the recorded filename if shown.',
          productStatus: 'Verified',
          programkitEvidence:
            'Review results download as CSV with one row per submission, criterion averages, weighted aggregate, recommendations, comments, participants, and status.',
        },
        {
          id: 'ABS-14',
          criterion:
            'If the clone claims AI-assisted triage, an AI evaluator produces a first-pass numeric score with written reasoning on a submission, and a human override persists distinguishably.',
          weight: 1,
          type: 'depth',
          scenarios: ['ABS-S2', 'ABS-S3'],
          passCriteria:
            "An AI evaluation feature exists and yields a numeric score plus rationale text attributed to the AI on 'Taming 40-Minute CI'; the results view distinguishes AI from human scores; an admin override to a different value persists after reload. Judge this item only if the clone claims AI review anywhere in its UI or marketing; otherwise score as not applicable per the agent's recorded observation of absence.",
          expectedEvidence:
            'Screenshots of the AI score with its reasoning text, the AI-vs-human distinction in results, and the persisted override after reload.',
          productStatus: 'Not claimed',
          programkitEvidence:
            'ProgramKit does not advertise AI evaluation. The V1 rubric marks this item not applicable when the feature is not claimed.',
        },
      ],
      proof: [
        {
          title: 'Inspect the proposal',
          image: './screenshots/programkit/submission-detail.jpg',
          route: '/submissions',
        },
        {
          title: 'Open scoped reviewer work',
          image: './screenshots/programkit/reviewer-workspace.jpg',
          route: '/reviewer/rev_001/reviewer_elena_vasquez',
        },
        {
          title: 'Complete the scorecard',
          image: './screenshots/programkit/reviewer-scorecard-filled.jpg',
          route: '/reviewer/rev_001/reviewer_elena_vasquez',
        },
        {
          title: 'Compare aggregate results',
          image: './screenshots/programkit/reviews.jpg',
          route: '/reviews',
        },
      ],
    },
    {
      area: 'speaker-management',
      title: 'Speaker Management',
      prefix: 'SPK',
      areaWeight: 15,
      optional: false,
      overview:
        'Speaker management is the post-acceptance hub between the CFP and the published agenda. This single area satisfies both of the buyer\'s phrasings — "speaker management" and "conference speaker management" — which SessionBoard\'s two capability pages describe as one capability set; cross-event speaker reuse lives in the optional speaker-crm area. Organizers maintain a per-event speaker roster (profiles with bio, headshot, title/company, status badges), add speakers manually or by CSV import, and assign general onboarding tasks with due dates. Each speaker gets a personalized portal scoped to only their own content, where they complete their profile (bio, social links, headshot upload), see their assigned sessions, and work through their task list. Organizers track completion in a progress dashboard and send general bulk email (e.g. welcome announcements) built on templates with merge fields, with every send logged to a communications history. Boundary: file-request tasks, file uploads, versioning, approval, the deliverables dashboard, and deliverables-reminder emails are owned by the content-management spec; this area owns the roster, portal, general/action tasks, and general comms.',
      scenarios: [
        {
          id: 'SPK-S1',
          name: 'Organizer builds the speaker roster and assigns onboarding tasks',
          persona: 'organizer',
          steps: [
            'Navigate to the app root and find the organizer/admin area. Try obvious routes (/admin, /dashboard, /organizer) and nav links (Organizer, Admin, Dashboard, Events, Manage). If open signup exists, sign up as organizer Jordan Alvarez using the fixture email and password; otherwise sign in with the organizer fixture credentials.',
            'Locate or create the event "DevFlow Conf 2027" using the fixture event details (dates 2027-05-12 to 2027-05-14, Moscone West SF). Fill only what the form requires.',
            'Open the speakers area for the event. It may be called Speakers, People, Participants, Contacts, or Roster. Screenshot its empty or initial state.',
            'Add speaker Priya Raman manually using her fixture data (name, email, title "Principal Engineer", company "Latticework Systems", full bio; fill Twitter/LinkedIn if fields exist). Screenshot the filled form BEFORE saving, then the saved record.',
            'Add speaker Marcus Okafor the same way with his fixture data (name, email, title, company, bio).',
            'Look for a bulk import control (Import, Upload CSV, Import speakers). If found, upload the speakers.csv fixture, mapping columns if prompted. Screenshot the import flow and the roster afterward showing the imported rows. If no import exists, record that observation explicitly.',
            'Use the roster search (or a filter) to find "Priya". Screenshot the narrowed list, then clear it and screenshot the restored full roster.',
            "Change Priya's status to Confirmed (statuses may be named Invited/Confirmed/Accepted/ Pending or similar). Reload the page and confirm the status persisted. If the roster has a status filter, apply it for Confirmed and screenshot the result.",
            'Open Priya\'s record and edit her bio by appending the sentinel text "SBEK-ORG-EDIT-01". Save, reload, and verify the sentinel persists. Screenshot after reload.',
            'Create or link a session titled "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" and assign Priya as its speaker (via her record, a Sessions area, or wherever the clone allows). If room/time fields are easy to set, use Room 2A on 2027-05-12 — creating the room first if the clone requires rooms to exist before they can be selected (rooms are otherwise first configured in the agenda area). Screenshot Priya\'s record or the session showing the speaker-session link.',
            'Find the tasks area (Tasks, Checklist, To-dos). Create three GENERAL/action tasks from the fixture speaker task list, each assigned to BOTH Priya and Marcus (use multi-select or bulk assignment if offered): a. "Confirm participation" - due 2027-04-01. b. "Complete bio and profile" - due 2027-04-01. c. "Sign speaker release form" - due 2027-04-15. Create these as plain mark-complete tasks, NOT file-request/upload tasks — the file-request pipeline is exercised and graded in the content-management area. Screenshot at least one filled creation form and the resulting task list showing titles, due dates, and both assignees.',
            "Look for a portal invitation control (Invite, Send portal invite, Send welcome email) on Priya's record or as a bulk action. Trigger it for Priya and screenshot the success/confirmation state. Check whether the send appears in any communications history or activity log and screenshot if so. If no explicit invite control exists, record how speakers are expected to reach their portal (e.g. self-signup or link).",
          ],
        },
        {
          id: 'SPK-S2',
          name: 'Speaker completes onboarding in the portal',
          persona: 'speaker',
          steps: [
            'Navigate to the app root and find the speaker-facing entry point (Portal, Speaker login, My account, Sign in). Try signing in as Priya Raman with the fixture speaker email and password. If her account does not exist yet, sign up with her fixture email and password (the organizer added her to the roster in a prior scenario; clones may link the portal account by email).',
            'Screenshot the portal home/dashboard. Verify it identifies Priya (name, initials, or photo) and is a speaker-facing view, not the organizer admin UI.',
            "Verify scoping: the portal should show only Priya's own profile, sessions, and tasks. Explicitly check that Marcus Okafor's name and tasks appear nowhere in the portal (nor Dana Kowalski's, if the CSV import in the earlier scenario succeeded). Record this observation.",
            'Find her assigned session "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" (widget or tab named My Sessions, Sessions, My Submissions, or similar). Screenshot it showing the title, plus room/time if displayed.',
            'Open profile editing. Change the bio to include the sentinel "SBEK-PORTAL-BIO-01", fill Twitter/LinkedIn from the fixture if fields exist, and upload the headshot.png fixture as her headshot/profile photo. Screenshot the filled form before saving, then save and screenshot the profile showing the new headshot image rendered.',
            'Reload the portal and verify the bio sentinel and headshot persist.',
            'Open the task list. Screenshot it showing the three assigned tasks with their due dates and incomplete/pending status.',
            'Complete "Confirm participation" using its completion control (Mark as Complete, Confirm, or checkbox). Screenshot the task before and after the status flips.',
            'Complete "Complete bio and profile" the same way (the profile work was already done in step 5 — this task is a mark-complete confirmation, not a file upload; the headshot flows through profile editing, never through a file-request task in this area). Verify the status flips. Screenshot.',
            'Deliberately leave "Sign speaker release form" incomplete so the organizer dashboard will show mixed completion in the next scenario.',
            'Reload the task list and verify the two completed states persisted. Screenshot the final task list (2 complete, 1 incomplete with its due date).',
          ],
        },
        {
          id: 'SPK-S3',
          name: 'Organizer tracks progress and sends bulk communications',
          persona: 'organizer',
          steps: [
            'Sign in as organizer Jordan Alvarez (fixture credentials from the earlier scenario) and open the DevFlow Conf 2027 event.',
            'Open Priya Raman\'s speaker record. Verify the portal-side edits synced to the organizer view: the bio contains "SBEK-PORTAL-BIO-01" and the headshot uploaded from headshot.png is displayed. Screenshot the record.',
            'Open the task progress view (a tasks dashboard, tasks tab, or completion indicators on the roster). Verify mixed statuses are visible WITHOUT opening each record: Priya shows completed tasks ("Confirm participation", "Complete bio and profile") while "Sign speaker release form" and all of Marcus\'s tasks show incomplete. Screenshot at list level.',
            'If status filters exist, filter to incomplete/pending and screenshot, then filter to complete and screenshot. Record if filters are absent.',
            'Locate the headshot file Priya uploaded via her portal profile edit, wherever the clone stores speaker files (her record or a files area). Verify it is listed with metadata (filename and uploader or timestamp) and that a download/view control exists; click it and note whether it responds without error (do not try to open the file contents). Screenshot the file listing.',
            'Open the communications/email area and compose a general bulk email. Select ALL speakers as recipients via a filter or multi-select. If templates are supported, pick or create one using merge fields (for example first name, session, or portal-link tokens) and open a per-recipient preview to check tokens resolve to real speaker data - screenshot both the tokenized body and the resolved preview. Set subject "Welcome to DevFlow Conf 2027 speakers" with a short welcome body, and send (or schedule). Screenshot the recipient selection and the success state. Do NOT frame this as a deliverables reminder — reminder emails to speakers with outstanding tasks are exercised and graded in the content-management area (CNT-08).',
            'Open the communications history/log and verify the send is recorded with recipients and a timestamp. Screenshot the log entry.',
            'Back on Priya\'s record, look for travel-preference, logistics, or custom fields. If present, enter "Arrival May 11, aisle seat; dietary: Vegetarian" and save, reload, and verify persistence; screenshot. If absent, look for a custom-field settings area and record the observation either way.',
            'Bonus observations (record, do not deep-test): whether a per-speaker deadline extension control exists on a task assignment, and whether task/document-request types include contract or certificate-of-insurance style requests.',
          ],
        },
      ],
      criteria: [
        {
          id: 'SPK-01',
          criterion:
            'Organizer speaker roster lists all speakers with identity info and supports search or filtering',
          weight: 3,
          type: 'exists',
          scenarios: ['SPK-S1'],
          passCriteria:
            'A dedicated speakers area renders the added speakers with name plus at least title/company, and a search or filter narrows the list to matching speakers and restores it when cleared. (No headshot thumbnail is expected here - none has been uploaded yet at this point in the flow.)',
          expectedEvidence:
            'Screenshots of the full roster, the narrowed list with the query visible, and the restored list after clearing.',
          productStatus: 'Verified',
          programkitEvidence:
            '/people` lists identity, title, company, workflow status, roles, readiness, sessions, and update time. Search and status views narrow the live roster.',
        },
        {
          id: 'SPK-02',
          criterion: 'Organizer can add a speaker with profile fields and organizer edits persist',
          weight: 3,
          type: 'crud',
          scenarios: ['SPK-S1'],
          passCriteria:
            "Manual add-speaker flow accepts at least name, email and bio, and the saved record displays them; job title and company are accepted either on the same form OR on the speaker's profile/detail view afterwards (SessionBoard itself only captures them on the full profile, so requiring them on the quick-create form would penalise a faithful implementation); and an organizer bio edit (sentinel SBEK-ORG-EDIT-01) survives a page reload.",
          expectedEvidence:
            'Screenshot of the filled add form, the saved record, and the record after reload showing the sentinel text.',
          productStatus: 'Verified',
          programkitEvidence:
            'The add and edit drawers persist the required profile fields. Core tests cover manual creation and later edits.',
        },
        {
          id: 'SPK-03',
          criterion: 'Speakers can be bulk-imported from a CSV file',
          weight: 2,
          type: 'bulk',
          scenarios: ['SPK-S1'],
          passCriteria:
            'An import control accepts the speakers.csv fixture (with or without a column-mapping step) and the roster afterward contains the CSV speakers. The fixture CSV repeats the two manually added speakers (Priya, Marcus) plus one new person (Dana Kowalski): Dana appearing as a new record is the pass signal, and merging or skipping the two existing rows by email (dedupe) is acceptable and must not be penalized; duplicate rows for Priya/Marcus are also acceptable for this item.',
          expectedEvidence:
            'Screenshots of the import flow and the roster before/after showing the new Dana Kowalski row; agent observation if no import control exists (fail).',
          productStatus: 'Verified',
          programkitEvidence:
            'The CSV importer parses quoted fields, previews valid rows and duplicates, and deduplicates by email during one atomic import.',
        },
        {
          id: 'SPK-04',
          criterion:
            'Speakers carry a workflow status that can be changed, persists, and is filterable',
          weight: 2,
          type: 'crud',
          scenarios: ['SPK-S1'],
          passCriteria:
            "A status control (e.g. Invited/Confirmed/Accepted or equivalent vocabulary) changes Priya's status, the new status survives reload, and a status filter (if the roster has filters) correctly narrows membership. Custom-status creation is a bonus, not required.",
          expectedEvidence:
            'Screenshots of the status control, the updated badge after reload, and the status-filtered roster.',
          productStatus: 'Verified',
          programkitEvidence:
            'Participation status changes persist and drive the confirmed and awaiting-reply roster views.',
        },
        {
          id: 'SPK-05',
          criterion:
            "Organizer can create general/action tasks with due dates and assign them to multiple speakers (file-request tasks, uploads, and the deliverables pipeline are owned by content-management's CNT-01/02/07)",
          weight: 2,
          type: 'crud',
          scenarios: ['SPK-S1'],
          passCriteria:
            'Task creation supports a title, a due date, and assignment to at least two speakers (multi-select or repeated assignment both acceptable). The three fixture general tasks appear in an organizer task list with due dates and assignees. No file-request/upload task type is required here — that capability is graded once, by CNT-01.',
          expectedEvidence:
            'Screenshot of a filled task creation form and of the task list showing three general tasks, due dates, and both assignees.',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizers create a dated action item once and assign it to multiple speakers. The task list shows due date, assignees, and aggregate progress.',
        },
        {
          id: 'SPK-06',
          criterion: 'Organizer can send a speaker a portal invitation or onboarding email',
          weight: 2,
          type: 'side-effect',
          scenarios: ['SPK-S1'],
          passCriteria:
            'An explicit invite/welcome-email control exists (per-speaker or bulk), reports success when triggered, and ideally logs the send in a communications or activity history. Email delivery itself is not agent-verifiable.',
          expectedEvidence:
            'Screenshot of the invite control and its success state; history/log entry if present. Agent observation of the intended portal-access path if no invite control exists.',
          productStatus: 'Verified',
          programkitEvidence:
            'Each speaker record has an explicit Send portal invite action. One operation creates a personalized one-recipient communication containing the private portal URL, records it in history, queues it in the durable outbox, and reports success in place.',
        },
        {
          id: 'SPK-07',
          criterion: 'Each speaker gets a personalized portal scoped to only their own content',
          weight: 3,
          type: 'scoping',
          scenarios: ['SPK-S2'],
          passCriteria:
            "Logging in as Priya lands on a speaker-facing view (distinct from the organizer admin) that identifies her and lists her own tasks/sessions/profile, with no other speaker's name, tasks, or data visible anywhere in the portal. Any speaker-scoped access mechanism passes (invite link, magic link, or password login), but the agent can only exercise password sign-in/sign-up; if the clone's only portal access is a link delivered by email, the agent cannot reach the portal and this item falls to the manual half.",
          expectedEvidence:
            "Screenshot of the portal home showing Priya's identity and content, plus the agent's recorded observation that Marcus's (and, if imported, Dana's) data is absent. If the portal was unreachable without an emailed link, the agent's observation of that access path.",
          productStatus: 'Verified',
          programkitEvidence:
            'The capability URL `/portal/{participationId}/{portalAccessKey}` renders a distinct speaker surface. Its server projection contains only that participant, their requirements, and their sessions. Invalid capabilities receive 403.',
        },
        {
          id: 'SPK-08',
          criterion:
            "Speaker can update bio, social links, and headshot from the portal, and the changes appear on the organizer's record",
          weight: 3,
          type: 'roundtrip',
          scenarios: ['SPK-S2', 'SPK-S3'],
          passCriteria:
            "Portal profile editing saves the sentinel bio SBEK-PORTAL-BIO-01 and the uploaded headshot.png (image renders after save and survives reload), and the organizer's view of Priya's record later shows the same bio text and headshot without manual re-entry.",
          expectedEvidence:
            'Screenshots of the portal profile after save and reload (sentinel plus rendered headshot) and of the organizer-side record in SPK-S3 showing the same data.',
          productStatus: 'Verified',
          programkitEvidence:
            'Bio changes round-trip between the portal and organizer view and automatically satisfy the bio requirement. Speakers can upload JPEG, PNG, or WebP headshots to R2, and the profile requirement updates immediately.',
        },
        {
          id: 'SPK-09',
          criterion:
            "Assigned general tasks appear in the speaker portal with due dates and can be marked complete with persistent status (the file-request upload flow is graded by content-management's CNT-02)",
          weight: 2,
          type: 'crud',
          scenarios: ['SPK-S2'],
          passCriteria:
            "All three organizer-assigned general tasks show in Priya's portal with due dates and an incomplete state; marking two of them complete flips each to a completed state that survives a reload, while the untouched task stays incomplete. No upload-against-task flow is required here — that capability is graded once, by CNT-02.",
          expectedEvidence:
            'Screenshots of the task list with due dates before completion, individual tasks before/ after their status flips, and the reloaded list showing 2 complete / 1 incomplete.',
          productStatus: 'Verified',
          programkitEvidence:
            'Assigned tasks show their due dates in the private portal. Self-completable tasks persist directly as complete and non-self-completable work still follows submit-and-review.',
        },
        {
          id: 'SPK-10',
          criterion: 'Organizer can see and download a speaker-uploaded deliverable with metadata',
          weight: 2,
          type: 'roundtrip',
          scenarios: ['SPK-S3'],
          passCriteria:
            'The headshot file Priya uploaded via her portal profile edit is listed organizer-side (on her record or a files area) with its filename plus uploader and/or timestamp, and a download/view control responds without error. File content integrity is not agent-verifiable.',
          expectedEvidence:
            'Screenshot of the file listing with metadata and the download control; agent note on the click outcome (no error page).',
          productStatus: 'Verified',
          programkitEvidence:
            "The organizer speaker drawer lists uploaded files with filename, kind, size, date, and a direct view link served from the event's R2-backed asset endpoint.",
        },
        {
          id: 'SPK-11',
          criterion:
            "Session assignments are visible on the organizer's speaker record and in the speaker's portal",
          weight: 2,
          type: 'roundtrip',
          scenarios: ['SPK-S1', 'SPK-S2'],
          passCriteria:
            'After the organizer links the "Taming 40-Minute CI" session to Priya, the speaker-session link shows on her organizer-side record (or the session shows her as speaker), and the same session title is visible inside her portal. Room/time display is a bonus; full scheduling and conflict detection belong to the agenda area.',
          expectedEvidence:
            "Screenshot of the organizer-side speaker-session link and of the session appearing in Priya's portal.",
          productStatus: 'Verified',
          programkitEvidence:
            'Organizer records and scoped speaker portals both show linked sessions. The portal also resolves placement, room, and track when available.',
        },
        {
          id: 'SPK-12',
          criterion:
            "A progress view shows per-speaker completion of general tasks at list level and reflects portal completions (the deliverables dashboard tracking uploads with filtering depth is graded by content-management's CNT-07)",
          weight: 2,
          type: 'roundtrip',
          scenarios: ['SPK-S3'],
          passCriteria:
            'Without opening each record, the organizer can see which speakers completed which general tasks: Priya\'s two portal completions from SPK-S2 ("Confirm participation", "Complete bio and profile") show complete while her release form and all of Marcus\'s tasks show incomplete; a complete/incomplete filter (if present) narrows correctly. A roster-level completion indicator or a tasks dashboard both qualify. Upload/deliverables tracking depth is graded once, by CNT-07.',
          expectedEvidence:
            'Screenshot of the list-level progress view showing mixed statuses across both speakers, plus each filtered state if filters exist.',
          productStatus: 'Verified',
          programkitEvidence:
            '/readiness` shows the status of every assigned requirement without opening individual records. Unassigned tasks render as not assigned and do not lower readiness.',
        },
        {
          id: 'SPK-13',
          criterion:
            "Organizer can send a general bulk email (e.g. a welcome/announcement to all speakers) to a selected or filtered speaker group and the send is logged (deliverables-reminder emails to speakers with outstanding tasks are owned by content-management's CNT-08)",
          weight: 2,
          type: 'bulk',
          scenarios: ['SPK-S3'],
          passCriteria:
            'A compose flow lets the organizer choose recipients from the speaker list (filter or multi-select), accepts the fixture welcome subject ("Welcome to DevFlow Conf 2027 speakers") and a body, reports a successful send (or schedule), and a communications history records the message with recipients and timestamp. Inbox delivery is not agent-verifiable.',
          expectedEvidence:
            'Screenshots of recipient selection, the compose form, the send success state, and the history/log entry.',
          productStatus: 'Verified',
          programkitEvidence:
            'Communications supports filtered audiences, custom recipient sets, approval, delivery state, recipient count, history, attempt count, provider ID, retry visibility, and personalized calendar attachments. A production welcome campaign completed the approval flow and reached Gmail with resolved speaker, event, session, and portal values.',
        },
        {
          id: 'SPK-14',
          criterion: 'Email templates with merge fields personalize content per recipient',
          weight: 1,
          type: 'depth',
          scenarios: ['SPK-S3'],
          passCriteria:
            'The compose flow offers saved or pre-built templates whose bodies contain personalization tokens (name, session, or portal link), and a preview or rendered output demonstrably resolves tokens to a real speaker\'s data (e.g. "Priya").',
          expectedEvidence:
            'Screenshot of the template body showing tokens and of a per-recipient preview showing resolved values.',
          productStatus: 'Verified',
          programkitEvidence:
            'Compose offers reusable welcome, portal, task, and calendar templates with merge tokens plus a recipient switcher that resolves subject, body, session, event, private portal link, and the exact `.ics` attachment against real speaker data.',
        },
        {
          id: 'SPK-15',
          criterion:
            'Speaker records can store travel-preference or custom logistics fields that persist',
          weight: 1,
          type: 'depth',
          scenarios: ['SPK-S3'],
          passCriteria:
            'A travel/logistics field or a generic custom field on the speaker record accepts the sample logistics text, and the value survives save and reload. No flight or hotel booking UI is expected; SessionBoard itself scopes travel booking out (inferred CRM data fields only).',
          expectedEvidence:
            "Screenshot of the saved profile after reload showing the travel/custom field value, or the agent's observation that no such field or custom-field settings exist (fail).",
          productStatus: 'Verified',
          programkitEvidence:
            'Each organizer speaker record includes a private travel and logistics field. It persists on the event participation record and is stripped from participant-facing projections.',
        },
        {
          id: 'SPK-16',
          criterion:
            'Automated reminder emails go to speakers with incomplete tasks based on due dates',
          weight: 1,
          type: 'side-effect',
          scenarios: [],
          passCriteria:
            'Without any organizer manually sending a message, a speaker with an incomplete task due soon (or overdue) receives a reminder email referencing the task and its due date within the expected reminder window; the automated send also appears in the communications history if the clone has one.',
          expectedEvidence:
            'Copy or screenshot of the received reminder email showing task name and due date, plus the history/log entry if available.',
          productStatus: 'Verified',
          programkitEvidence:
            'New tasks enable automatic reminders by default. Per-event Durable Object alarms queue one personalized reminder at the active due-date window, skip completed work, deliver through Cloudflare Email, retry failures, and expose the result in Communications. A production reminder reached a controlled Gmail inbox with its resolved task, due date, event, and private portal link.',
        },
      ],
      proof: [
        {
          title: 'Open the speaker roster',
          image: './screenshots/programkit/people.jpg',
          route: '/people',
        },
        {
          title: 'Enter the private portal',
          image: './screenshots/programkit/speaker-portal.jpg',
          route: '/portal/par_003/portal_003_per_003',
        },
        {
          title: 'Complete onboarding work',
          image: './screenshots/programkit/speaker-portal-progress.jpg',
          route: '/portal/par_003/portal_003_per_003',
        },
        {
          title: 'Check readiness',
          image: './screenshots/programkit/readiness.jpg',
          route: '/readiness',
        },
        {
          title: 'Prepare a communication',
          image: './screenshots/programkit/communications-compose.jpg',
          route: '/communications',
        },
      ],
    },
    {
      area: 'content-management',
      title: 'Content Management & Speaker Deliverables',
      prefix: 'CNT',
      areaWeight: 15,
      optional: false,
      overview:
        "Owns the post-acceptance content lifecycle: organizers request session deliverables (slides, headshots) from speakers via file-request tasks with due dates, speakers upload files through a personalized portal with per-file versioning and comments, and organizers track who has and hasn't submitted on a filterable deliverables dashboard with bulk reminder emails. It also covers centralized editing of session and speaker content (titles, abstracts, bios, photos) with timestamped change history and restore, an internal approval status that gates what appears on the public agenda, a central files library aggregating all uploads, and bulk ZIP export of the latest file versions for AV/web teams. Ownership boundary: this area owns file-request tasks, uploads, the deliverables dashboard, and deliverables-reminder emails; general/action onboarding tasks and general bulk speaker comms (e.g. welcome emails) are owned by the speaker-management spec. Scenarios chain: the organizer sets up collection (S1), a speaker uploads and versions a deck (S2), and the organizer tracks, reminds, reviews, approves, and exports (S3).",
      scenarios: [
        {
          id: 'CNT-S1',
          name: 'Organizer sets up content collection',
          persona: 'organizer',
          steps: [
            'Navigate to the site root. Find the organizer/admin area - try obvious routes (/admin, /dashboard, /organizer) and nav links labeled Admin, Dashboard, Manage, or Organizer.',
            "Sign in as organizer Jordan Alvarez using the fixture credentials. If no account exists and the clone offers open signup, sign up first with Jordan's fixture identity and email.",
            'Find or create the event "DevFlow Conf 2027" (2027-05-12 to 2027-05-14, Moscone West SF) from the sample data.',
            'Ensure at least two sessions with two DISTINCT speakers exist. For Priya Raman: reuse the accepted "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" session if it exists from earlier areas; otherwise create it directly as an accepted/confirmed session (Talk, Platform & Infra) with her fixture email. For Marcus Okafor: if "Your AI Pair Programmer Is Lying to You" already exists from earlier areas it belongs to Priya Raman (and may carry a Rejected decision) — do NOT reassign or reuse it. Instead create a NEW accepted session owned by Marcus from fixture values: "Lightning: Agents in Production Q&A" (Lightning Talk (10 min), track AI Engineering) with his fixture email — the same extra session area 05 (ai-agenda) uses. Use the fixture emails so speaker accounts link to these sessions. Screenshot the session list.',
            'Find the content/file-collection settings - the area may be called Files, Content, Deliverables, Tasks, or Speaker Tasks. If there is an enable-file-uploads toggle (SessionBoard: Sessions > Settings > Files), turn it on and screenshot it.',
            'Create a file-request task named "Upload Session Presentation" with instructions "Final slide deck as a PDF, 16:9 aspect ratio." and due date 2027-05-01 (the fixture slides deadline), assigned to all speakers (or auto-assigned per session). Screenshot the filled task form before saving.',
            'Create a second task "Upload Final Headshot (print quality)" with due date 2027-04-14, assigned to all speakers. (The distinct name is deliberate: it must not be confused with any headshot handling from the speaker-management area, where the headshot flows through profile editing.)',
            'Open the deliverables/task tracking dashboard (may be called Speaker Tasks, Deliverables, Tasks, or Progress). Verify both tasks appear for both speakers with due dates and an incomplete/pending status. Screenshot the full dashboard.',
          ],
        },
        {
          id: 'CNT-S2',
          name: 'Speaker uploads and versions a deliverable',
          persona: 'speaker',
          steps: [
            'Navigate to the site root. Sign in as speaker Priya Raman using the fixture credentials; if no account exists, sign up with her fixture identity/email, or follow any speaker invite link the clone surfaces in its own UI (do not rely on emailed links - email is not readable).',
            'Find the speaker portal - may be called My Tasks, Speaker Portal, My Sessions, or Dashboard. Screenshot the task list showing "Upload Session Presentation" and "Upload Final Headshot (print quality)" with their due dates and incomplete status.',
            'Open the upload flow for the "Upload Session Presentation" task (for the "Taming 40-Minute CI" session). Before uploading, record and screenshot any stated file constraints (accepted file types, maximum file size) shown in the upload UI or its help text.',
            'Upload the slides.pdf fixture against that task. Screenshot the state after upload: filename listed and task showing uploaded/complete.',
            'Add a comment on the uploaded file: "Draft deck - final version coming Friday." Screenshot the comment showing author name and timestamp.',
            "Upload slides.pdf again to the same deliverable slot (replace/new version). Open the file's version list and verify two versions with timestamps and the latest clearly marked. Screenshot the version list.",
            'If there is an explicit mark-complete action on the presentation task, use it. Deliberately leave "Upload Final Headshot (print quality)" incomplete.',
            "Scoping check: browse the portal for any trace of Marcus Okafor's sessions or tasks and screenshot the portal navigation/scope. Then try to open organizer/admin routes directly (/admin, /organizer, /dashboard variants, and any admin-looking links). Screenshot the resulting block, redirect, or denial.",
            'Screenshot the final portal state: presentation task complete/uploaded with a 2-version file, headshot task still open with its due date.',
          ],
        },
        {
          id: 'CNT-S3',
          name: 'Organizer tracks, reviews, approves, and exports',
          persona: 'organizer',
          steps: [
            'Sign in as organizer Jordan Alvarez (fixture credentials).',
            'Open the deliverables tracking dashboard. Verify statuses reflect S2: Priya Raman shows "Upload Session Presentation" complete/uploaded and "Upload Final Headshot (print quality)" incomplete; Marcus Okafor shows both incomplete. Screenshot the unfiltered dashboard.',
            'Apply a filter (incomplete, overdue, or by task) and screenshot the filtered view to show the visible set changed.',
            'Trigger the bulk reminder action for speakers with outstanding tasks - select the incomplete rows if required, pick a template if a picker appears, and send. Screenshot the send confirmation (toast, dialog, or sent count). Do not attempt to verify email delivery.',
            'Open the central files library (may be Library > Files, Files, Content, or Assets). Verify slides.pdf is listed with its session and speaker association, upload date, and a version count of 2. Screenshot the library. If sessions have a per-session Files tab, open it on "Taming 40-Minute CI" and screenshot it too.',
            'Open the uploaded file\'s detail. Verify Priya\'s S2 comment is visible with her name and timestamp, then reply "Thanks - please confirm the final version by Tuesday." Screenshot the thread. Confirm the version list shows both versions with the latest marked and the older version still individually accessible (a view/download control exists - do not download).',
            'Content editing: open the "Taming 40-Minute CI" session, change the title to start with "UPDATED: " and append this sentence to the abstract: "This session now includes a live demo of remote build caching." Save, navigate away, then reopen the session. Screenshot the reloaded detail and the session list showing the new title.',
            'Make a second distinct edit to the same abstract (append "Attendees should bring a laptop.") and save.',
            'Open the session\'s version/change history or activity panel. Verify at least two timestamped entries attributed to Jordan Alvarez. Restore the version prior to the second edit and verify the abstract loses the "Attendees should bring a laptop." sentence but keeps the live-demo sentence. Screenshot the history panel and the restored abstract.',
            'Speaker profile editing: open Priya Raman\'s speaker record, append to her bio "Priya leads the developer-productivity group at Latticework Systems." and replace/upload her photo using the headshot.png fixture. Save, reload, and screenshot the updated record.',
            "Approval: set the \"Taming 40-Minute CI\" session's content status to Approved (or the clone's equivalent published/final state) and leave Marcus's session unapproved. Screenshot the status control on both sessions.",
            'Open the public agenda/schedule page - may be /agenda, /schedule, a "public page" or "preview" link, or an embed preview. Verify the approved session appears with its UPDATED title and the unapproved session does not appear. Screenshot the public listing. If no public agenda exists yet because the agenda has not been built or published (that happens in a later area), verify the approval gate on whatever public sessions/preview surface exists (a public sessions list or embed preview); if no public surface exists at all yet, record that observation explicitly so the judge can defer CNT-12 to the area-06 evidence.',
            'Distribution: from the sessions or files view, multi-select the items with uploads and invoke the bulk download action (Download Files, Export, or similar). If a dialog offers grouping (folder per session/speaker), pick one and screenshot the dialog; deselect one file if the dialog allows it. Trigger the generation (Generate Download or equivalent) and screenshot the queued/generating/ready confirmation. Do NOT download or inspect the ZIP contents.',
            'Bonus evidence: if a file row or detail offers a share-link action, generate/copy the link and screenshot it.',
            'Cleanup for later areas: edit the "Taming 40-Minute CI" session title one final time to remove the "UPDATED: " prefix, restoring the exact original title "Taming 40-Minute CI: Incremental Builds at Monorepo Scale" (later areas look this session up by its original title). Keep the abstract as-is. Save and screenshot the session list showing the restored title.',
          ],
        },
      ],
      criteria: [
        {
          id: 'CNT-01',
          criterion:
            'Organizer can create a file-request task with instructions and a due date, assigned to speakers.',
          weight: 3,
          type: 'crud',
          scenarios: ['CNT-S1'],
          passCriteria:
            'Both fixture tasks ("Upload Session Presentation" due 2027-05-01, "Upload Final Headshot (print quality)" due 2027-04-14) exist after creation with correct names, due dates, and speaker assignment, shown as incomplete/pending.',
          expectedEvidence:
            'Screenshot of the filled task-creation form and of the task/deliverables list showing both tasks with due dates and assignees.',
          productStatus: 'Verified',
          programkitEvidence:
            '/readiness` creates reusable file requests with instructions, a due date, optional session scope, file constraints, and an exact speaker selection. One definition creates a separate tracked instance for every assignee.',
        },
        {
          id: 'CNT-02',
          criterion:
            "Speaker portal lists the speaker's assigned tasks with deadlines and accepts a file upload recorded against the task/session.",
          weight: 3,
          type: 'crud',
          scenarios: ['CNT-S2'],
          passCriteria:
            "Priya's portal shows both assigned tasks with due dates and status; uploading slides.pdf succeeds and the file appears attached to the presentation task/session with the task status updating to uploaded/complete.",
          expectedEvidence:
            'Before/after screenshots of the portal task list and the post-upload state showing the slides.pdf filename against the task.',
          productStatus: 'Verified',
          programkitEvidence:
            "The private speaker portal lists only that speaker's assigned tasks and due dates. File requests accept an R2-backed upload against the requirement and immediately move the instance to submitted.",
        },
        {
          id: 'CNT-03',
          criterion:
            'Speaker access is scoped to their own sessions and tasks, and organizer/admin views are blocked for speaker accounts.',
          weight: 3,
          type: 'scoping',
          scenarios: ['CNT-S2'],
          passCriteria:
            "Priya's portal shows no sessions or tasks belonging to Marcus Okafor, and direct navigation to admin/organizer routes is denied, redirected, or shows no admin capability while signed in as the speaker.",
          expectedEvidence:
            "Screenshot of the portal scope (only Priya's session/tasks visible) and of the blocked/redirected admin route.",
          productStatus: 'Verified',
          programkitEvidence:
            'Portal projections contain one participation, its person, sessions, requirements, assets, and comments. Capability checks guard every portal read and mutation; hosted organizer routes still require staff authentication.',
        },
        {
          id: 'CNT-04',
          criterion:
            'Re-uploading a deliverable creates a new file version, with the latest clearly marked and previous versions still accessible.',
          weight: 2,
          type: 'rule',
          scenarios: ['CNT-S2', 'CNT-S3'],
          passCriteria:
            'After the second slides.pdf upload, a version list shows two entries with timestamps, the latest is flagged as current, and the older version remains individually viewable/downloadable (a control exists) rather than being overwritten.',
          expectedEvidence:
            'Screenshot of the version list from the speaker side (S2) and the organizer side (S3) showing 2 versions with the latest marked.',
          productStatus: 'Verified',
          programkitEvidence:
            'Re-uploading the same requirement creates another immutable asset version. The portal and organizer file drawer list every version, mark the latest, and retain an individual download action for older versions.',
        },
        {
          id: 'CNT-05',
          criterion:
            'Comments can be attached to an uploaded file, are logged with author name and timestamp, and are visible across roles.',
          weight: 2,
          type: 'roundtrip',
          scenarios: ['CNT-S2', 'CNT-S3'],
          passCriteria:
            "The speaker's comment (\"Draft deck - final version coming Friday.\") appears with Priya's name and a timestamp, the organizer sees the same thread on the same file, and the organizer's reply is added to it. Do not require email notification of comments (SessionBoard itself sends none).",
          expectedEvidence:
            'Screenshots of the comment thread from the speaker account (S2) and the organizer account showing the original comment plus reply (S3).',
          productStatus: 'Verified',
          programkitEvidence:
            'asset.comment` stores an attributed author and timestamp. Speaker and organizer views resolve the same thread across every version in the requirement slot and both roles can reply.',
        },
        {
          id: 'CNT-06',
          criterion:
            'The upload UI communicates file constraints (accepted types and/or a maximum file size) to the speaker at the point of upload.',
          weight: 1,
          type: 'depth',
          scenarios: ['CNT-S2'],
          passCriteria:
            "Some explicit constraint statement is visible in or around the upload control - e.g. accepted file types, a max size such as SessionBoard's 1.95 GB per-file limit, or a file-picker type filter the agent observed. Fail if no constraint is communicated anywhere in the upload flow.",
          expectedEvidence:
            'Screenshot of the upload dialog/help text captured in S2 step 3 showing the stated constraint.',
          productStatus: 'Verified',
          programkitEvidence:
            'The upload control states the accepted types and configured maximum size before selection. The server enforces the same content-type allowlist and byte limit.',
        },
        {
          id: 'CNT-07',
          criterion:
            'A deliverables dashboard tracks per-speaker per-task status with due dates, supports filtering, and reflects uploads.',
          weight: 3,
          type: 'roundtrip',
          scenarios: ['CNT-S1', 'CNT-S3'],
          passCriteria:
            "The dashboard shows all speaker-task pairs as incomplete in S1, and in S3 accurately reflects the S2 state: Priya's presentation task complete/uploaded (either label passes - clones without an explicit mark-complete action must not be penalized), her headshot task incomplete, Marcus's tasks incomplete; applying a filter visibly changes the displayed set.",
          expectedEvidence:
            'S1 screenshot of the all-incomplete dashboard; S3 screenshots of the updated dashboard unfiltered and filtered.',
          productStatus: 'Verified',
          programkitEvidence:
            '/readiness` derives the full speaker-by-task matrix, deadlines, progress, and status from live requirement instances. All, incomplete, overdue, and review filters visibly change the result set.',
        },
        {
          id: 'CNT-08',
          criterion:
            'Organizer can trigger bulk reminder emails to speakers with outstanding tasks and receives a send confirmation.',
          weight: 2,
          type: 'bulk',
          scenarios: ['CNT-S3'],
          passCriteria:
            'A bulk reminder action is available from the dashboard for incomplete/outstanding tasks (with or without a template picker) and the UI confirms the send (toast, dialog, or sent count). Actual delivery is verified manually.',
          expectedEvidence:
            'Screenshot of the reminder action being invoked on the filtered incomplete set and of the send confirmation.',
          productStatus: 'Verified',
          programkitEvidence:
            "The outstanding-task reminder path resolves each speaker's incomplete task names and due dates into personalized outbox entries. A production automatic reminder reached a controlled Gmail inbox, and the provider attempt remains visible in Communications.",
        },
        {
          id: 'CNT-09',
          criterion:
            "Organizer can edit a session's title and abstract from a central admin view and the changes persist.",
          weight: 2,
          type: 'crud',
          scenarios: ['CNT-S3'],
          passCriteria:
            'After saving, navigating away, and reopening, the session shows the "UPDATED: " title prefix and the appended live-demo sentence in the abstract, and the session list reflects the new title. (The prefix is reverted in the scenario\'s final cleanup step — judge from the mid-scenario screenshots.)',
          expectedEvidence:
            'Screenshots of the edit form, the reloaded session detail, and the session list with the updated title (captured before the final cleanup step reverts the prefix).',
          productStatus: 'Verified',
          programkitEvidence:
            'The session drawer edits title, abstract, format, duration, track, and content status. Saves use version checks and persist into both the session detail and list.',
        },
        {
          id: 'CNT-10',
          criterion:
            'Organizer can edit speaker profile content (bio text and headshot photo) from the admin area and the changes persist.',
          weight: 2,
          type: 'crud',
          scenarios: ['CNT-S3'],
          passCriteria:
            "Priya's bio shows the appended sentence and her record displays the newly uploaded headshot.png image after save and reload.",
          expectedEvidence:
            'Before/after screenshots of the speaker record showing the updated bio and photo.',
          productStatus: 'Verified',
          programkitEvidence:
            'The organizer speaker drawer edits public bio fields and now uploads or replaces a headshot directly from the admin surface. Staff uploads use the same R2/versioned asset pipeline, refresh the avatar, and survive reload.',
        },
        {
          id: 'CNT-11',
          criterion:
            'Content edits are recorded in a version/change history with editor attribution and timestamps, and a prior version can be restored.',
          weight: 2,
          type: 'depth',
          scenarios: ['CNT-S3'],
          passCriteria:
            "The history panel lists at least two distinct timestamped entries attributed to Jordan Alvarez, and restoring the earlier version removes the second edit's sentence while keeping the first edit.",
          expectedEvidence:
            'Screenshot of the history/activity panel with who/when entries and of the abstract after restore.',
          productStatus: 'Verified',
          programkitEvidence:
            'Every session edit snapshots a restorable revision with actor and timestamp. The history drawer restores an exact earlier version rather than applying a blanket undo.',
        },
        {
          id: 'CNT-12',
          criterion:
            'Sessions carry a content approval/review status the organizer can set, and unapproved content is excluded from the public agenda output. (This item grades the approval GATE, not the public widget rendering itself — that is graded by public-widgets EMB-06.)',
          weight: 3,
          type: 'rule',
          scenarios: ['CNT-S3'],
          passCriteria:
            "A status control exists and persists (exact state names may vary - draft/in-review/approved is the inferred norm); the public agenda page shows the approved session (with its updated title) and omits the unapproved one. If no public agenda exists yet at area-04 time (it is built and published in a later area), the gate may be verified on any public sessions/preview surface, or judged from the agent's recorded observation together with the area-06 public-widget evidence.",
          expectedEvidence:
            "Screenshots of the status controls on both sessions and of the public agenda (or the closest public sessions/preview surface) listing only the approved session; if no public surface exists yet, the agent's explicit deferral observation.",
          productStatus: 'Verified',
          programkitEvidence:
            'Session content status is explicit: `ready` is presented as Approved. Public agenda selection includes only approved sessions from the latest published schedule release.',
        },
        {
          id: 'CNT-13',
          criterion:
            'A central files library aggregates uploads across sessions with metadata (session/speaker, date, versions), optionally mirrored by a per-session files tab.',
          weight: 1,
          type: 'exists',
          scenarios: ['CNT-S3'],
          passCriteria:
            'A files view lists the slides.pdf upload with its session and speaker association, upload date, and a version count of 2, consistent with actual uploads; a per-session Files tab, if present, shows the same file (its absence alone does not fail the item if the aggregate library exists).',
          expectedEvidence:
            'Screenshot of the files library row for slides.pdf and, if present, the per-session Files tab.',
          productStatus: 'Verified',
          programkitEvidence:
            '/files` aggregates latest deliverables with filename, speaker, session, upload time, review status, and total version count. Its drawer exposes all versions and the cross-role comment thread.',
        },
        {
          id: 'CNT-14',
          criterion:
            'Organizer can multi-select sessions/files and generate a bulk download (ZIP) of latest file versions, with grouping options if offered.',
          weight: 2,
          type: 'bulk',
          scenarios: ['CNT-S3'],
          passCriteria:
            'The UI supports selecting multiple sessions/files and starting an export, and confirms generation (queued/generating/ready state or download start). Grouping options and file deselection are positive evidence but optional. ZIP contents are verified manually.',
          expectedEvidence:
            'Screenshots of the multi-select state, the export/grouping dialog if shown, and the generation confirmation.',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizers can multi-select latest files, review or deselect them in the export dialog, and generate a ZIP grouped as `Speaker/Task/Filename`. The shared server plan rejects stale version IDs and handles path collisions.',
        },
      ],
      proof: [
        {
          title: 'Complete a portal task',
          image: './screenshots/programkit/speaker-portal-progress.jpg',
          route: '/portal/par_003/portal_003_per_003',
        },
        {
          title: 'Review the file library',
          image: './screenshots/programkit/../appflow/10-files.jpg',
          route: '/files',
        },
        {
          title: 'Review session content',
          image: './screenshots/programkit/sessions.jpg',
          route: '/sessions',
        },
        {
          title: 'Approve communication',
          image: './screenshots/programkit/communications-approved.jpg',
          route: '/communications',
        },
      ],
    },
    {
      area: 'ai-agenda',
      title: 'AI Agenda & Schedule Builder',
      prefix: 'AIA',
      areaWeight: 10,
      optional: false,
      overview:
        'Organizer-facing agenda/schedule builder for multi-track, multi-day programs. Organizers configure the agenda structure (event days, time slots, rooms, tracks), then place accepted sessions into specific day/time/room slots via drag-and-drop or click-to-assign. The system detects scheduling conflicts as the agenda is edited -- most importantly speaker double-bookings across overlapping slots and two sessions occupying the same room at the same time -- and organizers move sessions to resolve them. Once built, the agenda is published to a public/attendee-facing schedule view. SessionBoard also markets an AI "Scheduler Agent" that auto-packs unscheduled sessions into a conflict-free draft; for this evaluation that AI layer is polish, judged only as "some assisted/auto-place capability exists".',
      scenarios: [
        {
          id: 'AIA-S1',
          name: 'Build agenda structure, place sessions, trigger and resolve conflicts',
          persona: 'organizer',
          steps: [
            'Navigate to the site root. Find the organizer/admin area -- try obvious routes (/admin, /dashboard, /organizer) and nav links labeled Dashboard, Admin, Organizer, or Manage Events. If authentication is required, sign in as organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password); if that account does not exist yet, sign up with the Jordan Alvarez fixture identity.',
            'Open the event "DevFlow Conf 2027" (2027-05-12 to 2027-05-14, Moscone West SF). If no event exists yet, create it with those fixture dates and venue.',
            'Find the agenda/schedule builder -- it may be called Agenda, Schedule, Program, Timetable, or Sessions Calendar. Screenshot the initial builder view and record what structural elements it shows (time axis, day switcher/tabs, room or track columns, unscheduled-session pool/sidebar).',
            'Configure the agenda structure. Confirm or add the three event days (May 12, 13, 14, 2027). Add the four fixture rooms (Main Stage, Room 2A, Room 2B, Workshop Lab) — rooms are normally first configured in this area, so room creation is the primary configurability evidence. The three fixture tracks (AI Engineering, Platform & Infra, Developer Experience) will usually ALREADY exist on a chained run (they are created back in area 01\'s CFP setup) — that is expected: confirm they are available, and demonstrate track configurability by adding one extra track (e.g. "Community") through the same UI (optionally deleting it afterwards), or rely on the room-creation evidence if track creation is not exposed here. These controls may live in agenda settings, event settings, or inline "+ add" controls in the grid. If the deployment also pre-seeds all fixture rooms, add one extra room (e.g. "Overflow Room") the same way. Screenshot the room/track creation UI, then screenshot the builder showing the rooms/tracks available for scheduling.',
            'Ensure at least three schedulable sessions exist. Prefer accepted sessions built from the fixture proposals ("Taming 40-Minute CI...", "Your AI Pair Programmer Is Lying to You...", "Docs That Answer Back..."). If these proposals exist from earlier areas but are NOT Accepted (e.g. "Your AI Pair Programmer" was Rejected in area 01, "Docs That Answer Back" may still be Pending), first change their status to Accepted as the organizer so they become schedulable; only create fresh sessions with the fixture titles, formats, and tracks if the proposals are absent entirely.',
            'Ensure two of those sessions share the speaker Priya Raman -- assign her to the "Taming 40-Minute CI" session and also add her as a speaker on the "Your AI Pair Programmer" session (edit the session\'s speaker list; if speakers cannot be edited on a session, create an extra session with Priya as speaker). Record whether sessions can carry speaker assignments at all.',
            'Place the "Taming 40-Minute CI" session into Day 1 (May 12) at 10:00 in Room 2A, using drag-and-drop or whatever click-to-assign mechanism the UI offers. Screenshot the grid with the session card visible in that slot.',
            'Now place the "Your AI Pair Programmer" session at the SAME day and overlapping time (Day 1, 10:00) in a DIFFERENT room (Room 2B). Both sessions now overlap while sharing speaker Priya Raman. Look carefully for any speaker double-booking indicator: a badge or highlight on the session cards, a warning toast/dialog, or an entry in a conflicts panel. Screenshot it and record its exact wording. If nothing appears, record that explicitly.',
            'Attempt to place the "Docs That Answer Back" session at Day 1, 10:00 in Room 2A -- the same room and time already occupied by the CI talk. Record whether the placement is blocked outright or a room-overlap conflict is flagged; screenshot the blocked state or the warning.',
            'Resolve the conflicts by moving sessions to free slots: move "Your AI Pair Programmer" to Day 1 at 14:00 in Room 2B, and place/move "Docs That Answer Back" to Day 2 (May 13) at 11:00 in Room 2B. After each move, screenshot the grid and record whether the earlier conflict indicators cleared, and whether they cleared live (without a full page reload).',
            'Reload the agenda builder page. Screenshot the grid to confirm every placement (all three sessions in their final slots) persisted.',
          ],
        },
        {
          id: 'AIA-S2',
          name: 'Auto-schedule assist and publish the agenda',
          persona: 'organizer',
          steps: [
            'Sign in as organizer Jordan Alvarez (as in AIA-S1) and open the "DevFlow Conf 2027" agenda builder. It should contain the placements from AIA-S1; if state was not retained, place at least two fixture sessions into slots first so the agenda is non-empty.',
            'Ensure at least one session remains unscheduled in the pool/sidebar. The pool will usually be empty here, since AIA-S1 schedules all three fixture sessions -- in that case use the extra Marcus Okafor session "Lightning: Agents in Production Q&A" if it already exists from area 04 (content-management creates it), or create it from fixture values: format "Lightning Talk (10 min)", track "AI Engineering", speaker Marcus Okafor. Leave it unplaced.',
            'Search the builder for any assisted/auto-scheduling capability -- possible labels include Auto-schedule, AI Scheduler, Auto-place, Smart Schedule, Suggest slots, Generate schedule, or an AI assistant panel. Check toolbars, overflow menus, and the unscheduled pool. Screenshot the control if found; if none exists, screenshot the toolbar/menus you checked and record its absence explicitly.',
            'If an auto-schedule action exists, trigger it and wait for completion. Screenshot the grid afterward; record whether the previously unscheduled session(s) were placed into slots/rooms and whether any conflict indicators are visible on the result.',
            'Find the publish action for the agenda -- possible labels include Publish, Publish agenda, Go live, Make public, or Share schedule. Screenshot the pre-publish state, trigger the action, and screenshot the resulting confirmation (success message, "published" status, or share link).',
            'Locate the public/attendee-facing agenda: a public link offered after publishing, an event-site page labeled Agenda or Schedule, or a share URL. Open it and screenshot the published schedule; verify the sessions placed in AIA-S1/S2 appear with their day, time, and room. This is a HANDOFF observation — the public rendering itself is graded by area 06 (EMB-06). If the page is reachable without organizer login (e.g. after signing out at the very end), note that; otherwise viewing it while logged in is acceptable evidence.',
          ],
        },
      ],
      criteria: [
        {
          id: 'AIA-01',
          criterion:
            'An agenda/schedule builder view exists for a multi-day event, showing a time dimension plus rooms and/or tracks (grid, timeline, or per-day slot list) with day navigation.',
          weight: 3,
          type: 'exists',
          scenarios: ['AIA-S1'],
          passCriteria:
            'The builder renders time slots and room/track structure and lets the organizer navigate between the three event days; sessions are represented as cards/entries positioned by day, time, and room or track.',
          expectedEvidence:
            'Screenshots from AIA-S1 steps 3-4 showing the builder layout (time axis, day switcher, room/track columns, unscheduled pool if present).',
          productStatus: 'Verified',
          programkitEvidence:
            '/schedule` derives its day switcher from the event date range and renders a room-by-time grid, an unscheduled-session pool, and a compact session-list alternative. Session cards show their exact local time, room column, track, and attendance.',
        },
        {
          id: 'AIA-02',
          criterion:
            'Rooms and tracks are configurable by the organizer, and a newly added room and track immediately become usable in the agenda builder.',
          weight: 2,
          type: 'crud',
          scenarios: ['AIA-S1'],
          passCriteria:
            "Rooms and tracks can be created through the organizer UI -- the four fixture rooms (fresh in this area on a chained run) plus, where the fixture tracks already exist from an earlier area's setup or from pre-seeding, the extra track (and room, if rooms were pre-seeded too) added in step 4 -- and a newly added room appears as a schedulable location while a track can be assigned to or shown on a session. On a chained run, room-creation evidence plus confirmed availability of the pre-existing tracks satisfies this item; do not require re-creating tracks that already exist.",
          expectedEvidence:
            'Screenshots of the room/track creation forms and of the builder afterward showing the new rooms available and a track label visible on a session or in a filter.',
          productStatus: 'Verified',
          programkitEvidence:
            'Event settings exposes organizer forms for tracks and rooms. New records are written through `track.create` and `room.create`, scoped to the active event, and appear immediately in session editing, placement controls, filters, and schedule columns.',
        },
        {
          id: 'AIA-03',
          criterion:
            'An unscheduled session can be placed into a specific day/time/room slot, and the placement persists across a page reload.',
          weight: 3,
          type: 'crud',
          scenarios: ['AIA-S1'],
          passCriteria:
            'The "Taming 40-Minute CI" session is placed at Day 1 10:00 in Room 2A via drag-and-drop or click-to-assign, its card renders in that slot with its title, and it is still there after the builder page is reloaded in step 11.',
          expectedEvidence:
            'The step 3-4 builder screenshots (pre-placement state), the step-7 screenshot showing the session card in its Day 1 10:00 Room 2A slot, and the post-reload grid screenshot (step 11) showing the same placement.',
          productStatus: 'Verified',
          programkitEvidence:
            'Organizers can open an unscheduled session, choose an event-local date and time plus room, and place it. The resulting durable placement appears in the grid and reloads from the event workspace. Desktop cards can also be dragged between slots.',
        },
        {
          id: 'AIA-04',
          criterion:
            'Scheduling the same speaker into two time-overlapping sessions produces a visible speaker double-booking warning.',
          weight: 3,
          type: 'rule',
          scenarios: ['AIA-S1'],
          passCriteria:
            'When the two Priya Raman sessions overlap at Day 1 10:00 (different rooms), a conflict indicator appears without requiring a manual page refresh (or at latest on save) and identifies the double-booked speaker or the clashing sessions; agent observations record its wording.',
          expectedEvidence:
            'Screenshot from step 8 showing the conflict badge/highlight/toast/panel while both sessions overlap, with the recorded warning text naming the speaker or sessions.',
          productStatus: 'Verified',
          programkitEvidence:
            'Placement preview allows a speaker overlap to be saved but shows a visible `Speaker conflict` warning naming the shared speaker. The grid marks both affected cards and the page-level conflict callout repeats the named conflict.',
        },
        {
          id: 'AIA-05',
          criterion:
            'Placing two sessions in the same room at overlapping times is blocked or visibly flagged as a room conflict.',
          weight: 2,
          type: 'rule',
          scenarios: ['AIA-S1'],
          passCriteria:
            'The step-9 attempt to put a second session at Day 1 10:00 in Room 2A is either prevented at placement time (drop rejected, slot shown occupied) or accepted with a clearly visible room-overlap warning.',
          expectedEvidence:
            "Screenshot of the blocked placement or of the room-conflict warning from step 9, plus the agent's observation of which behavior occurred.",
          productStatus: 'Verified',
          programkitEvidence:
            'Placement preview labels a same-room overlap as unavailable and disables submission. The core operation independently rejects the mutation with `ROOM_CONFLICT`, so API clients cannot bypass the rule.',
        },
        {
          id: 'AIA-06',
          criterion:
            'A scheduled session can be moved to a different slot/room, the change takes effect, and previously flagged conflicts clear once the overlap is removed.',
          weight: 2,
          type: 'rule',
          scenarios: ['AIA-S1'],
          passCriteria:
            'The step-10 moves succeed (sessions render in their new slots), the speaker and room conflict indicators from steps 8-9 are gone afterward, and the new positions survive the step-11 reload. Live (no-reload) clearing is ideal but clearing after save/refresh still passes this item.',
          expectedEvidence:
            'Screenshots after each move showing the sessions in new slots with no remaining conflict indicators, and the post-reload screenshot confirming persistence.',
          productStatus: 'Verified',
          programkitEvidence:
            'The move drawer and drag interaction rerun conflict detection before save. A successful move updates the versioned placement immediately; the named speaker warning clears when the sessions no longer overlap and the new slot persists.',
        },
        {
          id: 'AIA-07',
          criterion:
            'The agenda can be published: a publish/go-live action exists, reports success, and the scheduled session data becomes available to the public/attendee-facing surface as a handoff. (The public schedule rendering itself — layout and correctness of the day/time/room display — is graded by public-widgets EMB-06, not here.)',
          weight: 2,
          type: 'handoff',
          scenarios: ['AIA-S2'],
          passCriteria:
            "A publish/go-live action exists and reports success (confirmation message, published status, or share link), and after publishing the sessions scheduled in AIA-S1/S2 are observable on some public/attendee-facing surface as a handoff check. Viewing while still logged in as organizer is acceptable if the page is the attendee-facing view. Do not grade the public rendering's quality or field-level correctness here — that is owned by EMB-06.",
          expectedEvidence:
            'Screenshots of the pre-publish state, the publish confirmation, and a handoff glimpse of the public agenda surface showing the fixture sessions present.',
          productStatus: 'Verified',
          programkitEvidence:
            'Publish schedule` refuses hard conflicts, snapshots approved-session placements into a new immutable schedule release, confirms success, and exposes the same release through Preview agenda, share links, and embed code.',
        },
        {
          id: 'AIA-08',
          criterion:
            'Some assisted or automatic scheduling capability exists that places unscheduled sessions into slots in one action ("AI" auto-scheduling judged generously as any auto-place assist).',
          weight: 1,
          type: 'depth',
          scenarios: ['AIA-S2'],
          passCriteria:
            "An auto-schedule/AI-assist control is present in the builder and, when triggered, places at least one previously unscheduled session into a slot/room. Judge generously -- any one-action assisted placement counts, and whether the result shows conflict flags is recorded but not gating. Fail if no such capability exists anywhere in the builder (the agent's explicit absence observation from step 3 counts as evidence) or if the control exists but performs no placement when triggered.",
          expectedEvidence:
            'Screenshot of the auto-schedule control, plus before/after grid screenshots showing the previously unscheduled session(s) now placed (noting any conflict badges); or the recorded absence observation.',
          productStatus: 'Verified',
          programkitEvidence:
            'Auto-place` is visible beside the unscheduled pool and places every session it can into a conflict-free room and 30-minute slot in one action, reporting anything that could not be placed.',
        },
      ],
      proof: [
        {
          title: 'Open schedule studio',
          image: './screenshots/programkit/schedule.jpg',
          route: '/schedule',
        },
        {
          title: 'Move a session',
          image: './screenshots/programkit/schedule-move.jpg',
          route: '/schedule',
        },
        {
          title: 'See a conflict',
          image: './screenshots/programkit/schedule-conflict.jpg',
          route: '/schedule',
        },
        {
          title: 'Publish the release',
          image: './screenshots/programkit/schedule-published.jpg',
          route: '/schedule',
        },
        {
          title: 'Open the public agenda',
          image: './screenshots/programkit/public-agenda.jpg',
          route: '/agenda',
        },
      ],
    },
    {
      area: 'public-widgets',
      title: 'Public & Embeddable Widgets',
      prefix: 'EMB',
      areaWeight: 20,
      optional: false,
      overview:
        'SessionBoard lets organizers export live, self-updating event content as five embeddable widgets that can be placed on any website or app: a searchable/filterable List of Sessions, a List of Speakers pairing each person with their sessions, a room-by-time Agenda grid, a day-tabbed Schedule Itinerary for chronological day-by-day browsing (personal-schedule building is an inferred extension), and a visual Speaker Gallery photo grid. Organizers generate each widget from an admin embeds area (in SessionBoard, CMS > Embeds — "Export a feed of your agenda, sessions, or speakers to place in your app or website") as a named, enable/disable-able embed with a copy-paste snippet ("Get Code"), in styled HTML plus basic HTML / JSON / XML / iCal formats, with branding, field selection, and content filters. Each widget renders approved event content to ordinary visitors, offers keyword search and drill-down detail views, and stays consistent with the organizer\'s source data without republishing. IMPORTANT SCOPING NOTE: these are judged as *embeddable components*, not as anonymously-reachable public pages. The requirement is that a widget renders outside the organizer admin UI to a viewer holding no organizer/admin rights — via an anonymous public page, an attendee-authenticated event site/portal, or a generated embed. Login-free anonymous access is a bonus, NOT a requirement: SessionBoard\'s own event sites require at least one login method to be enabled and cannot be made fully public, so a clone must not be penalised for gating its event site behind an attendee login. This area evaluates each of the five widgets as a distinct feature, plus the shared requirements of non-admin distribution, embed generation, and cross-surface data consistency.',
      scenarios: [
        {
          id: 'EMB-S1',
          name: 'Non-admin tour of the four browse widgets',
          persona: 'attendee',
          steps: [
            "Navigate to the clone's base URL in a logged-out state. Your goal is to see what an ORDINARY VISITOR sees — never use organizer/admin credentials anywhere in this scenario (sole exception: the approval precondition in step 2, after which you must return to a non-admin state).",
            'Locate the attendee-facing surface that renders event content for "DevFlow Conf 2027" (or whatever event the clone exposes) — an event website, public program page, attendee portal, or a rendered embed. Try obvious nav links (Sessions, Program, Schedule, Agenda, Speakers, Gallery, Explore, Event Site, View Site) and obvious paths (/sessions, /speakers, /agenda, /schedule, /gallery, /embeds, /widgets, /public, /site, /event/...). First record whether the content is readable with NO login at all — that is a bonus worth noting, not a requirement. If a surface demands a login, sign in (or sign up if the clone allows open registration) as attendee "Alex Attendee", email alex.attendee@sbek-test.example.com, password SbekTest!2027-att, or use the fixture attendee credentials if provided; then record exactly which surfaces required a login. The five widgets may be separate pages, tabs on one page, or an embed-demo page — record how the clone organizes them. PRECONDITION on a chained run: area 04 approves only ONE session\'s content, so a clone that correctly gates public output on approval may show a single session everywhere. If the widgets appear empty or near-empty because of that content-approval gate, sign in as organizer Jordan Alvarez, set EVERY scheduled session\'s content status to Approved, return to the non-admin state (sign out, or switch back to the attendee/visitor view), record that you did so, and restart this tour from step 1.',
            'SESSIONS LIST — open the session catalog view. Screenshot the full list. Record the result count if one is shown (e.g. "1 - 22 of 22"). For at least 3 session cards, record which of these fields are present: title, truncated description, date + time, room/location, speaker name with job title and company, Format tag, Track tag. Click a "Show more" / expand control on one card; screenshot the card before and after expansion.',
            'SESSIONS SEARCH — type a distinctive word from a visible session title (e.g. "Taming" if the fixture session "Taming 40-Minute CI" is present) into the search box. Screenshot the narrowed list and any updated count. Clear it, then search a visible speaker\'s surname (e.g. "Raman"). Record whether sessions featuring that speaker remain. Clear the search.',
            'SESSIONS FILTERS — open the Filters control. Screenshot the facet panel and record which facet groups exist (Format, Track, Location, etc.). Apply one Track value (e.g. "Platform & Infra" or any visible track); verify every remaining card carries that track; screenshot. Clear the filter.',
            "SPEAKERS LIST — open the speaker directory view (distinct from the photo gallery if both exist). Screenshot it. Record the ordering of the first several entries (alphabetical by surname?). For one entry, record: headshot present, name, job title, company, bio snippet. Open that speaker's detail (click their name/card) and record the list of their sessions with each session's title, date/time, and room; screenshot the detail. If the directory has a search box, search an exact speaker name and screenshot the narrowed result.",
            'AGENDA — open the agenda/schedule-grid view. Record its structure: a grid with room/location columns and a time-of-day gutter, or a time-ordered list — describe which. Screenshot the first day. Verify one visible session shows a track/format label and title and sits at a plausible room + time position; zoom/screenshot it. Use the day navigation (chevrons, tabs, or date picker) to switch to a different event day; screenshot it and record one session that differs from day 1.',
            'AGENDA DETAIL — click one agenda session block. Record which fields the detail view shows: title, full "start - end" time range, room, description (with Show more if truncated), Format, Track, and any Subsessions section. Screenshot the detail. Use the Back/close control and screenshot the restored agenda.',
            'SPEAKER GALLERY — open the visual speaker gallery (photo grid). Screenshot the grid. For 3 cards record: headshot photo, name, job title, company; note any speaker rendered with a missing photo/title and whether the layout degrades gracefully. Use the name search box, if present, to narrow to one speaker; screenshot. Click one speaker card; record the detail view fields (photo, name, title, bio with Show more, company, and a "Sessions (N)"-style list showing each session\'s title, date/time, and room); screenshot the open detail. Close/Back and screenshot the restored grid.',
            'CONSISTENCY SAMPLING — pick one session that appears in at least two of the widgets you visited (sessions list, agenda, itinerary if seen). Record its title, date, time, room, and track as displayed in EACH widget. Pick one speaker visible in both the speakers list and the gallery; record their name, job title, and company in each. Note any mismatches.',
            'Record a final observation listing, for EACH of the five widget surfaces, (a) whether you found it, (b) where it rendered — anonymous public page, attendee-authenticated event site/portal, or an embed — and (c) whether reading it ever required organizer/admin privileges. Be explicit about which surfaces were anonymous versus login-gated.',
          ],
        },
        {
          id: 'EMB-S2',
          name: 'Schedule Itinerary browsing and personal-schedule building',
          persona: 'attendee',
          steps: [
            'Navigate to the clone\'s base URL logged out. Find the schedule-itinerary widget — it may be called Itinerary, My Schedule, Schedule, Planner, or Schedule Builder, and may be a tab of the agenda page. Try it anonymously first and record whether that works. If the surface (or personal-schedule saving) requires an account, sign in or sign up as attendee "Alex Attendee", email alex.attendee@sbek-test.example.com, password SbekTest!2027-att, and record that a login was required — this is expected behaviour and not a defect. Never use organizer/admin credentials in this scenario.',
            'Verify the chronological structure: day tabs or day sections (the fixture event runs 2027-05-12 to 2027-05-14) and sessions grouped in ascending time order, ideally under time headers. Screenshot day 1.',
            'Pick one session card and record its anatomy: track chip/label, title, truncated description (expand it via Show more if offered), full date/time line, room, the complete speaker list with job titles and companies, and Format/Track rows. Screenshot the card. If the card offers an inline "View Details" expansion (e.g. for sub-sessions), click it, screenshot the expanded state, then collapse it.',
            'Switch to a different day tab/section; screenshot and confirm the listed sessions changed.',
            'If the itinerary has keyword search, search a word from a session title, screenshot the narrowed list, and clear it. If it has a Filters control, apply one track and screenshot, then clear.',
            'PERSONAL SCHEDULE — look on each card for a star/heart/plus/bookmark/"Add to schedule" control. Add TWO distinct sessions (prefer the fixture sessions "Taming 40-Minute CI" and "Your AI Pair Programmer Is Lying to You" if visible; otherwise any two). Screenshot both cards in their added/selected state. If no such control exists anywhere, record that clearly and screenshot the card controls that do exist.',
            'Open the personal schedule view (My Schedule / My Itinerary / a filter toggle like "Show my selections"). Verify exactly the two added sessions appear, in time order. Screenshot it.',
            'Reload the page (full browser reload). Return to the personal schedule view and record whether both selections persisted. Screenshot the post-reload state.',
            'Look for an export or add-to-calendar affordance (iCal/.ics download, "Add to calendar", subscribe link). If present, click it once, record what the UI reports (do not try to open any downloaded file), and screenshot the control and any confirmation.',
            'If a remove/unstar control exists, remove one of the two sessions and verify the personal view updates to a single session; screenshot.',
          ],
        },
        {
          id: 'EMB-S3',
          name: 'Organizer embed generation, snippet retrieval and data consistency',
          persona: 'organizer',
          steps: [
            "Navigate to the clone's base URL. Find the organizer/admin entry point — try nav links (Sign in, Log in, Organizer, Admin, Dashboard) and paths (/admin, /dashboard, /organizer, /login). If the clone offers open signup, sign up as organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com) with the fixture password; otherwise sign in with the fixture organizer credentials.",
            'Open the event workspace for "DevFlow Conf 2027" if it exists. If the account is empty, note that and continue — the embed area\'s chrome can still be evaluated; only create a minimal event from the fixture data if the clone requires one to reach the embeds area and creation takes under a minute.',
            "Find the embed/widget area. It may be called Embeds, Widgets, Share, Publish, Website, Feeds, or Integrations, and may sit under a CMS / Website / Marketing / Deliver-style module (SessionBoard puts it at CMS > Embeds). Screenshot the area's landing/list screen. Record whether existing embeds are listed with a name, an output format grouping, and an enabled/disabled state, and whether search/filter controls exist.",
            'Start creating a new embed (Add Embed / New Widget / similar). Record which widget types are offered, looking for equivalents of the five: sessions list, speakers list, agenda, schedule itinerary, speaker gallery. Record which output formats are offered (styled HTML script tag, basic HTML, JSON, XML, iCal). Screenshot the type and format pickers.',
            'Configure a Sessions List (or any available) embed. Record which configuration options exist: colors/branding, custom CSS, content filters (by track/status), and field selection checkboxes. Screenshot the builder with options visible.',
            'Save/generate the embed. Then use the per-embed "Get Code" / copy-snippet / share affordance and capture the output: screenshot the generated snippet or shareable URL, and record the snippet text VERBATIM as an observation. If the snippet contains a URL (script src, iframe src, or feed endpoint), record that URL explicitly as its own observation.',
            'RENDERED CHECK — if the embed area offers a Preview/View affordance, open it and screenshot the widget as it renders. Otherwise, if the URL you recorded in step 6 is on the same site or a sibling subdomain, navigate to it directly and screenshot whatever renders (a rendered widget, a JSON/XML feed body, or an error — record which). If the URL is on an unrelated origin you cannot reach, record that the rendered check is deferred to manual verification, and say so explicitly rather than guessing.',
            'If the embed list exposes an enable/disable toggle, record its current state and how it is presented. Do NOT delete, archive, or remove any embed, and do not disable one you did not create.',
            "CONSISTENCY — in the organizer-side session management (sessions/agenda admin), record one session's exact title, date, time, room, and track. Screenshot it.",
            'Open the same session on the attendee-facing widget surface (the event site/portal or the embed URL; sign out or use a non-admin view if the clone requires it). Record its displayed title, date, time, room, and track and screenshot it. Note any field that differs from the organizer-side record.',
          ],
        },
      ],
      criteria: [
        {
          id: 'EMB-01',
          criterion:
            'The Sessions List widget renders a card per session showing title, truncated description with a Show more expansion, date/time, room, speaker names with job title and company, and Format/Track tags',
          weight: 3,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            'At least 3 session cards each display title, description snippet, a date+time string, a room/location, at least one speaker with job title and company, and Format and Track values; clicking Show more (or equivalent) expands the description in place',
          expectedEvidence:
            "Full-list screenshot plus before/after screenshots of one card's Show more expansion; agent field-by-field observations for 3 cards",
          productStatus: 'Verified',
          programkitEvidence:
            'The Sessions view renders a card per published session with title, expandable description, local date and time, room, complete speaker identity, format, and track.',
        },
        {
          id: 'EMB-02',
          criterion:
            'Sessions List keyword search matches both session titles and speaker names, narrowing the visible cards and updating any result count',
          weight: 2,
          type: 'rule',
          scenarios: ['EMB-S1'],
          passCriteria:
            "A title-word query leaves only matching session(s) and a speaker-surname query leaves only that speaker's session(s); any visible result count updates to match; partial credit if only title search works",
          expectedEvidence:
            'Screenshots after the title query and after the speaker-name query, each showing the narrowed list and count',
          productStatus: 'Verified',
          programkitEvidence:
            "One search index includes session title and description, room, format, track, and every speaker's name, title, and company. The visible result count updates with the filtered set.",
        },
        {
          id: 'EMB-03',
          criterion:
            'Sessions List offers a faceted Filters control (at minimum Track, ideally also Format and Location) whose selections narrow the list to matching sessions',
          weight: 2,
          type: 'rule',
          scenarios: ['EMB-S1'],
          passCriteria:
            'A filter panel/control exists with at least a Track facet; selecting one track leaves only cards carrying that track; full credit requires Format and Location/room facets too',
          expectedEvidence:
            'Screenshot of the open filter panel showing facet groups and of the filtered list where every card matches the chosen track',
          productStatus: 'Verified',
          programkitEvidence:
            'Track, format, and room facets can be combined. Every filtered surface is derived from the same published-session set.',
        },
        {
          id: 'EMB-04',
          criterion:
            'The Speakers List widget shows a directory of speakers (ordered alphabetically by surname) with headshot, name, job title, and company per entry',
          weight: 3,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            'A speaker directory distinct from raw session data exists; entries show photo, name, job title, and company; ordering across the first several entries is alphabetical by surname (ordering alone, if violated, costs partial credit rather than a fail)',
          expectedEvidence:
            "Full directory screenshot plus the agent's recorded field checklist and ordering observation for the first entries",
          productStatus: 'Verified',
          programkitEvidence:
            'The Speakers view is a distinct directory ordered by surname. Entries include headshot or fallback, name, title, and company.',
        },
        {
          id: 'EMB-05',
          criterion:
            "Each Speakers List entry drills into a detail view with the speaker's bio and their sessions (title, date/time, room), and the directory supports search by speaker name",
          weight: 2,
          type: 'roundtrip',
          scenarios: ['EMB-S1'],
          passCriteria:
            'Opening a speaker shows a bio and a per-speaker session sublist where each session has title, date/time, and room; typing an exact speaker name in the directory search narrows to that speaker',
          expectedEvidence:
            "Screenshot of one speaker's detail with their sessions, and of the search-narrowed directory",
          productStatus: 'Verified',
          programkitEvidence:
            'Speaker search covers name, title, company, and bio. Opening an entry shows the bio and every published session with date, time, and room.',
        },
        {
          id: 'EMB-06',
          criterion:
            'The Agenda widget renders a per-day schedule organized by time — a grid with room/location columns and a time gutter, or an equivalent day/track/time-structured layout — with session blocks placed at their correct room and time showing at least title and track/format',
          weight: 3,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            'An agenda view structured by day and time exists (grid with location columns preferred; a clearly time-slotted list is acceptable); one sampled session appears at the correct room/time position with title and a track or format label',
          expectedEvidence:
            "Full agenda screenshot for one day plus a zoomed screenshot of the sampled session block and the agent's structural description",
          productStatus: 'Verified',
          programkitEvidence:
            'The Agenda view is grouped by event-local day and time. Session rows show the correct time, room, title, track, and format from the latest published release.',
        },
        {
          id: 'EMB-07',
          criterion:
            "Agenda day navigation (chevrons, tabs, or date picker) switches between event days and re-renders that day's sessions",
          weight: 2,
          type: 'rule',
          scenarios: ['EMB-S1'],
          passCriteria:
            'Activating day navigation changes the visible day label AND the rendered sessions (at least one session differs between the two captured days)',
          expectedEvidence:
            'Screenshots of two different days showing changed day label and changed session content',
          productStatus: 'Verified',
          programkitEvidence:
            'Day navigation changes both the active date and the published sessions rendered for that day.',
        },
        {
          id: 'EMB-08',
          criterion:
            'Clicking an agenda session block opens a detail view with the full start-end time range, room, description, Format, and Track, and a Back/close control restores the agenda',
          weight: 2,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            'Detail view shows title, full time range, room, description, and Format/Track values (a Subsessions section is bonus, per SessionBoard, not required); Back/close returns to the intact agenda',
          expectedEvidence:
            'Screenshot of the open detail view and of the restored agenda afterwards',
          productStatus: 'Verified',
          programkitEvidence:
            'Opening an agenda session shows its full time range, room, description, format, track, and speakers. Closing the drawer restores the agenda state.',
        },
        {
          id: 'EMB-09',
          criterion:
            'The Schedule Itinerary widget lists sessions chronologically within day tabs/sections, with cards showing track label, title, description, full date/time, room, and the complete speaker list with titles and companies',
          weight: 2,
          type: 'exists',
          scenarios: ['EMB-S2'],
          passCriteria:
            'Day tabs or day sections exist for the multi-day event; sessions within a day appear in ascending time order (time-group headers are ideal); one sampled card shows track, title, description, date/time, room, and every listed speaker with job title and company',
          expectedEvidence:
            "Screenshot of one day's chronological list, of a second day after switching, and of one fully-annotated card; agent observations on time ordering",
          productStatus: 'Verified',
          programkitEvidence:
            'Itinerary sessions are ordered chronologically within day navigation and include track, format, title, optional description, full time, room, and complete speaker identities.',
        },
        {
          id: 'EMB-10',
          criterion:
            "Personal schedule building (inferred from category norms; not visible in SessionBoard's live itinerary example): the attendee can add/star sessions from the itinerary and view a personal schedule containing exactly the chosen sessions",
          weight: 1,
          type: 'depth',
          scenarios: ['EMB-S2'],
          passCriteria:
            'An add/star/bookmark control exists on itinerary cards; after adding two sessions, a personal-schedule view (My Schedule or equivalent filter) shows exactly those two sessions in time order; removing one updates the view. Requiring an attendee account to save a personal schedule is expected and must not cost credit',
          expectedEvidence:
            'Screenshots of two cards in selected state, the personal view with exactly those two sessions, and the view after one removal',
          productStatus: 'Verified',
          programkitEvidence:
            'Attendees can add or remove sessions and switch to My schedule, which contains only their selected sessions in chronological order.',
        },
        {
          id: 'EMB-11',
          criterion:
            'The personal schedule persists across a full page reload, and an export/add-to-calendar affordance is offered for the selection',
          weight: 1,
          type: 'depth',
          scenarios: ['EMB-S2'],
          passCriteria:
            "After a browser reload the previously added sessions are still marked/present in the personal view (via localStorage or an account); an export/iCal/add-to-calendar control exists and reports success when activated — the downloaded file's correctness is the manual half",
          expectedEvidence:
            'Post-reload screenshot of the intact personal schedule plus a screenshot of the export control or its confirmation',
          productStatus: 'Verified',
          programkitEvidence:
            'Selections persist per event in local storage across reloads. Add to calendar downloads an iCal file containing the selected sessions with their titles, times, descriptions, and rooms.',
        },
        {
          id: 'EMB-12',
          criterion:
            'The Speaker Gallery widget renders a visual photo grid of speaker cards (headshot, name, job title, company), alphabetized by surname, with a search-by-name box, degrading gracefully for speakers missing a photo or title',
          weight: 2,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            'A grid layout visually distinct from the speakers list exists; cards show headshot, name, job title, company; name search narrows the grid to the matching speaker; a photo-less speaker (if any exists in the data) renders with a fallback rather than breaking the grid; surname ordering is partial credit',
          expectedEvidence:
            "Grid screenshot, search-narrowed screenshot, and the agent's card-field and fallback observations",
          productStatus: 'Verified',
          programkitEvidence:
            'The Gallery is a visual, surname-sorted grid with name search, photos or resilient initial fallbacks, names, titles, and companies.',
        },
        {
          id: 'EMB-13',
          criterion:
            "Clicking a gallery card opens a speaker detail (modal or panel) with photo, name, job title, bio with Show more, company, and a sessions list giving each session's title, date/time, and room; closing it returns to the intact grid",
          weight: 1,
          type: 'exists',
          scenarios: ['EMB-S1'],
          passCriteria:
            "The detail shows photo, name, title, bio, company, and the speaker's sessions each with title, date/time, and room (a 'Sessions (N)' count is a plus); Back/Close restores the grid in its prior state",
          expectedEvidence:
            'Screenshot of the open detail showing the sessions sublist and of the restored grid',
          productStatus: 'Verified',
          programkitEvidence:
            'Gallery cards open the same complete speaker detail, including bio and session list, then return to the intact grid on close.',
        },
        {
          id: 'EMB-14',
          criterion:
            'The five widget surfaces (sessions list, speakers list, agenda, schedule itinerary, speaker gallery) are distributable to non-admin viewers — each renders populated event content outside the organizer admin UI, on an attendee-facing site/portal or via a generated embed',
          weight: 3,
          type: 'scoping',
          scenarios: ['EMB-S1', 'EMB-S2', 'EMB-S3'],
          passCriteria:
            'Every widget the clone implements renders populated content to a viewer holding NO organizer/admin rights, on a surface separate from the admin UI — an anonymous public page, an attendee-authenticated event site/portal, or a rendered/generated embed. Requiring an attendee login is fully acceptable and costs NO credit: the reference product requires at least one login method on its event site and offers no fully-public option, so do not penalise a login-gated event site. Anonymous login-free access is a bonus the judge may note but must not require. Deduct only where a widget is reachable ONLY inside the organizer admin UI, requires organizer/admin privileges to read, or renders empty/broken for a non-admin viewer despite content existing. Partial credit if some widgets are non-admin-visible and others are admin-only.',
          expectedEvidence:
            "The non-admin screenshots of each widget surface from EMB-S1/EMB-S2, the agent's explicit per-surface record of anonymous vs attendee-login vs admin-only access, and any rendered embed from EMB-S3",
          productStatus: 'Verified',
          programkitEvidence:
            'Agenda, Sessions, Speakers, Itinerary, and Gallery are all views of the anonymous `/agenda?event=...` route. No organizer session is required.',
        },
        {
          id: 'EMB-15',
          criterion:
            'An organizer-side embed area lets the organizer generate a per-widget embeddable snippet or feed URL, with configuration such as output format, branding/colors, content filters, and field selection, and lists saved embeds with a retrievable code snippet',
          weight: 3,
          type: 'handoff',
          scenarios: ['EMB-S3'],
          passCriteria:
            'The agent finds an embeds/widgets/share area, sees widget-type choices covering most of the five, configures and saves an embed, and retrieves a generated snippet or feed URL via a Get Code / copy / share affordance — the snippet text must be captured, not merely asserted to exist. Full credit needs multiple output formats (styled HTML script, basic HTML, JSON/XML, iCal) plus filter/field/branding options, and a saved-embed list with per-embed management (naming, enable/disable). Partial credit if an embed area exists but yields only a plain share URL with no configuration, or offers configuration but no retrievable snippet. This item is the primary evidence that the widgets are genuinely embeddable; the snippet actually rendering inside a third-party page is the manual half.',
          expectedEvidence:
            'Screenshots of the embed area listing, type/format pickers, and builder options, plus the generated snippet text recorded verbatim as an observation and any preview/rendered-embed screenshot',
          productStatus: 'Verified',
          programkitEvidence:
            "Schedule studio's Share program dialog offers all five views; styled-script, basic-HTML, hosted-link, JSON, XML, and iCal outputs; track and room filters; description visibility; and an accent-color control. Organizers can save named embeds, retrieve their code later, and enable or disable them. Generated feeds are CORS-enabled and independently select the event. The production script was exercised from a separate localhost origin; calendar import remains a manual check.",
        },
        {
          id: 'EMB-16',
          criterion:
            "Widget data is consistent across surfaces and with the organizer-side source — the same session shows identical title, date/time, room, and track everywhere it appears, and matches the organizer's record without republishing",
          weight: 3,
          type: 'roundtrip',
          scenarios: ['EMB-S1', 'EMB-S3'],
          passCriteria:
            "The consistency samples show no mismatches: one session's title/date/time/room/track identical across at least two widgets (EMB-S1), one speaker's name/title/company identical between speakers list and gallery (EMB-S1), and one session's attendee-facing rendering matching its organizer-side record (EMB-S3). Tolerance: a leftover 'UPDATED: ' title prefix from area 04's edit test (whose final revert step may have failed) is NOT a mismatch, provided the prefixed title is identical across surfaces. This point-in-time consistency is the auto half; propagation of organizer edits to an already-placed embed without republishing is the manual half",
          expectedEvidence:
            "The agent's recorded field values from each surface plus the paired screenshots from EMB-S1 step 10 and EMB-S3 steps 9-10",
          productStatus: 'Verified',
          programkitEvidence:
            'Organizer and public surfaces resolve through the same event state and release selector. All five views and all three feeds share one public projection, so titles, times, rooms, tracks, and speaker identity cannot drift between formats.',
        },
      ],
      proof: [
        {
          title: 'Browse the published program',
          image: './screenshots/programkit/public-agenda.jpg',
          route: '/agenda',
        },
        {
          title: 'Inspect the public release',
          image: './screenshots/programkit/../appflow/16-public-agenda.jpg',
          route: '/agenda',
        },
        {
          title: 'Review share infrastructure',
          image: './screenshots/programkit/integrations.jpg',
          route: '/integrations',
        },
      ],
    },
    {
      area: 'speaker-crm',
      title: 'Speaker CRM (Cross-Event Speaker Database)',
      prefix: 'CRM',
      areaWeight: 10,
      optional: true,
      overview:
        "Speaker CRM is an organization-level, cross-event speaker database that sits above individual events: a persistent, searchable directory of every speaker/contact the org has worked with, carrying bios, headshots, notes, tags/custom fields, and event/session history so returning speakers never re-key their data. Organizers populate it via bulk CSV import or manual entry, slice it with multi-criteria filters and saved segments, and merge near-duplicate records. A kanban sourcing pipeline tracks prospects from research through confirmed/declined, with per-card notes and stage history, and contacts can be pushed from the database into a specific event's speaker workflow without re-entry. Bulk email outreach with personalization and a CRM dashboard with org-wide analytics round out the area. This is an OPTIONAL extra-credit area — clones may omit it entirely.",
      scenarios: [
        {
          id: 'CRM-S1',
          name: 'Build and organize the speaker database',
          persona: 'organizer',
          steps: [
            "Navigate to the clone's base URL. Sign in as organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password); if no account exists yet, sign up with the organizer fixture identity. Try obvious organizer routes: /admin, /dashboard, /organizer, or nav links.",
            'Look for an ORGANIZATION-LEVEL speaker database area that lives outside any single event — it may be called "CRM", "Speaker CRM", "Directory", "Contacts", "People", "Speaker Database", or "Speakers" in a top-level nav. Screenshot the navigation showing where it lives. If no such cross-event area exists anywhere (only per-event speaker lists), record that observation explicitly, screenshot the full navigation, and still attempt steps 3-10 against the closest equivalent (e.g. an event-level speaker list), noting the difference.',
            'Look for a bulk import entry point ("Import", "Upload CSV", "Import contacts"...). CHAINED-RUN NOTE: area 03 imports the same speakers.csv at event level — if the contacts from speakers.csv already appear in this directory from that earlier import, skip re-importing; or, if you do re-import, record whether the import deduplicated or duplicated them (either observation is useful evidence for CRM-06). Otherwise, if an import UI exists, upload the speakers.csv fixture file. Screenshot any column-mapping or validation step (including any rows flagged with issues), then complete the import. If no import UI exists, record that, and instead manually create the 3 contacts from the speakers.csv fixture data (Priya Raman, Marcus Okafor, Dana Kowalski — each row carries name, email, job title, company, bio).',
            'Screenshot the populated directory table showing multiple contacts with at least name and email visible. Record roughly how many rows are listed.',
            'Type an imported contact\'s name (e.g. "Priya") into the directory search box. Screenshot the narrowed result, then clear the search and confirm the full list returns.',
            'Open the filter control if one exists (a "Filter" button or panel near the search bar). Apply one attribute filter (company, job title, or tag) and screenshot the filtered result with the active criteria visible. If the UI supports it, add a second filter and screenshot the further-narrowed set, then clear all filters.',
            'With a filter applied (or a subset selected), look for a way to save the result as a reusable segment or list ("Save Segment", "Save List", "Create Segment"...). Save it as "AI Experts", choosing a dynamic / auto-updating type if the dialog offers a choice. Open the segments/lists area and screenshot the saved segment with its member list. If no segment feature exists, record that.',
            'Open a contact\'s profile (row click or edit/pencil icon). Screenshot the profile view. Add an internal note reading "Met at DevFlow 2026 - strong on CI topics; shortlist for keynote." and save it. Reload the page and screenshot the persisted note. Also look for (a) a section listing events and/or sessions this contact is connected to and (b) an activity/history feed of communications or record changes — screenshot whatever exists.',
            'Look for custom field or tag management (e.g. Settings/Library > Fields, or a tags input on the profile). If a field-creation UI exists, create a dropdown field named "Speaker Type" with options "Internal" and "External", set it to "External" on the open contact, save, reload, and screenshot the persisted value. If only free-form tags exist, add the tag "AI" to the contact instead and screenshot it. If neither exists, record that.',
            'Manually create one new contact with the SAME name as an existing contact but a different email (e.g. "Priya Raman" / priya.raman.alt@sbek-test.example.com). Look for a duplicate warning or a "Merge Duplicates" / "Merge" action on the profile or in the directory. If found, run the merge: select both records, designate the original as primary, choose field values if a side-by-side comparison is offered, and confirm (note any cannot-be-undone warning). Screenshot the comparison step and the single surviving record; note the directory row count before and after. If no duplicate detection or merge exists, record that.',
            'Take a final screenshot of the directory table as left at the end of the run.',
          ],
        },
        {
          id: 'CRM-S2',
          name: 'Source a speaker through the pipeline and reuse across events',
          persona: 'organizer',
          steps: [
            'Sign in as organizer Jordan Alvarez (jordan.organizer@sbek-test.example.com, fixture password) — the same account used in CRM-S1. If the directory from CRM-S1 is empty or missing, first create the 3 contacts from the speakers.csv fixture data (Priya Raman, Marcus Okafor, Dana Kowalski) so the pipeline and outreach steps have material to work with.',
            'Make sure the event "DevFlow Conf 2027" (2027-05-12 to 2027-05-14, Moscone West SF) exists; create it from the fixture data if it does not.',
            'Look for a speaker sourcing pipeline in the CRM area — it may be called "Pipeline", "Sourcing", "Prospects", or appear as a kanban board. Screenshot the full board and record the stage/column names you see (the target has open stages like Researching/Identified/Contacted/Interested plus terminal Confirmed and Declined; renamed equivalents are fine). If no pipeline exists anywhere, record that explicitly and skip to step 7.',
            'Enroll a directory contact (use Marcus Okafor) into the pipeline via "+ Enroll" / "Add prospect" / "Add card", choosing a starting stage (Identified or the first open stage). If the dialog offers a score and rationale, enter score 85 and rationale "Strong platform-engineering track record; ideal for Platform & Infra track." Screenshot the enroll dialog and the new card on the board.',
            'Move the card forward two stages (drag-and-drop or a Move-to menu), e.g. to Contacted and then Interested. Screenshot the board after the moves, then RELOAD the page and screenshot again to confirm the card stayed in its new stage.',
            'Open the card\'s detail view. Add an internal note reading "Left voicemail 2027-01-15; follow up next week." and save. Look for a timestamped stage history or activity log showing the stage transitions from step 5. Screenshot the detail with the note and any stage history visible. Then RELOAD the page, reopen the card detail, and screenshot again to confirm the note (and history) persisted.',
            'Reuse across events: from the pipeline card (an "Assign to event" action) or from the directory (select the contact\'s checkbox and look for "+ Add To Event" / "Invite to Event" / "Add to..."), add Marcus Okafor to "DevFlow Conf 2027". Screenshot the event-picker or confirmation dialog. Then navigate into DevFlow Conf 2027\'s speakers/contacts area and screenshot the contact listed there — note whether name, email, company, and bio carried over without re-entry.',
            'Bulk outreach: back in the org directory, select 2 or more contacts via checkboxes and look for a "Communicate" / "Send Email" / "Message" action. Compose subject "Speak at DevFlow Conf 2027?" and a short body inviting them to submit; if a template picker or merge tags (e.g. {{first_name}}) are offered, use them, and screenshot any preview showing personalization resolved to real contact values. Screenshot the composer, then send and screenshot the success/confirmation state. If a history/log of sent communications exists (campaign list or per-recipient rows), open it and screenshot the logged send. If no bulk email exists, record that.',
            'Dashboard: look for a CRM dashboard/overview page with org-wide numbers (total contacts, events, returning speakers) and analytics widgets (top companies, speaker source, region, areas of focus). Screenshot it, record the total-contacts KPI value, and note whether it is consistent with the number of rows currently visible in the directory. If a widget element is clickable (e.g. a company name), click it and screenshot where it leads. If no dashboard exists, record that.',
          ],
        },
      ],
      criteria: [
        {
          id: 'CRM-01',
          criterion:
            'An organization-level speaker directory exists outside any single event, listing contacts across events in a searchable table.',
          weight: 3,
          type: 'exists',
          scenarios: ['CRM-S1'],
          passCriteria:
            "A cross-event contacts/speakers area is reachable at organization level (not nested inside one event's menu); it renders a table or list of contacts with at least name and email; typing a contact's name in a search box narrows the list to matches and clearing it restores the full list.",
          expectedEvidence:
            'Navigation screenshot showing where the CRM/directory lives relative to events; screenshot of the populated directory table; screenshot of search narrowed to the queried contact. If the agent observed that speaker data only exists per-event with no cross-event view, this item fails.',
          productStatus: 'Verified',
          programkitEvidence:
            'CRM is a top-level navigation item outside an event module. Directory rows show name, email, company, title, tags, event count, and last update. Search narrows the list and clears without changing stored data.',
        },
        {
          id: 'CRM-02',
          criterion:
            'A multi-criteria filter narrows the directory by attribute values such as company, job title, or tags, and filters are clearable.',
          weight: 2,
          type: 'rule',
          scenarios: ['CRM-S1'],
          passCriteria:
            'A filter control beyond plain text search exists; applying an attribute filter visibly narrows the result set consistently with the criterion; filters can be cleared to restore the full list. Combining two filters (AND-style narrowing) is stronger evidence but a single working attribute filter passes.',
          expectedEvidence:
            'Screenshot of the open filter panel/control, filtered results with the active criteria visible (chips, labels, or panel state), and the restored unfiltered list.',
          productStatus: 'Verified',
          programkitEvidence:
            'Company, tag, and title filters combine with text search. Active filters expose a Clear action that restores the complete directory.',
        },
        {
          id: 'CRM-03',
          criterion:
            'Contact profiles show identity fields plus persistent internal notes and some form of cross-event history (linked events/sessions and/or an activity log).',
          weight: 2,
          type: 'roundtrip',
          scenarios: ['CRM-S1'],
          passCriteria:
            "Opening a contact shows identity data (name, email, company/title, and a bio or headshot area); an internal note can be added and still renders after a page reload; the profile exposes at least one history surface — a list of connected events/sessions or an activity/communications feed. Tab names need not match SessionBoard's Profile/Notes/Connections/Files/Activity.",
          expectedEvidence:
            'Screenshot of the profile main view; screenshot of the saved note after reload; screenshot of the events/sessions connections section or activity feed. Notes-only with no history surface earns at most partial credit.',
          productStatus: 'Verified',
          programkitEvidence:
            'Contact detail includes identity, headshot, email, company/title, persistent private notes, event and session connections, sourcing history, and timestamps.',
        },
        {
          id: 'CRM-04',
          criterion:
            'Contacts can be enriched with organizer-defined metadata — custom fields (e.g. a dropdown) or tags — that persist on the profile.',
          weight: 1,
          type: 'depth',
          scenarios: ['CRM-S1'],
          passCriteria:
            'Either (a) a field-management UI creates a new field (e.g. dropdown "Speaker Type" with Internal/External) that then appears and holds a value on a contact profile after reload, or (b) tags can be added to a contact and persist. Full custom-field creation is stronger evidence than tags alone.',
          expectedEvidence:
            'Screenshot of the field-creation dialog or tag input, and of the profile showing the saved value/tag after reload; bonus if the field/tag also surfaces as a directory column or filter.',
          productStatus: 'Verified',
          programkitEvidence:
            'Comma-separated tags are normalized, deduplicated, stored on the person record, shown in the directory, and available as a filter.',
        },
        {
          id: 'CRM-05',
          criterion:
            'Contacts can be bulk-imported from a CSV file, with the imported rows appearing in the directory afterward.',
          weight: 2,
          type: 'bulk',
          scenarios: ['CRM-S1'],
          passCriteria:
            'An import entry point accepts the speakers.csv fixture upload and completes; the imported contacts subsequently appear as directory rows with correct name/email data. A column-mapping or validation step that flags problem rows is stronger evidence; silent-but-correct import still passes. No import UI at all fails this item.',
          expectedEvidence:
            'Screenshots of the upload and any mapping/validation step (including flagged issues if shown), and of the directory listing the imported contacts from speakers.csv.',
          productStatus: 'Verified',
          programkitEvidence:
            'Import accepts the evaluator CSV shape, previews mapped rows, marks duplicate emails as skipped, reports validation errors, and commits new contacts to the organization directory.',
        },
        {
          id: 'CRM-06',
          criterion:
            'Near-duplicate contacts (same name, different email) are surfaced and can be merged into a single chosen primary record.',
          weight: 1,
          type: 'depth',
          scenarios: ['CRM-S1'],
          passCriteria:
            'After a same-name/different-email contact is created, the system exposes a duplicate indicator or merge action; the merge flow lets the organizer pick a primary (field-level value selection is stronger evidence); afterward only one record remains in the directory carrying the merged data.',
          expectedEvidence:
            "Screenshot of the duplicate indicator or merge entry point, the comparison/primary-selection step, and the single surviving record; the agent's before/after directory row-count observation.",
          productStatus: 'Verified',
          programkitEvidence:
            'Same-name records appear as possible duplicates. The comparison names the kept and merged profiles, warns that merge is irreversible, and moves participations, sessions, notes, assets, tasks, segments, and pipeline history to the primary record.',
        },
        {
          id: 'CRM-07',
          criterion:
            'A kanban sourcing pipeline with staged columns covering an open-to-won/lost lifecycle lets contacts be enrolled and moved between stages, with moves persisting across reload.',
          weight: 2,
          type: 'crud',
          scenarios: ['CRM-S2'],
          passCriteria:
            'A board with at least 4-5 named stage columns exists, including terminal confirmed/declined-style stages (renamed equivalents acceptable); a directory contact can be enrolled via an add/enroll action; the card can be moved to another stage and remains there after a page reload. Score/rationale fields at enrollment are bonus evidence, not required.',
          expectedEvidence:
            'Screenshots of the full board with column names, the enroll dialog, and the card in its new column both before and after reload.',
          productStatus: 'Verified',
          programkitEvidence:
            'The pipeline has Researching, Identified, Contacted, Interested, Confirmed, and Declined columns. Enrollment accepts contact, starting stage, fit score, and rationale. Cards support drag and drop plus a select-based accessible move control, with versioned persistence.',
        },
        {
          id: 'CRM-08',
          criterion:
            'Pipeline cards open to a detail view with internal notes and a timestamped record of stage transitions.',
          weight: 1,
          type: 'depth',
          scenarios: ['CRM-S2'],
          passCriteria:
            'The card detail exposes a notes composer whose note persists (still renders after a page reload), and a stage history or activity log listing the stage moves from the scenario with timestamps (a general activity feed that includes the moves is acceptable).',
          expectedEvidence:
            'Screenshots of the card detail showing the saved note and transition entries with timestamps matching the moves performed in CRM-S2 step 5, including the after-reload screenshot confirming persistence.',
          productStatus: 'Verified',
          programkitEvidence:
            'Contact detail exposes persistent sourcing notes and a reverse-chronological stage history with actor and timestamp.',
        },
        {
          id: 'CRM-09',
          criterion:
            'A filtered directory view can be saved as a named, reusable segment or list that reopens with its members.',
          weight: 1,
          type: 'depth',
          scenarios: ['CRM-S1'],
          passCriteria:
            'A save-segment/save-list action exists after filtering; the saved "AI Experts" segment appears in a segments/lists area and reopens showing the matching contacts. Offering a dynamic (auto-updating) vs curated (static) type choice at creation is bonus evidence.',
          expectedEvidence:
            "Screenshots of the save dialog (note whether a dynamic/curated type choice is offered) and of the reopened segment's member list.",
          productStatus: 'Verified',
          programkitEvidence:
            'A filtered or selected directory set can be saved as a dynamic or curated segment. Segments reopen their current members and can feed outreach.',
        },
        {
          id: 'CRM-10',
          criterion:
            "A contact can be pushed from the org-level database into a specific event, appearing in that event's speakers/contacts module with profile data intact.",
          weight: 2,
          type: 'handoff',
          scenarios: ['CRM-S2'],
          passCriteria:
            'An add-to-event or assign-to-event action exists from the directory or a pipeline card; an event picker targets "DevFlow Conf 2027"; the contact then appears inside that event\'s speaker/contact list with name and email (and ideally company/bio) carried over without re-entry.',
          expectedEvidence:
            "Screenshot of the event-picker/confirmation dialog and of the contact listed inside DevFlow Conf 2027's speaker area; the agent's observation on which profile fields carried over.",
          productStatus: 'Verified',
          programkitEvidence:
            'Contact detail lists every event connection and offers Add to event for any unlinked event. The operation reuses the organization person, carries its profile fields, and creates one event participation without duplication.',
        },
        {
          id: 'CRM-11',
          criterion:
            'Bulk email can be composed to multiple selected contacts from the directory, ideally with template/merge-tag personalization and a preview, and the send is confirmed or logged in-app.',
          weight: 1,
          type: 'bulk',
          scenarios: ['CRM-S2'],
          passCriteria:
            'AUTO half — selecting 2+ contacts reveals a communicate/send-email action; a composer accepts subject and body; the send completes with an in-app success state or an entry in a sent-history log. Merge-tag resolution shown in a preview and campaign/per-recipient history rows are stronger evidence. The judge cannot verify real delivery from browser evidence alone.',
          expectedEvidence:
            'Screenshots of the selection revealing the action, the composer (with template/merge tags if offered), any preview with resolved personalization, the post-send state, and any history/log entry for the send.',
          productStatus: 'Verified queue',
          programkitEvidence:
            'Multi-select reveals Email. The composer previews resolved `{{first_name}}` values, freezes personalized messages into the durable outbox, and reports success. Provider delivery remains a manual deployment check.',
        },
        {
          id: 'CRM-12',
          criterion:
            'A CRM dashboard or overview page shows org-wide speaker-database metrics and at least one populated analytics widget.',
          weight: 1,
          type: 'depth',
          scenarios: ['CRM-S2'],
          passCriteria:
            'A dashboard/landing view at CRM or org level displays KPI counts (total contacts plus at least one other, e.g. events or returning speakers) that are plausibly consistent with the directory contents, and at least one analytics widget (top companies, speaker source, region, areas of focus) renders with data. Widget click-through to a filtered contact list is bonus evidence.',
          expectedEvidence:
            "Screenshot of the dashboard with KPI counters and widget(s); the agent's noted comparison between the dashboard contact count and the directory row count; screenshot of any drill-through destination.",
          productStatus: 'Verified',
          programkitEvidence:
            'Overview shows total contacts, events, returning speakers, active prospects, top companies, top tags, and recently updated contacts. Counts derive from the same directory state.',
        },
      ],
      proof: [
        {
          title: 'Open organization CRM',
          image: './screenshots/programkit/../appflow/07-crm.jpg',
          route: '/crm',
        },
        {
          title: 'Reuse people in an event',
          image: './screenshots/programkit/people.jpg',
          route: '/people',
        },
        {
          title: 'Prepare CRM outreach',
          image: './screenshots/programkit/communications-compose.jpg',
          route: '/communications',
        },
      ],
    },
  ],
}
