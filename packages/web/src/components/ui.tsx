import {
  CheckCircleIcon,
  ChevronRightIcon,
  DocumentArrowUpIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'

import type {
  CampaignStatus,
  ChangeSetStatus,
  OutboundMessageStatus,
  ParticipationStatus,
  PortalResourcePage,
  RequirementStatus,
  SubmissionStatus,
} from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

/**
 * Sentence-cases a machine value like `not_configured` or `revision_requested`.
 * The CSS `capitalize` utility title-cases every word, which turns
 * "not configured" into "Not Configured" and "30 min" into "30 Min".
 */
export function sentenceCase(value: string) {
  const text = value.replaceAll('_', ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
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
      type={props.type ?? 'button'}
      className={cx(
        'focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium shadow-xs ring-1 motion-safe:transition-[background-color,box-shadow,transform] motion-safe:enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 disabled:shadow-none disabled:ring-zinc-950/5',
        size === 'regular'
          ? 'min-h-11 px-3.5 text-base [&:has(>svg:first-child)]:pl-3 [&:has(>svg:last-child)]:pr-3 sm:min-h-9 sm:text-sm'
          : 'min-h-11 px-3 text-base [&:has(>svg:first-child)]:pl-2.5 [&:has(>svg:last-child)]:pr-2.5 sm:min-h-8 sm:text-[0.8125rem]',
        variant === 'primary' && 'bg-blue-600 text-white ring-blue-700/20 hover:bg-blue-700',
        variant === 'secondary' &&
          'bg-white text-zinc-800 ring-zinc-950/10 hover:bg-zinc-50 hover:ring-zinc-950/15',
        variant === 'ghost' &&
          'bg-transparent text-zinc-600 shadow-none ring-transparent hover:bg-zinc-950/5 hover:text-zinc-950',
        variant === 'danger' &&
          'bg-red-50 text-red-700 ring-red-700/10 hover:bg-red-100 hover:ring-red-700/15',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function FileDropField({
  label = 'Choose or drop a file',
  description,
  variant = 'dropzone',
  className,
  id,
  onChange,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'className'> & {
  label?: string
  description?: string
  variant?: 'dropzone' | 'compact'
  className?: string
}) {
  const generatedId = useId()
  const inputId = id ?? `file-${generatedId}`
  const inputRef = useRef<HTMLInputElement>(null)
  const [filename, setFilename] = useState('')

  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const clearFilename = () => setFilename('')
    form.addEventListener('reset', clearFilename)
    return () => form.removeEventListener('reset', clearFilename)
  }, [])

  return (
    <label
      htmlFor={inputId}
      className={cx(
        'relative flex min-w-0 cursor-pointer items-center bg-white ring-1 ring-inset ring-zinc-950/10 has-disabled:cursor-not-allowed has-disabled:bg-zinc-50 has-focus-visible:outline-2 has-focus-visible:-outline-offset-1 has-focus-visible:outline-blue-500 hover:bg-zinc-950/2',
        variant === 'dropzone' && 'min-h-24 gap-3 rounded-xl p-4',
        variant === 'compact' && 'min-h-9 max-w-48 gap-2 rounded-full px-3 py-2',
        className,
      )}
    >
      <DocumentArrowUpIcon className="size-4 h-lh shrink-0 fill-blue-600" />
      <span className="min-w-0 flex-1">
        <span
          className={cx(
            'block truncate font-medium text-zinc-950',
            variant === 'dropzone' ? 'text-base sm:text-sm' : 'text-[0.8125rem]',
          )}
        >
          {filename || label}
        </span>
        {description && variant === 'dropzone' ? (
          <span className="block text-pretty text-base text-zinc-500 sm:text-sm">
            {description}
          </span>
        ) : null}
      </span>
      <input
        {...props}
        ref={inputRef}
        id={inputId}
        type="file"
        onChange={(event) => {
          setFilename(event.target.files?.[0]?.name ?? '')
          onChange?.(event)
        }}
        className={cx(
          'absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed',
          variant === 'dropzone' ? 'rounded-xl' : 'rounded-full',
        )}
      />
    </label>
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
        'touch-target focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-full text-zinc-500 motion-safe:transition-transform motion-safe:enabled:active:scale-95 hover:bg-zinc-950/5 hover:text-zinc-950',
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
  const [failed, setFailed] = useState(() => src.trim().length === 0)

  useEffect(() => setFailed(src.trim().length === 0), [src])

  const className = cx(
    'shrink-0 rounded-full bg-zinc-100 outline-1 -outline-offset-1 outline-black/10',
    size === 'small' && 'size-7',
    size === 'regular' && 'size-9',
    size === 'large' && 'size-14',
  )

  if (failed) {
    return (
      <span
        role="img"
        aria-label={name}
        className={cx(
          className,
          'inline-flex items-center justify-center font-medium uppercase text-zinc-600',
          size === 'small' && 'text-[0.625rem]',
          size === 'regular' && 'text-xs',
          size === 'large' && 'text-sm',
        )}
        title={name}
      >
        {avatarInitials(name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      className={cx(className, 'object-cover')}
      onError={() => setFailed(true)}
      title={name}
    />
  )
}

export function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/u).filter(Boolean)
  if (parts.length === 0) return '?'

  const first = Array.from(parts[0] ?? '')[0] ?? ''
  if (parts.length === 1) return first.toUpperCase()

  const last = Array.from(parts.at(-1) ?? '')[0] ?? ''
  return `${first}${last}`.toUpperCase()
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
  accepted: 'Accepted',
  in_review: 'In review',
  waitlisted: 'Waitlisted',
  committed: 'Committed',
  stale: 'Stale',
  queued: 'Queued',
  failed: 'Failed',
  published: 'Published',
  archived: 'Archived',
  cancelled: 'Cancelled',
  suppressed: 'Suppressed',
}

export function StatusBadge({
  status,
  label,
}: {
  status:
    | ParticipationStatus
    | RequirementStatus
    | CampaignStatus
    | ChangeSetStatus
    | SubmissionStatus
    | PortalResourcePage['status']
    | OutboundMessageStatus
  label?: string
}) {
  return (
    <span
      className={cx(
        // `self-center` keeps the chip at its natural height: as a flex child it
        // would otherwise stretch to the row height and render as a tall block.
        'inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
        (status === 'confirmed' ||
          status === 'accepted' ||
          status === 'approved' ||
          status === 'committed' ||
          status === 'published') &&
          'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-700/10',
        (status === 'invited' ||
          status === 'submitted' ||
          status === 'in_review' ||
          status === 'awaiting_approval' ||
          status === 'queued') &&
          'bg-amber-50 text-amber-700 ring-1 ring-amber-700/10',
        (status === 'revision_requested' || status === 'stale' || status === 'failed') &&
          'bg-rose-50 text-rose-700 ring-1 ring-rose-700/10',
        (status === 'prospect' ||
          status === 'draft' ||
          status === 'not_started' ||
          status === 'waitlisted') &&
          'bg-zinc-100 text-zinc-700 ring-1 ring-zinc-950/5',
        (status === 'declined' ||
          status === 'withdrawn' ||
          status === 'rejected' ||
          status === 'archived' ||
          status === 'cancelled') &&
          'bg-zinc-100 text-zinc-500 ring-1 ring-zinc-950/5',
        status === 'waived' && 'bg-sky-50 text-sky-700 ring-1 ring-sky-700/10',
        status === 'sent' && 'bg-violet-50 text-violet-700 ring-1 ring-violet-700/10',
        status === 'suppressed' && 'bg-orange-50 text-orange-700 ring-1 ring-orange-700/10',
      )}
    >
      {label ?? statusLabels[status] ?? status}
    </span>
  )
}

export function TrackBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center self-center whitespace-nowrap rounded-full px-2 py-1 text-sm font-medium sm:py-0.5',
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

/**
 * The three text-control treatments in the app. These were drifting — some
 * fields were a row taller than others, some lost their placeholder colour — so
 * they live here as one definition each rather than as copied class strings.
 */
export const textControl =
  'focus-ring-control min-h-11 min-w-0 rounded-xl bg-white px-3 py-2 text-base text-zinc-950 shadow-xs ring-1 ring-inset ring-zinc-950/10 placeholder:text-zinc-400 sm:min-h-9 sm:text-sm'

export const textAreaControl =
  'focus-ring-control min-w-0 resize-y rounded-xl bg-white px-3 py-2 text-base text-zinc-950 shadow-xs ring-1 ring-inset ring-zinc-950/10 placeholder:text-zinc-400 sm:text-sm'

export const selectControl =
  'focus-ring-control col-span-full row-start-1 min-h-11 w-full min-w-0 appearance-none rounded-xl bg-white py-2 pr-10 pl-3 text-base text-zinc-950 shadow-xs ring-1 ring-inset ring-zinc-950/10 sm:min-h-9 sm:text-sm'

/**
 * The row above a list: view filters on the left, search on the right. Owning
 * the layout here keeps every list screen on the same rhythm. It becomes two
 * full-width rows before either control has to clip or shrink.
 */
export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2 pb-3 xl:flex-row xl:items-center xl:justify-between">
      {children}
    </div>
  )
}

/**
 * The one filter treatment in the app. Options remain on one line and scroll
 * inside their own row when the labels exceed the available width.
 */
export function FilterTabs<Value extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: Value
  options: ReadonlyArray<readonly [Value, string]>
  onChange: (next: Value) => void
}) {
  const groupRef = useRef<HTMLDivElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = options.findIndex(([optionValue]) => optionValue === value)
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const group = groupRef.current

    function measure() {
      const option = optionRefs.current[activeIndex]
      if (!group || !option) return

      const next = { left: option.offsetLeft, width: option.offsetWidth }
      setIndicator((current) =>
        current?.left === next.left && current.width === next.width ? current : next,
      )
    }

    measure()
    const observer = new ResizeObserver(measure)
    if (group) observer.observe(group)

    return () => observer.disconnect()
  }, [activeIndex, options.length])

  return (
    <div className="min-w-0 max-w-full overflow-x-auto pb-px">
      <div
        ref={groupRef}
        role="group"
        aria-label={label}
        className="relative inline-flex min-w-max gap-1 rounded-full bg-zinc-950/4 p-1"
      >
        {indicator ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1 bottom-1 left-0 rounded-full bg-white shadow-xs ring-1 ring-black/5 motion-safe:transition-[transform,width] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
            }}
          />
        ) : null}
        {options.map(([optionValue, optionLabel], index) => (
          <button
            key={optionValue}
            ref={(element) => {
              optionRefs.current[index] = element
            }}
            type="button"
            aria-pressed={value === optionValue}
            onClick={() => onChange(optionValue)}
            className={cx(
              'focus-ring relative z-10 min-h-9 rounded-full px-3 text-base text-zinc-600 motion-safe:transition-colors motion-safe:duration-150 sm:min-h-7 sm:text-sm',
              value === optionValue ? 'text-zinc-950' : 'hover:text-zinc-950',
            )}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * Keeps wide content usable when the platform hides scrollbars. The edge fades
 * are an affordance only: they appear when more content exists in that direction
 * and never intercept pointer input.
 */
export function HorizontalScrollArea({
  children,
  className,
  viewportClassName,
}: {
  children: ReactNode
  className?: string
  viewportClassName?: string
}) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  useLayoutEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const updateEdges = () => {
      const next = {
        left: viewport.scrollLeft > 1,
        right: viewport.scrollLeft + viewport.clientWidth < viewport.scrollWidth - 1,
      }
      setEdges((current) =>
        current.left === next.left && current.right === next.right ? current : next,
      )
    }

    updateEdges()
    viewport.addEventListener('scroll', updateEdges, { passive: true })

    const observer = new ResizeObserver(updateEdges)
    observer.observe(viewport)
    if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)

    return () => {
      viewport.removeEventListener('scroll', updateEdges)
      observer.disconnect()
    }
  }, [])

  const maskImage = edges.left
    ? edges.right
      ? 'linear-gradient(to right, transparent 0, #000 1.5rem, #000 calc(100% - 1.5rem), transparent 100%)'
      : 'linear-gradient(to right, transparent 0, #000 1.5rem, #000 100%)'
    : edges.right
      ? 'linear-gradient(to right, #000 0, #000 calc(100% - 1.5rem), transparent 100%)'
      : 'none'

  return (
    <div className={className}>
      <div
        ref={viewportRef}
        data-scroll-mask-left={edges.left ? '' : undefined}
        data-scroll-mask-right={edges.right ? '' : undefined}
        className={cx(
          'overflow-x-auto [mask-image:var(--scroll-edge-mask)] [-webkit-mask-image:var(--scroll-edge-mask)]',
          viewportClassName,
        )}
        style={{ '--scroll-edge-mask': maskImage } as CSSProperties}
      >
        {children}
      </div>
    </div>
  )
}

