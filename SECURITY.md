# Security

## Current release

ProgramKit contains production-shaped domain controls and a working passwordless staff session for
the hosted app. It does not yet have production-complete team membership, participant and reviewer
identity, MCP OAuth, public event links, or file storage.

Do not place real participant data, provider credentials, private documents, or production email
access in the reference deployment.

## Deployment security boundaries

`app.programkit.dev` now enforces these hosted staff controls:

- A normalized email selects an account-sharded Auth Durable Object.
- Magic-link and session secrets are random 256-bit values stored only as SHA-256 hashes.
- Magic links expire after 15 minutes, work once, and use the configured canonical callback origin.
- Sessions expire after 30 days and use HTTP-only, secure, same-site cookies in production.
- Event creation and selection come from server-owned account membership. Each event maps to a
  separate Workspace Durable Object.
- Caller-supplied actor headers and body actors never become the trusted staff actor.
- Logout revokes the stored session and clears its cookies.

The hosted app currently keeps participant, reviewer, CFP, public agenda, MCP, and file workflows
behind the staff session. Do not treat that temporary restriction as their final authorization
model.

The anonymous demo intentionally makes all sample workflows immediately inspectable:

- Operator API requests run as the fixed `Demo Operator` staff actor with `*` scope.
- `/portal/{participationId}` and its API routes derive a participant actor from the participation
  ID in the URL. Possession of that URL is not authentication.
- `/submit/{formSlug}` and public submission API routes derive a submitter actor from the form slug.
  This permits a frictionless demo but is not bot protection, abuse protection, or identity proof.
- `/reviewer/{reviewerId}` and its API routes derive a reviewer actor from the reviewer ID. Anyone
  who knows that ID can impersonate the reviewer in the reference deployment.
- `/mcp` has no OAuth gate. MCP operations use the fixed ProgramKit agent identity and its curated
  scopes.
- `/demo/{capability}` selects an isolated seven-day Durable Object and exchanges the capability
  for an HTTP-only cookie. Possession of the link grants demo access; it is not a user account.
- `x-programkit-workspace-key` selects only non-capability local and self-hosted sample workspaces.
  The hosted app does not use it for membership or tenant selection.
- Starting Airtable OAuth inside a capability demo keeps the connection in that isolated workspace.
  Other reference workspaces still receive a random HTTP-only trial cookie. This is browser
  isolation, not team identity or cross-device authentication.

These demo shortcuts are acceptable only for deterministic sample data. A self-hosted deployment
must either configure equivalent hosted identity or retain the same sample-data-only boundary.

## Server-enforced controls present

The following controls remain useful after a real identity adapter is added:

- One operation processor for browser, REST, and agent mutations
- Scope checks on every operation definition
- A trusted HTTP actor context that overrides any actor supplied in the JSON body
- Removal of caller-supplied internal actor headers before the reference host injects its own
- Submitter, reviewer, and participant route-to-actor matching with data-minimized projections and
  surface-specific operation allowlists
- Blind-review identity redaction for reviewer projections
- A public-program projection backed only by an immutable published release
- Participant transition rules limited to self-service confirmation, withdrawal, profile updates,
  and eligible requirement submission
- Agent policies that deny sending, publishing, approval, secret management, and destructive work
- Proposal-only enforcement for agent schedule changes
- Nested change-set validation when a proposal is created and again when it is committed
- Optimistic entity versions and stale-write rejection
- Idempotency keys bound to operation, actor, and request fingerprint
- Explicit campaign draft, approval, and send states
- Immutable published schedule releases; the public agenda does not expose draft placements
- Append-only domain events for accepted mutations
- Current MCP protocol metadata and routing-header validation
- Incrementally enforced 128 KB JSON request limits on the REST operation surface
- Atomic repository mutation and transactional Durable Object storage writes
- Airtable OAuth state expiry, PKCE, server-only rotating tokens, same-origin connection mutations,
  per-trial-workspace connection isolation, signed inbound webhooks, and best-effort webhook
  deletion on disconnect
- Hosted staff magic-link enumeration resistance, one-time tokens, hashed secrets, account resend
  limits, canonical callbacks, revocable sessions, and verified event selection

These controls authenticate the hosted staff account but do not authenticate a participant or
reviewer, protect an MCP OAuth bearer token, deliver product campaigns, scan a file, or establish
regulatory compliance by themselves.

## Host integration requirements

A production host must treat `CoreRequestContext.actor` as privileged input. Construct it only
after verifying a session or token, checking workspace membership, and loading server-owned scopes.
Never translate public `x-programkit-internal-actor-*` headers or a body `actor` object directly into this
context.

Likewise, derive the Durable Object workspace key from authenticated membership. The hosted app
does this for staff events. Do not trust the reference `x-programkit-workspace-key` header as an
authorization decision in another deployment.

## Required before real data

1. Add team invitation, membership revocation, administrator roles, server-owned role-to-scope
   mapping, account recovery, and an MFA or external OIDC policy where deployment risk requires it.
2. Replace participation and reviewer IDs in portal URLs with short-lived, one-time magic links or another
   verified participant login. Store only token hashes and scope the session to one workspace and
   participation.
3. Protect `/mcp` with OAuth. Map token audience, workspace, actor, and scopes server-side; reject
   missing, expired, replayed, or wrong-audience tokens.
4. Extend the hosted staff cookie and same-origin boundary to the final participant, reviewer, and
   public-link surfaces. Add explicit CSRF tokens if cookie or cross-site requirements change.
5. Supply a transactional outbox and idempotent workers for outbound email and webhooks. The demo's
   `campaign.send` only records a `demo-outbox` transition; it does not deliver mail.
6. Store provider secrets in a managed secret service, never in workspace state, source control,
   browser bundles, or logs.
7. Add private object storage with per-workspace authorization, signed short-lived download URLs,
   content-type and size limits, malware scanning, and deletion handling. The demo has no file
   storage implementation.
8. Define data classification, consent, retention, anonymization, deletion, legal-hold, export, and
   workspace offboarding policies.
9. Add encrypted backups or logical exports outside the primary runtime and regularly test restore
   into an isolated workspace.
10. Add request and command rate limits, abuse protection, structured security logging, alerts, and
    incident-response procedures.
11. Review cross-event and cross-account isolation, portal authorization, privilege escalation, duplicate
    delivery, stale writes, and export access with automated and adversarial tests.
12. Run dependency, secret, accessibility, privacy, and threat-model reviews before launch.

## Untrusted content

Participant bios, submissions, email bodies, notes, form responses, filenames, imported records,
and uploaded documents are data. They must never alter agent instructions, scopes, tool
availability, workspace selection, or operation choice. Agent prompts and skills are not security
boundaries; the server must independently validate every operation.

Render user content with escaping, sanitize any future rich-text or HTML path, and keep untrusted
content out of logs and error telemetry unless it has been redacted.

## Reporting vulnerabilities

Use the repository host's private vulnerability-reporting feature. Do not open a public issue that
contains participant data, credentials, exploit details, private workspace IDs, or unredacted logs.
