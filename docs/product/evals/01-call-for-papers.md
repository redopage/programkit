# Call for Papers evaluation

This is the implementation and verification map for
`killmysaas-evals/specs/01-call-for-papers.yaml`. It describes exercised behavior, not seeded
screenshots.

## Current coverage

| Rubric | Status         | ProgramKit evidence                                                                                                                                                                                                   |
| ------ | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CFP-01 | Verified       | The form builder adds text, long-text, select, file, and other question types, including required flags. The public renderer and operation boundary validate visible required fields.                                 |
| CFP-02 | Verified       | Fields can depend on another answer through equals, not-equals, or includes rules. The same visibility selector drives the builder preview, public form, and submit validation.                                       |
| CFP-03 | Verified       | The public route requires no login and shows event identity, location, close date, configured form fields, tracks, formats, and select options.                                                                       |
| CFP-04 | Verified       | Organizers edit opening and closing times in the event timezone. Scheduled and closed forms remain readable publicly while create, update, and submit operations reject writes outside the window.                    |
| CFP-05 | Verified       | A speaker capability is created on first draft, stored locally, and returned in the private dashboard URL. A completed proposal submits with an on-screen confirmation and status.                                    |
| CFP-06 | Verified       | Organizer submission detail resolves the same stored answers, participants, track, format, and custom fields supplied through the public form. Core and HTTP tests cover the round trip.                              |
| CFP-07 | Verified       | A title-only proposal can be saved as a private draft, resumed through its speaker link, completed, saved again, and submitted. Core, HTTP, and browser journeys exercise the lifecycle.                              |
| CFP-08 | Verified queue | Submission creates a durable `submission_confirmation` outbox item with the submitter, event, and proposal title. Provider delivery remains a manual deployment check.                                                |
| CFP-09 | Verified       | Speakers can edit their own submitted proposal while the call is open. Expected versions protect concurrent edits and the organizer reads the same updated record.                                                    |
| CFP-10 | Verified       | Organizers create reviewers, group them into pools, and optionally route each proposal category to a different pool. Automatic assignments use the submitted track and reviewer links expose only the assigned queue. |
| CFP-11 | Verified       | Assigned reviewers submit ratings and comments, completion updates immediately, and organizers see the same scorecard in submission review detail.                                                                    |
| CFP-12 | Verified       | Organizer decisions support accepted, rejected, and waitlisted states, including explicit override reasons where review minimums are not met. Distinct statuses persist in the list.                                  |
| CFP-13 | Verified       | The private speaker dashboard reads the same submission record, so organizer decisions appear as Accepted, Rejected, or Waitlisted without a second status store.                                                     |
| CFP-14 | Verified queue | Decision notification is an explicit organizer action. It queues a durable personalized message and exposes pending, sent, and failed delivery states in Communications.                                              |
| CFP-15 | Verified       | Accepting a proposal atomically creates or reuses people, participation records, requirements, and a session carrying the proposal title, speakers, track, format, duration, and description.                         |
| CFP-16 | Verified       | The speaker dashboard removes editing outside the submission window, and the operation boundary independently rejects update and submit attempts after close.                                                         |

## Draft lifecycle exercised in the browser

The local Worker-backed public form was exercised as a speaker:

1. entered only a session title and selected **Save draft**;
2. arrived at the private **Your submissions** dashboard with a Draft status;
3. selected **Continue draft** and confirmed the title was restored;
4. added the missing name, email, biography, abstract, format, and track;
5. saved the completed draft and confirmed the dashboard reflected the persisted values; and
6. resumed once more, submitted, and confirmed the status changed to Submitted.

The browser run exposed and fixed a boundary defect where an empty contributor list still caused
the draft operation to require a primary email. A focused HTTP test now protects the public route in
addition to the core operation test.

Category routing is stored on each evaluation round. The organizer can keep one default reviewer
pool and override only the tracks that need specialist review. Core tests prove that a newly
submitted proposal is assigned from its routed pool and that adding a route does not rewrite review
assignments already in progress.

## Identity model

The hosted reference uses event-scoped email and password accounts for public submitters. A signed
in participant can recover only the submission, reviewer, and speaker destinations whose stored
email matches that account. Each destination still uses an unguessable record capability, and the
Worker verifies that capability on every projected read and operation. Staff authentication and
event membership remain completely separate.

## Remaining manual evidence

Email queue creation and status are deterministic and testable in the product. Actual provider
delivery depends on deployment secrets, sender-domain verification, and the recipient mailbox, so
CFP-08 and the delivery portion of CFP-14 still require a live-provider check when that evidence is
needed.
