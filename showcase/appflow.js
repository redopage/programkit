const productBase = 'http://localhost:4173'
const captureVersion = '20260812-172855'

const screens = [
  screen('overview', 'Overview', '/', 'Organizer', 'Command center', '01-overview.jpg'),
  screen('forms', 'CFP form builder', '/forms', 'Organizer', 'Program', '02-forms.jpg'),
  screen(
    'submissions',
    'Submission queue',
    '/submissions',
    'Organizer',
    'Program',
    '03-submissions.jpg',
  ),
  screen('reviews', 'Review management', '/reviews', 'Organizer', 'Program', '04-reviews.jpg'),
  screen('sessions', 'Session library', '/sessions', 'Organizer', 'Program', '05-sessions.jpg'),
  screen('schedule', 'Schedule studio', '/schedule', 'Organizer', 'Program', '06-schedule.jpg'),
  screen('crm', 'Speaker CRM', '/crm', 'Organizer', 'People', '07-crm.jpg'),
  screen('speakers', 'Speaker roster', '/people', 'Organizer', 'People', '08-speakers.jpg'),
  screen(
    'readiness',
    'Readiness dashboard',
    '/readiness',
    'Organizer',
    'People',
    '09-readiness.jpg',
  ),
  screen('files', 'File library', '/files', 'Organizer', 'People', '10-files.jpg'),
  screen(
    'communications',
    'Communications',
    '/communications',
    'Organizer',
    'People',
    '11-communications.jpg',
  ),
  screen('settings', 'Event settings', '/settings', 'Organizer', 'Settings', '12-settings.jpg'),
  screen('changes', 'Change review', '/changes', 'Organizer', 'Operations', '13-changes.jpg'),
  screen(
    'integrations',
    'Data & connections',
    '/integrations',
    'Organizer',
    'Operations',
    '14-integrations.jpg',
  ),
  screen('agent', 'Agent workspace', '/agent', 'Organizer', 'Operations', '15-agent.jpg'),
  screen(
    'public-agenda',
    'Published agenda',
    '/agenda',
    'Attendee',
    'Public',
    '16-public-agenda.jpg',
  ),
  screen(
    'public-cfp',
    'Public call for proposals',
    '/submit/aie-nyc-2026-cfp',
    'Speaker',
    'Public',
    '17-public-cfp.jpg',
  ),
  screen(
    'my-submissions',
    'My submissions',
    '/submit/aie-nyc-2026-cfp/mine/speaker_robin_sloan',
    'Speaker',
    'External workspace',
    '18-my-submissions.jpg',
  ),
  screen(
    'speaker-portal',
    'Speaker portal',
    '/portal/par_003/portal_003_per_003',
    'Speaker',
    'External workspace',
    '19-speaker-portal.jpg',
  ),
  screen(
    'reviewer-workspace',
    'Reviewer workspace',
    '/reviewer/rev_001/reviewer_elena_vasquez',
    'Reviewer',
    'External workspace',
    '20-reviewer-workspace.jpg',
  ),
  screen(
    'speaker-link-error',
    'Unavailable speaker link',
    '/portal/par_003',
    'Speaker',
    'Error state',
    '21-speaker-access.jpg',
    'A keyless speaker link resolves to a retry error. Confirm this legacy route should remain.',
  ),
  screen(
    'reviewer-link-error',
    'Unavailable reviewer link',
    '/reviewer/rev_001',
    'Reviewer',
    'Error state',
    '22-reviewer-access.jpg',
    'A keyless reviewer link resolves to a retry error. Confirm this legacy route should remain.',
  ),
  screen(
    'external-access',
    'Speaker and reviewer access',
    '/access',
    'Account',
    'Access',
    '23-access.jpg',
  ),
  screen('demo-entry', 'Demo entry', '/demo', 'Account', 'Access', '24-demo-start.jpg'),
  screen('privacy', 'Privacy policy', '/privacy', 'Legal', 'Support', '25-privacy.jpg'),
  screen('terms', 'Terms of use', '/terms', 'Legal', 'Support', '26-terms.jpg'),
]

