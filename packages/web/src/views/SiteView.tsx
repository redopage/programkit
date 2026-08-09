import { ArrowRightIcon } from '@heroicons/react/16/solid'

import { ProgramKitMark } from '../components/brand.tsx'

const programJobs = [
  {
    title: 'Call for speakers',
    description: 'Build focused forms, add conditional questions, and route proposals by category.',
  },
  {
    title: 'Review',
    description:
      'Assign the committee, score consistently, and make decisions across multiple rounds.',
  },
  {
    title: 'Speaker readiness',
    description:
      'Collect bios, headshots, files, and every remaining task through one clear portal.',
  },
  {
    title: 'Agenda',
    description:
      'Place sessions, catch conflicts, and publish a fast program people can actually use.',
  },
]

const workflowBars = [
  { label: 'Forms', width: 'w-full', color: 'bg-blue-600 text-white' },
  { label: 'Submissions', width: 'w-[82%]', color: 'bg-blue-100 text-blue-950' },
  { label: 'Reviews', width: 'w-[68%]', color: 'bg-violet-100 text-violet-950' },
  { label: 'Speakers', width: 'w-[88%]', color: 'bg-amber-100 text-amber-950' },
  { label: 'Agenda', width: 'w-[58%]', color: 'bg-emerald-100 text-emerald-950' },
]

