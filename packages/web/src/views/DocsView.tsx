import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { useRouterState } from '@tanstack/react-router'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnchorHTMLAttributes,
  type MouseEvent,
  type ReactNode,
} from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { ProgramKitMark } from '../components/brand.tsx'
import { docsNavigation, docsPages, type DocsPage } from '../generated/docs-content.generated.ts'
import { shouldHandleProgramNavigation, useProgramNavigate } from '../lib/navigation.ts'

const repositoryUrl = 'https://forge.smol.ai/andheller/programkit'
const repositorySourceUrl = `${repositoryUrl}/blob/main/`

const topSections = [
  { label: 'Overview', href: '/docs' },
  { label: 'Use ProgramKit', href: '/docs/users' },
  { label: 'Self-hosting', href: '/docs/self-hosting' },
  { label: 'Developers', href: '/docs/developers' },
  { label: 'API & agents', href: '/docs/api/quickstart' },
]

const pagesByPath = new Map(docsPages.map((page) => [page.path, page]))
const pagesBySource = new Map(docsPages.map((page) => [page.source, page]))
const listedPages = docsNavigation.flatMap((group) =>
  group.items.flatMap((item) => {
    const page = item.source ? pagesBySource.get(item.source) : undefined
    return page ? [{ group: group.title, label: item.label, page }] : []
  }),
)

interface PageHeading {
  depth: number
  id: string
  label: string
}

function githubSlug(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/<[^>]*>/gu, '')
    .replace(/[`*_~]/gu, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/gu, '-')
}

function headingsFromMarkdown(markdown: string) {
  const headings: PageHeading[] = []
  let inFence = false
  const seen = new Map<string, number>()
  for (const line of markdown.split('\n')) {
    if (/^\s*(`{3,}|~{3,})/u.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = line.match(/^(#{2,3})\s+(.+?)\s*#*$/u)
    if (!match) continue
    const label = match[2].replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1').replace(/[`*_~]/gu, '')
    const base = githubSlug(label)
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    headings.push({ depth: match[1].length, id: count === 0 ? base : `${base}-${count}`, label })
  }
  return headings
}

function normalizeRepositoryPath(value: string) {
  const parts: string[] = []
  for (const part of value.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') parts.pop()
    else parts.push(part)
  }
  return parts.join('/')
}

function repositoryTarget(source: string, relativeTarget: string) {
  const directory = source.slice(0, source.lastIndexOf('/') + 1)
  return normalizeRepositoryPath(`${directory}${relativeTarget}`)
}

function resolvedMarkdownHref(page: DocsPage, href = '') {
  if (!href || href.startsWith('#') || href.startsWith('/')) return href
  if (/^(?:https?:|mailto:|tel:)/iu.test(href)) return href

  const hashIndex = href.indexOf('#')
  const pathWithQuery = hashIndex === -1 ? href : href.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : href.slice(hashIndex)
  const queryIndex = pathWithQuery.indexOf('?')
  const relativePath = queryIndex === -1 ? pathWithQuery : pathWithQuery.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : pathWithQuery.slice(queryIndex)
  const target = repositoryTarget(page.source, decodeURI(relativePath))
  const docsPage = pagesBySource.get(target)

  if (docsPage) return `${docsPage.path}${query}${hash}`
  return `${repositorySourceUrl}${target}${query}${hash}`
}

function reactNodeText(value: ReactNode): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(reactNodeText).join('')
  if (value && typeof value === 'object' && 'props' in value) {
    return reactNodeText((value as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function markdownComponents(page: DocsPage): Components {
  function linkedHeading(level: 2 | 3 | 4 | 5 | 6) {
    return function Heading({ children }: { children?: ReactNode }) {
      const id = githubSlug(reactNodeText(children))
      const HeadingTag = `h${level}` as const
      return (
        <HeadingTag id={id}>
          <a href={`#${id}`}>{children}</a>
        </HeadingTag>
      )
    }
  }

  return {
    a({ href, children }) {
      const resolved = resolvedMarkdownHref(page, href)
      const external = /^https?:/iu.test(resolved)
      return (
        <DocsLink href={resolved} {...(external ? { rel: 'noreferrer', target: '_blank' } : {})}>
          {children}
        </DocsLink>
      )
    },
    h2: linkedHeading(2),
    h3: linkedHeading(3),
    h4: linkedHeading(4),
    h5: linkedHeading(5),
    h6: linkedHeading(6),
    ol({ children }) {
      return <ol role="list">{children}</ol>
    },
    table({ children }) {
      return (
        <div className="-mx-5 -my-2 overflow-x-auto whitespace-nowrap sm:-mx-8 lg:mx-0">
          <div className="inline-block min-w-full px-5 py-2 align-middle sm:px-8 lg:px-0">
            <table>{children}</table>
          </div>
        </div>
      )
    },
    ul({ children }) {
      return <ul role="list">{children}</ul>
    },
  }
}

function searchableText(page: DocsPage) {
  return `${page.title}\n${page.description}\n${page.markdown}`
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/[#>*_`|[\]()]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .toLocaleLowerCase('en-US')
}

const searchIndex = listedPages.map((entry) => ({ ...entry, text: searchableText(entry.page) }))

function DocsLink({ href = '', onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const navigate = useProgramNavigate()

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)
    if (
      !shouldHandleProgramNavigation(event) ||
      props.target === '_blank' ||
      !href.startsWith('/docs')
    ) {
      return
    }

    event.preventDefault()
    const [path, hash] = href.split('#', 2)
    navigate(path)
    if (hash) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          document.getElementById(decodeURIComponent(hash))?.scrollIntoView()
        })
      })
    }
  }

  return <a {...props} href={href} onClick={handleClick} />
}

