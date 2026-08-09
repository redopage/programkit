import { ArrowRightStartOnRectangleIcon, CheckIcon, LinkIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { leaveCurrentDemo, readCurrentDemo, type DemoStatus } from '../lib/demo.ts'
import { Button } from './ui.tsx'

function expiryLabel(expiresAt: string) {
  const days = Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / (24 * 60 * 60 * 1_000)))
  return `${days} day${days === 1 ? '' : 's'}`
}

export function DemoBanner({
  onStatusChange,
}: {
  onStatusChange: (status: DemoStatus | null) => void
}) {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void readCurrentDemo(controller.signal)
      .then((result) => {
        setStatus(result)
        onStatusChange(result)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({ active: false })
        onStatusChange({ active: false })
      })
    return () => controller.abort()
  }, [onStatusChange])

  if (!status?.active || !status.demo) return null

  const copyLink = async () => {
    await navigator.clipboard.writeText(status.demo!.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  const leaveDemo = async () => {
    setLeaving(true)
    try {
      await leaveCurrentDemo()
      window.location.assign('/')
    } catch {
      setLeaving(false)
    }
  }

  return (
    <div className="fixed inset-x-0 top-0 z-40 flex h-[calc(3rem+env(safe-area-inset-top))] items-end bg-zinc-950/92 pt-[env(safe-area-inset-top)] text-white ring-1 ring-white/10 backdrop-blur-xl sm:h-[calc(2.5rem+env(safe-area-inset-top))]">
      <div className="flex h-12 min-w-0 flex-1 items-center gap-2 px-3 sm:h-10 sm:px-4">
        <p className="min-w-0 flex-1 truncate text-base text-zinc-300 sm:text-sm">
          <span className="font-medium text-white max-[359px]:hidden">
            Demo expires in {expiryLabel(status.demo.expiresAt)}
          </span>
          <span className="font-medium text-white min-[360px]:hidden">
            {expiryLabel(status.demo.expiresAt)} left
          </span>
          <span className="hidden md:inline">. Anyone with the link can edit.</span>
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="compact"
            className="text-zinc-300! hover:bg-white/10! hover:text-white! lg:hidden"
            onClick={() => void copyLink()}
          >
            {copied ? (
              <CheckIcon className="size-4 fill-emerald-400" />
            ) : (
              <LinkIcon className="size-4" />
            )}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button
            variant="ghost"
            size="compact"
            className="text-zinc-300! hover:bg-white/10! hover:text-white!"
            onClick={() => void leaveDemo()}
            disabled={leaving}
          >
            <ArrowRightStartOnRectangleIcon className="size-4" />
            {leaving ? 'Leaving…' : 'Leave'}
          </Button>
        </div>
      </div>
    </div>
  )
}
