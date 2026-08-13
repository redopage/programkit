import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { apiKeyScopes, operationManifest } from '@programkit/core'

interface JsonSchema {
  type?: 'object' | 'array' | 'string' | 'integer' | 'boolean'
  format?: string
  enum?: unknown[]
  required?: string[]
  properties?: Record<string, JsonSchema>
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
}

interface MediaType {
  schema: JsonSchema
  examples: Record<string, { value: unknown }>
}

interface ApiOperation {
  operationId: string
  'x-programkit-operation'?: string
  'x-programkit-scopes'?: string[]
  'x-programkit-risk'?: string
  'x-programkit-agent-policy'?: string
  'x-programkit-reversible'?: boolean
  'x-programkit-supports-dry-run'?: boolean
  'x-programkit-emits'?: string[]
  requestBody?: { content: { 'application/json': MediaType } }
  responses: Record<string, unknown>
}

interface OpenApiDocument {
  openapi: string
  info: { version: string }
  'x-programkit-generated-from': string[]
  paths: Record<string, { get?: ApiOperation; post?: ApiOperation }>
}

const documentPath = fileURLToPath(new URL('../docs/api/openapi.json', import.meta.url))
const rawDocument = JSON.parse(readFileSync(documentPath, 'utf8')) as unknown
const document = rawDocument as OpenApiDocument
const packageJsonPath = fileURLToPath(new URL('../package.json', import.meta.url))
const packageVersion = (JSON.parse(readFileSync(packageJsonPath, 'utf8')) as { version: string })
  .version
const grantableScopes = new Set<string>(apiKeyScopes)
const publicOperations = operationManifest.filter((operation) =>
  operation.scopes.every((scope) => grantableScopes.has(scope)),
)

function validateExample(value: unknown, schema: JsonSchema, path = 'example'): void {
  if (schema.enum) expect(schema.enum, `${path} enum`).toContain(value)

  if (schema.type === 'object') {
    expect(value, `${path} type`).toBeTypeOf('object')
    expect(value, `${path} null`).not.toBeNull()
    expect(Array.isArray(value), `${path} array`).toBe(false)
    const object = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      expect(Object.hasOwn(object, key), `${path}.${key} is required`).toBe(true)
    }
    for (const [key, entry] of Object.entries(object)) {
      const propertySchema = schema.properties?.[key]
      if (propertySchema) {
        validateExample(entry, propertySchema, `${path}.${key}`)
      } else if (schema.additionalProperties === false) {
        throw new Error(`${path}.${key} is not allowed by the schema`)
      } else if (typeof schema.additionalProperties === 'object') {
        validateExample(entry, schema.additionalProperties, `${path}.${key}`)
      }
    }
  }

  if (schema.type === 'array') {
    expect(Array.isArray(value), `${path} type`).toBe(true)
    if (schema.items) {
      for (const [index, entry] of (value as unknown[]).entries()) {
        validateExample(entry, schema.items, `${path}[${index}]`)
      }
    }
  }

  if (schema.type === 'string') {
    expect(value, `${path} type`).toBeTypeOf('string')
    if (schema.format === 'email') expect(value).toMatch(/^[^@]+@[^@]+$/u)
    if (schema.format === 'date-time') {
      expect(Number.isNaN(Date.parse(value as string)), `${path} date-time`).toBe(false)
    }
  }

  if (schema.type === 'integer') expect(Number.isInteger(value), `${path} type`).toBe(true)
  if (schema.type === 'boolean') expect(value, `${path} type`).toBeTypeOf('boolean')
}

function collectReferences(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectReferences)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([key, entry]) =>
    key === '$ref' && typeof entry === 'string' ? [entry] : collectReferences(entry),
  )
}

function resolveLocalReference(reference: string): unknown {
  if (!reference.startsWith('#/')) return undefined
  return reference
    .slice(2)
    .split('/')
    .map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~'))
    .reduce<unknown>((value, segment) => {
      if (!value || typeof value !== 'object') return undefined
      return (value as Record<string, unknown>)[segment]
    }, rawDocument)
}

