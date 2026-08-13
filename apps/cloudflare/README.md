# `@programkit/app-cloudflare`

The private, runnable, supported Cloudflare assembly for ProgramKit. It composes the three public
packages with Workers Static Assets and one SQLite-backed Durable Object per workspace. A scoped
Airtable base can be composed as durable source of truth while the object remains the hot cache and
serialized mutation boundary.

From the repository root:

```bash
pnpm dev
pnpm build
pnpm deploy:cloudflare
pnpm deploy:demo
pnpm deploy:app
```

The checked-in default profile is the authenticated hosted application used by direct and
Deploy-to-Cloudflare installs. The `local` profile provides the zero-configuration deterministic
sample. Run `pnpm selfhost` from the repository root for guided provisioning, deployment, and
verification. Use `pnpm selfhost:setup` only when you want to inspect the ignored installation
profile before deploying it. The profile includes a first-owner setup secret, accounts, multiple
event objects, R2, API keys, and MCP.
The `demo` and `app` profiles deploy the same build to ProgramKit's official hosts with separate
Durable Object namespaces. Only the official app profile has the checked-in restricted `EMAIL`
binding; a self-hoster may add its own sender configuration. Keeping the profiles together prevents
product and migration drift while preserving runtime isolation.

Cloudflare bindings, the Worker entry point, and host identity routing remain in this directory.
Reusable domain behavior belongs in `@programkit/core`; reusable React UI belongs in
`@programkit/web`; optional MCP behavior belongs in `@programkit/agent`.

The default profile's actors and tenant header are deterministic demo conveniences. The generated
self-host profile uses the same hosted identity and event-access boundary as the official app.
Review the repository `SECURITY.md` and `OPERATIONS.md` before using real participant data.

Start with the [self-hosting guide](../../docs/self-hosting/README.md) for deployment and the
[repository tour](../../docs/developers/repository-tour.md) for host ownership.
