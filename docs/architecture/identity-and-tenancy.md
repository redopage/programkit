# Identity, events, and storage ownership

ProgramKit has one recommended hosted shape. Identity is account-scoped, business work is
event-scoped, and file bytes are kept out of both.

```text
passwordless session
        │
        ▼
account Auth Durable Object
  user, sessions, event memberships
        │
        ├── event A ── Workspace Durable Object ── Airtable base when connected
        └── event B ── Workspace Durable Object ── Airtable base when connected

private file bytes ── R2
file metadata       ── event records
```

## Hosted staff sign-in

`app.programkit.dev` uses passwordless email sign-in through Cloudflare Email Service.

1. The Worker normalizes the email address and routes the request to an account-sharded
   `AuthDurableObject`.
2. The object creates a 256-bit token, stores only its SHA-256 hash, and expires it after 15
   minutes.
3. Email requests use a 45-second resend cooldown and an hourly account limit. Cloudflare edge
   rate limiting is still required for broad IP abuse protection.
4. The configured canonical application origin is used for the callback. The request host cannot
   choose it in production.
5. A valid token works once and is exchanged for a 30-day, HTTP-only, secure, same-site session
   cookie.
6. Logout revokes the stored session and clears both session and selected-event cookies.

The public response does not disclose whether an account already exists. New accounts receive an
empty planning event so the first real workspace never contains the seeded demonstration data.

## Why identity is sharded by account

There is no global authentication object. The first 128 bits of a normalized email hash select an
account object, and the random secret remains separate. This avoids sending every sign-in and
account read through one global serialized object.

The account object owns:

- the user identity;
- magic-link hashes and expiry;
- session hashes and expiry;
- the user's event membership list; and
- the event index used by the switcher.

The current hosted slice supports owner accounts and event creation. Team invitations, membership
revocation, administrator roles, and account recovery policy are still required before teams use
real participant data.

## One workspace object per event

Every hosted event ID maps to one `WorkspaceDurableObject`. Event selection is accepted only when
the authenticated account has a matching membership. The Worker then derives the object name from
that verified event ID and injects the account as the trusted staff actor.

Creating a second event initializes a separate empty object. Switching events changes only the
selected-event cookie. It does not copy state, scan other objects, or merge caches.

Cross-event screens should read the small event index from the account object. They must not list
or scan every workspace object. D1 remains a future rebuildable projection for organization-wide
search and analytics, not a primary database.

## Airtable and Durable Object ownership

The storage rule is deliberately singular:

- Before Airtable is connected, the event object's SQLite storage is the complete local store.
- After Airtable is connected, Airtable is the durable source of truth for that event's business
  records.
- The event object remains the serialized operation coordinator and hot read cache. It advances
  only after Airtable acknowledges the required record writes.
- Account identity, sessions, and memberships never move into Airtable.

This is not two independent databases or last-write-wins sync. Direct Airtable changes arrive
through a signed webhook and refresh the event cache. The remaining production work is listed in
the [Airtable guide](../integrations/airtable.md#current-boundary).

## R2 file boundary

R2 will own headshots, slides, supporting documents, and generated exports. Event records will
store only an opaque object key, file metadata, ownership, and lifecycle state. A browser will
never receive a bucket credential.

The upload pipeline is not implemented yet. It must include authenticated initiation, direct
upload, type and size validation, finalize, scanning state, private download authorization,
replacement, deletion, and retention cleanup before real files are accepted.

## Hosted surfaces

The three official hosts are separate runtime profiles built from this repository:

- `programkit.dev` is the public site and exposes no workspace API.
- `demo.programkit.dev` creates seven-day sample workspaces with bearer capability links and no
  outbound email.
- `app.programkit.dev` uses verified staff sessions and isolated event objects.

The hosted app currently keeps public CFP, reviewer, and speaker routes behind the staff session
until event-scoped public links and participant identities are implemented. The demo remains the
safe place to evaluate those sample-data flows.
