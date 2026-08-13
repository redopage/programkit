# Participant experiences

ProgramKit gives submitters, reviewers, accepted speakers, and attendees focused views instead of
the organizer workspace. Each view has a smaller data projection and operation allowlist.

## Submitter

The public CFP shows one open form and its event identity. A submitter can create an event-scoped
participant account, save a draft, edit answers, add co-speakers, satisfy visible required fields,
and submit. Conditional questions respond to earlier answers.

Participant credentials do not create staff membership. After sign-in, ProgramKit matches the
normalized email to that event's submissions, review assignments, and speaker participations and
returns only those destinations.

## Reviewer

A reviewer opens a scoped queue containing only assigned proposals. The review plan controls
criteria, weighting, required fields, blind-review redaction, and assignment limits. A scorecard
must satisfy every required criterion before submission.

The reviewer cannot browse the organizer workspace, unrelated proposals, private committee notes,
or another reviewer's scorecard.

## Accepted speaker

The speaker portal is scoped to one event participation. It can include:

- participation confirmation or withdrawal;
- public profile and biography fields;
- linked sessions;
- assigned requirements and due dates;
- headshot and deliverable uploads with version history;
- attributed file comments; and
- organizer-published guides, links, and safe embeds.

Draft or archived resources and another speaker's files are not included in this projection.

## Attendee

The public program reads only the latest published schedule release. It can expose agenda,
session, speaker, itinerary, and gallery views, plus embeddable and machine-readable feeds.

Changes to the organizer's draft schedule are invisible until another publication. This gives
attendees a stable release instead of a page that changes mid-edit.

## Recovering access

The general access flow can restore the event-scoped destinations associated with a participant
email. The resulting participant session is not accepted by operator endpoints and does not replace
the record-scoped authorization check on a submission, review queue, or speaker portal.

## When sharing links

- Share the event-specific public CFP or agenda URL, not an organizer route.
- Treat reviewer and speaker invitation links as private until they are exchanged for the intended
  account or scoped session.
- Revoke a team member through Settings; do not rely on hiding the navigation.
- Test links in a separate browser profile before sending them broadly.

See [Routes and surfaces](../reference/routes-and-surfaces.md) for the path families and
[Identity and tenancy](../architecture/identity-and-tenancy.md) for the authorization model.
