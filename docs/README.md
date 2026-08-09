# ProgramKit documentation

ProgramKit keeps one set of canonical documentation for organizers, contributors, operators, and
agents. Agent-facing guides route readers to that material and add execution guardrails; they do
not maintain a second version of product or architecture facts.

## Choose a path

### I want to understand the product

1. [Program lifecycle](product/program-lifecycle.md) explains the golden path from a call for
   proposals to a published agenda.
2. [Interface craft](product/interface-craft.md) is the standard the operator and public interfaces
   are held to, and the checklist a UI change is reviewed against.
3. [Product status and roadmap](../ROADMAP.md) distinguishes working capabilities from production
   depth that is still needed.
4. [Evaluator gap analysis](product/evaluator-gap-analysis.md) maps the complete competition rubric
   to working evidence and missing end-to-end depth.
5. [Product evidence showcase](../showcase/index.html) compares the running demo with the supplied
   competition brief.
6. [Architecture](../ARCHITECTURE.md) explains the three packages, scoped surfaces, operation
   processor, and persistence boundary.

### I want to run or adapt ProgramKit

1. Start with the root [quick start](../README.md#quick-start).
2. Follow [Build and publish a call for proposals](guides/build-and-publish-a-cfp.md) for the first
   end-to-end product workflow.
3. Read [Deployment](../DEPLOYMENT.md) before deploying the Cloudflare application.
4. Use the [HTTP API](api/README.md) for integrations and data sync.
5. Read the [Airtable integration guide](integrations/airtable.md) before enabling the optional team
   workspace.
6. Read the [Cloudflare email guide](integrations/email.md) before enabling confirmations or
   reminders.
7. Read [Live workspace updates](architecture/live-updates.md) before adding WebSockets or durable
   notifications.
8. Read [Hosted demos](architecture/hosted-demos.md) before changing trial routing or retention.
9. Complete [Security](../SECURITY.md) and [Operations](../OPERATIONS.md) before using real data.

### I want to contribute

1. Read [Contributing](../CONTRIBUTING.md) and the [roadmap](../ROADMAP.md).
2. Use the [contribution playbook](agents/contribution-playbook.md) to trace a change through core,
   projections, web, the Cloudflare host, tests, and docs.
3. Run `pnpm check` before handoff or a pull request.

### I am an agent helping a human

Start at [Agent navigation](agents/README.md). Coding agents should also read the root
[`AGENTS.md`](../AGENTS.md), which is deliberately short enough for automatic repository context.

## Sources of truth

| Question                                           | Canonical document or code                                       |
| -------------------------------------------------- | ---------------------------------------------------------------- |
| What is in scope and what is complete?             | [`ROADMAP.md`](../ROADMAP.md)                                    |
| How do we compare with the full evaluator?         | [`evaluator-gap-analysis.md`](product/evaluator-gap-analysis.md) |
| Why are the packages and hosts separated?          | [`ARCHITECTURE.md`](../ARCHITECTURE.md)                          |
| How does the supported Cloudflare deployment work? | [`DEPLOYMENT.md`](../DEPLOYMENT.md)                              |
| How is the repository operated?                    | [`OPERATIONS.md`](../OPERATIONS.md)                              |
| What must change before real data?                 | [`SECURITY.md`](../SECURITY.md)                                  |
| Which operations exist?                            | `packages/core/src/manifest.ts`                                  |
| Which HTTP resources exist?                        | [`docs/api/README.md`](api/README.md)                            |
| What does the domain store?                        | `packages/core/src/types.ts`                                     |
| Which URLs and surfaces exist?                     | `packages/web/src/routes` and `packages/web/README.md`           |
| Which MCP tools and resources exist?               | `packages/agent/README.md`                                       |

When behavior and prose disagree, verify the executable code and tests, then update the canonical
document in the same change. Do not solve drift by adding another summary.
