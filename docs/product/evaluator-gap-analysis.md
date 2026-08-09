# Competition evaluator gap analysis

This review compares ProgramKit with the complete `killmysaas-evals` repository at commit
`d99935c3e3c6c50c6b9292220260ccfe2df6d6d4`. That evaluator contains 96 rubric items across 20
scenarios: 84 required items worth 178 points and 12 extra-credit items worth 19 points.

This is a capability audit, not a claimed evaluator score. A passing UI, API route, or seed record
still needs scenario evidence before it should be counted.

## Where ProgramKit stands

| Evaluator area             | Current fit          | Working evidence                                                                                                                                       | Largest gaps                                                                                                                         |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Call for papers            | Strong foundation    | Form builder, required fields, conditional visibility, public form, submission, reviewer workspace, scorecard, decisions, accepted proposal conversion | Real submitter accounts, draft resume and editing, category routing, real confirmation and decision email, precise post-close policy |
| Abstract management        | Partial              | Reviewer teams, plans, rounds in the domain, weighted criteria, blind projection, assignments, aggregate review state                                  | Assignment administration, exact and bulk assignment flows, round release, recusal, coauthors, exports, AI-assisted review           |
| Speaker management         | Partial              | Searchable people roster, lifecycle state, profiles, readiness tasks, scoped speaker portal, linked sessions                                           | CSV import, real invites, headshot and file upload, logistics, bulk communication, automated reminders, message history              |
| Content management         | Early                | Asset metadata and requirement concepts exist                                                                                                          | R2 uploads, file constraints, private download, versions, comments, approval gate, deliverables dashboard, files library, bulk ZIP   |
| AI agenda                  | Partial              | Draft placements, conflict detection, room and list views, validated moves, immutable publish, public release                                          | Unscheduled tray, multi-day views, track filters, configurable inventory UI, clear and undo, auto-schedule                           |
| Public program and widgets | Early                | Published public agenda reads only from an immutable release                                                                                           | Session and speaker galleries, detail pages, itinerary, personal calendar, embeds, share links, widget consistency                   |
| CRM extra credit           | Deliberately limited | People records, search, detail, tags in the domain                                                                                                     | Organizations, notes, custom fields, CSV import, merge, kanban, segments, history, bulk email, dashboard                             |

## Important evaluator lesson

The evaluator rewards working data transitions more than screen count. CRUD and round-trip checks
represent about 42 percent of the available evidence weight. Existence checks are about 15 percent.
That means the best next work is not another broad UI pass. It is a smaller number of complete
flows that create, update, persist, reload, authorize, and expose the right result on every relevant
surface.

The expiring `/demo/{capability}` workspace now provides a clean, isolated starting point for
scenario runs and collaborator handoff. It improves test repeatability and safe evaluation, but it
does not count as the real identity, role membership, or per-person authorization required by the
scenarios.

## How the V1 evaluator reaches the product

The V1 evaluator is a browser-only runner with strict same-origin navigation. It does not supply
credentials for any of the 20 scenarios. That creates three practical requirements for the
evaluation deployment:

- organizer, submitter, reviewer, speaker, and attendee surfaces must be reachable from one origin;
- public form and agenda links must keep their event context without relying on another subdomain;
- scenario fixtures and role transitions must be repeatable without asking the evaluator to open an
  email inbox or leave the product.

The hosted app now emits event-specific public CFP and agenda links on `app.programkit.dev`. The
event ID is validated before the public page loads and is exchanged for an HTTP-only routing cookie.
That cookie selects only the event's public projections and does not grant organizer access. The
seven-day demo remains the preferred evaluator target until deterministic role sessions exist.

Airtable, the Cloudflare runtime, API breadth, repository hosting, and performance are not scored by
the V1 browser rubric. They remain useful bonus or product-quality work, but should not displace a
required end-to-end scenario.

## Recommended implementation order

1. **Real identity and evaluator fixtures.** Keep the working staff sign-in, then add team
   invitations plus submitter, reviewer, and speaker sessions. Provide deterministic evaluator role
   sessions that do not require external inbox access.
2. **One complete file pipeline.** Use R2 for bytes and event records for metadata. Reuse it for CFP
   attachments, headshots, slides, and requirement deliverables, including version history and
   private access. Airtable mirroring must remain optional and outside this critical path.
3. **Review administration.** Build reviewer pools, exact and bulk assignment, release by round,
   progress, recusal, and export. Keep the existing scoped scorecard as the reviewer surface.
4. **Scheduling studio depth.** Add the unscheduled tray, multi-day filters, configurable rooms and
   tracks, clear and undo, then one deterministic auto-schedule action with conflict evidence.
5. **Real delivery.** Ship submission confirmation and accepted-speaker reminder first. Include a
   transactional outbox, test send, provider result, history, and an ICS attachment compatible with
   Gmail, Outlook, and Apple Calendar.
6. **Public program suite.** Add session and speaker listings and details, then personal itinerary,
   calendar export, and embeddable views backed by the same published release.
7. **CRM extras last.** Add only the organization and relationship capabilities that improve the
   program workflow after all required areas are dependable.

MCP expansion remains after the human workflow, data, and evaluator surfaces are complete.

## Scenario readiness checklist

Before claiming an evaluator area, its fixtures and tests should prove:

- a clean seeded workspace can reach the required starting state;
- the action can be completed through the intended UI without direct state edits;
- every write persists in the configured authoritative repository and survives a reload;
- optional Airtable failures do not block the recommended Durable Object configuration;
- role-scoped routes hide records and actions the actor must not see;
- deadlines, locked states, conflicts, and invalid transitions fail on the server;
- bulk operations report partial or total failure without silent data loss;
- public pages read only published data and never leak drafts;
- email, calendar, file, and webhook side effects have durable status and safe retry behavior;
- the same result is observable through the relevant API projection; and
- the full flow works at desktop and mobile sizes with keyboard access.

## What not to do

- Do not count a seeded visual state as a completed workflow.
- Do not build the optional CRM before the required content, agenda, and public-program scenarios.
- Do not expose real data through the passwordless demo actors.
- Do not poll Airtable on every navigation. Keep acknowledged writes, signed webhooks, and the
  Durable Object cache.
- Do not add more provider choices until the Cloudflare, Airtable, R2, and email golden path is
  complete and documented.

## Buyer-brief work outside the V1 rubric

The original buyer brief also calls for a one-way Accelevents integration and speaker-portal
resource pages that can include trusted organizer HTML embeds. The V1 evaluator does not currently
score either capability. Track them after the required CFP, review, portal, file, schedule, and
public-program flows are dependable.