describe('generated OpenAPI contract', () => {
  it('publishes the complete event-scoped API-key read surface', () => {
    expect(document.openapi).toBe('3.1.0')
    expect(document.info.version).toBe(packageVersion)
    expect(document['x-programkit-generated-from']).toEqual([
      'packages/core/src/manifest.ts',
      'packages/core/src/api-keys.ts',
    ])

    const readPaths = Object.entries(document.paths)
      .filter(([, path]) => path.get)
      .map(([path]) => path)

    expect(readPaths).toEqual([
      '/api/v1/health',
      '/api/v1/manifest',
      '/api/v1/domain-events',
      '/api/v1/events',
      '/api/v1/events/{eventId}',
      '/api/v1/events/{eventId}/sessions',
      '/api/v1/events/{eventId}/speakers',
      '/api/v1/events/{eventId}/submissions',
      '/api/v1/export',
      '/api/v1/export.json',
    ])
  })

  it('derives API-key operation paths and policy metadata from the canonical manifest', () => {
    const operationPaths = Object.keys(document.paths).filter((path) =>
      path.startsWith('/api/v1/operations/'),
    )
    expect(operationPaths).toEqual(
      publicOperations.map((operation) => `/api/v1/operations/${operation.name}`),
    )

    for (const operation of publicOperations) {
      const path = `/api/v1/operations/${operation.name}`
      const apiOperation = document.paths[path]?.post
      expect(apiOperation, path).toBeDefined()
      expect(apiOperation?.['x-programkit-operation']).toBe(operation.name)
      expect(apiOperation?.['x-programkit-scopes']).toEqual(operation.scopes)
      expect(apiOperation?.['x-programkit-risk']).toBe(operation.risk)
      expect(apiOperation?.['x-programkit-agent-policy']).toBe(operation.agentPolicy)
      expect(apiOperation?.['x-programkit-reversible']).toBe(operation.reversible)
      expect(apiOperation?.['x-programkit-supports-dry-run']).toBe(operation.supportsDryRun)
      expect(apiOperation?.['x-programkit-emits']).toEqual(operation.emits)

      const mediaType = apiOperation?.requestBody?.content['application/json']
      expect(mediaType, `${path} request body`).toBeDefined()
      const inputSchema = mediaType?.schema.properties?.input
      expect(inputSchema?.required).toEqual(operation.requiredInput)
      expect(Object.keys(inputSchema?.properties ?? {})).toEqual(operation.requiredInput)

      const modeValues = mediaType?.schema.properties?.mode?.enum ?? []
      expect(modeValues).toContain('execute')
      expect(modeValues.includes('dry_run')).toBe(operation.supportsDryRun)

      const example = mediaType?.examples.request?.value
      validateExample(example, mediaType!.schema, `${operation.name} request`)
      expect(Object.keys((example as { input: object }).input)).toEqual(operation.requiredInput)
    }

    const excludedOperations = operationManifest.filter(
      (operation) => !publicOperations.includes(operation),
    )
    expect(excludedOperations.map((operation) => operation.name)).toEqual([
      'asset.delete',
      'asset.confirm-deletion',
      'change-set.approve',
      'change-set.reject',
      'change-set.commit',
      'workspace.reset-demo',
    ])
  })

  it('uses unique operation IDs for generated clients', () => {
    const operationIds = Object.values(document.paths).flatMap((path) =>
      [path.get?.operationId, path.post?.operationId].filter((operationId): operationId is string =>
        Boolean(operationId),
      ),
    )
    expect(new Set(operationIds).size).toBe(operationIds.length)
  })

  it('contains only resolvable local component references', () => {
    const references = collectReferences(rawDocument)
    expect(references.length).toBeGreaterThan(0)
    for (const reference of references) {
      expect(resolveLocalReference(reference), reference).toBeDefined()
    }
  })
})
