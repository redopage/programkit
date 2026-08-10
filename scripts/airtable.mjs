import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  AirtableWorkspaceStore,
  airtableTableDefinitions,
  createSeedState,
} from '../packages/core/dist/index.js'

function loadDevVars() {
  const path = resolve('apps/cloudflare/.dev.vars')
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/u)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = trimmed.indexOf('=')
    if (separator < 1) continue
    const key = trimmed.slice(0, separator).trim()
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^(['"])(.*)\1$/u, '$2')
    process.env[key] ??= value
  }
}

function required(name) {
  const value = process.env[name]
  if (!value)
    throw new Error(`${name} is required in the environment or apps/cloudflare/.dev.vars.`)
  return value
}

function summary(state) {
  return {
    workspace: state.workspace.name,
    revision: state.revision,
    events: state.events.length,
    people: state.people.length,
    participations: state.participations.length,
    submissions: state.submissions.length,
    tasks: state.requirementInstances.length,
    reviews: state.reviewerAssignments.length,
    sessions: state.sessions.length,
    placements: state.placements.length,
  }
}

loadDevVars()

const command = process.argv[2] ?? 'verify'
const store = new AirtableWorkspaceStore({
  token: required('AIRTABLE_TOKEN'),
  baseId: required('AIRTABLE_BASE_ID'),
})

if (command === 'setup') {
  const issues = await store.ensureSchema()
  console.log(
    JSON.stringify(
      {
        ok: issues.length === 0,
        requestCount: store.requestCount,
        managedTables: airtableTableDefinitions.map((table) => table.name),
        issues,
      },
      null,
      2,
    ),
  )
} else if (command === 'seed') {
  const result = await store.exportWorkspace(createSeedState())
  console.log(JSON.stringify({ ok: true, ...result }, null, 2))
} else if (command === 'verify') {
  const issues = await store.validateSchema()
  if (issues.length > 0) throw new Error(`Airtable schema is invalid: ${JSON.stringify(issues)}`)
  const state = await store.rebuildWorkspace()
  console.log(
    JSON.stringify(
      { ok: true, requestCount: store.requestCount, restored: summary(state) },
      null,
      2,
    ),
  )
} else {
  throw new Error(`Unknown command ${command}. Use setup, seed, or verify.`)
}
