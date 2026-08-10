# Abstract management evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/02-abstract-management.yaml`. It describes exercised behavior, not seeded
screenshots.

## Current coverage

| Rubric | Status         | ProgramKit evidence                                                                                                                                                                       |
| ------ | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ABS-01 | Verified       | The evaluation-plan drawer creates independent rounds with names, open/close dates, and round-specific scorecards. Core tests reload the resulting state.                                 |
| ABS-02 | Verified       | Every round selects its own default reviewer team and can override the pool by proposal category. Teams and routes persist by round ID without rewriting existing assignments.            |
| ABS-03 | Verified       | The editor and reviewer surface support numeric, select, and long-text criteria. Stored answers are covered by core tests.                                                                |
| ABS-04 | Verified       | Numeric criteria carry weights. Results and exports use the weighted aggregate and label it accordingly.                                                                                  |
| ABS-05 | Verified       | Organizers select exact proposals for one reviewer. The reviewer projection contains only that person's assignments.                                                                      |
| ABS-06 | Verified       | Bulk assignment supports a track filter and per-reviewer maximum. The selected track automatically limits eligible reviewers to its routed pool. Both paths are exercised by tests.       |
| ABS-07 | Verified       | Blindness is round-specific. Reviewer projections remove author, co-author, company, job title, biography, and email fields; organizer views retain them.                                 |
| ABS-08 | Verified       | `/reviews` derives assigned, completed, outstanding, and percentage values from live assignments and scorecards.                                                                          |
| ABS-09 | Partial manual | The organizer can select lagging reviewers and receives a sent confirmation. The default path records a demo outbox event; provider-delivered reviewer email still needs manual evidence. |
| ABS-10 | Verified       | The results table shows weighted aggregates and toggles between ascending and descending score order.                                                                                     |
| ABS-11 | Verified       | Submission participants include primary and co-speaker roles in speaker and organizer detail views. Acceptance converts every participant.                                                |
| ABS-12 | Verified       | A reviewer can declare a proposal-scoped conflict and undo it. Both API behavior and the browser transition are exercised.                                                                |
| ABS-13 | Verified       | Review results download as CSV with one row per submission, criterion averages, weighted aggregate, recommendations, comments, participants, and status.                                  |
| ABS-14 | Not claimed    | ProgramKit does not advertise AI evaluation. The V1 rubric marks this item not applicable when the feature is not claimed.                                                                |

## Reviewer handoff

`/reviews` displays a separate copyable link for every reviewer. The hosted link includes event
routing and a reviewer capability:

```text
/reviewer/{reviewerId}/{accessKey}?event={eventId}
```

The browser surface has no organizer navigation. Its data requests use the same-origin public
reviewer endpoint plus `x-programkit-reviewer-key`; the server still verifies the reviewer actor,
event, reviewer ID, and capability before reading or mutating anything.

## Browser verification completed

The local Worker-backed app was exercised through the organizer and reviewer UI:

1. selected a lagging reviewer and sent a reminder;
2. opened the generated reviewer link;
3. confirmed the queue contained only that reviewer's four assigned proposals;
4. declared a conflict with a chair note;
5. reopened the recused item and undid the conflict;
6. submitted the remaining scorecards; and
7. confirmed the capability URL stayed intact while the queue advanced to 4 of 4 complete.

## Remaining scenario risk

The abstract workflow itself is complete, but the evaluator entry point must be chosen carefully.
`app.programkit.dev` currently uses organizer magic-link authentication, while the V1 harness cannot
leave the target origin to read email. Until fixture-password or deterministic evaluator login is
available, use one durable demo capability for the chained evaluator run so public CFP, organizer,
reviewer, speaker, and attendee routes share state and origin.
