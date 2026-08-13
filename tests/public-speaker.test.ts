import { describe, expect, it } from 'vitest'

import {
  publicSpeakerAttribution,
  publicSpeakerRole,
} from '../packages/web/src/lib/public-speaker.ts'

describe('public speaker metadata', () => {
  it('omits punctuation for incomplete optional profile fields', () => {
    expect(publicSpeakerRole({ name: 'Ari', title: 'CTO', company: 'Northstar' })).toBe(
      'CTO at Northstar',
    )
    expect(publicSpeakerRole({ name: 'Ari', title: '', company: 'Northstar' })).toBe('Northstar')
    expect(publicSpeakerRole({ name: 'Ari', title: 'CTO', company: '' })).toBe('CTO')
    expect(publicSpeakerAttribution({ name: 'Ari', title: '', company: '' })).toBe('Ari')
  })
})
