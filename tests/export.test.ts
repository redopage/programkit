import { describe, expect, it } from 'vitest'

import {
  createAcceleventsExport,
  createReviewResultsCsv,
  createSeedState,
  createWorkspaceExportArchive,
  recordsToCsv,
} from '@programkit/core'

function storedZipFiles(archive: Uint8Array) {
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  let offset = 0
  while (offset + 30 <= archive.byteLength) {
    const view = new DataView(archive.buffer, archive.byteOffset + offset)
    if (view.getUint32(0, true) !== 0x04034b50) break
    const size = view.getUint32(18, true)
    const nameLength = view.getUint16(26, true)
    const extraLength = view.getUint16(28, true)
    const nameStart = offset + 30
    const dataStart = nameStart + nameLength + extraLength
    const name = decoder.decode(archive.subarray(nameStart, nameStart + nameLength))
    files.set(name, decoder.decode(archive.subarray(dataStart, dataStart + size)))
    offset = dataStart + size
  }
  return files
}

describe('workspace export archive', () => {
  it('contains a complete JSON backup, manifest, and readable CSV collections', () => {
    const state = createSeedState()
    const archive = createWorkspaceExportArchive(state, '2026-08-09T17:00:00.000Z')
    const files = storedZipFiles(archive)

    expect(files.get('README.txt')).toContain('ProgramKit export')
    expect(files.has('workspace.json')).toBe(true)
    expect(files.has('csv/workspace.csv')).toBe(true)
    expect(files.has('csv/people.csv')).toBe(true)
    expect(files.has('csv/submissions.csv')).toBe(true)

    const manifest = JSON.parse(files.get('manifest.json')!) as {
      format: string
      files: Array<{ name: string; rows?: number }>
    }
    expect(manifest.format).toBe('programkit.export.v2')
    expect(manifest.files).toContainEqual({ name: 'csv/people.csv', kind: 'csv', rows: 16 })

    const backup = JSON.parse(files.get('workspace.json')!) as {
      format: string
      state: { people: unknown[]; recentCommandResults: unknown[] }
    }
    expect(backup.format).toBe('programkit.workspace.v1')
    expect(backup.state.people).toHaveLength(16)
    expect(backup.state.recentCommandResults).toEqual([])

    expect(files.get('csv/people.csv')).toContain('"firstName","lastName","email"')
    expect(files.get('csv/submissions.csv')).toContain('"answers.email"')
  })

  it('uses RFC-style quoting and prevents spreadsheet formula execution', () => {
    const csv = recordsToCsv(
      [{ name: '=HYPERLINK("https://example.com")', note: 'Line one\nLine two' }],
      ['name', 'note'],
    )
    expect(csv).toContain('"\'=HYPERLINK(""https://example.com"")"')
    expect(csv).toContain('"Line one\nLine two"')
  })

  it('exports one review-results row per assigned submission with weighted aggregates', () => {
    const csv = createReviewResultsCsv(createSeedState())

    expect(csv).toContain('"weightedAggregate"')
    expect(csv).toContain('"criterionAverages.Attendee value"')
    expect(csv).toContain('"The boring parts of trustworthy agents"')
    expect(csv).toContain('"4.7"')
    expect(csv).toContain('"recommendations.accept"')
  })
})

describe('Accelevents export', () => {
  it('packages the published program using Accelevents speaker and session templates', () => {
    const exported = createAcceleventsExport(createSeedState(), '2026-08-09T17:00:00.000Z')
    const files = storedZipFiles(exported.archive)

    expect(exported.filename).toBe('aie-nyc-2026-accelevents-2026-08-09.zip')
    expect(exported.sessionCount).toBe(10)
    expect(exported.speakerCount).toBeGreaterThan(10)
    expect(files.get('README.txt')).toContain('Import speakers.csv')
    expect(files.get('README.txt')).toContain('America/New_York')
    expect(files.get('speakers.csv')).toContain('"Speaker Id","First Name","Last Name","Email"')
    expect(files.get('sessions.csv')).toContain(
      '"ID","Title","Format","Session Type","Start Date","Start Time","End Time"',
    )
    expect(files.get('sessions.csv')).toContain('"Opening the useful frontier"')
    expect(files.get('sessions.csv')).toContain('"MAIN_STAGE_SESSION"')
    expect(files.get('sessions.csv')).toContain('"04/10/2026","09:00","09:40"')
    expect(files.get('sessions.csv')).toContain('"Location Id"')
    expect(files.get('rooms-reference.csv')).toContain('"Main stage"')

    const manifest = JSON.parse(files.get('manifest.json')!) as {
      format: string
      releaseVersion: number
      counts: { sessions: number }
    }
    expect(manifest).toMatchObject({
      format: 'programkit.accelevents.v1',
      releaseVersion: 3,
      counts: { sessions: 10 },
    })
  })

  it('requires a published schedule release', () => {
    const state = createSeedState()
    state.scheduleReleases = []
    state.events[0]!.publishedScheduleVersion = null

    expect(() => createAcceleventsExport(state, '2026-08-09T17:00:00.000Z')).toThrow(
      'Publish the agenda before exporting to Accelevents.',
    )
  })
})
