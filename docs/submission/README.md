# Competition submission pack

This folder is the working handoff for making ProgramKit judge-ready for the competition deadline:
Wednesday, August 12, 2026 at 10:00 PM Pacific.

It is intentionally evidence-first. A capability is marked ready only when the running product,
core operation, authorization boundary, tests, documentation, and browser proof agree.

## Current status

| Area               | Status                                 | Evidence                                                                                                                                         |
| ------------------ | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Product spine      | Behavior-complete in local checkpoints | CFP, review, speaker portal, communications, scheduling, readiness, integrations, resources, and public embeds                                   |
| Multi-round review | Verified local checkpoint              | `7cce2e1`; 68/68 tests; full browser flow from round advancement through accepted-session conversion                                             |
| Rules compliance   | Verified local checkpoint              | 72/72 tests; full calendar attachments, provider consumers, five agenda views, near-real-time readiness refresh, and local browser QA            |
| Design and copy    | In progress                            | Claude receives only bounded view-file scopes; Codex reviews and rejects behavioral or architectural changes                                     |
| Integration        | Pending                                | Accepted local checkpoints still need a deliberate local integration pass and clean-checkout verification                                        |
| Submission assets  | Drafted here                           | [Evidence matrix](evidence-matrix.md), [walkthrough](walkthrough.md), [submission copy](submission-copy.md), and [QA checklist](qa-checklist.md) |
| Public release     | Deferred to Andrew                     | DNS, TLS/provider activation, repository visibility, deployment, and public release                                                              |

No file in this pack authorizes a deploy, repository-visibility change, provider activation, secret
change, or external communication.

## Release sequence

1. Finish Claude's bounded design/copy passes and Codex QA.
2. Integrate accepted checkpoints locally without pushing.
3. Run [the clean-checkout QA checklist](qa-checklist.md).
4. Capture final screenshots and the 8–10 minute walkthrough.
5. Freeze the submission copy with the final public URLs.
6. Give Andrew [the release handoff](andrew-handoff.md).
7. Submit only after the public repository, deployed site, TLS, and walkthrough links pass from a
   signed-out browser.
