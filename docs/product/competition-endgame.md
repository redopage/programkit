# Competition endgame

Deadline: **Wednesday 12 August 2026, 10:00 PM PT**.

ProgramKit has moved past feature triage. The required workflows and optional Speaker CRM are
implemented. The endgame is now about trustworthy hosted execution, evaluator discoverability,
manual delivery evidence, and a clean public handoff.

## Submission target

Use `https://app.programkit.dev` as the evaluator origin. It supports fixture-compatible
email/password signup, multiple isolated events, same-origin public routes, and scoped participant,
reviewer, and speaker access. Do not submit the marketing homepage or make the evaluator create a
disposable demo first.

Forge is the primary source host:

```text
https://forge.smol.ai/andheller/programkit
```

GitHub remains a synchronized mirror for Cloudflare's one-click deploy flow.

## Final execution order

### 1. Freeze product state

- Run `pnpm check` on the exact candidate commit.
- Deploy that commit to the app, demo, and site profiles.
- Record the Worker version and both source-host commit URLs.
- Make no unrelated visual changes after the evidence run starts.

### 2. Run the full evaluator chain

- Create a fresh organizer account and the fixture event through the browser.
- Execute the 20 scenarios in file order from `killmysaas-evals/specs`.
- Capture before and after reload evidence for every persisted transition.
- Record any place where the evaluator chooses the wrong route or misses an affordance, then fix
  the product vocabulary or navigation rather than editing state.
- Reset and run the chain a second time.

### 3. Complete manual checks

- Deliver submission confirmation, decision, reviewer reminder, speaker invitation, bulk speaker
  email, CRM outreach, and automatic task reminder to controlled mailboxes.
- Verify merge tags resolved and the calendar attachment imports into Gmail, Outlook, or Apple
  Calendar with the right title, time, and location.
- Download review CSV, logical workspace ZIP, selected-files ZIP, and iCal output and inspect their
  contents.
- Paste the public iframe into another origin and verify all selected filters and detail views.

### 4. Prepare the public repository

- Keep `README.md`, `ROADMAP.md`, `SECURITY.md`, `DEPLOYMENT.md`, and the evaluator maps current.
- Confirm no archives, credentials, browser profiles, private fixtures, or generated evaluator
  reports are tracked.
- Verify the one-click deploy instructions from a clean clone.
- Keep the repository small. Screenshot capture tools and private competition notes stay outside
  this source tree.

### 5. Prepare submission notes

Include:

- the organizer signup route;
- the event switcher and new-event flow;
- route names for Forms, Submissions, Review, Speakers, Tasks, Files, Communications, Agenda, CRM,
  and Integrations;
- how organizer-generated reviewer and speaker links work;
- where delivery history and API keys are visible;
- how to provision a second disposable evaluator account; and
- the exact source commit and deployment version.

## Stop conditions

Do not add another provider, deployment target, database, or agent capability before submission.
Only change code that fixes a broken evaluator journey, data integrity issue, security boundary,
manual-delivery failure, or severe presentation defect.

The project wins by feeling coherent and dependable from CFP through published program, not by
having the longest feature list.
