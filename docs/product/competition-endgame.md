# Competition endgame plan

Deadline: **Wednesday 12 August 2026, 10:00 PM PT**. Written 9 August 2026.

This is a verified audit, not a restatement of intent. Every "have" below was confirmed against the
running application, the operation engine, or the deployed hosts. Every "missing" was confirmed by
the absence of a write operation or UI affordance, not inferred from the roadmap.

The scoring is my own honest estimate against the 96-item `killmysaas-evals` rubric at commit
`d99935c`. The evaluator is unchanged since the last gap analysis, so the rubric is stable.

## Verified baseline

- `programkit.dev`, `demo.programkit.dev`, `app.programkit.dev` all return 200 in under 200 ms.
- The seeded AIE NYC workspace loads overview, forms, submissions, reviews, sessions, schedule,
  people, readiness, communications, agenda, portal, and reviewer surfaces.
- The engine exposes **23 product write operations**, plus `workspace.reset-demo`. That product
  operation set is the ceiling on what the evaluator can make the application do:

  ```
  campaign.approve            campaign.create-draft       campaign.send
  campaign.submit             change-set.approve          change-set.commit
  change-set.create           change-set.reject           event.update
  participation.set-status    person.create               person.update
  portal.update-profile       requirement.set-status      review.decide
  review.submit-scorecard     schedule.move-session       schedule.publish
  submission-form.create      submission-form.publish     submission-form.update
  submission.create           submission.submit
  ```

Everything the rubric asks for that is not in that list is currently seed-only: visible, but not
creatable or editable by the evaluator. That is the single most important fact in this document.

## Estimated position: ~57 / 100 required, ~0.5 / 19 extra credit

| Area                | Weight | Estimate | Verdict                                                              |
| ------------------- | -----: | -------- | -------------------------------------------------------------------- |
| Public widgets      |     20 | **18.5** | Strongest area. Nearly done.                                         |
| Call for papers     |     20 | **10.9** | Builder is excellent; submitter identity and window rules are absent |
| Speaker management  |     15 | **8.9**  | Roster solid; no import, no task creation, no uploads                |
| Abstract management |     20 | **8.6**  | Rich domain model with almost no administration UI                   |
| AI agenda           |     10 | **6.4**  | Conflict detection is real; inventory and multi-day are not          |
| Content management  |     15 | **3.1**  | Largest hole in the submission                                       |
| Speaker CRM (extra) |   (10) | **~0.5** | Not started                                                          |

### What is genuinely working

Form builder with conditional logic, public submission, proposal round-trip to the organizer,
blind reviewer scoping, scorecard capture, accept/reject decisions, accepted-to-session handoff,
speaker/room conflict detection, versioned moves, immutable schedule release, and all five public
widgets with search, filters, day navigation, itinerary persistence, and ICS export. The public
program is close to best-in-class for this field.

### Confirmed absences, with the rubric items they cost

| Gap                                                             | Items                                                     | Item weight |
| --------------------------------------------------------------- | --------------------------------------------------------- | ----------: |
| No file upload anywhere (no R2 binding, no asset write op)      | CNT-02, CNT-04, CNT-05, CNT-06, CNT-13, CNT-14, SPK-08/10 |      **17** |
| No session create/update op (title, abstract, room, track)      | CNT-09, CNT-11, AIA-02, AIA-03                            |       **9** |
| No requirement/task creation op (definitions are seed-only)     | CNT-01, CNT-07, SPK-05                                    |       **8** |
| No submitter identity or "my submissions" dashboard             | CFP-05, CFP-09, CFP-13, CFP-07                            |       **9** |
| CFP window not enforced on create/submit or the public page     | CFP-04, CFP-16                                            |       **4** |
| Portal/reviewer sessions do not block organizer routes          | SPK-07, CNT-03                                            |       **6** |
| No review administration UI (rounds, scorecard editor, assign)  | ABS-01, ABS-02, ABS-03, ABS-05, ABS-06                    |      **13** |
| No real mail provider or calendar invites                       | CFP-08, CFP-14, SPK-06, SPK-13/14/16, ABS-09, CNT-08      |      **12** |
| No CSV import                                                   | SPK-03, CRM-05                                            |       **4** |
| No rooms/tracks admin, no unscheduled tray, no multi-day studio | AIA-01, AIA-02, AIA-03, AIA-08                            |       **9** |
| No co-author capture                                            | ABS-11                                                    |       **2** |
| Speaker portal not reachable from the organizer UI              | blocks SPK-S2, CNT-S2, ABS-S1 evidence entirely           |           — |
| Whole CRM area                                                  | CRM-01…12                                                 |    19 extra |

## Buyer-brief requirements outside the rubric

