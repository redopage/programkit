import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(packageRoot, 'plugin/programkit')
const buildRoot = resolve(packageRoot, 'build')
const bundleRoot = resolve(buildRoot, 'programkit')
const sourceConfigPath = resolve(sourceRoot, '.mcp.json')
const bundleConfigPath = resolve(bundleRoot, '.mcp.json')
const expectedBundlePath = join('build', 'programkit')

const configuredUrl = process.env.PROGRAMKIT_MCP_URL?.trim()

if (!configuredUrl) {
  console.error(
    'PROGRAMKIT_MCP_URL is required. From the repository root, run: PROGRAMKIT_MCP_URL=https://programkit.example.com/mcp pnpm --filter @programkit/agent plugin:bundle',
  )
  process.exit(1)
}

let endpoint
try {
  endpoint = new URL(configuredUrl)
} catch {
  console.error('PROGRAMKIT_MCP_URL must be an absolute HTTP or HTTPS URL.')
  process.exit(1)
}

if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
  console.error('PROGRAMKIT_MCP_URL must use HTTP or HTTPS and must not contain credentials.')
  process.exit(1)
}

const config = JSON.parse(await readFile(sourceConfigPath, 'utf8'))
const server = config?.mcpServers?.['programkit']

if (!server || server.type !== 'http' || typeof server.url !== 'string') {
  console.error('The source plugin does not define the expected programkit HTTP MCP server.')
  process.exit(1)
}

if (relative(packageRoot, bundleRoot) !== expectedBundlePath || bundleRoot === sourceRoot) {
  console.error('Refusing to replace a plugin bundle outside the expected package build directory.')
  process.exit(1)
}

await mkdir(buildRoot, { recursive: true })
await rm(bundleRoot, { recursive: true, force: true })
await cp(sourceRoot, bundleRoot, { recursive: true, force: true, preserveTimestamps: true })

server.url = endpoint.toString()
await writeFile(bundleConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')

console.log(`Bundled ProgramKit plugin at ${bundleRoot}`)
console.log(`MCP endpoint: ${server.url}`)
