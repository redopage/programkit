const cloudflareNamePattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
const hostnamePattern = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/u

export function cleanCloudflareName(value, label) {
  const cleaned = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
  if (!cloudflareNamePattern.test(cleaned)) {
    throw new Error(`${label} must use lowercase letters, numbers, and hyphens.`)
  }
  return cleaned
}

export function cleanDomain(value) {
  const raw = String(value ?? '')
    .trim()
    .toLowerCase()
  if (!raw) return null
  let hostname
  try {
    hostname = new URL(raw.includes('://') ? raw : `https://${raw}`).hostname
  } catch {
    throw new Error('The custom domain is invalid.')
  }
  if (!hostnamePattern.test(hostname)) throw new Error('The custom domain is invalid.')
  return hostname
}

export function hasCloudflareDeployments(value) {
  try {
    const deployments = JSON.parse(String(value ?? ''))
    return Array.isArray(deployments) && deployments.length > 0
  } catch {
    return false
  }
}

export function isMissingCloudflareWorker(value) {
  const detail = String(value ?? '')
  return /This Worker does not exist on your account\.|\[code:\s*10007\]/iu.test(detail)
}

export function parseWranglerDeployOutput(value) {
  let deployment = null
  for (const line of String(value ?? '').split(/\r?\n/gu)) {
    if (!line.trim()) continue
    try {
      const candidate = JSON.parse(line)
      if (candidate?.type !== 'deploy' || !Array.isArray(candidate.targets)) continue
      const targets = candidate.targets.filter((target) => {
        try {
          return typeof target === 'string' && new URL(target).protocol === 'https:'
        } catch {
          return false
        }
      })
      if (targets.length === 0) continue
      deployment = {
        versionId: typeof candidate.version_id === 'string' ? candidate.version_id : null,
        timestamp: typeof candidate.timestamp === 'string' ? candidate.timestamp : null,
        targets,
      }
    } catch {
      // Wrangler's output file may contain non-JSON diagnostics around structured records.
    }
  }
  return deployment
}

export function createSelfHostConfig({ workerName, bucketName, domain = null, accountId = null }) {
  const name = cleanCloudflareName(workerName, 'Worker name')
  const bucket = cleanCloudflareName(bucketName, 'R2 bucket name')
  const hostname = cleanDomain(domain)
  const cloudflareAccountId = String(accountId ?? '').trim()

  if (cloudflareAccountId && !/^[a-f0-9]{32}$/u.test(cloudflareAccountId)) {
    throw new Error('Cloudflare account ID is invalid.')
  }

  return {
    $schema: '../apps/cloudflare/node_modules/wrangler/config-schema.json',
    name,
    ...(cloudflareAccountId ? { account_id: cloudflareAccountId } : {}),
    compatibility_date: '2026-07-07',
    compatibility_flags: ['nodejs_compat'],
    main: '../apps/cloudflare/src/worker.ts',
    assets: {
      directory: '../apps/cloudflare/dist/client',
      binding: 'ASSETS',
      not_found_handling: 'single-page-application',
      run_worker_first: true,
    },
    r2_buckets: [{ binding: 'PROGRAMKIT_FILES', bucket_name: bucket }],
    durable_objects: {
      bindings: [
        { name: 'PROGRAMKIT_WORKSPACES', class_name: 'WorkspaceDurableObject' },
        { name: 'PROGRAMKIT_AUTH', class_name: 'AuthDurableObject' },
        { name: 'PROGRAMKIT_EVENT_ACCESS', class_name: 'EventAccessDurableObject' },
      ],
    },
    migrations: [
      { tag: 'v1', new_sqlite_classes: ['WorkspaceDurableObject'] },
      { tag: 'v2', new_sqlite_classes: ['AuthDurableObject'] },
      { tag: 'v3', new_sqlite_classes: ['EventAccessDurableObject'] },
    ],
    vars: {
      PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '10',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: '40',
      PROGRAMKIT_SIGNUP_MODE: 'bootstrap',
      ...(hostname ? { PROGRAMKIT_APP_ORIGIN: `https://${hostname}` } : {}),
    },
    secrets: { required: ['PROGRAMKIT_BOOTSTRAP_TOKEN'] },
    ...(hostname ? { routes: [{ pattern: hostname, custom_domain: true }] } : {}),
    observability: { enabled: true },
  }
}
