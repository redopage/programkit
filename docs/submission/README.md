# Competition submission pack

This folder is the working handoff for making ProgramKit judge-ready for the competition deadline:
Wednesday, August 12, 2026 at 10:00 PM Pacific.

It is intentionally evidence-first. A capability is marked ready only when the running product,
core operation, authorization boundary, tests, documentation, and browser proof agree.

## Current status

| Area               | Status                     | Evidence                                                                                                                                          |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product spine      | Integrated local candidate | `ab2b6cc`; CFP, review, portal, communications, schedule, readiness, integrations, resources, and public embeds in one linear branch              |
| Multi-round review | Integrated and verified    | `7cce2e1`; full browser flow from round advancement through accepted-session conversion                                                           |
| Rules compliance   | Integrated and verified    | `ab2b6cc`; exact `pnpm check` with 72/72 tests, provider consumers, five agenda views, tested refresh policy, 20-route browser QA, and safe retry |
| Design and copy    | In progress                | Claude receives only bounded view-file scopes on the integrated candidate; Codex rejects behavioral or architectural changes                      |
| Final integration  | Pending design acceptance  | Fast-forward local `main` only after the bounded Claude slices pass diff, automated, and browser QA                                               |
| Submission assets  | Drafted here               | [Evidence matrix](evidence-matrix.md), [walkthrough](walkthrough.md), [submission copy](submission-copy.md), and [QA checklist](qa-checklist.md)  |
| Public release     | Deferred to Andrew         | DNS, TLS/provider activation, repository visibility, deployment, and public release                                                               |

No file in this pack authorizes a deploy, repository-visibility change, provider activation, secret
change, or external communication.

## Release sequence

1. Finish Claude's bounded design/copy passes on the integrated candidate and complete Codex QA.
2. Fast-forward local `main` to the accepted candidate without pushing.
3. Run [the clean-checkout QA checklist](qa-checklist.md).
4. Capture final screenshots and the 8–10 minute walkthrough.
5. Freeze the submission copy with the final public URLs.
6. Give Andrew [the release handoff](andrew-handoff.md).
7. Submit only after the public repository, deployed site, TLS, and walkthrough links pass from a
   signed-out browser.
