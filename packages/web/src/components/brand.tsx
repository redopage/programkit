export function ProgramKitMarkBars({
  primaryClassName = 'fill-blue-600',
  accentClassName = 'fill-blue-300',
}: {
  primaryClassName?: string
  accentClassName?: string
}) {
  return (
    <>
      <rect className={primaryClassName} width="56" height="10" rx="3" />
      <rect className={primaryClassName} y="12" width="20" height="10" rx="3" />
      <rect className={accentClassName} x="36" y="12" width="20" height="10" rx="3" />
      <rect className={primaryClassName} y="24" width="56" height="10" rx="3" />
      <rect className={primaryClassName} y="36" width="20" height="10" rx="3" />
      <rect className={primaryClassName} y="48" width="20" height="10" rx="3" />
    </>
  )
}

export function ProgramKitMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 58"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <ProgramKitMarkBars />
    </svg>
  )
}
