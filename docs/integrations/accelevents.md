# Accelevents as a one-way program destination

ProgramKit exports a published program to Accelevents without making Accelevents authoritative.
The adapter reads only the latest immutable `ScheduleRelease`; unpublished moves, unscheduled
sessions, internal notes, review data, and task files never enter the packet.

## What is implemented

`accelevents.prepare-export` runs a mapping preflight and freezes one versioned delivery batch. Each
batch contains stable speaker and session items with independent status, attempt count, provider ID,
last error, and version. Repeating the operation for the same release and event URL is rejected so a
retry cannot silently duplicate a batch.

After the workspace commit, the Cloudflare host invokes the checked-in provider consumer only when
the owner-managed `ACCELEVENTS_API_KEY` secret exists. It processes speakers before sessions, uses
documented create calls for new records and update calls for retained provider IDs, and resolves
speaker IDs into each session relationship. `accelevents.record-result` is reserved for that trusted
consumer. It records a delivered or failed outcome for one item; `accelevents.retry-export` queues
every undelivered frozen item again. Delivered items are terminal. Batch and integration summaries
derive from provider evidence instead of claiming success when a packet is merely staged.

## Mapping contract

| ProgramKit source             | Frozen Accelevents fields                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Person + participation        | Stable external key, first/last name, email, public title/company, bio, image URL, moderator flag                         |
| Published placement + session | Stable external key, title, description, event-local start/end, room, format, room capacity, track, speaker external keys |

Session formats map to Accelevents' documented values: keynotes use `MAIN_STAGE`, talks and panels
use `BREAKOUT_SESSION`, workshops use `WORKSHOP`, and breaks use `BREAK`. Date/time strings use the
event timezone and Accelevents' documented `yyyy/MM/dd HH:mm` shape.

The consumer follows Accelevents' official host-side
[create-speaker](https://developer.accelevents.com/reference/create-speaker),
[update-speaker](https://developer.accelevents.com/reference/update-speaker),
[create-session](https://developer.accelevents.com/reference/create-session), and
[update-session](https://developer.accelevents.com/reference/update-session) contracts. Requests use
the documented `AUTHENTICATION` header. The session documentation describes the title, start/end,
description, capacity, visibility, and format fields used by the packet. Stable ProgramKit keys are
audit evidence; returned provider IDs are the create-versus-update key and carry into later release
batches.

## Credential and delivery boundary

The core package never imports an Accelevents SDK and never stores an API key. Accelevents says its
API is available on Enterprise and White Label plans, and that an enterprise owner creates or views
the API key. See the official [API-key guide](https://developer.accelevents.com/docs/getting-started)
and [API overview](https://developer.accelevents.com/docs/accelevents-api-documentation).

Production activation belongs in the checked-in Cloudflare consumer after the workspace commit:

1. Andrew stores the Enterprise key with `wrangler secret put ACCELEVENTS_API_KEY`;
2. an operator stages the latest published release or explicitly retries an existing batch;
3. the host creates or updates speakers, then creates or updates sessions with those speaker IDs;
4. it records the provider resource ID or a concise failure through
   `accelevents.record-result` without exposing the key;
5. a failed item remains visible and can be queued again without rebuilding the frozen packet.

There is deliberately no delete propagation. Removing a ProgramKit session requires an explicit
provider-side archive policy; a one-way export must not infer destructive external changes.

## Honest release state

The reference application proves mapping, versioning, redaction, executable create/update requests,
speaker-first relationship resolution, provider-ID reuse, failure/retry transitions, and operator
status. It does not include an Accelevents credential or claim a live provider delivery. Before
release, Andrew must configure the Enterprise key outside the repository, use a controlled target
event, exercise provider rate limits and partial failures, and retain a provider-confirmed smoke-
test receipt.