export function SearchInput({
  label,
  name,
  value,
  placeholder,
  onChange,
}: {
  label: string
  name: string
  value: string
  placeholder: string
  onChange: (next: string) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const hasValue = value.length > 0

  return (
    <div className="relative w-full min-w-0 xl:w-72">
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 fill-zinc-400" />
      <input
        ref={inputRef}
        type="search"
        name={name}
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="focus-ring min-h-11 w-full rounded-full bg-white py-2 pr-10 pl-9 text-base text-zinc-950 shadow-xs ring-1 ring-zinc-950/10 placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:appearance-none sm:min-h-9 sm:text-sm"
      />
      <button
        type="button"
        aria-label="Clear search"
        aria-hidden={!hasValue}
        tabIndex={hasValue ? 0 : -1}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          onChange('')
          inputRef.current?.focus()
        }}
        className={cx(
          'focus-ring absolute top-1/2 right-1.5 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700 motion-safe:transition-[opacity,scale] motion-safe:duration-150',
          hasValue ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
        )}
      >
        <XMarkIcon className="size-4" />
      </button>
    </div>
  )
}

/**
 * A standing message about the state of the surface — readiness to publish, a
 * pending approval, a connection that needs attention. One treatment, four
 * tones, so these stop drifting apart across screens.
 */
