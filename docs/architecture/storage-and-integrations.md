# Storage and integrations

ProgramKit has one recommended V1 data path:

```text
one event
   │
   ▼
SQLite-backed Durable Object
   ├── authoritative workspace state
   ├── serialized named operations
   ├── revisions and idempotency
   └── future live connections and delivery alarms
```

This is the default for local development, hosted demos, self-hosting, and the official app. It is
fast, requires no database provisioning, and gives each event an isolated transaction boundary.

## Service ownership

| Concern                             | Recommended owner                               | Status                                   |
| ----------------------------------- | ----------------------------------------------- | ---------------------------------------- |
| Event business records              | SQLite-backed Durable Object                    | Working default                          |
| Staff identity and event membership | Account Durable Object                          | Working, team roles still incomplete     |
| File bytes                          | R2                                              | Planned production pipeline              |
| Email and webhook attempts          | Transactional outbox plus Queue or object alarm | Planned                                  |
| Cross-event search and analytics    | Rebuildable D1 projection                       | Add only when needed                     |
| Airtable team view                  | Optional integration                            | Experimental Airtable-backed mode exists |

R2, mail, Airtable, and MCP are integrations around the event store. They do not change the core
operation contract.

## Airtable decision

The repository includes a real OAuth flow, versioned schema, native operational tables, delta
writes, cache restoration, and signed webhooks. When an operator enables that experimental mode,
Airtable becomes the acknowledged persistence backend and the event object becomes its serialized
hot cache.

That path is not the recommended production default yet. Airtable has no atomic transaction across
the tables touched by operations such as accepting a proposal. The current adapter can partially
complete a multi-table write before a later request fails, and inbound webhook refreshes still need
payload cursors, expected-version checks, and human-visible conflict review.

For V1, keep Airtable disconnected unless the integration itself is under test. A production team
view should eventually work as a non-blocking outbound mirror with reviewable inbound changes:

```text
Durable Object commit
       │
       ├── returns success to the product
       └── records durable sync intent
                    │
                    ▼
              Airtable mirror

Airtable edit ── webhook ── proposed named operations ── human review
```

That direction preserves product availability, makes retries observable, and prevents a direct
spreadsheet edit from bypassing domain invariants. It is future architecture, not a claim about the
current runtime.

## D1 decision

D1 is not another primary database. A future D1 database may index multiple event objects for
organization-wide search, reporting, or administrative views. It must be rebuildable and may lag
behind an event transaction.

## Portability

The domain engine and logical export do not depend on Cloudflare. The supported deployment still
does. A second runtime needs an equivalent implementation for transactions, identity, files,
background jobs, mail, live updates, tests, and operations. ProgramKit will not advertise a host
until that complete path is maintained.

Use [Deployment](../../DEPLOYMENT.md) for the runnable Cloudflare assembly and the
[Airtable guide](../integrations/airtable.md) for the exact experimental behavior.
