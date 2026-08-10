import { ArrowRightIcon, CheckIcon, LinkIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'

import { ProgramKitMark } from '../components/brand.tsx'
import { Button } from '../components/ui.tsx'
import {
  createDemo as createHostedDemo,
  leaveCurrentDemo,
  readCurrentDemo,
  type DemoDetails,
} from '../lib/demo.ts'

export function DemoView() {
  const [creating, setCreating] = useState(false)
  const [leaving, setLeaving] = useState(false)
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
      const demo = await createHostedDemo()
      window.location.assign(demo.url)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo could not be created.')
      setCreating(false)
    }
  }

  const leaveDemo = async () => {
    setLeaving(true)
    setError(null)
    try {
      await leaveCurrentDemo()
      window.location.assign('/')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The demo could not be left.')
      setLeaving(false)
    }
  }

  const copyLink = async () => {
    if (!current) return
    await navigator.clipboard.writeText(current.url)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 pt-[max(--spacing(10),env(safe-area-inset-top))] pb-[max(--spacing(10),env(safe-area-inset-bottom))] text-center">
      <div className="w-full max-w-xs">
        <a
          href="/"
          aria-label="ProgramKit homepage"
          className="focus-ring mx-auto flex w-fit items-center gap-2.5 rounded-xl"
        >
          <ProgramKitMark className="size-8" />
          <span className="text-base font-semibold text-zinc-950">ProgramKit</span>
        </a>

        <div className="pt-14 sm:pt-16">
          <h1 className="mx-auto max-w-[20ch] text-balance text-3xl font-semibold tracking-tight text-zinc-950">
            {current ? 'Welcome back.' : 'Try ProgramKit.'}
          </h1>
          <p className="mx-auto max-w-[48ch] pt-3 text-pretty text-base/7 text-zinc-600 sm:text-sm/6">
            {current
              ? 'Continue your workspace or share its private link.'
              : 'Explore a complete conference workspace. No account required.'}
          </p>

          <div className="grid gap-3 pt-7">
            {current ? (
              <>
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() => window.location.assign('/')}
                >
                  Continue demo
                  <ArrowRightIcon className="size-4" />
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => void createDemo()}
                  disabled={creating || leaving}
                >
                  {creating ? 'Creating demo…' : 'Start a new demo'}
                </Button>
                <div className="flex items-center justify-center gap-4 pt-1 text-sm text-zinc-500">
                  <button
                    type="button"
                    className="focus-ring inline-flex items-center gap-1.5 rounded-md underline-offset-4 hover:text-zinc-950 hover:underline"
                    onClick={() => void copyLink()}
                  >
                    {copied ? (
                      <CheckIcon className="size-3.5 fill-emerald-600" />
                    ) : (
                      <LinkIcon className="size-3.5" />
                    )}
                    {copied ? 'Copied' : 'Copy link'}
                  </button>
                  <button
                    type="button"
                    className="focus-ring rounded-md underline-offset-4 hover:text-zinc-950 hover:underline"
                    onClick={() => void leaveDemo()}
                    disabled={leaving || creating}
                  >
                    {leaving ? 'Leaving…' : 'Leave demo'}
                  </button>
                </div>
              </>
            ) : (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => void createDemo()}
                disabled={creating}
              >
                {creating ? 'Creating demo…' : 'Start demo'}
                {!creating ? <ArrowRightIcon className="size-4" /> : null}
              </Button>
            )}
          </div>
          {error ? <p className="pt-3 text-base text-red-600 sm:text-sm">{error}</p> : null}

          <p className="pt-5 text-pretty text-base/7 text-zinc-500 sm:text-sm/6">
            {current
              ? 'A new demo gets a new private link. This one keeps working until it expires.'
              : 'Private link. Sample data only. Deleted after seven days.'}
          </p>
        </div>

        <div className="flex justify-center gap-4 pt-14 text-base text-zinc-500 sm:pt-16 sm:text-sm">
          <a className="focus-ring rounded-md underline-offset-4 hover:underline" href="/privacy">
            Privacy
          </a>
          <a className="focus-ring rounded-md underline-offset-4 hover:underline" href="/terms">
            Terms
          </a>
        </div>
      </div>
    </main>
  )
}
