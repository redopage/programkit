import {
  ArrowTopRightOnSquareIcon,
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  CircleStackIcon,
  CpuChipIcon,
  EnvelopeIcon,
  HomeIcon,
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

const navigation = [
  { href: '/', label: 'Overview', icon: HomeIcon },
  { href: '/people', label: 'People', icon: UserGroupIcon },
  { href: '/readiness', label: 'Readiness', icon: ChartBarSquareIcon },
  { href: '/sessions', label: 'Sessions', icon: RectangleStackIcon },
  { href: '/schedule', label: 'Schedule', icon: CalendarDaysIcon },
  { href: '/communications', label: 'Communications', icon: EnvelopeIcon },
  { href: '/changes', label: 'Change review', icon: Squares2X2Icon },
  { href: '/integrations', label: 'Integrations', icon: CircleStackIcon },
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
      <ul role="list" className="flex flex-col gap-1">
        {navigation.map((item) => {
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
                  'focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-base text-zinc-600 sm:min-h-9 sm:text-sm',
                  active && 'bg-zinc-950/5 text-zinc-950',
                  !active && 'hover:bg-zinc-950/3 hover:text-zinc-950',
                )}
              >
                <Icon className="size-4 h-lh shrink-0 fill-current" />
                <span className="min-w-0 truncate">{item.label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function WorkspaceIdentity() {
  const { payload } = useWorkspace()
  const state = payload?.state
  const event = state?.events.find((entry) => entry.id === state.activeEventId)
  return (
    <div className="flex w-full items-center gap-3 rounded-xl p-2 text-left">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-700 text-sm font-semibold text-white ring-1 ring-emerald-700">
        AI
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-950">
          {state?.workspace.name ?? 'Program team'}
        </span>
        <span className="block truncate text-sm text-zinc-500">
          {event?.name ?? 'Active event'}
        </span>
      </span>
    </div>
  )
}

export function Shell({ pathname, navigate, children }: ShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const mobilePanelRef = useRef<HTMLDivElement>(null)
  const mobileTitleId = useId()
  const { payload } = useWorkspace()
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
    <div className="isolate min-h-dvh bg-white lg:flex">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-zinc-950/5 bg-zinc-50/80 p-3 lg:flex">
        <a
          href="/"
          aria-label="Homepage"
          className="focus-ring flex h-12 items-center px-2 text-base font-semibold tracking-tight text-zinc-950"
          onClick={(event) => {
            event.preventDefault()
            navigate('/')
          }}
        >
          Program Ops
        </a>
        <WorkspaceIdentity />
        <div className="min-h-0 flex-1 overflow-y-auto py-5">
          <NavigationItems pathname={pathname} navigate={navigate} />
        </div>
        <div className="flex flex-col gap-2 border-t border-zinc-950/5 pt-3">
          <a
            href="/agent"
            onClick={(event) => {
              event.preventDefault()
              navigate('/agent')
            }}
            className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-950/3 hover:text-zinc-950"
          >
            <CpuChipIcon className="size-4 shrink-0 fill-current" />
            <span className="min-w-0 flex-1 truncate">Agent workspace</span>
            {pendingChanges > 0 ? (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-sm font-medium tabular-nums text-amber-800">
                {pendingChanges}
              </span>
            ) : null}
          </a>
          <a
            href="/agenda"
            onClick={(event) => {
              event.preventDefault()
              navigate('/agenda')
            }}
            className="focus-ring flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-950/3 hover:text-zinc-950"
          >
            <ArrowTopRightOnSquareIcon className="size-4 shrink-0 fill-current" />
            <span>View public agenda</span>
          </a>
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
            <p className="min-w-0 truncate text-sm text-zinc-500">Demo workspace synced</p>
          </div>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-zinc-950/5 bg-white/95 px-4 backdrop-blur lg:hidden">
        <a
          href="/"
          aria-label="Homepage"
          className="focus-ring text-base font-semibold tracking-tight text-zinc-950"
          onClick={(event) => {
            event.preventDefault()
            navigate('/')
          }}
        >
          Program Ops
        </a>
        <div className="flex items-center gap-1">
          <IconButton label="Open navigation" onClick={() => setMobileOpen(true)}>
            <Bars3Icon className="size-4 shrink-0 fill-current" />
          </IconButton>
        </div>
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
                className="absolute inset-0 cursor-default bg-zinc-950/20 backdrop-blur-[1px]"
                aria-hidden="true"
                onClick={() => setMobileOpen(false)}
              />
              <div
                ref={mobilePanelRef}
                className="absolute inset-y-0 left-0 flex w-[min(90vw,22rem)] flex-col bg-white p-4 shadow-2xl ring-1 ring-black/5"
              >
                <div className="flex h-11 items-center justify-between gap-3">
                  <h2
                    id={mobileTitleId}
                    className="text-base font-semibold tracking-tight text-zinc-950"
                  >
                    Program Ops
                  </h2>
                  <IconButton label="Close navigation" onClick={() => setMobileOpen(false)}>
                    <XMarkIcon className="size-4 shrink-0 fill-current" />
                  </IconButton>
                </div>
                <div className="py-3">
                  <WorkspaceIdentity />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto py-3">
                  <NavigationItems
                    pathname={pathname}
                    navigate={navigate}
                    onNavigate={() => setMobileOpen(false)}
                  />
                </div>
                <div className="flex flex-col gap-1 border-t border-zinc-950/5 pt-3">
                  <a
                    href="/agent"
                    onClick={(event) => {
                      event.preventDefault()
                      navigate('/agent')
                      setMobileOpen(false)
                    }}
                    className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-base text-zinc-600 hover:bg-zinc-950/3 hover:text-zinc-950"
                  >
                    <CpuChipIcon className="size-4 shrink-0 fill-current" />
                    <span className="min-w-0 flex-1">Agent workspace</span>
                    {pendingChanges > 0 ? (
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-sm font-medium tabular-nums text-amber-800">
                        {pendingChanges}
                      </span>
                    ) : null}
                  </a>
                  <a
                    href="/agenda"
                    onClick={(event) => {
                      event.preventDefault()
                      navigate('/agenda')
                      setMobileOpen(false)
                    }}
                    className="focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-base text-zinc-600 hover:bg-zinc-950/3 hover:text-zinc-950"
                  >
                    <ArrowTopRightOnSquareIcon className="size-4 shrink-0 fill-current" />
                    <span>View public agenda</span>
                  </a>
                  <div className="flex min-h-11 items-center gap-2 px-3">
                    <span className="size-2 shrink-0 rounded-full bg-emerald-500" />
                    <p className="min-w-0 truncate text-base text-zinc-500">
                      Demo workspace synced
                    </p>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <main className="min-w-0 flex-1 pt-14 lg:pl-60 lg:pt-0">
        <div className="mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  )
}
