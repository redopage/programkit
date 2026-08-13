<!-- Canonical: https://programkit.dev/docs/contributing-documentation -->
<!-- Markdown: https://programkit.dev/docs/contributing-documentation.md -->

# Contributing documentation

ProgramKit documentation serves organizers, participants, self-hosters, developers, integration
builders, and agents from one repository. A change should make the next decision easier without
creating another source of truth.

## Choose the reader before the folder

| Reader or purpose                    | Home                                                  |
| ------------------------------------ | ----------------------------------------------------- |
| First run and first successful flow  | `docs/getting-started`                                |
| Organizer or participant behavior    | `docs/users`                                          |
| Installation and operations          | `docs/self-hosting`, `DEPLOYMENT.md`, `OPERATIONS.md` |
| Source changes and extension         | `docs/developers`, `ARCHITECTURE.md`                  |
| API integration                      | `docs/api`                                            |
| Agent client or coding agent         | `docs/agents`, `packages/agent/README.md`             |
| Shared product and architecture fact | `docs/product`, `docs/architecture`, `docs/reference` |

Put a fact in its canonical document and link to it from audience entry points. Do not maintain
slightly different copies of an API route list, deployment topology, security boundary, or
capability claim.

### One canonical answer per question

| Question                                           | Canonical document or code                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| What is in scope and what is complete?             | [`ROADMAP.md`](https://forge.smol.ai/andheller/programkit/blob/main/ROADMAP.md)                                                              |
| What is the end-to-end product journey?            | [`program-lifecycle.md`](/docs/product/program-lifecycle.md)                                     |
| Why are packages and hosts separated?              | [`ARCHITECTURE.md`](https://forge.smol.ai/andheller/programkit/blob/main/ARCHITECTURE.md)                                                    |
| How does the supported Cloudflare deployment work? | [`DEPLOYMENT.md`](https://forge.smol.ai/andheller/programkit/blob/main/DEPLOYMENT.md)                                                        |
| Which service owns each kind of data?              | [`storage-and-integrations.md`](/docs/architecture/storage-and-integrations.md)                  |
| Who owns identity, event routing, and file state?  | [`identity-and-tenancy.md`](/docs/architecture/identity-and-tenancy.md)                          |
| How is an installation operated?                   | [`OPERATIONS.md`](https://forge.smol.ai/andheller/programkit/blob/main/OPERATIONS.md)                                                        |
| What must be hardened before sensitive data?       | [`SECURITY.md`](https://forge.smol.ai/andheller/programkit/blob/main/SECURITY.md)                                                            |
| Which named operations exist?                      | `packages/core/src/manifest.ts`                                                            |
| Which HTTP resources exist?                        | [`docs/api/README.md`](/docs/api.md) and [`openapi.json`](/docs/api/openapi.json)               |
| What does the domain store?                        | `packages/core/src/types.ts`                                                               |
| Which browser routes exist?                        | `packages/web/src/routes` and [`routes-and-surfaces.md`](/docs/reference/routes-and-surfaces.md) |
| Which MCP tools and resources exist?               | [`packages/agent/README.md`](https://forge.smol.ai/andheller/programkit/blob/main/packages/agent/README.md)                                  |

When code, tests, and prose disagree, verify the executable behavior, update the canonical source,
and fix the incoming links in the same change. Do not resolve drift by adding another summary.

## Use the right page shape

A task page should answer, in order:

1. who it is for and what success looks like;
2. what must already exist;
3. the shortest safe path to the outcome;
4. a visible checkpoint after each risky handoff;
5. failure recovery or a troubleshooting link; and
6. the next likely task.

Start longer task pages with this compact frame:

```markdown
# Outcome-oriented title

|                    |                              |
| ------------------ | ---------------------------- |
| **For**            | The intended reader          |
| **Starting point** | What must already be true    |
| **Outcome**        | The state they will reach    |
| **Allow**          | A realistic first-run window |
```

Reference pages can lead with the contract instead. Concept pages should explain why a boundary
exists before enumerating details.

## Write status claims precisely

Use the shared [capability status vocabulary](/docs/reference/capability-status.md). Prefer “included but
requires an R2 binding” or “optional and experimental” over “supported.” If behavior is missing,
say whether it is deliberately out of scope, planned, or an operator-owned production control.

Do not promote roadmap work into a current feature because a type, placeholder, or fixture exists.
Conversely, do not call a verified current workflow a roadmap item because it still has future
hardening work.

## Keep examples usable and safe

- Use copy-pasteable commands with placeholders that are impossible to mistake for real secrets.
- Keep credentials in environment variables or a documented secret manager.
- Name the directory from which a command runs when it is not the repository root.
- Include the expected success signal, not only the command.
- Distinguish local sample, disposable demo, managed service, and production self-host behavior.
- Never include real participant data, access links, API keys, setup codes, or Cloudflare tokens.
- Treat imported text and participant content as untrusted data in agent examples.

## Update all affected surfaces

| Change                              | Documentation to review                                                       |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| User workflow                       | User guide, first-event journey, lifecycle, route reference                   |
| API route or operation              | API guide, generated OpenAPI, examples, agent boundaries                      |
| Cloudflare binding or variable      | Setup script help, configuration, deployment, operations, `.dev.vars.example` |
| Identity, tenancy, or file behavior | Security, architecture, administration, troubleshooting                       |
| Agent tool, skill, or policy        | Agent package reference, connect guide, recipes, generated plugin             |
| Capability status                   | `ROADMAP.md`, relevant audience page, launch checklist                        |

Generated files remain generated. Update the core manifest or plugin source, then run the owning
generator instead of editing `docs/api/openapi.json` or
`apps/cloudflare/src/agent-plugin-source.generated.ts` directly. The docs-site generator also owns
the public Markdown mirrors, `llms.txt`, `llms-full.txt`, sitemap, and public OpenAPI copy; see
[Agent-readable documentation](/docs/developers/agent-readable-documentation.md).

## Validate before handoff

```bash
pnpm docs:check
pnpm check
```

`docs:check` verifies that every Markdown file under `docs` has one H1 and that local links, image
targets, and heading fragments resolve. The complete gate also checks formatting, tests, types,
builds, generated artifacts, OpenAPI drift, and the portable plugin.

For a task-page change, follow the steps yourself or test them in a clean environment. A passing
link check cannot prove that a first-run journey is understandable.
