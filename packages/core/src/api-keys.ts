export const apiKeyScopes = [
  'workspace:read',
  'workspace:export',
  'events:read',
  'submissions:read',
  'sessions:read',
  'people:read',
  'participations:read',
  'requirements:read',
  'schedule:read',
  'changes:read',
  'events:write',
  'submission-forms:write',
  'submission-forms:publish',
  'submissions:write',
  'submissions:submit',
  'reviews:configure',
  'reviews:write',
  'reviews:decide',
  'sessions:write',
  'schedule:draft',
  'schedule:publish',
  'people:write',
  'participations:write',
  'requirements:write',
  'assets:write',
  'portal:write',
  'communications:write',
  'communications:draft',
  'communications:approve',
  'communications:send',
  'changes:propose',
] as const

export type ApiKeyScope = (typeof apiKeyScopes)[number]

/**
 * Least-privilege access for the tools and resources exposed by the bundled
 * ProgramKit Agent Plugin. Agents can read operational state, draft messages,
 * and propose schedule changes, but cannot approve, send, commit, or publish.
 */
export const agentApiKeyScopes = [
  'workspace:read',
  'submissions:read',
  'sessions:read',
  'people:read',
  'participations:read',
  'requirements:read',
  'schedule:read',
  'schedule:draft',
  'communications:draft',
  'changes:read',
  'changes:propose',
] as const satisfies readonly ApiKeyScope[]
