import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const evaluatorRoot = resolve(
  repositoryRoot,
  process.env.PROGRAMKIT_EVAL_REPO || '../killmysaas-evals',
)
const appOrigin = new URL(process.env.PROGRAMKIT_APP_ORIGIN || 'https://app.programkit.dev')
const demoOrigin = new URL(process.env.PROGRAMKIT_DEMO_ORIGIN || 'https://demo.programkit.dev')
const siteOrigin = new URL(process.env.PROGRAMKIT_SITE_ORIGIN || 'https://programkit.dev')
const publicEventId = process.env.PROGRAMKIT_PUBLIC_EVENT_ID?.trim()

let failures = 0

function pass(label, detail) {
  console.log(`PASS ${label}${detail ? `: ${detail}` : ''}`)
}

function fail(label, detail) {
  failures += 1
  console.error(`FAIL ${label}${detail ? `: ${detail}` : ''}`)
}

function run(label, command, args, cwd) {
  try {
    execFileSync(command, args, { cwd, stdio: 'pipe', encoding: 'utf8' })
    pass(label)
  } catch (error) {
    const detail = error instanceof Error ? error.message.split('\n')[0] : String(error)
    fail(label, detail)
  }
}

async function checkResponse(label, url, validate) {
  try {
    const response = await fetch(url, {
      headers: { 'user-agent': 'ProgramKit competition preflight' },
      redirect: 'follow',
    })
    const body = await response.text()
    if (!response.ok) {
      fail(label, `${response.status} ${response.statusText}`)
      return
    }
    const detail = validate(response, body)
    pass(label, detail)
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error))
  }
}

function expectedEvaluatorCommit() {
  const evidencePath = resolve(repositoryRoot, 'docs/product/evals/README.md')
  const evidence = readFileSync(evidencePath, 'utf8')
  return evidence.match(/`([a-f0-9]{40})`/u)?.[1]
}

console.log('ProgramKit competition preflight')

if (existsSync(resolve(evaluatorRoot, 'package.json'))) {
  const expected = expectedEvaluatorCommit()
  let actual
  try {
    actual = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: evaluatorRoot,
      encoding: 'utf8',
    }).trim()
  } catch {
    actual = undefined
  }

  if (expected && actual === expected) pass('evaluator revision', actual.slice(0, 12))
  else
    fail(
      'evaluator revision',
      `expected ${expected || 'documented commit'}, got ${actual || 'none'}`,
    )

  run('evaluator browser smoke', 'pnpm', ['run', 'smoke'], evaluatorRoot)
  run(
    'evaluator plan',
    'pnpm',
    ['run', 'eval', '--', '--url', appOrigin.toString(), '--dry-run', '--include-optional'],
    evaluatorRoot,
  )
} else {
  fail('evaluator repository', `not found at ${evaluatorRoot}`)
}

await Promise.all([
  checkResponse('public site', siteOrigin, (response, body) => {
    if (!body.includes('ProgramKit')) throw new Error('ProgramKit identity missing')
    return response.url
  }),
  checkResponse('hosted signup', new URL('/signup', appOrigin), (response, body) => {
    if (!body.includes('programkit-deployment-profile'))
      throw new Error('deployment profile missing')
    return response.url
  }),
  checkResponse('hosted login', new URL('/login', appOrigin), (_response, body) => {
    if (!body.includes('programkit-deployment-profile'))
      throw new Error('deployment profile missing')
    return 'reachable'
  }),
  checkResponse('disposable demo', demoOrigin, (_response, body) => {
    if (!body.includes('programkit-deployment-profile'))
      throw new Error('deployment profile missing')
    return 'reachable'
  }),
  ...[siteOrigin, demoOrigin, appOrigin].map((origin) =>
    checkResponse(
      `embed loader ${origin.hostname}`,
      new URL('/programkit-embed.js', origin),
      (response, body) => {
        if (!response.headers.get('content-type')?.includes('text/javascript')) {
          throw new Error(`unexpected content type ${response.headers.get('content-type')}`)
        }
        if (!body.includes('[data-programkit-embed]')) throw new Error('embed bootstrap missing')
        return `${body.length} bytes`
      },
    ),
  ),
])

if (publicEventId) {
  const eventQuery = new URLSearchParams({ event: publicEventId })
  await Promise.all([
    checkResponse(
      'public agenda',
      new URL(`/agenda?${eventQuery}`, appOrigin),
      (_response, body) => {
        if (!body.includes('programkit-deployment-profile')) throw new Error('app shell missing')
        return publicEventId
      },
    ),
    checkResponse(
      'public JSON feed',
      new URL(`/public/v1/program.json?${eventQuery}`, appOrigin),
      (response, body) => {
        const payload = JSON.parse(body)
        if (payload.event?.id !== publicEventId || !Array.isArray(payload.sessions)) {
          throw new Error('event or sessions payload invalid')
        }
        if (!payload.event.publishedScheduleVersion || payload.sessions.length === 0) {
          throw new Error('event must have a non-empty published schedule')
        }
        if (response.headers.get('access-control-allow-origin') !== '*') {
          throw new Error('wildcard CORS missing')
        }
        return `${payload.sessions.length} sessions`
      },
    ),
    checkResponse(
      'public XML feed',
      new URL(`/public/v1/program.xml?${eventQuery}`, appOrigin),
      (_response, body) => {
        if (!body.includes(`<program eventId="${publicEventId}"`))
          throw new Error('program root missing')
        const count = (body.match(/<session\b/gu) || []).length
        if (count === 0) throw new Error('published sessions missing')
        return `${count} sessions`
      },
    ),
    checkResponse(
      'public iCal feed',
      new URL(`/public/v1/program.ics?${eventQuery}`, appOrigin),
      (response, body) => {
        if (!response.headers.get('content-type')?.includes('text/calendar')) {
          throw new Error('calendar content type missing')
        }
        if (!body.startsWith('BEGIN:VCALENDAR\r\n') || !body.endsWith('END:VCALENDAR\r\n')) {
          throw new Error('calendar envelope invalid')
        }
        const count = (body.match(/BEGIN:VEVENT/gu) || []).length
        if (count === 0) throw new Error('calendar events missing')
        return `${count} events`
      },
    ),
  ])
} else {
  console.log('SKIP public event feeds: set PROGRAMKIT_PUBLIC_EVENT_ID to a published event ID')
}

if (failures > 0) {
  console.error(`\nPreflight failed with ${failures} problem${failures === 1 ? '' : 's'}.`)
  process.exitCode = 1
} else {
  console.log('\nPreflight passed.')
}
