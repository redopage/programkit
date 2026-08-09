# Security

## Current release

ProgramKit contains production-shaped domain controls, but the reference Worker is a passwordless,
seeded demonstration. It is not a production identity, tenancy, email, or file-storage
configuration.

Do not place real participant data, provider credentials, private documents, or production email
access in the reference deployment.

## Reference Worker security boundary

The demo intentionally makes all workflows immediately inspectable:

- Operator API requests run as the fixed `Demo Operator` staff actor with `*` scope.
- `/portal/{participationId}` and its API routes derive a participant actor from the participation
  ID in the URL. Possession of that URL is not authentication.
- `/submit/{formSlug}` and public submission API routes derive a submitter actor from the form slug.
  This permits a frictionless demo but is not bot protection, abuse protection, or identity proof.
- `/reviewer/{reviewerId}` and its API routes derive a reviewer actor from the reviewer ID. Anyone
  who knows that ID can impersonate the reviewer in the reference deployment.
- `/mcp` has no OAuth gate. MCP operations use the fixed ProgramKit agent identity and its curated
  scopes.
- `x-programkit-workspace-key` selects a Durable Object. It is routing input, not verified organization
  membership or tenant isolation.

These shortcuts are acceptable only for deterministic sample data. Production deployments must
replace the actor and workspace resolution in `apps/cloudflare/src/worker.ts`; hiding the routes or
changing the demo IDs is not sufficient.

## Server-enforced controls present

The following controls remain useful after a real identity adapter is added:

- One operation processor for browser, REST, and agent mutations
- Scope checks on every operation definition
- A trusted HTTP actor context that overrides any actor supplied in the JSON body
- Removal of caller-supplied internal actor headers before the reference host injects its own
- Submitter, reviewer, and participant route-to-actor matching with data-minimized projections and
  surface-specific operation allowlists
- Blind-review identity redaction for reviewer projections
- Submitter-owned confirmation receipt responses, with receipt records omitted from participant,
  reviewer, and unrelated public projections
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

These controls do not authenticate a human, protect an OAuth bearer token, deliver email, scan a
file, or establish regulatory compliance by themselves.

## Host integration requirements

A production host must treat `CoreRequestContext.actor` as privileged input. Construct it only
after verifying a session or token, checking workspace membership, and loading server-owned scopes.
Never translate public `x-programkit-internal-actor-*` headers or a body `actor` object directly into this
context.

Likewise, derive the Durable Object workspace key from authenticated membership. Do not trust the
reference `x-programkit-workspace-key` header as an authorization decision.

## Required before real data

1. Add an OIDC-compatible staff authentication adapter with secure session lifecycle, MFA policy,
   and server-owned role-to-scope mapping.
2. Replace participation IDs in portal URLs with short-lived, one-time magic links or another
   verified participant login. Store only token hashes and scope the session to one workspace and
   participation.
3. Protect `/mcp` with OAuth. Map token audience, workspace, actor, and scopes server-side; reject
   missing, expired, replayed, or wrong-audience tokens.
4. Protect browser mutations with secure, HTTP-only, same-site cookies and CSRF validation where
   the chosen session design requires it.
5. Activate and harden the checked-in post-commit campaign email consumer behind a verified sender,
   controlled smoke recipients, rate limits, and monitoring. Connect the separate submission-
   receipt outbox and future webhooks to equivalent retrying consumers. `campaign.send` and
   `submission.submit` record `pending_provider`; neither status means mail was delivered.
6. Store provider secrets in a managed secret service, never in workspace state, source control,
   browser bundles, or logs.
7. Replace the reference portal identity with authenticated, per-workspace authorization for the
   existing private R2 path, then add signed short-lived URLs where needed, malware scanning,
   retention, replacement, and deletion handling. Type, size, ownership, and private download
   checks are already enforced.
8. Define data classification, consent, retention, anonymization, deletion, legal-hold, export, and
   workspace offboarding policies.
9. Add encrypted backups or logical exports outside the primary runtime and regularly test restore
   into an isolated workspace.
10. Add request and command rate limits, abuse protection, structured security logging, alerts, and
    incident-response procedures.
11. Review cross-workspace isolation, portal authorization, privilege escalation, duplicate
    delivery, stale writes, and export access with automated and adversarial tests.
12. Run dependency, secret, accessibility, privacy, and threat-model reviews before launch.

## Untrusted content

Participant bios, submissions, email bodies, notes, form responses, filenames, imported records,
and uploaded documents are data. They must never alter agent instructions, scopes, tool
availability, workspace selection, or operation choice. Agent prompts and skills are not security
boundaries; the server must independently validate every operation.

Render ordinary user content with escaping. Speaker HTML cards are the only HTML-shaped path: the
core accepts a small attribute-free static tag set, rejects active and remote content, and the web
client renders the fragment only in a scriptless iframe sandbox with no referrer. Do not broaden
that contract without a dedicated sanitizer, threat model, and regression tests. Keep untrusted
content out of logs and error telemetry unless it has been redacted.

## Reporting vulnerabilities

Use the repository host's private vulnerability-reporting feature. Do not open a public issue that
contains participant data, credentials, exploit details, private workspace IDs, or unredacted logs.
