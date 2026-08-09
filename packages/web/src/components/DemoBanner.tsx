import { CheckIcon, LinkIcon, TrashIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { Button } from './ui.tsx'

interface DemoStatus {
  active: boolean
  demo?: {
    createdAt: string
    expiresAt: string
    url: string
  }
}

function expiryLabel(expiresAt: string) {
  const days = Math.max(1, Math.ceil((Date.parse(expiresAt) - Date.now()) / (24 * 60 * 60 * 1_000)))
  return `${days} day${days === 1 ? '' : 's'}`
}

export function DemoBanner() {
  const [status, setStatus] = useState<DemoStatus | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch('/api/v1/demos/current', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Demo status could not be loaded.')
        setStatus((await response.json()) as DemoStatus)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus({ active: false })
      })
    return () => controller.abort()
  }, [])

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
    <div className="mb-4 flex min-w-0 flex-col gap-3 rounded-2xl bg-zinc-950/90 px-4 py-3 text-white shadow-lg ring-1 ring-white/10 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 text-sm text-zinc-300">
        <span className="font-medium text-white">Private demo</span>
        <span aria-hidden="true"> · </span>
        Expires in {expiryLabel(status.demo.expiresAt)}. Anyone with the link can edit.
      </p>
      <div className="flex shrink-0 items-center gap-1.5">
        {confirming ? (
          <Button
            variant="ghost"
            size="compact"
            className="text-zinc-300! hover:bg-white/10! hover:text-white!"
            onClick={() => setConfirming(false)}
            disabled={deleting}
          >
            Keep demo
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
            {copied ? 'Copied' : 'Copy link'}
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
  )
}
