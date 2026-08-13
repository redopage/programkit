<!-- Canonical: https://programkit.dev/docs/self-hosting/configuration -->
<!-- Markdown: https://programkit.dev/docs/self-hosting/configuration.md -->

# Self-host configuration

ProgramKit keeps ordinary configuration in Wrangler variables, private values in Worker secrets,
and platform resources in bindings. The generated `.programkit/wrangler.json` is the canonical
configuration for one CLI-created installation.

## Required bindings

| Binding                   | Type                   | Responsibility                                      |
| ------------------------- | ---------------------- | --------------------------------------------------- |
| `PROGRAMKIT_WORKSPACES`   | SQLite Durable Objects | One authoritative transactional workspace per event |
| `PROGRAMKIT_AUTH`         | Durable Objects        | Accounts, passwords, links, sessions, event index   |
| `PROGRAMKIT_EVENT_ACCESS` | Durable Objects        | Roles, invitations, participant directory, API keys |
| `PROGRAMKIT_FILES`        | R2 bucket              | Private uploaded and generated file bytes           |
| `ASSETS`                  | Workers Static Assets  | Built web application                               |

All three Durable Object migrations must remain in the Wrangler configuration. Do not rename a
class or delete a migration tag to tidy the file; it can orphan deployed state.

## Deployment variables

| Variable                                      | Default self-host | Meaning                                                       |
| --------------------------------------------- | ----------------- | ------------------------------------------------------------- |
| `PROGRAMKIT_DEPLOYMENT_PROFILE`               | `hosted-app`      | Enables accounts, isolated events, API keys, and MCP          |
| `PROGRAMKIT_SIGNUP_MODE`                      | `bootstrap`       | Requires one setup-code claim, then uses owner-managed policy |
| `PROGRAMKIT_APP_ORIGIN`                       | request origin    | Canonical HTTPS origin for generated email links              |
| `PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL` | `10`              | Failed password attempts per normalized email in one hour     |
| `PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP`    | `40`              | Failed password attempts per IP hash in one hour              |
| `PROGRAMKIT_EMAIL_FROM`                       | unset             | Allowed sender for magic links and product email              |
| `PROGRAMKIT_SUPPORT_EMAIL`                    | unset             | Reply-to/support address                                      |

Invalid or out-of-range password failure limits fall back to safe defaults. Edge-level rate
limiting is still recommended for broad public abuse protection.

## Required secret

`PROGRAMKIT_BOOTSTRAP_TOKEN` is required for a new hosted-app self-host. It must contain at least
16 characters. The guided CLI generates and installs it. The Deploy to Cloudflare flow prompts for
it from `.dev.vars.example` and the binding description in `package.json`.

Never put the real value in `wrangler.jsonc`, `.dev.vars.example`, an API key, an event export, or a
plugin bundle.

## Signup configuration versus runtime policy

`PROGRAMKIT_SIGNUP_MODE=bootstrap` controls the safe initial state. After the owner claim, the
owner-managed **Installation access** setting is authoritative for open or invite-only organizer
signup.

The official managed `app` profile sets `PROGRAMKIT_SIGNUP_MODE=open` because it intentionally
operates public SaaS signup. A private self-host should not copy that profile value unless it also
owns the public-service controls around it.

## Custom domain

The CLI's `--domain` flag creates:

```json
{
  "routes": [{ "pattern": "events.example.com", "custom_domain": true }],
  "vars": {
    "PROGRAMKIT_APP_ORIGIN": "https://events.example.com"
  }
}
```

Keep the route and canonical origin aligned. Magic-link callbacks, browser origin checks, agent
plugin generation, and public links depend on the canonical origin.

## Email

Password authentication needs no mail service. To deliver magic links, invitations,
confirmations, reminders, or campaigns, add a supported Cloudflare `send_email` binding and set the
from and support variables. A `workers.dev` installation uses its current request origin. Set
`PROGRAMKIT_APP_ORIGIN` to the exact public HTTPS origin for custom-domain installations; an
explicit value always wins and pins generated links to that canonical host.

Use a dedicated verified sender and keep email enabled only on the application profile. The full
binding, outbox, and retry model is in [Cloudflare email](/docs/integrations/email.md).

## Airtable

Airtable is optional and experimental. For OAuth, register the exact callback:

```text
https://YOUR_HOST/api/v1/integrations/airtable/oauth/callback
```

Store `AIRTABLE_OAUTH_CLIENT_ID` and the optional `AIRTABLE_OAUTH_CLIENT_SECRET` as Worker secrets.
Do not place personal access tokens in browser configuration or event state. Read the
[Airtable guide](/docs/integrations/airtable.md) before enabling the mode.

## API and agent credentials

ProgramKit API keys are created inside the product, not configured as Worker secrets. Each key is
bound to one event, shown once, stored only by hash, and limited by explicit scopes, expiry, and
revocation.

Agent clients normally store one key as `PROGRAMKIT_API_KEY`. The plugin package contains the MCP
URL but no secret. See [Connect an agent](/docs/agents/connect.md).

## Official profiles

The checked-in `wrangler.jsonc` also contains project-maintainer profiles:

| Profile | Purpose                                   |
| ------- | ----------------------------------------- |
| default | Direct or deploy-button authenticated app |
| `local` | Deterministic local workspace             |
| `site`  | Public project site with no workspace API |
| `demo`  | Disposable seven-day sample workspaces    |
| `app`   | Official managed application              |

Self-hosters normally use the default or generated configuration. Do not deploy the official
`site`, `demo`, or `app` profiles under project domains.
