import {
  ArrowPathIcon,
  ArrowRightStartOnRectangleIcon,
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CheckIcon,
  ChevronDownIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  HomeIcon,
  InboxStackIcon,
  IdentificationIcon,
  LinkIcon,
  MagnifyingGlassIcon,
  PaperClipIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { submissionPipelineSummary } from '@programkit/core'

import type { DemoStatus } from '../lib/demo.ts'
import { zonedDateTimeInputToIso } from '../lib/date.ts'
import { publicProgramPath, publicSubmissionPath } from '../lib/public-links.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import { CommandCenter, type CommandMode, type ProgramCommand } from './CommandCenter.tsx'
import { DemoBanner } from './DemoBanner.tsx'
import { Button, cx, Dialog, IconButton } from './ui.tsx'

interface ShellProps {
  pathname: string
  navigate: (to: string) => void
  children: ReactNode
}

const navigation = [
  {
    label: '',
    items: [{ href: '/', label: 'Overview', icon: HomeIcon, iconClass: 'fill-blue-500' }],
  },
  {
    label: 'Program',
    items: [
      { href: '/forms', label: 'Forms', icon: DocumentTextIcon, iconClass: 'fill-blue-500' },
      {
        href: '/submissions',
        label: 'Submissions',
        icon: InboxStackIcon,
        iconClass: 'fill-amber-500',
      },
      {
        href: '/reviews',
        label: 'Review',
        icon: ClipboardDocumentCheckIcon,
        iconClass: 'fill-violet-500',
      },
      {
        href: '/sessions',
        label: 'Sessions',
        icon: RectangleStackIcon,
        iconClass: 'fill-sky-500',
      },
      {
        href: '/schedule',
        label: 'Agenda',
        icon: CalendarDaysIcon,
        iconClass: 'fill-emerald-500',
      },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/crm', label: 'CRM', icon: IdentificationIcon, iconClass: 'fill-fuchsia-500' },
      { href: '/people', label: 'Speakers', icon: UserGroupIcon, iconClass: 'fill-rose-500' },
      {
        href: '/readiness',
        label: 'Tasks',
        icon: ChartBarSquareIcon,
        iconClass: 'fill-teal-500',
      },
      {
        href: '/files',
        label: 'Files',
        icon: PaperClipIcon,
        iconClass: 'fill-orange-500',
      },
      {
        href: '/communications',
        label: 'Communications',
        icon: EnvelopeIcon,
        iconClass: 'fill-indigo-500',
      },
    ],
  },
]

const mobileNavigation = [
  { href: '/', label: 'Home', icon: HomeIcon },
  { href: '/submissions', label: 'Inbox', icon: InboxStackIcon },
  { href: '/schedule', label: 'Agenda', icon: CalendarDaysIcon },
  { href: '/readiness', label: 'Tasks', icon: ChartBarSquareIcon },
]

const commandDetails: Record<
  string,
  {
    description: string
    keywords?: string[]
    shortcut?: readonly [string, string]
    section?: 'Pages' | 'Settings'
    default?: boolean
  }
> = {
  '/': {
    description: 'See the program pulse and next work.',
    keywords: ['home', 'dashboard'],
    shortcut: ['G', 'O'],
    default: true,
  },
  '/forms': {
    description: 'Build public calls for proposals.',
    keywords: ['cfp', 'questions', 'builder'],
    default: true,
  },
  '/submissions': {
    description: 'Triage and decide incoming proposals.',
    keywords: ['inbox', 'abstracts', 'proposals'],
    shortcut: ['G', 'S'],
  },
  '/reviews': {
    description: 'Track committee progress and scorecards.',
    keywords: ['reviewers', 'evaluation', 'committee'],
    shortcut: ['G', 'R'],
  },
  '/sessions': {
    description: 'Manage accepted program content.',
    keywords: ['talks', 'workshops', 'content'],
  },
  '/schedule': {
    description: 'Arrange and publish the agenda.',
    keywords: ['rooms', 'placements', 'studio'],
    shortcut: ['G', 'A'],
  },
  '/people': {
    description: 'Manage speakers and participation.',
    keywords: ['people', 'profiles'],
  },
  '/crm': {
    description: 'Reuse contacts, source speakers, and build outreach lists.',
    keywords: ['contacts', 'directory', 'segments', 'pipeline', 'crm'],
  },
  '/readiness': {
    description: 'Follow speaker tasks and requirements.',
    keywords: ['readiness', 'requirements', 'blockers'],
    shortcut: ['G', 'T'],
  },
  '/files': {
    description: 'Review speaker uploads and version history.',
    keywords: ['deliverables', 'slides', 'documents', 'assets'],
  },
  '/communications': {
    description: 'Draft confirmations and reminders.',
    keywords: ['email', 'campaigns', 'messages'],
  },
  '/settings': {
    description: 'Update event identity, dates, and status.',
    keywords: ['event', 'timezone', 'venue'],
    section: 'Settings',
  },
  '/changes': {
    description: 'Review proposed operational changes.',
    keywords: ['approvals', 'agent', 'audit'],
    section: 'Settings',
  },
  '/integrations': {
    description: 'Connect data and delivery services.',
    keywords: ['airtable', 'api', 'cloudflare'],
    section: 'Settings',
  },
}

function SidebarUtilities({
  navigate,
  onOpenShortcuts,
  demoUrl,
  eventId,
  onNavigate,
}: {
  navigate: (to: string) => void
  onOpenShortcuts: () => void
  demoUrl?: string
  eventId?: string
  onNavigate?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const hostedApp =
    document.querySelector<HTMLMetaElement>('meta[name="programkit-deployment-profile"]')
      ?.content === 'hosted-app'
  const open = (to: string) => {
    navigate(to)
    onNavigate?.()
  }
  const copyLink = async () => {
    if (!demoUrl) return
    await navigator.clipboard.writeText(demoUrl)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }
  const signOut = async () => {
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
      })
      if (!response.ok) return
      window.location.assign('/login')
    } catch {
      // Keep the current session visible when sign-out cannot reach the server.
    }
  }
  const items = [
    {
      label: demoUrl ? 'View public page' : 'Preview public page',
      icon: ArrowTopRightOnSquareIcon,
      action: () => open(eventId ? publicProgramPath(eventId) : '/agenda'),
    },
    ...(demoUrl
      ? [
          {
            label: copied ? 'Link copied' : 'Copy demo link',
            icon: copied ? CheckIcon : LinkIcon,
            action: () => void copyLink(),
          },
          {
            label: 'Demo options',
            icon: ArrowPathIcon,
            action: () => open('/demo'),
          },
        ]
      : []),
    { label: 'Settings', icon: Cog6ToothIcon, action: () => open('/settings') },
    {
      label: 'Keyboard shortcuts',
      icon: QuestionMarkCircleIcon,
      action: () => {
        onOpenShortcuts()
        onNavigate?.()
      },
    },
    ...(hostedApp
      ? [
          {
            label: 'Sign out',
            icon: ArrowRightStartOnRectangleIcon,
            action: () => void signOut(),
          },
        ]
      : []),
  ]
  return (
    <div className="border-t border-zinc-950/6 pt-2">
      {items.map(({ label, icon: Icon, action }) => (
        <button
          key={label}
          type="button"
          className="focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2 text-left text-[0.9375rem] font-medium text-zinc-700 hover:bg-zinc-950/4 hover:text-zinc-950 sm:min-h-8 sm:text-sm"
          onClick={action}
        >
          <Icon
            className={cx(
              'size-4 shrink-0 fill-zinc-500',
              copied && label === 'Link copied' && 'fill-emerald-600',
            )}
          />
          <span className="min-w-0 truncate">{label}</span>
        </button>
      ))}
    </div>
  )
}