function searchDocs(query: string) {
  const normalized = query.trim().toLocaleLowerCase('en-US')
  if (!normalized) return listedPages.slice(0, 7)
  const terms = normalized.split(/\s+/gu)
  return searchIndex
    .flatMap((entry) => {
      if (!terms.every((term) => entry.text.includes(term))) return []
      const title = entry.page.title.toLocaleLowerCase('en-US')
      let score = 10
      if (title === normalized) score += 100
      else if (title.startsWith(normalized)) score += 60
      else if (title.includes(normalized)) score += 35
      if (entry.group.toLocaleLowerCase('en-US').includes(normalized)) score += 15
      return [{ ...entry, score }]
    })
    .sort(
      (left, right) => right.score - left.score || left.page.title.localeCompare(right.page.title),
    )
    .slice(0, 8)
}

function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchDocs(query), [query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-60 flex items-start justify-center px-4 pt-[10dvh] sm:px-6">
      <button
        type="button"
        aria-label="Close documentation search"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/25 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="docs-search-title"
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-950/10"
      >
        <h2 id="docs-search-title" className="sr-only">
          Search documentation
        </h2>
        <div className="flex min-w-0 items-center gap-3 border-b border-zinc-950/8 px-4 sm:px-5">
          <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0 fill-zinc-400" />
          <input
            ref={inputRef}
            name="docs-search"
            type="text"
            role="searchbox"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search setup, API, agents, workflows…"
            aria-label="Search documentation"
            className="min-h-14 min-w-0 flex-1 bg-transparent text-base text-zinc-950 outline-none placeholder:text-zinc-400"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="touch-target focus-ring rounded-md p-1 text-zinc-400 hover:text-zinc-950"
          >
            <XMarkIcon aria-hidden="true" className="size-4 fill-current" />
          </button>
        </div>
        <div className="max-h-[60dvh] overflow-y-auto p-2 sm:p-3">
          <p className="px-3 py-2 text-base text-zinc-500 sm:text-sm" aria-live="polite">
            {query ? `${results.length} matching pages.` : 'Popular starting points.'}
          </p>
          {results.length ? (
            <ul role="list" className="grid gap-1">
              {results.map((result) => (
                <li key={result.page.path}>
                  <DocsLink
                    href={result.page.path}
                    onClick={onClose}
                    className="focus-ring flex min-w-0 items-start justify-between gap-4 rounded-xl px-3 py-3 hover:bg-zinc-950/4"
                  >
                    <div className="min-w-0">
                      <p className="text-base font-medium text-zinc-950 sm:text-sm">
                        {result.label}
                      </p>
                      <p className="line-clamp-2 pt-1 text-base text-zinc-500 sm:text-sm">
                        {result.page.description}
                      </p>
                    </div>
                    <span className="hidden shrink-0 pt-0.5 text-sm text-zinc-400 sm:inline">
                      {result.group}
                    </span>
                  </DocsLink>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-10 text-center">
              <p className="text-base font-medium text-zinc-950">No documentation found.</p>
              <p className="pt-1 text-base text-zinc-500 sm:text-sm">
                Try a workflow, product surface, or configuration name.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DocsNavigation({ page, onNavigate }: { page: DocsPage; onNavigate?: () => void }) {
  return (
    <nav aria-label="Documentation navigation" className="grid gap-8">
      {docsNavigation.map((group) => (
        <div key={group.title}>
          <h2 className="text-sm font-semibold text-zinc-950">{group.title}</h2>
          <ul role="list" className="grid gap-0.5 pt-2">
            {group.items.map((item) => {
              const itemPage = item.source ? pagesBySource.get(item.source) : undefined
              const href = itemPage?.path ?? item.href ?? '#'
              const active = itemPage?.path === page.path
              return (
                <li key={`${group.title}-${item.label}`}>
                  <DocsLink
                    href={href}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    {...(item.href ? { rel: 'noreferrer', target: '_blank' } : {})}
                    className={`focus-ring flex min-h-9 items-start gap-2 rounded-lg px-2.5 py-2 text-base font-medium sm:text-sm ${
                      active
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950'
                    }`}
                  >
                    <span className="min-w-0 flex-1">{item.label}</span>
                    {item.href ? (
                      <ArrowTopRightOnSquareIcon
                        aria-hidden="true"
                        className="size-4 h-lh shrink-0 fill-zinc-400"
                      />
                    ) : null}
                  </DocsLink>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function activeGroupForPage(page: DocsPage) {
  return docsNavigation.find((group) => group.items.some((item) => item.source === page.source))
}

function pageNeighbors(page: DocsPage) {
  const index = listedPages.findIndex((entry) => entry.page.path === page.path)
  return {
    previous: index > 0 ? listedPages[index - 1] : undefined,
    next: index >= 0 && index < listedPages.length - 1 ? listedPages[index + 1] : undefined,
  }
}

function DocsArticle({ page }: { page: DocsPage }) {
  const headings = useMemo(() => headingsFromMarkdown(page.markdown), [page.markdown])
  const components = useMemo(() => markdownComponents(page), [page])
  const activeGroup = activeGroupForPage(page)
  const { previous, next } = pageNeighbors(page)
  const readingMinutes = Math.max(1, Math.ceil(page.markdown.split(/\s+/gu).length / 225))

  useEffect(() => {
    document.title = `${page.title} · ProgramKit Docs`
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (description) description.content = page.description
    let markdownAlternate = document.querySelector<HTMLLinkElement>(
      'link[data-programkit-docs-markdown]',
    )
    if (!markdownAlternate) {
      markdownAlternate = document.createElement('link')
      markdownAlternate.dataset.programkitDocsMarkdown = 'true'
      markdownAlternate.rel = 'alternate'
      markdownAlternate.type = 'text/markdown'
      document.head.appendChild(markdownAlternate)
    }
    markdownAlternate.href = `${page.path}.md`
    markdownAlternate.title = 'Markdown version'
  }, [page])

  return (
    <>
      <article className="min-w-0 pb-16 lg:pb-24">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-5 text-base text-zinc-500 sm:text-sm">
          <DocsLink className="focus-ring rounded-md hover:text-zinc-950" href="/docs">
            Docs
          </DocsLink>
          {activeGroup && page.path !== '/docs' ? (
            <>
              <span aria-hidden="true">/</span>
              <span>{activeGroup.title}</span>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{readingMinutes} min read</span>
        </div>

        {headings.length ? (
          <details className="mb-8 rounded-xl bg-zinc-950/3 px-4 py-3 xl:hidden">
            <summary className="cursor-pointer text-base font-medium text-zinc-950 sm:text-sm">
              On this page
            </summary>
            <ol className="grid gap-2 pt-3 text-base text-zinc-600 sm:text-sm">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.depth === 3 ? 'pl-4' : undefined}>
                  <a className="focus-ring rounded-md hover:text-zinc-950" href={`#${heading.id}`}>
                    {heading.label}
                  </a>
                </li>
              ))}
            </ol>
          </details>
        ) : null}

        <div className="prose max-w-[78ch]">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {page.markdown}
          </ReactMarkdown>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-zinc-950/10 pt-6 text-base sm:flex-row sm:items-center sm:justify-between sm:text-sm">
          <a
            href={`${repositorySourceUrl}${page.source}`}
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex items-center gap-1.5 rounded-md font-medium text-zinc-600 hover:text-zinc-950"
          >
            Edit this page
            <ArrowTopRightOnSquareIcon
              aria-hidden="true"
              className="size-4 shrink-0 fill-current"
            />
          </a>
          <DocsLink
            href={`${page.path}.md`}
            target="_blank"
            rel="alternate"
            type="text/markdown"
            className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md font-medium text-zinc-600 hover:text-zinc-950"
          >
            View Markdown
            <ArrowTopRightOnSquareIcon
              aria-hidden="true"
              className="size-4 shrink-0 fill-current"
            />
          </DocsLink>
          <a
            href="https://forge.smol.ai/andheller/programkit/issues"
            target="_blank"
            rel="noreferrer"
            className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md font-medium text-zinc-600 hover:text-zinc-950"
          >
            Report a docs issue
            <ArrowTopRightOnSquareIcon
              aria-hidden="true"
              className="size-4 shrink-0 fill-current"
            />
          </a>
        </div>

        {previous || next ? (
          <nav
            id="docs-footer-navigation"
            aria-label="Previous and next documentation"
            className={`mt-7 grid gap-px overflow-hidden rounded-2xl bg-zinc-950/10 ring-1 ring-zinc-950/10 ${previous && next ? 'sm:grid-cols-2' : ''}`}
          >
            {previous ? (
              <DocsLink
                href={previous.page.path}
                className="focus-ring flex min-w-0 items-start gap-3 bg-white p-5 hover:bg-zinc-50 sm:p-6"
              >
                <ArrowLeftIcon aria-hidden="true" className="size-4 h-lh shrink-0 fill-zinc-400" />
                <span className="min-w-0">
                  <span className="block text-base text-zinc-500 sm:text-sm">Previous</span>
                  <span className="block pt-1 text-base font-medium text-zinc-950 sm:text-sm">
                    {previous.label}
                  </span>
                </span>
              </DocsLink>
            ) : null}
            {next ? (
              <DocsLink
                href={next.page.path}
                className="focus-ring flex min-w-0 items-start justify-end gap-3 bg-white p-5 text-right hover:bg-zinc-50 sm:p-6"
              >
                <span className="min-w-0">
                  <span className="block text-base text-zinc-500 sm:text-sm">Next</span>
                  <span className="block pt-1 text-base font-medium text-zinc-950 sm:text-sm">
                    {next.label}
                  </span>
                </span>
                <ArrowRightIcon aria-hidden="true" className="size-4 h-lh shrink-0 fill-zinc-400" />
              </DocsLink>
            ) : null}
          </nav>
        ) : null}
      </article>

      <aside className="hidden min-w-0 xl:block">
        <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pb-10">
          <h2 className="text-sm font-semibold text-zinc-950">On this page</h2>
          {headings.length ? (
            <ol className="grid gap-2.5 pt-3 text-sm text-zinc-500">
              {headings.map((heading) => (
                <li key={heading.id} className={heading.depth === 3 ? 'pl-3' : undefined}>
                  <a className="focus-ring rounded-md hover:text-zinc-950" href={`#${heading.id}`}>
                    {heading.label}
                  </a>
                </li>
              ))}
            </ol>
          ) : (
            <p className="pt-3 text-sm text-zinc-500">This page has no sections.</p>
          )}
        </div>
      </aside>
    </>
  )
}

function DocsNotFound() {
  return (
    <main className="grid min-h-[60dvh] place-items-center px-5 py-20 text-center">
      <div>
        <p className="text-sm font-medium text-blue-600">Documentation</p>
        <h1 className="pt-3 text-balance text-3xl font-semibold tracking-tight text-zinc-950">
          This page is not in the guide.
        </h1>
        <p className="mx-auto max-w-[52ch] pt-3 text-pretty text-base/7 text-zinc-600">
          The page may have moved, or the link may point to repository-only material.
        </p>
        <DocsLink
          href="/docs"
          className="focus-ring mt-6 inline-flex min-h-11 items-center rounded-full bg-blue-600 px-4 text-base font-medium text-white ring-1 ring-blue-600 hover:bg-blue-700 sm:min-h-10 sm:text-sm"
        >
          Open documentation home
        </DocsLink>
      </div>
    </main>
  )
}

function DocsHeader({
  pathname,
  onSearch,
  onMenu,
}: {
  pathname: string
  onSearch: () => void
  onMenu: () => void
}) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-zinc-950/8 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-[90rem] items-center gap-4 px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <button
              type="button"
              onClick={onMenu}
              aria-label="Open documentation navigation"
              className="touch-target focus-ring rounded-md p-1 text-zinc-600 hover:text-zinc-950 lg:hidden"
            >
              <Bars3Icon aria-hidden="true" className="size-4 fill-current" />
            </button>
            <a
              href="/"
              aria-label="Homepage"
              className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl"
            >
              <ProgramKitMark className="size-7" />
              <span className="hidden text-base font-semibold tracking-tight text-zinc-950 sm:inline">
                ProgramKit
              </span>
            </a>
            <span aria-hidden="true" className="hidden h-5 w-px bg-zinc-950/12 sm:block" />
            <DocsLink
              href="/docs"
              className="focus-ring hidden rounded-md text-sm font-medium text-zinc-600 hover:text-zinc-950 sm:inline"
            >
              Docs
            </DocsLink>
          </div>

          <button
            type="button"
            onClick={onSearch}
            aria-label="Search documentation"
            className="touch-target focus-ring flex min-h-10 w-full max-w-md min-w-0 items-center gap-2 rounded-xl bg-zinc-950/3 px-3 text-left text-sm text-zinc-500 ring-1 ring-zinc-950/8 hover:bg-zinc-950/5 max-sm:w-10 max-sm:justify-center max-sm:px-0"
          >
            <MagnifyingGlassIcon aria-hidden="true" className="size-4 shrink-0 fill-zinc-400" />
            <span className="min-w-0 flex-1 truncate max-sm:hidden">Search documentation</span>
            <kbd className="hidden rounded-md bg-white px-1.5 py-0.5 font-sans text-xs text-zinc-400 ring-1 ring-zinc-950/8 sm:inline">
              ⌘ K
            </kbd>
          </button>

          <nav aria-label="Site navigation" className="flex flex-1 items-center justify-end gap-1">
            <a
              href="https://demo.programkit.dev"
              className="focus-ring hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950 md:inline-flex"
            >
              Demo
            </a>
            <a
              href={repositoryUrl}
              className="focus-ring hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950 lg:inline-flex"
            >
              Source
            </a>
            <a
              href="https://app.programkit.dev/login"
              className="focus-ring hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-950/4 hover:text-zinc-950 sm:inline-flex"
            >
              Sign in
            </a>
          </nav>
        </div>
      </header>

      <nav
        aria-label="Documentation sections"
        className="sticky top-16 z-30 overflow-x-auto border-b border-zinc-950/8 bg-zinc-50/95 whitespace-nowrap backdrop-blur"
      >
        <div className="mx-auto flex min-h-12 max-w-[90rem] items-center gap-1 px-5 sm:px-8 lg:px-10">
          {topSections.map((section) => {
            const active =
              section.href === '/docs'
                ? pathname === '/docs'
                : pathname === section.href || pathname.startsWith(`${section.href}/`)
            return (
              <DocsLink
                key={section.href}
                href={section.href}
                aria-current={active ? 'page' : undefined}
                className={`focus-ring inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium ${
                  active
                    ? 'bg-white text-zinc-950 ring-1 ring-zinc-950/8'
                    : 'text-zinc-600 hover:text-zinc-950'
                }`}
              >
                {section.label}
              </DocsLink>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function MobileDocsNavigation({
  page,
  open,
  onClose,
}: {
  page: DocsPage
  open: boolean
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      <button
        type="button"
        aria-label="Close documentation navigation"
        onClick={onClose}
        className="absolute inset-0 bg-zinc-950/20"
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(88vw,22rem)] flex-col bg-white shadow-2xl ring-1 ring-zinc-950/10">
        <div className="flex min-h-16 items-center justify-between border-b border-zinc-950/8 px-5">
          <DocsLink
            href="/docs"
            onClick={onClose}
            className="focus-ring flex items-center gap-2.5 rounded-xl"
          >
            <ProgramKitMark className="size-7" />
            <span className="text-base font-semibold tracking-tight">ProgramKit Docs</span>
          </DocsLink>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="touch-target focus-ring rounded-md p-1 text-zinc-500 hover:text-zinc-950"
          >
            <XMarkIcon aria-hidden="true" className="size-4 fill-current" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6">
          <DocsNavigation page={page} onNavigate={onClose} />
        </div>
      </div>
    </div>
  )
}

export function DocsView() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const normalizedPath = decodeURI(pathname).replace(/\/$/u, '') || '/docs'
  const page = pagesByPath.get(normalizedPath)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase('en-US') === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMobileNavigationOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  useEffect(() => {
    const locked = searchOpen || mobileNavigationOpen
    document.body.style.overflow = locked ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [searchOpen, mobileNavigationOpen])

  if (!page) {
    return (
      <div className="isolate min-h-dvh bg-white text-zinc-950">
        <DocsHeader
          pathname={pathname}
          onSearch={() => setSearchOpen(true)}
          onMenu={() => setMobileNavigationOpen(true)}
        />
        <DocsNotFound />
        <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    )
  }

  return (
    <div className="isolate min-h-dvh bg-white text-zinc-950">
      <DocsHeader
        pathname={pathname}
        onSearch={() => setSearchOpen(true)}
        onMenu={() => setMobileNavigationOpen(true)}
      />

      <div className="mx-auto grid w-full max-w-[90rem] gap-10 px-5 pt-10 sm:px-8 sm:pt-12 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12 lg:px-10 xl:grid-cols-[15rem_minmax(0,1fr)_13rem] xl:gap-14">
        <aside className="hidden min-w-0 lg:block">
          <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pb-10 pr-2">
            <DocsNavigation page={page} />
          </div>
        </aside>
        <DocsArticle page={page} />
      </div>

      <footer className="border-t border-zinc-950/8">
        <div className="mx-auto flex min-h-24 max-w-[90rem] flex-col justify-center gap-4 px-5 py-6 text-base text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:text-sm lg:px-10">
          <a
            href="/"
            aria-label="Homepage"
            className="focus-ring flex w-fit items-center gap-2.5 rounded-lg text-zinc-950"
          >
            <ProgramKitMark className="h-6 w-auto" />
            <span className="font-semibold">ProgramKit</span>
          </a>
          <nav aria-label="Documentation footer" className="flex flex-wrap gap-x-5 gap-y-2">
            <a className="focus-ring rounded-md font-normal hover:text-zinc-950" href="/privacy">
              Privacy
            </a>
            <a className="focus-ring rounded-md font-normal hover:text-zinc-950" href="/terms">
              Terms
            </a>
            <a
              className="focus-ring rounded-md font-normal hover:text-zinc-950"
              href={repositoryUrl}
            >
              Forge
            </a>
          </nav>
        </div>
      </footer>

      <MobileDocsNavigation
        page={page}
        open={mobileNavigationOpen}
        onClose={() => setMobileNavigationOpen(false)}
      />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  )
}
