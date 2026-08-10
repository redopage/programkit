import type { ReactNode } from 'react'

import { ProgramKitMark } from '../components/brand.tsx'

export function LegalView({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="min-h-dvh bg-white px-5 pt-[max(--spacing(12),env(safe-area-inset-top))] pb-[max(--spacing(12),env(safe-area-inset-bottom))] text-zinc-700 sm:px-8 sm:pt-[max(--spacing(16),env(safe-area-inset-top))] sm:pb-[max(--spacing(16),env(safe-area-inset-bottom))]">
      <article className="mx-auto max-w-2xl">
        <a
          href="/"
          aria-label="ProgramKit homepage"
          className="focus-ring flex w-fit items-center gap-2 rounded-lg text-sm font-semibold text-zinc-950"
        >
          <ProgramKitMark className="size-5" />
          ProgramKit
        </a>
        <h1 className="pt-6 text-3xl font-semibold tracking-tight text-zinc-950">{title}</h1>
        <p className="pt-2 text-sm text-zinc-500">Last updated {updated}</p>
        <div className="legal-copy pt-10">{children}</div>
        <footer className="legal-footer mt-12 border-t border-zinc-950/10 pt-6 text-sm text-zinc-500">
          Questions? Email <a href="mailto:support@programkit.dev">support@programkit.dev</a>.
        </footer>
      </article>
    </main>
  )
}
