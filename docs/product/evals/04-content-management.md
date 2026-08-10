# Content management evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/04-content-management.yaml`. It records real product behavior and automated
coverage rather than treating seeded data as evidence.

## Current coverage

| Rubric | Status         | ProgramKit evidence                                                                                                                                                                                                          |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CNT-01 | Verified       | `/readiness` creates reusable file requests with instructions, a due date, optional session scope, file constraints, and an exact speaker selection. One definition creates a separate tracked instance for every assignee.  |
| CNT-02 | Verified       | The private speaker portal lists only that speaker's assigned tasks and due dates. File requests accept an R2-backed upload against the requirement and immediately move the instance to submitted.                          |
| CNT-03 | Verified       | Portal projections contain one participation, its person, sessions, requirements, assets, and comments. Capability checks guard every portal read and mutation; hosted organizer routes still require staff authentication.  |
| CNT-04 | Verified       | Re-uploading the same requirement creates another immutable asset version. The portal and organizer file drawer list every version, mark the latest, and retain an individual download action for older versions.            |
| CNT-05 | Verified       | `asset.comment` stores an attributed author and timestamp. Speaker and organizer views resolve the same thread across every version in the requirement slot and both roles can reply.                                        |
| CNT-06 | Verified       | The upload control states the accepted types and configured maximum size before selection. The server enforces the same content-type allowlist and byte limit.                                                               |
| CNT-07 | Verified       | `/readiness` derives the full speaker-by-task matrix, deadlines, progress, and status from live requirement instances. All, incomplete, overdue, and review filters visibly change the result set.                           |
| CNT-08 | Partial manual | The outstanding-task reminder path resolves each speaker's incomplete task names and due dates into personalized outbox entries and confirms the action in the UI. Provider delivery remains manual evidence.                |
| CNT-09 | Verified       | The session drawer edits title, abstract, format, duration, track, and content status. Saves use version checks and persist into both the session detail and list.                                                           |
| CNT-10 | Verified       | The organizer speaker drawer edits public bio fields and now uploads or replaces a headshot directly from the admin surface. Staff uploads use the same R2/versioned asset pipeline, refresh the avatar, and survive reload. |
| CNT-11 | Verified       | Every session edit snapshots a restorable revision with actor and timestamp. The history drawer restores an exact earlier version rather than applying a blanket undo.                                                       |
| CNT-12 | Verified       | Session content status is explicit: `ready` is presented as Approved. Public agenda selection includes only approved sessions from the latest published schedule release.                                                    |
| CNT-13 | Verified       | `/files` aggregates latest deliverables with filename, speaker, session, upload time, review status, and total version count. Its drawer exposes all versions and the cross-role comment thread.                             |
| CNT-14 | Verified       | Organizers can multi-select latest files, review or deselect them in the export dialog, and generate a ZIP grouped by speaker and task. Archive tests verify only the selected latest versions are included.                 |

## File lifecycle

File bytes and workflow state have separate jobs:

1. the browser uploads directly to the same-origin Worker route;
2. the Worker validates type, size, capability or staff identity, and active-event ownership;
3. bytes are written to the event-scoped R2 key;
4. `asset.register` commits immutable metadata, version state, attribution, and requirement progress to the event Durable Object; and
5. a failed metadata operation removes the just-written R2 object so storage and workflow state do not drift.

Both speaker and organizer headshot uploads use this pipeline. Speaker deliverables additionally
inherit the selected task's accepted content types and maximum size.

## Verification completed

Automated core coverage exercises:

1. reusable task creation and independent per-speaker completion;
2. participant-only file ownership and staff-attributed headshot replacement;
3. headshot-driven avatar and readiness updates;
4. two immutable deliverable versions with only the second marked latest;
5. task status changes after upload;
6. attributed cross-role asset comments;
7. two distinct session edits followed by exact revision restoration;
8. approval filtering in the public agenda selector; and
9. ZIP construction from selected latest asset versions.

## Evaluator handoff

Use one disposable hosted organizer account for the chained evaluator run. Organizer, speaker,
public agenda, and file endpoints remain on `app.programkit.dev` in one event state without asking
the browser-only grader to leave the site for a magic link. The organizer can copy the generated
speaker link from a speaker record, complete the portal steps in another tab, then return to the
same organizer workspace.
