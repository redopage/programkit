<!-- Canonical: https://programkit.dev/docs/getting-started/choose-a-deployment -->
<!-- Markdown: https://programkit.dev/docs/getting-started/choose-a-deployment.md -->

# Choose how to run ProgramKit

Choose the path that matches what you need to do today. The hosted app, disposable demo, local
sample, and self-hosted installation share the same product code, but they do not have the same
data lifetime or operational owner.

## Quick answer

| Need                                      | Start here                                                           | Data and operations                               |
| ----------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| Evaluate the complete account-based app   | [Create a hosted account](https://app.programkit.dev/signup)         | ProgramKit operates the evaluation deployment     |
| Explore without creating an account       | [Open the disposable demo](https://demo.programkit.dev)              | Private demo link; automatically expires          |
| Run ProgramKit in your Cloudflare account | [Deploy your own installation](/docs/self-hosting/cloudflare.md)        | Your team owns the runtime, data, and operations  |
| Change workflows, branding, or behavior   | [Customize the source](/docs/developers/customizing.md), then self-host | Your fork; your team owns upgrades and operations |

## Use the hosted app for a complete evaluation

Open [app.programkit.dev/signup](https://app.programkit.dev/signup) when you need to test the real
account and event model. A new organizer can create an isolated event, invite collaborators,
exercise participant links, and publish public program surfaces. This is the correct entry point
for product evaluation and controlled conference-team pilots.

The hosted app is an evaluation deployment, not a promise of general-availability production
hosting or a service-level agreement. Confirm support, retention, privacy, and operating terms
before relying on it for a live event.

## Use the demo for a quick product tour

Open [demo.programkit.dev](https://demo.programkit.dev) when you want to explore seeded conference
data without an account. The demo creates a private access link and expires automatically after
seven days.

The demo is useful for learning the workflow. It is not evidence of account provisioning,
long-term retention, backups, or production operations.

## Self-host when your team must own the runtime

The supported self-host installs one Cloudflare Worker with the web application, HTTP API, MCP
endpoint, and static assets. Durable Objects hold transactional event state, and R2 stores uploaded
files. Start with the [Cloudflare deployment guide](/docs/self-hosting/cloudflare.md).

Self-hosting transfers operational responsibility to your organization. Your team must own:

- the Cloudflare account, domain, access policy, and email configuration;
- monitoring, backups, restores, retention, and incident response;
- dependency updates, source upgrades, and deployment rollbacks; and
- the security and privacy controls required for the participant data you collect.

The repository provides a repeatable deployment path and operational documentation. It does not
turn a new installation into a production service automatically. Read the
[security requirements](https://forge.smol.ai/andheller/programkit/blob/main/SECURITY.md), [operations guide](https://forge.smol.ai/andheller/programkit/blob/main/OPERATIONS.md), and
[launch checklist](/docs/self-hosting/launch-checklist.md) before accepting real participant data.

## Fork only when configuration is not enough

Branding, event settings, forms, tracks, rooms, and optional integrations are configuration. Fork
the source when you need different operations, data views, routes, or agent skills.

A fork gives you product control and also makes your team responsible for reviewing upstream
changes and resolving upgrade conflicts. Use the
[customization guide](/docs/developers/customizing.md) to find the intended extension points and
preserve the named-operation and authorization boundaries.

## Still deciding?

- Evaluating the complete account-based product: use the
  [hosted signup](https://app.programkit.dev/signup).
- Taking a five-minute tour: use the [disposable demo](https://demo.programkit.dev).
- Rehearsing the whole workflow offline: [run the local sample](/docs/guides/local-development.md).
- Preparing a customer-owned installation: read the [self-hosting overview](/docs/self-hosting.md).
