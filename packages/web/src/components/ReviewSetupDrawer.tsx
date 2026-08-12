import { ChevronUpDownIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type FormEvent,
  type ReactNode,
  type SetStateAction,
} from 'react'

import {
  evaluationCriterionKind,
  evaluationRoundCriteria,
  evaluationRoundIsBlind,
  evaluationRoundReviewerTeamId,
  type EvaluationCriterion,
  type EvaluationPlan,
  type EvaluationRound,
  type Reviewer,
  type ReviewerTeam,
  type SubmissionForm,
  type Track,
} from '@programkit/core'

import { useWorkspace } from '../lib/workspace.tsx'
import { Button, Drawer, FilterTabs, IconButton, cx, selectControl, textControl } from './ui.tsx'

type SetupView = 'plan' | 'reviewers'
type CriterionDraft = {
  id: string
  label: string
  description: string
  required: boolean
  kind: 'numeric' | 'select' | 'long_text'
  minimum: number
  maximum: number
  weight: number
  options: string
}
type RoundDraft = {
  id: string
  name: string
  opensOn: string
  closesOn: string
  reviewerTeamId: string
  categoryRoutes: Array<{ trackId: string; reviewerTeamId: string }>
  blindReview: boolean
  reviewersPerSubmission: number
  minimumCompletedReviews: number
  criteria: CriterionDraft[]
}