const flows = [
  {
    id: 'cfp',
    title: 'Build and publish a CFP',
    description: 'Create the form, add a conditional question, preview it, and make it public.',
    steps: [
      flowStep(
        'cfp-builder',
        'Open the form builder',
        'Start with the active proposal form.',
        'form-builder.jpg',
        '/forms',
      ),
      flowStep(
        'cfp-question',
        'Add a question',
        'Choose the field type and mapping.',
        'form-builder-add-question.jpg',
        '/forms',
      ),
      flowStep(
        'cfp-preview',
        'Check the public form',
        'Preview the responsive speaker experience.',
        'form-builder-preview-responsive.jpg',
        '/forms',
      ),
      flowStep(
        'cfp-public',
        'Open the public CFP',
        'The public form is ready for a proposal.',
        'public-cfp.jpg',
        '/submit/aie-nyc-2026-cfp',
      ),
      flowStep(
        'cfp-conditional',
        'Reveal conditional fields',
        'Workshop details appear only when relevant.',
        'public-cfp-conditional.jpg',
        '/submit/aie-nyc-2026-cfp',
      ),
      flowStep(
        'cfp-confirmation',
        'Confirm the proposal',
        'A durable confirmation closes the submission loop.',
        'public-cfp-confirmation.jpg',
        '/submit/aie-nyc-2026-cfp',
      ),
    ],
  },
  {
    id: 'review',
    title: 'Review and decide',
    description:
      'Triage proposals, score them independently, and convert an acceptance into program data.',
    steps: [
      flowStep(
        'review-queue',
        'Triage submissions',
        'Start in the organizer proposal queue.',
        'submissions.jpg',
        '/submissions',
      ),
      flowStep(
        'review-detail',
        'Inspect one proposal',
        'Read the proposal and assignment context.',
        'submission-detail.jpg',
        '/submissions',
      ),
      flowStep(
        'review-workspace',
        'Open reviewer workspace',
        'A reviewer sees only their assigned work.',
        'reviewer-workspace.jpg',
        '/reviewer/rev_001/reviewer_elena_vasquez',
      ),
      flowStep(
        'review-scorecard',
        'Complete the scorecard',
        'Weighted answers and recommendation are ready to submit.',
        'reviewer-scorecard-filled.jpg',
        '/reviewer/rev_001/reviewer_elena_vasquez',
      ),
      flowStep(
        'review-aggregate',
        'Compare review results',
        'Organizers see progress and aggregate scores.',
        'reviews.jpg',
        '/reviews',
      ),
      flowStep(
        'review-accept',
        'Accept and convert',
        'The decision creates the connected speaker and session records.',
        'accepted-session-conversion.jpg',
        '/submissions',
      ),
    ],
  },
  {
    id: 'speaker',
    title: 'Onboard an accepted speaker',
    description:
      'Move from acceptance to a complete speaker profile, files, and organizer readiness.',
    steps: [
      flowStep(
        'speaker-convert',
        'Create the speaker record',
        'Acceptance creates the participation and tasks.',
        'accepted-session-conversion.jpg',
        '/submissions',
      ),
      flowStep(
        'speaker-portal',
        'Enter the speaker portal',
        'The speaker sees profile, resources, and next steps.',
        'speaker-portal.jpg',
        '/portal/par_003/portal_003_per_003',
      ),
      flowStep(
        'speaker-progress',
        'Complete requirements',
        'Progress updates in the same scoped workspace.',
        'speaker-portal-progress.jpg',
        '/portal/par_003/portal_003_per_003',
      ),
      flowStep(
        'speaker-roster',
        'Check the roster',
        'Organizer status is visible across all speakers.',
        'people.jpg',
        '/people',
      ),
      flowStep(
        'speaker-readiness',
        'Resolve blockers',
        'The readiness matrix surfaces remaining work.',
        'readiness.jpg',
        '/readiness',
      ),
      externalStep(
        'speaker-files',
        'Review submitted files',
        'Headshots and deliverables live in one library.',
        './screenshots/appflow/10-files.jpg',
        '/files',
      ),
    ],
  },
  {
    id: 'schedule',
    title: 'Build and publish the agenda',
    description: 'Prepare sessions, place them, catch conflicts, and release the public program.',
    steps: [
      flowStep(
        'schedule-sessions',
        'Prepare sessions',
        'The session library is the source inventory.',
        'sessions.jpg',
        '/sessions',
      ),
      flowStep(
        'schedule-grid',
        'Open the room grid',
        'Scheduled and unscheduled work share one studio.',
        'schedule.jpg',
        '/schedule',
      ),
      flowStep(
        'schedule-move',
        'Move a session',
        'A precise move keeps time and room choices explicit.',
        'schedule-move.jpg',
        '/schedule',
      ),
      flowStep(
        'schedule-conflict',
        'Catch a conflict',
        'Publication is blocked with a plain-language reason.',
        'schedule-conflict.jpg',
        '/schedule',
      ),
      flowStep(
        'schedule-publish',
        'Publish a release',
        'The latest valid draft becomes immutable public data.',
        'schedule-published.jpg',
        '/schedule',
      ),
      flowStep(
        'schedule-public',
        'View the public agenda',
        'Attendees see the released schedule.',
        'public-agenda.jpg',
        '/agenda',
      ),
    ],
  },
  {
    id: 'communications',
    title: 'Approve a communication',
    description: 'Compose the campaign, inspect its audience, and approve a frozen recipient set.',
    steps: [
      flowStep(
        'communications-list',
        'Open communications',
        'Campaigns and delivery state share one view.',
        'communications.jpg',
        '/communications',
      ),
      flowStep(
        'communications-compose',
        'Compose and preview',
        'Audience, merge data, and content are visible together.',
        'communications-compose.jpg',
        '/communications',
      ),
      flowStep(
        'communications-approve',
        'Approve recipients',
        'Approval freezes the intended send before delivery.',
        'communications-approved.jpg',
        '/communications',
      ),
    ],
  },
  {
    id: 'agent',
    title: 'Review an agent change',
    description: 'Run an operation, inspect the proposal, and protect the commit from stale state.',
    steps: [
      externalStep(
        'agent-run',
        'Run an operational action',
        'The agent workspace previews named operations.',
        './screenshots/appflow/15-agent.jpg',
        '/agent',
      ),
      flowStep(
        'agent-review',
        'Review the proposed change',
        'The human sees the exact mutation before approval.',
        'changes.jpg',
        '/changes',
      ),
      flowStep(
        'agent-conflict',
        'Stop a stale commit',
        'Expected-version protection blocks an unsafe change.',
        'change-stale-conflict.jpg',
        '/changes',
      ),
    ],
  },
  {
    id: 'operations',
    title: 'Configure the workspace',
    description: 'Set the event identity and manage exports, connections, and developer access.',
    steps: [
      externalStep(
        'operations-settings',
        'Configure the event',
        'Identity, venue, dates, and timezone live together.',
        './screenshots/appflow/12-settings.jpg',
        '/settings',
      ),
      flowStep(
        'operations-integrations',
        'Review data connections',
        'Exports, Airtable options, and developer access stay visible to operators.',
        'integrations.jpg',
        '/integrations',
      ),
      externalStep(
        'operations-overview',
        'Return to the command center',
        'The overview turns system state into next actions.',
        './screenshots/appflow/01-overview.jpg',
        '/',
      ),
    ],
  },
]

