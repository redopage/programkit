<!-- Canonical: https://programkit.dev/docs/users/organizer-workflows -->
<!-- Markdown: https://programkit.dev/docs/users/organizer-workflows.md -->

# Organizer workflows

What each area of the organizer workspace is for. Owners and administrators can make changes;
viewers get read-only access.

To run these steps as a rehearsal in order, with a checkpoint after each one, use
[Set up your first event](/docs/getting-started/first-event.md) instead.

## Configure the event

Open **Settings** and set the event name, slug, logo, venue, city, start and end dates, timezone,
and lifecycle status. Add the tracks and rooms that the schedule will use.

ProgramKit rejects event-date changes that would place an existing scheduled session outside the
event. Keep the event timezone correct before scheduling; public dates and calendar feeds derive
from it.

Owners also use Settings to invite teammates, choose the installation's organizer signup policy,
change their password, and review active sessions.

## Build and publish a call for proposals

Open **Forms** to create one or more proposal forms. Each form controls its public slug, title,
introduction, confirmation message, accepted submission kinds, ordered questions, options,
required state, and simple conditional visibility.

Map structured answers to speaker and session fields so acceptance can safely create the program.
Use **Publish readiness** before opening a form and **Preview draft** to test both desktop and mobile
layouts. The detailed workflow is in [Build and publish a CFP](/docs/guides/build-and-publish-a-cfp.md).

![Call for proposals form builder with fields and publishing controls](/assets/marketing/forms.png)

## Accept, reject, or waitlist proposals

Open **Submissions** to search and filter the proposal pipeline, inspect answers and participants,
track the record history, and record accepted, rejected, or waitlisted decisions.

Acceptance is a consequential operation. It creates or reuses the person, creates event
participation and onboarding requirements, and creates the session from mapped answers as one
atomic transition.

![Proposal pipeline showing submitted session information and status](/assets/marketing/submissions.png)

## Set up review and assign reviewers

Open **Review** to create evaluation plans, define weighted numeric, select, or text criteria,
choose blind-review behavior, assemble reviewer teams, route or assign proposals, monitor progress,
send reminders, and inspect submitted scorecards.

Reviewers see only the proposals assigned to them. A blind plan strips identity-revealing answers
out of what they receive. Committee summaries support a decision; they never make it for you.

![Review workspace showing evaluation progress and proposal decisions](/assets/marketing/reviews.png)

## Edit accepted sessions

Open **Sessions** to edit accepted content, inspect history, restore an earlier version, and move
content through approval gates. A session is the attendee-facing content record; its placement in
the schedule remains a separate draft record.

## Onboard speakers and track their tasks

Open **Speakers** for the event roster, profiles, participation status, logistics, invitations,
linked sessions, and CSV import. Open **Tasks** for requirements, assignees, due dates, readiness,
and blockers.

Accepted speakers use a scoped portal to confirm participation, update public profile fields, and
complete assigned work. ProgramKit supports reusable people across events without sharing an
event's private participation records.

## Collect files and publish speaker resources

Open **Files** to review headshots and assigned deliverables, compare versions, exchange attributed
comments, download authorized files, delete a version as an owner, and export selected latest
versions in a ZIP.

The **Speaker resources** area publishes event guides, links, and sandboxed HTTPS embeds into every
accepted-speaker portal. Draft and archived pages stay organizer-only. See
[Publish speaker resources](/docs/guides/publish-speaker-resources.md).

## Email participants

Open **Communications** to create templates, select supported audiences, preview merge fields,
review the resolved recipients, approve the frozen message, and inspect delivery or retry state.

Drafting, approval, and sending are intentionally separate. Email delivery requires a configured
provider binding; without it, ProgramKit still records product state but cannot deliver real mail.

## Build and publish the agenda

Open **Agenda** to manage draft placements on the multi-day room grid. Use the unscheduled tray,
drag and drop, the accessible move form, auto-place, clear, and undo while resolving named conflicts
and warnings.

Run publication preflight before publishing. Publication creates an immutable release. The public
agenda, JSON/XML feeds, iCal feeds, and embed read that release until another is published.

![Agenda workspace with sessions arranged by time and room](/assets/marketing/schedule.png)

## Reuse people across events

Open **CRM** to search the organization's people across events, filter by participation and profile
signals, manage tags and notes, merge duplicates, build dynamic or static segments, track sourcing,
reuse a contact in another event, and review organization-level analytics.

The CRM reads across events in the same organization. Each participation, session, task, and note
still belongs to its own event.

## Find reporting

**Overview**, **Review**, **Tasks**, **Agenda**, and **CRM** each provide task-shaped reporting:
pipeline health, review progress, readiness blockers, schedule preflight, and organization
activity. **Data & connections** provides portable exports and service status.

ProgramKit does not yet have a single free-form report builder. See
[Reporting and exports](/docs/users/reporting-and-exports.md) for the available reports and honest limits.

## Export data and connect other systems

Open **Data & connections** to:

- download a full logical event export;
- create an Accelevents handoff after publishing;
- inspect connected email, storage, calendar, and website services;
- create event-scoped API keys;
- download the Agent Plugin or copy the MCP endpoint; and
- inspect a Durable Object recovery point without restoring it.

Use one API key per client, save its copy-once secret immediately, prefer a finite expiry, and
revoke it when the integration is no longer used.

## Before you announce

The organizer interface can look complete while a public form, invitation, portal, or feed is
still broken. Walk every handoff as the person who receives it — submitter, reviewer, speaker,
attendee — before announcing. [Set up your first event](/docs/getting-started/first-event.md) is
that rehearsal, and the [launch checklist](/docs/self-hosting/launch-checklist.md) decides whether
an installation is ready for real data.
