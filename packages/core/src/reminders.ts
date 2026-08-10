import type {
  OutboundMessage,
  RequirementDefinition,
  RequirementInstance,
  WorkspaceState,
} from './types.ts'

const dayMs = 24 * 60 * 60 * 1_000

export const requirementReminderWindows = [
  { key: '7-days-before', offsetMs: -7 * dayMs },
  { key: '2-days-before', offsetMs: -2 * dayMs },
  { key: 'due', offsetMs: 0 },
  { key: '1-day-overdue', offsetMs: dayMs },
] as const

export type RequirementReminderWindow = (typeof requirementReminderWindows)[number]

export function requirementReminderTrigger(instanceId: string, window: RequirementReminderWindow) {
  return `requirement.reminder:${instanceId}:${window.key}`
}

function reminderWasQueued(
  messages: readonly OutboundMessage[],
  instance: RequirementInstance,
  window: RequirementReminderWindow,
) {
  const trigger = requirementReminderTrigger(instance.id, window)
  return messages.some((message) => message.trigger === trigger)
}

function isIncomplete(instance: RequirementInstance) {
  return instance.status !== 'approved' && instance.status !== 'waived'
}

function activeReminderEntries(state: WorkspaceState) {
  const messages = state.outboundMessages ?? []
  return state.requirementInstances.flatMap((instance) => {
    if (!isIncomplete(instance)) return []
    const definition = state.requirementDefinitions.find(
      (entry) => entry.id === instance.definitionId,
    )
    if (!definition?.automaticReminders) return []
    const participation = state.participations.find(
      (entry) => entry.id === instance.participationId,
    )
    if (
      !participation ||
      participation.eventId !== definition.eventId ||
      participation.status === 'declined' ||
      participation.status === 'withdrawn'
    ) {
      return []
    }
    return [{ instance, definition, participation, messages }]
  })
}

export function dueRequirementReminders(state: WorkspaceState, at: string | number | Date) {
  const now = new Date(at).getTime()
  if (!Number.isFinite(now)) return []
  return activeReminderEntries(state).flatMap((entry) => {
    const dueAt = Date.parse(entry.definition.dueAt)
    const latestReached = requirementReminderWindows.findLast(
      (window) => dueAt + window.offsetMs <= now,
    )
    if (!latestReached || reminderWasQueued(entry.messages, entry.instance, latestReached)) {
      return []
    }
    return [{ ...entry, window: latestReached }]
  })
}

export function nextRequirementReminderAt(state: WorkspaceState, at = Date.now()) {
  const now = typeof at === 'number' ? at : new Date(at).getTime()
  if (!Number.isFinite(now)) return null
  let next: number | null = null
  for (const entry of activeReminderEntries(state)) {
    const dueAt = Date.parse(entry.definition.dueAt)
    const latestReached = requirementReminderWindows.findLast(
      (window) => dueAt + window.offsetMs <= now,
    )
    if (latestReached && !reminderWasQueued(entry.messages, entry.instance, latestReached)) {
      return now
    }
    for (const window of requirementReminderWindows) {
      const scheduledAt = dueAt + window.offsetMs
      if (
        scheduledAt > now &&
        !reminderWasQueued(entry.messages, entry.instance, window) &&
        (next == null || scheduledAt < next)
      ) {
        next = scheduledAt
      }
    }
  }
  return next
}

export function requirementReminderSummary(definition: RequirementDefinition, at: string | Date) {
  const dueAt = Date.parse(definition.dueAt)
  const now = new Date(at).getTime()
  return now > dueAt ? 'overdue' : 'due soon'
}
