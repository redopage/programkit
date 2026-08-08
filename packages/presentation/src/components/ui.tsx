import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import type {
  CampaignStatus,
  ChangeSetStatus,
  ParticipationStatus,
  RequirementStatus,
} from '@crm-library/core'

import { useWorkspace } from '../lib/workspace.tsx'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function Button({
  variant = 'secondary',
  size = 'regular',
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'compact' | 'regular'
}) {
  return (
    <button
      {...props}
      className={cx(
        'focus-ring inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium disabled:cursor-not-allowed disabled:opacity-50',
        size === 'regular'
          ? 'min-h-10 px-3 text-base sm:min-h-9 sm:text-sm'
          : 'min-h-9 px-2.5 text-base sm:min-h-7 sm:text-sm',
        variant === 'primary' &&
          'bg-emerald-700 text-white ring-1 ring-emerald-700 hover:bg-emerald-800',
        variant === 'secondary' &&
          'bg-white text-zinc-800 shadow-xs ring-1 ring-zinc-950/10 hover:bg-zinc-50',
        variant === 'ghost' && 'text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950',
        variant === 'danger' && 'bg-red-50 text-red-700 ring-1 ring-red-700/10 hover:bg-red-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button
      {...props}
      type={props.type ?? 'button'}
      aria-label={label}
      className={cx(
        'touch-target focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-950/5 hover:text-zinc-950',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Avatar({
  src,
  name,
  size = 'regular',
}: {
  src: string
  name: string
  size?: 'small' | 'regular' | 'large'
}) {
  return (
    <img
      src={src}
      alt=""
      className={cx(
        'shrink-0 rounded-full bg-zinc-100 object-cover outline-1 -outline-offset-1 outline-black/10',
        size === 'small' && 'size-7',
        size === 'regular' && 'size-9',
        size === 'large' && 'size-14',
      )}
      title={name}
    />
  )
}

const statusLabels: Record<string, string> = {
  prospect: 'Prospect',
  invited: 'Invited',
  confirmed: 'Confirmed',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  not_started: 'Not started',
  submitted: 'Awaiting review',
  revision_requested: 'Needs revision',
  approved: 'Approved',
  waived: 'Waived',
  draft: 'Draft',
  awaiting_approval: 'Awaiting approval',
  sent: 'Sent',
  rejected: 'Rejected',
  committed: 'Committed',
  stale: 'Stale',
}

export function StatusBadge({
  status,
}: {
  status: ParticipationStatus | RequirementStatus | CampaignStatus | ChangeSetStatus
}) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
        (status === 'confirmed' || status === 'approved' || status === 'committed') &&
          'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10',
        (status === 'invited' || status === 'submitted' || status === 'awaiting_approval') &&
          'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
        (status === 'revision_requested' || status === 'stale') &&
          'bg-rose-50 text-rose-700 ring-1 ring-rose-700/10',
        (status === 'prospect' || status === 'draft' || status === 'not_started') &&
          'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/5',
        (status === 'declined' || status === 'withdrawn' || status === 'rejected') &&
          'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-950/5',
        status === 'waived' && 'bg-sky-50 text-sky-700 ring-1 ring-sky-700/10',
        status === 'sent' && 'bg-violet-50 text-violet-700 ring-1 ring-violet-700/10',
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  )
}

export function TrackBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={cx(
        'inline-flex rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
        color === 'emerald' && 'bg-emerald-50 text-emerald-700',
        color === 'amber' && 'bg-amber-50 text-amber-700',
        color === 'sky' && 'bg-sky-50 text-sky-700',
        color === 'rose' && 'bg-rose-50 text-rose-700',
        color === 'violet' && 'bg-violet-50 text-violet-700',
        color === 'zinc' && 'bg-zinc-100 text-zinc-700',
      )}
    >
      {name}
    </span>
  )
}

export function ProgressBar({ value }: { value: number }) {
  const boundedValue = Math.min(Math.max(value, 0), 100)
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
      aria-label={`${value}% complete`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
    >
      <div
        className="h-full w-(--progress) rounded-full bg-emerald-600"
        style={{ '--progress': `${boundedValue}%` } as React.CSSProperties}
      />
    </div>
  )
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-zinc-950/5 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="text-base text-zinc-500 sm:text-sm">{eyebrow}</p> : null}
        <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
          {title}
        </h1>
        {description ? (
          <p className="max-w-[70ch] text-pretty text-base text-zinc-500 sm:text-sm">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
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
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const focusFrame = window.requestAnimationFrame(() => {
      const firstControl = panel?.querySelector<HTMLElement>(focusableSelector)
      ;(firstControl ?? panel)?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (control) => control.getAttribute('aria-hidden') !== 'true',
      )
      if (controls.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = controls[0]
      const last = controls.at(-1)!
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      window.cancelAnimationFrame(focusFrame)
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = previousOverflow
      if (appRoot) {
        appRoot.inert = rootWasInert
        if (rootAriaHidden == null) appRoot.removeAttribute('aria-hidden')
        else appRoot.setAttribute('aria-hidden', rootAriaHidden)
      }
      previousFocus?.focus()
    }
  }, [open])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div
        className="absolute inset-0 cursor-default bg-zinc-950/20 backdrop-blur-[1px]"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-2xl ring-1 ring-black/5"
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-950/5 px-4 sm:px-6">
          <h2 id={titleId} className="truncate text-lg font-semibold text-zinc-950">
            {title}
          </h2>
          <IconButton label="Close panel" onClick={onClose}>
            <XMarkIcon className="size-4 shrink-0 fill-current" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-950/5 bg-white p-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="py-16 text-center">
      <h3 className="text-lg font-semibold text-zinc-950">{title}</h3>
      <p className="mx-auto max-w-[52ch] text-pretty text-base text-zinc-500 sm:text-sm">
        {description}
      </p>
    </div>
  )
}

export function LoadingScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-white">
      <div className="flex items-center gap-3 text-zinc-500">
        <span className="size-2 animate-pulse rounded-full bg-emerald-600" />
        <p className="text-base sm:text-sm">Loading workspace…</p>
      </div>
    </div>
  )
}

export function ToastViewport() {
  const { toast, dismissToast } = useWorkspace()
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-60 flex justify-center sm:bottom-6">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-start gap-3 rounded-xl bg-zinc-950 py-3 pr-2 pl-3 text-white shadow-xl ring-1 ring-black/10"
      >
        {toast.tone === 'success' ? (
          <CheckCircleIcon className="size-4 h-lh shrink-0 fill-emerald-400" />
        ) : toast.tone === 'error' ? (
          <ExclamationTriangleIcon className="size-4 h-lh shrink-0 fill-red-400" />
        ) : (
          <InformationCircleIcon className="size-4 h-lh shrink-0 fill-sky-400" />
        )}
        <p className="min-w-0 flex-1 text-base text-pretty sm:text-sm">{toast.message}</p>
        <IconButton
          label="Dismiss notification"
          className="text-zinc-400 hover:bg-white/10 hover:text-white"
          onClick={dismissToast}
        >
          <XMarkIcon className="size-4 shrink-0 fill-current" />
        </IconButton>
      </div>
    </div>
  )
}
