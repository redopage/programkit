# Live workspace updates

ProgramKit's reference client already refetches active operator projections every five seconds
while the page is visible, every other scoped surface every fifteen seconds, and every surface when
the window regains focus. That gives the readiness dashboard bounded near-real-time behavior without
moving authorization or derived state into the browser. It falls back cleanly when a tab sleeps.

For lower latency at larger scale, the same Durable Object that serializes one event workspace can
own WebSocket connections for that workspace. The recommended evolution uses Cloudflare's
WebSocket hibernation support so idle connections do not keep an object active.

Live updates are an invalidation channel, not a second data channel. The HTTP projections remain
canonical and scoped for operator, reviewer, participant, submitter, and public surfaces.

```text
named operation
      │
      ▼
Durable Object transaction ── workspace revision 48 committed
      │
      └── broadcast { revision: 48, topics: ["submissions", "readiness"] }
                              │
                              ▼
                  TanStack Query invalidates only affected projections
                              │
                              ▼
                       scoped HTTP refetch
```

## Connection contract

1. The Cloudflare host authenticates the request, resolves workspace membership, and derives the
   allowed surface before the WebSocket reaches the object.
2. The connection registers its actor, surface, topics, and last observed workspace revision as
   attachment metadata. The browser never chooses its own trusted actor or workspace.
3. After an accepted operation commits, the object sends a small revision message containing only
   topic hints and safe aggregate IDs. It does not broadcast the full workspace state.
4. The web client invalidates the relevant TanStack Query keys. Each surface refetches through its
   existing projection, preserving authorization and blind-review redaction.
5. Reconnection sends the last observed revision. If any revision was missed, the client refetches
   its active projections; it does not need every intermediate notification.

Public agenda clients subscribe to a publication topic only. They do not receive private draft
schedule activity. Reviewer clients receive assignment changes for that reviewer, not committee
notes from other scorecards. Participant clients receive changes to their own participation and
requirements only.

## What live does not mean

ProgramKit does not need collaborative text CRDTs for the golden path. Forms, submissions,
profiles, placements, and campaigns retain entity versions and expected-version checks. If two
people edit the same record, the second stale write receives a visible conflict and refresh path.
Live invalidation reduces how often that happens; it does not remove the correctness check.

Notifications are durable records, not WebSocket packets. A future notification model stores the
recipient, topic, deep link, created time, read time, and originating domain-event sequence. The
WebSocket only tells a connected client to refetch. Email or push delivery runs through the same
transactional outbox used by integrations.

## Operational guardrails

- Keep one connection per open browser client and multiplex topics over it.
- Cap connection and message rates per actor and workspace.
- Coalesce rapid commits into one highest-revision invalidation when possible.
- Make messages idempotent and monotonic; clients ignore revisions they have already observed.
- Record connected-client counts and broadcast failures, but never log payloads containing private
  proposal or participant data.
- Fall back to normal query refresh when WebSockets are unavailable. Live behavior is an
  enhancement, not a requirement for correctness.

One event-sized Durable Object is a good fit for conference program operations: writes are modest,
transaction boundaries are valuable, and most live traffic is fan-out after a commit. If evidence
later shows one unusually large workspace exceeds object throughput, split rebuildable read-heavy
services or public delivery from the authoritative write object before partitioning the domain.
