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
- Starting Airtable OAuth creates a random, HTTP-only trial workspace cookie so one demo visitor
  cannot replace another visitor's Airtable connection. This is browser isolation, not team
  identity or cross-device authentication.

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
11. Review cross-workspace isolation, portal authorization, privilege escalation, duplicate
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
