import { useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

/**
 * Keeps the existing view APIs small while TanStack Router owns history and route matching.
 * New components should prefer typed `Link` and `useNavigate` calls directly.
 */
export function useProgramNavigate() {
  const router = useRouter()

  return useCallback(
    (to: string) => {
      router.history.push(to)
      window.scrollTo({ top: 0, behavior: 'instant' })
    },
    [router],
  )
}
