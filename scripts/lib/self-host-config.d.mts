export interface SelfHostConfigInput {
  workerName: string
  bucketName: string
  domain?: string | null
  accountId?: string | null
}

export interface SelfHostConfig {
  $schema: string
  name: string
  account_id?: string
  compatibility_date: string
  compatibility_flags: string[]
  main: string
  assets: {
    directory: string
    binding: string
    not_found_handling: string
    run_worker_first: boolean
  }
  r2_buckets: Array<{ binding: string; bucket_name: string }>
  durable_objects: {
    bindings: Array<{ name: string; class_name: string }>
  }
  migrations: Array<{ tag: string; new_sqlite_classes: string[] }>
  vars: {
    PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app'
    PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '10'
    PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: '40'
    PROGRAMKIT_SIGNUP_MODE: 'bootstrap'
    PROGRAMKIT_APP_ORIGIN?: string
  }
  secrets: { required: ['PROGRAMKIT_BOOTSTRAP_TOKEN'] }
  routes?: Array<{ pattern: string; custom_domain: true }>
  observability: { enabled: true }
}

export function cleanCloudflareName(value: unknown, label: string): string
export function cleanDomain(value: unknown): string | null
export function hasCloudflareDeployments(value: unknown): boolean
export function isMissingCloudflareWorker(value: unknown): boolean
export function parseWranglerDeployOutput(value: unknown): {
  versionId: string | null
  timestamp: string | null
  targets: string[]
} | null
export function createSelfHostConfig(input: SelfHostConfigInput): SelfHostConfig
