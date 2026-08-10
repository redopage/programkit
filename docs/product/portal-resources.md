# Portal resources and public embeds

ProgramKit exposes two narrow ways to reuse event content without turning the speaker portal into a
general content-management system.

## Speaker resources

`PortalResource` records belong to one event and are either a plain-text guide or a static HTML
card. Staff save them through `portal-resource.save` with expected-version, scope, idempotency, and
audit handling from the shared operation processor. A speaker projection contains only resources
whose status is `published` and whose event matches that participation.

Static HTML cards are intentionally restrictive. The operation accepts headings, paragraphs,
lists, emphasis, quotes, and code without any attributes. Links, images, forms, scripts, styles,
iframes, SVG, and other active or remote content are rejected. The web client then renders the
accepted fragment in an iframe with an empty `sandbox` token set and `no-referrer` policy. It never
uses the fragment in the parent document.

This is a useful briefing-card primitive, not an arbitrary website embed or trusted rich-text
editor.

## Public embed routes

- `/embed/speakers` renders searchable public speaker profiles from the latest immutable schedule
  release.
- `/embed/itinerary` renders that release as a mobile program and lets an attendee save sessions on
  the current device.

Both routes use the public-program HTTP projection. Email addresses, internal notes, tasks,
submissions, delivery records, integration state, and draft schedule records are absent. Itinerary
choices use browser storage only; they do not create server records or imply cross-device sync.

## Production boundary

The reference application proves the data boundary, rendering behavior, keyboard/mobile layout,
and safe static-card contract. Before embedding from a public site, verify the deployed host's
Content Security Policy and framing rules from the actual parent origin. Authentication and tenant
membership also remain host responsibilities.
