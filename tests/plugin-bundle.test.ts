import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const repositoryRoot = resolve(import.meta.dirname, '..')
const agentRoot = resolve(repositoryRoot, 'packages/agent')
const bundleRoot = resolve(agentRoot, 'build/programkit')
const marketplacePath = resolve(agentRoot, 'build/.agents/plugins/marketplace.json')

describe('Agent Plugin distribution bundle', () => {
  it('uses the deployment URL without embedding credentials', async () => {
    execFileSync(process.execPath, [resolve(agentRoot, 'scripts/build-plugin.mjs')], {
      cwd: repositoryRoot,
      env: {
        ...process.env,
        PROGRAMKIT_MCP_URL: 'https://events.example.com/mcp',
        PROGRAMKIT_MCP_BEARER_TOKEN_ENV_VAR: 'MY_PROGRAMKIT_KEY',
      },
      stdio: 'pipe',
    })

    const portable = JSON.parse(await readFile(resolve(bundleRoot, 'mcp.json'), 'utf8')) as {
      mcpServers: { programkit: Record<string, unknown> }
    }
    const codex = JSON.parse(await readFile(resolve(bundleRoot, '.mcp.json'), 'utf8')) as {
      mcpServers: { programkit: Record<string, unknown> }
    }
    const marketplace = JSON.parse(await readFile(marketplacePath, 'utf8')) as {
      plugins: Array<Record<string, unknown>>
    }

    expect(portable.mcpServers.programkit).toMatchObject({
      type: 'streamable-http',
      url: 'https://events.example.com/mcp',
    })
    expect(portable.mcpServers.programkit).not.toHaveProperty('bearer_token_env_var')
    expect(codex.mcpServers.programkit).toEqual({
      type: 'http',
      url: 'https://events.example.com/mcp',
      bearer_token_env_var: 'MY_PROGRAMKIT_KEY',
    })
    expect(marketplace.plugins).toEqual([
      {
        name: 'programkit',
        source: { source: 'local', path: './programkit' },
        policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        category: 'Productivity',
      },
    ])
  })
})
