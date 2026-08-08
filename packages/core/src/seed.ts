import type {
  Campaign,
  Integration,
  Participation,
  Person,
  Placement,
  RequirementDefinition,
  RequirementInstance,
  Room,
  ScheduleRelease,
  Session,
  Track,
  WorkspaceState,
} from './types.ts'

const seededAt = '2026-08-07T14:00:00.000Z'
const eventId = 'evt_nyc_2026'

const peopleInput = [
  ['Robin', 'Sloan', 'robin@axiom.dev', 'Axiom', 'Founder', 'Austin, TX', 'America/Chicago'],
  [
    'Cameron',
    'Lee',
    'cameron@northstar.ai',
    'Northstar',
    'VP, Product',
    'New York, NY',
    'America/New_York',
  ],
  [
    'Jordan',
    'Bell',
    'jordan@commonthread.org',
    'Common Thread',
    'Research Lead',
    'Toronto, ON',
    'America/Toronto',
  ],
  [
    'Taylor',
    'Reed',
    'taylor@foil.studio',
    'Foil Studio',
    'Design Partner',
    'London, UK',
    'Europe/London',
  ],
  [
    'Morgan',
    'Shah',
    'morgan@relay.run',
    'Relay',
    'Co-founder',
    'San Francisco, CA',
    'America/Los_Angeles',
  ],
  ['Casey', 'Morris', 'casey@fieldwork.co', 'Fieldwork', 'COO', 'Chicago, IL', 'America/Chicago'],
  [
    'Riley',
    'Chen',
    'riley@studiozero.com',
    'Studio Zero',
    'Creative Director',
    'Los Angeles, CA',
    'America/Los_Angeles',
  ],
  [
    'Avery',
    'Patel',
    'avery@frame.work',
    'Frame',
    'Engineering Lead',
    'Seattle, WA',
    'America/Los_Angeles',
  ],
  ['Quinn', 'Baker', 'quinn@signalpath.io', 'Signal Path', 'CEO', 'Boston, MA', 'America/New_York'],
  [
    'Parker',
    'Diaz',
    'parker@grain.com',
    'Grain',
    'Head of Growth',
    'Miami, FL',
    'America/New_York',
  ],
  [
    'Rowan',
    'Kim',
    'rowan@parallel.systems',
    'Parallel',
    'Staff Engineer',
    'Brooklyn, NY',
    'America/New_York',
  ],
  [
    'Skyler',
    'Nguyen',
    'skyler@horizon.vc',
    'Horizon Ventures',
    'Partner',
    'Denver, CO',
    'America/Denver',
  ],
  ['Jamie', 'Brooks', 'jamie@applied.fm', 'Applied', 'Host', 'Nashville, TN', 'America/Chicago'],
  [
    'Drew',
    'Foster',
    'drew@kindred.health',
    'Kindred',
    'Product Director',
    'Portland, OR',
    'America/Los_Angeles',
  ],
  ['Reese', 'Stone', 'reese@motif.tools', 'Motif', 'Founder', 'New York, NY', 'America/New_York'],
  [
    'Sage',
    'Wright',
    'sage@wavelength.bio',
    'Wavelength',
    'AI Lead',
    'Cambridge, MA',
    'America/New_York',
  ],
] as const

const bios = [
  'Builds practical systems for small teams adopting AI without adding operational drag.',
  'Leads product teams through complex platform shifts and the workflows around them.',
  'Studies how people collaborate with adaptive software in high-stakes environments.',
  'Designs calm, legible interfaces for tools that people use all day.',
]

const people: Person[] = peopleInput.map((person, index) => ({
  id: `per_${String(index + 1).padStart(3, '0')}`,
  firstName: person[0],
  lastName: person[1],
  email: person[2],
  company: person[3],
  title: person[4],
  city: person[5],
  timezone: person[6],
  bio: bios[index % bios.length],
  avatarUrl: `https://assets.ui.sh/avatars/${(index % 12) + 1}.webp`,
  tags: index % 3 === 0 ? ['returning speaker'] : index % 4 === 0 ? ['vip'] : [],
  createdAt: seededAt,
  updatedAt: seededAt,
  version: 1,
}))

const participationStatuses: Participation['status'][] = [
  'confirmed',
  'confirmed',
  'invited',
  'confirmed',
  'confirmed',
  'invited',
  'confirmed',
  'confirmed',
  'prospect',
  'confirmed',
  'invited',
  'confirmed',
  'confirmed',
  'confirmed',
  'invited',
  'confirmed',
]

