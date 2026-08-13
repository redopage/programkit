import { describe, expect, it } from 'vitest'

import {
  cleanCloudflareName,
  cleanDomain,
  createSelfHostConfig,
  hasCloudflareDeployments,
  isMissingCloudflareWorker,
  parseWranglerDeployOutput,
} from '../scripts/lib/self-host-config.mjs'

describe('Cloudflare self-host configuration', () => {
  it('builds the full authenticated one-Worker assembly', () => {
    const config = createSelfHostConfig({
      workerName: 'my-programkit',
      bucketName: 'my-programkit-assets',
      domain: 'events.example.com',
      accountId: '261e1ddbc5f9cbf983e0fd6f51378e72',
    })

    expect(config.account_id).toBe('261e1ddbc5f9cbf983e0fd6f51378e72')
    expect(config.vars).toEqual({
      PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '10',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: '40',
      PROGRAMKIT_SIGNUP_MODE: 'bootstrap',
      PROGRAMKIT_APP_ORIGIN: 'https://events.example.com',
    })
    expect(config.routes).toEqual([{ pattern: 'events.example.com', custom_domain: true }])
    expect(config.secrets).toEqual({ required: ['PROGRAMKIT_BOOTSTRAP_TOKEN'] })
    expect(config.r2_buckets).toEqual([
      { binding: 'PROGRAMKIT_FILES', bucket_name: 'my-programkit-assets' },
    ])
    expect(config.durable_objects.bindings.map((binding) => binding.name)).toEqual([
      'PROGRAMKIT_WORKSPACES',
      'PROGRAMKIT_AUTH',
      'PROGRAMKIT_EVENT_ACCESS',
    ])
  })

  it('supports workers.dev and rejects unsafe resource names', () => {
    const config = createSelfHostConfig({
      workerName: 'programkit',
      bucketName: 'programkit-assets',
    })
    expect(config).not.toHaveProperty('routes')
    expect(config.vars).toEqual({
      PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_EMAIL: '10',
      PROGRAMKIT_PASSWORD_FAILURE_LIMIT_PER_IP: '40',
      PROGRAMKIT_SIGNUP_MODE: 'bootstrap',
    })
    expect(cleanCloudflareName('My ProgramKit', 'Worker name')).toBe('my-programkit')
    expect(cleanDomain('https://events.example.com/path')).toBe('events.example.com')
    expect(() => cleanCloudflareName('---', 'Worker name')).toThrow()
    expect(() => cleanDomain('localhost')).toThrow()
    expect(() =>
      createSelfHostConfig({
        workerName: 'programkit',
        bucketName: 'programkit-assets',
        accountId: 'not-an-account',
      }),
    ).toThrow('Cloudflare account ID is invalid.')
  })

  it('recognizes existing Worker deployments without treating malformed output as a collision', () => {
    expect(hasCloudflareDeployments('[]')).toBe(false)
    expect(hasCloudflareDeployments('[{"id":"deployment_1"}]')).toBe(true)
    expect(hasCloudflareDeployments('wrangler output changed')).toBe(false)
  })

  it('only treats Cloudflare Worker-not-found errors as an unused name', () => {
    expect(
      isMissingCloudflareWorker('This Worker does not exist on your account. [code: 10007]'),
    ).toBe(true)
    expect(isMissingCloudflareWorker('Authentication error [code: 10000]')).toBe(false)
    expect(isMissingCloudflareWorker('Network unavailable')).toBe(false)
  })

  it('reads the final public target and version from Wrangler structured output', () => {
    expect(
      parseWranglerDeployOutput(
        [
          JSON.stringify({ type: 'wrangler-session', version: 1 }),
          'diagnostic text',
          JSON.stringify({
            type: 'deploy',
            version_id: 'version_123',
            timestamp: '2026-08-13T02:00:00.000Z',
            targets: ['https://my-programkit.example.workers.dev'],
          }),
        ].join('\n'),
      ),
    ).toEqual({
      versionId: 'version_123',
      timestamp: '2026-08-13T02:00:00.000Z',
      targets: ['https://my-programkit.example.workers.dev'],
    })
    expect(
      parseWranglerDeployOutput('{"type":"deploy","targets":["http://unsafe.test"]}'),
    ).toBeNull()
  })
})
