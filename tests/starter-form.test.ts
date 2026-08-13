import { describe, expect, it } from 'vitest'

import { submissionFormPublishReadiness } from '../packages/core/src/index.ts'
import {
  starterSubmissionFields,
  submissionFormSlug,
} from '../packages/web/src/lib/starter-form.ts'

describe('new event submission form starter', () => {
  it('creates a publish-ready field contract', () => {
    const fields = starterSubmissionFields([{ id: 'trk_platform', name: 'Platform' }]).map(
      (field, index) => ({ ...field, id: `fld_${index}`, formId: 'frm_new' }),
    )

    expect(submissionFormPublishReadiness(fields)).toMatchObject({
      ready: true,
      completedCount: 8,
      requiredCount: 8,
    })
    expect(fields.find((field) => field.purpose === 'track')?.options).toEqual([
      { value: 'trk_platform', label: 'Platform' },
    ])
  })

  it('normalizes the editable public path', () => {
    expect(submissionFormSlug('  AIE 2027: Call for Talks! ')).toBe('aie-2027-call-for-talks')
  })

  it('keeps a track-less draft editable but not publishable', () => {
    const fields = starterSubmissionFields([]).map((field, index) => ({
      ...field,
      id: `fld_${index}`,
      formId: 'frm_new',
    }))

    expect(fields.find((field) => field.purpose === 'track')?.options).toEqual([])
    expect(submissionFormPublishReadiness(fields)).toMatchObject({
      ready: false,
      completedCount: 7,
      incompletePurposes: ['track'],
    })
  })
})
