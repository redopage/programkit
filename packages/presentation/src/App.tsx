import { ArrowPathIcon } from '@heroicons/react/16/solid'

import { Shell } from './components/Shell.tsx'
import { Button, LoadingScreen, ToastViewport } from './components/ui.tsx'
import { useRouter } from './lib/router.ts'
import { useWorkspace } from './lib/workspace.tsx'
import { AgendaView } from './views/AgendaView.tsx'
import { AgentView } from './views/AgentView.tsx'
import { ChangesView } from './views/ChangesView.tsx'
import { CommunicationsView } from './views/CommunicationsView.tsx'
import { IntegrationsView } from './views/IntegrationsView.tsx'
import { OverviewView } from './views/OverviewView.tsx'
import { PeopleView } from './views/PeopleView.tsx'
import { PortalView } from './views/PortalView.tsx'
import { ReadinessView } from './views/ReadinessView.tsx'
import { ScheduleView } from './views/ScheduleView.tsx'
import { SessionsView } from './views/SessionsView.tsx'

export function App() {
  const { pathname, search, navigate } = useRouter()
  const { payload, loading, error, refresh } = useWorkspace()

  if (loading) return <LoadingScreen />
  if (error || !payload) {
    return (
      <div className="grid min-h-dvh place-items-center bg-white p-6">
        <div className="max-w-md text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
            The workspace could not be loaded
          </h1>
          <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
            {error ?? 'The API did not return a workspace.'}
          </p>
          <div className="flex justify-center pt-5">
            <Button variant="primary" onClick={() => void refresh()}>
              <ArrowPathIcon className="size-4 h-lh shrink-0 fill-current" />
              Try again
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (pathname.startsWith('/portal')) {
    return (
      <>
        <PortalView />
        <ToastViewport />
      </>
    )
  }

  if (pathname === '/agenda') {
    return (
      <>
        <AgendaView navigate={navigate} />
        <ToastViewport />
      </>
    )
  }

  const personId = new URLSearchParams(search).get('person')
  let view
  switch (pathname) {
    case '/':
      view = <OverviewView navigate={navigate} />
      break
    case '/people':
      view = <PeopleView initialPersonId={personId} />
      break
    case '/readiness':
      view = <ReadinessView navigate={navigate} />
      break
    case '/sessions':
      view = <SessionsView navigate={navigate} />
      break
    case '/schedule':
      view = <ScheduleView navigate={navigate} />
      break
    case '/communications':
      view = <CommunicationsView />
      break
    case '/changes':
      view = <ChangesView />
      break
    case '/integrations':
      view = <IntegrationsView />
      break
    case '/agent':
      view = <AgentView navigate={navigate} />
      break
    default:
      view = (
        <div className="py-24 text-center">
          <h1 className="text-balance text-2xl font-semibold tracking-tight text-zinc-950">
            Page not found
          </h1>
          <p className="pt-2 text-pretty text-base text-zinc-500 sm:text-sm">
            This route is not part of the reference workspace.
          </p>
          <div className="flex justify-center pt-5">
            <Button variant="primary" onClick={() => navigate('/')}>
              Return to overview
            </Button>
          </div>
        </div>
      )
  }

  return (
    <>
      <Shell pathname={pathname} navigate={navigate}>
        {view}
      </Shell>
      <ToastViewport />
    </>
  )
}
