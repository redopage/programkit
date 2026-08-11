import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createInterface } from 'node:readline/promises'

import {
  cleanCloudflareName,
  cleanDomain,
  createSelfHostConfig,
  hasCloudflareDeployments,
  isMissingCloudflareWorker,
} from './lib/self-host-config.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const generatedRoot = resolve(repositoryRoot, '.programkit')
const configPath = resolve(generatedRoot, 'wrangler.json')
const metadataPath = resolve(generatedRoot, 'self-host.json')
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const help = `ProgramKit Cloudflare self-host setup

Usage:
  pnpm selfhost:setup
  pnpm selfhost:setup -- --name NAME --bucket BUCKET [--domain HOSTNAME]
  pnpm selfhost:deploy

Options:
  --name NAME       Cloudflare Worker name
  --bucket BUCKET   R2 bucket for private uploads
  --domain HOSTNAME Optional custom domain; omit to use workers.dev
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
  })
  if (result.status !== 0 && !options.allowFailure) {
    const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    throw new Error(detail || `${command} exited with status ${result.status}.`)
  }
  return result
}

function wrangler(args, options) {
  return run(pnpm, ['--filter', '@programkit/app-cloudflare', 'exec', 'wrangler', ...args], options)
}

async function readExistingSetup() {
  try {
    return JSON.parse(await readFile(metadataPath, 'utf8'))
  } catch {
    return null
  }
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
  const ownsWorker = existing?.cloudflareVerified === true && existing.workerName === workerName
  const ownsBucket = existing?.cloudflareVerified === true && existing.bucketName === bucketName

  if (!noProvision) {
    run(pnpm, ['--filter', '@programkit/app-cloudflare', 'exec', 'wrangler', 'whoami', '--json'])

    if (!ownsWorker && !hasFlag('reuse-worker')) {
      const deployments = wrangler(['deployments', 'list', '--name', workerName, '--json'], {
        allowFailure: true,
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

    const listed = wrangler(['r2', 'bucket', 'list'], { allowFailure: true })
    if (listed.status !== 0) throw new Error(`${listed.stdout}${listed.stderr}`.trim())
    const escapedBucket = bucketName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
    const bucketExists = new RegExp(`(^|\\s)${escapedBucket}(\\s|$)`, 'mu').test(listed.stdout)
    if (bucketExists && !ownsBucket && !hasFlag('reuse-bucket')) {
      throw new Error(
        `R2 bucket "${bucketName}" already exists. Choose another with --bucket ${bucketName}-files, or pass --reuse-bucket if this ProgramKit install should use it.`,
      )
    }
    if (!bucketExists) {
      wrangler(['r2', 'bucket', 'create', bucketName], { inherit: true })
    }
  }

  const config = createSelfHostConfig({ workerName, bucketName, domain })
  await mkdir(generatedRoot, { recursive: true })
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
  await writeFile(
    metadataPath,
    `${JSON.stringify(
      {
        workerName,
        bucketName,
        domain,
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
  console.log('\nNext: pnpm selfhost:deploy')
}

async function deploy() {
  try {
    await readFile(configPath, 'utf8')
  } catch {
    throw new Error('Run pnpm selfhost:setup before deploying.')
  }
  const existing = await readExistingSetup()
  if (existing?.cloudflareVerified !== true) {
    throw new Error(
      'This configuration has not passed the Cloudflare resource checks. Run pnpm selfhost:setup without --no-provision before deploying.',
    )
  }
  run(pnpm, ['build'], { inherit: true })
  wrangler(['deploy', '--config', configPath, '--strict'], { inherit: true })
}

const command = process.argv[2] ?? 'setup'
try {
  if (hasFlag('help')) console.log(help)
  else if (command === 'setup') await setup()
  else if (command === 'deploy') await deploy()
  else throw new Error('Use setup or deploy.')
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
