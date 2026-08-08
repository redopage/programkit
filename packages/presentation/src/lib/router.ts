import { useCallback, useEffect, useState } from 'react'

export interface RouteState {
  pathname: string
  search: string
}

function currentRoute(): RouteState {
  return { pathname: window.location.pathname, search: window.location.search }
}

export function useRouter() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const handlePopState = () => setRoute(currentRoute())
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const navigate = useCallback((to: string) => {
    window.history.pushState({}, '', to)
    setRoute(currentRoute())
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  return { ...route, navigate }
}
