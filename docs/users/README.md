# Product and user guide

ProgramKit manages the program side of a conference: proposals, review, accepted speakers,
sessions, requirements, files, communications, scheduling, and the public agenda. It deliberately
does not try to become a ticketing, payments, attendee-networking, or general marketing suite.

## The five experiences

| Person           | Experience         | Primary outcome                                                      |
| ---------------- | ------------------ | -------------------------------------------------------------------- |
| Organizer        | Operator workspace | Move the program from intake to a reliable published agenda          |
| Submitter        | Public CFP         | Create, save, edit, and submit an accurate proposal                  |
| Reviewer         | Reviewer workspace | Evaluate only assigned proposals against a consistent plan           |
| Accepted speaker | Speaker portal     | Confirm participation, maintain a profile, and complete requirements |
| Attendee         | Public program     | Find released sessions and speakers without seeing internal drafts   |

These are separate experiences with server-enforced access. A participant account never becomes
an organizer account, and a public event link never grants operator access.

## Organizer navigation

| Area                   | Use it for                                                                 |
| ---------------------- | -------------------------------------------------------------------------- |
| **Overview**           | Current phase, deadlines, blockers, and the next high-value actions        |
| **Forms**              | CFP structure, mapped fields, conditional questions, preview, and publish  |
| **Submissions**        | Proposal pipeline, detail, decisions, and accepted-program creation        |
| **Review**             | Plans, criteria, teams, assignments, progress, reminders, and scorecards   |
| **Sessions**           | Accepted content, descriptions, history, approval, and restoration         |
| **Agenda**             | Draft placements, conflicts, preflight, publication, and public release    |
| **CRM**                | Cross-event people, segments, tags, notes, sourcing, and reuse             |
| **Speakers**           | Event roster, profiles, invitations, logistics, and linked sessions        |
| **Tasks**              | Requirements, due dates, readiness, assignees, and blockers                |
| **Files**              | Headshots, deliverables, versions, comments, ZIP export, and resources     |
| **Communications**     | Templates, audiences, preview, approval, delivery, retry, and history      |
| **Data & connections** | Exports, services, API keys, agent connection, and recovery inspection     |
| **Settings**           | Event identity, dates, timezone, tracks, rooms, team, and account security |

Use [Organizer workflows](organizer-workflows.md) for the task-by-task guide.
New organizers can use [Set up your first event](../getting-started/first-event.md) as a guided
rehearsal that crosses the public, reviewer, speaker, and attendee handoffs.

## The lifecycle

```text
Configure event
  → build and publish a form
  → receive proposals
  → review and decide
  → create speakers, tasks, and sessions
  → collect files and confirmations
  → build and publish the schedule
  → serve the public program
```

Communications, reporting, CRM, API access, and agent assistance support this lifecycle. They are
not independent sources of truth.

## Important product rules

- Accepting a proposal atomically creates or reuses the person, event participation, requirements,
  and session. There is no partially accepted state.
- Sessions and schedule placements are separate. Editing content does not silently change time or
  room, and moving a draft placement does not rewrite a published agenda.
- The public program uses the latest immutable release. Publish again when the draft changes.
- Files are private R2 objects mediated by ProgramKit authorization. Metadata and audit state stay
  with the event.
- Communications move through draft, review, approval, frozen recipients, and delivery state.
- Every human, API, or agent mutation uses the same domain operation and authorization rules.

## Continue by role

- Organizers: [Organizer workflows](organizer-workflows.md)
- Submitters, reviewers, speakers, and attendees: [Participant experiences](participant-experiences.md)
- Owners and administrators: [Roles and access](roles-and-access.md)
- Teams looking for reports: [Reporting and exports](reporting-and-exports.md)
- Technical owners: [Self-hosting](../self-hosting/README.md) or [Developer guide](../developers/README.md)