const participations: Participation[] = people.map((person, index) => ({
  id: `par_${String(index + 1).padStart(3, '0')}`,
  eventId,
  personId: person.id,
  roles:
    index === 2 || index === 8
      ? ['moderator']
      : index === 7 || index === 15
        ? ['workshop_lead']
        : index % 5 === 0
          ? ['panelist']
          : ['speaker'],
  status: participationStatuses[index],
  sessionIds: [],
  internalNotes: index === 4 ? 'Assistant coordinates all schedule changes.' : '',
  publicTitle: person.title,
  publicCompany: person.company,
  confirmedAt:
    participationStatuses[index] === 'confirmed'
      ? `2026-07-${String(12 + index).padStart(2, '0')}T15:00:00.000Z`
      : null,
  updatedAt: seededAt,
  version: 1,
}))

const requirementDefinitions: RequirementDefinition[] = [
  {
    id: 'req_confirm',
    eventId,
    label: 'Confirm participation',
    description: 'Accept the invitation and confirm attendance.',
    kind: 'confirmation',
    dueAt: '2026-08-21T21:00:00.000Z',
    required: true,
  },
  {
    id: 'req_bio',
    eventId,
    label: 'Speaker bio',
    description: 'Provide a public bio of no more than 600 characters.',
    kind: 'text',
    dueAt: '2026-09-04T21:00:00.000Z',
    required: true,
  },
  {
    id: 'req_headshot',
    eventId,
    label: 'Headshot',
    description: 'Upload a square, high-resolution public headshot.',
    kind: 'file',
    dueAt: '2026-09-04T21:00:00.000Z',
    required: true,
  },
  {
    id: 'req_release',
    eventId,
    label: 'Recording release',
    description: 'Review and sign the event recording release.',
    kind: 'approval',
    dueAt: '2026-09-11T21:00:00.000Z',
    required: true,
  },
  {
    id: 'req_av',
    eventId,
    label: 'AV requirements',
    description: 'Tell the production team what you need on stage.',
    kind: 'form',
    dueAt: '2026-09-18T21:00:00.000Z',
    required: true,
  },
  {
    id: 'req_slides',
    eventId,
    label: 'Final slides',
    description: 'Upload the final presentation deck.',
    kind: 'file',
    dueAt: '2026-09-25T21:00:00.000Z',
    required: true,
  },
]

const statusByIndex = (
  participantIndex: number,
  requirementIndex: number,
): RequirementInstance['status'] => {
  if (requirementIndex === 0)
    return participationStatuses[participantIndex] === 'confirmed' ? 'approved' : 'not_started'
  const score = (participantIndex * 2 + requirementIndex) % 7
  if (score <= 2) return 'approved'
  if (score === 3) return 'submitted'
  if (score === 4) return 'revision_requested'
  return 'not_started'
}

const requirementInstances: RequirementInstance[] = participations.flatMap(
  (participation, participantIndex) =>
    requirementDefinitions.map((definition, requirementIndex) => {
      const status = statusByIndex(participantIndex, requirementIndex)
      return {
        id: `rqi_${participantIndex + 1}_${requirementIndex + 1}`,
        definitionId: definition.id,
        participationId: participation.id,
        status,
        value:
          definition.id === 'req_av' && status !== 'not_started'
            ? participantIndex % 2 === 0
              ? 'Confidence monitor and handheld microphone.'
              : 'Standard stage setup.'
            : '',
        submittedAt: status === 'submitted' || status === 'approved' ? seededAt : null,
        reviewedAt: status === 'approved' ? seededAt : null,
        updatedAt: seededAt,
        version: 1,
      }
    }),
)

const tracks: Track[] = [
  { id: 'trk_frontier', eventId, name: 'Frontier', color: 'emerald' },
  { id: 'trk_build', eventId, name: 'Build', color: 'sky' },
  { id: 'trk_operate', eventId, name: 'Operate', color: 'amber' },
  { id: 'trk_society', eventId, name: 'Society', color: 'violet' },
]

const rooms: Room[] = [
  { id: 'rom_main', eventId, name: 'Main stage', capacity: 420 },
  { id: 'rom_studio', eventId, name: 'Studio', capacity: 150 },
  { id: 'rom_workshop', eventId, name: 'Workshop', capacity: 72 },
]

