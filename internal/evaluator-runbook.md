# Competition evaluator runbook

Use this runbook to turn the competition rubric into reproducible browser evidence. The canonical
capability assessment remains the [evaluator gap analysis](evaluator-gap-analysis.md); this file
describes how to run it.

## Target

Use a fresh organizer account at `app.programkit.dev`. Create the fixture event from the empty
workspace, then keep every role and public page on `programkit.dev` or a sibling subdomain because
the V1 runner blocks unrelated sites and cannot rely on an external inbox. Use a different
disposable organizer account for each full run. Do not run destructive scenarios against a
collaborator's long-lived event, and do not expose the seeded demonstration reset in the hosted app.

The seven-day demo is still the fastest product walkthrough, but its seeded capability actors do
not prove account signup, event membership, or participant recovery.

The local `killmysaas-evals/evalconfig.json` should therefore target
`https://app.programkit.dev`, leave credentials empty for a fresh run, and use the fixture
email/password identities through open signup. Every scenario receives a fresh browser context but
server state persists across the ordered run. If signup reports that a fixture account already
exists, sign in with that fixture identity instead. `demo.programkit.dev` is for human review only
and must not be used as the automated target.

Password protection does not need an evaluator exception. ProgramKit counts failed password
attempts, resets the email failure bucket after a successful sign-in, and does not count successful
sign-ins. The standard 10-failure email limit remains active during evaluation.

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

| Role      | Hosted route                                              | Expected boundary                                                |
| --------- | --------------------------------------------------------- | ---------------------------------------------------------------- |
| Organizer | `/`, `/forms`, `/submissions`, and other operator routes  | Verified event membership and role-derived scopes                |
| Submitter | `/submit/{formSlug}?event={eventId}` then `/access`       | Only submissions matching the participant email                  |
| Reviewer  | Link copied from `/reviews`                               | Only that reviewer's assignments and scorecard actions           |
| Speaker   | Link copied from `/people` or recovered through `/access` | One accepted participation, profile, resources, files, and tasks |
| Attendee  | `/agenda?event={eventId}&view={view}`                     | Five anonymous views of one published program                    |

Reviewer and speaker destinations retain record capabilities. Participant sign-in makes them
recoverable from another device but does not replace the server capability check or authorize
organizer routes.

Public program views use `agenda`, `sessions`, `speakers`, `itinerary`, and `gallery`. Add
`track={trackId}` to verify filtered links and embeds. The itinerary selection must survive a reload,
and its calendar export must contain the selected session's title, time, and room.

## Recommended scenario order

Run the workflow in dependency order so later evidence uses real earlier transitions:

1. event and CFP setup;
2. public submission;
3. reviewer assignment, scoring, and decision;
4. accepted-speaker profile and requirements;
5. file delivery, versioning, comments, and organizer review;
6. schedule construction and publication;
7. public program, embeds, and calendar output;
8. optional CRM and bonus scenarios.

Provision a second disposable account before another full run. Keep screenshots, relevant IDs, the
Worker version, and the source commit together in the evidence record.

## What V1 does not score

The browser rubric does not score Airtable, Cloudflare, API breadth, repository hosting, or raw
performance directly. Those still matter for the overall product and bonus review. They should not
replace a missing required transition in the implementation order.
