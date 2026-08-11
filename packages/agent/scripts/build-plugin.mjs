import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceRoot = resolve(packageRoot, 'plugin/programkit')
const buildRoot = resolve(packageRoot, 'build')
const bundleRoot = resolve(buildRoot, 'programkit')
const marketplacePath = resolve(buildRoot, '.agents/plugins/marketplace.json')
const configFiles = ['.mcp.json', 'mcp.json']
const expectedBundlePath = join('build', 'programkit')

const configuredUrl = process.env.PROGRAMKIT_MCP_URL?.trim()
const bearerTokenEnvVar =
  process.env.PROGRAMKIT_MCP_BEARER_TOKEN_ENV_VAR?.trim() || 'PROGRAMKIT_API_KEY'

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

if (!/^[A-Z_][A-Z0-9_]*$/u.test(bearerTokenEnvVar)) {
  console.error(
    'PROGRAMKIT_MCP_BEARER_TOKEN_ENV_VAR must be an uppercase environment variable name.',
  )
  process.exit(1)
}

if (relative(packageRoot, bundleRoot) !== expectedBundlePath || bundleRoot === sourceRoot) {
  console.error('Refusing to replace a plugin bundle outside the expected package build directory.')
  process.exit(1)
}

await mkdir(buildRoot, { recursive: true })
await rm(bundleRoot, { recursive: true, force: true })
await cp(sourceRoot, bundleRoot, { recursive: true, force: true, preserveTimestamps: true })

for (const filename of configFiles) {
  const sourceConfigPath = resolve(sourceRoot, filename)
  const bundleConfigPath = resolve(bundleRoot, filename)
  const config = JSON.parse(await readFile(sourceConfigPath, 'utf8'))
  const server = config?.mcpServers?.['programkit']
  const expectedType = filename === 'mcp.json' ? 'streamable-http' : 'http'

  if (!server || server.type !== expectedType || typeof server.url !== 'string') {
    console.error(
      `The source plugin does not define the expected programkit ${expectedType} MCP server in ${filename}.`,
    )
    process.exit(1)
  }

  server.url = endpoint.toString()
  if (filename === '.mcp.json') server.bearer_token_env_var = bearerTokenEnvVar
  await writeFile(bundleConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
}

await mkdir(dirname(marketplacePath), { recursive: true })
await writeFile(
  marketplacePath,
  `${JSON.stringify(
    {
      name: 'programkit',
      interface: { displayName: 'ProgramKit' },
      plugins: [
        {
          name: 'programkit',
          source: { source: 'local', path: './programkit' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
          category: 'Productivity',
        },
      ],
    },
    null,
    2,
  )}\n`,
  'utf8',
)

console.log(`Bundled ProgramKit plugin at ${bundleRoot}`)
console.log(`Codex marketplace at ${buildRoot}`)
console.log(`MCP endpoint: ${endpoint.toString()}`)
console.log(`Codex bearer token environment variable: ${bearerTokenEnvVar}`)
