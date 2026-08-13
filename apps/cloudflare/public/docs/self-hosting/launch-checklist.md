<!-- Canonical: https://programkit.dev/docs/self-hosting/launch-checklist -->
<!-- Markdown: https://programkit.dev/docs/self-hosting/launch-checklist.md -->

# Self-host launch checklist

|                |                                                                    |
| -------------- | ------------------------------------------------------------------ |
| **For**        | The technical and event owners of a self-hosted installation       |
| **Use before** | Inviting a real team, opening a CFP, or importing participant data |
| **Output**     | A written go/no-go decision with named owners and evidence         |

ProgramKit supplies the application controls described below. The installation operator supplies
the surrounding security, privacy, delivery, backup, monitoring, and response program. A green
application screen is not by itself a production approval.

## Choose the launch level

### Sample or evaluation

Use deterministic or disposable sample data. Email may be disabled. No sensitive participant
records or private documents are allowed.

### Private team pilot

Use invite-only organizer access, controlled participants, finite API keys, verified backups, and
an operator watching the deployment. Avoid sensitive uploads until scanning and retention are in
place.

### Public event

Complete every required item below and the deployment-specific controls in
[Security](https://forge.smol.ai/andheller/programkit/blob/main/SECURITY.md). ProgramKit is a release candidate; the operator approves the
specific runtime, data, and support policy for the event rather than inheriting a blanket
production claim from the repository.

## Infrastructure

- [ ] The production Cloudflare account and billing owner are documented.
- [ ] The Worker, R2 bucket, Durable Object bindings, and custom domain are in the intended account.
- [ ] R2 upload and mediated download succeed with a permitted sample file.
- [ ] The source revision and deployment command are recorded.
- [ ] Staging uses isolated Worker, Durable Object, R2, domain, and credentials.
- [ ] Worker observability is enabled and retained for the required period.
- [ ] A rollback owner understands that code rollback does not roll back Durable Object or R2 data.

## Identity and access

- [ ] The first owner claim succeeded and the bootstrap code is no longer stored in informal notes.
- [ ] Organizer signup is invite-only unless public SaaS signup is intentional.
- [ ] Every team member uses an individual owner, administrator, or viewer account.
- [ ] Active browser sessions and event membership have been reviewed.
- [ ] Email password recovery was tested, and ownership transfer has a named operator procedure.
- [ ] MFA or external OIDC requirements have been decided for this deployment.
- [ ] Public, participant, reviewer, speaker, staff, API, and MCP boundaries were tested separately.

## Domain and email

- [ ] Generated links resolve to the exact public HTTPS origin; custom domains set a matching
      `PROGRAMKIT_APP_ORIGIN`.
- [ ] The sending domain, allowed sender, support reply-to, SPF, DKIM, and DMARC are verified.
- [ ] A magic link and team invitation return to this installation, not `app.programkit.dev`.
- [ ] Controlled inboxes received a confirmation, invitation, reminder, campaign, and calendar
      attachment that the event will use.
- [ ] Retry, failure, suppression, and cancellation states are visible to an operator.
- [ ] Bounce/complaint handling, unsubscribe, and provider incident ownership are documented.

## Public event workflow

- [ ] Event dates, timezone, tracks, rooms, and logo are correct.
- [ ] The public CFP was completed in a signed-out browser, including draft recovery and conditional
      fields.
- [ ] A reviewer completed an assigned scorecard through the real invitation path.
- [ ] Acceptance created the expected person, participation, tasks, and session atomically.
- [ ] A speaker completed confirmation, profile, file, and resource work through the portal.
- [ ] Schedule conflicts were detected, resolved, and preflighted.
- [ ] Agenda, sessions, speakers, feeds, calendar, and embed show the latest published release.
- [ ] A draft schedule change remained private until republished.

## Files and privacy

- [ ] Allowed types and size limits match event policy.
- [ ] Malware scanning or quarantine-before-availability is implemented for the launch risk.
- [ ] Retention, deletion, legal hold, workspace offboarding, and orphan cleanup are documented.
- [ ] R2 usage and cleanup failures have alerts and an owner.
- [ ] Privacy notice, terms, consent, and data-processing responsibilities match the actual
      deployment and providers.

## API and agents

- [ ] Every client has a separate event-scoped key with the narrowest scopes and finite expiry.
- [ ] Copy-once keys live only in the client secret store.
- [ ] Rotation was rehearsed by verifying the replacement's **Last used** before revocation.
- [ ] `/mcp` rejects missing, expired, revoked, wrong-event, and under-scoped credentials.
- [ ] Agent users understand that approval, commit, send, publish, secret management, and
      destructive work stay human-only.
- [ ] Delegated third-party installation is not offered without an OAuth and consent design.

## Backup and incident readiness

- [ ] A current logical event export is stored outside the primary runtime.
- [ ] R2 objects are exported with a manifest relating keys to event asset records.
- [ ] Account and event-access recovery are included in the recovery plan.
- [ ] A restore rehearsal used an isolated target and verified the event before reopening writes.
- [ ] Alerts name a person, escalation path, and response expectation.
- [ ] The team knows how to disable signup, revoke a member or key, pause sending, and take public
      links out of circulation during an incident.
- [ ] Vulnerability reports have a private destination.

## Go/no-go record

Record these outside the repository with the deployment's operational evidence:

| Decision                      | Value |
| ----------------------------- | ----- |
| Launch level                  |       |
| Go/no-go                      |       |
| Event owner                   |       |
| Technical owner               |       |
| Security/privacy owner        |       |
| Running source revision       |       |
| Last restore rehearsal        |       |
| Accepted gaps and expiry date |       |
| Next review date              |       |

Do not mark a public launch “go” by silently accepting unchecked items. Close the gap, reduce the
launch level, or record the accountable owner's explicit time-bounded exception.