const sessionInputs = [
  ['ses_001', 'Opening the useful frontier', 'keynote', 'trk_frontier', [0], 40, 380],
  ['ses_002', 'The new shape of a product team', 'panel', 'trk_operate', [1, 2, 4], 45, 130],
  ['ses_003', 'Interfaces for uncertain systems', 'talk', 'trk_build', [3], 30, 105],
  ['ses_004', 'From prototype to dependable workflow', 'workshop', 'trk_build', [7, 10], 75, 66],
  [
    'ses_005',
    'Buying, building, and the space between',
    'panel',
    'trk_operate',
    [5, 8, 11],
    45,
    118,
  ],
  ['ses_006', 'A field guide to human approval', 'talk', 'trk_society', [6], 30, 90],
  ['ses_007', 'Small models, serious work', 'talk', 'trk_frontier', [9], 30, 115],
  ['ses_008', 'What agents change about operations', 'panel', 'trk_operate', [0, 12, 14], 45, 142],
  ['ses_009', 'Designing an evaluation people trust', 'workshop', 'trk_society', [15, 13], 75, 70],
  ['ses_010', 'Closing synthesis', 'keynote', 'trk_frontier', [12], 35, 340],
] as const

const sessionRecords: Session[] = sessionInputs.map((session) => ({
  id: session[0],
  eventId,
  title: session[1],
  format: session[2],
  summary:
    'A practical conversation grounded in current work, real constraints, and what comes next.',
  trackId: session[3],
  participantIds: session[4].map((index) => participations[index].id),
  durationMinutes: session[5],
  expectedAttendance: session[6],
  status: 'ready',
  updatedAt: seededAt,
  version: 1,
}))

for (const session of sessionRecords) {
  for (const participantId of session.participantIds) {
    participations
      .find((participation) => participation.id === participantId)
      ?.sessionIds.push(session.id)
  }
}

const placementInput = [
  ['ses_001', 'rom_main', '2026-10-04T13:00:00.000Z'],
  ['ses_002', 'rom_studio', '2026-10-04T14:00:00.000Z'],
  ['ses_003', 'rom_main', '2026-10-04T14:00:00.000Z'],
  ['ses_004', 'rom_workshop', '2026-10-04T15:00:00.000Z'],
  ['ses_005', 'rom_studio', '2026-10-04T15:00:00.000Z'],
  ['ses_006', 'rom_main', '2026-10-04T15:00:00.000Z'],
  ['ses_007', 'rom_studio', '2026-10-04T16:15:00.000Z'],
  ['ses_008', 'rom_main', '2026-10-04T16:15:00.000Z'],
  ['ses_009', 'rom_workshop', '2026-10-04T17:00:00.000Z'],
  ['ses_010', 'rom_main', '2026-10-04T18:15:00.000Z'],
] as const

const placements: Placement[] = placementInput.map((placement, index) => {
  const session = sessionRecords.find((record) => record.id === placement[0])!
  const startsAt = placement[2]
  return {
    id: `plc_${String(index + 1).padStart(3, '0')}`,
    eventId,
    sessionId: session.id,
    roomId: placement[1],
    startsAt,
    endsAt: new Date(new Date(startsAt).getTime() + session.durationMinutes * 60_000).toISOString(),
    scheduleVersion: 3,
    published: true,
    version: 1,
  }
})

const initialScheduleRelease: ScheduleRelease = {
  id: 'sch_nyc_2026_v3',
  eventId,
  version: 3,
  publishedAt: seededAt,
  publishedBy: { type: 'system', id: 'system', name: 'CRM Library' },
  placements: structuredClone(placements),
}

const campaigns: Campaign[] = [
  {
    id: 'cam_001',
    eventId,
    name: 'August confirmation reminder',
    subject: 'Please confirm your participation in AIE NYC',
    body: 'Hi {{first_name}},\n\nPlease confirm your participation and review the next steps in your speaker portal.',
    audience: 'unconfirmed',
    recipientParticipationIds: participations
      .filter((participation) => participation.status === 'invited')
      .map((participation) => participation.id),
    status: 'awaiting_approval',
    createdAt: seededAt,
    approvedAt: null,
    sentAt: null,
    createdBy: 'Alex Morgan',
    version: 1,
  },
  {
    id: 'cam_002',
    eventId,
    name: 'Welcome confirmed speakers',
    subject: 'Your AIE NYC speaker workspace is ready',
    body: 'Hi {{first_name}},\n\nYour speaker workspace is ready. Start with your profile and recording release.',
    audience: 'custom',
    recipientParticipationIds: participations.slice(0, 6).map((participation) => participation.id),
    status: 'sent',
    createdAt: '2026-07-21T15:00:00.000Z',
    approvedAt: '2026-07-21T15:30:00.000Z',
    sentAt: '2026-07-21T16:00:00.000Z',
    createdBy: 'Alex Morgan',
    version: 3,
  },
]

