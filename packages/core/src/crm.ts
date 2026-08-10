import type { CrmSegment, Person, WorkspaceState } from './types.ts'

function normalized(value: string) {
  return value.trim().toLocaleLowerCase()
}

export function crmSegmentMembers(state: WorkspaceState, segment: CrmSegment) {
  if (segment.mode === 'static') {
    const selected = new Set(segment.personIds)
    return state.people.filter((person) => selected.has(person.id))
  }

  return state.people.filter((person) => {
    const company = normalized(segment.filters.company ?? '')
    const title = normalized(segment.filters.title ?? '')
    const tag = normalized(segment.filters.tag ?? '')
    return (
      (!company || normalized(person.company).includes(company)) &&
      (!title || normalized(person.title).includes(title)) &&
      (!tag || person.tags.some((entry) => normalized(entry) === tag))
    )
  })
}

export function contactConnections(state: WorkspaceState, personId: string) {
  return state.participations
    .filter((participation) => participation.personId === personId)
    .map((participation) => ({
      participation,
      event: state.events.find((event) => event.id === participation.eventId) ?? null,
      sessions: state.sessions.filter((session) => participation.sessionIds.includes(session.id)),
    }))
    .sort((left, right) => (right.event?.startsAt ?? '').localeCompare(left.event?.startsAt ?? ''))
}

function rankedValues(values: string[], limit = 5) {
  const counts = new Map<string, { label: string; count: number }>()
  for (const value of values) {
    const label = value.trim()
    if (!label) continue
    const key = normalized(label)
    const current = counts.get(key)
    counts.set(key, { label: current?.label ?? label, count: (current?.count ?? 0) + 1 })
  }
  return [...counts.values()]
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label))
    .slice(0, limit)
}

export function crmDashboard(state: WorkspaceState) {
  const participationCounts = new Map<string, number>()
  for (const participation of state.participations) {
    participationCounts.set(
      participation.personId,
      (participationCounts.get(participation.personId) ?? 0) + 1,
    )
  }
  return {
    totalContacts: state.people.length,
    eventCount: state.events.length,
    returningSpeakers: [...participationCounts.values()].filter((count) => count > 1).length,
    pipelineProspects: (state.speakerPipeline ?? []).filter(
      (entry) => entry.stage !== 'confirmed' && entry.stage !== 'declined',
    ).length,
    topCompanies: rankedValues(state.people.map((person) => person.company)),
    topTags: rankedValues(state.people.flatMap((person) => person.tags)),
  }
}

export function duplicateContactGroups(state: WorkspaceState) {
  const groups = new Map<string, Person[]>()
  for (const person of state.people) {
    const key = normalized(`${person.firstName} ${person.lastName}`)
    const group = groups.get(key) ?? []
    group.push(person)
    groups.set(key, group)
  }
  return [...groups.values()].filter((group) => group.length > 1)
}
