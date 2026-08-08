# Scheduling constraints

Hard conflicts:

- One room hosting overlapping sessions
- One participant assigned to overlapping sessions
- Placement outside the event boundary
- Missing room, session, track, or participant record
- Session duration does not match its allocated window
- A cancelled session still placed on the schedule

Warnings:

- Expected attendance above room capacity

`validate_schedule` deterministically reports the items above. The current MCP surface does not
model travel time between rooms, participant availability windows, accessibility constraints, or
late-change policy. Label those checks `NOT VERIFIED` when they matter; never infer them from
descriptions or notes.

Prefer no move, then a same-room time change, then a room change, then a cross-day move. Preserve
keynotes and workshop duration before optimizing capacity.
