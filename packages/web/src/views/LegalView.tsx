import type { ReactNode } from 'react'

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
    <main className="min-h-dvh bg-white px-5 py-12 text-zinc-700 sm:px-8 sm:py-16">
      <article className="mx-auto max-w-2xl">
        <a href="/" className="text-sm font-medium text-blue-600 hover:text-blue-700">
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
