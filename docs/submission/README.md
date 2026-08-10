# Competition submission pack

This folder is the working handoff for making ProgramKit judge-ready for the competition deadline:
Wednesday, August 12, 2026 at 10:00 PM Pacific.

It is intentionally evidence-first. A capability is marked ready only when the running product,
core operation, authorization boundary, tests, documentation, and browser proof agree.

## Current status

| Area               | Status                              | Evidence                                                                                                                                                    |
| ------------------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product spine      | Integrated local candidate          | CFP, review, portal, communications, schedule, readiness, integrations, resources, and public embeds are present on the candidate branch                    |
| Multi-round review | Integrated and verified             | Browser flow covers round advancement, two scoped finalist scorecards, acceptance gating, and accepted-session conversion                                   |
| Rules compliance   | Integrated and verified             | `pnpm check` passes 72/72 tests, provider consumers, five agenda views, tested refresh policy, browser QA, and safe retry                                   |
| Design and copy    | Five bounded Claude slices accepted | Codex reviewed every diff, rejected out-of-scope or unclear changes, and reran automated plus responsive browser checks before each local acceptance commit |
| Final integration  | Frozen local candidate              | `codex/programkit-rules-compliance-wave-10`; clean worktree, repository-wide checks, and clean-checkout verification are the release gate                   |
| Submission assets  | Ready for final public links        | [Evidence matrix](evidence-matrix.md), [walkthrough](walkthrough.md), [submission copy](submission-copy.md), and [QA checklist](qa-checklist.md)            |
| Public release     | Deferred to Andrew                  | Sender and Accelevents activation, DNS, TLS/framing policy, repository visibility, deployment, walkthrough hosting, and form submission                     |

No file in this pack authorizes a deploy, repository-visibility change, provider activation, secret
change, or external communication.

The [authoritative source ledger](source-links.md) records the organizer's rules, requirements
walkthrough, and Discord links. The organizer has not yet supplied a submission-form URL in the
rules document; do not infer one.

## Release sequence

1. Freeze the exact accepted candidate commit and rerun [the clean-checkout QA
   checklist](qa-checklist.md) without copied dependencies or local state.
2. Give Andrew [the release handoff](andrew-handoff.md) with that branch and commit.
3. Andrew completes the controlled provider smoke tests, deploys, configures DNS/TLS and the final
   framing policy, and makes the verified repository public.
4. Capture final screenshots and the 8–10 minute walkthrough against that public release.
5. Replace the submission-copy placeholders with the verified public URLs.
6. Submit only after the public repository, deployed site, TLS, and walkthrough links pass from a
   signed-out browser.
