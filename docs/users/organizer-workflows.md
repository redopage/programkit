# Organizer workflows

This guide follows the navigation an event team sees after signing in. Availability depends on the
event role: owners and administrators can make changes; viewers receive read-only access.

## 1. Configure the event

Open **Settings** and set the event name, slug, logo, venue, city, start and end dates, timezone,
and lifecycle status. Add the tracks and rooms that the schedule will use.

ProgramKit rejects event-date changes that would place an existing scheduled session outside the
event. Keep the event timezone correct before scheduling; public dates and calendar feeds derive
from it.

Owners also use Settings to invite teammates, choose the installation's organizer signup policy,
change their password, and review active sessions.

## 2. Build and publish a call for proposals

Open **Forms** to create one or more proposal forms. Each form controls its public slug, title,
introduction, confirmation message, accepted submission kinds, ordered questions, options,
required state, and simple conditional visibility.

Map structured answers to speaker and session fields so acceptance can safely create the program.
Use **Publish readiness** before opening a form and **Preview draft** to test both desktop and mobile
layouts. The detailed workflow is in [Build and publish a CFP](../guides/build-and-publish-a-cfp.md).

## 3. Monitor and decide submissions

Open **Submissions** to search and filter the proposal pipeline, inspect answers and participants,
track the record history, and record accepted, rejected, or waitlisted decisions.

Acceptance is a consequential operation. It creates or reuses the person, creates event
participation and onboarding requirements, and creates the session from mapped answers as one
atomic transition.

## 4. Configure review

Open **Review** to create evaluation plans, define weighted numeric, select, or text criteria,
choose blind-review behavior, assemble reviewer teams, route or assign proposals, monitor progress,
send reminders, and inspect submitted scorecards.

Reviewer portals receive only assigned proposals. Blind plans remove identity-revealing answers
from that projection. Committee summaries support a decision; they do not silently make it.

## 5. Shape accepted sessions

Open **Sessions** to edit accepted content, inspect history, restore an earlier version, and move
content through approval gates. A session is the attendee-facing content record; its placement in
the schedule remains a separate draft record.

## 6. Onboard speakers

Open **Speakers** for the event roster, profiles, participation status, logistics, invitations,
linked sessions, and CSV import. Open **Tasks** for requirements, assignees, due dates, readiness,
and blockers.

Accepted speakers use a scoped portal to confirm participation, update public profile fields, and
complete assigned work. ProgramKit supports reusable people across events without sharing an
event's private participation records.

## 7. Manage files and resources

Open **Files** to review headshots and assigned deliverables, compare versions, exchange attributed
comments, download authorized files, delete a version as an owner, and export selected latest
versions in a ZIP.

The **Speaker resources** area publishes event guides, links, and sandboxed HTTPS embeds into every
accepted-speaker portal. Draft and archived pages stay organizer-only. See
[Publish speaker resources](../guides/publish-speaker-resources.md).

## 8. Prepare communications

Open **Communications** to create templates, select supported audiences, preview merge fields,
review the resolved recipients, approve the frozen message, and inspect delivery or retry state.

Drafting, approval, and sending are intentionally separate. Email delivery requires a configured
provider binding; without it, ProgramKit still records product state but cannot deliver real mail.

## 9. Build and publish the agenda

Open **Agenda** to manage draft placements on the multi-day room grid. Use the unscheduled tray,
drag and drop, the accessible move form, auto-place, clear, and undo while resolving named conflicts
and warnings.

Run publication preflight before publishing. Publication creates an immutable release. The public
agenda, JSON/XML feeds, iCal feeds, and embed read that release until another is published.

## 10. Use the CRM across events

Open **CRM** to search the organization's people across events, filter by participation and profile
signals, manage tags and notes, merge duplicates, build dynamic or static segments, track sourcing,
reuse a contact in another event, and review organization-level analytics.

The CRM is a bounded projection across events in the same organization. Each participation,
session, task, and note still belongs to its event.

## 11. Read operational reporting

**Overview**, **Review**, **Tasks**, **Agenda**, and **CRM** each provide task-shaped reporting:
pipeline health, review progress, readiness blockers, schedule preflight, and organization
activity. **Data & connections** provides portable exports and service status.

ProgramKit does not yet have a single free-form report builder. See
[Reporting and exports](reporting-and-exports.md) for the available reports and honest limits.

## 12. Connect external systems

Open **Data & connections** to:

- download a full logical event export;
- create an Accelevents handoff after publishing;
- inspect connected email, storage, calendar, and website services;
- create event-scoped API keys;
- download the Agent Plugin or copy the MCP endpoint; and
- inspect a Durable Object recovery point without restoring it.

Use one API key per client, save its copy-once secret immediately, prefer a finite expiry, and
revoke it when the integration is no longer used.

## 13. Finish with the public experience

Before announcing the event, exercise every handoff as the recipient:

1. complete the public CFP;
2. open a reviewer invitation and submit a scorecard;
3. accept a speaker invitation and complete a requirement;
4. import the public iCal feed; and
5. open the agenda and embeds without an organizer session.

This catches projection, permission, content, and delivery problems that an organizer-only test
cannot reveal.
