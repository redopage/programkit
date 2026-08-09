import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  InboxStackIcon,
  UserGroupIcon,
} from '@heroicons/react/16/solid'

import { ProgramKitMark } from '../components/brand.tsx'

const programJobs = [
  {
    title: 'Call for speakers',
    description: 'Build focused forms, add conditional questions, and route proposals by category.',
    icon: DocumentTextIcon,
    iconColor: 'text-blue-600',
  },
  {
    title: 'Review',
    description:
      'Assign the committee, score consistently, and make decisions across multiple rounds.',
    icon: ClipboardDocumentCheckIcon,
    iconColor: 'text-violet-600',
  },
  {
    title: 'Speaker readiness',
    description:
      'Collect bios, headshots, files, and every remaining task through one clear portal.',
    icon: UserGroupIcon,
    iconColor: 'text-rose-500',
  },
  {
    title: 'Agenda',
    description:
      'Place sessions, catch conflicts, and publish a fast program people can actually use.',
    icon: CalendarDaysIcon,
    iconColor: 'text-emerald-500',
  },
]

const workflowStages = [
  { label: 'Form published', detail: '2 open', icon: DocumentTextIcon, iconColor: 'text-blue-600' },
  {
    label: 'Proposals received',
    detail: '6 received',
    icon: InboxStackIcon,
    iconColor: 'text-amber-500',
  },
  {
    label: 'Committee review',
    detail: '1 awaiting',
    icon: ClipboardDocumentCheckIcon,
    iconColor: 'text-violet-600',
  },
  {
    label: 'Speakers onboarded',
    detail: '15 active',
    icon: UserGroupIcon,
    iconColor: 'text-rose-500',
  },
  {
    label: 'Agenda ready',
    detail: '10 sessions',
    icon: CalendarDaysIcon,
    iconColor: 'text-emerald-500',
  },
]

function BackgroundProgramMark({ active = false }) {
  const surface = active ? 'bg-blue-500/10 ring-blue-400/20' : 'bg-transparent'

  return (
    <div className="grid aspect-[56/58] w-full grid-cols-[20fr_16fr_20fr] grid-rows-5 gap-1.5">
      <span className={`col-span-3 row-start-1 rounded-md ring-1 ring-white/16 ${surface}`} />
      <span className={`row-start-2 rounded-md ring-1 ring-white/16 ${surface}`} />
      <span className={`col-start-3 row-start-2 rounded-md ring-1 ring-white/16 ${surface}`} />
      <span className={`col-span-3 row-start-3 rounded-md ring-1 ring-white/16 ${surface}`} />
      <span className={`row-start-4 rounded-md ring-1 ring-white/16 ${surface}`} />
      <span className={`row-start-5 rounded-md ring-1 ring-white/16 ${surface}`} />
    </div>
  )
}

function FooterProgramField() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-[68%] overflow-hidden"
    >
      <div className="absolute -top-24 -right-20 grid w-[46rem] rotate-6 grid-cols-3 gap-8 opacity-90 sm:-top-32 sm:-right-12 sm:w-[58rem] sm:gap-10">
        {Array.from({ length: 9 }, (_, index) => (
          <BackgroundProgramMark key={index} active={index === 1 || index === 5} />
        ))}
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/70 to-transparent" />
    </div>
  )
}

function ProgramKitRhythmBand() {
  return (
    <div
      aria-hidden="true"
      className="select-none overflow-hidden border-y border-zinc-950/8 bg-zinc-50/60 py-4 sm:py-5"
    >
      <div className="-ml-4 w-max whitespace-nowrap bg-[repeating-linear-gradient(to_bottom,var(--color-blue-600)_0_3px,transparent_3px_8px)] bg-clip-text text-[clamp(2.75rem,6vw,5rem)] leading-[0.82] font-semibold tracking-[0.08em] text-transparent opacity-20">
        PROGRAMKIT&nbsp;&nbsp;PROGRAMKIT&nbsp;&nbsp;PROGRAMKIT&nbsp;&nbsp;PROGRAMKIT
      </div>
    </div>
  )
}

