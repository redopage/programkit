import { spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'

import {
  cleanCloudflareName,
  cleanDomain,
  createSelfHostConfig,
  hasCloudflareDeployments,
  isMissingCloudflareWorker,
  parseWranglerDeployOutput,
} from './lib/self-host-config.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const generatedDirectory = process.env.PROGRAMKIT_SELFHOST_DIRECTORY ?? '.programkit'
if (!/^\.programkit(?:-[a-z0-9-]+)?$/u.test(generatedDirectory)) {
  throw new Error('PROGRAMKIT_SELFHOST_DIRECTORY must be .programkit or a .programkit-* directory.')
}
const generatedRoot = resolve(repositoryRoot, generatedDirectory)
const configPath = resolve(generatedRoot, 'wrangler.json')
const metadataPath = resolve(generatedRoot, 'self-host.json')
const bootstrapTokenPath = resolve(generatedRoot, 'bootstrap-token')
const deploymentReceiptPath = resolve(generatedRoot, 'deployment-receipt.json')
const deploySecretsPath = resolve(generatedRoot, '.deploy-secrets.json')
const wranglerOutputPath = resolve(generatedRoot, '.wrangler-output.ndjson')
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const pinnedPackageManager = 'pnpm@11.20.0'

const help = `ProgramKit Cloudflare self-host setup

Usage:
  npm run selfhost
  npm run selfhost:setup
  npm run selfhost:setup -- --name NAME --bucket BUCKET [--domain HOSTNAME]
  npm run selfhost:deploy

Options:
  --name NAME       Cloudflare Worker name
  --bucket BUCKET   R2 bucket for private uploads
  --domain HOSTNAME Optional custom domain; omit to use workers.dev
  --account ACCOUNT Cloudflare account name or ID; prompted when more than one is available
  --reuse-worker    Explicitly deploy over an existing Worker name
  --reuse-bucket    Explicitly use an existing R2 bucket
  --no-provision    Generate local configuration without contacting Cloudflare
  --help            Show this help
`

function flag(name) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? null : (process.argv[index + 1] ?? '')
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: 'utf8',
    stdio: options.inherit ? 'inherit' : 'pipe',
    input: options.input,
    env: options.env ?? process.env,
  })
  if (result.status !== 0 && !options.allowFailure) {
    const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(detail || `${command} exited with status ${result.status}.`)
  }
  return result
}

function runPnpm(args, options) {
  return run(npx, ['--yes', pinnedPackageManager, ...args], options)
}

function wrangler(args, options) {
  return runPnpm(['--filter', '@programkit/app-cloudflare', 'exec', 'wrangler', ...args], options)
}

function accountEnvironment(accountId) {
  return { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId }
}

function parseCloudflareAccounts(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed.accounts)
      ? parsed.accounts.filter(
          (account) =>
            account &&
            typeof account.id === 'string' &&
            /^[a-f0-9]{32}$/u.test(account.id) &&
            typeof account.name === 'string',
        )
      : []
  } catch {
    return []
  }
}

