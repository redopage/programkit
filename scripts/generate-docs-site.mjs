import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { format, resolveConfig } from 'prettier'

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url))
const docsRoot = resolve(repositoryRoot, 'docs')
const siteMapPath = resolve(docsRoot, 'site-map.json')
const outputPath = resolve(repositoryRoot, 'packages/web/src/generated/docs-content.generated.ts')
const publicRoot = resolve(repositoryRoot, 'apps/cloudflare/public')
const canonicalOrigin = 'https://programkit.dev'
const repositorySourceUrl = 'https://forge.smol.ai/andheller/programkit/blob/main/'
const checkOnly = process.argv.includes('--check')

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)))
    else if (entry.isFile() && entry.name.endsWith('.md')) files.push(path)
  }
  return files
}

function sourcePath(file) {
  return relative(repositoryRoot, file).split(sep).join('/')
}

function routePath(source) {
  const relativeSource = source.replace(/^docs\//u, '')
  if (relativeSource === 'README.md') return '/docs'
  if (relativeSource.endsWith('/README.md')) {
    return `/docs/${relativeSource.slice(0, -'/README.md'.length)}`
  }
  return `/docs/${relativeSource.replace(/\.md$/u, '')}`
}

function markdownPath(path) {
  return `${path}.md`
}

function normalizeRepositoryPath(value) {
  const parts = []
  for (const part of value.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function repositoryTarget(source, relativeTarget) {
  const directory = source.slice(0, source.lastIndexOf('/') + 1)
  return normalizeRepositoryPath(`${directory}${relativeTarget}`)
}

function rewriteMarkdownLinks(markdown, page, pagesBySource) {
  let inFence = false
  return markdown
    .split('\n')
    .map((line) => {
      if (/^\s*(`{3,}|~{3,})/u.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return line
      return line.replace(/(!?\[[^\]]*\]\()([^\s)]+)([^)]*\))/gu, (match, start, href, end) => {
        if (!href || href.startsWith('#') || href.startsWith('/')) return match
        if (/^(?:https?:|mailto:|tel:)/iu.test(href)) return match

        const hashIndex = href.indexOf('#')
        const pathWithQuery = hashIndex === -1 ? href : href.slice(0, hashIndex)
        const hash = hashIndex === -1 ? '' : href.slice(hashIndex)
        const queryIndex = pathWithQuery.indexOf('?')
        const relativePath = queryIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, queryIndex)
        const query = queryIndex === -1 ? '' : pathWithQuery.slice(queryIndex)
        const target = repositoryTarget(page.source, decodeURI(relativePath))
        const targetPage = pagesBySource.get(target)
        const resolved = targetPage
          ? `${markdownPath(targetPage.path)}${query}${hash}`
          : target === 'docs/api/openapi.json'
            ? `/docs/api/openapi.json${query}${hash}`
            : `${repositorySourceUrl}${target}${query}${hash}`
        return `${start}${resolved}${end}`
      })
    })
    .join('\n')
}

function plainText(value) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1')
    .replace(/[`*_~]/gu, '')
    .trim()
}

function titleFromMarkdown(markdown, source) {
  const match = markdown.match(/^#\s+(.+)$/mu)
  if (!match) throw new Error(`${source} needs a level-one heading.`)
  return plainText(match[1])
}

function descriptionFromMarkdown(markdown) {
  const withoutFences = markdown.replace(/```[\s\S]*?```/gu, '')
  for (const block of withoutFences.split(/\n\s*\n/gu)) {
    const value = block.trim()
    if (!value || value.startsWith('#') || value.startsWith('|') || value.startsWith('- ')) continue
    const text = plainText(value.replace(/\n/gu, ' '))
    if (text.length <= 220) return text
    const excerpt = text.slice(0, 221)
    return `${excerpt.slice(0, excerpt.lastIndexOf(' '))}…`
  }
  return 'ProgramKit documentation.'
}

const siteMap = JSON.parse(await readFile(siteMapPath, 'utf8'))
const files = (await markdownFiles(docsRoot)).sort()
const pages = await Promise.all(
  files.map(async (file) => {
    const source = sourcePath(file)
    const markdown = await readFile(file, 'utf8')
    return {
      source,
      path: routePath(source),
      title: titleFromMarkdown(markdown, source),
      description: descriptionFromMarkdown(markdown),
      markdown,
    }
  }),
)
const pagesBySource = new Map(pages.map((page) => [page.source, page]))

const pageSources = new Set(pages.map((page) => page.source))
const seenNavigationSources = new Set()
for (const group of siteMap.groups) {
  for (const item of group.items) {
    if (!item.source) continue
    if (!pageSources.has(item.source))
      throw new Error(`Navigation source is missing: ${item.source}`)
    if (seenNavigationSources.has(item.source)) {
      throw new Error(`Navigation source is listed more than once: ${item.source}`)
    }
    seenNavigationSources.add(item.source)
  }
}

const prettierConfig = (await resolveConfig(outputPath)) ?? {}
const generated = await format(
  `// Generated by scripts/generate-docs-site.mjs. Do not edit directly.

export interface DocsPage {
  source: string
  path: string
  title: string
  description: string
  markdown: string
}

export interface DocsNavigationItem {
  label: string
  source?: string
  href?: string
}

export interface DocsNavigationGroup {
  title: string
  items: DocsNavigationItem[]
}

export const docsPages: DocsPage[] = ${JSON.stringify(pages)}
export const docsNavigation: DocsNavigationGroup[] = ${JSON.stringify(siteMap.groups)}
`,
  { ...prettierConfig, parser: 'typescript' },
)

const publishedMarkdown = new Map(
  pages.map((page) => [
    page.path,
    [
      `<!-- Canonical: ${canonicalOrigin}${page.path} -->`,
      `<!-- Markdown: ${canonicalOrigin}${markdownPath(page.path)} -->`,
      '',
      rewriteMarkdownLinks(page.markdown, page, pagesBySource).trimEnd(),
      '',
    ].join('\n'),
  ]),
)

const llmsSections = siteMap.groups
  .map((group) => {
    const links = group.items.map((item) => {
      if (item.source) {
        const page = pagesBySource.get(item.source)
        return `- [${item.label}](${canonicalOrigin}${markdownPath(page.path)}): ${page.description}`
      }
      return `- [${item.label}](${item.href})`
    })
    return [`## ${group.title}`, '', ...links].join('\n')
  })
  .join('\n\n')

const llmsText = [
  '# ProgramKit',
  '',
  '> Open-source conference program management from call for proposals through published agenda.',
  '',
  'ProgramKit can be used as hosted software, deployed as one Cloudflare application, or changed as an open-source starter. The repository includes the organizer app, participant surfaces, HTTP API, MCP server, portable Agent Plugin, and shared domain rules.',
  '',
  llmsSections,
  '',
  '## Optional',
  '',
  `- [Complete documentation](${canonicalOrigin}/llms-full.txt): Every published documentation page in one text file.`,
  `- [OpenAPI contract](${canonicalOrigin}/docs/api/openapi.json): Machine-readable HTTP API contract.`,
  `- [Agent Plugin download](${canonicalOrigin}/agent-plugin.zip): Portable agent integration bundle.`,
  '- [Source repository](https://forge.smol.ai/andheller/programkit): Public source, issues, and contribution history.',
  '',
].join('\n')

const llmsFullText = [
  '# ProgramKit complete documentation',
  '',
  `> Canonical index: ${canonicalOrigin}/llms.txt`,
  '',
  ...pages.flatMap((page) => [
    '---',
    '',
    `Source page: ${canonicalOrigin}${page.path}`,
    '',
    publishedMarkdown.get(page.path).trimEnd(),
    '',
  ]),
].join('\n')

const sitemapText = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...['/', '/privacy', '/terms', ...pages.map((page) => page.path)].map(
    (path) => `  <url><loc>${canonicalOrigin}${path}</loc></url>`,
  ),
  '</urlset>',
  '',
].join('\n')

const publicArtifacts = new Map([
  [resolve(publicRoot, 'llms.txt'), llmsText],
  [resolve(publicRoot, 'llms-full.txt'), llmsFullText],
  [resolve(publicRoot, 'sitemap.xml'), sitemapText],
  [
    resolve(publicRoot, 'docs/api/openapi.json'),
    await readFile(resolve(docsRoot, 'api/openapi.json'), 'utf8'),
  ],
  ...pages.map((page) => [
    resolve(publicRoot, markdownPath(page.path).replace(/^\//u, '')),
    publishedMarkdown.get(page.path),
  ]),
])

async function artifactMatches(path, expected) {
  try {
    return (await readFile(path, 'utf8')) === expected
  } catch {
    return false
  }
}

// A page removed from `docs` must stop being served. The generator only writes files, so any
// Markdown mirror left behind from an earlier run stays publicly fetchable until it is pruned.
async function publishedMarkdownMirrors(directory) {
  const found = []
  let entries = []
  try {
    entries = await readdir(directory, { withFileTypes: true })
  } catch {
    return found
  }
  for (const entry of entries) {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await publishedMarkdownMirrors(path)))
    else if (entry.isFile() && entry.name.endsWith('.md')) found.push(path)
  }
  return found
}

const expectedArtifacts = new Set(publicArtifacts.keys())
const orphanedMirrors = [
  ...(await publishedMarkdownMirrors(resolve(publicRoot, 'docs'))),
  resolve(publicRoot, 'docs.md'),
].filter((path) => !expectedArtifacts.has(path))

if (checkOnly) {
  let current = ''
  try {
    current = await readFile(outputPath, 'utf8')
  } catch {
    // The drift error below provides the actionable command.
  }
  const stalePublicArtifacts = []
  for (const [path, content] of publicArtifacts) {
    if (!(await artifactMatches(path, content)))
      stalePublicArtifacts.push(relative(repositoryRoot, path))
  }
  if (current !== generated || stalePublicArtifacts.length > 0 || orphanedMirrors.length > 0) {
    if (stalePublicArtifacts.length > 0) {
      console.error(`Stale machine-readable docs:\n${stalePublicArtifacts.join('\n')}`)
    }
    if (orphanedMirrors.length > 0) {
      console.error(
        `Published Markdown without a source page:\n${orphanedMirrors
          .map((path) => relative(repositoryRoot, path))
          .join('\n')}`,
      )
    }
    console.error('Docs site content is stale. Run `pnpm docs-site:generate`.')
    process.exitCode = 1
  } else {
    console.log(`Docs site content is current (${pages.length} pages plus agent-readable formats).`)
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, generated)
  for (const [path, content] of publicArtifacts) {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content)
  }
  for (const path of orphanedMirrors) await rm(path)
  console.log(`Generated docs site content (${pages.length} pages plus agent-readable formats).`)
}
