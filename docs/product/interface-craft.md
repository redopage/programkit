# Interface craft

ProgramKit is judged on whether an organizer would rather use it than pay for the SaaS it replaces.
That is a craft question before it is a feature question. This page is the standard the interface is
held to, and the checklist a change is reviewed against.

## The four qualities

Every interface decision is evaluated against these, in this order:

- **Calm.** Complicated event work should feel manageable. One dominant thing per screen; the rest
  supports it.
- **Capable.** Dense operational tooling without enterprise heaviness. Density is achieved by
  removing structure, not by shrinking type.
- **Fast.** Immediate response, stable layout, minimal waiting. Perceived speed is part of the
  design, not a build-time concern.
- **Cared-for.** Language, edge cases, and motion are finished, not defaulted.

"Modern" and "polished" are not standards. These are.

## Reduce structural noise

- One dominant content edge per screen. Sections align to it rather than nesting new margins.
- Titles are short and usually one line. The page header carries the object, not a sentence about it.
- No eyebrow labels unless they carry information the title cannot.
- No subtitle that restates its title. If the subtitle only rephrases, delete it.
- Related numbers live in one grid with dividers, never one box per number.
- Content inside the workspace panel does not get its own card. Whitespace first, then a divider,
  then a well; a card only for something independently interactive.
- One primary button per screen. Every other action is secondary, ghost, or a text button.

## Design around the current phase

The organizer's progression is
`Configure → Collect → Review → Decide → Prepare speakers → Schedule → Publish`.

Navigation stays module-based, but each screen should answer: where am I, what needs attention now,
what can wait, and what happens after this. Presenting every record and alert at equal prominence is
the failure mode to avoid.

## Dashboards report jobs, not numbers

An overview that says "36 blockers" leaves the triage work to the reader. `nextActions` in
`packages/core/src/selectors.ts` is the canonical projection: it groups outstanding work into jobs
that carry a verb, a size, and a destination, so each row can be acted on directly. New summary
surfaces should extend that selector rather than counting records in a view.

Long tails fold behind a disclosure. Six visible groups is the current cap.

## States are design artifacts, not QA discoveries

Every consequential surface needs its states designed alongside the happy path:

- Submission: draft, submitted, in review, decided.
- Review: pending, assigned, partially reviewed, fully reviewed.
- Schedule: unscheduled, scheduled, conflicting, released.
- Publishing: draft, publishing, published, closing, closed.
- Requests: saving, saved, conflicted, failed.

Shared primitives exist so these look the same everywhere: `EmptyState` (with `tone="settled"` for a
finished queue), `ErrorState` with a local retry, `SkeletonRows`, `StatusBadge`. A filtered list that
can reach zero rows must render an empty state, and that empty state should offer the action that
resolves it.

## Make speed visible

- Show cached data immediately; all operator routes share one workspace query so moving between them
  does not refetch.
- A failure retries in place. Never reset a workflow or lose scroll position to recover one panel.
- First paint shows the workspace silhouette, not a centred spinner, so nothing jumps when data
  lands.
- Optimistic updates are for safe, reversible actions only.

## Radius and elevation

- Compact action groups may use a full pill radius when their neighboring controls share the same
  height and treatment. Search fields, filter tabs, badges, and chips are pills by default. Text
  inputs and textareas keep a generous finite radius so long values still read as fields rather
  than capsules.
- A row of related controls must share a height, label scale, and optical icon padding. Compact
  desktop actions use smaller labels than full-size form controls; mobile actions retain the
  accessible type and touch-target scale.
- Workspace panels and dialogs use the larger shared radius scale. Closely nested surfaces define
  their radius and padding as variables, then subtract the padding for an exactly concentric inner
  edge.
- Translucency belongs to temporary elevated surfaces only. Dark menus, shortcut guides, and toasts
  use a nearly opaque zinc surface with background blur; persistent content panels remain solid.

## Keyboard navigation

The operator workspace has one shared command system. `/` opens global search, `Command-K` on Apple
platforms or `Control-K` elsewhere opens the same command menu, and `?` opens its shortcut guide.
Search matches page names, workflow language, and useful synonyms rather than routes alone. Inside
the command menu, arrow keys move the selection, `Enter` opens it, and `Escape` closes the menu.

The small set of navigation chords follows established web-app conventions and covers only the
highest-frequency operator destinations:

| Shortcut | Destination |
| -------- | ----------- |
| `G O`    | Overview    |
| `G S`    | Submissions |
| `G R`    | Review      |
| `G A`    | Agenda      |
| `G T`    | Tasks       |

Keyboard commands never fire while the user is typing into an input, textarea, select, ARIA textbox,
or editable region. Rich editors can also mark a wrapper with `data-shortcuts-disabled`. Modals trap
and restore focus, `Escape` closes them, and reduced-motion preferences disable their entrance
animation.

## Navigation hierarchy

The sidebar contains the event workflow people use every day. Infrastructure, change review, agent
tools, and public links remain available through the workspace menu and command search without
competing with the core program path. Navigation labels and icons must stay legible at a glance;
color can distinguish workflow families, but never carries meaning by itself.

## Reserve delight for consequential moments

Distinctive motion and language are spent on: publishing the first CFP, the first proposal arriving,
accepting a speaker, a speaker completing readiness, resolving the last schedule conflict, and
publishing the public agenda. Routine filtering and table sorting get none of it.

## What not to borrow

No gradients on every card, no continuous decorative motion, no heavy glass, no custom replacements
for familiar controls, no card around every piece of information, no animation that blocks rapid
operation, and no label explaining obvious UI.

## Review checklist

Before a UI change lands:

1. Does the screen have one dominant edge and one primary action?
2. Did anything gain a card, a border, or a subtitle it did not need?
3. Are empty, loading, and error states present for every list this change can empty?
4. Do new numbers appear in an existing grid rather than a new box?
5. Is the icon set Heroicons Micro, at `size-4`, with `shrink-0`?
6. Does it hold up at 375px and at 1440px, and does the mobile type scale up rather than down?
7. Does `pnpm check` pass?
