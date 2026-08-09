# Final clean-checkout QA checklist

Run this only after Claude's accepted view changes and all local checkpoints have been integrated.
Record the commit, environment, command output, and final URLs in the Obsidian competition board.

## Repository and build

- [ ] Fresh checkout of the exact release commit; no copied `node_modules` or local Durable Object state.
- [ ] `pnpm install --frozen-lockfile` completes without changing `pnpm-lock.yaml`.
- [ ] `pnpm check` passes tests, lint, formatting, TypeScript, all package/app builds, and plugin validation.
- [ ] `git status --short` is empty after the check.
- [ ] Repository history and final client bundles contain no credentials, private participant data, or personal paths.

## Golden path

- [ ] Conditional CFP branch, required validation, public submission, confirmation reference, and truthful receipt state.
- [ ] Track/category answer becomes the accepted session track.
- [ ] Committee threshold, idempotent finalist advancement, two scoped finalist scorecards, final acceptance, and session conversion.
- [ ] Participant-owned profile, status, text/form tasks, private upload/download, organizer review, and published resources.
- [ ] Campaign preview, approval, frozen recipients, pending-provider truthfulness, provider failure/retry evidence, and calendar download.
- [ ] Readiness blocker counts agree with speaker detail and portal state.
- [ ] Schedule place/drag, conflict, filter, undo, publish blockers, immutable release, and public agenda.
- [ ] Accelevents latest-release mapping, stable keys, duplicate-stage block, failure/retry, and honest credential boundary.
- [ ] Unsafe HTML rejection, scriptless portal card, public gallery search, and device-local itinerary persistence.

## Boundaries and resilience

- [ ] Public, submitter, reviewer, and participant projections contain no unrelated operator, delivery, draft-schedule, or private-file records.
- [ ] Cross-participant files and cross-reviewer scorecards are rejected.
- [ ] Stale versions, invalid transitions, duplicate commands, and retry paths produce visible, actionable errors.
- [ ] Published agenda and exports remain unchanged when the draft changes.
- [ ] Demo identity and provider limitations remain visible in README, security, and submission copy.

## Interface

- [ ] Principal operator routes at 1440px: hierarchy, next action, loading, empty, validation, failure, retry, and success states.
- [ ] Public CFP, reviewer portal, speaker portal, agenda, gallery, and itinerary at 375×812 with no horizontal page overflow.
- [ ] Keyboard navigation, visible focus, dialog/drawer focus restoration, labels, progress semantics, and 44px mobile actions.
- [ ] No console errors, failed same-origin requests, broken assets, clipped critical copy, or false success language.
- [ ] Final screenshots and walkthrough use the integrated design—not earlier behavior checkpoints.

## Public release — Andrew

- [ ] Valid TLS on the final host; no bypassed warnings.
- [ ] DNS resolves from outside Andrew's local network and Cloudflare dashboard.
- [ ] Final host CSP permits only the intended embed relationship.
- [ ] Public repository is readable signed out and contains the verified release commit.
- [ ] Live health, agenda JSON, calendar, CFP, portal, reviewer, upload, gallery, itinerary, and API smoke tests pass.
- [ ] Submission form contains the final live, repository, and walkthrough URLs and a confirmation receipt is saved.