export function SiteView() {
  return (
    <main className="isolate min-h-dvh bg-[#f5f7ff] text-zinc-950">
      <div className="mx-auto min-h-dvh w-full max-w-[96rem] bg-white shadow-[0_0_0_1px_rgba(24,24,27,0.06)] sm:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)]">
        <header className="border-b border-zinc-950/8">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:min-h-18 sm:px-8 lg:px-10">
            <a
              href="/"
              aria-label="Homepage"
              className="focus-ring flex min-w-0 items-center gap-2.5 rounded-xl"
            >
              <ProgramKitMark className="size-7" />
              <span className="text-base font-semibold tracking-tight">ProgramKit</span>
            </a>

            <nav aria-label="Main navigation" className="flex items-center gap-1 sm:gap-2">
              <a
                href="#product"
                className="focus-ring hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950 sm:inline-flex"
              >
                Product
              </a>
              <a
                href="https://forge.smol.ai/andheller/programkit"
                className="focus-ring hidden min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-950/4 hover:text-zinc-950 md:inline-flex"
              >
                Source
              </a>
              <a
                href="https://app.programkit.dev/login"
                className="focus-ring inline-flex min-h-10 items-center rounded-full px-3 text-sm font-medium text-zinc-700 hover:bg-zinc-950/4 hover:text-zinc-950"
              >
                Sign in
              </a>
            </nav>
          </div>
        </header>

        <section className="px-5 pt-20 pb-12 sm:px-8 sm:pt-28 sm:pb-16 lg:px-10 lg:pt-32">
          <div className="mx-auto flex max-w-5xl flex-col items-center text-center">
            <h1 className="max-w-[18ch] text-balance text-5xl/[0.96] font-semibold tracking-[-0.055em] sm:text-7xl/[0.94] lg:text-[5.25rem]/[0.92]">
              From call for speakers to showtime.
            </h1>
            <p className="max-w-4xl pt-6 text-pretty text-lg/8 text-zinc-600 sm:text-xl/8">
              Collect proposals, run reviews, onboard speakers, build the schedule, and publish the
              agenda.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-8">
              <a
                href="https://demo.programkit.dev"
                className="focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-blue-600 px-5 text-base font-medium text-white shadow-xs ring-1 ring-blue-700/20 hover:bg-blue-700 sm:min-h-10 sm:text-sm"
              >
                Try the demo
                <ArrowRightIcon className="size-4 shrink-0" />
              </a>
              <a
                href="https://forge.smol.ai/andheller/programkit"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 text-base font-medium text-zinc-800 shadow-xs ring-1 ring-zinc-950/12 hover:bg-zinc-50 sm:min-h-10 sm:text-sm"
              >
                View the source
              </a>
            </div>
          </div>
        </section>

        <section className="px-3 pb-24 sm:px-6 sm:pb-32 lg:px-8">
          <div className="mx-auto max-w-[88rem] rounded-[2rem] bg-blue-600 p-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] sm:p-4 lg:p-6">
            <div className="grid min-w-0 gap-2 sm:gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.55fr)] lg:gap-6">
              <div className="min-w-0 overflow-hidden rounded-[calc(2rem-0.5rem)] bg-white shadow-xl shadow-blue-950/18 outline outline-white/12">
                <img
                  src="/assets/marketing/form-preview.jpg"
                  alt="ProgramKit call for speakers form preview"
                  width="877"
                  height="747"
                  fetchPriority="high"
                  className="aspect-[16/10] h-full w-full object-cover object-top"
                />
              </div>
              <div className="hidden min-w-0 overflow-hidden rounded-[calc(2rem-0.5rem)] bg-white shadow-xl shadow-blue-950/18 outline outline-white/12 sm:block">
                <img
                  src="/assets/marketing/overview.jpg"
                  alt="ProgramKit organizer overview"
                  width="706"
                  height="747"
                  className="aspect-[16/10] h-full w-full object-cover object-top lg:aspect-auto"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="scroll-mt-8 border-y border-zinc-950/8">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10">
            <div className="min-w-0">
              <h2 className="max-w-[14ch] text-balance text-4xl/[1.02] font-semibold tracking-[-0.045em] sm:text-5xl/[1]">
                One workspace for the whole program.
              </h2>
              <p className="max-w-xl pt-5 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                Each step keeps the same people, sessions, decisions, and deadlines connected.
              </p>
            </div>

            <dl className="grid min-w-0 gap-x-8 gap-y-10 sm:grid-cols-2">
              {programJobs.map((job, index) => (
                <div key={job.title} className="min-w-0 border-t border-zinc-950/12 pt-5">
                  <div
                    aria-hidden="true"
                    className={`h-1.5 rounded-full bg-blue-600 ${index % 2 === 0 ? 'w-16' : 'w-10'}`}
                  />
                  <dt className="pt-5 text-lg font-semibold tracking-tight">{job.title}</dt>
                  <dd className="pt-2 text-base/7 text-zinc-600">{job.description}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-10">
          <div className="mx-auto max-w-7xl">
            <div className="grid min-w-0 items-end gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div className="min-w-0">
                <h2 className="max-w-[12ch] text-balance text-4xl/[1.02] font-semibold tracking-[-0.045em] sm:text-5xl/[1]">
                  The program stays connected.
                </h2>
                <p className="max-w-xl pt-5 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                  No handoff spreadsheets. No wondering which version is live. Every part moves
                  forward together.
                </p>
              </div>

              <ol
                role="list"
                className="flex min-w-0 flex-col gap-2 rounded-[2rem] bg-zinc-50 p-3 ring-1 ring-zinc-950/8 sm:p-5"
              >
                {workflowBars.map((item) => (
                  <li
                    key={item.label}
                    className={`${item.width} ${item.color} flex min-h-12 items-center rounded-[calc(2rem-0.75rem)] px-5 text-base font-medium sm:min-h-14`}
                  >
                    {item.label}
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid min-w-0 gap-6 pt-20 lg:grid-cols-2">
              <figure className="min-w-0">
                <div className="overflow-hidden rounded-[2rem] bg-zinc-100 p-2 ring-1 ring-zinc-950/8 sm:p-3">
                  <img
                    src="/assets/marketing/readiness.jpg"
                    alt="ProgramKit speaker readiness dashboard"
                    width="877"
                    height="747"
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[calc(2rem-0.75rem)] object-cover object-top outline outline-zinc-950/8"
                  />
                </div>
                <figcaption className="pt-4 text-base font-medium text-zinc-700">
                  See what every speaker still needs.
                </figcaption>
              </figure>

              <figure className="min-w-0">
                <div className="overflow-hidden rounded-[2rem] bg-zinc-100 p-2 ring-1 ring-zinc-950/8 sm:p-3">
                  <img
                    src="/assets/marketing/schedule.jpg"
                    alt="ProgramKit schedule studio"
                    width="877"
                    height="747"
                    loading="lazy"
                    className="aspect-[4/3] w-full rounded-[calc(2rem-0.75rem)] object-cover object-top outline outline-zinc-950/8"
                  />
                </div>
                <figcaption className="pt-4 text-base font-medium text-zinc-700">
                  Build the agenda without losing the details.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="px-3 pb-3 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <div className="mx-auto grid max-w-[88rem] gap-8 rounded-[2rem] bg-zinc-950 px-6 py-12 text-white sm:px-10 sm:py-16 lg:grid-cols-[1fr_auto] lg:items-end lg:px-14">
            <div className="min-w-0">
              <ProgramKitMark className="size-9" />
              <h2 className="max-w-[16ch] pt-8 text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Open source and ready to make your own.
              </h2>
              <p className="max-w-2xl pt-4 text-base/7 text-zinc-400">
                Run ProgramKit on Cloudflare, keep your data portable, and extend the parts your
                event needs.
              </p>
            </div>
            <div className="flex flex-wrap gap-5 text-sm font-medium">
              <a
                href="https://forge.smol.ai/andheller/programkit"
                className="focus-ring rounded-md text-white underline decoration-white/30 underline-offset-4 hover:decoration-white"
              >
                Browse the code
              </a>
              <a
                href="https://app.programkit.dev/login"
                className="focus-ring rounded-md text-zinc-300 underline decoration-white/20 underline-offset-4 hover:text-white hover:decoration-white"
              >
                Sign in
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-950/8">
          <div className="mx-auto flex min-h-24 max-w-7xl flex-col justify-center gap-5 px-5 py-6 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10">
            <a
              href="/"
              aria-label="Homepage"
              className="focus-ring flex w-fit items-center gap-2.5 rounded-lg text-zinc-950"
            >
              <ProgramKitMark className="h-6 w-auto" />
              <span className="font-semibold">ProgramKit</span>
            </a>
            <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2">
              <a className="focus-ring rounded-md hover:text-zinc-950" href="/privacy">
                Privacy
              </a>
              <a className="focus-ring rounded-md hover:text-zinc-950" href="/terms">
                Terms
              </a>
              <a
                className="focus-ring rounded-md hover:text-zinc-950"
                href="https://forge.smol.ai/andheller/programkit"
              >
                Forge
              </a>
              <a
                className="focus-ring rounded-md hover:text-zinc-950"
                href="https://github.com/redopage/programkit"
              >
                GitHub
              </a>
            </nav>
          </div>
        </footer>
      </div>
    </main>
  )
}
