import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { createAgentPluginBundle } from '../apps/cloudflare/src/agent-plugin.ts'

const repositoryRoot = resolve(import.meta.dirname, '..')
const agentRoot = resolve(repositoryRoot, 'packages/agent')
const bundleRoot = resolve(agentRoot, 'build/programkit')
const marketplacePath = resolve(agentRoot, 'build/.agents/plugins/marketplace.json')

function storedZipFiles(archive: Uint8Array) {
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  let offset = 0
  while (offset + 30 <= archive.byteLength) {
    const view = new DataView(archive.buffer, archive.byteOffset + offset)
    if (view.getUint32(0, true) !== 0x04034b50) break
    const size = view.getUint32(18, true)
    const nameLength = view.getUint16(26, true)
    const extraLength = view.getUint16(28, true)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength))
    files.set(name, decoder.decode(archive.subarray(dataStart, dataStart + size)))
    offset = dataStart + size
  }
  return files
}

describe('Agent Plugin distribution bundle', () => {
  it('is reproducible so the hosted artifact can be cached safely', () => {
    expect(createAgentPluginBundle('https://program.example.com').archive).toEqual(
      createAgentPluginBundle('https://program.example.com').archive,
    )
  })

  it('can be downloaded preconfigured from any ProgramKit deployment', () => {
    const bundle = createAgentPluginBundle(
      'https://program.example.com',
      new Date('2026-08-12T12:00:00.000Z'),
    )
    const files = storedZipFiles(bundle.archive)
    const portable = JSON.parse(files.get('programkit/mcp.json')!) as {
      mcpServers: { programkit: Record<string, unknown> }
    }
    const codex = JSON.parse(files.get('programkit/.mcp.json')!) as {
      mcpServers: { programkit: Record<string, unknown> }
    }

    expect(bundle.endpoint).toBe('https://program.example.com/mcp')
    expect(portable.mcpServers.programkit).toEqual({
      type: 'streamable-http',
      url: 'https://program.example.com/mcp',
    })
    expect(codex.mcpServers.programkit).toEqual({
      type: 'http',
      url: 'https://program.example.com/mcp',
      bearer_token_env_var: 'PROGRAMKIT_API_KEY',
    })
    expect(files.has('programkit/plugin.json')).toBe(true)
    expect(files.has('programkit/skills/manage-program-readiness/SKILL.md')).toBe(true)
    expect(files.get('INSTALL.md')).toContain('not another server to deploy')
    expect(new TextDecoder().decode(bundle.archive)).not.toContain('pk_live_')
  })

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