async function chooseCloudflareAccount(existing) {
  const identity = runPnpm([
    '--filter',
    '@programkit/app-cloudflare',
    'exec',
    'wrangler',
    'whoami',
    '--json',
  ])
  const accounts = parseCloudflareAccounts(identity.stdout)
  if (accounts.length === 0) throw new Error('No accessible Cloudflare account was found.')

  const requested =
    flag('account') ??
    existing?.accountId ??
    process.env.CLOUDFLARE_ACCOUNT_ID ??
    (accounts.length === 1
      ? accounts[0].id
      : await ask(`Cloudflare account (${accounts.map((account) => account.name).join(', ')})`))
  const normalized = String(requested ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
  const selected = accounts.find(
    (account) =>
      account.id.toLocaleLowerCase('en-US') === normalized ||
      account.name.toLocaleLowerCase('en-US') === normalized,
  )
  if (selected) return selected

  if (!normalized && accounts.length > 1) {
    throw new Error(
      `Choose a Cloudflare account with --account. Available accounts: ${accounts
        .map((account) => `${account.name} (${account.id})`)
        .join(', ')}.`,
    )
  }
  throw new Error(`Cloudflare account "${requested}" was not found in the current login.`)
}

async function readExistingSetup() {
  try {
    return JSON.parse(await readFile(metadataPath, 'utf8'))
  } catch {
    return null
  }
}

async function bootstrapToken() {
  try {
    const existing = (await readFile(bootstrapTokenPath, 'utf8')).trim()
    if (existing.length >= 16) return existing
  } catch {
    // A new installation gets a new setup code below.
  }
  return randomBytes(24).toString('base64url')
}

async function ask(question, fallback = '') {
  if (!process.stdin.isTTY) return fallback
  const input = createInterface({ input: process.stdin, output: process.stdout })
  const answer = (await input.question(`${question}${fallback ? ` (${fallback})` : ''}: `)).trim()
  input.close()
  return answer || fallback
}

async function setup() {
  const existing = await readExistingSetup()
  const account = hasFlag('no-provision') ? null : await chooseCloudflareAccount(existing)
  const requestedName =
    flag('name') ?? existing?.workerName ?? (await ask('Cloudflare Worker name', 'programkit'))
  const workerName = cleanCloudflareName(requestedName, 'Worker name')
  const requestedBucket =
    flag('bucket') ?? existing?.bucketName ?? (await ask('R2 bucket name', `${workerName}-assets`))
  const bucketName = cleanCloudflareName(requestedBucket, 'R2 bucket name')
  const requestedDomain =
    flag('domain') ??
    existing?.domain ??
    (await ask('Custom domain, or leave blank for workers.dev'))
  const domain = cleanDomain(requestedDomain)
  const noProvision = hasFlag('no-provision')
  const ownsCurrentAccount =
    existing?.cloudflareVerified === true && (noProvision || existing.accountId === account?.id)
  const ownsWorker = ownsCurrentAccount && existing.workerName === workerName
  const ownsBucket = ownsCurrentAccount && existing.bucketName === bucketName

  if (!noProvision) {
    const cloudflareEnvironment = accountEnvironment(account.id)

    if (!ownsWorker && !hasFlag('reuse-worker')) {
      const deployments = wrangler(['deployments', 'list', '--name', workerName, '--json'], {
        allowFailure: true,
        env: cloudflareEnvironment,
      })
      const deploymentDetail = `${deployments.stdout ?? ''}${deployments.stderr ?? ''}`
      if (deployments.status !== 0 && !isMissingCloudflareWorker(deploymentDetail)) {
        throw new Error(
          `Could not verify whether Worker "${workerName}" already exists. Cloudflare returned:\n${deploymentDetail.trim()}`,
        )
      }
      if (hasCloudflareDeployments(deployments.stdout)) {
        throw new Error(
          `Worker "${workerName}" already exists. Choose another with --name ${workerName}-events, or pass --reuse-worker if this ProgramKit install should replace it.`,
        )
      }
    }

    const listed = wrangler(['r2', 'bucket', 'list'], {
      allowFailure: true,
      env: cloudflareEnvironment,
    })
    if (listed.status !== 0) {
      const detail = `${listed.stdout ?? ''}${listed.stderr ?? ''}`.trim()
      if (/10042|enable R2/iu.test(detail)) {
        throw new Error(
          `R2 is not enabled for ${account.name}. Enable it at https://dash.cloudflare.com/${account.id}/r2/overview, then rerun this command. Cloudflare includes a free allowance but may require a billing method before activation.`,
        )
      }
      throw new Error(
        `Could not inspect R2 buckets for ${account.name}. Cloudflare returned:\n${detail}`,
      )
    }
    const escapedBucket = bucketName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const bucketExists = new RegExp(`(^|\\s)${escapedBucket}(\\s|$)`, 'mu').test(listed.stdout)
    if (bucketExists && !ownsBucket && !hasFlag('reuse-bucket')) {
      throw new Error(
        `R2 bucket "${bucketName}" already exists. Choose another with --bucket ${bucketName}-files, or pass --reuse-bucket if this ProgramKit install should use it.`,
      )
    }
    if (!bucketExists) {
      wrangler(['r2', 'bucket', 'create', bucketName, '--update-config=false'], {
        inherit: true,
        env: cloudflareEnvironment,
      })
    }
  }

  const config = createSelfHostConfig({
    workerName,
    bucketName,
    domain,
    accountId: account?.id ?? existing?.accountId ?? null,
  })
  await mkdir(generatedRoot, { recursive: true })
  const setupCode = await bootstrapToken()
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await writeFile(bootstrapTokenPath, `${setupCode}\n`, { encoding: 'utf8', mode: 0o600 })
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        workerName,
        bucketName,
        domain,
        accountId: account?.id ?? existing?.accountId ?? null,
        accountName: account?.name ?? existing?.accountName ?? null,
        cloudflareVerified: noProvision ? ownsWorker && ownsBucket : true,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`\nSelf-host configuration written to ${configPath}`)
  console.log('Password sign-in, multi-event workspaces, R2 files, API keys, and MCP are enabled.')
  console.log('Email and Airtable remain optional.')
  console.log('A private first-owner setup code was generated and will be installed on deploy.')
  console.log('\nNext: npm run selfhost:deploy')
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))
}

