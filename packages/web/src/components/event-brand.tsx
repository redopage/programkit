import { useEffect, useState } from 'react'

import { cx } from './ui.tsx'

function eventInitials(name: string) {
  const words = name.trim().split(/\s+/u).filter(Boolean)
  if (words.length === 0) return 'EV'
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase()
  return `${words[0]![0]}${words[1]![0]}`.toLocaleUpperCase()
}

export function EventIdentity({
  name,
  logoUrl,
  compact = false,
  className,
}: {
  name: string
  logoUrl?: string
  compact?: boolean
  className?: string
}) {
  const [logoFailed, setLogoFailed] = useState(false)

  useEffect(() => setLogoFailed(false), [logoUrl])

  const showLogo = Boolean(logoUrl?.trim()) && !logoFailed

  return (
    <div
      className={cx(
        'flex min-w-0 items-center text-zinc-950',
        compact ? 'gap-2' : 'gap-2.5',
        className,
      )}
    >
      {showLogo ? (
        <img
          src={logoUrl}
          alt=""
          aria-hidden="true"
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
          className={cx(
            'shrink-0 object-contain object-left',
            compact ? 'h-6 max-w-24' : 'h-8 max-w-32',
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cx(
            'grid shrink-0 place-items-center rounded-lg bg-zinc-950 font-semibold text-white',
            compact ? 'size-6 text-[0.6875rem]' : 'size-8 text-xs',
          )}
        >
          {eventInitials(name)}
        </span>
      )}
      <span
        className={cx(
          'min-w-0 truncate font-semibold tracking-tight',
          compact ? 'text-sm' : 'text-base',
        )}
      >
        {name}
      </span>
    </div>
  )
}
