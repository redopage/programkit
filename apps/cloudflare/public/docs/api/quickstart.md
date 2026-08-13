<!-- Canonical: https://programkit.dev/docs/api/quickstart -->
<!-- Markdown: https://programkit.dev/docs/api/quickstart.md -->

# HTTP API quickstart

|                    |                                                        |
| ------------------ | ------------------------------------------------------ |
| **For**            | Operators and developers connecting one trusted client |
| **Starting point** | A running ProgramKit installation and an event         |
| **Outcome**        | An authenticated read and a safely previewed write     |
| **Allow**          | 10–15 minutes                                          |

ProgramKit serves the HTTP API from the same origin as the application. An API key is scoped to
one event, so a client does not select a tenant with a request parameter or an untrusted header.

## 1. Create a client-specific key

Sign in as an owner or administrator, open **Data & connections**, and create a key. Start with
read-only scopes unless the integration must write. Use one key per client, set a finite expiry,
and copy the secret when it is shown; ProgramKit stores only its hash.

Keep the origin and secret in the client's secret store. For a local shell:

```bash
export PROGRAMKIT_ORIGIN="https://events.example.com"
export PROGRAMKIT_API_KEY="pk_live_replace_me"
```

Do not put the key in a URL, repository, plugin archive, screenshot, or support message.

## 2. Confirm the connection

```bash
curl --fail --silent --show-error \
  "$PROGRAMKIT_ORIGIN/api/v1/health" \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY"
```

This event-scoped health route verifies the key, its event, and the workspace. Deployment monitors
that should not hold a key use `/api/health` or `/healthz` instead.

## 3. Read the event and its resources

```bash
curl --fail --silent --show-error \
  "$PROGRAMKIT_ORIGIN/api/v1/events" \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY"
```

Copy the returned event ID, then request a page of sessions:

```bash
export PROGRAMKIT_EVENT_ID="evt_replace_me"

curl --fail --silent --show-error \
  "$PROGRAMKIT_ORIGIN/api/v1/events/$PROGRAMKIT_EVENT_ID/sessions?pageSize=25" \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY"
```

The same resource shape is available for `speakers` and `submissions`. List routes support `page`,
`pageSize`, `q`, and `status`; a response contains `data` and `pagination`.

## 4. Discover a write before calling it

Named operations are the write contract. Inspect the manifest before building a request:

```bash
curl --fail --silent --show-error \
  "$PROGRAMKIT_ORIGIN/api/v1/manifest" \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY"
```

The manifest describes required inputs, scopes, risk, dry-run support, reversibility, and agent
policy. The generated [OpenAPI document](/docs/api/openapi.json) exposes the API-key-grantable subset in a
form that API clients and code generators can consume.

## 5. Preview, then execute

This example requires a key with the operation's people-write scope. Use a unique idempotency key
for the logical command, not for each network attempt:

```bash
curl --fail --silent --show-error \
  -X POST "$PROGRAMKIT_ORIGIN/api/v1/operations/person.create" \
  -H "Authorization: Bearer $PROGRAMKIT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "input": {
      "firstName": "Grace",
      "lastName": "Hopper",
      "email": "grace@example.com"
    },
    "mode": "dry_run",
    "idempotencyKey": "contact-grace-hopper-2026-08"
  }'
```

If the preview is correct, send the same logical request with `"mode": "execute"`. Preserve the
same idempotency key when retrying an uncertain response. For updates, pass the versions returned
by the earlier read in `expectedVersions`; a stale write fails instead of silently overwriting a
newer change.

## 6. Handle failures deliberately

| Response class | First check                                                               |
| -------------- | ------------------------------------------------------------------------- |
| `400`          | Input names, required fields, mode, and JSON encoding                     |
| `401`          | Missing, malformed, expired, or revoked key                               |
| `403`          | The key lacks the route or operation scope                                |
| `404`          | Origin, path, event-owned record, or deployment version                   |
| `409`          | Expected-version or idempotency conflict; reread before deciding to retry |
| `5xx`          | Record the request time and operation, then check Worker logs and health  |

Never turn an authorization or version conflict into an unconditional retry. For a mutating
request with an ambiguous network result, retry once with the same idempotency key and then inspect
domain events or the affected resource.

## 7. Rotate without interrupting other clients

Create a replacement with the same or narrower scopes, update only this client's secret, confirm
the replacement's **Last used** timestamp, and revoke the old key. Separate keys keep an incident
or rotation from taking every integration offline.

Next: read the complete [HTTP API contract](/docs/api.md), connect an [agent client](/docs/agents/connect.md),
or review the [self-host launch checklist](/docs/self-hosting/launch-checklist.md).
