import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/16/solid'
import { useState } from 'react'

import { nextActions, submissionPipelineSummary } from '@programkit/core'

import { eventDateTime } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  EmptyState,
  NextActionRow,
  PageHeader,
  SectionHeading,
  StatGrid,
  TrackBadge,
  sentenceCase,
} from '../components/ui.tsx'

function formatRelative(iso: string) {
  const hours = Math.round(
    (new Date('2026-08-07T16:00:00.000Z').getTime() - new Date(iso).getTime()) / 3_600_000,
  )
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** How many grouped jobs stay visible before the tail folds away. */
const visibleActionCount = 6

export function OverviewView({ navigate }: { navigate: (to: string) => void }) {
  const { payload } = useWorkspace()
  const [allActionsShown, setAllActionsShown] = useState(false)
  if (!payload) return null
  const { state, derived } = payload
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const pipeline = submissionPipelineSummary(state)
  const actions = nextActions(state)
  const shownActions = allActionsShown ? actions : actions.slice(0, visibleActionCount)
  const upcoming = state.placements
    .slice()
    .sort((left, right) => left.startsAt.localeCompare(right.startsAt))
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={event.name}
        actions={
          <Button onClick={() => navigate('/submissions')}>
            Review {pipeline.submitted} new submission{pipeline.submitted === 1 ? '' : 's'}
            <ArrowRightIcon className="size-4 h-lh shrink-0 fill-current" />
          </Button>
        }
      />

      <section aria-labelledby="next-actions-heading">
        <SectionHeading
          id="next-actions-heading"
          title="What needs you now"
          description="Outstanding work, grouped by the job it belongs to."
        />
        {actions.length === 0 ? (
          <EmptyState
            tone="settled"
            title="Nothing is waiting on you"
            description="Every speaker requirement, review, and session placement is settled for now."
          />
        ) : (
          <>
            <ul role="list" className="-mx-2 divide-y divide-zinc-950/5">
              {shownActions.map((action) => (
                <li key={action.id}>
                  <NextActionRow
                    label={action.label}
                    detail={sentenceCase(
                      [
                        action.detail,
                        action.dueAt
                          ? `due ${eventDateTime(action.dueAt, event.timezone, {
                              month: 'short',
                              day: 'numeric',
                            })}`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · '),
                    )}
                    count={action.count}
                    tone={action.tone}
                    onSelect={() => navigate(action.href)}
                  />
                </li>
              ))}
            </ul>
            {actions.length > visibleActionCount ? (
              <div className="pt-2">
                <button
                  type="button"
                  className="focus-ring rounded-md text-base font-medium text-blue-600 hover:text-blue-700 sm:text-sm"
                  onClick={() => setAllActionsShown((shown) => !shown)}
                >
                  {allActionsShown
                    ? 'Show less'
                    : `Show ${actions.length - visibleActionCount} more`}
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section aria-labelledby="program-health-heading">
        <SectionHeading
          id="program-health-heading"
          title="Program pipeline"
          description="From submitted proposal to ready-to-publish session."
          action={
            <p className="text-base font-medium tabular-nums text-zinc-500 sm:text-sm">
              {pipeline.total} proposals
            </p>
          }
        />
        <StatGrid
          stats={[
            { label: 'New', value: pipeline.submitted, detail: 'Ready for triage' },
            {
              label: 'In review',
              value: pipeline.inReview,
              detail: `${pipeline.awaitingReviews} awaiting reviews`,
            },
            {
              label: 'Accepted',
              value: pipeline.accepted,
              detail: `${state.sessions.length} sessions total`,
            },
            {
              label: 'Speakers ready',
              value: derived.readiness.ready,
              detail: `${derived.readiness.participants} active speakers`,
            },
          ]}
        />
      </section>

      <div className="grid gap-7 xl:grid-cols-2">
        <section aria-labelledby="next-heading" className="min-w-0">
          <SectionHeading
            id="next-heading"
            title="Schedule at a glance"
            description="First day, current draft."
            action={
              <button
                type="button"
                className="focus-ring rounded-md text-base font-medium text-blue-600 hover:text-blue-700 sm:text-sm"
                onClick={() => navigate('/schedule')}
              >
                Open studio
              </button>
            }
          />
          <ol role="list" className="divide-y divide-zinc-950/5">
            {upcoming.map((placement) => {
              const session = state.sessions.find((entry) => entry.id === placement.sessionId)!
              const track = state.tracks.find((entry) => entry.id === session.trackId)!
              const room = state.rooms.find((entry) => entry.id === placement.roomId)!
              return (
                <li key={placement.id} className="flex gap-3 py-3">
                  <div className="w-20 shrink-0 pt-0.5">
                    <p className="whitespace-nowrap text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
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

        <section aria-labelledby="activity-heading" className="min-w-0">
          <SectionHeading id="activity-heading" title="Recent activity" />
          <ol role="list" className="pt-2">
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
                  <li
                    key={event.id}
                    className="relative flex gap-3 py-3 before:absolute before:top-8 before:bottom-[-0.75rem] before:left-[0.46875rem] before:w-px before:bg-zinc-950/5 last:before:hidden"
                  >
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
    </div>
  )
}
