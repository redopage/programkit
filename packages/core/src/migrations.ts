import { eventCalendarFilename, eventCalendarInvitation } from './calendar.ts'
import type { WorkspaceState } from './types.ts'

export function normalizeWorkspaceState(state: WorkspaceState) {
  for (const event of state.events) event.version ??= 1
  state.submissionForms ??= []
  state.submissionFormFields ??= []
  state.submissions ??= []
  state.submissionReceiptDeliveries ??= []
  state.assets ??= []
  state.portalResources ??= []
  state.reviewers ??= []
  state.reviewerTeams ??= []
  state.evaluationPlans ??= []
  state.reviewerAssignments ??= []
  state.scorecards ??= []
  state.reviewDecisions ??= []
  state.campaignDeliveries ??= []
  state.acceleventsExports ??= []
  for (const delivery of state.campaignDeliveries) {
    if (delivery.attachments === undefined) {
      const event = state.events.find((entry) => entry.id === delivery.eventId)
      const filename = event ? eventCalendarFilename(event) : ''
      delivery.attachments =
        event &&
        delivery.attachmentNames?.includes(filename) &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(delivery.recipientEmail)
          ? [
              {
                filename,
                contentType: 'text/calendar; charset=utf-8; method=REQUEST',
                content: eventCalendarInvitation(
                  state.workspace,
                  event,
                  delivery.recipientEmail,
                  delivery.createdAt,
                ),
              },
            ]
          : []
    }
    delivery.attachmentNames ??= delivery.attachments.map((attachment) => attachment.filename)
  }
  for (const campaign of state.campaigns) {
    campaign.includeCalendarInvite ??= false
    campaign.queuedAt ??= null
  }
  state.schemaVersion = Math.max(state.schemaVersion, 14)
  return state
}
