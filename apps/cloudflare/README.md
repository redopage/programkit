# `@programkit/app-cloudflare`

The private, runnable, supported Cloudflare assembly for ProgramKit. It composes the three public
packages with Workers Static Assets and one SQLite-backed Durable Object per workspace.

From the repository root:

```bash
pnpm dev
pnpm build
pnpm deploy:cloudflare
```

Cloudflare bindings, the Worker entry point, and host identity routing remain in this directory.
Reusable domain behavior belongs in `@programkit/core`; reusable React UI belongs in
`@programkit/web`; optional MCP behavior belongs in `@programkit/agent`.

The current actors and tenant header are deterministic demo conveniences. Review the repository
`SECURITY.md` and `OPERATIONS.md` before using real participant data.