function NavigationItems({
  pathname,
  navigate,
  onNavigate,
}: {
  pathname: string
  navigate: (to: string) => void
  onNavigate?: () => void
}) {
  return (
    <nav aria-label="Primary navigation">
      <div className="flex flex-col gap-4">
        {navigation.map((group) => (
          <div key={group.label || 'primary'}>
            {group.label ? (
              <p className="px-2 pb-1 text-sm font-medium text-zinc-500">{group.label}</p>
            ) : null}
            <ul role="list" className="flex flex-col gap-px">
              {group.items.map((item) => {
                const active =
                  item.href === '/'
                    ? pathname === '/'
                    : pathname === item.href || pathname.startsWith(`${item.href}/`)
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <a
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      onClick={(event) => {
                        event.preventDefault()
                        navigate(item.href)
                        onNavigate?.()
                      }}
                      className={cx(
                        'group focus-ring flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-[0.9375rem] font-medium text-zinc-700 sm:min-h-8 sm:text-sm',
                        active && 'bg-zinc-950/6 text-zinc-950',
                        !active && 'hover:bg-zinc-950/4 hover:text-zinc-950',
                      )}
                    >
                      <Icon
                        className={cx(
                          'size-4 h-lh shrink-0 opacity-80 motion-safe:transition-opacity group-hover:opacity-100',
                          item.iconClass,
                          active && 'opacity-100',
                        )}
                      />
                      <span className="min-w-0 truncate">{item.label}</span>
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  )
}

interface AccountEvent {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

interface AccountSummary {
  events: AccountEvent[]
  activeEventId: string
}

interface NewEventDraft {
  name: string
  startsOn: string
  endsOn: string
  timezone: string
  venue: string
  city: string
}

function dateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function newEventDraft(): NewEventDraft {
  const starts = new Date()
  starts.setDate(starts.getDate() + 90)
  const ends = new Date(starts)
  ends.setDate(ends.getDate() + 2)
  return {
    name: '',
    startsOn: dateInputValue(starts),
    endsOn: dateInputValue(ends),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    venue: '',
    city: '',
  }
}

const eventCreationControl =
  'focus-ring min-h-11 w-full rounded-xl bg-white px-3 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-10 sm:text-sm'

function WorkspaceIdentity({ commandOpen }: { commandOpen: boolean }) {
  const { payload } = useWorkspace()
  const state = payload?.state
  const event = state?.events.find((entry) => entry.id === state.activeEventId)
  const [open, setOpen] = useState(false)
  const [account, setAccount] = useState<AccountSummary | null>(null)
  const [creating, setCreating] = useState(false)
  const [eventDraft, setEventDraft] = useState<NewEventDraft>(newEventDraft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const eventNameRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handlePointerDown = (pointerEvent: PointerEvent) => {
      const target = pointerEvent.target
      if (!(target instanceof Node)) return
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key !== 'Escape') return
      keyboardEvent.preventDefault()
      keyboardEvent.stopPropagation()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (commandOpen) setOpen(false)
  }, [commandOpen])

  useEffect(() => {
    if (!open || account) return
    const controller = new AbortController()
    void fetch('/api/v1/account', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return
        const body = (await response.json()) as { ok?: boolean; account?: AccountSummary }
        if (body.ok && body.account) setAccount(body.account)
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
      })
    return () => controller.abort()
  }, [account, open])

  const selectEvent = async (eventId: string) => {
    if (!account || eventId === account.activeEventId) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/account/active-event', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ eventId }),
      })
      if (!response.ok) throw new Error('The event could not be opened.')
      window.location.assign('/')
    } catch {
      setSaving(false)
      setError('The event could not be opened.')
    }
  }

  const createEvent = async () => {
    setSaving(true)
    setError(null)
    try {
      const startsAt = zonedDateTimeInputToIso(`${eventDraft.startsOn}T09:00`, eventDraft.timezone)
      const endsAt = zonedDateTimeInputToIso(`${eventDraft.endsOn}T17:00`, eventDraft.timezone)
      if (Date.parse(startsAt) >= Date.parse(endsAt)) {
        throw new Error('The event end must be after its start.')
      }
      const response = await fetch('/api/v1/events', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: eventDraft.name,
          startsAt,
          endsAt,
          timezone: eventDraft.timezone,
          venue: eventDraft.venue,
          city: eventDraft.city,
        }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? 'The event could not be created.')
      }
      window.location.assign('/')
    } catch (caught) {
      setSaving(false)
      setError(caught instanceof Error ? caught.message : 'The event could not be created.')
    }
  }

  const events =
    account?.events ??
    (event ? [{ id: event.id, name: event.name, slug: event.slug, role: 'owner' as const }] : [])
  const activeEventId = account?.activeEventId ?? event?.id
  const initials = (event?.name ?? 'Event')
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase()

  return (
    <>
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          onClick={() => setOpen((current) => !current)}
          className="focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left hover:bg-zinc-950/4 sm:min-h-9"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
            {initials}
          </span>
          <span className="min-w-0 flex-1 truncate text-base font-medium text-zinc-950 sm:text-sm">
            {event?.name ?? 'Choose an event'}
          </span>
          <ChevronDownIcon
            className={cx(
              'size-4 shrink-0 fill-zinc-400 motion-safe:transition-transform',
              open && 'rotate-180',
            )}
          />
        </button>

        {open ? (
          <div
            ref={popoverRef}
            id={popoverId}
            role="dialog"
            aria-label="Choose an event"
            className="absolute top-full left-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-(--popover-radius) bg-zinc-900/90 p-(--popover-padding) shadow-2xl ring-1 ring-white/15 backdrop-blur-xl [--popover-padding:--spacing(1.5)] [--popover-radius:var(--radius-2xl)] motion-safe:animate-rise-in"
          >
            <div className="grid gap-1">
              {events.map((candidate) => (
                <button
                  key={candidate.id}
                  type="button"
                  className="focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-[calc(var(--popover-radius)-var(--popover-padding))] px-2 text-left text-base text-zinc-200 hover:bg-white/8 hover:text-white disabled:cursor-wait sm:min-h-9 sm:text-sm"
                  onClick={() => void selectEvent(candidate.id)}
                  disabled={saving}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-blue-500/20 text-xs font-semibold text-blue-200 ring-1 ring-blue-300/15">
                    {candidate.name.slice(0, 2).toLocaleUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{candidate.name}</span>
                  {candidate.id === activeEventId ? (
                    <CheckIcon className="size-4 shrink-0 fill-blue-300" />
                  ) : null}
                </button>
              ))}
            </div>
            {account ? (
              <div className="mt-1 border-t border-white/10 pt-1">
                <button
                  type="button"
                  className="focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-[calc(var(--popover-radius)-var(--popover-padding))] px-2 text-left text-base text-zinc-300 hover:bg-white/8 hover:text-white sm:min-h-9 sm:text-sm"
                  onClick={() => {
                    setOpen(false)
                    setError(null)
                    setCreating(true)
                  }}
                >
                  <PlusIcon className="size-4 shrink-0 fill-zinc-500" />
                  New event
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <Dialog
        open={creating}
        onClose={() => {
          if (saving) return
          setCreating(false)
          setEventDraft(newEventDraft())
          setError(null)
        }}
        title="Create an event"
        description="Add the basics now. Rooms, tracks, and forms come next."
        initialFocusRef={eventNameRef}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false)
                setEventDraft(newEventDraft())
                setError(null)
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              form="new-event-form"
              disabled={saving || eventDraft.name.trim().length < 2}
            >
              {saving ? 'Creating…' : 'Create event'}
            </Button>
          </>
        }
      >
        <form
          id="new-event-form"
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            void createEvent()
          }}
        >
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Event name</span>
            <input
              ref={eventNameRef}
              required
              value={eventDraft.name}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({ ...current, name: changeEvent.currentTarget.value }))
              }
              placeholder="DevFlow Conf 2027"
              className={eventCreationControl}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-800">Starts</span>
            <input
              type="date"
              required
              value={eventDraft.startsOn}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({
                  ...current,
                  startsOn: changeEvent.currentTarget.value,
                }))
              }
              className={eventCreationControl}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-800">Ends</span>
            <input
              type="date"
              required
              min={eventDraft.startsOn}
              value={eventDraft.endsOn}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({
                  ...current,
                  endsOn: changeEvent.currentTarget.value,
                }))
              }
              className={eventCreationControl}
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="text-sm font-medium text-zinc-800">Timezone</span>
            <select
              value={eventDraft.timezone}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({
                  ...current,
                  timezone: changeEvent.currentTarget.value,
                }))
              }
              className={eventCreationControl}
            >
              {timeZones.map((timeZone) => (
                <option key={timeZone} value={timeZone}>
                  {timeZone.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-800">Venue</span>
            <input
              value={eventDraft.venue}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({ ...current, venue: changeEvent.currentTarget.value }))
              }
              placeholder="Moscone West"
              className={eventCreationControl}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-sm font-medium text-zinc-800">City</span>
            <input
              value={eventDraft.city}
              onChange={(changeEvent) =>
                setEventDraft((current) => ({ ...current, city: changeEvent.currentTarget.value }))
              }
              placeholder="San Francisco"
              className={eventCreationControl}
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-red-700 sm:col-span-2">
              {error}
            </p>
          ) : null}
        </form>
      </Dialog>
    </>
  )
}

