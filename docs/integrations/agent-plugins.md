# Agent Plugins

ProgramKit ships one portable [Agent Plugins 1.0](https://agent-plugins.org/) package at
`packages/agent/plugin/programkit`. It combines ProgramKit's operational skills with its MCP server
configuration without tying those shared components to one agent client.

```text
programkit/
├── plugin.json                 portable Agent Plugins manifest
├── mcp.json                    portable Streamable HTTP MCP configuration
├── skills/                     shared Agent Skills
├── .codex-plugin/plugin.json   optional Codex presentation metadata
└── .mcp.json                   Codex-compatible MCP configuration
```

The portable files are the cross-client contract. The dotfiles are a client extension and reuse
the same skill directories and MCP endpoint. There is no second implementation to keep in sync.

## Local use

Run ProgramKit locally, then load `packages/agent/plugin/programkit` in an Agent Plugins-compatible
client. Both MCP configurations point to `http://localhost:4173/mcp` in source control.

## Build a hosted bundle

Generate a disposable distribution directory instead of editing checked-in endpoints:

```bash
PROGRAMKIT_MCP_URL=https://your-programkit.example/mcp \
  pnpm --filter @programkit/agent plugin:bundle
```

The output is `packages/agent/build/programkit`. The build updates both `mcp.json` and `.mcp.json`
and leaves the source package unchanged.

## Authentication

Agent Plugins 1.0 intentionally leaves OAuth discovery, consent, credentials, and storage to the
agent client. Never add a bearer token to `mcp.json`; configured headers are package data, not a
secret mechanism.

For hosted ProgramKit, an agent client must authenticate to `/mcp` with a client-managed ProgramKit
credential. A signed-in owner session works in the same browser, while server-to-server clients
should use a scoped ProgramKit API key supplied by the client. ProgramKit binds that credential to
one event before the MCP handler can read or propose changes.

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

The agent can inspect operational state, draft communications, and propose schedule changes. It
cannot approve change sets, send communications, publish an agenda, manage secrets, or perform
destructive actions. Those boundaries are enforced by the core operation manifest, not only by
skill instructions.
