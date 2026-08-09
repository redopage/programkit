# Accelevents as a one-way program destination

ProgramKit exports a published program to Accelevents without making Accelevents authoritative.
The adapter reads only the latest immutable `ScheduleRelease`; unpublished moves, unscheduled
sessions, internal notes, review data, and task files never enter the packet.

## What is implemented

`accelevents.prepare-export` runs a mapping preflight and freezes one versioned delivery batch. Each
batch contains stable speaker and session items with independent status, attempt count, provider ID,
last error, and version. Repeating the operation for the same release and event URL is rejected so a
retry cannot silently duplicate a batch.

`accelevents.record-result` is reserved for a trusted provider consumer. It records a delivered or
failed outcome for one item. Failed items remain retryable; delivered items are terminal. The batch
and integration summaries derive from the item evidence instead of claiming success when a packet
is merely staged.

## Mapping contract

| ProgramKit source             | Frozen Accelevents fields                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Person + participation        | Stable external key, first/last name, email, public title/company, bio, image URL, moderator flag                         |
| Published placement + session | Stable external key, title, description, event-local start/end, room, format, room capacity, track, speaker external keys |

Session formats map to Accelevents' documented values: keynotes use `MAIN_STAGE`, talks and panels
use `BREAKOUT_SESSION`, workshops use `WORKSHOP`, and breaks use `BREAK`. Date/time strings use the
event timezone and Accelevents' documented `yyyy/MM/dd HH:mm` shape.

The official host-side API documents speaker records at
[`/rest/host/event/{eventUrl}/speaker`](https://developer.accelevents.com/reference/get-all-speakers)
and session records at
[`/rest/host/event/{eventUrl}/session`](https://developer.accelevents.com/reference/get-all-sessions-1).
The session documentation describes the title, start/end, description, capacity, visibility, and
format fields used by the packet. The provider consumer must reconcile stable ProgramKit keys with
provider IDs before choosing create or update calls.

## Credential and delivery boundary

The core package never imports an Accelevents SDK and never stores an API key. Accelevents says its
API is available on Enterprise and White Label plans, and that an enterprise owner creates or views
the API key. See the official [API-key guide](https://developer.accelevents.com/docs/getting-started)
and [API overview](https://developer.accelevents.com/docs/accelevents-api-documentation).

Production activation belongs in a credentialed Cloudflare consumer after the workspace commit:

1. claim a pending or failed item with an idempotency key;
2. look up the external key and create or update the provider record;
3. record the provider resource ID or a concise failure through `accelevents.record-result`;
4. retry failed items with backoff without rebuilding the frozen packet.

There is deliberately no delete propagation. Removing a ProgramKit session requires an explicit
provider-side archive policy; a one-way export must not infer destructive external changes.

## Honest release state

The reference application proves mapping, versioning, redaction, failure/retry transitions, and
operator status. It does not include an Accelevents credential or claim a live provider delivery.
Before production use, configure the enterprise API key and event target outside the repository,
implement the Cloudflare consumer, exercise provider rate limits and partial failures, and retain a
provider-confirmed smoke-test receipt.
