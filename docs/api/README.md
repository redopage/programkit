# ProgramKit HTTP API

ProgramKit exposes a small integration API from the same Cloudflare Worker that serves the web
application. Reads use conventional event-scoped resources. Writes use named operations so the web
app, API clients, and later agent tools all reach the same validation, authorization, idempotency,
and audit path.

The reference Worker uses demo actors and is not safe for real participant data. Production API
tokens, workspace membership, and scopes are still required; see [Security](../../SECURITY.md).

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

These resources are designed for websites, Airtable mirrors, and narrow integrations. The operator
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

`campaign.send` is intentionally named for the human intent but records a durable delivery outbox:
it moves an approved campaign to `queued`, creates per-recipient `pending_provider` rows, and does
not contact a provider. A trusted consumer records `delivered` or `failed` through
`campaign.record-delivery`; only terminal recipient outcomes can move the campaign to `sent`.

`submission.submit` commits the proposal, assignments, and one frozen confirmation-receipt row in
the same workspace mutation. Its public response contains only that receipt's address, content,
reference, and truthful delivery state. `pending_provider` means prepared in the outbox, not sent.
A trusted consumer records `delivered` or `failed` through
`submission.record-receipt-delivery`.

Schedule drafting uses `schedule.place-session`, `schedule.move-session`, and
`schedule.unplace-session`. Each accepted change is event-scoped, version-checked, audited, and
kept out of the public program until `schedule.publish` creates the next immutable release.
Publication also enforces the shared preflight: every active session is placed, no hard conflicts
or duplicate placements remain, and the draft differs from the latest release.

One-way program export uses `accelevents.prepare-export` to freeze the latest immutable schedule
release into speaker and session outbox items. A trusted consumer records each provider outcome with
`accelevents.record-result`. Failed items remain retryable; delivered items are terminal. The core
stores no API key and staging a packet does not claim external delivery. See the
[Accelevents integration guide](../integrations/accelevents.md).

Speaker resource editing uses `portal-resource.save`. The operation is staff-scoped, versioned,
and idempotent. It rejects active or remote HTML content before a static card can be published. The
speaker projection includes only published resources for that participation's event; public and
reviewer projections receive none. See [Portal resources and public embeds](../product/portal-resources.md).

## Domain events and export

| Method | Path                             | Purpose                                           |
| ------ | -------------------------------- | ------------------------------------------------- |
| `GET`  | `/api/v1/domain-events?limit=50` | Read the newest accepted domain events            |
| `GET`  | `/api/v1/export`                 | Download the versioned logical workspace document |
| `GET`  | `/api/v1/health`                 | Check schema and workspace revision               |

The active event also exposes a public, standards-based calendar download:

```text
GET /public/v1/events/{eventId}/calendar.ics
```

The response is `text/calendar` with a safe attachment filename and RFC 5545 line folding.

The domain-event route is an operator feed, not a delivery guarantee. Production webhooks and the
Airtable mirror will use a transactional outbox with independent attempt and cursor records so a
temporary provider failure cannot lose accepted work.

## Public and scoped projections

ProgramKit does not return the operator workspace to every client.

| Surface            | Read path                                  |
| ------------------ | ------------------------------------------ |
| Public program     | `/public/v1/program/state`                 |
| Public agenda data | `/public/agenda.json`                      |
| Public CFP         | `/public/v1/submission-forms/{slug}/state` |
| Reviewer workspace | `/api/v1/reviewers/{reviewerId}/state`     |
| Speaker portal     | `/api/v1/portal/{participationId}/state`   |

Each scoped surface has an ownership check and, where writes are allowed, a narrow operation
allowlist. Public program data comes only from the latest immutable schedule release.

The `/embed/speakers` and `/embed/itinerary` web routes consume the public-program path above. They
do not introduce broader API projections or write operations.

## Production API milestones

The next API work is intentionally practical:

1. API-token and OAuth identity with event-scoped read and write scopes.
2. Signed webhooks with endpoint subscriptions, retry history, replay, and secret rotation.
3. Bulk import operations capped at a documented batch size with per-item results.
4. Direct-to-R2 upload initiation and finalize endpoints with type, size, ownership, and scanning
   checks.
5. OpenAPI output generated from the same schemas used to validate named operations.

Do not add a second write implementation for REST-shaped routes. A resource-style convenience
endpoint may translate into a named operation, but the core operation remains the source of truth.
