import { ArrowRightIcon, CheckIcon, ClockIcon, LinkIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { Button } from '../components/ui.tsx'
import { readCurrentDemo, type DemoDetails } from '../lib/demo.ts'

interface CreatedDemo {
  ok: boolean
  demo?: { url: string }
  error?: string
}

export function DemoView() {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [current, setCurrent] = useState<DemoDetails | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void readCurrentDemo(controller.signal)
      .then((status) => setCurrent(status.active ? (status.demo ?? null) : null))
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setCurrent(null)
      })
    return () => controller.abort()
  }, [])

  const createDemo = async () => {
    setCreating(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/demos', {
        method: 'POST',
        credentials: 'same-origin',
      })
      const result = (await response.json()) as CreatedDemo
      if (!response.ok || !result.demo)
        throw new Error(result.error ?? 'The demo could not be created.')
      window.location.assign(result.demo.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo could not be created.')
      setCreating(false)
    }
  }

  const copyLink = async () => {
    if (!current) return
    await navigator.clipboard.writeText(current.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:grid sm:place-items-center sm:p-8">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-950/5">
        <div className="p-6 sm:p-10 lg:p-12">
          <a
            href="/"
            aria-label="Homepage"
            className="focus-ring flex w-fit items-center gap-3 rounded-xl"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              P
            </span>
            <span className="text-base font-semibold text-zinc-950">ProgramKit</span>
          </a>

          <div className="pt-14 sm:pt-20">
            <h1 className="max-w-[20ch] text-balance text-4xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-5xl">
              {current ? 'Your demo is ready.' : 'Try the full program workflow for a week.'}
            </h1>
            <p className="max-w-[48ch] pt-5 text-pretty text-lg leading-8 text-zinc-600">
              {current
                ? 'Continue where you left off or copy the private link to invite someone.'
                : 'Start with a realistic conference workspace. Make changes, invite a collaborator with the private link, and explore everything without creating an account.'}
            </p>

            <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-center">
              {current ? (
                <>
                  <Button variant="primary" onClick={() => window.location.assign('/')}>
                    Continue demo
                    <ArrowRightIcon className="size-4" />
                  </Button>
                  <Button variant="secondary" onClick={() => void copyLink()}>
                    {copied ? (
                      <CheckIcon className="size-4 fill-emerald-600" />
                    ) : (
                      <LinkIcon className="size-4" />
                    )}
                    {copied ? 'Copied' : 'Copy link'}
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="primary" onClick={() => void createDemo()} disabled={creating}>
                    {creating ? 'Creating demo…' : 'Create a private demo'}
                    {!creating ? <ArrowRightIcon className="size-4" /> : null}
                  </Button>
                  <p className="text-base text-zinc-500 sm:text-sm">
                    Please do not add sensitive or production data.
                  </p>
                </>
              )}
            </div>
            {error ? <p className="pt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="mt-14 grid gap-3 border-t border-zinc-950/8 pt-6 text-base text-zinc-600 sm:mt-20 sm:grid-cols-2 sm:text-sm">
            <div className="flex items-start gap-2.5">
              <ClockIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
              <p>
                {current
                  ? 'Automatically deleted when the seven-day demo ends.'
                  : 'Automatically deleted after seven days.'}
              </p>
            </div>
            <div className="flex items-start gap-2.5">
              <LinkIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
              <p>The private link is the key. Anyone who has it can edit.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