function localId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replaceAll('-', '').slice(0, 10)}`
}

function criterionDraft(criterion?: EvaluationCriterion): CriterionDraft {
  return {
    id: criterion?.id ?? localId('crt'),
    label: criterion?.label ?? 'New criterion',
    description: criterion?.description ?? '',
    required: criterion?.required ?? true,
    kind: criterion ? evaluationCriterionKind(criterion) : 'numeric',
    minimum: criterion?.minimum ?? 1,
    maximum: criterion?.maximum ?? 5,
    weight: criterion?.weight ?? 1,
    options: criterion?.options?.join(', ') ?? 'Accept, Maybe, Reject',
  }
}

function roundDraft(plan: EvaluationPlan, round: EvaluationRound): RoundDraft {
  return {
    id: round.id,
    name: round.name,
    opensOn: round.opensAt?.slice(0, 10) ?? '',
    closesOn: round.closesAt?.slice(0, 10) ?? '',
    reviewerTeamId: evaluationRoundReviewerTeamId(plan, round.id) ?? '',
    categoryRoutes: round.categoryRoutes?.map((route) => ({ ...route })) ?? [],
    blindReview: evaluationRoundIsBlind(plan, round.id),
    reviewersPerSubmission: round.reviewersPerSubmission,
    minimumCompletedReviews: round.minimumCompletedReviews,
    criteria: evaluationRoundCriteria(plan, round.id).map((criterion) => criterionDraft(criterion)),
  }
}

function blankRound(teamId = '', index = 0): RoundDraft {
  return {
    id: localId('rnd'),
    name: index === 0 ? 'Initial Review' : `Round ${index + 1}`,
    opensOn: '',
    closesOn: '',
    reviewerTeamId: teamId,
    categoryRoutes: [],
    blindReview: false,
    reviewersPerSubmission: 2,
    minimumCompletedReviews: 2,
    criteria: [criterionDraft()],
  }
}

function dayBoundary(date: string, boundary: 'open' | 'close') {
  if (!date) return null
  return `${date}T${boundary === 'open' ? '00:00:00.000' : '23:59:59.999'}Z`
}

export function ReviewSetupDrawer({
  open,
  onClose,
  initialView = 'plan',
}: {
  open: boolean
  onClose: () => void
  initialView?: SetupView
}) {
  const { payload, execute, mutating } = useWorkspace()
  const [view, setView] = useState<SetupView>(initialView)
  const state = payload?.state
  const forms = useMemo(
    () => state?.submissionForms.filter((form) => form.eventId === state.activeEventId) ?? [],
    [state],
  )
  const plan = state?.evaluationPlans.find((entry) => entry.eventId === state.activeEventId)
  const teams = useMemo(
    () => state?.reviewerTeams.filter((team) => team.eventId === state.activeEventId) ?? [],
    [state],
  )
  const tracks = useMemo(
    () => state?.tracks.filter((track) => track.eventId === state.activeEventId) ?? [],
    [state],
  )
  const reviewers = useMemo(
    () => state?.reviewers.filter((reviewer) => reviewer.eventId === state.activeEventId) ?? [],
    [state],
  )
  const [planName, setPlanName] = useState('Proposal review')
  const [formId, setFormId] = useState('')
  const [rounds, setRounds] = useState<RoundDraft[]>([])
  const [newReviewer, setNewReviewer] = useState({ name: '', email: '' })
  const [newPoolName, setNewPoolName] = useState('')
  const [teamDrafts, setTeamDrafts] = useState<Record<string, string[]>>({})

  useEffect(() => {
    if (!open) return
    setView(initialView)
  }, [initialView, open])

  useEffect(() => {
    if (!open) return
    setPlanName(plan?.name ?? 'Proposal review')
    setFormId(plan?.formId ?? forms[0]?.id ?? '')
    setRounds(
      plan
        ? [...plan.rounds]
            .sort((left, right) => left.order - right.order)
            .map((round) => roundDraft(plan, round))
        : [blankRound(teams[0]?.id)],
    )
  }, [forms, open, plan, teams])

  useEffect(() => {
    setTeamDrafts(Object.fromEntries(teams.map((team) => [team.id, [...team.reviewerIds]])))
  }, [teams])

  if (!state) return null

  function updateRound(roundId: string, update: Partial<RoundDraft>) {
    setRounds((current) =>
      current.map((round) => (round.id === roundId ? { ...round, ...update } : round)),
    )
  }

  function updateCriterion(roundId: string, criterionId: string, update: Partial<CriterionDraft>) {
    setRounds((current) =>
      current.map((round) =>
        round.id === roundId
          ? {
              ...round,
              criteria: round.criteria.map((criterion) =>
                criterion.id === criterionId ? { ...criterion, ...update } : criterion,
              ),
            }
          : round,
      ),
    )
  }

  async function savePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const input = {
      ...(plan ? { planId: plan.id } : { formId }),
      name: planName,
      submissionKinds: ['abstract'],
      rounds: rounds.map((round) => ({
        id: round.id,
        name: round.name,
        opensAt: dayBoundary(round.opensOn, 'open'),
        closesAt: dayBoundary(round.closesOn, 'close'),
        reviewerTeamId: round.reviewerTeamId,
        categoryRoutes: round.categoryRoutes,
        blindReview: round.blindReview,
        reviewersPerSubmission: round.reviewersPerSubmission,
        minimumCompletedReviews: round.minimumCompletedReviews,
        criteria: round.criteria.map((criterion) => ({
          id: criterion.id,
          label: criterion.label,
          description: criterion.description,
          kind: criterion.kind,
          required: criterion.required,
          ...(criterion.kind === 'numeric'
            ? {
                minimum: criterion.minimum,
                maximum: criterion.maximum,
                weight: criterion.weight,
              }
            : {}),
          ...(criterion.kind === 'select'
            ? {
                options: criterion.options
                  .split(',')
                  .map((option) => option.trim())
                  .filter(Boolean),
              }
            : {}),
        })),
      })),
    }
    await execute(
      plan ? 'evaluation-plan.update' : 'evaluation-plan.create',
      input,
      plan ? { expectedVersions: { [plan.id]: plan.version } } : undefined,
      'Evaluation plan saved.',
    )
  }

  async function addReviewer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute('reviewer.create', newReviewer, undefined, 'Reviewer added.')
    if (response.ok) setNewReviewer({ name: '', email: '' })
  }

  async function addPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const response = await execute(
      'reviewer-team.create',
      { name: newPoolName, reviewerIds: [] },
      undefined,
      'Reviewer pool created.',
    )
    if (response.ok) setNewPoolName('')
  }

  async function savePool(team: ReviewerTeam) {
    await execute(
      'reviewer-team.update',
      { teamId: team.id, reviewerIds: teamDrafts[team.id] ?? [] },
      { expectedVersions: { [team.id]: team.version } },
      `${team.name} saved.`,
    )
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Review setup"
      size="wide"
      footer={
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <FilterTabs
            label="Review setup section"
            value={view}
            onChange={setView}
            options={[
              ['plan', 'Evaluation plan'],
              ['reviewers', 'Reviewer pools'],
            ]}
          />
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      {view === 'plan' ? (
        <PlanEditor
          plan={plan}
          forms={forms}
          teams={teams}
          tracks={tracks}
          planName={planName}
          setPlanName={setPlanName}
          formId={formId}
          setFormId={setFormId}
          rounds={rounds}
          setRounds={setRounds}
          updateRound={updateRound}
          updateCriterion={updateCriterion}
          onSubmit={savePlan}
          mutating={mutating}
          onManageReviewers={() => setView('reviewers')}
        />
      ) : (
        <ReviewerPools
          reviewers={reviewers}
          teams={teams}
          teamDrafts={teamDrafts}
          setTeamDrafts={setTeamDrafts}
          newReviewer={newReviewer}
          setNewReviewer={setNewReviewer}
          newPoolName={newPoolName}
          setNewPoolName={setNewPoolName}
          addReviewer={addReviewer}
          addPool={addPool}
          savePool={savePool}
          mutating={mutating}
        />
      )}
    </Drawer>
  )
}

function SelectShell({ children }: { children: ReactNode }) {
  return (
    <span className="inline-grid grid-cols-[1fr_--spacing(8)]">
      {children}
      <ChevronUpDownIcon className="pointer-events-none col-start-2 row-start-1 size-4 place-self-center fill-zinc-400" />
    </span>
  )
}

function PlanEditor({
  plan,
  forms,
  teams,
  tracks,
  planName,
  setPlanName,
  formId,
  setFormId,
  rounds,
  setRounds,
  updateRound,
  updateCriterion,
  onSubmit,
  mutating,
  onManageReviewers,
}: {
  plan: EvaluationPlan | undefined
  forms: SubmissionForm[]
  teams: ReviewerTeam[]
  tracks: Track[]
  planName: string
  setPlanName: (value: string) => void
  formId: string
  setFormId: (value: string) => void
  rounds: RoundDraft[]
  setRounds: Dispatch<SetStateAction<RoundDraft[]>>
  updateRound: (roundId: string, update: Partial<RoundDraft>) => void
  updateCriterion: (roundId: string, criterionId: string, update: Partial<CriterionDraft>) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  mutating: boolean
  onManageReviewers: () => void
}) {
  return (
    <form id="review-plan-form" className="flex flex-col gap-7" onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Plan name</span>
          <input
            required
            value={planName}
            onChange={(event) => setPlanName(event.target.value)}
            className={textControl}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-base font-medium text-zinc-950 sm:text-sm">Submission form</span>
          <SelectShell>
            <select
              disabled={Boolean(plan)}
              required
              value={formId}
              onChange={(event) => setFormId(event.target.value)}
              className={selectControl}
            >
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                </option>
              ))}
            </select>
          </SelectShell>
        </label>
      </div>

      <div className="flex items-end justify-between gap-4 border-b border-zinc-950/5 pb-2">
        <div>
          <h2 className="text-base font-medium text-zinc-950 sm:text-sm">Rounds</h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            Each round has its own dates, pool, privacy, and scorecard.
          </p>
        </div>
        <Button
          size="compact"
          onClick={() =>
            setRounds((current) => [...current, blankRound(teams[0]?.id, current.length)])
          }
        >
          <PlusIcon className="size-4 fill-current" />
          Add round
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {rounds.map((round, roundIndex) => (
          <section
            key={round.id}
            className="rounded-2xl bg-zinc-50/70 p-4 ring-1 ring-zinc-950/5 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white font-mono text-sm text-zinc-500 ring-1 ring-zinc-950/10">
                {roundIndex + 1}
              </span>
              <input
                required
                aria-label={`Round ${roundIndex + 1} name`}
                value={round.name}
                onChange={(event) => updateRound(round.id, { name: event.target.value })}
                className="focus-ring-control min-w-0 flex-1 rounded-lg bg-transparent px-1 py-1 text-lg font-semibold text-zinc-950"
              />
              {rounds.length > 1 ? (
                <IconButton
                  label={`Remove ${round.name}`}
                  onClick={() =>
                    setRounds((current) => current.filter((entry) => entry.id !== round.id))
                  }
                >
                  <TrashIcon className="size-4 fill-current" />
                </IconButton>
              ) : null}
            </div>

            <div className="grid gap-4 pt-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-700">
                  Opens
                  <span className="text-xs font-normal text-zinc-500">Required</span>
                </span>
                <input
                  aria-label="Opens"
                  type="date"
                  required
                  value={round.opensOn}
                  onInput={(event) => updateRound(round.id, { opensOn: event.currentTarget.value })}
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-700">
                  Closes
                  <span className="text-xs font-normal text-zinc-500">Required</span>
                </span>
                <input
                  aria-label="Closes"
                  type="date"
                  required
                  value={round.closesOn}
                  onInput={(event) =>
                    updateRound(round.id, { closesOn: event.currentTarget.value })
                  }
                  className={textControl}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="flex items-center justify-between gap-2 text-sm font-medium text-zinc-700">
                  Reviewer pool
                  <button
                    type="button"
                    onClick={onManageReviewers}
                    className="focus-ring rounded-md text-blue-600 hover:text-blue-700"
                  >
                    Manage
                  </button>
                </span>
                <SelectShell>
                  <select
                    required
                    value={round.reviewerTeamId}
                    onChange={(event) =>
                      updateRound(round.id, { reviewerTeamId: event.target.value })
                    }
                    className={selectControl}
                  >
                    <option value="" disabled>
                      Choose a pool
                    </option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </SelectShell>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-zinc-700">Reviews per proposal</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  required
                  value={round.reviewersPerSubmission}
                  onChange={(event) =>
                    updateRound(round.id, {
                      reviewersPerSubmission: Number(event.target.value),
                      minimumCompletedReviews: Number(event.target.value),
                    })
                  }
                  className={textControl}
                />
              </label>
              <label className="flex items-center gap-2 self-end pb-2.5 sm:col-span-2 lg:col-span-3">
                <input
                  type="checkbox"
                  checked={round.blindReview}
                  onChange={(event) => updateRound(round.id, { blindReview: event.target.checked })}
                  className="focus-ring size-4 rounded border-zinc-300 text-blue-600"
                />
                <span className="text-base text-zinc-700 sm:text-sm">
                  Hide submitter and co-author identity from reviewers
                </span>
              </label>
            </div>

            {tracks.length > 1 && teams.length > 1 ? (
              <div className="pt-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                    Category routing
                  </h3>
                  <span className="text-sm text-zinc-500">Optional</span>
                </div>
                <div className="divide-y divide-zinc-950/5 pt-2">
                  {tracks.map((track) => {
                    const routedTeamId =
                      round.categoryRoutes.find((route) => route.trackId === track.id)
                        ?.reviewerTeamId ?? ''
                    return (
                      <label
                        key={track.id}
                        className="grid items-center gap-2 py-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,1fr)]"
                      >
                        <span className="min-w-0 truncate text-base text-zinc-700 sm:text-sm">
                          {track.name}
                        </span>
                        <SelectShell>
                          <select
                            aria-label={`Reviewer pool for ${track.name}`}
                            value={routedTeamId}
                            onChange={(event) => {
                              const nextTeamId = event.target.value
                              updateRound(round.id, {
                                categoryRoutes: nextTeamId
                                  ? [
                                      ...round.categoryRoutes.filter(
                                        (route) => route.trackId !== track.id,
                                      ),
                                      { trackId: track.id, reviewerTeamId: nextTeamId },
                                    ]
                                  : round.categoryRoutes.filter(
                                      (route) => route.trackId !== track.id,
                                    ),
                              })
                            }}
                            className={selectControl}
                          >
                            <option value="">
                              Use{' '}
                              {teams.find((team) => team.id === round.reviewerTeamId)?.name ??
                                'default pool'}
                            </option>
                            {teams.map((team) => (
                              <option key={team.id} value={team.id}>
                                {team.name}
                              </option>
                            ))}
                          </select>
                        </SelectShell>
                      </label>
                    )
                  })}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4 pt-6">
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">Scorecard</h3>
              <Button
                size="compact"
                variant="ghost"
                onClick={() =>
                  updateRound(round.id, {
                    criteria: [...round.criteria, criterionDraft()],
                  })
                }
              >
                <PlusIcon className="size-4 fill-current" />
                Add field
              </Button>
            </div>
            <div className="divide-y divide-zinc-950/5">
              {round.criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="grid gap-3 py-3 lg:grid-cols-[1fr_10rem_1fr_auto]"
                >
                  <input
                    aria-label="Criterion label"
                    required
                    value={criterion.label}
                    onChange={(event) =>
                      updateCriterion(round.id, criterion.id, { label: event.target.value })
                    }
                    className={textControl}
                  />
                  <SelectShell>
                    <select
                      aria-label={`${criterion.label} field type`}
                      value={criterion.kind}
                      onChange={(event) =>
                        updateCriterion(round.id, criterion.id, {
                          kind: event.target.value as CriterionDraft['kind'],
                        })
                      }
                      className={selectControl}
                    >
                      <option value="numeric">Number</option>
                      <option value="select">Dropdown</option>
                      <option value="long_text">Long text</option>
                    </select>
                  </SelectShell>
                  {criterion.kind === 'numeric' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {(
                        [
                          ['minimum', 'Min'],
                          ['maximum', 'Max'],
                          ['weight', 'Weight'],
                        ] as const
                      ).map(([field, label]) => (
                        <label key={field} className="flex flex-col gap-1">
                          <span className="text-sm text-zinc-500">{label}</span>
                          <input
                            type="number"
                            min={field === 'weight' ? 0 : undefined}
                            step={field === 'weight' ? 0.25 : 1}
                            value={criterion[field]}
                            onChange={(event) =>
                              updateCriterion(round.id, criterion.id, {
                                [field]: Number(event.target.value),
                              })
                            }
                            className={cx(textControl, 'min-w-0')}
                          />
                        </label>
                      ))}
                    </div>
                  ) : criterion.kind === 'select' ? (
                    <label className="flex flex-col gap-1">
                      <span className="text-sm text-zinc-500">Options, separated by commas</span>
                      <input
                        required
                        value={criterion.options}
                        onChange={(event) =>
                          updateCriterion(round.id, criterion.id, { options: event.target.value })
                        }
                        className={textControl}
                      />
                    </label>
                  ) : (
                    <p className="self-center text-sm text-zinc-500">Multi-line response</p>
                  )}
                  <IconButton
                    label={`Remove ${criterion.label}`}
                    disabled={round.criteria.length === 1}
                    onClick={() =>
                      updateRound(round.id, {
                        criteria: round.criteria.filter((entry) => entry.id !== criterion.id),
                      })
                    }
                  >
                    <TrashIcon className="size-4 fill-current" />
                  </IconButton>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="flex justify-end border-t border-zinc-950/5 pt-5">
        <Button type="submit" variant="primary" disabled={mutating || teams.length === 0}>
          Save evaluation plan
        </Button>
      </div>
    </form>
  )
}

function ReviewerPools({
  reviewers,
  teams,
  teamDrafts,
  setTeamDrafts,
  newReviewer,
  setNewReviewer,
  newPoolName,
  setNewPoolName,
  addReviewer,
  addPool,
  savePool,
  mutating,
}: {
  reviewers: Reviewer[]
  teams: ReviewerTeam[]
  teamDrafts: Record<string, string[]>
  setTeamDrafts: Dispatch<SetStateAction<Record<string, string[]>>>
  newReviewer: { name: string; email: string }
  setNewReviewer: Dispatch<SetStateAction<{ name: string; email: string }>>
  newPoolName: string
  setNewPoolName: (value: string) => void
  addReviewer: (event: FormEvent<HTMLFormElement>) => void
  addPool: (event: FormEvent<HTMLFormElement>) => void
  savePool: (team: ReviewerTeam) => Promise<void>
  mutating: boolean
}) {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div>
        <div className="border-b border-zinc-950/5 pb-2">
          <h2 className="text-base font-medium text-zinc-950 sm:text-sm">Reviewer pools</h2>
          <p className="text-base text-zinc-500 sm:text-sm">
            Keep each round’s eligible reviewers separate.
          </p>
        </div>
        <div className="divide-y divide-zinc-950/5">
          {teams.map((team) => (
            <section key={team.id} className="py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-medium text-zinc-950 sm:text-sm">{team.name}</h3>
                  <p className="text-sm text-zinc-500">
                    {(teamDrafts[team.id] ?? []).length} reviewers
                  </p>
                </div>
                <Button size="compact" disabled={mutating} onClick={() => void savePool(team)}>
                  Save pool
                </Button>
              </div>
              <div className="grid gap-2 pt-3 sm:grid-cols-2">
                {reviewers.map((reviewer) => {
                  const checked = (teamDrafts[team.id] ?? []).includes(reviewer.id)
                  return (
                    <label
                      key={reviewer.id}
                      className="flex items-center gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 ring-1 ring-zinc-950/5"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTeamDrafts((current) => ({
                            ...current,
                            [team.id]: checked
                              ? (current[team.id] ?? []).filter((id) => id !== reviewer.id)
                              : [...(current[team.id] ?? []), reviewer.id],
                          }))
                        }
                        className="focus-ring size-4 rounded border-zinc-300 text-blue-600"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-base font-medium text-zinc-950 sm:text-sm">
                          {reviewer.name}
                        </span>
                        <span className="block truncate text-sm text-zinc-500">
                          {reviewer.email}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <aside className="flex flex-col gap-7">
        <form className="flex flex-col gap-3" onSubmit={addReviewer}>
          <h2 className="text-base font-medium text-zinc-950 sm:text-sm">Add reviewer</h2>
          <input
            required
            aria-label="Reviewer name"
            placeholder="Sam Rodriguez"
            value={newReviewer.name}
            onChange={(event) =>
              setNewReviewer((current) => ({ ...current, name: event.target.value }))
            }
            className={textControl}
          />
          <input
            required
            type="email"
            aria-label="Reviewer email"
            placeholder="sam@example.com"
            value={newReviewer.email}
            onChange={(event) =>
              setNewReviewer((current) => ({ ...current, email: event.target.value }))
            }
            className={textControl}
          />
          <Button type="submit" disabled={mutating}>
            Add reviewer
          </Button>
        </form>
        <form className="flex flex-col gap-3 border-t border-zinc-950/5 pt-6" onSubmit={addPool}>
          <h2 className="text-base font-medium text-zinc-950 sm:text-sm">New pool</h2>
          <input
            required
            aria-label="Reviewer pool name"
            placeholder="Final review committee"
            value={newPoolName}
            onChange={(event) => setNewPoolName(event.target.value)}
            className={textControl}
          />
          <Button type="submit" disabled={mutating}>
            Create pool
          </Button>
        </form>
      </aside>
    </div>
  )
}
