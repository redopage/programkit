<!-- Canonical: https://programkit.dev/docs/developers/customizing -->
<!-- Markdown: https://programkit.dev/docs/developers/customizing.md -->

# Customize the ProgramKit starter

|                |                                                               |
| -------------- | ------------------------------------------------------------- |
| **For**        | Teams forking ProgramKit for their own service or event model |
| **Outcome**    | A branded, maintainable fork that preserves security rules    |
| **First read** | [Extending ProgramKit](/docs/developers/extending-programkit.md)               |

ProgramKit is intended to be changed. Start with the smallest layer that owns the behavior instead
of searching and replacing the entire repository.

## Customization map

| Change                                      | Start here                                                        |
| ------------------------------------------- | ----------------------------------------------------------------- |
| Logo mark used by the React product         | `packages/web/src/components/brand.tsx`                           |
| Browser favicon and PWA icons               | `apps/cloudflare/public/favicon.svg` and `public/icons/`          |
| App name, description, theme, and icons     | `apps/cloudflare/public/site.webmanifest`                         |
| HTML title and metadata                     | `apps/cloudflare/index.html`                                      |
| Public project homepage                     | `packages/web/src/views/SiteView.tsx`                             |
| Product color, spacing, and component rules | `packages/web/src/styles.css` and shared UI components            |
| Legal text                                  | `packages/web/src/routes/privacy.tsx` and `terms.tsx`             |
| Agent Plugin identity                       | `packages/agent/plugin/programkit/plugin.json` and Codex metadata |
| Agent logo                                  | `packages/agent/plugin/programkit/assets/`                        |
| Repository/package identity                 | root and package `package.json` files                             |
| Hosted domains and sender identity          | `wrangler.jsonc` or generated installation configuration          |
| Business rules and records                  | `packages/core`                                                   |
| Organizer and participant experiences       | `packages/web`                                                    |
| Cloudflare services and credentials         | `apps/cloudflare`                                                 |

Use a scoped search for the old product name and domains after making the intentional edits:

```bash
rg -n "ProgramKit|programkit\.dev" \
  README.md docs apps packages package.json wrangler.jsonc
```

Review every result; do not apply a blind repository-wide replacement. Historical architecture,
license attribution, import formats, skill names, and compatibility identifiers may need to stay
stable.

## Rebrand the product

1. Replace owned logo and icon assets with source files you may redistribute.
2. Update accessible names, alternative text, page title, PWA metadata, and theme colors.
3. Update the public homepage and screenshots.
4. Update email sender, reply-to, support, privacy, and terms for the actual operator.
5. Update Agent Plugin display metadata and assets, then regenerate its embedded source.
6. Verify light/dark contexts, keyboard focus, 320 px layouts, PWA icons, emails, and public embeds.

Keep Apache-2.0 notices for upstream ProgramKit code. Rebranding does not transfer ProgramKit's
official domains, sender identity, support promises, or hosted-service terms to a fork.

## Change copy or navigation

Copy that explains a domain rule should stay aligned with core validation. For example, changing a
button from “Publish” to “Go live” must not imply that a draft is public before a schedule release
exists.

Navigation lives in the shared shell and typed routes. Preserve stable deep links when renaming a
label. If a route must change, provide an intentional redirect and update public links, docs,
tests, and embeds together.

## Add event-specific fields

Use a structured form question when the value belongs only to intake. Add a mapped core field when
the value must drive accepted speaker, session, scheduling, public program, API, or agent behavior.

For a new mapped field:

1. extend the core record and mapping compatibility;
2. update validation and acceptance projection;
3. expose it only to appropriate surfaces;
4. add import/export representation;
5. update API and agent results only when needed; and
6. cover incompatible types, blank values, and old records in tests.

## Add a new organizer module

Before adding sidebar navigation, prove the workflow belongs to the program lifecycle and cannot be
expressed as a focused extension of an existing surface. Then build one vertical slice: core
records and operations, minimized selector, route, UI states, host authorization, tests, and docs.

Do not turn ProgramKit into a general ticketing, payments, marketing, awards, or networking suite by
default. A fork can choose different scope, but should document its new product boundary.

## Replace or add a provider

Keep provider SDKs, secrets, callbacks, and retry orchestration in the Cloudflare host or an
isolated adapter. Keep provider-neutral intent and audit state in core.

When adding mail, storage, analytics, CRM, or webhook providers:

- define who owns source-of-truth data;
- record durable delivery/sync intent before external work;
- use idempotency and observable retry state;
- validate inbound signatures and replay;
- never accept provider identity as ProgramKit event membership; and
- document disconnect, deletion, export, and incident behavior.

## Change the supported host

The domain engine is portable; the maintained application assembly is not advertised as portable
until an equivalent host exists. A new host must implement transactions, account and event access,
files, jobs, email, API/MCP authentication, public routing, migrations, tests, deployment, backup,
and operations.

Do not present a static frontend build or a database adapter as a complete alternate deployment.

## Keep the fork upgradeable

- Keep upstream package boundaries.
- Prefer new focused files over rewriting central files without need.
- Never remove historical Durable Object migration tags.
- Keep generated artifacts reproducible.
- Add tests at the same boundary as the customization.
- Document intentional deviations from upstream architecture.
- Rebase or merge upstream into a staging branch and run the complete product rehearsal before
  production deployment.

## Validate a customized fork

```bash
pnpm docs:check
pnpm check
```

Also exercise the [first-event walkthrough](/docs/getting-started/first-event.md) and
[self-host launch checklist](/docs/self-hosting/launch-checklist.md) under the fork's own domains,
assets, providers, and policies.
