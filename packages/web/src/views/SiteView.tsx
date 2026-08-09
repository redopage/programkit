import { ArrowRightIcon, CodeBracketIcon } from '@heroicons/react/16/solid'

import { ProgramKitMark } from '../components/brand.tsx'

const jobs = [
  'Collect proposals with a flexible call for speakers.',
  'Review submissions and keep speaker tasks moving.',
  'Build the schedule and publish a fast public agenda.',
]

export function SiteView() {
  return (
    <main className="min-h-dvh bg-white px-6 py-8 text-zinc-950 sm:px-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-4xl flex-col sm:min-h-[calc(100dvh-5rem)]">
        <header className="flex items-center justify-between gap-4">
          <a
            href="/"
            aria-label="ProgramKit homepage"
            className="focus-ring flex items-center gap-2.5 rounded-xl"
          >
            <ProgramKitMark className="size-8" />
            <span className="text-base font-semibold">ProgramKit</span>
          </a>
          <a
            href="https://forge.smol.ai/andheller/programkit"
            className="focus-ring flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950"
          >
            <CodeBracketIcon className="size-4" />
            Source
          </a>
        </header>

        <section className="flex flex-1 items-center py-16 sm:py-24">
          <div className="max-w-3xl">
            <h1 className="max-w-[15ch] text-balance text-5xl font-semibold tracking-[-0.04em] sm:text-6xl">
              Run a great conference program.
            </h1>
            <p className="max-w-2xl pt-6 text-pretty text-lg/8 text-zinc-600 sm:text-xl/8">
              ProgramKit is the open source workspace for calls for speakers, reviews, onboarding,
              scheduling, and the public agenda.
            </p>
            <div className="flex flex-wrap gap-3 pt-8">
              <a
                href="https://demo.programkit.dev"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-3.5 text-base font-medium text-white shadow-xs ring-1 ring-blue-700/20 hover:bg-blue-700 sm:min-h-9 sm:text-sm"
              >
                Try the demo
                <ArrowRightIcon className="size-4" />
              </a>
              <a
                href="https://app.programkit.dev/login"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-white px-3.5 text-base font-medium text-zinc-800 shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-50 sm:min-h-9 sm:text-sm"
              >
                Sign in
              </a>
            </div>

            <ul className="grid gap-3 pt-14 text-base/7 text-zinc-700 sm:grid-cols-3 sm:gap-6 sm:text-sm/6">
              {jobs.map((job) => (
                <li key={job} className="border-t border-zinc-950/10 pt-4">
                  {job}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-950/8 pt-5 text-sm text-zinc-500">
          <p>Open source and built for Cloudflare.</p>
          <div className="flex gap-4">
            <a className="focus-ring rounded-md hover:text-zinc-950" href="/privacy">
              Privacy
            </a>
            <a className="focus-ring rounded-md hover:text-zinc-950" href="/terms">
              Terms
            </a>
          </div>
        </footer>
      </div>
    </main>
  )
}
