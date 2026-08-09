import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  DocumentTextIcon,
  GlobeAltIcon,
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

const programFeatures = [
  {
    title: 'Submission forms',
    description: 'Build the CFP, add conditional questions, and map every answer.',
    image: '/assets/marketing/forms.png',
    imageAlt: 'ProgramKit submission form builder',
    icon: DocumentTextIcon,
    iconColor: 'text-blue-600',
    surface: 'bg-blue-50',
    cardClassName: 'lg:col-span-8 lg:row-span-2',
  },
  {
    title: 'Submissions',
    description: 'Triage every proposal from one clear queue.',
    image: '/assets/marketing/submissions.png',
    imageAlt: 'ProgramKit submissions queue',
    icon: InboxStackIcon,
    iconColor: 'text-amber-500',
    surface: 'bg-amber-50',
    cardClassName: 'lg:col-span-4',
  },
  {
    title: 'Review',
    description: 'Keep scoring, assignments, and decisions together.',
    image: '/assets/marketing/reviews.png',
    imageAlt: 'ProgramKit committee review workspace',
    icon: ClipboardDocumentCheckIcon,
    iconColor: 'text-violet-600',
    surface: 'bg-violet-50',
    cardClassName: 'lg:col-span-4',
  },
  {
    title: 'Readiness',
    description: 'See what every speaker still owes.',
    image: '/assets/marketing/readiness.png',
    imageAlt: 'ProgramKit speaker readiness dashboard',
    icon: UserGroupIcon,
    iconColor: 'text-rose-500',
    surface: 'bg-rose-50',
    cardClassName: 'lg:col-span-4',
  },
  {
    title: 'Schedule',
    description: 'Place sessions and catch conflicts before they publish.',
    image: '/assets/marketing/schedule.png',
    imageAlt: 'ProgramKit schedule studio',
    icon: CalendarDaysIcon,
    iconColor: 'text-cyan-600',
    surface: 'bg-cyan-50',
    cardClassName: 'lg:col-span-4',
  },
  {
    title: 'Public agenda',
    description: 'Give attendees a fast, shareable program.',
    image: '/assets/marketing/agenda.png',
    imageAlt: 'ProgramKit public conference agenda',
    icon: GlobeAltIcon,
    iconColor: 'text-emerald-600',
    surface: 'bg-emerald-50',
    cardClassName: 'lg:col-span-4',
  },
]

function ProgramFeatureCard({ feature }: { feature: (typeof programFeatures)[number] }) {
  return (
    <article
      className={`flex min-w-0 flex-col overflow-hidden rounded-[2rem] bg-zinc-50 p-2 ring-1 ring-zinc-950/8 sm:p-3 ${feature.cardClassName}`}
    >
      <div
        className={`relative min-h-64 flex-1 overflow-hidden rounded-[calc(2rem-0.75rem)] outline outline-zinc-950/8 lg:min-h-0 ${feature.surface}`}
      >
        <img
          src={feature.image}
          alt={feature.imageAlt}
          width="1440"
          height="1010"
          loading="lazy"
          className="absolute inset-x-3 bottom-0 w-[calc(100%-1.5rem)] rounded-t-[1.25rem] bg-white object-cover object-top shadow-xl shadow-zinc-950/8 outline outline-zinc-950/8 sm:inset-x-5 sm:w-[calc(100%-2.5rem)]"
        />
      </div>
      <div className="px-3 pt-5 pb-4 sm:px-4 sm:pt-6 sm:pb-5">
        <div className="flex items-center gap-2.5">
          <feature.icon aria-hidden="true" className={`size-5 shrink-0 ${feature.iconColor}`} />
          <h3 className="text-lg font-semibold tracking-tight text-zinc-950">{feature.title}</h3>
        </div>
        <p className="max-w-xl pt-2 text-base/7 text-zinc-600">{feature.description}</p>
      </div>
    </article>
  )
}

const programKitBarGlyphs = {
  P: ['11111', '10001', '11111', '10000', '10000'],
  R: ['11110', '10001', '11110', '10100', '10010'],
  O: ['01110', '10001', '10001', '10001', '01110'],
  G: ['01110', '10000', '10111', '10001', '01110'],
  A: ['01110', '10001', '11111', '10001', '10001'],
  M: ['10001', '11011', '10101', '10001', '10001'],
  K: ['10001', '10010', '11100', '10010', '10001'],
  I: ['11111', '00100', '00100', '00100', '11111'],
  T: ['11111', '00100', '00100', '00100', '00100'],
} as const

type ProgramKitBarLetter = keyof typeof programKitBarGlyphs

const programKitBarWord: ProgramKitBarLetter[] = ['P', 'R', 'O', 'G', 'R', 'A', 'M', 'K', 'I', 'T']

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

function ProgramKitBarGlyph({ letter }: { letter: ProgramKitBarLetter }) {
  const cellSize = 6
  const cellGap = 2
  const cellStep = cellSize + cellGap
  const segments: Array<{ key: string; x: number; y: number; width: number }> = []

  programKitBarGlyphs[letter].forEach((row, rowIndex) => {
    let runStart = -1

    for (let column = 0; column <= row.length; column += 1) {
      const filled = row[column] === '1'
      if (filled && runStart === -1) runStart = column

      if (!filled && runStart !== -1) {
        const runLength = column - runStart
        segments.push({
          key: `${rowIndex}-${runStart}`,
          x: runStart * cellStep,
          y: rowIndex * cellStep,
          width: runLength * cellStep - cellGap,
        })
        runStart = -1
      }
    }
  })

  return (
    <svg
      viewBox="0 0 38 38"
      aria-hidden="true"
      focusable="false"
      className="size-8 shrink-0 overflow-visible sm:size-9"
    >
      {segments.map((segment) => (
        <rect
          key={segment.key}
          x={segment.x}
          y={segment.y}
          width={segment.width}
          height={cellSize}
          rx="2"
          fill="currentColor"
        />
      ))}
    </svg>
  )
}

function ProgramKitBarWord() {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {programKitBarWord.map((letter, index) => (
        <ProgramKitBarGlyph key={`${letter}-${index}`} letter={letter} />
      ))}
    </div>
  )
}

function ProgramKitRhythmBand() {
  return (
    <div
      aria-hidden="true"
      className="select-none overflow-hidden border-y border-zinc-950/8 bg-gradient-to-b from-white to-zinc-50/80 py-4"
    >
      <div className="flex w-max items-center gap-10 px-5 text-blue-600/18 sm:gap-12 sm:px-8">
        {Array.from({ length: 5 }, (_, index) => (
          <ProgramKitBarWord key={index} />
        ))}
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
            <div className="max-w-3xl">
              <h2 className="max-w-[15ch] text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
                Every part, in one place.
              </h2>
              <p className="max-w-xl pt-5 text-pretty text-base/7 text-zinc-600 sm:text-lg/8">
                Move from intake to a published agenda without losing the thread.
              </p>
            </div>

            <div className="grid min-w-0 gap-4 pt-14 md:grid-cols-2 lg:auto-rows-[19rem] lg:grid-cols-12">
              {programFeatures.map((feature) => (
                <ProgramFeatureCard key={feature.title} feature={feature} />
              ))}
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
