# ProgramKit product evidence

This folder is a standalone, static walkthrough of ProgramKit against the supplied conference
program brief. It can be opened directly or served by any static file server.

```bash
python3 -m http.server 4310 --directory showcase
```

Then open `http://localhost:4310`.

The Mobbin-style screen, flow, and eval evidence library lives at
`http://localhost:4310/appflow.html`. It contains a current route sweep, saved multi-step product
states, and the 98 local evaluator criteria mapped to ProgramKit evidence.

The `screenshots/sessionboard` images are crops from the user-supplied competition Google Doc and
exist only for product comparison. `screenshots/programkit` contains local in-app Browser captures
from the deterministic demo. Test mutations were performed against the local Durable Object and the
demo workspace was reset afterward.

The report is evidence, not the canonical roadmap. Update `ROADMAP.md` when capability status
changes, then update this showcase and recapture the relevant product surfaces.
