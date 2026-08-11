# ProgramKit HTTP API

ProgramKit exposes a small integration API from the same Cloudflare Worker that serves the web
application. Reads use conventional event-scoped resources. Writes use named operations so the web
app, API clients, and later agent tools all reach the same validation, authorization, idempotency,
and audit path.

The hosted app resolves its browser actor and event from a verified staff session and account
membership. The local sample and hosted demo still use demo actors. The hosted app also accepts
event-scoped API keys on the documented integration routes. Review [Security](../../SECURITY.md)
before using real participant data.

## Hosted account endpoints

These browser endpoints are available only on the hosted app. Mutations require the same origin.

| Method | Path                            | Purpose                                              |
| ------ | ------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/v1/auth/password`         | Create an account or sign in with email and password |
| `POST` | `/api/v1/auth/magic-link`       | Request a one-time staff sign-in link                |
| `GET`  | `/auth/verify?token=...`        | Exchange the link for a secure session               |
| `POST` | `/api/v1/auth/logout`           | Revoke the current session                           |
| `GET`  | `/api/v1/account`               | Read the signed-in user's accessible events          |
| `POST` | `/api/v1/events`                | Create and select an isolated empty event            |
| `POST` | `/api/v1/account/active-event`  | Select an event from verified membership             |
| `GET`  | `/api/v1/crm/state`             | Read the signed-in organization's contact projection |
| `POST` | `/api/v1/crm/operations/{name}` | Run an organization CRM operation                    |
| `POST` | `/public/v1/access/password`    | Create or restore an event participant account       |
| `GET`  | `/public/v1/access/session`     | Resolve that account's event-scoped destinations     |
| `POST` | `/public/v1/access/logout`      | Revoke the participant session                       |

Password requests include `email`, `password`, and `intent`, where intent is `signup` or `signin`.
Passwords must contain 10 to 128 characters. Passwords are never returned or stored directly.

Participant credentials use the same password policy but a separate per-event session. They never
create a staff membership. After authentication, the Worker matches the normalized account email
to submissions, reviewer records, and accepted-speaker participation records in that event. It
returns only the corresponding record-scoped destinations. The underlying capability remains the
authorization boundary for each projected surface.

Event team access uses these same-origin browser endpoints:

| Method   | Path                                                  | Purpose                                     |
| -------- | ----------------------------------------------------- | ------------------------------------------- |
| `GET`    | `/api/v1/events/{eventId}/team`                       | List current access and pending invitations |
| `POST`   | `/api/v1/events/{eventId}/invitations`                | Email a seven-day, single-use invitation    |
| `DELETE` | `/api/v1/events/{eventId}/invitations/{invitationId}` | Cancel a pending invitation                 |
| `DELETE` | `/api/v1/events/{eventId}/members/{membershipId}`     | Revoke event access                         |
| `GET`    | `/auth/invite?token=...`                              | Accept after account sign-in                |

Owners can manage administrators and viewers. Administrators can manage viewers. Viewers receive
read scopes only. The raw invitation token is emailed and is never returned by a team-list read.

These routes are application session APIs, not the future third-party OAuth API. Token and
tenancy details are in
[Identity, events, and storage ownership](../architecture/identity-and-tenancy.md).

The CRM projection combines only events with the active event's server-owned organization ID.
Contacts are deduplicated by normalized email while participations retain their event IDs. Adding
an existing contact to another event writes that stable person identity and a new participation to
the target event object. It does not merge the underlying event databases or grant event access.

## Resource reads

All operator resource endpoints require the trusted actor to have `workspace:read`.

| Method | Path                                   | Purpose                                                     |
| ------ | -------------------------------------- | ----------------------------------------------------------- |
| `GET`  | `/api/v1/events`                       | List the accessible program events                          |
| `GET`  | `/api/v1/events/{eventId}`             | Read one event                                              |
| `GET`  | `/api/v1/events/{eventId}/sessions`    | List sessions in an event                                   |
| `GET`  | `/api/v1/events/{eventId}/speakers`    | List event-scoped speaker participations with person fields |
| `GET`  | `/api/v1/events/{eventId}/submissions` | List CFP and guaranteed-session submissions                 |

List endpoints accept:

- `page`, starting at `1`;
- `pageSize`, default `25` and maximum `100`;
- `q`, a case-insensitive text search; and
- `status`, an exact resource status filter.

The response shape is consistent:

```json
{
  "data": [],
  "pagination": {
    "currentPage": 1,
    "pageSize": 25,
    "totalPages": 1,
    "totalResults": 8
  }
}
```

Example:

```bash
curl 'http://localhost:4173/api/v1/events/evt_nyc_2026/sessions?status=ready&pageSize=25'
```

These resources are designed for websites, Airtable tools, and narrow integrations. The operator
application currently reads its richer projection from `/api/v1/state`; that endpoint is an
application bootstrap payload, not the preferred public integration contract.

## Named writes

Discover operations and their input policy:

```bash
curl http://localhost:4173/api/v1/manifest
```

Execute one operation:

```bash
curl -X POST http://localhost:4173/api/v1/operations/person.create \
  -H 'content-type: application/json' \
  -d '{
    "input": {
      "firstName": "Grace",
      "lastName": "Hopper",
      "email": "grace@example.com"
    },
    "idempotencyKey": "import-contact-grace-2026-08-08"
  }'
