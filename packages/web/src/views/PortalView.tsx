import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentArrowUpIcon,
  LockClosedIcon,
  UserGroupIcon,
} from '@heroicons/react/16/solid'
import { useState, type FormEvent } from 'react'

import {
  readinessRows,
  type Asset,
  type RequirementDefinition,
  type RequirementInstance,
} from '@programkit/core'

import { eventDateTime } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Avatar,
  Button,
  Callout,
  EmptyState,
  ProgressBar,
  StatusBadge,
  cx,
  sentenceCase,
  textAreaControl,
  textControl,
} from '../components/ui.tsx'

/**
 * One treatment for every place a task asks the speaker for something, so the
 * upload, the written answer, and the blocked release all read as the same
 * kind of object rather than three unrelated widgets.
 */
const taskWell = 'rounded-xl bg-zinc-50 p-4 ring-1 ring-zinc-950/5 sm:ml-6'

/**
 * An approval the speaker has never been given a document for cannot be acted
 * on, so it is the program team's move, not theirs. Grouping and due-date copy
 * both read from this so the page never asks for something it has not provided.
 */
function blockedOnProgramTeam({
  definition,
  instance,
}: {
  definition: RequirementDefinition
  instance: RequirementInstance
}) {
  return (
    definition.kind === 'approval' &&
    (instance.status === 'not_started' || instance.status === 'revision_requested')
  )
}

export function PortalView() {
  const { payload } = useWorkspace()
  if (!payload) return null
  return <PortalWorkspace />
}

