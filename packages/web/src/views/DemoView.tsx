import { ArrowRightIcon, ClockIcon, LinkIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'

import { Button } from '../components/ui.tsx'

interface CreatedDemo {
  ok: boolean
  demo?: { url: string }
  error?: string
}

export function DemoView() {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  return (
    <main className="min-h-dvh bg-canvas px-4 py-6 sm:grid sm:place-items-center sm:p-8">
      <div className="mx-auto w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-950/5">
        <div className="p-6 sm:p-10 lg:p-12">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              P
            </span>
            <span className="text-base font-semibold text-zinc-950">ProgramKit</span>
          </div>

          <div className="max-w-2xl pt-14 sm:pt-20">
            <h1 className="max-w-xl text-balance text-4xl font-semibold tracking-[-0.035em] text-zinc-950 sm:text-5xl">
              Try the full program workflow for a week.
            </h1>
            <p className="max-w-xl pt-5 text-pretty text-lg leading-8 text-zinc-600">
              Start with a realistic conference workspace. Make changes, invite a collaborator with
              the private link, and explore everything without creating an account.
            </p>

            <div className="flex flex-col gap-4 pt-8 sm:flex-row sm:items-center">
              <Button variant="primary" onClick={() => void createDemo()} disabled={creating}>
                {creating ? 'Creating demo…' : 'Create a private demo'}
                {!creating ? <ArrowRightIcon className="size-4" /> : null}
              </Button>
              <p className="text-sm text-zinc-500">
                Please do not add sensitive or production data.
              </p>
            </div>
            {error ? <p className="pt-3 text-sm text-red-600">{error}</p> : null}
          </div>

          <div className="mt-14 grid gap-3 border-t border-zinc-950/8 pt-6 text-sm text-zinc-600 sm:mt-20 sm:grid-cols-2">
            <div className="flex items-start gap-2.5">
              <ClockIcon className="mt-0.5 size-4 shrink-0 fill-zinc-400" />
              <p>Automatically deleted after seven days.</p>
            </div>
            <div className="flex items-start gap-2.5">
              <LinkIcon className="mt-0.5 size-4 shrink-0 fill-zinc-400" />
              <p>The private link is the key. Anyone who has it can edit.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
