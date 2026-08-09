import { ChevronUpDownIcon } from '@heroicons/react/16/solid'
import { useEffect, useMemo, useState, type FormEvent } from 'react'

import { toZonedDateTimeInput, zonedDateTimeInputToIso } from '../lib/date.ts'
import { useWorkspace } from '../lib/workspace.tsx'
import {
  Button,
  Callout,
  Dialog,
  Field,
  PageHeader,
  SectionHeading,
  selectControl,
  textControl,
} from '../components/ui.tsx'

interface EventSettingsDraft {
  name: string
  slug: string
  venue: string
  city: string
  timezone: string
  startsAt: string
  endsAt: string
  status: 'planning' | 'active' | 'complete'
}

type TeamRole = 'owner' | 'admin' | 'member'

interface TeamMember {
  id: string
  userId: string
  email: string
  role: TeamRole
  joinedAt: string
}

interface TeamInvitation {
  id: string
  email: string
  role: Exclude<TeamRole, 'owner'>
  createdAt: string
  expiresAt: string
}

interface TeamState {
  currentMembershipId: string
  currentRole: TeamRole
  members: TeamMember[]
  invitations: TeamInvitation[]
}

const emptyDraft: EventSettingsDraft = {
  name: '',
  slug: '',
  venue: '',
  city: '',
  timezone: 'UTC',
  startsAt: '',
  endsAt: '',
  status: 'planning',
}

function draftFromEvent(event: {
  name: string
  slug: string
  venue: string
  city: string
  timezone: string
  startsAt: string
  endsAt: string
  status: EventSettingsDraft['status']
}) {
  return {
    name: event.name,
    slug: event.slug,
    venue: event.venue,
    city: event.city,
    timezone: event.timezone,
    startsAt: toZonedDateTimeInput(event.startsAt, event.timezone),
    endsAt: toZonedDateTimeInput(event.endsAt, event.timezone),
    status: event.status,
  }
}

function isHostedApp() {
  return (
    typeof document !== 'undefined' &&
    document.querySelector<HTMLMetaElement>('meta[name="programkit-deployment-profile"]')
      ?.content === 'hosted-app'
  )
}

function roleLabel(role: TeamRole) {
  if (role === 'member') return 'Viewer'
  return role.charAt(0).toLocaleUpperCase() + role.slice(1)
}

