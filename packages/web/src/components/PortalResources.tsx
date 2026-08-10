import { ArrowTopRightOnSquareIcon, BookOpenIcon } from '@heroicons/react/16/solid'

import type { PortalResourcePage } from '@programkit/core'

export function PortalResources({ resources }: { resources: PortalResourcePage[] }) {
  const published = resources
    .filter((resource) => resource.status === 'published')
    .sort((left, right) => left.sortOrder - right.sortOrder)

  if (published.length === 0) return null

  return (
    <section aria-labelledby="resources-heading" className="flex flex-col gap-4">
      <div className="border-b border-zinc-950/5 pb-3">
        <h2 id="resources-heading" className="text-lg font-semibold text-zinc-950">
          Resources
        </h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {published.map((resource) => (
          <article
            key={resource.id}
            className="flex min-w-0 flex-col overflow-hidden rounded-2xl ring-1 ring-zinc-950/10"
          >
            <div className="flex flex-1 flex-col gap-3 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 ring-1 ring-blue-700/10">
                  <BookOpenIcon className="size-4 fill-blue-600" />
                </span>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-zinc-950">{resource.title}</h3>
                  {resource.summary ? (
                    <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                      {resource.summary}
                    </p>
                  ) : null}
                </div>
              </div>
              {resource.body ? (
                <p className="whitespace-pre-line text-pretty text-base leading-7 text-zinc-700 sm:text-sm sm:leading-6">
                  {resource.body}
                </p>
              ) : null}
              {resource.linkUrl ? (
                <div className="pt-1">
                  <a
                    href={resource.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="focus-ring inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-zinc-800 ring-1 ring-zinc-950/10 hover:bg-zinc-50"
                  >
                    Open resource
                    <ArrowTopRightOnSquareIcon className="size-4 fill-zinc-400" />
                  </a>
                </div>
              ) : null}
            </div>
            {resource.embedUrl ? (
              <div className="aspect-video min-h-64 border-t border-zinc-950/5 bg-zinc-50">
                <iframe
                  src={resource.embedUrl}
                  title={resource.title}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-forms allow-presentation allow-same-origin allow-scripts"
                  className="size-full border-0"
                />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}
