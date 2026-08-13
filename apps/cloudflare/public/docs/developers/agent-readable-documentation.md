<!-- Canonical: https://programkit.dev/docs/developers/agent-readable-documentation -->
<!-- Markdown: https://programkit.dev/docs/developers/agent-readable-documentation.md -->

# Agent-readable documentation

ProgramKit publishes one documentation source in formats that work for people, search crawlers,
coding agents, and retrieval tools. The human site remains the canonical reading experience; the
machine formats remove the need to execute JavaScript or guess route names.

## Discovery endpoints

| URL                         | Purpose                                                        |
| --------------------------- | -------------------------------------------------------------- |
| `/llms.txt`                 | Curated index of published pages, grouped by documentation job |
| `/llms-full.txt`            | Complete documentation corpus in one text response             |
| `/docs.md`                  | Markdown version of the documentation home                     |
| `/docs/{published-path}.md` | Markdown version of one documentation page                     |
| `/docs/api/openapi.json`    | Generated OpenAPI 3.1 contract                                 |
| `/sitemap.xml`              | Canonical human-facing pages for conventional crawlers         |

Every human documentation response also advertises its Markdown equivalent twice:

- an HTTP `Link` header with `rel="alternate"` and `type="text/markdown"`; and
- a matching `<link>` element in the document head.

The Markdown response links back to the human page as its canonical HTML representation.

## Request Markdown without changing the URL

Clients that control request headers can ask the human URL for Markdown:

```bash
curl --fail \
  --header 'Accept: text/markdown' \
  https://programkit.dev/docs/self-hosting/cloudflare
```

The response uses `Content-Type: text/markdown; charset=utf-8`, identifies the explicit Markdown
URL with `Content-Location`, varies caches on `Accept`, and supplies a canonical HTML `Link` header.
A browser-style request that prefers `text/html` continues receiving the React documentation site.

Use an explicit `.md` URL when the client cannot set headers:

```bash
curl --fail https://programkit.dev/docs/agents/connect.md
```

Relative documentation links are rewritten during generation to published `.md` URLs. Links to
repository-only files point to the public Forge source instead of a private mirror.

## Use server logs for request truth

Page analytics can describe aggregated browser behavior, but they cannot prove what an agent
requested, which representation the server selected, or why a request failed. For a self-hosted
Worker, inspect live request outcomes with Wrangler from the repository root:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler tail YOUR_WORKER_NAME
```

For the official deployments, use the corresponding Cloudflare Workers logs. Filter by route,
status, content type, and request ID. Do not log authorization headers, cookies, API keys, setup
codes, participant submissions, or other sensitive bodies merely to identify an agent client.

## JavaScript boundary

Search, responsive navigation, and other human conveniences use JavaScript. The documentation
content does not require it: an agent or text-only client can discover and retrieve every page
through `llms.txt`, explicit Markdown URLs, content negotiation, or the sitemap. Product widgets
that depend on authenticated workspace state remain interactive application surfaces and are not
misrepresented as public documentation.

## Keep the formats synchronized

The repository generator owns the web content bundle, Markdown mirrors, `llms.txt`,
`llms-full.txt`, sitemap, and public OpenAPI copy:

```bash
pnpm docs-site:generate
pnpm docs-site:check
```

Edit the Markdown source under `docs`, not the generated files under `apps/cloudflare/public` or
`packages/web/src/generated`. The complete `pnpm check` gate fails when a machine-readable artifact
is stale.
