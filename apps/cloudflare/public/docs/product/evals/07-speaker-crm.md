<!-- Canonical: https://programkit.dev/docs/product/evals/07-speaker-crm -->
<!-- Markdown: https://programkit.dev/docs/product/evals/07-speaker-crm.md -->

# Speaker CRM evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/07-speaker-crm.yaml`. Speaker CRM is optional extra credit, but ProgramKit
implements it as a useful organization layer above event-specific speaker operations.

## Current coverage

| Rubric | Status         | ProgramKit evidence                                                                                                                                                                                                                                                          |
| ------ | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRM-01 | Verified       | CRM is a top-level navigation item outside an event module. Directory rows show name, email, company, title, tags, event count, and last update. Search narrows the list and clears without changing stored data.                                                            |
| CRM-02 | Verified       | Company, tag, and title filters combine with text search. Active filters expose a Clear action that restores the complete directory.                                                                                                                                         |
| CRM-03 | Verified       | Contact detail includes identity, headshot, email, company/title, persistent private notes, event and session connections, sourcing history, and timestamps.                                                                                                                 |
| CRM-04 | Verified       | Comma-separated tags are normalized, deduplicated, stored on the person record, shown in the directory, and available as a filter.                                                                                                                                           |
| CRM-05 | Verified       | Import accepts the evaluator CSV shape, previews mapped rows, marks duplicate emails as skipped, reports validation errors, and commits new contacts to the organization directory.                                                                                          |
| CRM-06 | Verified       | Same-name records appear as possible duplicates. The comparison names the kept and merged profiles, warns that merge is irreversible, and moves participations, sessions, notes, assets, tasks, segments, and pipeline history to the primary record.                        |
| CRM-07 | Verified       | The pipeline has Researching, Identified, Contacted, Interested, Confirmed, and Declined columns. Enrollment accepts contact, starting stage, fit score, and rationale. Cards support drag and drop plus a select-based accessible move control, with versioned persistence. |
| CRM-08 | Verified       | Contact detail exposes persistent sourcing notes and a reverse-chronological stage history with actor and timestamp.                                                                                                                                                         |
| CRM-09 | Verified       | A filtered or selected directory set can be saved as a dynamic or curated segment. Segments reopen their current members and can feed outreach.                                                                                                                              |
| CRM-10 | Verified       | Contact detail lists every event connection and offers Add to event for any unlinked event. The operation reuses the organization person, carries its profile fields, and creates one event participation without duplication.                                               |
| CRM-11 | Verified queue | Multi-select reveals Email. The composer previews resolved `{{first_name}}` values, freezes personalized messages into the durable outbox, and reports success. Provider delivery remains a manual deployment check.                                                         |
| CRM-12 | Verified       | Overview shows total contacts, events, returning speakers, active prospects, top companies, top tags, and recently updated contacts. Counts derive from the same directory state.                                                                                            |

## Browser verification completed

The running Worker-backed app was inspected at `/crm`:

1. CRM appeared in the primary People navigation above event-specific Speakers.
2. Overview showed 18 contacts, event and returning-speaker counts, pipeline prospects, populated
   company/tag analytics, and recent contacts.
3. Directory exposed text search, three attribute filters, save segment, selection, import, and
   contact detail from a keyboard-operable table.
4. Pipeline rendered all six stages and a persisted prospect in Identified.

Focused core tests separately exercise event reuse, normalized tags, persistent notes, dynamic
segments, pipeline moves and notes, duplicate merge compensation, dashboard counts, and resolved
outreach personalization.

## Final evaluator handoff

Create the second fixture event before testing Add to event. Run the CSV import, note, tag, merge,
segment, sourcing, and outreach actions through the browser, reloading wherever the rubric asks.
For the manual CRM-11 half, include a controlled mailbox and confirm the delivered subject and body
contain the real first name rather than the literal merge token.