The brief lists six firm requirements. Two are not scored by the evaluator but are explicitly named
by the buyer, and the stated tiebreaker is "the product we would actually use":

- **Calendar invites delivered to each speaker's own calendar** (Gmail, Outlook, iCal). Personalized
  speaker calendar attachments now ship with approved campaign delivery.
- **One-way Accelevents integration.** Integrations can now export the published program as official
  speaker and session CSVs, a room mapping sheet, and an import guide.
- **Resource / wiki pages in the speaker portal with HTML embed support.** Organizers can create,
  publish, archive, and safely embed HTTPS resources. Only published pages reach speakers.

The Cloudflare deployment, Forge hosting, HTTP API, and fast page loads are already banked. Airtable
is deliberately not counted here: its source-of-truth bonus is not part of the V1 browser rubric,
and expanding it now would displace required product work.

## Execution order

This is a dependency order, not a calendar promise. Each milestone should be committed, deployed,
and exercised through its complete user journey before the next one starts.

### 1. Make the evaluator able to enter and write

1. **Evaluator substrate.** One-origin signup and sign-in with fixture-compatible passwords while
   retaining magic links for ordinary users; event-scoped organizer, submitter, reviewer, and
   speaker access; conventional route aliases; empty-workspace event creation; and a repeatable
   reset. The grader supplies fixture identities and passwords, but it does not supply pre-created
   accounts or an inbox.
2. **Event inventory.** Event dates, venue, tracks, session formats, and rooms must all be creatable
   from an empty workspace and immediately available to forms, sessions, and scheduling.
3. **CFP completion.** Enforce the form window server-side, add the deadline/closed public states,
   add submitter draft resume and editing, and provide a scoped My submissions dashboard.
4. **Review administration.** Round editor, scorecard field editor (numeric, dropdown, text, with
   weights), per-round reviewer pools, exact and bulk assignment with auto-distribution, aggregate
   results with bidirectional sort, conflict recusal, progress, and CSV export.

### 2. Build the shared content primitives

5. **Session CRUD.** `session.create`, `session.update`, `session.set-approval`, plus room and
   track creation. Unblocks CNT-09, CNT-11, AIA-02, AIA-03, CNT-12 and makes the schedule studio
   real instead of seeded.
6. **Requirement/task CRUD.** `requirement-definition.create/update` with due dates and multi-
   assignee targeting. Unblocks CNT-01, CNT-07, SPK-05, and every deliverables scenario.
7. **File pipeline on R2.** Add the binding, `asset.initiate-upload` / `asset.commit`, version
   chain, private authorized download, visible type and size constraints, and one shared uploader
   component used by portal headshots, portal deliverables, and CFP attachments. Then a files
   library view and a multi-select ZIP. This is the single largest point block in the rubric.

### 3. Close the speaker and communication loops

8. **Speaker lifecycle.** CSV import, status controls, task assignment, session linking, scoped
   speaker portal, profile and file updates, readiness filters, and custom fields.
9. **Real mail.** One provider (Cloudflare Email or Resend) behind a transactional outbox, with
   templates carrying merge tokens, per-recipient preview, test send, message history, and a bulk
   reminder action from readiness. Attach a speaker-directed ICS invite to the accepted-speaker
   message. That closes the buyer's calendar requirement and CFP-08/14, SPK-06/13/14/16 together.

### 4. Finish scheduling, public output, and evidence

10. **Schedule studio depth.** Day navigation across the full event, unscheduled tray, auto-place
    assist, clear and undo.
11. **Public widget deltas.** Complete missing facets and result counts, speaker metadata, shared
    room-column schedule grid, embed studio, and approved-content propagation without republishing
    placements.
12. **Co-authors** on submissions with role labels.
13. **Buyer-brief extras:** complete. Portal resources normalize iframe code to a sandboxed HTTPS
    source, and the Accelevents handoff exports official speaker and session import files.
14. **CRM** only if time genuinely remains: directory, notes, tags, segments, kanban, merge. It is
    19 extra-credit points but it is worth less than any remaining required gap.
15. **Evidence pass.** Run the full 20-scenario chain twice against the submission URL, fix what it
    cannot find, and retain the better report with the exact commit and deployment version.

## Submission logistics

- Submit a one-origin application URL with open, fixture-compatible signup and sign-in. The
  evaluator has identities and passwords but no pre-created accounts or inbox, and it uses strict
  same-origin navigation. A landing page that requires creating a disposable demo before signup is
  a real risk of lost evidence.
- The scenarios create their own fixtures (Priya Raman, Marcus Okafor, Sam Whitfield) through the
  UI. The workspace must accept those additions cleanly alongside the seed.
- Repo is already hosted on Forge with a GitHub mirror. Deployment, API, and performance bonuses
  are already satisfied. Keep Airtable optional and out of the evaluator-critical path.
