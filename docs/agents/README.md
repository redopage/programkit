# Agent navigation

ProgramKit is designed for an agent and a human to work from the same operational truth. These
pages help an agent find and apply canonical documentation; they are not a second product manual.

## Start here

For repository work, read in this order:

1. root [`AGENTS.md`](../../AGENTS.md) for invariants, package placement, and required commands;
2. [documentation map](../README.md) for the source of truth relevant to the task;
3. [`ROADMAP.md`](../../ROADMAP.md) before expanding product scope;
4. the README for every package being changed;
5. [contribution playbook](contribution-playbook.md) for cross-layer implementation;
6. [`SECURITY.md`](../../SECURITY.md) for identity, tenancy, public input, files, or deployment work.

For operational help through MCP, use the tool and resource inventory in
[`packages/agent/README.md`](../../packages/agent/README.md) and the bundled skill that matches the
task. The agent surface is intentionally narrower than the operator application.

## Route the request

| Human intent                  | Read first                                    | Expected agent behavior                                                  |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| “Explain how this works”      | Product lifecycle and relevant package README | Inspect and explain; do not mutate                                       |
| “Build or fix this workflow”  | Roadmap, architecture, contribution playbook  | Trace the smallest complete vertical slice and verify it                 |
| “Deploy this”                 | Deployment, operations, security              | State current host support and surface production gaps before deployment |
| “Check readiness or schedule” | Agent package inventory and matching skill    | Read evidence first; draft or propose only within policy                 |
| “Change product scope”        | Roadmap and product lifecycle                 | Make the tradeoff explicit; do not silently broaden the golden path      |

## Collaboration contract

- Lead with the workflow outcome in language the human can verify.
- Inspect current state before proposing or changing it.
- Make reasonable, reversible in-scope assumptions; surface decisions that change product scope,
  authorization, data retention, or host responsibility.
- Use the same named operation path for human and agent mutations.
- Distinguish implemented behavior, seeded demonstration, proposed architecture, and production
  readiness. A visible screen is not evidence that its external services or security are complete.
- Leave approval, sending, publication, secret changes, destructive actions, and production tenant
  access to a verified human unless an explicit, narrower policy says otherwise.
- Report the checks run and any remaining risk. Never imply `pnpm check` covers browser interaction,
  provider delivery, or production authentication.

## Documentation contract

When a change alters behavior:

1. update the canonical code and tests;
2. update the one source-of-truth document named in the [docs map](../README.md);
3. update a task guide only when the way a user completes that task changed;
4. update agent routing only when tool boundaries, safety policy, or repository navigation changed.

Do not paste the same capability list into several README files. Link to the canonical source and
add only the local context a reader needs.
