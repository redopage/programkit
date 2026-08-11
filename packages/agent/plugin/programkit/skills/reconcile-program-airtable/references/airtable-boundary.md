# Airtable boundary

- The supported ProgramKit V1 default is one SQLite-backed Durable Object per event.
- Airtable is optional. A separately installed Airtable connector owns its own authorization.
- Agent Plugins 1.0 does not define plugin dependencies or portable OAuth configuration.
- Never place Airtable tokens, ProgramKit API keys, or other credentials in `plugin.json`,
  `mcp.json`, skill files, prompts, or chat output.
- Use ProgramKit event IDs and stable record IDs as the reconciliation boundary. Email can identify
  a candidate person, but display name, row position, and attachment filename cannot prove identity.
- ProgramKit's experimental Airtable-backed mode is not the recommended production default. It
  lacks atomic multi-table writes and a complete durable retry and conflict journal.
- Default to a read-only audit. If a human authorizes writes, name the direction, fields, records,
  and expected result before changing either system.
