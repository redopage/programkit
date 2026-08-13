<!-- Canonical: https://programkit.dev/docs/architecture/identity-and-tenancy -->
<!-- Markdown: https://programkit.dev/docs/architecture/identity-and-tenancy.md -->

# Identity, events, and storage ownership

ProgramKit has one recommended hosted shape. Identity is account-scoped, business work is
event-scoped, and file bytes are kept out of both.

```text
account session
        │
        ▼
account Auth Durable Object
  user, organization, sessions, event switcher projection
        │
        ├── event A ── Event Access Durable Object ── Workspace Durable Object
        └── event B ── Event Access Durable Object ── Workspace Durable Object

private file bytes ── R2
file metadata       ── event records
```

## Hosted staff sign-in

`app.programkit.dev` supports email and password plus passwordless email links. Both paths resolve
the same account object, event memberships, and 30-day session format.

Password signup derives a 256-bit key with PBKDF2-SHA-256, a random per-account salt, and 100,000
iterations, the maximum currently supported by Cloudflare Workers. Only the derived value is
stored. Password attempts have account and IP limits, and
sign-in failures do not disclose whether the account or password was wrong. An existing
passwordless account cannot be claimed through open password signup. Its owner must continue with
an email link until an authenticated password-setting flow is added.

Passwordless sign-in works as follows:

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

The public response does not disclose whether an account already exists. New accounts receive a
placeholder planning event and are immediately asked to name and date their first event. That
placeholder is renamed in place, so first-time setup does not leave a duplicate "My first event"
workspace behind and the first real workspace never contains seeded demonstration data.

An authenticated staff account can set or change its password from Settings. Accounts that already
have a password must prove the current password; passwordless accounts can set their first password
from an authenticated session. A successful change uses a fresh salt and derivation, revokes every
other account session, and expires pending sign-in links while keeping the current browser signed
in. The same account-security surface lists active-session creation and expiry times behind opaque
session IDs. It can revoke one other session or all other sessions; signing out remains the only way
to revoke the current browser.

## Why identity is sharded by account

There is no global authentication object. The first 128 bits of a normalized email hash select an
account object, and the random secret remains separate. This avoids sending every sign-in and
account read through one global serialized object.

The account object owns:

- the user identity;
- salted password derivations where configured;
- magic-link hashes and expiry;
- session hashes and expiry;
- a repairable projection of the user's event memberships; and
- the event index used by the switcher.

An owner-created account receives one stable organization ID. Events created from that account
inherit it. An invitation carries the target event's organization ID, so access to an unrelated
event does not make its people visible in the owner's organization CRM.

Each event has a separate `EventAccessDurableObject` that is authoritative for membership. It owns
active and revoked memberships, owner and administrator policy, and pending invitations. The
Worker validates the selected membership there on every hosted request, then derives role scopes.
Removing access takes effect even if an account event projection or browser cookie is stale.

The same event access object owns a separate participant credential namespace. A submitter can
create an email, full name, and password account from the public CFP without receiving any staff
membership. Participant passwords use PBKDF2-SHA-256 with a random salt and the same
100,000-iteration edge limit. Sessions are random, stored only by hash, event-bound, HTTP-only, and
independently revocable.

The product presents one consistent sign-in language instead of making participants learn a
second branded login. The general sign-in route first checks for a staff account and then uses the
participant directory to recover event access when the address belongs only to participant
records. Event-specific CFP and invitation links stay event-branded and create participant
accounts in that event's namespace. This unifies entry without weakening authorization: a
participant session is never accepted by operator endpoints.

After participant sign-in, the Worker matches the normalized email against that event's
submissions, reviewer records, and speaker participations. It returns only the matching
record-scoped links. This makes drafts, review assignments, and speaker portals recoverable from a
new device while preserving the existing least-privilege capability check on every projected read
and operation.

