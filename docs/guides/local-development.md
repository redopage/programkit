# Local development

This guide gets a fresh checkout to the working sample without external accounts or secrets.

## Prerequisites

- Node.js 24 or newer
- Corepack
- Git

The repository records its pnpm version in `package.json`.

## Start the application

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Open `http://localhost:4173`. The development command starts Vite, the React application, the
Cloudflare Worker, and local Durable Object storage in one process.

No Airtable, Cloudflare login, email provider, or API key is required. The first request creates a
deterministic AIE NYC workspace with proposals, reviewers, speakers, tasks, sessions, and a
published agenda.

## Exercise the main workflow

1. Open `/forms` and inspect the call-for-proposals form and conditional workshop field.
2. Open `/submit/aie-nyc-2026-cfp` and submit a proposal.
3. Open `/submissions`, select that proposal, and make a decision.
4. Open `/reviews`, then use a reviewer's **Open portal** link to inspect the exact assigned queue
   and scorecard workspace.
5. Open `/portal/par_003` to complete accepted-speaker requirements.
6. Open `/schedule`, change the draft, run preflight, and publish a release.
7. Open `/agenda` to verify that the public program reads the immutable release.

The sample submitter and participant identities are intentionally route-derived. Reviewer links
also carry a per-reviewer capability, matching the links an organizer copies from `/reviews`.

## Reset local state

Stop the development server, then remove only the local Wrangler state directories:

```bash
rm -rf .wrangler apps/cloudflare/.wrangler
```

The next `pnpm dev` starts from the deterministic seed again. Never use this command against a
directory other than a ProgramKit checkout.

## Run the complete gate

```bash
pnpm check
```

Use the narrower commands while iterating:

```bash
pnpm test
pnpm lint
pnpm format:check
pnpm build
```

## Optional services

Local ProgramKit is complete without optional services. Add them only for the workflow you are
testing:

- Airtable OAuth or a scoped personal token: [Airtable integration](../integrations/airtable.md)
- Cloudflare mail bindings: [Email integration](../integrations/email.md)
- Remote Workers deployment: [Deployment](../../DEPLOYMENT.md)

Copy `apps/cloudflare/.dev.vars.example` to the ignored root `.dev.vars` only when an integration
needs secrets. Never commit `.dev.vars`.
