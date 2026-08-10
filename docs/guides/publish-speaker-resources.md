# Publish speaker resources

ProgramKit can publish guides, links, and embedded documents into every accepted speaker's portal
for an event. Organizers manage these pages from **Files → Speaker resources**.

## Create a resource

1. Open **Files** and choose **Add resource**.
2. Give the page a clear title and short summary.
3. Add instructions in the page content, an HTTPS link, an embed, or a combination of them.
4. Keep the page as a draft while the team reviews it, then change its status to **Published**.

Only published resources are included in the participant-scoped data projection. Draft and archived
pages are never sent to the speaker portal.

## Safe embeds

The embed field accepts either an HTTPS embed URL or iframe code copied from a trusted provider.
When iframe code is pasted, ProgramKit extracts only its `src` URL. It does not store or render the
organizer's HTML attributes or scripts.

The speaker portal renders the resulting URL in a sandboxed, lazy-loaded iframe with a strict
referrer policy. HTTP URLs are rejected by the core operation, so API clients and agents follow the
same safety rule as the web form.

An embedded provider may require its own sharing or embedding setting. ProgramKit cannot override
the provider's access policy.

## Data and API behavior

Resource pages are event-owned records in the authoritative workspace state. Creating or updating
one uses the named `portal-resource.create` and `portal-resource.update` operations with version
guards and audit events. Full workspace exports include `csv/portal-resource-pages.csv`.

This is intentionally a small wiki surface rather than a general-purpose CMS. Rich text, uploads,
and arbitrary scripts should remain separate capabilities with their own validation and access
rules.
