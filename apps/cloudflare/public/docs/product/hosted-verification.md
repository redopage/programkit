<!-- Canonical: https://programkit.dev/docs/product/hosted-verification -->
<!-- Markdown: https://programkit.dev/docs/product/hosted-verification.md -->

# Hosted verification

This checklist verifies the production services that automated unit tests cannot prove. Run it
against a disposable organizer account after deploying the exact candidate commit. Never use a
collaborator's event as test data.

## Current production evidence

Verified through **11 August 2026** against `https://app.programkit.dev`. Application source commit
`9fe4321` is deployed as Worker version `8d33d320-a7f4-45aa-8cb3-5673c1c42478`. The matching demo
and site deployments are `5b86bab0-57d8-4740-87e0-d4e400bba1a1` and
`1c5ba505-0720-409f-ac85-a87c3533f33f`.

- email/password signup created an organizer session and first event;
- the organizer created a second event and both events retained isolated workspace state;
- the state endpoint reported the deployed Cloudflare Email Service and R2 bindings as connected;
- a magic-link request reached Gmail from `notifications@mail.programkit.dev`;
- the one-time callback created a session, selected the account's event, and redirected to the app;
- a speaker portal invitation was accepted by the email provider on its first attempt;
- the invitation reached Gmail with resolved speaker and event values;
- its private portal URL returned only the event-scoped speaker projection;
- a task due in two days triggered one automatic reminder through a Durable Object alarm;
- the reminder reached Gmail with its resolved due date, event, and private portal link;
- the evaluator headshot and slide fixtures persisted to R2 and matched their original SHA-256
  hashes after portal download;
- a second speaker capability received `404` when requesting the first speaker's slide asset;
- a scheduled session was published with its speaker, room, start, and end time intact;
- a title-only CFP draft resumed through its private projection, rejected an incomplete submit,
  persisted its full answer set, and submitted successfully;
- its confirmation reached Gmail in one provider attempt with the resolved proposal and event;
- accepting that proposal created the speaker participation and session without re-entering its
  title, track, format, duration, or abstract;
- its acceptance notice reached Gmail in one provider attempt with the resolved proposal, event,
  and private speaker portal link;
- a submitted proposal was assigned to a reviewer, its editable reminder was queued from the
  review workspace, and the message reached Gmail with the resolved outstanding count and an
  absolute private reviewer-workspace link;
- that reviewer completed the scorecard and the organizer accepted the proposal on an event with
  no preconfigured tracks; ProgramKit created the selected CFP track and converted the proposal
  into its linked speaker participation and approved session atomically;
- the organizer added the event's first room, Auto-place scheduled that converted session into a
  conflict-free slot, Publish schedule created the public release, and Preview agenda rendered the
  same title, speaker, track, room, date, and time;
- a general welcome campaign moved through draft, approval, send, provider handoff, and Gmail
  delivery with its first name, event, session, and private portal link resolved;
- an approved campaign reached Gmail with a `text/calendar` attachment containing the matching
  title, start, end, and room;
- the workspace ZIP passed an integrity check and contained its complete JSON backup, manifest,
  readable CSV collections, and aggregated review-results CSV;
- the public agenda rendered all five views and the published program in a signed-out browser;
- Schedule studio saved a named public-program embed, retrieved its code, and persisted its enabled
  state;
- the production embed loader was served as JavaScript from all three official hosts and mounted
  the anonymous public program from a separate localhost origin;
- its 390 px layout had no document-level horizontal overflow; and
- public JSON, XML, and iCal feeds returned the same release with wildcard CORS.

Provider acceptance is recorded as **Sent** in ProgramKit. It is not mislabeled as end-recipient
delivery because the current email binding does not provide delivery or bounce webhooks.

## Repeatable checks

Run the deterministic hosted and evaluator preflight before the manual sequence:

```bash
PROGRAMKIT_PUBLIC_EVENT_ID=<published-event-id> pnpm competition:preflight
```

The command pins the local evaluator checkout to the documented commit, runs its browser smoke and
full dry-run plan, checks all three production hosts and embed loaders, and validates the selected
event's anonymous agenda plus JSON, XML, and iCal outputs. It does not send mail, import a calendar,
or invoke the paid evaluator.

### Account and event isolation

1. Create a new organizer account at `/signup`.
2. Create a second event from the event switcher.
3. Edit the second event's name, venue, dates, and timezone.
4. Switch between events and confirm their forms, people, sessions, and settings do not cross over.
5. Sign out, sign in again, and confirm the selected event and event list are preserved.

### Magic-link authentication

1. Request an email link from `/login` using a controlled mailbox.
2. Confirm the message arrives from the configured sender with subject `Sign in to ProgramKit`.
3. Confirm the link uses the deployed app origin and does not leak to another host.
4. Open it once and confirm the app establishes a session.
5. Open it again and confirm the consumed token is rejected.

### Speaker invitation

1. Add a speaker using a controlled mailbox.
2. Send a portal invitation from the speaker record.
3. In Communications, confirm the message moves from Queued to Sent and records one attempt and a
   provider reference.
4. Confirm the inbox message has resolved speaker and event values.
5. Open the private link in a signed-out browser and confirm it exposes only that speaker's event,
   profile, assigned sessions, tasks, files, and organizer-authored resources.

### Reviewer reminder

1. Submit a proposal to a review round with at least one assigned reviewer.
2. Select the reviewer in Review, open the reminder composer, and inspect the resolved preview.
3. Edit the subject or body, queue the reminder, and confirm its outbox status moves to Sent.
4. Confirm the inbox message contains the correct outstanding count and event name.
5. Open the private reviewer link signed out and confirm it exposes only that reviewer's assigned
   proposals for the selected event.

### Files and exports

1. Upload the evaluator headshot and slide fixture through the speaker portal.
2. Reload the portal and organizer Files page to confirm metadata and bytes persist.
3. Download each file as an organizer and as the owning speaker.
4. Download selected-files ZIP and workspace export ZIP, then inspect names and contents.
5. Confirm another speaker's capability URL cannot read those files.

### Calendar and public program

1. Publish a schedule containing at least one placed speaker session.
2. Send the calendar-invite campaign to a controlled mailbox.
3. Import the attachment into Gmail, Outlook, or Apple Calendar and verify title, start, end, room,
   and timezone.
4. Download the public iCal feed and inspect the same fields.
5. Embed the agenda iframe on another origin and verify filters, session details, and responsive
   layout.

## Before submission

Run the official evaluator twice from fresh accounts. Record the source commit, Worker deployment
version, test report, mailbox evidence, downloaded-artifact inspection, and any evaluator wording
that selected the wrong route. Keep private tokens, cookies, fixture uploads, and captured mailbox
contents outside the repository.
