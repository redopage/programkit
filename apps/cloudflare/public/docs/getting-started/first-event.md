<!-- Canonical: https://programkit.dev/docs/getting-started/first-event -->
<!-- Markdown: https://programkit.dev/docs/getting-started/first-event.md -->

# Set up your first event

|                    |                                                                  |
| ------------------ | ---------------------------------------------------------------- |
| **For**            | A new organizer or installation owner                            |
| **Starting point** | A running local sample or a claimed hosted installation          |
| **Outcome**        | A tested CFP, review flow, speaker handoff, and published agenda |
| **Allow**          | 30–60 minutes for a rehearsal with sample data                   |

This walkthrough intentionally crosses every role. The organizer interface can look complete while
a public form, invitation, portal, or feed is still misconfigured; testing the handoffs is part of
setting up the event.

## 1. Name and date the event

Open **Settings** and complete the event identity, venue, city, start and end dates, and timezone.
Upload a logo if the installation has R2 configured.

Add at least one track and one room. Use the real timezone before placing sessions because public
dates, schedule validation, calendar downloads, and email attachments derive from it.

**Ready when:** the header shows the correct event and Settings has a usable track and room.

## 2. Decide who can organize

In a self-host, confirm **Installation access** is invite-only unless the installation intentionally
offers public SaaS signup. Add event teammates only after invitation email is configured.

Use an administrator for an operator who should make changes and a viewer for a stakeholder who
only needs visibility.

**Ready when:** every organizer has an individual account and the signup policy matches the service
you intend to run.

## 3. Build the CFP

Open **Forms**. Set the public title, slug, introduction, confirmation message, accepted submission
kinds, and open/close window. Add the questions required for the event.

Map the eight required speaker and session fields before publishing. Keep conditional questions
dependent on earlier answers and test every branch in **Preview draft**.

**Ready when:** Publish readiness passes and the public form is open.

## 4. Test as a submitter

Open the public form in a signed-out browser. Create a participant account, save a draft, leave and
return, complete all visible required fields, add a co-speaker if relevant, and submit.

Check the configured confirmation behavior. Real email confirmation requires the deployment's
email binding.

**Ready when:** the submitted proposal appears in **Submissions** with the expected answers and
participants.

## 5. Configure review

Open **Review** and create an evaluation plan with criteria, weights, blind-review policy, team,
and assignments. Open a reviewer invitation in a signed-out browser and submit a complete
scorecard.

If the review is blind, confirm identity-revealing fields are absent from the data the reviewer
receives, not merely hidden by CSS.

**Ready when:** reviewer progress and the submitted scorecard appear in the committee view.

## 6. Decide and inspect the accepted program

Return to **Submissions** and accept the rehearsal proposal. ProgramKit should create or reuse the
person and create their event participation, requirements, and session in one operation.

Open **Speakers**, **Tasks**, and **Sessions** to confirm those connected records exist and carry the
expected mapped content.

**Ready when:** there is no partial accepted state and the records link back to the source proposal.

## 7. Test the speaker portal and files

Open the speaker portal in a signed-out browser. Confirm participation, update the public profile,
complete a requirement, and upload a permitted sample file. As an organizer, review the version,
add a comment, and download it.

Create one published speaker resource in **Files** and confirm it appears in the portal. Draft and
archived resources should not appear.

**Ready when:** the speaker and organizer see the same requirement state but only records within
that participation's scope.

## 8. Exercise communications

Create a template, choose a supported audience, preview merge fields, inspect the resolved
recipients, and move a rehearsal campaign through review and approval. Send only to controlled
addresses after email is configured and verified.

**Ready when:** Communications shows the frozen recipient, delivery state, provider attempt, and
any retry or failure without losing the approved content.

## 9. Build the schedule

Open **Agenda**, place the accepted session, and introduce one conflict deliberately if possible.
Confirm validation names the affected records. Resolve the conflict and run publication preflight.

**Ready when:** preflight has no unexplained blockers and every public session has an intentional
time, room, and visible content state.

## 10. Publish and inspect the public program

Publish the schedule, then open the agenda in a signed-out browser. Check agenda, session, speaker,
itinerary, and gallery views as applicable. Download the iCal feed and inspect JSON/XML or an embed
when those outputs will be used externally.

Move a placement in the draft without republishing. The public agenda should remain unchanged.

**Ready when:** another explicit publication is required before a draft change reaches attendees.

## 11. Export and record the baseline

Open **Data & connections** and download the full ProgramKit export. Record the source revision,
Worker name, R2 bucket, custom domain, and who owns operational alerts and recovery.

If an agent or integration will be used, create a separate short-lived key, verify **Last used**,
and revoke the rehearsal key after testing.

**Ready when:** the team can identify the running version, recover portable event data, and name the
person responsible for the installation.

## Next event work

Use [Organizer workflows](/docs/users/organizer-workflows.md) as the product reference and the
[launch checklist](/docs/self-hosting/launch-checklist.md) before opening a self-host to real users.