const evalData = window.PROGRAMKIT_EVALS
let activeView = 'screens'
let dialogItems = []
let dialogIndex = 0

const screenGrid = document.querySelector('#screen-grid')
const screenEmpty = document.querySelector('#screen-empty')
const screenSearch = document.querySelector('#screen-search')
const audienceFilter = document.querySelector('#audience-filter')
const visibleCount = document.querySelector('#visible-count')
const headerCount = document.querySelector('#header-count')
const flowSearch = document.querySelector('#flow-search')
const flowNav = document.querySelector('#flow-nav')
const flowList = document.querySelector('#flow-list')
const evalSearch = document.querySelector('#eval-search')
const evalNav = document.querySelector('#eval-nav')
const evalList = document.querySelector('#eval-list')
const dialog = document.querySelector('#review-dialog')

function screen(id, title, route, audience, surface, image, defaultNote = '') {
  return {
    id,
    title,
    route,
    audience,
    surface,
    image: `./screenshots/appflow/${image}`,
    description: `${audience} view · ${surface}`,
    defaultNote,
  }
}

function flowStep(id, title, description, image, route) {
  return externalStep(id, title, description, `./screenshots/programkit/${image}`, route)
}

function externalStep(id, title, description, image, route) {
  return { id, title, description, image, route, audience: 'Flow step', surface: 'Saved state' }
}

function freshImage(source) {
  return `${source}?v=${captureVersion}`
}

function renderScreens() {
  const query = screenSearch.value.trim().toLowerCase()
  const audience = audienceFilter.value
  const visible = screens.filter((item) => {
    const haystack = `${item.title} ${item.route} ${item.audience} ${item.surface}`.toLowerCase()
    return (
      (!query || haystack.includes(query)) && (audience === 'all' || item.audience === audience)
    )
  })

  screenGrid.replaceChildren()
  visible.forEach((item) => screenGrid.append(screenCard(item, visible)))
  screenEmpty.hidden = visible.length > 0
  visibleCount.textContent = `${visible.length} shown`
  headerCount.textContent = `${screens.length} screens`
}