```

The body may include:

```json
{
  "input": {},
  "mode": "execute",
  "idempotencyKey": "one-key-per-logical-command",
  "expectedVersions": {}
}
```

`dry_run` previews without mutation. Agent-capable operations may support `propose`, which creates a
reviewable change set instead of committing the nested operation. The host ignores any caller-
supplied `actor` and supplies identity from trusted request context.

Use `expectedVersions` when updating records fetched earlier. Use an idempotency key whenever a
client may retry a request. A successful write appends one or more domain events and increments the
workspace revision atomically.

## Domain events and export

| Method | Path                             | Purpose                                            |
| ------ | -------------------------------- | -------------------------------------------------- |
| `GET`  | `/api/v1/domain-events?limit=50` | Read the newest accepted domain events             |
| `GET`  | `/api/v1/export`                 | Download a ZIP with the JSON backup and CSV tables |
| `GET`  | `/api/v1/export.json`            | Download the versioned logical workspace document  |
| `GET`  | `/api/v1/health`                 | Check schema and workspace revision                |

Deployment monitoring should use the unauthenticated `GET /api/health` or `GET /healthz` endpoint.
Those routes expose only service readiness. `/api/v1/health` remains event-scoped and requires the
same authenticated workspace or API-key context as the rest of the integration API.

The ZIP contains `workspace.json`, a manifest, a short README, and one UTF-8 CSV for every record
collection. Nested values use dot-separated columns, and the manifest records every table's row
count. The JSON document is the lossless logical backup. CSV files are intended for inspection,
spreadsheets, and migration work.

The domain-event route is an operator feed, not a delivery guarantee. The Airtable persistence
adapter uses stable-ID upserts and cache acknowledgement. Production hardening still needs a
durable partial-write retry journal and webhook cursor so a temporary provider failure cannot lose
accepted work.

## Public and scoped projections

ProgramKit does not return the operator workspace to every client.

| Surface            | Read path                                  |
| ------------------ | ------------------------------------------ |
| Public program     | `/public/v1/program/state`                 |
| Public agenda data | `/public/agenda.json`                      |
| Public JSON feed   | `/public/v1/program.json`                  |
| Public XML feed    | `/public/v1/program.xml`                   |
| Public iCal feed   | `/public/v1/program.ics`                   |
| Public CFP         | `/public/v1/submission-forms/{slug}/state` |
| Reviewer workspace | `/public/v1/reviewers/{reviewerId}/state`  |
| Speaker portal     | `/api/v1/portal/{participationId}/state`   |

Each scoped surface has an ownership check and, where writes are allowed, a narrow operation
allowlist. Public program data comes only from the latest immutable schedule release.

On `app.programkit.dev`, organizers share same-origin agenda, submission, and reviewer links. A
reviewer link has the form `/reviewer/{reviewerId}/{accessKey}?event={eventId}`. Its projection API
requires the same capability in the `x-programkit-reviewer-key` header and exposes only that
reviewer's queue and scorecard operations. The Worker verifies the event and sets an HTTP-only
event-routing cookie for the public projection requests made by that page. This cookie cannot call
operator endpoints or select another event. Local and disposable demo workspaces omit the event
query because their workspace is already scoped by the host.

The JSON, XML, and iCal feeds accept `event`, `track`, `room`, and `descriptions=hide` query
parameters. They use the same published-program selector as the interactive views, allow
cross-origin `GET` requests, and cache for one minute. JSON and XML are data feeds for websites and
integrations. iCal returns a downloadable event calendar with one entry per matching published
session.

## External API key contract

Owners and administrators create event-scoped API keys under **Infrastructure & API**. The
management surface supports list, create, copy-once, and immediate revocation:

- an organizer creates a named, event-scoped key and chooses explicit read or write scopes;
- the secret is shown once, only a hash is stored, and a non-secret prefix identifies the key;
- keys may expire, are independently revocable, and record their last successful use;
- clients send `Authorization: Bearer pk_live_...` over HTTPS;
- the host resolves the key to a server-owned event, actor, and scopes before core code runs; and
- requests use the same named operations, validation, authorization, idempotency rules, and audit
  events as the web application.

The **Agent operations** preset grants the bundled plugin's least-privilege scope set. It can read
people, participation, requirements, schedules, and change proposals; draft communications; and
propose schedule moves. It cannot approve, commit, send, publish, manage files, or administer the
event.

API keys can access these routes:

```text
GET  /api/v1/health
GET  /api/v1/manifest
GET  /api/v1/domain-events
GET  /api/v1/events
GET  /api/v1/events/{eventId}
GET  /api/v1/events/{eventId}/sessions
GET  /api/v1/events/{eventId}/speakers
GET  /api/v1/events/{eventId}/submissions
GET  /api/v1/export
GET  /api/v1/export.json
POST /api/v1/operations/{operationName}
POST /mcp
```

The event ID encoded in the non-secret portion of the key selects exactly one event Durable
Object. A valid key cannot call account, team, file, Airtable, or key-management routes. MCP tools
also check the key's scopes before reading or proposing work. Core authorization then checks the
same scopes before applying an operation.

```bash
curl https://app.programkit.dev/api/v1/events \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY"
```

OAuth remains a later addition for integrations that need delegated installation across many
ProgramKit accounts.

## Production API milestones

The next API work is intentionally practical:

1. Signed webhooks with endpoint subscriptions, retry history, replay, and secret rotation.
2. Bulk import operations capped at a documented batch size with per-item results.
3. Direct-to-R2 upload initiation and finalize endpoints with type, size, ownership, and scanning
   checks.
4. OpenAPI output generated from the same schemas used to validate named operations.
5. Delegated OAuth for third-party apps that install across many ProgramKit events.

Do not add a second write implementation for REST-shaped routes. A resource-style convenience
endpoint may translate into a named operation, but the core operation remains the source of truth.