async function waitForDeployment(origin) {
  let lastError = 'The deployment did not answer its health check.'
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const health = await fetch(new URL('/healthz', origin), {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(3_000),
      })
      if (!health.ok) throw new Error(`Health returned ${health.status}.`)
      const healthBody = await health.json()
      if (healthBody?.ok !== true || healthBody?.status !== 'ready') {
        throw new Error('Health did not report ready.')
      }

      const plugin = await fetch(new URL('/agent-plugin.zip', origin), {
        method: 'HEAD',
        signal: AbortSignal.timeout(3_000),
      })
      if (!plugin.ok || plugin.headers.get('content-type') !== 'application/zip') {
        throw new Error(`Plugin download returned ${plugin.status}.`)
      }
      return { ok: true, checkedAt: new Date().toISOString() }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      if (attempt < 6) await delay(1_000)
    }
  }
  return { ok: false, checkedAt: new Date().toISOString(), error: lastError }
}

function deployedOrigin(existing, deployment) {
  if (existing.domain) return `https://${existing.domain}`
  const target = deployment?.targets.find((candidate) => {
    try {
      return new URL(candidate).hostname.endsWith('.workers.dev')
    } catch {
      return false
    }
  })
  return target ? new URL(target).origin : null
}

async function deploy() {
  try {
    await readFile(configPath, 'utf8')
  } catch {
    throw new Error('Run npm run selfhost:setup before deploying.')
  }
  const existing = await readExistingSetup()
  if (existing?.cloudflareVerified !== true) {
    throw new Error(
      'This configuration has not passed the Cloudflare resource checks. Run npm run selfhost:setup without --no-provision before deploying.',
    )
  }
  runPnpm(['build'], { inherit: true })
  const setupCode = (await readFile(bootstrapTokenPath, 'utf8')).trim()
  if (setupCode.length < 16) {
    throw new Error('The first-owner setup code is missing. Run npm run selfhost:setup again.')
  }
  const cloudflareEnvironment = existing.accountId
    ? accountEnvironment(existing.accountId)
    : process.env
  await writeFile(
    deploySecretsPath,
    `${JSON.stringify({ PROGRAMKIT_BOOTSTRAP_TOKEN: setupCode })}\n`,
    { encoding: 'utf8', mode: 0o600 },
  )
  await rm(wranglerOutputPath, { force: true })
  try {
    wrangler(['deploy', '--config', configPath, '--strict', '--secrets-file', deploySecretsPath], {
      inherit: true,
      env: { ...cloudflareEnvironment, WRANGLER_OUTPUT_FILE: wranglerOutputPath },
    })
  } finally {
    await rm(deploySecretsPath, { force: true })
  }

  const deployment = parseWranglerDeployOutput(
    await readFile(wranglerOutputPath, 'utf8').catch(() => ''),
  )
  await rm(wranglerOutputPath, { force: true })
  const origin = deployedOrigin(existing, deployment)
  const verification = origin
    ? await waitForDeployment(origin)
    : {
        ok: false,
        checkedAt: new Date().toISOString(),
        error: 'Wrangler did not report a public deployment URL.',
      }
  const revision = run('git', ['rev-parse', 'HEAD'], { allowFailure: true }).stdout.trim() || null
  await writeFile(
    deploymentReceiptPath,
    `${JSON.stringify(
      {
        formatVersion: 1,
        deployedAt: deployment?.timestamp ?? new Date().toISOString(),
        sourceRevision: revision,
        accountId: existing.accountId,
        workerName: existing.workerName,
        workerVersionId: deployment?.versionId ?? null,
        bucketName: existing.bucketName,
        domain: existing.domain,
        targets: deployment?.targets ?? [],
        verification,
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  if (!verification.ok) {
    throw new Error(
      `ProgramKit deployed, but its public smoke checks did not pass: ${verification.error} Rerun npm run selfhost:deploy after checking the Worker route.`,
    )
  }

  console.log(`\nDeployment ready at ${origin}`)
  console.log(`Receipt written to ${deploymentReceiptPath}`)
  console.log('Use this code once when you create the first owner account:')
  console.log(setupCode)
}

async function launch() {
  await setup()
  await deploy()
}

const command = process.argv[2] ?? 'setup'
try {
  if (hasFlag('help')) console.log(help)
  else if (command === 'launch') await launch()
  else if (command === 'setup') await setup()
  else if (command === 'deploy') await deploy()
  else throw new Error('Use setup or deploy.')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
