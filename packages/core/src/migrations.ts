import type { WorkspaceState } from './types.ts'

export function normalizeWorkspaceState(state: WorkspaceState) {
  for (const event of state.events) event.version ??= 1
  state.submissionForms ??= []
  state.submissionFormFields ??= []
  state.submissions ??= []
  state.assets ??= []
  state.reviewers ??= []
  state.reviewerTeams ??= []
  state.evaluationPlans ??= []
  state.reviewerAssignments ??= []
  state.scorecards ??= []
  state.reviewDecisions ??= []
  state.campaignDeliveries ??= []
  for (const campaign of state.campaigns) {
    campaign.includeEventInvite ??= false
    campaign.queuedAt ??= null
  }
  state.schemaVersion = Math.max(state.schemaVersion, 5)
  return state
}
