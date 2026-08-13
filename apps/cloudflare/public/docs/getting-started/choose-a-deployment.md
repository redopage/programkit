<!-- Canonical: https://programkit.dev/docs/getting-started/choose-a-deployment -->
<!-- Markdown: https://programkit.dev/docs/getting-started/choose-a-deployment.md -->

# Hosted or self-hosted?

ProgramKit uses one codebase for managed and customer-owned installations. Choose based on who
should own deployment and operations, not on a difference in core product capability.

## Use a managed installation when

- your team wants to start organizing events without operating Cloudflare resources;
- ProgramKit should handle deployment updates and service configuration; or
- you are evaluating the workflow before committing infrastructure ownership.

The official application uses the same `hosted-app` assembly as a self-host. Availability, support,
service terms, and production hardening are properties of that operated service, not of the
open-source license.

## Self-host when

- your organization must own the Cloudflare account and runtime data;
- you want a custom domain and deployment schedule;
- you need to modify workflows, branding, integrations, or policies from source; or
- an internal platform team will own backups, monitoring, upgrades, and incident response.

A self-host is not a collection of microservices. One Worker serves the application, HTTP API,
MCP endpoint, and static assets. Durable Objects and R2 are bindings behind that Worker.

## Clone the starter when

- ProgramKit is the starting point for a more specialized conference product;
- you expect to add domain operations, projections, routes, or agent skills; or
- you want all changes reviewed and deployed from your own fork.

Keep the package boundaries and named-operation contract even when the interface changes. The
[developer guide](/docs/developers.md) explains where an extension belongs.

## What does not change

In every mode:

- each event is an isolated transactional workspace;
- staff access is derived from live event membership;
- participant and public surfaces receive narrower projections;
- every write runs through a named core operation;
- the public agenda reads a published release, not the draft schedule; and
- agents can draft and propose but cannot approve, send, commit, publish, or manage secrets.

See the [product roadmap](https://forge.smol.ai/andheller/programkit/src/branch/main/ROADMAP.md) for current capability and production-hardening status.
