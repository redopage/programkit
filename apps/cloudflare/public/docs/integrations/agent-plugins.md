<!-- Canonical: https://programkit.dev/docs/integrations/agent-plugins -->
<!-- Markdown: https://programkit.dev/docs/integrations/agent-plugins.md -->

# Agent Plugins

ProgramKit ships one portable [Agent Plugins 1.0](https://agent-plugins.org/) package at
`packages/agent/plugin/programkit`. It combines ProgramKit's operational skills with its MCP server
configuration without tying those shared components to one agent client.

```text
programkit/
├── assets/                     shared ProgramKit mark
├── plugin.json                 portable Agent Plugins manifest
├── mcp.json                    portable Streamable HTTP MCP configuration
├── skills/                     shared Agent Skills
├── .codex-plugin/plugin.json   optional Codex presentation metadata
└── .mcp.json                   Codex-compatible MCP configuration
```

The portable files are the cross-client contract. The dotfiles are a client extension and reuse
the same skill directories and MCP endpoint. There is no second implementation to keep in sync.

An Agent Plugin is installed in the agent client; it is not deployed as another ProgramKit
service. Agent Plugins 1.0 requires a concrete absolute URL in `mcp.json` and does not define
runtime placeholder expansion, server discovery, OAuth, or credential storage. A portable plugin
therefore cannot search for an arbitrary ProgramKit host at runtime. ProgramKit solves this by
generating the bundle for the origin that serves it.

## Local use

Run ProgramKit locally, then load `packages/agent/plugin/programkit` in an Agent Plugins-compatible
client. Both MCP configurations point to `http://localhost:4173/mcp` in source control.

## Download from a self-host

Open **Data & connections** and choose **Download agent plugin**, or download
`GET /agent-plugin.zip` directly. The public, cacheable endpoint creates a bundle whose `mcp.json`
and `.mcp.json` both point to the current origin's `/mcp`. It contains no API key or event data.

Agent Plugins defines a directory package rather than a distribution protocol. ProgramKit uses ZIP
as a convenient transport: unzip it before installing it in the client. MCP-native clients can skip
the package and register `/mcp` directly.

Unzip it, save an **Agent operations** key as `PROGRAMKIT_API_KEY` in the client environment, then
install the `programkit` directory in an Agent Plugins-compatible client. For Codex, run from the
unzipped directory:

```bash
codex plugin marketplace add .
codex plugin add programkit@programkit
```

Re-download and reinstall after moving the deployment to another origin. Rotating the API key does
not require rebuilding the plugin because the secret remains client-managed.

## Build a hosted bundle from source

Generate a disposable distribution directory instead of editing checked-in endpoints:

```bash
PROGRAMKIT_MCP_URL=https://your-programkit.example/mcp \
  pnpm --filter @programkit/agent plugin:bundle
```

The output is `packages/agent/build/programkit`. The build updates both `mcp.json` and `.mcp.json`
and leaves the source package unchanged. The generated Codex extension reads its bearer token from
`PROGRAMKIT_API_KEY` by default. A self-host can choose another environment variable name:

```bash
PROGRAMKIT_MCP_URL=https://events.example.com/mcp \
PROGRAMKIT_MCP_BEARER_TOKEN_ENV_VAR=MY_PROGRAMKIT_KEY \
  pnpm --filter @programkit/agent plugin:bundle
```

The build also creates a local Codex marketplace. Install the complete bundle, including its five
ProgramKit skills, with:

```bash
codex plugin marketplace add ./packages/agent/build
codex plugin add programkit@programkit
```

Start a new Codex session after installation. If the deployment origin changes, rebuild the bundle,
refresh the `programkit` marketplace, and reinstall the plugin from the Plugins Directory.

## Authentication

Agent Plugins 1.0 intentionally leaves OAuth discovery, consent, credentials, and storage to the
agent client. Never add a bearer token to `mcp.json`; configured headers are package data, not a
secret mechanism.

For hosted ProgramKit, an agent client must authenticate to `/mcp` with a client-managed ProgramKit
credential. A signed-in owner session works in the same browser, while server-to-server clients
should use a scoped ProgramKit API key supplied by the client. ProgramKit binds that credential to
one event before the MCP handler can read or propose changes.

In the hosted app, open **Data & connections**, create a key with **Agent operations** access,
and save the copy-once secret as `PROGRAMKIT_API_KEY` in the agent client's environment. The plugin
bundle reads that variable without writing the secret into its files. To connect only the MCP server
without installing the bundled skills, register any ProgramKit deployment directly with:

```bash
codex mcp add programkit \
  --url https://YOUR_PROGRAMKIT_HOST/mcp \
  --bearer-token-env-var PROGRAMKIT_API_KEY
```

The endpoint is not tied to `app.programkit.dev`. A self-host uses its own origin and the same
event-scoped key flow. Do not put the key in the plugin directory, command arguments, URL, or source
control.

ProgramKit API keys are an operator-managed server-to-server credential: the secret has 256 bits of
randomness, is displayed once, and is stored only as a SHA-256 hash. The event and key identifiers
select the Event Access object, which checks expiry, revocation, and the hash before deriving scopes.
Use a short expiry, one key per client, the **Agent operations** preset, and revoke the old key after
rotation. OAuth remains necessary for delegated third-party installations that must obtain access
across many customer accounts without an owner manually provisioning each key.

## Airtable

Airtable is a companion integration, not a required ProgramKit plugin dependency:

1. install ProgramKit in the agent client;
2. optionally install and authorize an Airtable connector in the same client;
3. invoke `reconcile-program-airtable` to compare a named base with the active ProgramKit event;
4. review the field-level plan before authorizing any write.

This is intentionally read-first. It keeps Airtable credentials in the Airtable connection, keeps
ProgramKit credentials in the ProgramKit connection, and does not make either service silently
impersonate the other.

## Safety boundary

The agent can inspect operational state—including submission pipeline summaries and unscheduled
sessions—draft communications, and propose initial placements or schedule moves. Submission reads
omit full proposal bodies, reviewer comments, and contact details by default. The agent cannot make
submission decisions, approve or commit change sets, send communications, publish an agenda,
manage secrets, or perform destructive actions. Those boundaries are enforced by scoped API keys
and the core operation manifest, not only by skill instructions.

For the shortest client-oriented walkthrough, use [Connect an agent](/docs/agents/connect.md).
