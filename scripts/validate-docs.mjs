import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'

const repositoryRoot = resolve(import.meta.dirname, '..')
const publicRoot = resolve(repositoryRoot, 'apps/cloudflare/public')
const generatedMarkdownDirectory = resolve(repositoryRoot, 'apps/cloudflare/public/docs')
const ignoredMarkdownFiles = new Set([resolve(repositoryRoot, 'apps/cloudflare/public/docs.md')])
const ignoredDirectories = new Set([
  '.git',
  '.programkit',
  '.wrangler',
  'build',
  'coverage',
  'dist',
  'node_modules',
])

async function markdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    if (path === generatedMarkdownDirectory || ignoredMarkdownFiles.has(path)) continue
    if (entry.isDirectory()) files.push(...(await markdownFiles(path)))
    else if (entry.isFile() && extname(entry.name) === '.md') files.push(path)
  }
  return files
}

function withoutFencedCode(source) {
  let fence = null
  return source
    .split('\n')
    .map((line) => {
      const match = line.match(/^\s*(`{3,}|~{3,})/u)
      if (match && !fence) {
        fence = match[1][0]
        return ''
      }
      if (match && fence === match[1][0]) {
        fence = null
        return ''
      }
      return fence ? '' : line
    })
    .join('\n')
}

function githubSlug(value) {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/<[^>]*>/gu, '')
    .replace(/[`*_~]/gu, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/gu, '-')
}

function headingAnchors(source) {
  const seen = new Map()
  const anchors = new Set()
  for (const match of withoutFencedCode(source).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gmu)) {
    const base = githubSlug(match[1])
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    anchors.add(count === 0 ? base : `${base}-${count}`)
  }
  return anchors
}

function markdownTargets(source) {
  const clean = withoutFencedCode(source)
  const targets = []
  for (const match of clean.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/gu)) {
    targets.push(match[1])
  }
  for (const match of clean.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gmu)) {
    targets.push(match[1])
  }
  return targets
}

function decodeTarget(target) {
  const unwrapped = target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target
  try {
    return decodeURI(unwrapped)
  } catch {
    return unwrapped
  }
}

const files = await markdownFiles(repositoryRoot)
const sources = new Map(
  await Promise.all(files.map(async (file) => [file, await readFile(file, 'utf8')])),
)
const errors = []
let linksChecked = 0

for (const [file, source] of sources) {
  if (relative(repositoryRoot, file).startsWith('docs/')) {
    const topLevelHeadings = withoutFencedCode(source).match(/^#\s+.+$/gmu) ?? []
    if (topLevelHeadings.length !== 1) {
      errors.push(
        `${relative(repositoryRoot, file)}: expected one level-one heading, found ${topLevelHeadings.length}`,
      )
    }
  }

  for (const rawTarget of markdownTargets(source)) {
    const target = decodeTarget(rawTarget)
    if (/^(?:https?:|mailto:|tel:)/iu.test(target)) continue

    const [pathPart, fragment] = target.split('#', 2)
    const targetPath = pathPart.startsWith('/')
      ? resolve(publicRoot, pathPart.slice(1))
      : resolve(dirname(file), pathPart || relative(dirname(file), file))
    linksChecked += 1

    let targetStats
    try {
      targetStats = await stat(targetPath)
    } catch {
      errors.push(`${relative(repositoryRoot, file)}: missing local target ${rawTarget}`)
      continue
    }

    if (!fragment || targetStats.isDirectory() || extname(targetPath) !== '.md') continue
    const targetSource = sources.get(targetPath) ?? (await readFile(targetPath, 'utf8'))
    if (!headingAnchors(targetSource).has(fragment.toLocaleLowerCase('en-US'))) {
      errors.push(`${relative(repositoryRoot, file)}: missing heading target ${rawTarget}`)
    }
  }
}

if (errors.length > 0) {
  console.error(`Documentation validation failed with ${errors.length} issue(s):`)
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(
    `Documentation is valid (${files.length} Markdown files, ${linksChecked} local links).`,
  )
}