function TeamSettings({
  eventId,
  onRoleChange,
}: {
  eventId: string
  onRoleChange: (role: TeamRole) => void
}) {
  const [team, setTeam] = useState<TeamState | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'admin' | 'member'>('member')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removal, setRemoval] = useState<
    | { kind: 'member'; id: string; label: string }
    | { kind: 'invitation'; id: string; label: string }
    | null
  >(null)

  async function loadTeam(signal?: AbortSignal) {
    const response = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/team`, {
      credentials: 'same-origin',
      signal,
    })
    if (!response.ok) throw new Error('Team access could not be loaded.')
    const body = (await response.json()) as { ok?: boolean; team?: TeamState; error?: string }
    if (!body.ok || !body.team) throw new Error(body.error ?? 'Team access could not be loaded.')
    setTeam(body.team)
    onRoleChange(body.team.currentRole)
  }

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void loadTeam(controller.signal)
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return
        setError(caught instanceof Error ? caught.message : 'Team access could not be loaded.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [eventId])

  async function invite() {
    if (!email.trim()) return
    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const response = await fetch(`/api/v1/events/${encodeURIComponent(eventId)}/invitations`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok)
        throw new Error(body.error ?? 'The invitation could not be sent.')
      setEmail('')
      setNotice('Invitation sent.')
      await loadTeam()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The invitation could not be sent.')
    } finally {
      setWorking(false)
    }
  }

  async function confirmRemoval() {
    if (!removal) return
    setWorking(true)
    setError(null)
    setNotice(null)
    try {
      const resource = removal.kind === 'member' ? 'members' : 'invitations'
      const response = await fetch(
        `/api/v1/events/${encodeURIComponent(eventId)}/${resource}/${encodeURIComponent(removal.id)}`,
        { method: 'DELETE', credentials: 'same-origin' },
      )
      const body = (await response.json()) as { ok?: boolean; error?: string }
      if (!response.ok || !body.ok) {
        throw new Error(body.error ?? 'Team access could not be updated.')
      }
      setNotice(removal.kind === 'member' ? 'Access removed.' : 'Invitation canceled.')
      setRemoval(null)
      await loadTeam()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Team access could not be updated.')
    } finally {
      setWorking(false)
    }
  }

  const canInvite = team?.currentRole === 'owner' || team?.currentRole === 'admin'
  const canInviteAdmins = team?.currentRole === 'owner'

  return (
    <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-team-heading">
      <SectionHeading id="event-team-heading" title="Team" />
      {loading ? (
        <p className="pt-5 text-pretty text-base text-zinc-500 sm:text-sm">Loading team…</p>
      ) : team ? (
        <div className="grid gap-6 pt-5">
          {canInvite ? (
            <form
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_auto] sm:items-end"
              onSubmit={(event) => {
                event.preventDefault()
                void invite()
              }}
            >
              <Field label="Email address" htmlFor="team-invite-email">
                <input
                  id="team-invite-email"
                  name="inviteEmail"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.currentTarget.value)}
                  className={textControl}
                  placeholder="teammate@example.com"
                />
              </Field>
              <Field label="Role" htmlFor="team-invite-role">
                <span className="relative grid">
                  <select
                    id="team-invite-role"
                    name="inviteRole"
                    value={role}
                    onChange={(event) => setRole(event.currentTarget.value as 'admin' | 'member')}
                    className={selectControl}
                  >
                    <option value="member">Viewer</option>
                    {canInviteAdmins ? <option value="admin">Admin</option> : null}
                  </select>
                  <ChevronUpDownIcon className="pointer-events-none col-start-1 row-start-1 mr-3 size-4 self-center justify-self-end fill-zinc-400" />
                </span>
              </Field>
              <Button
                size="compact"
                variant="secondary"
                type="submit"
                className="w-full sm:w-auto"
                disabled={working || email.trim().length === 0}
              >
                {working ? 'Sending…' : 'Invite'}
              </Button>
            </form>
          ) : null}

          {notice ? <Callout tone="success" title={notice} /> : null}
          {error ? <Callout tone="danger" title={error} /> : null}

          <div>
            <h3 className="text-base font-medium text-zinc-950 sm:text-sm">People with access</h3>
            <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
              {team.members.map((member) => {
                const isCurrent = member.id === team.currentMembershipId
                const canRemove =
                  !isCurrent &&
                  (team.currentRole === 'owner' ||
                    (team.currentRole === 'admin' && member.role === 'member'))
                return (
                  <li key={member.id} className="flex min-w-0 items-center gap-3 py-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-sm font-medium text-zinc-600">
                      {member.email.slice(0, 1).toLocaleUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-base text-zinc-950 sm:text-sm">
                        {member.email}
                        {isCurrent ? <span className="text-zinc-500"> (you)</span> : null}
                      </p>
                      <p className="text-base text-zinc-500 sm:text-sm">{roleLabel(member.role)}</p>
                    </div>
                    {canRemove ? (
                      <Button
                        size="compact"
                        variant="ghost"
                        disabled={working}
                        onClick={() =>
                          setRemoval({ kind: 'member', id: member.id, label: member.email })
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>

          {team.invitations.length > 0 ? (
            <div>
              <h3 className="text-base font-medium text-zinc-950 sm:text-sm">
                Pending invitations
              </h3>
              <ul role="list" className="divide-y divide-zinc-950/5 pt-2">
                {team.invitations.map((invitation) => {
                  const canCancel =
                    team.currentRole === 'owner' ||
                    (team.currentRole === 'admin' && invitation.role === 'member')
                  return (
                    <li key={invitation.id} className="flex min-w-0 items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base text-zinc-950 sm:text-sm">
                          {invitation.email}
                        </p>
                        <p className="text-base text-zinc-500 sm:text-sm">
                          {roleLabel(invitation.role)} · Expires{' '}
                          {new Intl.DateTimeFormat('en-US', {
                            month: 'short',
                            day: 'numeric',
                          }).format(new Date(invitation.expiresAt))}
                        </p>
                      </div>
                      {canCancel ? (
                        <Button
                          size="compact"
                          variant="ghost"
                          disabled={working}
                          onClick={() =>
                            setRemoval({
                              kind: 'invitation',
                              id: invitation.id,
                              label: invitation.email,
                            })
                          }
                        >
                          Cancel
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog
        open={Boolean(removal)}
        onClose={() => setRemoval(null)}
        title={removal?.kind === 'member' ? 'Remove team access?' : 'Cancel invitation?'}
        description={
          removal?.kind === 'member'
            ? `${removal.label} will no longer be able to open this event.`
            : `${removal?.label ?? 'This person'} will not be able to accept this invitation.`
        }
        footer={
          <>
            <Button onClick={() => setRemoval(null)} disabled={working}>
              {removal?.kind === 'member' ? 'Keep access' : 'Keep invitation'}
            </Button>
            <Button variant="danger" onClick={() => void confirmRemoval()} disabled={working}>
              {working
                ? 'Updating…'
                : removal?.kind === 'member'
                  ? 'Remove access'
                  : 'Cancel invite'}
            </Button>
          </>
        }
      />
    </section>
  )
}

export function SettingsView() {
  const { payload, execute, mutating } = useWorkspace()
  const event = payload?.state.events.find((entry) => entry.id === payload.state.activeEventId)
  const [draft, setDraft] = useState<EventSettingsDraft>(emptyDraft)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [teamRole, setTeamRole] = useState<TeamRole | null>(null)

  useEffect(() => {
    if (!event) return
    setDraft(draftFromEvent(event))
    setErrors({})
    setTeamRole(null)
  }, [event])

  const timeZones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles']
    }
  }, [])

  if (!payload || !event) return null
  const savedDraft = draftFromEvent(event)
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedDraft)
  const eventId = event.id
  const eventVersion = event.version ?? 1

  function update<Key extends keyof EventSettingsDraft>(key: Key, value: EventSettingsDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!(key in current)) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault()
    let startsAt: string
    let endsAt: string
    try {
      startsAt = zonedDateTimeInputToIso(draft.startsAt, draft.timezone)
      endsAt = zonedDateTimeInputToIso(draft.endsAt, draft.timezone)
    } catch (error) {
      setErrors({
        startsAt: error instanceof Error ? error.message : 'Enter valid event dates.',
      })
      return
    }
    if (Date.parse(startsAt) >= Date.parse(endsAt)) {
      setErrors({ endsAt: 'Choose a time after the event starts.' })
      return
    }
    const response = await execute(
      'event.update',
      { eventId, ...draft, startsAt, endsAt },
      { expectedVersions: { [eventId]: eventVersion } },
      'Event settings saved.',
    )
    if (!response.ok) setErrors(response.error?.fields ?? {})
  }

  return (
    <div className="flex w-full flex-col gap-8">
      <PageHeader
        title="Event settings"
        actions={
          <Button
            variant="primary"
            type="submit"
            form="event-settings-form"
            disabled={mutating || !dirty || teamRole === 'member'}
          >
            {mutating ? 'Saving…' : 'Save changes'}
          </Button>
        }
      />

      <form
        id="event-settings-form"
        className="flex w-full flex-col gap-8"
        onSubmit={(submitEvent) => void submit(submitEvent)}
      >
        <fieldset disabled={teamRole === 'member'} className="contents">
          <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-details-heading">
            <SectionHeading id="event-details-heading" title="Event details" />
            <div className="grid gap-5 pt-5 sm:grid-cols-2">
              <Field label="Event name" htmlFor="event-name">
                <input
                  id="event-name"
                  name="name"
                  required
                  value={draft.name}
                  onChange={(inputEvent) => update('name', inputEvent.target.value)}
                  className={textControl}
                />
              </Field>
              <Field
                label="Event slug"
                htmlFor="event-slug"
                hint="Lowercase letters, numbers, and hyphens."
              >
                <input
                  id="event-slug"
                  name="slug"
                  required
                  value={draft.slug}
                  aria-invalid={Boolean(errors.slug)}
                  onChange={(inputEvent) => update('slug', inputEvent.target.value)}
                  className={textControl}
                />
                {errors.slug ? <p className="text-sm text-rose-700">{errors.slug}</p> : null}
              </Field>
              <Field label="Venue" htmlFor="event-venue">
                <input
                  id="event-venue"
                  name="venue"
                  required
                  value={draft.venue}
                  onChange={(inputEvent) => update('venue', inputEvent.target.value)}
                  className={textControl}
                />
              </Field>
              <Field label="City" htmlFor="event-city">
                <input
                  id="event-city"
                  name="city"
                  required
                  value={draft.city}
                  onChange={(inputEvent) => update('city', inputEvent.target.value)}
                  className={textControl}
                />
              </Field>
            </div>
          </section>

          <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-dates-heading">
            <SectionHeading
              id="event-dates-heading"
              title="Dates and timezone"
              description="Schedule times and public program dates use this timezone."
            />
            <div className="grid gap-5 pt-5 sm:grid-cols-2">
              <Field label="Starts" htmlFor="event-starts-at">
                <input
                  id="event-starts-at"
                  name="startsAt"
                  type="datetime-local"
                  required
                  value={draft.startsAt}
                  aria-invalid={Boolean(errors.startsAt)}
                  onChange={(inputEvent) => update('startsAt', inputEvent.target.value)}
                  className={textControl}
                />
                {errors.startsAt ? (
                  <p className="text-sm text-rose-700">{errors.startsAt}</p>
                ) : null}
              </Field>
              <Field label="Ends" htmlFor="event-ends-at">
                <input
                  id="event-ends-at"
                  name="endsAt"
                  type="datetime-local"
                  required
                  value={draft.endsAt}
                  aria-invalid={Boolean(errors.endsAt)}
                  onChange={(inputEvent) => update('endsAt', inputEvent.target.value)}
                  className={textControl}
                />
                {errors.endsAt ? <p className="text-sm text-rose-700">{errors.endsAt}</p> : null}
              </Field>
              <Field label="Timezone" htmlFor="event-timezone" width="regular">
                <input
                  id="event-timezone"
                  name="timezone"
                  list="event-timezones"
                  required
                  value={draft.timezone}
                  aria-invalid={Boolean(errors.timezone)}
                  onChange={(inputEvent) => update('timezone', inputEvent.target.value)}
                  className={textControl}
                />
                <datalist id="event-timezones">
                  {timeZones.map((timeZone) => (
                    <option key={timeZone} value={timeZone} />
                  ))}
                </datalist>
                {errors.timezone ? (
                  <p className="text-sm text-rose-700">{errors.timezone}</p>
                ) : null}
              </Field>
            </div>
            <div className="pt-4">
              <Callout tone="info" title="Schedule-safe changes">
                <p>
                  ProgramKit will not save event dates that leave a scheduled session outside them.
                </p>
              </Callout>
            </div>
          </section>

          <section className="mx-auto w-full max-w-4xl" aria-labelledby="event-status-heading">
            <SectionHeading id="event-status-heading" title="Status" />
            <div className="pt-5">
              <Field label="Event status" htmlFor="event-status" width="compact">
                <span className="relative grid">
                  <select
                    id="event-status"
                    name="status"
                    value={draft.status}
                    onChange={(inputEvent) =>
                      update('status', inputEvent.target.value as EventSettingsDraft['status'])
                    }
                    className={selectControl}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="complete">Complete</option>
                  </select>
                  <ChevronUpDownIcon className="pointer-events-none col-start-1 row-start-1 mr-3 size-4 self-center justify-self-end fill-zinc-400" />
                </span>
              </Field>
            </div>
          </section>
        </fieldset>
      </form>

      {isHostedApp() ? <TeamSettings eventId={eventId} onRoleChange={setTeamRole} /> : null}
    </div>
  )
}
