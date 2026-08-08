import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'

const pluginRoot = resolve('packages/agent/plugin/program-ops')
const errors = []

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`)
    return undefined
  }
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') errors.push(`${label} must be a string.`)
}

const manifest = await readJson(resolve(pluginRoot, '.codex-plugin/plugin.json'))
if (manifest) {
  requireString(manifest.name, 'plugin.name')
  requireString(manifest.version, 'plugin.version')
  requireString(manifest.description, 'plugin.description')
  requireString(manifest.license, 'plugin.license')
  requireString(manifest.skills, 'plugin.skills')
  requireString(manifest.mcpServers, 'plugin.mcpServers')
  requireString(manifest.interface?.displayName, 'plugin.interface.displayName')
  requireString(manifest.interface?.shortDescription, 'plugin.interface.shortDescription')
}

const mcpConfig = await readJson(resolve(pluginRoot, '.mcp.json'))
const mcpServer = mcpConfig?.mcpServers?.['program-ops']
if (!mcpServer || mcpServer.type !== 'http')
  errors.push('program-ops must define an HTTP MCP server.')
try {
  if (mcpServer) new URL(mcpServer.url)
} catch {
  errors.push('program-ops MCP URL must be valid.')
}

const skillsRoot = resolve(pluginRoot, 'skills')
for (const directory of await readdir(skillsRoot)) {
  const skillRoot = resolve(skillsRoot, directory)
  if (!(await stat(skillRoot)).isDirectory()) continue
  const skillPath = resolve(skillRoot, 'SKILL.md')
  const source = await readFile(skillPath, 'utf8')
  const frontmatter = source.match(/^---\n([\s\S]*?)\n---/u)?.[1] ?? ''
  const name = frontmatter.match(/^name:\s*(.+)$/mu)?.[1]?.trim()
  const description = frontmatter.match(/^description:\s*(.+)$/mu)?.[1]?.trim()
  if (name !== directory) errors.push(`${skillPath}: name must match its directory.`)
  requireString(description, `${skillPath} description`)
  if (/\b(?:TODO|TBD)\b/u.test(source)) errors.push(`${skillPath}: unresolved placeholder found.`)

  for (const match of source.matchAll(/\]\((references\/[^)]+)\)/gu)) {
    try {
      await stat(resolve(skillRoot, match[1]))
    } catch {
      errors.push(`${skillPath}: missing ${match[1]}.`)
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log('Plugin and bundled skills are valid.')
}
