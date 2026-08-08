# `@crm-library/agent`

The agent package exposes CRM Library through a stateless HTTP MCP server and includes the Program
Ops Codex plugin. The server can read operational records, create campaign drafts, and propose
schedule moves. Core permissions still make approval, commit, send, publish, secret management, and
destructive operations human-only.

## Protocol compatibility

This package implements the stateless JSON request/response path of the
[MCP 2026-07-28 specification](https://modelcontextprotocol.io/specification/2026-07-28) over one
HTTP `POST /mcp` endpoint. Every request is independent and carries its protocol version and client
capabilities. The server returns `application/json`; it does not provide SSE streams.

Only `2026-07-28` is supported. Legacy `initialize` sessions, earlier protocol revisions, batch
requests, notifications, prompts, and subscriptions are intentionally not implemented. Start with
`server/discover`, or call a supported method directly and handle an unsupported-version error.

Supported methods are:

- `server/discover`
- `tools/list` and `tools/call`
- `resources/list` and `resources/read`

Every request must have a non-null string or integer JSON-RPC ID, an object-valued `params`, and:

- `MCP-Protocol-Version: 2026-07-28`, matching
  `params._meta["io.modelcontextprotocol/protocolVersion"]`
- `Mcp-Method`, exactly matching the JSON-RPC method
- `Mcp-Name` for `tools/call` and `resources/read`, exactly matching `params.name` or `params.uri`
- an object at `params._meta["io.modelcontextprotocol/clientCapabilities"]`

For the bundled ASCII tool names and resource URIs, `Mcp-Name` can be sent as plain text. Clients
must use the 2026-07-28 Base64 sentinel form when a routing value cannot be represented safely in an
HTTP header. See the official
[Streamable HTTP request metadata](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http#request-metadata).

Example discovery request:

```bash
curl http://localhost:4173/mcp \
  --request POST \
  --header 'Content-Type: application/json' \
  --header 'Accept: application/json, text/event-stream' \
  --header 'MCP-Protocol-Version: 2026-07-28' \
  --header 'Mcp-Method: server/discover' \
  --data '{
    "jsonrpc": "2.0",
    "id": "discover-1",
    "method": "server/discover",
    "params": {
      "_meta": {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientInfo": {
          "name": "example-client",
          "version": "1.0.0"
        },
        "io.modelcontextprotocol/clientCapabilities": {}
      }
    }
  }'
```

Every successful result includes server identity metadata:

```json
{
  "_meta": {
    "io.modelcontextprotocol/serverInfo": {
      "name": "program-ops",
      "version": "0.1.0"
    }
  }
}
```

## Tool inventory

| Tool                        | Effect                                                            | Boundary                                |
| --------------------------- | ----------------------------------------------------------------- | --------------------------------------- |
| `get_event_context`         | Read the active event, summary, and agent policy                  | Read-only                               |
| `search_people`             | Search people with participation and readiness context            | Read-only                               |
| `get_readiness_report`      | Read requirement definitions, deadlines, rows, and blocker totals | Read-only                               |
| `get_schedule`              | Read current draft placements and the latest published release    | Read-only                               |
| `validate_schedule`         | Detect hard conflicts and warnings                                | Read-only                               |
| `get_change_set`            | Read one proposal and its review state                            | Read-only                               |
| `list_change_sets`          | List and optionally filter proposals by status                    | Read-only                               |
| `preflight_program_publish` | Check publication blockers and warnings without publishing        | Read-only                               |
| `draft_campaign`            | Create a draft for one supported live audience                    | Draft only; cannot approve or send      |
| `propose_schedule_move`     | Create one change set containing one placement move               | Proposal only; cannot commit or publish |

`draft_campaign` supports `all_active`, `unconfirmed`, and `missing_requirements`. It does not accept
an arbitrary recipient list. Each `propose_schedule_move` call is independent and creates a
separate human-reviewable change set; there is no grouped schedule-proposal or agent commit tool.

The plugin's CRM-import skill produces a row-level reconciliation preview only. The MCP server does
not expose import create, update, change-set, or commit tools.

## Resource inventory

| URI                              | Contents                                                    |
| -------------------------------- | ----------------------------------------------------------- |
| `ops://workspace/manifest`       | Typed core operation manifest and agent policies            |
| `ops://events/current/summary`   | Active event and readiness summary                          |
| `ops://events/current/readiness` | Requirement-level readiness rows and totals                 |
| `ops://events/current/schedule`  | Published agenda projection plus current schedule conflicts |
| `ops://events/current/preflight` | Current publication preflight result                        |

Use `get_schedule` when an agent needs editable draft placements; the schedule resource is a
read-only agenda/status projection.

## Server integration

The package exports `handleMcpRequest`, `mcpTools`, and `McpContext`:

```ts
import { handleMcpRequest } from '@crm-library/agent'
import { executeOperation, MemoryWorkspaceRepository } from '@crm-library/core'

const repository = new MemoryWorkspaceRepository()

const response = await handleMcpRequest(request, {
  readState: () => repository.read(),
  execute: (operation, operationRequest) =>
    repository.mutate((state) => {
      const execution = executeOperation(state, operation, operationRequest)
      return { state: execution.state, result: execution.response }
    }),
})
```

The reference Cloudflare Worker in the repository routes `POST /mcp` to this handler and supplies a
Durable Object-backed context. Other hosts can provide the same two context functions with their
own repository and command adapter.

## MCP client and Codex plugin setup

For local development, run `pnpm dev` at the repository root. The checked-in plugin source at
`plugin/program-ops` already points to `http://localhost:4173/mcp`. A generic MCP client can register
the same endpoint directly:

```json
{
  "mcpServers": {
    "program-ops": {
      "type": "http",
      "url": "http://localhost:4173/mcp"
    }
  }
}
```

Do not edit the checked-in `.mcp.json` to distribute a deployed plugin. Build a copy with the target
URL instead:

```bash
# From the repository root
CRM_MCP_URL=https://crm.example.com/mcp \
  pnpm --filter @crm-library/agent plugin:bundle

# Or, from packages/agent (or an unpacked agent package)
CRM_MCP_URL=https://crm.example.com/mcp pnpm plugin:bundle
```

The script validates the URL, safely replaces only the generated `<agent-package>/build/program-ops`
directory (`packages/agent/build/program-ops` in this monorepo), and changes only the copied
`.mcp.json`. The source plugin remains unchanged. Credentials are rejected in `CRM_MCP_URL`; use an
authorization header or client OAuth flow instead of embedding a secret in the URL.

Use either `packages/agent/plugin/program-ops` for localhost development or the generated directory
as the plugin source in a Codex marketplace. Install `program-ops` from that marketplace, then start
a new Codex task so the four bundled skills and MCP tool catalog are loaded together. The same
generated `.mcp.json` can be registered directly by another compatible MCP client.

## Authentication boundary

The repository's reference Worker is a passwordless demo. Its `/mcp` route is not authenticated,
the agent identity is fixed, and `x-crm-workspace-key` selects demo storage rather than authorizing
access. Same-origin validation and agent tool restrictions are defense in depth, not user
authentication. Do not expose the reference endpoint to real customer data.

A production host must authenticate MCP with OAuth or an equivalent gateway, bind the workspace to
verified claims, derive the actor and scopes server-side, rate-limit calls, and ignore caller-supplied
identity or workspace selectors. Keep provider secrets outside workspace state. The host must also
preserve the core rule that agents can draft and propose but cannot approve, commit, send, publish,
or manage secrets.

## Troubleshooting

- **HTTP 405**: send each JSON-RPC request as its own `POST`.
- **HTTP 403 / origin rejected**: use the same host as the MCP endpoint or a server-to-server client
  without a browser `Origin`; do not disable origin validation.
- **`-32020` header mismatch**: make the protocol version, method, and optional name headers exactly
  match their JSON-RPC fields.
- **`-32021` client capabilities missing**: include an object at
  `params._meta["io.modelcontextprotocol/clientCapabilities"]`, even when it is empty.
- **`-32022` unsupported version**: use `2026-07-28`; this server has no legacy fallback.
- **`-32600` invalid request**: provide `params` as an object and use a non-null string or integer ID.
- **`-32601` for `initialize`**: configure a current MCP client; legacy initialization is not
  implemented.
- **Tool result has `isError: true`**: inspect the structured error for invalid input, stale entity
  versions, missing records, or a server-enforced policy denial.
- **Plugin still calls localhost**: rebuild with `CRM_MCP_URL`, then register the generated
  `packages/agent/build/program-ops` directory rather than the checked-in source.
- **Production 401 or 403**: inspect the deployment's OAuth gateway, claim-to-workspace mapping, and
  least-privilege scope mapping; those controls are deliberately outside the demo package.
