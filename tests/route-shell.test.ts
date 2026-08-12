import { describe, expect, it } from 'vitest'

import {
  routeUsesOperatorShell,
  routeUsesWorkspaceShell,
} from '../packages/web/src/lib/route-shell.ts'

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

  it.each(['/', '/forms', '/crm', '/settings', '/integrations'])(
    'keeps %s inside the persistent operator shell',
    (pathname) => {
      expect(routeUsesOperatorShell(pathname)).toBe(true)
    },
  )

  it.each(['/agenda', '/submit/cfp', '/reviewer/rev_001', '/portal/par_001/key'])(
    'keeps %s outside the operator shell',
    (pathname) => {
      expect(routeUsesOperatorShell(pathname)).toBe(false)
    },
  )
})
