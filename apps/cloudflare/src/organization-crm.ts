import type { WorkspaceState } from '@programkit/core'

import type { AuthEventSummary } from './auth.ts'

export interface OrganizationCrmWorkspace {
  event: AuthEventSummary
  state: WorkspaceState
}

export function mergeOrganizationCrmState(workspaces: OrganizationCrmWorkspace[]) {
  const active = workspaces[0]
  if (!active) return null
  const state = structuredClone(active.state)
  const people = new Map<string, WorkspaceState['people'][number]>()
  const personIds = new Map<string, string>()

  for (const workspace of workspaces) {
    for (const person of workspace.state.people) {
      const email = person.email.trim().toLocaleLowerCase()
      const canonical = people.get(email)
      if (!canonical) {
        people.set(email, structuredClone(person))
        personIds.set(`${workspace.event.id}:${person.id}`, person.id)
        continue
      }
      canonical.tags = [...new Set([...canonical.tags, ...person.tags])]
      canonical.updatedAt =
        canonical.updatedAt.localeCompare(person.updatedAt) >= 0
          ? canonical.updatedAt
          : person.updatedAt
      personIds.set(`${workspace.event.id}:${person.id}`, canonical.id)
    }
  }

  const personIdFor = (eventId: string, personId: string) =>
    personIds.get(`${eventId}:${personId}`) ?? personId
  state.events = workspaces.flatMap((workspace) =>
    workspace.state.events.filter((event) => event.id === workspace.event.id),
  )
  state.people = [...people.values()]
  state.participations = workspaces.flatMap((workspace) =>
    workspace.state.participations.map((participation) => ({
      ...structuredClone(participation),
      personId: personIdFor(workspace.event.id, participation.personId),
    })),
  )
  state.sessions = workspaces.flatMap((workspace) => structuredClone(workspace.state.sessions))
  state.contactNotes = workspaces.flatMap((workspace) =>
    workspace.state.contactNotes.map((note) => ({
      ...structuredClone(note),
      personId: personIdFor(workspace.event.id, note.personId),
    })),
  )
  state.speakerPipeline = workspaces.flatMap((workspace) =>
    workspace.state.speakerPipeline.map((entry) => ({
      ...structuredClone(entry),
      personId: personIdFor(workspace.event.id, entry.personId),
    })),
  )
  state.crmSegments = workspaces.flatMap((workspace) =>
    workspace.state.crmSegments.map((segment) => ({
      ...structuredClone(segment),
      personIds: segment.personIds.map((personId) => personIdFor(workspace.event.id, personId)),
    })),
  )
  state.revision = Math.max(...workspaces.map((workspace) => workspace.state.revision))
  state.recentCommandResults = []
  return state
}
