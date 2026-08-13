<!-- Canonical: https://programkit.dev/docs/agents/connect -->
<!-- Markdown: https://programkit.dev/docs/agents/connect.md -->

# Connect an agent to ProgramKit

ProgramKit hosts its HTTP API and MCP server with the application. There is no separate agent
backend to deploy.

Choose one client setup:

| Client capability                   | Setup                                                  |
| ----------------------------------- | ------------------------------------------------------ |
| Supports remote MCP                 | Register `https://YOUR_HOST/mcp` directly              |
| Supports Agent Plugins              | Download, unzip, and install `/agent-plugin.zip`       |
| Codex with MCP only                 | Use `codex mcp add`                                    |
| Codex with tools and bundled skills | Install the generated local plugin marketplace         |
| Developing ProgramKit locally       | Use the checked-in plugin pointing to `localhost:4173` |

## 1. Create an event-scoped key

Sign in as an owner or administrator, open **Data & connections**, and choose **Create key**. Give
the key a client-specific name, choose **Agent operations**, prefer a finite expiry, and save the
copy-once secret.

Store it in the agent client's secret manager or environment as:

```bash
PROGRAMKIT_API_KEY=pk_live_...
```

Do not put the value in a plugin file, URL, command argument, repository, prompt, or chat message.

## 2A. Connect MCP directly

For Codex:

```bash
codex mcp add programkit \
  --url https://YOUR_HOST/mcp \
  --bearer-token-env-var PROGRAMKIT_API_KEY
```

For another MCP client, register the same Streamable HTTP URL and configure an Authorization bearer
token from the client's secret storage. Direct MCP provides the tools and resources but not the
portable plugin's procedural skills.

## 2B. Install the Agent Plugin

Download:

```text
https://YOUR_HOST/agent-plugin.zip
```

The archive is generated for that origin. Its `mcp.json` and `.mcp.json` point to
`https://YOUR_HOST/mcp`; the archive contains no API key.

Agent Plugins defines a directory package, so unzip the archive before installing it. Client
distribution and install commands are client-specific.

For Codex, run from the unpacked archive root:

```bash
codex plugin marketplace add .
codex plugin add programkit@programkit
```

Start a new Codex session so the plugin's skills and MCP configuration are loaded together.

## What the plugin adds

The portable package contains:

- Agent Plugins metadata;
- a literal MCP server URL for the installation;
- five operational skills for readiness, schedule preflight and resolution, import reconciliation,
  and optional Airtable comparison;
- shared references; and
- optional Codex presentation metadata and local marketplace files.

It does not contain ProgramKit data, the API key, Cloudflare credentials, or an agent server.

## What the agent can do

The **Agent operations** key permits minimized operational reads, campaign drafting, and schedule
change proposals. The server still prevents the agent from:

- making submission decisions;
- approving or committing change sets;
- approving or sending communications;
- publishing the agenda;
- managing accounts, keys, or provider secrets; or
- performing destructive work.

Human review happens in ProgramKit. These restrictions come from API scopes and core operation
policy, not only from the skill text.

## Move or rename the deployment

The plugin's MCP URL is concrete because Agent Plugins does not define runtime placeholder
expansion or arbitrary-host discovery. After changing the ProgramKit origin, re-download and
reinstall the plugin. Rotating the key does not require a new plugin because the secret remains in
the client.

## Local development

Run `pnpm dev`, then load `packages/agent/plugin/programkit` in a compatible client. The checked-in
package points to `http://localhost:4173/mcp`.

To build a disposable package for another origin:

```bash
PROGRAMKIT_MCP_URL=https://events.example.com/mcp \
  pnpm --filter @programkit/agent plugin:bundle
```

The output is `packages/agent/build/programkit`; source manifests remain unchanged.

## Troubleshooting

Use [Self-host troubleshooting](/docs/self-hosting/troubleshooting.md#mcp-client-cannot-connect) for
credentials, origin changes, and ZIP installation. Use the
[`@programkit/agent` protocol reference](https://forge.smol.ai/andheller/programkit/src/branch/main/packages/agent/README.md#troubleshooting) for header,
version, and JSON-RPC errors.

The packaging and authentication design is documented in
[Agent Plugins and MCP](/docs/integrations/agent-plugins.md).

For first tasks after connecting, use the prompts and expected human checkpoints in
[Agent recipes](/docs/agents/recipes.md).