function PortalWorkspace() {
  const { payload, execute, uploadRequirementFile, assetUrl, mutating } = useWorkspace()
  const state = payload!.state
  const event = state.events.find((entry) => entry.id === state.activeEventId)!
  const participation =
    state.participations.find((entry) => entry.id === 'par_003') ?? state.participations[0]
  const person = state.people.find((entry) => entry.id === participation.personId)!
  const row = readinessRows(state).find((entry) => entry.participationId === participation.id)!
  const [form, setForm] = useState({
    publicTitle: participation.publicTitle,
    publicCompany: participation.publicCompany,
    bio: person.bio,
  })
  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await execute(
      'portal.update-profile',
      { participationId: participation.id, ...form },
      {
        expectedVersions: {
          [participation.id]: participation.version,
          [person.id]: person.version,
        },
      },
      'Public profile updated.',
    )
  }

  const tasks = state.requirementInstances
    .filter((instance) => instance.participationId === participation.id)
    .map((instance) => ({
      instance,
      definition: state.requirementDefinitions.find((entry) => entry.id === instance.definitionId)!,
    }))
    .sort((left, right) => left.definition.dueAt.localeCompare(right.definition.dueAt))

  // Three groups answer the only questions a speaker has on this page: what is
  // waiting on me, what is waiting on somebody else, and what is finished.
  const groups = [
    {
      key: 'open',
      label: 'Waiting on you',
      tasks: tasks.filter(
        (task) =>
          (task.instance.status === 'not_started' ||
            task.instance.status === 'revision_requested') &&
          !blockedOnProgramTeam(task),
      ),
    },
    {
      key: 'review',
      label: 'With the program team',
      tasks: tasks.filter(
        (task) => task.instance.status === 'submitted' || blockedOnProgramTeam(task),
      ),
    },
    {
      key: 'settled',
      label: 'Settled',
      tasks: tasks.filter(
        ({ instance }) => instance.status === 'approved' || instance.status === 'waived',
      ),
    },
  ].filter((group) => group.tasks.length > 0)

  const nothingOutstanding = tasks.length > 0 && groups.every((group) => group.key === 'settled')

  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-zinc-950/5 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <a
            href={`/portal/${participation.id}`}
            aria-label="Homepage"
            className="focus-ring text-base font-semibold tracking-tight text-zinc-950"
            onClick={(event) => event.preventDefault()}
          >
            AIE NYC
          </a>
          <button
            type="button"
            className="focus-ring flex items-center gap-2 rounded-lg text-base text-zinc-500 hover:text-zinc-950 sm:text-sm"
            onClick={() => {
              window.location.href = '/'
            }}
          >
            <ArrowLeftIcon className="size-4 h-lh shrink-0 fill-current" />
            Operator workspace
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
        <section className="flex flex-col gap-6 border-b border-zinc-950/5 pb-6 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Avatar
              src={person.avatarUrl}
              name={`${person.firstName} ${person.lastName}`}
              size="large"
            />
            <div className="min-w-0">
              <p className="text-base text-zinc-500 sm:text-sm">Speaker workspace</p>
              <h1 className="truncate text-2xl font-semibold tracking-tight text-zinc-950">
                Welcome, {person.firstName}
              </h1>
              <p className="truncate text-base text-zinc-500 sm:text-sm">
                {sentenceCase(participation.roles.join(', '))} · AIE NYC 2026
              </p>
            </div>
          </div>
          <div className="min-w-0 lg:w-72">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-medium text-zinc-950 sm:text-sm">Your readiness</p>
              <p className="text-base font-medium tabular-nums text-zinc-950 sm:text-sm">
                {row.percent}%
              </p>
            </div>
            <div className="pt-2">
              <ProgressBar value={row.percent} />
            </div>
            <p className="pt-2 text-base tabular-nums text-zinc-500 sm:text-sm">
              {row.completed} of {row.total} approved
            </p>
          </div>
        </section>

        <nav
          aria-label="Speaker workspace sections"
          className="-mt-4 flex min-w-0 gap-5 overflow-x-auto border-b border-zinc-950/5"
        >
          {[
            ['#tasks', 'Tasks'],
            ['#profile', 'Profile'],
            ['#resources', 'Resources'],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="focus-ring shrink-0 border-b-2 border-transparent py-3 text-base font-medium text-zinc-600 hover:border-zinc-300 hover:text-zinc-950 sm:text-sm"
            >
              {label}
            </a>
          ))}
        </nav>

        {participation.status === 'invited' ? (
          <section className="rounded-2xl bg-zinc-950 p-5 text-white shadow-sm ring-1 ring-black/10 sm:p-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="max-w-2xl">
                <h2 className="text-xl font-semibold">Confirm your participation</h2>
                <p className="text-pretty text-base text-zinc-300 sm:text-sm">
                  Confirm that you plan to join us in Brooklyn on October 4–5. You can update
                  logistics later.
                </p>
              </div>
              <Button
                variant="primary"
                disabled={mutating}
                onClick={() =>
                  void execute(
                    'participation.set-status',
                    { participationId: participation.id, status: 'confirmed' },
                    { expectedVersions: { [participation.id]: participation.version } },
                    'Participation confirmed. We look forward to seeing you.',
                  )
                }
              >
                <CheckCircleIcon className="size-4 h-lh shrink-0 fill-current" />
                Confirm participation
              </Button>
            </div>
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[7fr_5fr]">
          <section
            id="tasks"
            aria-labelledby="tasks-heading"
            className="rounded-2xl p-5 ring-1 ring-zinc-950/10 sm:p-6"
          >
            <div className="border-b border-zinc-950/5 pb-3">
              <h2 id="tasks-heading" className="text-lg font-semibold text-zinc-950">
                Your tasks
              </h2>
              <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                What you send goes to the program team, who approve it or ask for a change.
              </p>
            </div>

            {tasks.length === 0 ? (
              <EmptyState
                title="Nothing assigned yet"
                description="The program team has not given you anything to complete for this event."
              />
            ) : (
              <>
                {nothingOutstanding ? (
                  <div className="pt-4">
                    <Callout tone="success" title={`You are ready for ${event.name}`}>
                      Every task on your list is settled. Nothing here is waiting on you.
                    </Callout>
                  </div>
                ) : null}
                <div>
                  {groups.map((group) => (
                    <div key={group.key} className="pt-5 first:pt-3">
                      {/* The count sits with the label so the size of each group
                          is legible before any row is read. */}
                      <h3 className="flex items-baseline gap-2 text-base font-medium text-zinc-500 sm:text-sm">
                        {group.label}
                        <span className="tabular-nums text-zinc-500">{group.tasks.length}</span>
                      </h3>
                      <ul role="list" className="divide-y divide-zinc-950/5">
                        {group.tasks.map(({ instance, definition }) => (
                          <RequirementTask
                            key={instance.id}
                            definition={definition}
                            instance={instance}
                            asset={
                              state.assets.find((entry) => entry.id === instance.value) ?? null
                            }
                            dueLabel={eventDateTime(definition.dueAt, event.timezone, {
                              month: 'short',
                              day: 'numeric',
                            })}
                            submittedLabel={
                              instance.submittedAt
                                ? eventDateTime(instance.submittedAt, event.timezone, {
                                    month: 'short',
                                    day: 'numeric',
                                  })
                                : null
                            }
                            awaitingConfirmation={participation.status === 'invited'}
                            mutating={mutating}
                            assetUrl={assetUrl}
                            onSubmit={(value) =>
                              execute(
                                'requirement.set-status',
                                {
                                  requirementInstanceId: instance.id,
                                  status: 'submitted',
                                  value,
                                },
                                { expectedVersions: { [instance.id]: instance.version } },
                                `${definition.label} submitted for review.`,
                              )
                            }
                            onUpload={(file) =>
                              uploadRequirementFile(
                                instance.id,
                                file,
                                `${definition.label} uploaded for review.`,
                              )
                            }
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section
            id="profile"
            aria-labelledby="profile-heading"
            className="rounded-2xl p-5 ring-1 ring-zinc-950/10 sm:p-6"
          >
            <div className="border-b border-zinc-950/5 pb-3">
              <h2 id="profile-heading" className="text-lg font-semibold text-zinc-950">
                Public profile
              </h2>
              <p className="text-base text-zinc-500 sm:text-sm">Shown on the published program.</p>
            </div>
            <form
              className="flex flex-col gap-4 pt-4"
              onSubmit={(event) => void saveProfile(event)}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Title</span>
                <input
                  type="text"
                  name="publicTitle"
                  value={form.publicTitle}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publicTitle: event.target.value }))
                  }
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Company</span>
                <input
                  type="text"
                  name="publicCompany"
                  value={form.publicCompany}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, publicCompany: event.target.value }))
                  }
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-base font-medium text-zinc-950 sm:text-sm">Bio</span>
                <textarea
                  name="bio"
                  rows={6}
                  maxLength={600}
                  value={form.bio}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, bio: event.target.value }))
                  }
                  className={textAreaControl}
                />
              </label>
              <p className="text-right text-sm tabular-nums text-zinc-500">{form.bio.length}/600</p>
              <Button
                type="submit"
                variant={participation.status === 'invited' ? 'secondary' : 'primary'}
                disabled={mutating}
              >
                Save public profile
              </Button>
            </form>
          </section>
        </div>

        <section id="resources" aria-labelledby="resources-heading" className="scroll-mt-6">
          <div className="flex flex-col gap-4 border-b border-zinc-950/5 pb-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2
                id="resources-heading"
                className="text-xl font-semibold tracking-tight text-zinc-950"
              >
                Event resources
              </h2>
              <p className="max-w-2xl text-pretty text-base text-zinc-500 sm:text-sm">
                Guidance published by the program team, plus two tools built from the published
                program. Sessions you save to an itinerary stay on the device you save them on.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/embed/speakers"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-medium text-blue-700 ring-1 ring-inset ring-blue-700/20 hover:bg-blue-50 sm:text-sm"
              >
                <UserGroupIcon className="size-4 h-lh fill-current" />
                Speaker gallery
              </a>
              <a
                href="/embed/itinerary"
                className="focus-ring inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-base font-medium text-blue-700 ring-1 ring-inset ring-blue-700/20 hover:bg-blue-50 sm:text-sm"
              >
                <CalendarDaysIcon className="size-4 h-lh fill-current" />
                Build itinerary
              </a>
            </div>
          </div>

          {state.portalResources.length === 0 ? (
            <EmptyState
              title="Resources are being prepared"
              description="The program team has not published a guide for this event yet."
            />
          ) : (
            <div className="grid gap-5 pt-5 lg:grid-cols-2">
              {state.portalResources.map((resource) => (
                <article
                  key={resource.id}
                  id={resource.id}
                  className="min-w-0 overflow-hidden rounded-2xl ring-1 ring-zinc-950/10"
                >
                  <div className="border-b border-zinc-950/5 p-5">
                    <div className="flex items-start gap-3">
                      <BookOpenIcon className="mt-0.5 size-4 h-lh shrink-0 fill-blue-600" />
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold text-zinc-950">{resource.title}</h3>
                        <p className="text-pretty text-base text-zinc-500 sm:text-sm">
                          {resource.summary}
                        </p>
                      </div>
                    </div>
                  </div>
                  {resource.kind === 'guide' ? (
                    <div className="flex flex-col gap-5 p-5">
                      {resource.body.split(/\n\n/gu).map((block) => {
                        const [heading, ...lines] = block.split('\n')
                        return (
                          <div key={block}>
                            <h4 className="text-base font-medium text-zinc-950 sm:text-sm">
                              {heading}
                            </h4>
                            <p className="pt-1 text-pretty text-base text-zinc-600 sm:text-sm">
                              {lines.join(' ')}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <iframe
                      title={resource.title}
                      sandbox=""
                      referrerPolicy="no-referrer"
                      srcDoc={resource.embedHtml ?? ''}
                      className="h-64 w-full border-0 bg-white"
                    />
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

function RequirementTask({
  definition,
  instance,
  asset,
  dueLabel,
  submittedLabel,
  awaitingConfirmation,
  mutating,
  assetUrl,
  onSubmit,
  onUpload,
}: {
  definition: RequirementDefinition
  instance: RequirementInstance
  asset: Asset | null
  dueLabel: string
  submittedLabel: string | null
  awaitingConfirmation: boolean
  mutating: boolean
  assetUrl: (assetId: string) => string
  onSubmit: (value: string) => Promise<unknown>
  onUpload: (file: File) => Promise<unknown>
}) {
  const [value, setValue] = useState(instance.value)
  const [file, setFile] = useState<File | null>(null)
  const editable = instance.status === 'not_started' || instance.status === 'revision_requested'
  const settled = instance.status === 'approved' || instance.status === 'waived'
  const blocked = blockedOnProgramTeam({ definition, instance })
  // A release the speaker has never been given is not late by their doing, so a
  // blocked task is never marked overdue and never dated as if they owed it.
  const overdue = editable && !blocked && Date.parse(definition.dueAt) < Date.now()
  const fileAccept =
    definition.id === 'req_headshot'
      ? 'image/jpeg,image/png,image/webp'
      : '.pdf,.doc,.docx,.ppt,.pptx,application/pdf'

  const StatusIcon = settled
    ? CheckCircleIcon
    : instance.status === 'revision_requested'
      ? ArrowPathIcon
      : ClockIcon
  const statusTone = settled
    ? 'fill-emerald-600'
    : instance.status === 'revision_requested'
      ? 'fill-rose-500'
      : instance.status === 'submitted'
        ? 'fill-amber-500'
        : 'fill-zinc-300'

  return (
    <li className="flex flex-col gap-3 py-4">
      {/* The title line owns the status chip so the description keeps the full
          column at 375px instead of wrapping around a floating badge. */}
      <div className="flex items-start gap-2">
        <StatusIcon className={cx('size-4 h-lh shrink-0', statusTone)} />
        <p className="min-w-0 flex-1 text-base font-medium text-zinc-950 sm:text-sm">
          {definition.label}
        </p>
        <StatusBadge status={instance.status} />
      </div>
      <div className="-mt-2 sm:ml-6">
        <p className="text-pretty text-base text-zinc-500 sm:text-sm">{definition.description}</p>
        {settled ? null : (
          <p
            className={cx('pt-1 text-sm', overdue ? 'font-medium text-rose-700' : 'text-zinc-500')}
          >
            {blocked
              ? `Due ${dueLabel}, once the program team provides it`
              : overdue
                ? `Overdue since ${dueLabel}`
                : `Due ${dueLabel}`}
          </p>
        )}
      </div>

      {instance.status === 'submitted' ? (
        <p className="text-base text-zinc-500 sm:ml-6 sm:text-sm">
          {submittedLabel ? `Sent ${submittedLabel}. ` : ''}The program team is reviewing it now.
        </p>
      ) : null}

      {instance.status === 'waived' ? (
        <p className="text-base text-zinc-500 sm:ml-6 sm:text-sm">
          The program team waived this for you.
        </p>
      ) : null}

      {asset ? (
        <a
          href={assetUrl(asset.id)}
          className="focus-ring inline-flex w-fit items-center gap-1.5 rounded-md text-base font-medium text-blue-700 hover:text-blue-900 sm:ml-6 sm:text-sm"
        >
          <ArrowDownTrayIcon className="size-4 h-lh shrink-0 fill-current" />
          Download {asset.filename}
        </a>
      ) : null}

      {editable && definition.kind === 'confirmation' ? (
        <p className="text-pretty text-base text-zinc-500 sm:ml-6 sm:text-sm">
          {awaitingConfirmation
            ? 'Use Confirm participation at the top of this page.'
            : 'The program team closes this out once your participation is on record.'}
        </p>
      ) : null}

      {editable && definition.kind === 'file' ? (
        <div className={cx(taskWell, 'flex flex-col gap-3')}>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">
              {asset ? 'Replace file' : 'Choose file'}
            </span>
            <input
              type="file"
              accept={fileAccept}
              className="focus-ring block w-full rounded-lg bg-white p-2 text-base text-zinc-600 ring-1 ring-zinc-950/10 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 sm:text-sm"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-zinc-500 sm:text-sm">
              {definition.id === 'req_headshot'
                ? 'JPEG, PNG, or WebP · 8 MB maximum'
                : 'PDF, Word, or PowerPoint · 8 MB maximum'}
            </p>
            <Button
              size="compact"
              className="w-full sm:w-auto"
              disabled={mutating || !file}
              onClick={() => file && void onUpload(file)}
            >
              <DocumentArrowUpIcon className="size-4 h-lh shrink-0 fill-current" />
              Upload for review
            </Button>
          </div>
        </div>
      ) : null}

      {editable && (definition.kind === 'text' || definition.kind === 'form') ? (
        <div className={cx(taskWell, 'flex flex-col gap-3')}>
          <label className="flex flex-col gap-1.5">
            <span className="text-base font-medium text-zinc-950 sm:text-sm">
              {definition.kind === 'form' ? 'Production notes' : 'Your response'}
            </span>
            <textarea
              rows={definition.kind === 'form' ? 4 : 5}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              className={textAreaControl}
            />
          </label>
          <div className="flex justify-end">
            <Button
              size="compact"
              className="w-full sm:w-auto"
              disabled={mutating || value.trim().length === 0}
              onClick={() => void onSubmit(value.trim())}
            >
              Submit for review
            </Button>
          </div>
        </div>
      ) : null}

      {blocked ? (
        <div className={cx(taskWell, 'flex items-start gap-3')}>
          <LockClosedIcon className="size-4 h-lh shrink-0 fill-zinc-400" />
          <div className="min-w-0">
            <p className="text-base font-medium text-zinc-950 sm:text-sm">
              Release not available yet
            </p>
            <p className="text-pretty text-base text-zinc-600 sm:text-sm">
              The program team has not attached the release document. Once they add it here or send
              it to you, you can respond. Nothing is waiting on you right now.
            </p>
          </div>
        </div>
      ) : null}

      {!editable && !asset && instance.value ? (
        <div className={taskWell}>
          <p className="text-base font-medium text-zinc-950 sm:text-sm">What you sent</p>
          <p className="text-pretty text-base text-zinc-600 sm:text-sm">{instance.value}</p>
        </div>
      ) : null}
    </li>
  )
}
