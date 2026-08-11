import { describe, expect, it } from 'vitest'

import { mergeOrganizationCrmState } from '../apps/cloudflare/src/organization-crm.ts'
import { createSeedState } from '@programkit/core'

describe('organization CRM projection', () => {
  it('deduplicates shared contacts while retaining their event participation', () => {
    const first = createSeedState()
    const second = createSeedState()
    const shared = structuredClone(first.people[0])
    const secondEventId = 'evt_second_2027'
    const secondParticipation = structuredClone(first.participations[0])
    second.activeEventId = secondEventId
    second.events = [
      {
        ...structuredClone(first.events[0]),
        id: secondEventId,
        name: 'AIE Chicago 2027',
        slug: 'aie-chicago-2027',
      },
    ]
    second.people = [{ ...shared, id: 'per_duplicate_copy', tags: ['returning-speaker'] }]
    second.participations = [
      {
        ...secondParticipation,
        id: 'par_second',
        eventId: secondEventId,
        personId: 'per_duplicate_copy',
      },
    ]
    second.sessions = []
    second.contactNotes = []
    second.speakerPipeline = []
    second.crmSegments = []

    const merged = mergeOrganizationCrmState([
      {
        event: {
          id: first.activeEventId,
          organizationId: 'org_0123456789abcdef01234567',
          name: first.events[0].name,
          slug: first.events[0].slug,
          role: 'owner',
          createdAt: first.events[0].startsAt,
        },
        state: first,
      },
      {
        event: {
          id: secondEventId,
          organizationId: 'org_0123456789abcdef01234567',
          name: second.events[0].name,
          slug: second.events[0].slug,
          role: 'owner',
          createdAt: second.events[0].startsAt,
        },
        state: second,
      },
    ])!

    expect(merged.people.filter((person) => person.email === shared.email)).toHaveLength(1)
    expect(merged.people.find((person) => person.email === shared.email)?.tags).toContain(
      'returning-speaker',
    )
    expect(
      merged.participations.filter((participation) => participation.personId === shared.id),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventId: first.activeEventId }),
        expect.objectContaining({ eventId: secondEventId }),
      ]),
    )
  })
})
