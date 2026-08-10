# AI agenda evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/05-ai-agenda.yaml`. The schedule is a durable draft until an organizer
publishes an immutable release. Public program views read only the latest release.

## Current coverage

| Rubric | Status   | ProgramKit evidence                                                                                                                                                                                                                                      |
| ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AIA-01 | Verified | `/schedule` derives its day switcher from the event date range and renders a room-by-time grid, an unscheduled-session pool, and a compact session-list alternative. Session cards show their exact local time, room column, track, and attendance.      |
| AIA-02 | Verified | Event settings exposes organizer forms for tracks and rooms. New records are written through `track.create` and `room.create`, scoped to the active event, and appear immediately in session editing, placement controls, filters, and schedule columns. |
| AIA-03 | Verified | Organizers can open an unscheduled session, choose an event-local date and time plus room, and place it. The resulting durable placement appears in the grid and reloads from the event workspace. Desktop cards can also be dragged between slots.      |
| AIA-04 | Verified | Placement preview allows a speaker overlap to be saved but shows a visible `Speaker conflict` warning naming the shared speaker. The grid marks both affected cards and the page-level conflict callout repeats the named conflict.                      |
| AIA-05 | Verified | Placement preview labels a same-room overlap as unavailable and disables submission. The core operation independently rejects the mutation with `ROOM_CONFLICT`, so API clients cannot bypass the rule.                                                  |
| AIA-06 | Verified | The move drawer and drag interaction rerun conflict detection before save. A successful move updates the versioned placement immediately; the named speaker warning clears when the sessions no longer overlap and the new slot persists.                |
| AIA-07 | Verified | `Publish schedule` refuses hard conflicts, snapshots approved-session placements into a new immutable schedule release, confirms success, and exposes the same release through Preview agenda, share links, and embed code.                              |
| AIA-08 | Verified | `Auto-place` is visible beside the unscheduled pool and places every session it can into a conflict-free room and 30-minute slot in one action, reporting anything that could not be placed.                                                             |

## Scheduling rules

Draft placements and public releases are intentionally separate:

1. a placement belongs to the active event, one session, and one room;
2. its end time is derived from the session duration;
3. event-boundary, missing-record, duration, cancellation, room-overlap, and speaker-overlap checks
   run against the active event only;
4. room overlaps and structural errors block placement;
5. speaker overlaps remain visible in the draft so an organizer can see and resolve the problem;
6. publishing is blocked while any approved placement has a hard conflict; and
7. a successful publish creates a new release without changing an older public release.

Capacity mismatches are warnings rather than hard failures. They stay visible without preventing an
organizer from making a deliberate room choice.

## Verification completed

Automated core coverage exercises the evaluator sequence as one durable workflow:

1. create a track, two rooms, Priya Raman, and three approved sessions;
2. place two Priya sessions at the same time in different rooms and verify the warning names her;
3. attempt a third session in an occupied room and verify the operation is rejected without adding
   a placement;
4. move the second Priya session and verify the speaker conflict clears;
5. auto-place the remaining unscheduled session without a room overlap;
6. publish the conflict-free draft; and
7. resolve all three session titles through the public-agenda selector backed by that release.

Separate tests prove draft moves do not change an existing public release, a later publish advances
the release version, older releases remain immutable, and foreign-event rooms cannot be used.

## Evaluator handoff

The hosted evaluator flow keeps organizer and public program routes on one origin. The organizer
configures rooms and tracks under Event settings, builds the draft under Schedule, then uses Preview
agenda after publishing. Public document routing selects the event from the URL and does not require
an organizer session.