const integrations: Integration[] = [
  {
    id: 'int_email',
    name: 'Transactional email',
    kind: 'email',
    status: 'connected',
    detail: 'Delivery events are flowing normally.',
    lastSeenAt: '2026-08-07T13:52:00.000Z',
  },
  {
    id: 'int_webhook',
    name: 'Program website webhook',
    kind: 'webhook',
    status: 'connected',
    detail: 'Subscribed to schedule and participant readiness events.',
    lastSeenAt: '2026-08-07T12:44:00.000Z',
  },
  {
    id: 'int_calendar',
    name: 'Calendar sync',
    kind: 'calendar',
    status: 'attention',
    detail: 'Two availability records could not be matched.',
    lastSeenAt: '2026-08-06T21:03:00.000Z',
  },
  {
    id: 'int_storage',
    name: 'Asset storage',
    kind: 'storage',
    status: 'not_configured',
    detail: 'Using demo file metadata. Connect object storage before production.',
    lastSeenAt: null,
  },
  {
    id: 'int_api',
    name: 'Public API',
    kind: 'api',
    status: 'connected',
    detail: 'Operation API and MCP endpoint are available.',
    lastSeenAt: '2026-08-07T13:58:00.000Z',
  },
]

export function createSeedState(): WorkspaceState {
  return {
    schemaVersion: 2,
    revision: 1,
    workspace: {
      id: 'wrk_aie',
      name: 'AIE Program Team',
      slug: 'aie',
      timezone: 'America/New_York',
    },
    activeEventId: eventId,
    events: [
      {
        id: eventId,
        name: 'AIE NYC 2026',
        slug: 'aie-nyc-2026',
        venue: 'Brooklyn Navy Yard',
        city: 'Brooklyn, New York',
        startsAt: '2026-10-04T13:00:00.000Z',
        endsAt: '2026-10-05T22:00:00.000Z',
        timezone: 'America/New_York',
        status: 'active',
        publishedScheduleVersion: 3,
      },
    ],
    people: structuredClone(people),
    participations: structuredClone(participations),
    requirementDefinitions: structuredClone(requirementDefinitions),
    requirementInstances: structuredClone(requirementInstances),
    tracks: structuredClone(tracks),
    rooms: structuredClone(rooms),
    sessions: structuredClone(sessionRecords),
    placements: structuredClone(placements),
    scheduleReleases: [structuredClone(initialScheduleRelease)],
    campaigns: structuredClone(campaigns),
    changeSets: [
      {
        id: 'chg_agent_001',
        eventId,
        title: 'Give Small models, serious work more room',
        description:
          'Move the session to Main stage at 1:00 PM local time to fit the current audience estimate.',
        origin: 'agent',
        operations: [
          {
            operation: 'schedule.move-session',
            input: {
              placementId: 'plc_007',
              roomId: 'rom_main',
              startsAt: '2026-10-04T17:00:00.000Z',
            },
            expectedVersions: { plc_007: 1 },
          },
        ],
        status: 'awaiting_approval',
        impactSummary: [
          'Moves one 30-minute session from Studio to Main stage.',
          'Increases available capacity from 150 to 420.',
          'Leaves all participant and room constraints valid.',
        ],
        warnings: ['The public agenda will not change until the schedule is published.'],
        createdBy: 'Program Ops Agent',
        approvedBy: null,
        createdAt: '2026-08-07T15:10:00.000Z',
        updatedAt: '2026-08-07T15:10:00.000Z',
        committedEventIds: [],
        version: 1,
      },
    ],
    integrations: structuredClone(integrations),
    domainEvents: [
      {
        id: 'dev_001',
        sequence: 1,
        type: 'workspace.seeded',
        occurredAt: seededAt,
        actor: { type: 'system', id: 'system', name: 'CRM Library' },
        aggregate: { type: 'workspace', id: 'wrk_aie', version: 1 },
        operation: 'workspace.seed',
        summary: 'Created the AIE NYC demonstration workspace.',
        data: { people: people.length, sessions: sessionRecords.length },
      },
      {
        id: 'dev_002',
        sequence: 2,
        type: 'import.completed',
        occurredAt: '2026-08-07T14:05:00.000Z',
        actor: { type: 'staff', id: 'usr_alex', name: 'Alex Morgan' },
        aggregate: { type: 'event', id: eventId, version: 1 },
        operation: 'import.commit',
        summary: 'Imported 16 participants and 10 sessions from the program workbook.',
        data: { created: 26, duplicates: 2, skipped: 0 },
      },
      {
        id: 'dev_003',
        sequence: 3,
        type: 'change-set.created',
        occurredAt: '2026-08-07T15:10:00.000Z',
        actor: { type: 'agent', id: 'agent_program_ops', name: 'Program Ops Agent' },
        aggregate: { type: 'change-set', id: 'chg_agent_001', version: 1 },
        operation: 'change-set.create',
        summary: 'Proposed moving Small models, serious work to Main stage.',
        data: { proposedOperation: 'schedule.move-session' },
      },
    ],
    recentCommandResults: [],
  }
}
