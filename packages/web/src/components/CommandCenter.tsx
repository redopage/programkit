import {
  CheckIcon,
  CommandLineIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/react/16/solid'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { createPortal } from 'react-dom'

import { cx } from './ui.tsx'

export type CommandMode = 'commands' | 'shortcuts' | null

export interface ProgramCommand {
  id: string
  label: string
  description: string
  href: string
  section: 'Suggested' | 'Pages' | 'Public' | 'Settings'
  icon: ComponentType<{ className?: string }>
  keywords?: string[]
  shortcut?: readonly [string, string]
  default?: boolean
  meta?: string
}

interface CommandCenterProps {
  mode: CommandMode
  onModeChange: (mode: CommandMode) => void
  commands: ProgramCommand[]
  pathname: string
  navigate: (to: string) => void
}

const commandSections = ['Suggested', 'Pages', 'Public', 'Settings'] as const

function ShortcutKeys({
  keys,
  dark = false,
  ariaLabel,
}: {
  keys: readonly string[]
  dark?: boolean
  ariaLabel?: string
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-1 text-base sm:text-sm"
      aria-label={ariaLabel ?? keys.join(' then ')}
    >
      {keys.map((key, index) => (
        <kbd
          key={`${key}-${index}`}
          className={cx(
            'min-w-6 rounded-md px-1.5 py-0.5 text-center font-sans font-medium shadow-xs ring-1',
            dark
              ? 'bg-white/8 text-zinc-200 ring-white/10'
              : 'bg-zinc-950/4 text-zinc-500 ring-zinc-950/5',
          )}
        >
          {key}
        </kbd>
      ))}
    </div>
  )
}

function detectApplePlatform() {
  if (typeof navigator === 'undefined') return false
  const clientNavigator = navigator as Navigator & {
    userAgentData?: { platform?: string }
  }
  const platform =
    clientNavigator.userAgentData?.platform || navigator.platform || navigator.userAgent
  return /mac|iphone|ipad|ipod/iu.test(platform)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable ||
    target.matches('[role="textbox"]') ||
    Boolean(target.closest('[data-shortcuts-disabled]'))
  )
}

