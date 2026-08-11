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

export function createSelfHostConfig({ workerName, bucketName, domain = null }) {
  const name = cleanCloudflareName(workerName, 'Worker name')
  const bucket = cleanCloudflareName(bucketName, 'R2 bucket name')
  const hostname = cleanDomain(domain)

  return {
    $schema: '../apps/cloudflare/node_modules/wrangler/config-schema.json',
    name,
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
      ...(hostname ? { PROGRAMKIT_APP_ORIGIN: `https://${hostname}` } : {}),
    },
    ...(hostname ? { routes: [{ pattern: hostname, custom_domain: true }] } : {}),
    observability: { enabled: true },
  }
}
