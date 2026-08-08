import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/16/solid'

import { readinessRows, scheduleConflicts } from '@crm-library/core'

import { eventDateTime } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  PageHeader,
  ProgressBar,
  StatusBadge,
  TrackBadge,
} from '../components/ui.tsx'

function formatRelative(iso: string) {
  const hours = Math.round(
    (new Date('2026-08-07T16:00:00.000Z').getTime() - new Date(iso).getTime()) / 3_600_000,
  )
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function OverviewView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  if (!payload) return null
  const { state, derived } = payload
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const rows = readinessRows(state)
  const conflicts = scheduleConflicts(state)
  const attention = rows
    .filter((row) => row.blockers > 0 && row.status !== 'prospect')
    .slice(0, 5)
    .map((row) => ({
      row,
      person: state.people.find((person) => person.id === row.personId)!,
    }))
  const upcoming = state.placements
    .slice()
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`${event.venue} · ${eventDateTime(event.startsAt, event.timezone, { month: 'short', day: 'numeric' })}–${eventDateTime(event.endsAt, event.timezone, { month: 'short', day: 'numeric' })}`}
        title="The program is taking shape"
        description="Focus the team on the few participant and schedule decisions that still block a confident publish."
        actions={
          <Button variant="primary" onClick={() => navigate('/readiness')}>
            Review readiness
            <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
          </Button>
        }
      />

      <section aria-labelledby="program-health-heading" className="@container">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <h2 id="program-health-heading" className="text-lg font-semibold text-zinc-950">
              Program health
            </h2>
            <p className="text-base text-zinc-500 sm:text-sm">Current operational state.</p>
          </div>
          <p className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
            {derived.readiness.readinessPercent}% ready
          </p>
        </div>
        <div className="pt-4">
          <ProgressBar value={derived.readiness.readinessPercent} />
        </div>
        <dl className="grid grid-cols-2 pt-6 @3xl:grid-cols-4">
          {[
            [
              'Confirmed',
              derived.readiness.confirmed,
              `${derived.readiness.unconfirmed} awaiting reply`,
            ],
            ['Ready', derived.readiness.ready, `${derived.readiness.participants} active people`],
            ['Awaiting review', derived.readiness.awaitingReview, 'Submitted requirements'],
            [
              'Schedule issues',
              conflicts.length,
              `${conflicts.filter((conflict) => conflict.severity === 'error').length} blocking`,
            ],
          ].map(([label, value, detail], index) => (
            <div
              key={String(label)}
              className={`border-zinc-950/5 py-4 ${index % 2 === 1 ? 'border-l pl-5' : 'pr-5'} ${index > 1 ? 'border-t @3xl:border-t-0' : ''} ${index === 2 ? '@3xl:border-l @3xl:pl-5' : ''}`}
            >
              <dt className="truncate text-base font-medium text-zinc-500 sm:text-sm">{label}</dt>
              <dd className="pt-1 text-3xl font-semibold tracking-tight tabular-nums text-zinc-950">
                {value}
              </dd>
              <dd className="text-base text-zinc-500 sm:text-sm">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-8 xl:grid-cols-[7fr_5fr]">
        <section aria-labelledby="attention-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-3">
            <div>
              <h2 id="attention-heading" className="text-lg font-semibold text-zinc-950">
                Needs attention
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">Highest-impact incomplete work.</p>
            </div>
            <button
              type="button"
              className="focus-ring rounded-md text-base font-medium text-emerald-700 hover:text-emerald-800 sm:text-sm"
              onClick={() => navigate('/readiness')}
            >
              View all
            </button>
          </div>
          <ul role="list" className="divide-y divide-zinc-950/5">
            {attention.map(({ row, person }) => (
              <li key={row.participationId}>
                <button
                  type="button"
                  className="focus-ring flex w-full items-center gap-3 rounded-lg py-3 text-left hover:bg-zinc-950/2"
                  onClick={() => navigate(`/people?person=${person.id}`)}
                >
                  <Avatar src={person.avatarUrl} name={row.personName} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {row.personName}
                    </span>
                    <span className="block truncate text-base text-zinc-500 sm:text-sm">
                      {row.blockers} blocker{row.blockers === 1 ? '' : 's'} · {row.company}
                    </span>
                  </span>
                  <span className="w-20 shrink-0 sm:w-24">
                    <ProgressBar value={row.percent} />
                  </span>
                  <StatusBadge status={row.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="next-heading" className="min-w-0">
          <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-3">
            <div>
              <h2 id="next-heading" className="text-lg font-semibold text-zinc-950">
                Schedule at a glance
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">First day, current draft.</p>
            </div>
            <button
              type="button"
              className="focus-ring rounded-md text-base font-medium text-emerald-700 hover:text-emerald-800 sm:text-sm"
              onClick={() => navigate('/schedule')}
            >
              Open studio
            </button>
          </div>
          <ol role="list" className="divide-y divide-zinc-950/5">
            {upcoming.map((placement) => {
              const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
              const track = state.tracks.find((entry) => entry.id === session.trackId)!
              const room = state.rooms.find((entry) => entry.id === placement.roomId)!
              return (
                <li key={placement.id} className="flex gap-3 py-3">
                  <div className="w-16 shrink-0 pt-0.5">
                    <p className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                      {eventDateTime(placement.startsAt, event.timezone, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-base font-medium text-zinc-950 sm:text-sm">
                      {session.title}
                    </p>
                    <p className="truncate text-base text-zinc-500 sm:text-sm">{room.name}</p>
                  </div>
                  <TrackBadge name={track.name} color={track.color} />
                </li>
              )
            })}
          </ol>
        </section>
      </div>

      <section aria-labelledby="activity-heading">
        <div className="border-b border-zinc-950/5 pb-3">
          <h2 id="activity-heading" className="text-lg font-semibold text-zinc-950">
            Recent activity
          </h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            A durable trail of accepted operations.
          </p>
        </div>
        <ol role="list" className="divide-y divide-zinc-950/5">
          {state.domainEvents
            .slice(-5)
            .reverse()
            .map((event) => {
              const Icon = event.type.includes('schedule')
                ? CalendarDaysIcon
                : event.type.includes('requirement')
                  ? CheckCircleIcon
                  : event.type.includes('campaign')
                    ? ClockIcon
                    : event.type.includes('reset')
                      ? ExclamationCircleIcon
                      : CheckCircleIcon
              return (
                <li key={event.id} className="flex gap-3 py-3">
                  <Icon className="size-4 h-lh shrink-0 fill-zinc-400" />
                  <div className="min-w-0 flex-1">
                    <p className="text-pretty text-base text-zinc-950 sm:text-sm">
                      {event.summary}
                    </p>
                    <p className="text-base text-zinc-500 sm:text-sm">
                      {event.actor.name} · {formatRelative(event.occurredAt)}
                    </p>
                  </div>
                  <p className="hidden shrink-0 font-mono text-sm text-zinc-400 sm:block">
                    {event.operation}
                  </p>
                </li>
              )
            })}
        </ol>
      </section>
    </div>
  )
}