export function Shell({ pathname, navigate, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandMode, setCommandMode] = useState<CommandMode>(null)
  const [demoStatus, setDemoStatus] = useState<DemoStatus | null>(null)
  const demoActive = demoStatus?.active === true
  const demoUrl = demoStatus?.active ? demoStatus.demo?.url : undefined
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const mobileTitleId = useId()
  const { payload } = useWorkspace()
  const activeEvent = payload?.state.events.find(
    (event) => event.id === payload.state.activeEventId,
  )
  const pendingChanges =
    payload?.state.changeSets.filter((changeSet) => changeSet.status === 'awaiting_approval')
      .length ?? 0
  const commands = useMemo<ProgramCommand[]>(() => {
    const pipeline = payload ? submissionPipelineSummary(payload.state) : null
    const blockers = payload?.derived.readiness.blockers ?? 0
    const conflicts = payload?.derived.scheduleConflicts.length ?? 0
    const suggestedCommands: ProgramCommand[] = [
      {
        id: 'action-review-new',
        label: 'Review new submissions',
        description: 'Open proposals that are ready for triage.',
        href: '/submissions?status=submitted',
        section: 'Suggested',
        icon: InboxStackIcon,
        keywords: ['new', 'inbox', 'triage', 'proposals'],
        default: true,
        meta: pipeline?.submitted ? `${pipeline.submitted} new` : 'Inbox clear',
      },
      {
        id: 'action-speaker-tasks',
        label: 'Check speaker tasks',
        description: 'Find missing, overdue, and review-ready speaker work.',
        href: '/readiness',
        section: 'Suggested',
        icon: ChartBarSquareIcon,
        keywords: ['readiness', 'requirements', 'blockers', 'overdue'],
        default: true,
        meta: blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'}` : 'All clear',
      },
      {
        id: 'action-schedule',
        label: 'Open schedule studio',
        description: 'Arrange sessions, rooms, and times on the draft agenda.',
        href: '/schedule',
        section: 'Suggested',
        icon: CalendarDaysIcon,
        keywords: ['agenda', 'schedule', 'rooms', 'conflicts'],
        default: true,
        meta: conflicts ? `${conflicts} conflict${conflicts === 1 ? '' : 's'}` : 'Ready',
      },
    ]
    const pageCommands: ProgramCommand[] = navigation.flatMap((group) =>
      group.items.map((item) => {
        const details = commandDetails[item.href]
        return {
          id: `page-${item.href === '/' ? 'overview' : item.href.slice(1)}`,
          label: item.label,
          description: details?.description ?? `Open ${item.label.toLocaleLowerCase()}.`,
          href: item.href,
          section: details?.section ?? ('Pages' as const),
          icon: item.icon,
          keywords: details?.keywords,
          shortcut: details?.shortcut,
          default: details?.default,
        }
      }),
    )
    pageCommands.push(
      {
        id: 'page-settings',
        label: 'Event settings',
        description: commandDetails['/settings'].description,
        href: '/settings',
        section: 'Settings',
        icon: Cog6ToothIcon,
        keywords: commandDetails['/settings'].keywords,
      },
      {
        id: 'page-changes',
        label: 'Change review',
        description: commandDetails['/changes'].description,
        href: '/changes',
        section: 'Settings',
        icon: Squares2X2Icon,
        keywords: commandDetails['/changes'].keywords,
        meta: pendingChanges ? `${pendingChanges} pending` : undefined,
      },
      {
        id: 'page-integrations',
        label: 'Integrations',
        description: commandDetails['/integrations'].description,
        href: '/integrations',
        section: 'Settings',
        icon: CircleStackIcon,
        keywords: commandDetails['/integrations'].keywords,
      },
      {
        id: 'page-agent',
        label: 'Agent workspace',
        description: 'Review agent proposals and available tools.',
        href: '/agent',
        section: 'Settings',
        icon: CpuChipIcon,
        keywords: ['mcp', 'automation', 'assistant'],
      },
    )

    const publicCommands: ProgramCommand[] = [
      {
        id: 'public-program',
        label: 'Published program',
        description: 'Open the attendee-facing agenda.',
        href: payload ? publicProgramPath(payload.state.activeEventId) : '/agenda',
        section: 'Public',
        icon: CalendarDaysIcon,
        keywords: ['public', 'embed', 'attendees'],
        default: true,
      },
    ]
    const openForm = payload?.state.submissionForms.find(
      (form) => form.eventId === payload.state.activeEventId && form.status === 'open',
    )
    if (openForm) {
      publicCommands.push({
        id: 'public-cfp',
        label: 'Public call for proposals',
        description: 'See the form as a prospective speaker.',
        href: publicSubmissionPath(openForm.eventId, openForm.slug),
        section: 'Public',
        icon: DocumentTextIcon,
        keywords: ['cfp', 'submit', 'speaker', 'preview'],
        default: true,
      })
    }
    return [...suggestedCommands, ...pageCommands, ...publicCommands]
  }, [payload])

  useEffect(() => {
    if (!mobileOpen) return
    const panel = mobilePanelRef.current
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    const appRoot = document.getElementById('root')
    const rootWasInert = appRoot?.inert ?? false
    const rootAriaHidden = appRoot?.getAttribute('aria-hidden')
    document.body.style.overflow = 'hidden'
    if (appRoot) {
      appRoot.inert = true
      appRoot.setAttribute('aria-hidden', 'true')
    }
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const frame = window.requestAnimationFrame(() => {
      panel?.querySelector<HTMLElement>(focusableSelector)?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
      if (controls.length === 0) return
      const first = controls[0]
      const last = controls.at(-1)!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      if (appRoot) {
        appRoot.inert = rootWasInert
        if (rootAriaHidden == null) appRoot.removeAttribute('aria-hidden')
        else appRoot.setAttribute('aria-hidden', rootAriaHidden)
      }
      previousFocus?.focus()
    }
  }, [mobileOpen])

  return (
    <>
      <DemoBanner onStatusChange={setDemoStatus} />
      <div
        className={cx(
          'isolate min-h-dvh antialiased max-lg:bg-white lg:flex lg:bg-canvas',
          demoActive &&
            'pt-[calc(3rem+env(safe-area-inset-top))] sm:pt-[calc(2.5rem+env(safe-area-inset-top))]',
        )}
      >
        <aside
          className={cx(
            'fixed bottom-0 left-0 z-30 hidden w-60 flex-col p-2 lg:flex',
            demoActive ? 'top-[calc(2.5rem+env(safe-area-inset-top))]' : 'top-0',
          )}
        >
          <div className="flex flex-col gap-1.5">
            <div className="min-w-0">
              <WorkspaceIdentity commandOpen={commandMode !== null} />
            </div>
            <div>
              <button
                type="button"
                aria-keyshortcuts="Meta+K Control+K /"
                onClick={() => setCommandMode('commands')}
                className="focus-ring group flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-950/4 hover:text-zinc-950"
              >
                <MagnifyingGlassIcon className="size-4 shrink-0 fill-zinc-500" />
                <span className="min-w-0 flex-1 truncate">Search</span>
                <kbd className="font-sans text-xs font-normal text-zinc-400">⌘K</kbd>
              </button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-2">
            <NavigationItems pathname={pathname} navigate={navigate} />
          </div>
          <SidebarUtilities
            navigate={navigate}
            onOpenShortcuts={() => setCommandMode('shortcuts')}
            demoUrl={demoUrl}
            eventId={activeEvent?.id}
          />
        </aside>

        <header
          className={cx(
            'fixed inset-x-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end justify-between border-b border-zinc-950/5 bg-white/95 px-4 pb-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden',
            demoActive
              ? 'top-[calc(3rem+env(safe-area-inset-top))] sm:top-[calc(2.5rem+env(safe-area-inset-top))]'
              : 'top-0',
          )}
        >
          <a
            href="/"
            aria-label="Event overview"
            className="focus-ring flex min-w-0 items-center gap-2 rounded-md text-base font-medium text-zinc-950"
            onClick={(event) => {
              event.preventDefault()
              navigate('/')
            }}
          >
            <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-blue-600 text-sm font-semibold text-white">
              AI
            </span>
            <span className="min-w-0 truncate">{activeEvent?.name ?? 'Program workspace'}</span>
          </a>
          <IconButton label="Search ProgramKit" onClick={() => setCommandMode('commands')}>
            <MagnifyingGlassIcon className="size-4 shrink-0 fill-current" />
          </IconButton>
        </header>

        {mobileOpen
          ? createPortal(
              <div
                className="fixed inset-0 z-50 lg:hidden"
                role="dialog"
                aria-modal="true"
                aria-labelledby={mobileTitleId}
              >
                <div
                  className="absolute inset-0 cursor-default bg-zinc-950/20 backdrop-blur-[1px] motion-safe:animate-fade-in"
                  aria-hidden="true"
                  onClick={() => setMobileOpen(false)}
                />
                <div
                  ref={mobilePanelRef}
                  className="absolute inset-y-0 left-0 flex w-[min(86vw,20rem)] flex-col rounded-r-2xl bg-white p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] pt-[max(--spacing(3),env(safe-area-inset-top))] shadow-2xl ring-1 ring-black/5 motion-safe:animate-slide-from-left"
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <WorkspaceIdentity commandOpen={commandMode !== null} />
                    </div>
                    <IconButton label="Close navigation" onClick={() => setMobileOpen(false)}>
                      <XMarkIcon className="size-4 shrink-0 fill-current" />
                    </IconButton>
                  </div>
                  <h2 id={mobileTitleId} className="sr-only">
                    Navigation
                  </h2>
                  <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                    <NavigationItems
                      pathname={pathname}
                      navigate={navigate}
                      onNavigate={() => setMobileOpen(false)}
                    />
                  </div>
                  <SidebarUtilities
                    navigate={navigate}
                    onOpenShortcuts={() => setCommandMode('shortcuts')}
                    demoUrl={demoUrl}
                    eventId={activeEvent?.id}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
              </div>,
              document.body,
            )
          : null}

        <CommandCenter
          mode={commandMode}
          onModeChange={setCommandMode}
          commands={commands}
          pathname={pathname}
          navigate={navigate}
        />

        <nav
          aria-label="Mobile primary navigation"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-950/5 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        >
          <ul role="list" className="grid grid-cols-5 px-1">
            {mobileNavigation.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname === item.href || pathname.startsWith(`${item.href}/`)
              const Icon = item.icon
              return (
                <li key={item.href}>
                  <a
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={(event) => {
                      event.preventDefault()
                      navigate(item.href)
                    }}
                    className={cx(
                      'group focus-ring flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-sm',
                      active ? 'text-blue-600' : 'text-zinc-500 hover:text-zinc-950',
                    )}
                  >
                    <Icon
                      className={cx(
                        'size-4 shrink-0',
                        active ? 'fill-blue-600' : 'fill-zinc-500 group-hover:fill-zinc-950',
                      )}
                    />
                    <p>{item.label}</p>
                  </a>
                </li>
              )
            })}
            <li>
              <button
                type="button"
                aria-label="Open all navigation"
                onClick={() => setMobileOpen(true)}
                className={cx(
                  'group focus-ring flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-lg text-sm',
                  mobileNavigation.some(
                    (item) =>
                      pathname === item.href ||
                      (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
                  )
                    ? 'text-zinc-500 hover:text-zinc-950'
                    : 'text-blue-600',
                )}
              >
                <Bars3Icon
                  className={cx(
                    'size-4 shrink-0',
                    mobileNavigation.some(
                      (item) =>
                        pathname === item.href ||
                        (item.href !== '/' && pathname.startsWith(`${item.href}/`)),
                    )
                      ? 'fill-zinc-500 group-hover:fill-zinc-950'
                      : 'fill-blue-600',
                  )}
                />
                <p>More</p>
              </button>
            </li>
          </ul>
        </nav>

        <main className="min-w-0 flex-1 pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pb-0 lg:pt-0 lg:pl-60">
          {/* The panel floats on the canvas, so the workspace reads as one document
            with the navigation living outside it. */}
          <div className="lg:py-2 lg:pr-2">
            <div
              className={cx(
                'min-h-full bg-white p-4 sm:p-6 lg:rounded-2xl lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5',
                demoActive
                  ? 'lg:min-h-[calc(100dvh-(--spacing(4))-2.5rem-env(safe-area-inset-top))]'
                  : 'lg:min-h-[calc(100dvh-(--spacing(4)))]',
              )}
            >
              <div className="mx-auto w-full max-w-[100rem]">{children}</div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}
