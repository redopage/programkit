<!-- Canonical: https://programkit.dev/docs/product/evals/03-speaker-management -->
<!-- Markdown: https://programkit.dev/docs/product/evals/03-speaker-management.md -->

# Speaker management evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/03-speaker-management.yaml`. It records exercised product behavior rather
than seeded screenshots.

## Current coverage

| Rubric | Status   | ProgramKit evidence                                                                                                                                                                                                                                                                                                                                                                      |
| ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SPK-01 | Verified | `/people` lists identity, title, company, workflow status, roles, readiness, sessions, and update time. Search and status views narrow the live roster.                                                                                                                                                                                                                                  |
| SPK-02 | Verified | The add and edit drawers persist the required profile fields. Core tests cover manual creation and later edits.                                                                                                                                                                                                                                                                          |
| SPK-03 | Verified | The CSV importer parses quoted fields, previews valid rows and duplicates, and deduplicates by email during one atomic import.                                                                                                                                                                                                                                                           |
| SPK-04 | Verified | Participation status changes persist and drive the confirmed and awaiting-reply roster views.                                                                                                                                                                                                                                                                                            |
| SPK-05 | Verified | Organizers create a dated action item once and assign it to multiple speakers. The task list shows due date, assignees, and aggregate progress.                                                                                                                                                                                                                                          |
| SPK-06 | Verified | Each speaker record has an explicit Send portal invite action. One operation creates a personalized one-recipient communication containing the private portal URL, records it in history, queues it in the durable outbox, and reports success in place.                                                                                                                                 |
| SPK-07 | Verified | The capability URL `/portal/{participationId}/{portalAccessKey}` renders a distinct speaker surface. Its server projection contains only that participant, their requirements, and their sessions. Invalid capabilities receive 403.                                                                                                                                                     |
| SPK-08 | Verified | Bio changes round-trip between the portal and organizer view and automatically satisfy the bio requirement. Speakers can upload JPEG, PNG, or WebP headshots to R2, and the profile requirement updates immediately.                                                                                                                                                                     |
| SPK-09 | Verified | Assigned tasks show their due dates in the private portal. Self-completable tasks persist directly as complete and non-self-completable work still follows submit-and-review.                                                                                                                                                                                                            |
| SPK-10 | Verified | The organizer speaker drawer lists uploaded files with filename, kind, size, date, and a direct view link served from the event's R2-backed asset endpoint.                                                                                                                                                                                                                              |
| SPK-11 | Verified | Organizer records and scoped speaker portals both show linked sessions. The portal also resolves placement, room, and track when available.                                                                                                                                                                                                                                              |
| SPK-12 | Verified | `/readiness` shows the status of every assigned requirement without opening individual records. Unassigned tasks render as not assigned and do not lower readiness.                                                                                                                                                                                                                      |
| SPK-13 | Verified | Communications supports filtered audiences, custom recipient sets, approval, delivery state, recipient count, history, attempt count, provider ID, retry visibility, and personalized calendar attachments. A production welcome campaign completed the approval flow and reached Gmail with resolved speaker, event, session, and portal values.                                        |
| SPK-14 | Verified | Compose offers reusable welcome, portal, task, and calendar templates with merge tokens plus a recipient switcher that resolves subject, body, session, event, private portal link, and the exact `.ics` attachment against real speaker data.                                                                                                                                           |
| SPK-15 | Verified | Each organizer speaker record includes a private travel and logistics field. It persists on the event participation record and is stripped from participant-facing projections.                                                                                                                                                                                                          |
| SPK-16 | Verified | New tasks enable automatic reminders by default. Per-event Durable Object alarms queue one personalized reminder at the active due-date window, skip completed work, deliver through Cloudflare Email, retry failures, and expose the result in Communications. A production reminder reached a controlled Gmail inbox with its resolved task, due date, event, and private portal link. |

## Speaker handoff

The organizer can copy, open, or place the private portal URL into a one-recipient invitation
draft. The public route carries both event routing and an unguessable participation capability:

```text
/portal/{participationId}/{portalAccessKey}?event={eventId}
```

The speaker client repeats the capability in `x-programkit-portal-key`. The server verifies the
participant actor, active event, participation ID, and capability before returning the participant
projection or accepting a mutation. Organizer records, other speakers, review data, change sets,
and internal notes are removed from that projection.

## Browser verification completed

The local Worker-backed app was exercised through both sides of the workflow:

1. created a general task once and assigned it to Jordan Bell and Jamie Brooks;
2. confirmed the organizer task list showed the title, due date, both assignees, and progress;
3. confirmed unrelated speakers rendered the task as not assigned with unchanged readiness;
4. opened Jordan's private portal and confirmed no other speaker data was present;
5. completed the task in the portal and reloaded to verify persistence;
6. saved Jordan's public bio and confirmed the bio requirement became complete;
7. created a portal invitation from Jordan's organizer record; and
8. verified the one-recipient draft and subject appeared in communications history;
9. uploaded the evaluator headshot fixture from Jordan's private portal and confirmed readiness
   reached 100%; and
10. opened Jordan's organizer record and verified the same file, metadata, avatar, and view link.

Automated coverage also creates an incomplete task due in two days, runs the event alarm without an
organizer action, verifies the email names the task and formatted due date, and confirms the sent
message, attempt count, and provider message ID persist in the event communication history.
Calendar coverage creates and approves a one-recipient campaign, freezes the speaker's published
sessions into the outbox, and verifies the Cloudflare binding receives a real `text/calendar`
attachment with the expected session events.

The hosted reference has also delivered a portal invitation and an automatic due-date reminder to
a controlled Gmail inbox. Both messages contained resolved event and recipient data plus an
absolute, private speaker-portal link; their provider attempts remain visible in Communications.
A separately approved welcome campaign reached the same inbox with the real first name, event,
session, and private portal URL in place of every merge token.

## Shared asset pipeline

Headshots now use the first shared binary asset path: bytes live in R2, immutable metadata lives in
the event Durable Object, uploads require the speaker's private portal capability, and public reads
resolve only event-owned headshot records. The same asset operation and storage binding can now be
extended to requested documents, submission attachments, and session deliverables without creating
another storage model.