Owners can invite administrators or read-only viewers. Administrators can invite and remove
viewers. Invitation secrets are random 256-bit values, stored only as SHA-256 hashes, bound to one
normalized email, usable once, and expired after seven days. Accepting an invitation repairs the
account switcher projection. Revocation removes that projection after the authoritative event
membership is disabled.

Account recovery, ownership transfer, and deployment-specific MFA or external OIDC policy remain
future hardening.

## One workspace object per event

Every hosted event ID maps to one `WorkspaceDurableObject`. Event selection is accepted only when
the authenticated account has a live matching membership in that event's access object. The
Worker then derives the workspace object name from that verified event ID and injects the account
with server-owned role scopes as the trusted staff actor.

Creating a second event initializes a separate empty object. Switching events changes only the
selected-event cookie and never copies the event workspace.

The organization CRM is the one intentional cross-event projection. It starts from the account's
small event index, filters to the active event's organization ID, and performs a bounded fan-out to
those event objects. It deduplicates contacts in memory while keeping each participation,
session, note, segment, and pipeline record owned by its event. Reusing a contact writes a stable
person identity and a new participation into the selected target event through named operations.

This is appropriate for the small number of events in the supported V1 installation. A larger
installation should project domain events into D1 for organization-wide search and analytics
instead of increasing fan-out. D1 remains rebuildable and is not a second primary database.

## Airtable and Durable Object ownership

The storage rule is deliberately singular:

- Before Airtable is connected, the event object's SQLite storage is the complete authoritative
  store and the recommended V1 configuration.
- After the experimental Airtable-backed mode is connected, Airtable is the acknowledged
  persistence backend for that event's business records.
- The event object remains the serialized operation coordinator and hot read cache. It advances
  only after Airtable acknowledges the required record writes.
- Account identity, sessions, and memberships never move into Airtable.

This is not two independent databases or last-write-wins sync. Direct Airtable changes arrive
through a signed webhook and refresh the event cache. The remaining production work is listed in
the [Airtable guide](/docs/integrations/airtable.md#current-boundary).

## R2 file boundary

R2 owns headshots, slides, supporting documents, and generated ZIP exports. Event records store
only an opaque object key, file metadata, ownership, version, uploader, and lifecycle state. A
browser never receives a bucket credential.

The Worker accepts scoped multipart uploads for a speaker's own headshot and assigned file tasks,
plus organizer headshot replacement. It validates type and size before writing bytes, registers
metadata through the named operation engine, preserves earlier versions, marks the latest version,
and authorizes every download against the active event and record owner. Organizers can review
files, exchange attributed comments with speakers, and export selected latest versions as a ZIP.

An event owner can explicitly delete one version. ProgramKit first retains a durable tombstone and
repairs any current-version or readiness reference, then removes the event-rooted R2 object and
records system confirmation. Failed object cleanup remains visible and retriable while the file is
kept unavailable.

Production hardening still includes malware scanning, age-based retention and workspace-offboarding
policy, orphan cleanup after interrupted uploads, legal holds, and storage observability. Those
controls should be in place before accepting sensitive participant files at scale.

## Hosted surfaces

The three official hosts are separate runtime profiles built from this repository:

- `programkit.dev` is the public site and exposes no workspace API.
- `demo.programkit.dev` creates seven-day sample workspaces with bearer capability links and no
  outbound email.
- `app.programkit.dev` uses verified staff sessions and isolated event objects.

The hosted app exposes event-specific public CFP and agenda links without a staff session. A link
uses `?event={eventId}` on the initial document request. The Worker validates stored event metadata,
sets an HTTP-only routing cookie, and serves only the public form or immutable published-program
projection from that event object. The event ID is routing context, not organizer authorization.

Reviewer and speaker links use separate, record-scoped capability keys. They can read and mutate
only the matching reviewer queue or participation portal and cannot call operator endpoints. An
event participant account can recover matching links through `/access`, but the account session is
not accepted by operator endpoints and does not replace the capability check.
