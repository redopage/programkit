export function ProgramKitMark({ className = 'size-8' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 56 58"
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${className}`}
    >
      <rect className="fill-blue-600" width="56" height="10" rx="3" />
      <rect className="fill-blue-600" y="12" width="20" height="10" rx="3" />
      <rect className="fill-blue-300" x="36" y="12" width="20" height="10" rx="3" />
      <rect className="fill-blue-600" y="24" width="56" height="10" rx="3" />
      <rect className="fill-blue-600" y="36" width="20" height="10" rx="3" />
      <rect className="fill-blue-600" y="48" width="20" height="10" rx="3" />
    </svg>
  )
}
