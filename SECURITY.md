# Security

## Current release

ProgramKit contains production-shaped domain controls and working password and passwordless staff
sessions for the hosted app. It has event-scoped participant password accounts, team invitations,
live role enforcement, event-scoped API keys, and record-scoped reviewer and speaker capabilities.
It does not yet have account recovery, ownership transfer, optional MFA or OIDC, delegated MCP
OAuth, short-lived invitation exchange for every reviewer and speaker link, or a
production-complete file security and retention program. Private R2 uploads, authorized downloads,
and owner-initiated deletion are implemented; malware scanning, automatic retention and
offboarding, orphan cleanup, and storage observability are not.

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
- A separate Event Access Durable Object is authoritative for each event's owners, administrators,
  viewers, pending invitations, and revocations.
- Invitation secrets are random 256-bit values stored only as SHA-256 hashes. They are bound to one
  normalized email, expire after seven days, and work once.
- Every hosted workspace request checks the live event membership and derives scopes from its role.
  The account event list is a repairable switcher projection, not an authorization boundary.
- Caller-supplied actor headers and body actors never become the trusted staff actor.
- Logout revokes the stored session and clears its cookies.
- Authenticated password changes require the current password when one exists, rotate the salted
  derivation, revoke other sessions, and invalidate pending magic links. Passwordless accounts can
  set their first password only from an authenticated session.
- Account security returns opaque session IDs plus creation and expiry times. It never returns a
  token or token hash, does not allow the session-management endpoint to revoke the current browser,
  and requires same-origin requests for every revocation.
- Password throttling counts failed attempts only. A successful sign-in clears that email's
  failure history, while the IP failure history remains intact so one valid account cannot reset
  abuse protection for an entire address.
- Browser documents use HSTS on HTTPS, MIME-sniffing protection, a strict-origin referrer policy,
  and a restrictive permissions policy. Private app documents also deny framing. Public event
  documents intentionally omit the frame restriction so agenda widgets remain embeddable.
- Event-scoped API keys use random 256-bit secrets that are displayed once and stored only as
  SHA-256 hashes. The host checks the encoded event and key identifiers, expiry, revocation, and a
  constant-time hash comparison before deriving scopes. API-key requests are restricted to an
  explicit REST and MCP route allowlist and cannot administer accounts, keys, Airtable, or files.

The default password limits are 10 failures per normalized email and 40 failures per IP hash in
one hour. Self-hosters can tune them with
`PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL` and
`PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP`. Invalid or out-of-range values fall back to the safe
defaults. Successful sign-ins never consume either allowance. Magic-link request limits are
separate and unchanged. An account-already-exists response during signup is not a password failure
and does not consume the sign-in allowance.

The hosted app gives participants a separate event-scoped password and session namespace. That
session can recover only matching submission, reviewer, and speaker destinations, and each
projected read still checks its record-scoped capability. MCP uses either an authorized staff
session or an event-scoped API key. Public CFP and agenda documents may be opened through an
event-specific link. The Worker validates the event ID before setting an HTTP-only routing cookie,
and that cookie reaches only public projections and public submission operations. It is not staff
authentication and cannot access operator APIs.

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

These demo shortcuts are acceptable only for deterministic sample data. The generated self-host
uses the hosted account, event membership, participant account, API key, and record-capability
boundaries instead of the demo actor shortcuts.

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
- Event-rooted private R2 object keys, authorized download mediation, and owner-only file deletion
  that retains an audit tombstone, retries byte cleanup, and records durable purge confirmation
- Hosted staff magic-link enumeration resistance, one-time tokens, hashed secrets, account resend
  limits, canonical callbacks, revocable sessions, email-bound team invitations, immediate event
  revocation, and verified event selection

These controls authenticate hosted staff and event-scoped participant accounts, but a recovered
reviewer or speaker destination still relies on its record-scoped capability. They do not provide
delegated MCP OAuth, scan a file, complete provider bounce/complaint handling, or establish
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

1. Add account recovery, ownership transfer, and an MFA or external OIDC policy where deployment
   risk requires it. Add a complete leave-event flow before users can remove their own access.
2. Complete the reviewer and speaker invitation lifecycle with short-lived, one-time exchange,
   rotation, and revocation appropriate to the deployment. Event-scoped participant accounts are
   implemented, but the recovered destination still uses a record-scoped capability.
3. Add OAuth before offering delegated third-party MCP installation across many customer accounts.
   The current event-scoped API keys are suitable only for owner-managed clients: use one
   short-lived key per client, least-privilege scopes, HTTPS, rotation, and immediate revocation
   when exposed.
4. Define the assurance required for submitters, reviewers, and speakers and test the existing
   event-scoped participant session against it. Add explicit CSRF tokens if cookie or cross-site
   requirements change.
5. Complete the existing transactional email outbox with provider-level idempotency across crash
   windows, bounce and complaint ingestion, recipient self-service unsubscribe, and dead-letter
   operations. Add signed webhook subscriptions with retry and replay protection; product webhooks
   are not delivered yet.
6. Store provider secrets in a managed secret service, never in workspace state, source control,
   browser bundles, or logs.
7. Put uploaded files through a provider-backed malware scan or quarantine-before-availability
   path. Add orphan cleanup, storage usage alerts, automatic retention and workspace-offboarding
   cleanup, and any deployment-specific short-lived download URL policy. The current private R2
   path already enforces event ownership, content-type and size limits, mediated downloads, and
   explicit owner deletion; those checks are not malware scanning.
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
