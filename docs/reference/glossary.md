# Glossary

## Account

An organizer identity with password or optional magic-link authentication. An account can hold
membership in multiple events.

## Agent Plugin

A client-side directory containing ProgramKit's portable metadata, MCP configuration, skills, and
optional client extensions. It points to a running ProgramKit MCP endpoint and is not a server.

## Change set

A reviewable proposal containing one or more named operations. Agents may propose supported changes;
humans retain approval and commit authority.

## Domain event

An append-only record emitted by an accepted named operation. Domain events support audit,
integrations, and future rebuildable projections.

## Event access object

The authoritative Durable Object for one event's staff membership, invitations, participant
directory, and API keys.

## Event workspace

The isolated authoritative program state for one event, stored in one SQLite-backed Durable
Object.

## Logical export

A versioned, provider-independent export of event workspace records and audit state. It does not
contain account secrets or R2 file bytes.

## MCP

Model Context Protocol. ProgramKit serves a stateless authenticated MCP endpoint at `/mcp` for
task-shaped tools and resources.

## Named operation

A core-defined state transition with explicit input, required scopes, risk, reversibility, agent
policy, validation, idempotency, version checks, and emitted events.

## Organization

The boundary used to relate an owner's events for CRM projection and contact reuse. Event-specific
records remain owned by their event.

## Participant account

An event-scoped identity used to recover a person's matching submissions, reviews, and speaker
portal destinations. It never grants organizer access.

## Projection

A deliberately minimized read model for one surface or role. Public, participant, reviewer,
speaker, organizer, API, and agent clients do not all receive the same workspace document.

## Published release

An immutable snapshot of the approved public schedule. The attendee agenda reads the newest
release, not the mutable draft.

## R2

Cloudflare object storage used for private uploaded and generated file bytes. ProgramKit mediates
access and stores lifecycle metadata in the event workspace.

## Requirement

An onboarding task assigned to one or more accepted participants, with due dates, status, and
optional file deliverables.

## Self-host

One customer-owned Cloudflare Worker deployment with bound Durable Objects and R2. The application,
API, MCP server, and plugin download share one origin.

## Session

In program content, an accepted talk, workshop, panel, or other agenda item. In account security,
an authenticated browser credential. Documentation qualifies the term when the meaning is not
obvious.

## Workspace version

The optimistic version used to detect stale writes. Expected-version conflicts are surfaced rather
than silently overwriting newer work.