export function CommandCenter({
  mode,
  onModeChange,
  commands,
  pathname,
  navigate,
}: CommandCenterProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [goMode, setGoMode] = useState(false)
  const [applePlatform] = useState(detectApplePlatform)
  const panelRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const goTimerRef = useRef<number | null>(null)
  const titleId = useId()
  const listId = useId()

  const close = useCallback(() => {
    onModeChange(null)
    setQuery('')
    setActiveIndex(0)
  }, [onModeChange])

  const clearGoMode = useCallback(() => {
    if (goTimerRef.current != null) window.clearTimeout(goTimerRef.current)
    goTimerRef.current = null
    setGoMode(false)
  }, [])

  const visibleCommands = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase().split(/\s+/u).filter(Boolean)
    const matches =
      terms.length === 0
        ? commands.filter((command) => command.default)
        : commands.filter((command) => {
            const haystack = [
              command.label,
              command.description,
              command.section,
              ...(command.keywords ?? []),
            ]
              .join(' ')
              .toLocaleLowerCase()
            return terms.every((term) => haystack.includes(term))
          })
    return matches.sort(
      (left, right) =>
        commandSections.indexOf(left.section) - commandSections.indexOf(right.section),
    )
  }, [commands, query])

  const groupedCommands = useMemo(() => {
    return commandSections
      .map((section) => ({
        section,
        items: visibleCommands
          .map((command, index) => ({ command, index }))
          .filter(({ command }) => command.section === section),
      }))
      .filter(({ items }) => items.length > 0)
  }, [visibleCommands])

  const shortcutCommands = useMemo(() => commands.filter((command) => command.shortcut), [commands])

  const runCommand = useCallback(
    (command: ProgramCommand) => {
      close()
      navigate(command.href)
    },
    [close, navigate],
  )

  useEffect(() => {
    if (mode !== 'commands') return
    setActiveIndex(0)
  }, [mode, query])

  useEffect(() => {
    if (mode !== 'commands') return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, mode])

  useEffect(() => {
    const handleGlobalKey = (event: KeyboardEvent) => {
      const key = event.key.toLocaleLowerCase()
      const commandModifier = applePlatform ? event.metaKey : event.ctrlKey

      if (commandModifier && !event.altKey && !event.shiftKey && key === 'k') {
        event.preventDefault()
        clearGoMode()
        onModeChange('commands')
        return
      }
      if (mode || event.repeat || event.altKey || event.metaKey || event.ctrlKey) return
      if (isEditableTarget(event.target)) return

      if (event.key === '/') {
        event.preventDefault()
        clearGoMode()
        onModeChange('commands')
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        clearGoMode()
        onModeChange('shortcuts')
        return
      }

      if (goMode) {
        const command = shortcutCommands.find(
          (candidate) => candidate.shortcut?.[1].toLocaleLowerCase() === key,
        )
        clearGoMode()
        if (!command) return
        event.preventDefault()
        navigate(command.href)
        return
      }

      if (key !== 'g') return
      event.preventDefault()
      setGoMode(true)
      goTimerRef.current = window.setTimeout(clearGoMode, 1800)
    }

    document.addEventListener('keydown', handleGlobalKey)
    return () => document.removeEventListener('keydown', handleGlobalKey)
  }, [applePlatform, clearGoMode, goMode, mode, navigate, onModeChange, shortcutCommands])

  useEffect(() => () => clearGoMode(), [clearGoMode])

  useEffect(() => {
    if (!mode) return
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
      'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
    const frame = window.requestAnimationFrame(() => {
      if (mode === 'commands') searchRef.current?.focus()
      else panel?.focus()
    })
    const handleModalKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
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
    document.addEventListener('keydown', handleModalKey)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', handleModalKey)
      document.body.style.overflow = previousOverflow
      if (appRoot) {
        appRoot.inert = rootWasInert
        if (rootAriaHidden == null) appRoot.removeAttribute('aria-hidden')
        else appRoot.setAttribute('aria-hidden', rootAriaHidden)
      }
      previousFocus?.focus()
    }
  }, [close, mode])

  function handleSearchKey(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (visibleCommands.length === 0) return
      setActiveIndex((current) => Math.min(current + 1, visibleCommands.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (visibleCommands.length === 0) return
      setActiveIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      const command = visibleCommands[activeIndex]
      if (command) runCommand(command)
    }
  }

  const modifierLabel = applePlatform ? '⌘' : 'Ctrl'
  const modifierName = applePlatform ? 'Command' : 'Control'

  return (
    <>
      {goMode && !mode
        ? createPortal(
            <div
              role="status"
              className="fixed inset-x-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-fit max-w-[calc(100vw-1.5rem)] items-center gap-1.5 overflow-x-auto rounded-xl bg-zinc-900 p-1.5 text-base text-white shadow-2xl ring-1 ring-white/10 motion-safe:animate-rise-in sm:bottom-6 sm:text-sm"
            >
              <div className="shrink-0 px-1.5 font-medium">Go to</div>
              {shortcutCommands.map((command) => (
                <div
                  key={command.id}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/8 py-1 pr-2 pl-1"
                >
                  <ShortcutKeys keys={[command.shortcut![1]]} dark />
                  <div className="whitespace-nowrap text-zinc-300">{command.label}</div>
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}

      {mode
        ? createPortal(
            <div
              className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-[max(--spacing(3),7dvh)] sm:p-6 sm:pt-[11dvh]"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <div
                className="absolute inset-0 bg-zinc-950/25 backdrop-blur-[2px] motion-safe:animate-fade-in"
                aria-hidden="true"
                onClick={close}
              />

              {mode === 'commands' ? (
                <div
                  ref={panelRef}
                  tabIndex={-1}
                  className="relative flex max-h-[min(72dvh,32rem)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white/95 shadow-2xl ring-1 ring-black/10 backdrop-blur-xl focus:outline-none motion-safe:animate-command-in"
                >
                  <h2 id={titleId} className="sr-only">
                    Command center
                  </h2>
                  <div className="grid shrink-0 grid-cols-1 border-b border-zinc-950/5">
                    <MagnifyingGlassIcon className="pointer-events-none col-start-1 row-start-1 ml-4 size-4 h-lh shrink-0 self-center fill-zinc-400" />
                    <input
                      ref={searchRef}
                      id="programkit-command-search"
                      name="command-search"
                      type="search"
                      role="combobox"
                      aria-label="Search ProgramKit"
                      aria-expanded="true"
                      aria-controls={listId}
                      aria-activedescendant={
                        visibleCommands[activeIndex]
                          ? `${listId}-${visibleCommands[activeIndex].id}`
                          : undefined
                      }
                      autoComplete="off"
                      placeholder="Search or run a command"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      onKeyDown={handleSearchKey}
                      className="focus-ring-control col-start-1 row-start-1 min-h-12 w-full bg-transparent py-2.5 pr-12 pl-11 text-base text-zinc-950 outline-none placeholder:text-zinc-400 [&::-webkit-search-cancel-button]:appearance-none"
                    />
                    {query ? (
                      <button
                        type="button"
                        aria-label="Clear command search"
                        onClick={() => setQuery('')}
                        className="focus-ring col-start-1 row-start-1 mr-3 inline-flex size-8 place-self-center justify-self-end items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-950/5 hover:text-zinc-700"
                      >
                        <XMarkIcon className="size-4 shrink-0 fill-current" />
                      </button>
                    ) : null}
                  </div>

                  <div id={listId} role="listbox" className="min-h-0 flex-1 overflow-y-auto p-2">
                    {visibleCommands.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {groupedCommands.map(({ section, items }) => (
                          <div key={section}>
                            <div className="px-2 py-1 text-base font-medium text-zinc-400 sm:text-sm">
                              {section}
                            </div>
                            <div className="flex flex-col gap-px">
                              {items.map(({ command, index }) => {
                                const Icon = command.icon
                                const active = index === activeIndex
                                const current = pathname === command.href.split('?')[0]
                                return (
                                  <button
                                    key={command.id}
                                    ref={(element) => {
                                      optionRefs.current[index] = element
                                    }}
                                    id={`${listId}-${command.id}`}
                                    type="button"
                                    role="option"
                                    aria-selected={active}
                                    aria-current={current ? 'page' : undefined}
                                    onPointerMove={() => setActiveIndex(index)}
                                    onClick={() => runCommand(command)}
                                    aria-label={`${command.label}. ${command.description}`}
                                    title={command.description}
                                    className={cx(
                                      'focus-ring flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left',
                                      active ? 'bg-blue-50 text-zinc-950' : 'text-zinc-700',
                                    )}
                                  >
                                    <Icon
                                      className={cx(
                                        'size-4 h-lh shrink-0',
                                        active ? 'fill-blue-600' : 'fill-zinc-400',
                                      )}
                                    />
                                    <div className="min-w-0 flex-1 truncate text-base font-medium sm:text-sm">
                                      {command.label}
                                    </div>
                                    {current ? (
                                      <div
                                        title="Current page"
                                        className="flex shrink-0 items-center gap-1 text-base text-blue-700 sm:text-sm"
                                      >
                                        <CheckIcon className="size-4 h-lh shrink-0 fill-blue-600" />
                                        <div className="hidden sm:block">Current</div>
                                      </div>
                                    ) : command.meta ? (
                                      <div className="max-w-32 shrink-0 truncate text-sm text-zinc-400">
                                        {command.meta}
                                      </div>
                                    ) : command.shortcut ? (
                                      <ShortcutKeys keys={command.shortcut} />
                                    ) : null}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex min-h-48 flex-col items-center justify-center gap-3 px-6 text-center">
                        <CommandLineIcon className="size-4 shrink-0 fill-zinc-400" />
                        <div>
                          <div className="text-base font-medium text-zinc-950 sm:text-sm">
                            No matching commands
                          </div>
                          <p className="max-w-[42ch] text-pretty text-base text-zinc-500 sm:text-sm">
                            Try a page name, workflow, or person-related task.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center justify-between gap-3 border-t border-zinc-950/5 bg-zinc-950/2 px-3 py-2">
                    <div className="hidden items-center gap-2 text-sm text-zinc-400 sm:flex">
                      <ShortcutKeys keys={['↑', '↓']} />
                      <div>Move</div>
                      <ShortcutKeys keys={['↵']} />
                      <div>Open</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onModeChange('shortcuts')}
                      className="focus-ring ml-auto flex min-h-9 items-center gap-2 rounded-lg px-2 text-base font-medium text-zinc-600 hover:bg-zinc-950/5 hover:text-zinc-950 sm:min-h-8 sm:text-sm"
                    >
                      <div>Shortcuts</div>
                      <ShortcutKeys keys={['?']} />
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  ref={panelRef}
                  tabIndex={-1}
                  className="relative flex max-h-[min(82dvh,34rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-zinc-900 text-white shadow-2xl ring-1 ring-white/10 focus:outline-none motion-safe:animate-command-in"
                >
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 p-3">
                    <h2 id={titleId} className="text-balance text-lg font-semibold">
                      Keyboard shortcuts
                    </h2>
                    <button
                      type="button"
                      aria-label="Close keyboard shortcuts"
                      onClick={close}
                      className="touch-target focus-ring inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/8 hover:text-white"
                    >
                      <XMarkIcon className="size-4 shrink-0 fill-current" />
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3">
                    <div className="flex flex-col gap-3">
                      <div>
                        <div className="px-2 py-1 text-base font-medium text-zinc-400 sm:text-sm">
                          Anywhere
                        </div>
                        <div className="divide-y divide-white/8">
                          {[
                            { label: 'Search ProgramKit', keys: ['/'] },
                            {
                              label: 'Open command menu',
                              keys: [modifierLabel, 'K'],
                              ariaLabel: `${modifierName} plus K`,
                            },
                            { label: 'Show keyboard shortcuts', keys: ['?'] },
                          ].map((shortcut) => (
                            <div
                              key={shortcut.label}
                              className="flex min-h-11 items-center justify-between gap-4 px-2 py-2 sm:min-h-10 sm:py-1.5"
                            >
                              <div className="min-w-0 text-base text-zinc-200 sm:text-sm">
                                {shortcut.label}
                              </div>
                              <ShortcutKeys
                                keys={shortcut.keys}
                                ariaLabel={shortcut.ariaLabel}
                                dark
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="px-2 py-1 text-base font-medium text-zinc-400 sm:text-sm">
                          Command menu
                        </div>
                        <div className="divide-y divide-white/8">
                          {[
                            {
                              label: 'Move selection',
                              keys: ['↑', '↓'],
                              ariaLabel: 'Up or Down Arrow',
                            },
                            { label: 'Open selected result', keys: ['Enter'] },
                            { label: 'Close the menu', keys: ['Esc'] },
                          ].map((shortcut) => (
                            <div
                              key={shortcut.label}
                              className="flex min-h-11 items-center justify-between gap-4 px-2 py-2 sm:min-h-10 sm:py-1.5"
                            >
                              <div className="min-w-0 text-base text-zinc-200 sm:text-sm">
                                {shortcut.label}
                              </div>
                              <ShortcutKeys
                                keys={shortcut.keys}
                                ariaLabel={shortcut.ariaLabel}
                                dark
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="px-2 py-1 text-base font-medium text-zinc-400 sm:text-sm">
                          Navigate
                        </div>
                        <div className="grid gap-x-4 sm:grid-cols-2">
                          {shortcutCommands.map((command) => (
                            <button
                              key={command.id}
                              type="button"
                              onClick={() => runCommand(command)}
                              className="focus-ring flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-2 text-left text-zinc-200 hover:bg-white/8 hover:text-white sm:min-h-10"
                            >
                              <div className="min-w-0 truncate text-base sm:text-sm">
                                {command.label}
                              </div>
                              <ShortcutKeys keys={command.shortcut!} dark />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
