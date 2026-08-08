import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ChevronDownIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  CpuChipIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  EnvelopeIcon,
  HomeIcon,
  InboxStackIcon,
  RectangleStackIcon,
  Squares2X2Icon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useWorkspace } from '../lib/workspace.tsx'
import { cx, IconButton } from './ui.tsx'

interface ShellProps {
  pathname: string
  navigate: (to: string) => void
  children: ReactNode
}

// Each workspace object keeps one hue everywhere it appears, so the sidebar can
// be scanned by colour before the label is read.
const navigation = [
  {
    label: '',
    items: [{ href: '/', label: 'Overview', icon: HomeIcon, tint: 'fill-zinc-500' }],
  },
  {
    label: 'Program',
    items: [
      { href: '/forms', label: 'Submission forms', icon: DocumentTextIcon, tint: 'fill-blue-500' },
      { href: '/submissions', label: 'Submissions', icon: InboxStackIcon, tint: 'fill-amber-500' },
      {
        href: '/reviews',
        label: 'Review',
        icon: ClipboardDocumentCheckIcon,
        tint: 'fill-violet-500',
      },
      { href: '/sessions', label: 'Sessions', icon: RectangleStackIcon, tint: 'fill-sky-500' },
      { href: '/schedule', label: 'Agenda', icon: CalendarDaysIcon, tint: 'fill-emerald-500' },
    ],
  },
  {
    label: 'People',
    items: [
      { href: '/people', label: 'Speakers', icon: UserGroupIcon, tint: 'fill-rose-500' },
      { href: '/readiness', label: 'Tasks', icon: ChartBarSquareIcon, tint: 'fill-teal-500' },
      {
        href: '/communications',
        label: 'Communications',
        icon: EnvelopeIcon,
        tint: 'fill-indigo-500',
      },
    ],
  },
  {
    label: 'Manage',
    items: [
      { href: '/settings', label: 'Event settings', icon: Cog6ToothIcon, tint: 'fill-zinc-400' },
      { href: '/changes', label: 'Change review', icon: Squares2X2Icon, tint: 'fill-zinc-400' },
      {
        href: '/integrations',
        label: 'Integrations',
        icon: CircleStackIcon,
        tint: 'fill-zinc-400',
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
              <p className="px-2 pb-1 text-sm font-medium text-zinc-400">{group.label}</p>
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
                        'focus-ring flex min-h-11 items-center gap-2 rounded-lg px-2 text-[0.9375rem] font-medium text-zinc-600 sm:min-h-8 sm:text-sm',
                        active && 'bg-zinc-950/6 text-zinc-950',
                        !active && 'hover:bg-zinc-950/4 hover:text-zinc-950',
                      )}
                    >
                      <Icon className={cx('size-4 h-lh shrink-0', item.tint)} />
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

function WorkspaceIdentity({
  navigate,
  pendingChanges,
  onNavigate,
}: {
  navigate: (to: string) => void
  pendingChanges: number
  onNavigate?: () => void
}) {
  const { payload } = useWorkspace()
  const state = payload?.state
  const event = state?.events.find((entry) => entry.id === state.activeEventId)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()

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

  const openPage = (to: string) => {
    setOpen(false)
    navigate(to)
    onNavigate?.()
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? popoverId : undefined}
        onClick={() => setOpen((current) => !current)}
        className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg p-1.5 text-left hover:bg-zinc-950/4 sm:min-h-9"
      >
        <span className="grid size-6 shrink-0 place-items-center rounded-md bg-blue-600 text-sm font-semibold text-white">
          AI
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
            {state?.workspace.name ?? 'Program team'}
          </span>
          <span className="block truncate text-base text-zinc-500 sm:text-sm">
            {event?.name ?? 'Active event'}
          </span>
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
          aria-label="Workspace menu"
          className="absolute top-full left-0 z-50 mt-1.5 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl bg-zinc-900 p-1.5 shadow-2xl ring-1 ring-white/10 motion-safe:animate-rise-in"
        >
          <div className="px-2 py-1.5">
            <p className="truncate text-base font-medium text-white sm:text-sm">
              {event?.name ?? 'Active event'}
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p className="truncate text-base text-zinc-400 sm:text-sm">Workspace synced</p>
            </div>
          </div>
          <div className="border-t border-white/10 pt-1">
            {[
              { href: '/agenda', label: 'View published program', icon: ArrowTopRightOnSquareIcon },
              { href: '/settings', label: 'Event settings', icon: Cog6ToothIcon },
              { href: '/integrations', label: 'Integrations', icon: CircleStackIcon },
              { href: '/agent', label: 'Agent workspace', icon: CpuChipIcon },
            ].map(({ href, label, icon: Icon }) => (
              <button
                key={href}
                type="button"
                className="focus-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-2 text-left text-base text-zinc-300 hover:bg-white/8 hover:text-white sm:min-h-8 sm:text-sm"
                onClick={() => openPage(href)}
              >
                <Icon className="size-4 h-lh shrink-0 fill-zinc-500" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {href === '/agent' && pendingChanges > 0 ? (
                  <span className="rounded-md bg-amber-400/15 px-1.5 py-0.5 text-sm font-medium tabular-nums text-amber-300">
                    {pendingChanges}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export function Shell({ pathname, navigate, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const mobileTitleId = useId()
  const { payload } = useWorkspace()
  const activeEvent = payload?.state.events.find(
    (event) => event.id === payload.state.activeEventId,
  )
  const pendingChanges =
    payload?.state.changeSets.filter((changeSet) => changeSet.status === 'awaiting_approval')
      .length ?? 0

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
    <div className="isolate min-h-dvh antialiased max-lg:bg-white lg:flex lg:bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col p-2 lg:flex">
        <WorkspaceIdentity navigate={navigate} pendingChanges={pendingChanges} />
        <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-2">
          <NavigationItems pathname={pathname} navigate={navigate} />
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-[calc(3.5rem+env(safe-area-inset-top))] items-end justify-between border-b border-zinc-950/5 bg-white/95 px-4 pb-3 pt-[env(safe-area-inset-top)] backdrop-blur lg:hidden">
        <a
          href="/"
          aria-label="Event overview"
          className="focus-ring flex min-w-0 items-center gap-2 rounded-md text-base font-medium text-zinc-950"
          onClick={(event) => {
            event.preventDefault()
            navigate('/')
          }}
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-blue-600 text-sm font-semibold text-white">
            AI
          </span>
          <span className="min-w-0 truncate">{activeEvent?.name ?? 'Program workspace'}</span>
        </a>
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
                className="absolute inset-y-0 left-0 flex w-[min(86vw,20rem)] flex-col bg-white p-3 pb-[max(--spacing(3),env(safe-area-inset-bottom))] pt-[max(--spacing(3),env(safe-area-inset-top))] shadow-2xl ring-1 ring-black/5 motion-safe:animate-slide-from-left"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <WorkspaceIdentity
                      navigate={navigate}
                      pendingChanges={pendingChanges}
                      onNavigate={() => setMobileOpen(false)}
                    />
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
              </div>
            </div>,
            document.body,
          )
        : null}

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
          <div className="min-h-full bg-white p-4 sm:p-6 lg:min-h-[calc(100dvh-(--spacing(4)))] lg:rounded-xl lg:shadow-xs lg:ring-1 lg:ring-zinc-950/5">
            <div className="mx-auto w-full max-w-[100rem]">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
