export { App, ProgramKitApp } from './App.tsx'
export { ProgramKitMark } from './components/brand.tsx'
export { createProgramKitHttpClient, withPublicEventScope } from './client/http.ts'
export {
  externalAccessPath,
  publicProgramPath,
  publicSubmissionPath,
  reviewerAccessPath,
  speakerSubmissionsPath,
  speakerPortalPath,
} from './lib/public-links.ts'
export { surfaceFromPathname, surfaceKey, surfaceRefreshInterval } from './client/surfaces.ts'
export { parseSpeakerCsv, type SpeakerCsvRow } from './lib/speaker-csv.ts'
export type {
  ProgramKitClient,
  ProgramKitHttpClientOptions,
  ProgramKitSurface,
  WorkspacePayload,
} from './client/types.ts'
export { WorkspaceProvider, useWorkspace } from './lib/workspace.tsx'
