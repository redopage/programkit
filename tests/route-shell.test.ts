import { describe, expect, it } from 'vitest'

import { routeUsesWorkspaceShell } from '../packages/web/src/lib/route-shell.ts'

describe('web route shells', () => {
  it.each(['/access', '/demo', '/privacy', '/terms'])(
    'keeps %s independent from organizer workspace loading',
    (pathname) => {
      expect(routeUsesWorkspaceShell(pathname)).toBe(false)
    },
  )

  it.each(['/', '/forms', '/submissions', '/agenda', '/submit/cfp', '/portal/par_001/key'])(
    'keeps %s on its data-aware surface',
    (pathname) => {
      expect(routeUsesWorkspaceShell(pathname)).toBe(true)
    },
  )
})