function screenCard(item, collection) {
  const article = document.createElement('article')
  article.className = 'screen-card'

  const shot = document.createElement('button')
  shot.className = 'shot-button'
  shot.type = 'button'
  shot.setAttribute('aria-label', `Open ${item.title}`)
  shot.addEventListener('click', () => openDialog(collection, item.id))

  const image = document.createElement('img')
  image.src = freshImage(item.image)
  image.alt = `${item.title} screen in ProgramKit`
  image.loading = 'lazy'
  shot.append(image)

  const footer = document.createElement('div')
  footer.className = 'screen-card-footer'

  const copy = document.createElement('div')
  const title = document.createElement('h2')
  title.textContent = item.title
  const meta = document.createElement('div')
  meta.className = 'screen-card-meta'
  meta.innerHTML = `<span>${item.audience}</span><span>${item.surface}</span>`
  copy.append(title, meta)

  footer.append(copy)
  article.append(shot, footer)
  return article
}

function renderFlows() {
  const query = flowSearch.value.trim().toLowerCase()
  const visible = flows.filter((flow) =>
    `${flow.title} ${flow.description}`.toLowerCase().includes(query),
  )
  flowNav.replaceChildren()
  flowList.replaceChildren()

  visible.forEach((flow, flowIndex) => {
    const navButton = document.createElement('button')
    navButton.type = 'button'
    navButton.className = `flow-nav-button${flowIndex === 0 ? ' is-active' : ''}`
    navButton.innerHTML = `<span class="flow-nav-number">${String(flowIndex + 1).padStart(2, '0')}</span><span>${flow.title}</span><span class="flow-nav-count">${flow.steps.length}</span>`
    navButton.addEventListener('click', () => {
      document
        .querySelectorAll('.flow-nav-button')
        .forEach((button) => button.classList.remove('is-active'))
      navButton.classList.add('is-active')
      document
        .querySelector(`#flow-${flow.id}`)
        .scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    flowNav.append(navButton)

    const section = document.createElement('section')
    section.className = 'flow-group'
    section.id = `flow-${flow.id}`

    const heading = document.createElement('div')
    heading.className = 'flow-heading'
    heading.innerHTML = `<div><h2>${flow.title}</h2><p>${flow.description}</p></div><span>${flow.steps.length} steps</span>`

    const track = document.createElement('div')
    track.className = 'flow-track'
    flow.steps.forEach((step, stepIndex) => track.append(flowCard(flow, step, stepIndex)))

    section.append(heading, track)
    flowList.append(section)
  })

  document.querySelector('#flow-total').textContent =
    `${visible.length} flow${visible.length === 1 ? '' : 's'}`
  headerCount.textContent = `${flows.length} flows`
}

function flowCard(flow, step, stepIndex) {
  const article = document.createElement('article')
  article.className = 'flow-step'

  const shot = document.createElement('button')
  shot.className = 'shot-button'
  shot.type = 'button'
  shot.setAttribute('aria-label', `Open ${step.title}`)
  shot.addEventListener('click', () => {
    const items = flow.steps.map((entry, index) => ({
      ...entry,
      audience: flow.title,
      surface: `Step ${index + 1}`,
      flowId: flow.id,
    }))
    openDialog(items, step.id)
  })

  const image = document.createElement('img')
  image.src = freshImage(step.image)
  image.alt = `${step.title} in the ${flow.title} flow`
  image.loading = 'lazy'
  shot.append(image)

  const footer = document.createElement('div')
  footer.className = 'flow-step-footer'
  const number = document.createElement('span')
  number.className = 'step-number'
  number.textContent = stepIndex + 1
  const copy = document.createElement('div')
  copy.innerHTML = `<h3>${step.title}</h3><p>${step.description}</p>`
  footer.append(number, copy)

  article.append(shot, footer)
  return article
}

function renderEvals() {
  const query = evalSearch.value.trim().toLowerCase()
  const visible = evalData.areas.filter((area) => {
    const criteria = area.criteria.map((item) => `${item.id} ${item.criterion}`).join(' ')
    const scenarios = area.scenarios.map((item) => `${item.id} ${item.name}`).join(' ')
    return (
      !query ||
      `${area.title} ${area.prefix} ${criteria} ${scenarios}`.toLowerCase().includes(query)
    )
  })

  document.querySelector('#source-brief-link').href = evalData.sourceUrl
  renderBriefMap()
  evalNav.replaceChildren()
  evalList.replaceChildren()

  visible.forEach((area, areaIndex) => {
    const navButton = document.createElement('button')
    navButton.type = 'button'
    navButton.className = `flow-nav-button${areaIndex === 0 ? ' is-active' : ''}`
    navButton.innerHTML = `<span class="eval-prefix">${area.prefix}</span><span>${area.title}</span><span class="flow-nav-count">${area.criteria.length}</span>`
    navButton.addEventListener('click', () => {
      document
        .querySelectorAll('#eval-nav .flow-nav-button')
        .forEach((button) => button.classList.remove('is-active'))
      navButton.classList.add('is-active')
      document.querySelector(`#eval-${area.area}`).scrollIntoView({ behavior: 'smooth' })
    })
    evalNav.append(navButton)
    evalList.append(evalArea(area))
  })

  if (!visible.length) {
    const empty = document.createElement('div')
    empty.className = 'empty-state'
    empty.innerHTML = '<h2>No evals match</h2><p>Try another criterion, flow, or area.</p>'
    evalList.append(empty)
  }
  headerCount.textContent = `${evalData.areas.reduce((total, area) => total + area.criteria.length, 0)} criteria`
}

function renderBriefMap() {
  const container = document.querySelector('#brief-map')
  if (container.childElementCount) return
  evalData.brief.forEach((item) => {
    const row = document.createElement('div')
    row.className = 'brief-row'
    row.innerHTML = `<span>${String(item.index).padStart(2, '0')}</span><strong>${item.requirement}</strong><small>${item.areas.join(' · ')}</small>`
    container.append(row)
  })
}

function evalArea(area) {
  const section = document.createElement('section')
  section.className = 'eval-area'
  section.id = `eval-${area.area}`

  const heading = document.createElement('div')
  heading.className = 'eval-area-heading'
  heading.innerHTML = `
    <div>
      <p class="eval-kicker">${area.prefix} · ${area.areaWeight}%${area.optional ? ' · optional' : ''}</p>
      <h2>${area.title}</h2>
      <p>${area.overview}</p>
    </div>
    <div class="eval-totals"><strong>${area.criteria.length}</strong><span>criteria</span><strong>${area.scenarios.length}</strong><span>flows</span></div>`

  const flowLabel = document.createElement('h3')
  flowLabel.className = 'eval-section-title'
  flowLabel.textContent = 'Eval flows'
  const scenarios = document.createElement('div')
  scenarios.className = 'scenario-grid'
  area.scenarios.forEach((scenario) => scenarios.append(evalScenario(scenario)))

  const proofLabel = document.createElement('h3')
  proofLabel.className = 'eval-section-title'
  proofLabel.textContent = 'Program proof'
  const proof = document.createElement('div')
  proof.className = 'eval-proof-track'
  area.proof.forEach((item, index) => proof.append(evalProofCard(area, item, index)))

  const criteriaLabel = document.createElement('h3')
  criteriaLabel.className = 'eval-section-title'
  criteriaLabel.textContent = 'Criteria comparison'
  const criteria = document.createElement('div')
  criteria.className = 'criteria-list'
  area.criteria.forEach((item) => criteria.append(evalCriterion(item)))

  section.append(heading, flowLabel, scenarios, proofLabel, proof, criteriaLabel, criteria)
  return section
}

function evalScenario(scenario) {
  const details = document.createElement('details')
  details.className = 'scenario-card'
  const summary = document.createElement('summary')
  summary.innerHTML = `<span>${scenario.id}</span><strong>${scenario.name}</strong><small>${scenario.persona} · ${scenario.steps.length} steps</small>`
  const steps = document.createElement('ol')
  scenario.steps.forEach((step) => {
    const item = document.createElement('li')
    item.textContent = step
    steps.append(item)
  })
  details.append(summary, steps)
  return details
}

function evalProofCard(area, item, index) {
  const card = document.createElement('article')
  card.className = 'eval-proof-card'
  const button = document.createElement('button')
  button.className = 'shot-button'
  button.type = 'button'
  button.setAttribute('aria-label', `Open ${item.title}`)
  const proofItems = area.proof.map((proofItem) => ({
    ...proofItem,
    id: `${area.prefix}-${proofItem.title}`,
    description: `${area.title} proof`,
    audience: area.title,
    surface: 'Evidence',
  }))
  button.addEventListener('click', () => openDialog(proofItems, proofItems[index].id))
  const image = document.createElement('img')
  image.src = freshImage(item.image)
  image.alt = `${item.title} in ProgramKit`
  image.loading = 'lazy'
  button.append(image)
  const footer = document.createElement('div')
  footer.innerHTML = `<strong>${item.title}</strong><span>${item.route}</span>`
  card.append(button, footer)
  return card
}

function evalCriterion(item) {
  const details = document.createElement('details')
  details.className = 'criterion'
  const summary = document.createElement('summary')
  summary.innerHTML = `
    <span class="criterion-id">${item.id}</span>
    <strong>${item.criterion}</strong>
    <span class="criterion-weight">${item.weight} pt${item.weight === 1 ? '' : 's'}</span>`
  const body = document.createElement('div')
  body.className = 'criterion-body'
  body.innerHTML = `
    <div><span>ProgramKit proof</span><p>${item.programkitEvidence}</p></div>
    <div><span>Eval expects</span><p>${item.passCriteria}</p></div>
    <div><span>Evidence to capture</span><p>${item.expectedEvidence}</p></div>
    <p class="criterion-meta">${item.productStatus} · ${item.type} · ${item.scenarios.join(', ')}</p>`
  details.append(summary, body)
  return details
}

function openDialog(items, id) {
  dialogItems = items
  dialogIndex = Math.max(
    0,
    items.findIndex((item) => item.id === id),
  )
  syncDialog()
  dialog.showModal()
}

function syncDialog() {
  const item = dialogItems[dialogIndex]
  document.querySelector('#dialog-position').textContent =
    `${dialogIndex + 1} of ${dialogItems.length}`
  document.querySelector('#dialog-image').src = freshImage(item.image)
  document.querySelector('#dialog-image').alt = `${item.title} in ProgramKit`
  document.querySelector('#dialog-kicker').textContent = item.flowId
    ? 'Flow step'
    : item.surface === 'Evidence'
      ? 'Eval proof'
      : 'Screen'
  document.querySelector('#dialog-title').textContent = item.title
  document.querySelector('#dialog-description').textContent =
    item.description || `${item.audience} view`
  document.querySelector('#dialog-audience').textContent = item.audience
  document.querySelector('#dialog-surface').textContent = item.surface

  const route = document.querySelector('#dialog-route')
  route.href = `${productBase}${item.route}`
  route.textContent = item.route === '/' ? 'Open live overview' : `Open live ${item.route}`

  document.querySelector('#dialog-previous').disabled = dialogIndex === 0
  document.querySelector('#dialog-next').disabled = dialogIndex === dialogItems.length - 1
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    activeView = tab.dataset.view
    document
      .querySelectorAll('.tab')
      .forEach((button) => button.classList.toggle('is-active', button === tab))
    document.querySelector('#screens-view').hidden = activeView !== 'screens'
    document.querySelector('#flows-view').hidden = activeView !== 'flows'
    document.querySelector('#evals-view').hidden = activeView !== 'evals'
    if (activeView === 'screens') renderScreens()
    else if (activeView === 'flows') renderFlows()
    else renderEvals()
  })
})

;[screenSearch, audienceFilter].forEach((control) =>
  control.addEventListener('input', renderScreens),
)
flowSearch.addEventListener('input', renderFlows)
evalSearch.addEventListener('input', renderEvals)

document.querySelector('#dialog-close').addEventListener('click', () => dialog.close())
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close()
})
document.querySelector('#dialog-previous').addEventListener('click', () => {
  if (dialogIndex > 0) {
    dialogIndex -= 1
    syncDialog()
  }
})
document.querySelector('#dialog-next').addEventListener('click', () => {
  if (dialogIndex < dialogItems.length - 1) {
    dialogIndex += 1
    syncDialog()
  }
})
document.addEventListener('keydown', (event) => {
  if (!dialog.open) return
  if (event.key === 'ArrowLeft' && dialogIndex > 0) {
    event.preventDefault()
    dialogIndex -= 1
    syncDialog()
  }
  if (event.key === 'ArrowRight' && dialogIndex < dialogItems.length - 1) {
    event.preventDefault()
    dialogIndex += 1
    syncDialog()
  }
})

renderScreens()
renderFlows()
renderEvals()
activeView = 'screens'
headerCount.textContent = `${screens.length} screens`
