# Competition evaluator runbook

Use this runbook to turn the competition rubric into reproducible browser evidence. The canonical
capability assessment remains the [evaluator gap analysis](evaluator-gap-analysis.md); this file
describes how to run it.

## Target

Use one fresh seven-day workspace at `demo.programkit.dev/demo/{capability}`. Keep every role and
public page on that origin because the V1 runner blocks cross-origin navigation and provides no
external account credentials. Do not run destructive scenarios against `app.programkit.dev` or a
collaborator's long-lived workspace.

## Evidence rule

A scenario is complete only when the browser can:

1. start from a known fixture;
2. perform the action through the intended UI;
3. observe validation or authorization at the point of action;
4. reload and see the accepted change;
5. verify the result on each affected role or public surface; and
6. capture the final state without private data or credentials.

Record each rubric item as `verified`, `partial`, `missing`, or `blocked`. A seeded visual state is
not verified evidence of a transition.

## Role surfaces

| Role      | Demo route                     | Expected boundary                                     |
| --------- | ------------------------------ | ----------------------------------------------------- |
| Organizer | `/forms`, `/submissions`, etc. | Full sample-workspace operations                      |
| Submitter | `/submit/{formSlug}`           | One public form and its allowed submission operations |
| Reviewer  | `/reviewer/{reviewerId}`       | Assigned proposals and scorecard operations only      |
| Speaker   | `/portal/{participationId}`    | One accepted participation and eligible tasks only    |
| Attendee  | `/agenda?view={view}`          | Five public views of one immutable published program  |

The demo derives scoped actors from these sample IDs. That is useful for deterministic evaluation,
but it is not production identity. Hosted participant and reviewer sessions remain separate work.

Public program views use `agenda`, `sessions`, `speakers`, `itinerary`, and `gallery`. Add
`track={trackId}` to verify filtered links and embeds. The itinerary selection must survive a reload,
and its calendar export must contain the selected session's title, time, and room.

## Recommended scenario order

Run the workflow in dependency order so later evidence uses real earlier transitions:

1. event and CFP setup;
2. public submission;
3. reviewer assignment, scoring, and decision;
4. accepted-speaker profile and requirements;
5. file delivery when R2 support is complete;
6. schedule construction and publication;
7. public program, embeds, and calendar output;
8. optional CRM and bonus scenarios.

Reset to a fresh capability when a scenario needs a conflicting starting state. Keep screenshots,
the capability creation time, relevant IDs, and the git commit together in the evidence record.

## What V1 does not score

The browser rubric does not score Airtable, Cloudflare, API breadth, repository hosting, or raw
performance directly. Those still matter for the overall product and bonus review. They should not
replace a missing required transition in the implementation order.
