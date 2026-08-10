import { describe, expect, it } from 'vitest'

import {
  contactConnections,
  createSeedState,
  crmDashboard,
  crmSegmentMembers,
  duplicateContactGroups,
  executeOperation,
} from '@programkit/core'

describe('ProgramKit speaker CRM', () => {
  it('keeps one reusable contact across multiple event participations', () => {
    let state = createSeedState()
    state.events.push({
      ...state.events[0],
      id: 'evt_future',
      name: 'AIE Chicago 2027',
      slug: 'aie-chicago-2027',
      startsAt: '2027-10-04T13:00:00.000Z',
      endsAt: '2027-10-05T22:00:00.000Z',
      publishedScheduleVersion: null,
      version: 1,
    })
    const person = state.people[0]
    const added = executeOperation(state, 'person.add-to-event', {
      input: { personId: person.id, eventId: 'evt_future' },
    })
    expect(added.response.ok).toBe(true)
    state = added.state
    expect(state.people.filter((entry) => entry.id === person.id)).toHaveLength(1)
    expect(contactConnections(state, person.id)).toHaveLength(2)

    const repeated = executeOperation(state, 'person.add-to-event', {
      input: { personId: person.id, eventId: 'evt_future' },
    })
    expect(repeated.response.ok).toBe(true)
    expect(
      repeated.state.participations.filter((entry) => entry.personId === person.id),
    ).toHaveLength(2)
  })

  it('persists contact tags, notes, and reusable segments', () => {
    let state = createSeedState()
    const person = state.people[0]
    const updated = executeOperation(state, 'person.update', {
      input: { personId: person.id, tags: ['Keynote', 'AI', 'keynote'] },
    })
    expect(updated.response.ok).toBe(true)
    state = updated.state
    expect(state.people[0].tags).toEqual(['keynote', 'ai'])

    const noted = executeOperation(state, 'person.add-note', {
      input: { personId: person.id, body: 'Strong fit for the opening keynote.' },
    })
    expect(noted.response.ok).toBe(true)
    state = noted.state
    expect(state.contactNotes[0]).toMatchObject({
      personId: person.id,
      body: 'Strong fit for the opening keynote.',
    })

    const segmented = executeOperation(state, 'crm.segment.create', {
      input: {
        name: 'Keynote prospects',
        mode: 'dynamic',
        filters: { company: '', title: '', tag: 'keynote' },
      },
    })
    expect(segmented.response.ok).toBe(true)
    state = segmented.state
    expect(crmSegmentMembers(state, state.crmSegments[0]).map((entry) => entry.id)).toContain(
      person.id,
    )
    expect(state.crmSegments[0].filters).toEqual({ tag: 'keynote' })
  })

  it('tracks sourcing stage history and pipeline notes', () => {
    let state = createSeedState()
    const person = state.people[0]
    const enrolled = executeOperation(state, 'crm.pipeline.enroll', {
      input: {
        personId: person.id,
        stage: 'identified',
        score: 91,
        rationale: 'Excellent topic fit and audience reach.',
      },
    })
    expect(enrolled.response.ok).toBe(true)
    state = enrolled.state
    const entry = state.speakerPipeline[0]

    const moved = executeOperation(state, 'crm.pipeline.move', {
      input: { entryId: entry.id, stage: 'contacted' },
      expectedVersions: { [entry.id]: entry.version },
    })
    expect(moved.response.ok).toBe(true)
    state = moved.state
    expect(state.speakerPipeline[0].history).toHaveLength(2)
    expect(state.speakerPipeline[0].stage).toBe('contacted')

    const noted = executeOperation(state, 'crm.pipeline.add-note', {
      input: { entryId: entry.id, body: 'Intro sent by the program chair.' },
    })
    expect(noted.response.ok).toBe(true)
    expect(noted.state.speakerPipeline[0].notes[0].body).toBe('Intro sent by the program chair.')
  })

  it('merges duplicate contacts without losing event history or notes', () => {
    let state = createSeedState()
    const primary = state.people[0]
    const created = executeOperation(state, 'person.create', {
      input: {
        firstName: primary.firstName,
        lastName: primary.lastName,
        email: `alternate-${primary.email}`,
        company: primary.company,
      },
    })
    expect(created.response.ok).toBe(true)
    state = created.state
    const duplicate = state.people.at(-1)!
    expect(duplicateContactGroups(state)).toHaveLength(1)

    const noted = executeOperation(state, 'person.add-note', {
      input: { personId: duplicate.id, body: 'Imported from the partner list.' },
    })
    state = noted.state
    const merged = executeOperation(state, 'person.merge', {
      input: { primaryPersonId: primary.id, duplicatePersonId: duplicate.id },
    })
    expect(merged.response.ok).toBe(true)
    expect(merged.state.people.some((entry) => entry.id === duplicate.id)).toBe(false)
    expect(merged.state.contactNotes[0].personId).toBe(primary.id)
    expect(merged.state.participations.some((entry) => entry.personId === duplicate.id)).toBe(false)
  })

  it('summarizes organization CRM coverage', () => {
    const state = createSeedState()
    expect(crmDashboard(state)).toMatchObject({
      totalContacts: 16,
      eventCount: 1,
      returningSpeakers: 0,
      pipelineProspects: 0,
    })
  })

  it('queues personalized outreach for a selected contact set', () => {
    const state = createSeedState()
    const people = state.people.slice(0, 2)
    const result = executeOperation(state, 'crm.outreach.queue', {
      input: {
        personIds: people.map((person) => person.id),
        subject: '{{first_name}}, join the AIE program',
        body: 'Hi {{first_name}}, we would love to have you join us.',
      },
    })
    expect(result.response.ok).toBe(true)
    expect(result.state.outboundMessages?.slice(0, 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'crm_outreach', recipientEmail: people[0].email }),
        expect.objectContaining({ kind: 'crm_outreach', recipientEmail: people[1].email }),
      ]),
    )
    const firstMessage = result.state.outboundMessages?.find(
      (message) => message.recipientEmail === people[0].email,
    )
    expect(firstMessage?.subject).toContain(people[0].firstName)
    expect(firstMessage?.subject).not.toContain('{{first_name}}')
    expect(firstMessage?.body).not.toContain('{{first_name}}')
  })
})
