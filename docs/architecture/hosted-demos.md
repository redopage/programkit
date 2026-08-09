# Hosted demos

ProgramKit's hosted demo uses a capability link instead of an account. It is designed for fast,
isolated product evaluation with sample data, not for real conference operations.

## Lifecycle

1. `POST /api/v1/demos` generates a random 192-bit capability token and initializes a seeded Durable
   Object.
2. The returned `/demo/{capability}` URL is the private collaboration link.
3. Opening the link verifies that the object is active, stores the capability in an HTTP-only,
   same-site cookie, and redirects to `/`.
4. `GET /api/v1/demos/current` powers the expiry banner without exposing the capability through the
   workspace API.
5. The Durable Object alarm deletes the workspace after seven days. The banner can delete it
   sooner.

The Worker does not accept a demo capability through `x-programkit-workspace-key`. This prevents a
caller from selecting a hosted demo through the reference workspace-routing header.

## Routing and deployment shape

The capability token is intentionally not a UUID. It is a bearer secret, not a normal database
identifier, and its 192 random bits provide more entropy than a UUID v4. A future authenticated
workspace may use a UUIDv7 or another sortable internal identifier, but that identifier must remain
separate from the secret used to join a passwordless demo.

The canonical hosted entry point is `demo.programkit.dev`, and private links use
`/demo/{capability}` on that host. The capability is exchanged for an HTTP-only cookie on the same
origin. Local development and self-hosted installations keep the same `/demo` route and Worker
artifact.

The official demo is a separate `programkit-demo` Worker with its own Durable Object namespace and
no outbound mail binding. `app.programkit.dev` is a separate `programkit-app` Worker and namespace.
Both are built from this repository. The route and host are deployment entry points, not separate
products, so the demo runtime, schema, migrations, and tests cannot drift from the application.

## Airtable

Airtable is optional inside a hosted demo. Connecting a compatible base makes Airtable the durable
source of truth while the Durable Object remains the hot cache and serialized write coordinator.
This is useful for testing the real integration, but ProgramKit does not create an Airtable base
for every anonymous demo.

Deleting or expiring a demo removes the local cache, stored authorization, and ProgramKit webhook.
It does not delete the user's base, tables, or records. A later demo may reconnect the same base and
import its ProgramKit state.

## Security boundary

The URL is a bearer capability. Anyone with it can edit, and there is no individual attribution or
revocation. The operator, reviewer, submitter, and speaker identities remain demo conveniences.
Do not enter personal information, private files, provider credentials, or production data.

Before using real data, replace capability routing and fixed actors with verified sessions,
workspace membership, role-scoped authorization, abuse protection, and the controls in
[`SECURITY.md`](../../SECURITY.md).

## Later hardening

- Rate-limit demo creation and add Turnstile before promoting the route broadly.
- Add a hosted-account path that can promote a demo into an authenticated workspace.
- Show the expiry notice on public, reviewer, and speaker surfaces when those links are shared.
- Record lifecycle metrics without logging capability values.
