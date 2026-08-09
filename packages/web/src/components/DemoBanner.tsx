import { CheckIcon, LinkIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { readCurrentDemo, type DemoStatus } from '../lib/demo.ts'
import { Button } from './ui.tsx'

function expiryLabel(expiresAt: string) {
  const days = Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / (24 * 60 * 60 * 1_000)))
  return `${days} day${days === 1 ? '' : 's'}`
}

export function DemoBanner({ onActiveChange }: { onActiveChange: (active: boolean) => void }) {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void readCurrentDemo(controller.signal)
      .then((result) => {
        setStatus(result)
        onActiveChange(result.active)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({ active: false })
        onActiveChange(false)
      })
    return () => controller.abort()
  }, [onActiveChange])

  if (!status?.active || !status.demo) return null

  const copyLink = async () => {
    await navigator.clipboard.writeText(status.demo!.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  const deleteDemo = async () => {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setDeleting(true)
    const response = await fetch('/api/v1/demos/current', {
      method: 'POST',
      credentials: 'same-origin',
    })
    if (!response.ok) {
      setDeleting(false)
      setConfirming(false)
      return
    }
    window.location.assign('/demo')
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
          {confirming ? (
            <Button
              variant="ghost"
              size="compact"
              className="text-zinc-300! hover:bg-white/10! hover:text-white!"
              onClick={() => setConfirming(false)}
              disabled={deleting}
            >
              Keep
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="compact"
              className="text-zinc-300! hover:bg-white/10! hover:text-white!"
              onClick={() => void copyLink()}
            >
              {copied ? (
                <CheckIcon className="size-4 fill-emerald-400" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              {copied ? 'Copied' : 'Copy'}
            </Button>
          )}
          <Button
            variant="ghost"
            size="compact"
            className={
              confirming
                ? 'bg-red-500/15! text-red-200! ring-red-400/20! hover:bg-red-500/25! hover:text-white!'
                : 'text-zinc-300! hover:bg-white/10! hover:text-white!'
            }
            onClick={() => void deleteDemo()}
            disabled={deleting}
          >
            <TrashIcon className="size-4" />
            {deleting ? 'Deleting…' : confirming ? 'Delete now' : 'Delete'}
          </Button>
        </div>
      </div>
    </div>
  )
}
