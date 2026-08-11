import { describe, expect, it } from 'vitest'

import {
  cleanCloudflareName,
  cleanDomain,
  createSelfHostConfig,
  hasCloudflareDeployments,
  isMissingCloudflareWorker,
} from '../scripts/lib/self-host-config.mjs'

describe('Cloudflare self-host configuration', () => {
  it('builds the full authenticated one-Worker assembly', () => {
    const config = createSelfHostConfig({
      workerName: 'my-programkit',
      bucketName: 'my-programkit-assets',
      domain: 'events.example.com',
    })

    expect(config.vars).toEqual({
      PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app',
      PROGRAMKIT_APP_ORIGIN: 'https://events.example.com',
    })
    expect(config.routes).toEqual([{ pattern: 'events.example.com', custom_domain: true }])
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
    expect(config.vars).toEqual({ PROGRAMKIT_DEPLOYMENT_PROFILE: 'hosted-app' })
    expect(cleanCloudflareName('My ProgramKit', 'Worker name')).toBe('my-programkit')
    expect(cleanDomain('https://events.example.com/path')).toBe('events.example.com')
    expect(() => cleanCloudflareName('---', 'Worker name')).toThrow()
    expect(() => cleanDomain('localhost')).toThrow()
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
})
