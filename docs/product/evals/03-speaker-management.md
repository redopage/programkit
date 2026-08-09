# Speaker management evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/03-speaker-management.yaml`. It records exercised product behavior rather
than seeded screenshots.

## Current coverage

| Rubric | Status         | ProgramKit evidence                                                                                                                                                                                                                  |
| ------ | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SPK-01 | Verified       | `/people` lists identity, title, company, workflow status, roles, readiness, sessions, and update time. Search and status views narrow the live roster.                                                                              |
| SPK-02 | Verified       | The add and edit drawers persist the required profile fields. Core tests cover manual creation and later edits.                                                                                                                      |
| SPK-03 | Verified       | The CSV importer parses quoted fields, previews valid rows and duplicates, and deduplicates by email during one atomic import.                                                                                                       |
| SPK-04 | Verified       | Participation status changes persist and drive the confirmed and awaiting-reply roster views.                                                                                                                                        |
| SPK-05 | Verified       | Organizers create a dated action item once and assign it to multiple speakers. The task list shows due date, assignees, and aggregate progress.                                                                                      |
| SPK-06 | Partial manual | Each speaker record has an explicit portal-invite action. It creates a one-recipient communication draft containing the private portal URL and records it in communications history. Provider delivery remains manual evidence.      |
| SPK-07 | Verified       | The capability URL `/portal/{participationId}/{portalAccessKey}` renders a distinct speaker surface. Its server projection contains only that participant, their requirements, and their sessions. Invalid capabilities receive 403. |
| SPK-08 | Verified       | Bio changes round-trip between the portal and organizer view and automatically satisfy the bio requirement. Speakers can upload JPEG, PNG, or WebP headshots to R2, and the profile requirement updates immediately.                 |
| SPK-09 | Verified       | Assigned tasks show their due dates in the private portal. Self-completable tasks persist directly as complete and non-self-completable work still follows submit-and-review.                                                        |
| SPK-10 | Verified       | The organizer speaker drawer lists uploaded files with filename, kind, size, date, and a direct view link served from the event's R2-backed asset endpoint.                                                                          |
| SPK-11 | Verified       | Organizer records and scoped speaker portals both show linked sessions. The portal also resolves placement, room, and track when available.                                                                                          |
| SPK-12 | Verified       | `/readiness` shows the status of every assigned requirement without opening individual records. Unassigned tasks render as not assigned and do not lower readiness.                                                                  |
| SPK-13 | Partial manual | Communications supports filtered audiences, custom recipient sets, approval, send state, recipient count, and history. Provider delivery remains manual evidence.                                                                    |
| SPK-14 | Partial        | Templates accept merge tokens, but the compose flow still needs a resolved per-recipient preview.                                                                                                                                    |
| SPK-15 | Not yet        | A dedicated persisted travel/logistics field is still needed.                                                                                                                                                                        |
| SPK-16 | Not yet        | Automatic due-date reminder scheduling and provider delivery remain future work.                                                                                                                                                     |

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

## Shared asset pipeline

Headshots now use the first shared binary asset path: bytes live in R2, immutable metadata lives in
the event Durable Object, uploads require the speaker's private portal capability, and public reads
resolve only event-owned headshot records. The same asset operation and storage binding can now be
extended to requested documents, submission attachments, and session deliverables without creating
another storage model.
