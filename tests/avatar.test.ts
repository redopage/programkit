import { describe, expect, it } from 'vitest'

import { avatarInitials } from '../packages/web/src/components/ui.tsx'

describe('avatar initials', () => {
  it('uses the first and last name for a full name', () => {
    expect(avatarInitials('Robin Sloan')).toBe('RS')
    expect(avatarInitials('Mary Jane Watson')).toBe('MW')
  })

  it('handles single, spaced, and empty names', () => {
    expect(avatarInitials('Prince')).toBe('P')
    expect(avatarInitials('  Elena   Vasquez  ')).toBe('EV')
    expect(avatarInitials('')).toBe('?')
  })
})