export function Callout({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title: string
  children?: ReactNode
}) {
  const Icon =
    tone === 'success'
      ? CheckCircleIcon
      : tone === 'warning' || tone === 'danger'
        ? ExclamationTriangleIcon
        : InformationCircleIcon
  return (
    <div
      className={cx(
        'flex items-start gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset',
        tone === 'info' && 'bg-sky-50 ring-sky-950/10',
        tone === 'success' && 'bg-emerald-50 ring-emerald-950/10',
        tone === 'warning' && 'bg-amber-50 ring-amber-950/10',
        tone === 'danger' && 'bg-rose-50 ring-rose-950/10',
      )}
    >
      <Icon
        className={cx(
          'size-4 h-lh shrink-0',
          tone === 'info' && 'fill-sky-600',
          tone === 'success' && 'fill-emerald-600',
          tone === 'warning' && 'fill-amber-600',
          tone === 'danger' && 'fill-rose-600',
        )}
      />
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            'text-base font-medium sm:text-sm',
            tone === 'info' && 'text-sky-950',
            tone === 'success' && 'text-emerald-950',
            tone === 'warning' && 'text-amber-950',
            tone === 'danger' && 'text-rose-950',
          )}
        >
          {title}
        </p>
        {children ? (
          <div className="text-pretty text-base text-zinc-600 sm:text-sm">{children}</div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * A labelled control. `width` keeps inputs sized to the answer they expect —
 * a name field stretched across a 1400px panel is hard to read and harder to
 * scan as a form.
 */
export function Field({
  label,
  hint,
  htmlFor,
  width = 'full',
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  width?: 'compact' | 'regular' | 'full'
  children: ReactNode
}) {
  return (
    <div
      className={cx(
        'flex min-w-0 flex-col gap-1.5',
        width === 'compact' && 'max-w-xs',
        width === 'regular' && 'max-w-lg',
      )}
    >
      <label htmlFor={htmlFor} className="text-base font-medium text-zinc-950 sm:text-sm">
        {label}
      </label>
      {children}
      {hint ? <p className="text-pretty text-base text-zinc-500 sm:text-sm">{hint}</p> : null}
    </div>
  )
}

/**
 * Native checkbox, styled entirely from its own state so nothing has to keep a
 * class list in sync with the input.
 */
export function Checkbox({
  id,
  name,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string
  name: string
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <div className="flex items-center gap-2 text-base sm:text-sm">
      <span className="flex h-lh items-center">
        <span className="group inline-grid size-5 grid-cols-1 sm:size-4">
          <input
            id={id}
            name={name}
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event) => onChange(event.target.checked)}
            className="col-start-1 row-start-1 appearance-none rounded-sm border border-zinc-300 bg-white checked:border-blue-600 checked:bg-blue-600 indeterminate:border-blue-600 indeterminate:bg-blue-600 disabled:border-zinc-300 disabled:bg-zinc-100 disabled:checked:bg-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 forced-colors:appearance-auto"
          />
          <svg
            viewBox="0 0 14 14"
            fill="none"
            className="pointer-events-none col-start-1 row-start-1 size-7/8 self-center justify-self-center stroke-white group-has-disabled:stroke-zinc-950/25"
          >
            <path
              d="M3 8L6 11L11 3.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="group-not-has-checked:opacity-0"
            />
          </svg>
        </span>
      </span>
      <label htmlFor={id} className="min-w-0 text-zinc-800">
        {label}
      </label>
    </div>
  )
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const boundedValue = Math.min(Math.max(value, 0), 100)
  return (
    <div
      className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
      aria-label={label ?? `${Math.round(boundedValue)}% complete`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={boundedValue}
    >
      <div
        className="h-full w-(--progress) rounded-full bg-blue-600 motion-safe:transition-[width] motion-safe:duration-500 motion-safe:ease-out"
        style={{ '--progress': `${boundedValue}%` } as React.CSSProperties}
      />
    </div>
  )
}

/**
 * The panel-wide page header. It pulls itself out to the panel edges with
 * negative margins so it can stick to the top of the workspace panel while the
 * page scrolls underneath; the margins must track the panel padding in `Shell`.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    // Only the desktop panel pins its header: on mobile the app already has a
    // fixed top bar, and a second pinned block would eat the viewport.
    <div className="@container/page-header -mx-4 -mt-4 rounded-t-2xl border-b border-zinc-950/5 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:-mt-6 sm:px-6 lg:sticky lg:top-(--workspace-sticky-top) lg:z-30">
      <div className="flex flex-col gap-3 @3xl/page-header:flex-row @3xl/page-header:items-center @3xl/page-header:justify-between">
        <div className="min-w-0">
          <h1 className="max-w-[40ch] text-balance text-lg font-semibold tracking-tight text-zinc-950 [overflow-wrap:anywhere]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-[72ch] text-pretty text-base text-zinc-500 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 @3xl/page-header:w-auto @3xl/page-header:shrink-0 @3xl/page-header:gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * The heading above a block of rows inside a page. Kept visually lighter than
 * `PageHeader` so a page reads as one title with several quiet sections.
 */
export function SectionHeading({
  id,
  title,
  description,
  action,
}: {
  id?: string
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-2">
      <div className="min-w-0">
        <h2
          id={id}
          className="text-balance text-base font-medium text-zinc-950 sm:text-sm [overflow-wrap:anywhere]"
        >
          {title}
        </h2>
        {description ? (
          <p className="text-pretty text-base text-zinc-500 sm:text-sm">{description}</p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  )
}

/**
 * A bordered value chip for inline record metadata — rooms, formats, codes.
 * Reads as data rather than as a status, which is what `StatusBadge` is for.
 */
export function FieldChip({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 self-center whitespace-nowrap rounded-full bg-white py-1 text-sm font-medium text-zinc-700 ring-1 ring-zinc-950/10 sm:py-0.5',
        icon ? 'pr-2 pl-1' : 'px-2',
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/**
 * Divider-separated statistics. Owning the divider and padding maths here keeps
 * every stat row in the app on the same grid as the column count changes.
 */
export function StatGrid({
  stats,
}: {
  stats: Array<{ label: string; value: ReactNode; detail?: string }>
}) {
  return (
    <div className="@container">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-zinc-950/5 ring-1 ring-zinc-950/5 @3xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white px-4 py-3.5 sm:px-5">
            <dt className="text-pretty text-base font-medium text-zinc-500 sm:text-sm">
              {stat.label}
            </dt>
            <dd className="pt-0.5 text-2xl font-semibold tracking-tight tabular-nums text-zinc-950">
              {stat.value}
            </dd>
            {stat.detail ? (
              <dd className="text-pretty text-base text-zinc-500 sm:text-sm">{stat.detail}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'regular',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  size?: 'regular' | 'wide'
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
    // Focus the panel itself rather than the first control (the close button) so
    // opening a detail drawer does not paint a focus ring on "Close".
    const focusFrame = window.requestAnimationFrame(() => {
      panel?.focus()
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
        className="absolute inset-0 cursor-default bg-zinc-950/20 backdrop-blur-[1px] motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'absolute inset-x-0 bottom-0 flex max-h-[min(88dvh,48rem)] w-full flex-col rounded-t-3xl bg-white shadow-2xl ring-1 ring-inset ring-black/5 focus:outline-none motion-safe:animate-slide-from-bottom sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:rounded-l-3xl sm:rounded-r-none sm:motion-safe:animate-slide-from-right',
          size === 'regular' ? 'sm:max-w-xl' : 'sm:max-w-5xl',
        )}
      >
        <span
          aria-hidden="true"
          className="absolute top-2 left-1/2 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-300 sm:hidden"
        />
        <div className="flex min-h-16 shrink-0 items-center justify-between gap-4 border-b border-zinc-950/5 px-4 py-3 pt-5 sm:px-6 sm:py-3">
          <h2
            id={titleId}
            className="min-w-0 text-pretty text-lg font-semibold text-zinc-950 [overflow-wrap:anywhere]"
          >
            {title}
          </h2>
          <IconButton label="Close panel" onClick={onClose}>
            <XMarkIcon className="size-4 shrink-0 fill-current" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
        {footer ? (
          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-zinc-950/5 bg-white p-4 pb-[max(--spacing(4),env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'regular',
  initialFocusRef,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children?: ReactNode
  footer?: ReactNode
  size?: 'regular' | 'wide'
  initialFocusRef?: RefObject<HTMLElement | null>
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  const titleId = useId()
  const descriptionId = useId()

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
      const initialFocus = initialFocusRef?.current
      if (initialFocus && !initialFocus.hasAttribute('disabled')) initialFocus.focus()
      else panel?.focus()
    })
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const controls = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector))
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
  }, [initialFocusRef, open])

  if (!open) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
    >
      <div
        className="absolute inset-0 bg-zinc-950/25 backdrop-blur-[1px] motion-safe:animate-fade-in"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className={cx(
          'relative flex w-full flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10 focus:outline-none',
          size === 'regular'
            ? 'max-h-[min(90dvh,48rem)] max-w-md'
            : 'h-[min(90dvh,48rem)] max-w-3xl',
        )}
      >
        <div
          className={cx(
            'shrink-0 px-5 pt-5 sm:px-6 sm:pt-6',
            !children && !footer && 'pb-5 sm:pb-6',
          )}
        >
          <h2
            id={titleId}
            className="text-pretty text-lg font-semibold text-zinc-950 [overflow-wrap:anywhere]"
          >
            {title}
          </h2>
          {description ? (
            <p id={descriptionId} className="pt-1 text-pretty text-base text-zinc-500 sm:text-sm">
              {description}
            </p>
          ) : null}
        </div>
        {children ? (
          <div
            className={cx(
              'min-h-0 flex-1 overflow-y-auto px-5 pt-4 sm:px-6',
              !footer && 'pb-5 sm:pb-6',
            )}
          >
            {children}
          </div>
        ) : null}
        {footer ? (
          <div
            className={cx(
              'mt-4 flex shrink-0 flex-wrap gap-2 border-t border-zinc-950/5 bg-white px-5 py-4 sm:px-6',
              size === 'regular' ? 'justify-start' : 'justify-end',
            )}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

export function EmptyState({
  title,
  description,
  action,
  tone = 'neutral',
}: {
  title: string
  description: string
  action?: ReactNode
  /** `settled` marks a finished queue rather than a section that never filled. */
  tone?: 'neutral' | 'settled'
}) {
  return (
    <div className="py-12 text-center">
      {tone === 'settled' ? (
        <CheckCircleIcon className="mx-auto size-4 shrink-0 fill-emerald-500" />
      ) : null}
      <h3 className="pt-2 text-base font-medium text-zinc-950 sm:text-sm">{title}</h3>
      <p className="mx-auto max-w-[52ch] text-pretty text-base text-zinc-500 sm:text-sm">
        {description}
      </p>
      {action ? <div className="flex justify-center pt-4">{action}</div> : null}
    </div>
  )
}

/**
 * A failure that belongs to one section. Keeping the retry local means a failed
 * panel never costs the user the rest of the page, or their scroll position.
 */
export function ErrorState({
  title,
  description,
  onRetry,
  retrying = false,
  action,
}: {
  title: string
  description: string
  onRetry?: () => void
  retrying?: boolean
  action?: ReactNode
}) {
  return (
    <div className="py-12 text-center">
      <ExclamationTriangleIcon className="mx-auto size-4 shrink-0 fill-amber-500" />
      <h3 className="pt-2 text-base font-medium text-zinc-950 sm:text-sm">{title}</h3>
      <p className="mx-auto max-w-[52ch] text-pretty text-base text-zinc-500 sm:text-sm">
        {description}
      </p>
      {action ? (
        <div className="flex justify-center pt-4">{action}</div>
      ) : onRetry ? (
        <div className="flex justify-center pt-4">
          <Button size="compact" disabled={retrying} onClick={onRetry}>
            {retrying ? 'Trying again…' : 'Try again'}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

/**
 * Placeholder rows that match the height and rhythm of the content they stand
 * in for, so arriving data does not shift the page under the reader.
 */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading" className="divide-y divide-zinc-950/5">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-3 py-3">
          <span className="size-7 shrink-0 animate-pulse rounded-full bg-zinc-950/5" />
          <span className="h-3 flex-1 animate-pulse rounded bg-zinc-950/5" />
          <span className="h-3 w-16 shrink-0 animate-pulse rounded bg-zinc-950/5" />
        </div>
      ))}
    </div>
  )
}

/**
 * One grouped job from `nextActions`. The count sits on the right as a tabular
 * figure so a column of these can be scanned by size, and the whole row is the
 * hit target rather than a trailing link.
 */
export function NextActionRow({
  label,
  detail,
  count,
  tone,
  onSelect,
}: {
  label: string
  detail: string
  count: number
  tone: 'blocking' | 'attention' | 'upcoming'
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="focus-ring group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left hover:bg-zinc-950/2"
    >
      <span
        aria-hidden="true"
        className={cx(
          'size-1.5 shrink-0 rounded-full',
          tone === 'blocking' && 'bg-rose-500',
          tone === 'attention' && 'bg-amber-500',
          tone === 'upcoming' && 'bg-zinc-300',
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-pretty text-base font-medium text-zinc-950 sm:text-sm">
          {label}
        </span>
        <span className="block text-pretty text-base text-zinc-500 sm:text-sm">{detail}</span>
      </span>
      <span className="shrink-0 text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
        {count}
      </span>
      <ChevronRightIcon className="size-4 h-lh shrink-0 fill-zinc-300 group-hover:fill-zinc-500" />
    </button>
  )
}

/**
 * First paint. Showing the workspace's silhouette rather than a centred spinner
 * means the frame the user is about to read is already in place when the data
 * lands, so nothing jumps.
 */
export function LoadingScreen({ embedded = false }: { embedded?: boolean }) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-4 border-b border-zinc-950/5 pb-3">
        <span className="h-4 w-48 animate-pulse rounded bg-zinc-950/5" />
        <span className="h-8 w-36 animate-pulse rounded-lg bg-zinc-950/5" />
      </div>
      <div className="pt-6">
        <SkeletonRows rows={6} />
      </div>
    </>
  )
  if (embedded) {
    return (
      <div className="min-h-[60vh] py-2" role="status" aria-label="Loading workspace">
        {content}
      </div>
    )
  }
  return (
    <div className="min-h-dvh bg-canvas p-2" role="status" aria-label="Loading workspace">
      <div className="min-h-[calc(100dvh-(--spacing(4)))] rounded-2xl bg-white p-4 shadow-xs ring-1 ring-zinc-950/5 sm:p-6">
        {content}
      </div>
    </div>
  )
}

export function ToastViewport() {
  const { toast, dismissToast } = useWorkspace()
  if (!toast) return null
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-60 flex justify-center sm:bottom-6">
      <div
        role="status"
        className="pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl bg-zinc-950/90 py-2 pr-2 pl-3 text-white shadow-xl ring-1 ring-white/10 backdrop-blur-xl motion-safe:animate-rise-in"
      >
        {toast.tone === 'success' ? (
          <CheckCircleIcon className="size-4 shrink-0 fill-emerald-400" />
        ) : toast.tone === 'error' ? (
          <ExclamationTriangleIcon className="size-4 shrink-0 fill-red-400" />
        ) : (
          <InformationCircleIcon className="size-4 shrink-0 fill-sky-400" />
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