export function SiteView() {
  return (
    <main className="isolate min-h-dvh bg-white text-zinc-950">
      <div className="mx-auto min-h-dvh w-full max-w-[96rem] bg-white ring-1 ring-zinc-950/6 sm:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)]">
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
            <h1 className="max-w-[18ch] text-balance text-5xl font-semibold tracking-[-0.055em] sm:text-7xl lg:text-[5.25rem]">
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
          <div className="mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-blue-600 px-2 pt-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.16)] sm:px-4 sm:pt-4 lg:px-6 lg:pt-6">
            <div className="min-w-0 overflow-hidden rounded-t-[calc(2rem-0.5rem)] bg-white shadow-xl shadow-blue-950/18 outline outline-white/12">
              <div className="relative aspect-[4/3] overflow-hidden sm:aspect-video">
                <img
                  src="/assets/marketing/main-app.png"
                  alt="ProgramKit organizer workspace"
                  width="1440"
                  height="1010"
                  fetchPriority="high"
                  className="absolute top-0 left-[-22%] h-auto w-[165%] max-w-none sm:static sm:aspect-video sm:w-full sm:object-cover sm:object-top"
                />
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="scroll-mt-8 border-y border-zinc-950/8">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:px-10">
            <div className="min-w-0">
              <h2 className="max-w-[14ch] text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                One workspace for the whole program.
              </h2>
              <p className="max-w-xl pt-5 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                Each step keeps the same people, sessions, decisions, and deadlines connected.
              </p>
            </div>

            <dl className="grid min-w-0 gap-x-8 gap-y-10 sm:grid-cols-2">
              {programJobs.map((job) => (
                <div key={job.title} className="min-w-0 border-t border-zinc-950/12 pt-5">
                  <job.icon aria-hidden="true" className={`size-5 ${job.iconColor}`} />
                  <dt className="pt-4 text-lg font-semibold tracking-tight">{job.title}</dt>
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
                <h2 className="max-w-[12ch] text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                  The program stays connected.
                </h2>
                <p className="max-w-xl pt-5 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                  No handoff spreadsheets. No wondering which version is live. Every part moves
                  forward together.
                </p>
              </div>

              <ol
                role="list"
                className="min-w-0 overflow-hidden rounded-[2rem] bg-zinc-50 p-2 ring-1 ring-zinc-950/8 sm:p-3"
              >
                {workflowStages.map((item, index) => (
                  <li
                    key={item.label}
                    className={`grid min-h-14 min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 sm:min-h-16 sm:gap-4 sm:px-4 ${index === 0 ? 'rounded-t-[calc(2rem-0.5rem)]' : ''} ${index === workflowStages.length - 1 ? 'rounded-b-[calc(2rem-0.5rem)]' : 'border-b border-zinc-950/8'}`}
                  >
                    <item.icon aria-hidden="true" className={`size-5 shrink-0 ${item.iconColor}`} />
                    <span className="min-w-0 truncate text-base font-medium text-zinc-900">
                      {item.label}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-zinc-500">
                      {item.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid min-w-0 gap-6 pt-20 lg:grid-cols-2">
              <figure className="min-w-0">
                <div className="overflow-hidden rounded-[2rem] bg-rose-50 p-2 ring-1 ring-zinc-950/8 sm:p-3">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[calc(2rem-0.75rem)] bg-white outline outline-zinc-950/8">
                    <img
                      src="/assets/marketing/readiness.png"
                      alt="ProgramKit speaker readiness dashboard"
                      width="1440"
                      height="1010"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
                <figcaption className="pt-4 text-base font-medium text-zinc-700">
                  See what every speaker still needs.
                </figcaption>
              </figure>

              <figure className="min-w-0">
                <div className="overflow-hidden rounded-[2rem] bg-emerald-50 p-2 ring-1 ring-zinc-950/8 sm:p-3">
                  <div className="relative aspect-[16/10] overflow-hidden rounded-[calc(2rem-0.75rem)] bg-white outline outline-zinc-950/8">
                    <img
                      src="/assets/marketing/schedule.png"
                      alt="ProgramKit schedule studio"
                      width="1440"
                      height="1010"
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover object-top"
                    />
                  </div>
                </div>
                <figcaption className="pt-4 text-base font-medium text-zinc-700">
                  Build the agenda without losing the details.
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="px-3 pb-3 sm:px-6 sm:pb-6 lg:px-8 lg:pb-8">
          <div className="relative mx-auto max-w-[88rem] overflow-hidden rounded-[2rem] bg-zinc-950 px-6 py-12 text-white sm:px-10 sm:py-16 lg:px-14">
            <FooterProgramField />
            <div className="relative min-w-0">
              <h2 className="max-w-[16ch] text-balance text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
                Open source and ready to make your own.
              </h2>
              <p className="max-w-2xl pt-4 text-base/7 text-zinc-400">
                Run ProgramKit on Cloudflare, keep your data portable, and extend the parts your
                event needs.
              </p>
              <div className="flex flex-wrap gap-5 pt-7 text-sm font-medium">
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
          </div>
        </section>

        <ProgramKitRhythmBand />

        <footer>
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
            </nav>
          </div>
        </footer>
      </div>
    </main>
  )
}
