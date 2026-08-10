# Andrew release handoff

Andrew owns DNS, TLS/provider activation, repository visibility, deployment, and public release.
Codex should hand over only after the local integrated branch passes the clean-checkout checklist.
These commands are instructions for Andrew; they are not authorization for Codex to execute them.

## 1. Authenticate the two control planes

GitHub:

```bash
gh auth login --web
gh auth status
```

Cloudflare Wrangler:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler login
pnpm --filter @programkit/app-cloudflare exec wrangler whoami
```

No credential belongs in `.env`, repository files, screenshots, command output attached to the
submission, or the ProgramKit workspace document.

## 2. Verify the release candidate locally

From the final integrated checkout:

```bash
git status --short
git log -1 --oneline
pnpm install --frozen-lockfile
pnpm check
```

Expected: a clean worktree and green tests, lint, formatting, TypeScript/package builds,
Cloudflare Worker/client builds, and plugin validation. Stop if dependency resolution changes the
lockfile or if any generated file is unexpectedly dirty.

## 3. Confirm Cloudflare resources and provider gates

The checked-in app expects the `programkit-assets` R2 bucket and an Email Service binding named
`EMAIL`. Before deployment, onboard `programkit.dev` to Cloudflare Email Service, complete its DNS
verification, and confirm `notifications@programkit.dev` is an allowed sender. Do not bypass or
temporarily weaken sender verification.

Inspect the R2 account first:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler r2 bucket list
```

Create it only if the target account does not already contain it:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler r2 bucket create programkit-assets
```

Deploy the verified commit:

```bash
pnpm deploy
```

The Accelevents adapter is already implemented and remains inert without its Enterprise key. If a
controlled target event is available, add the owner-managed key only to Cloudflare's secret store:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler secret put ACCELEVENTS_API_KEY
```

Do not place the value in `.env`, `wrangler.jsonc`, the workspace state, screenshots, or command
output. Do not activate outbound email or Accelevents merely to make the demo look connected.

For the email smoke test, create a new campaign whose entire audience consists of controlled test
addresses, include the calendar invite, queue that campaign, and retain both its Cloudflare message
ID and the received `.ics`. Do not retry the seeded welcome campaign against real delivery.

For the Accelevents smoke test, stage only a controlled event target. Confirm speaker IDs arrive
before related session IDs; then publish a small changed release and verify known records use update
rather than duplicate create. Retain the ProgramKit batch evidence and matching provider records.
Partial failure must remain visible and retryable.

## 4. Attach DNS and verify TLS

Point the intended `programkit.dev` host to the deployed Worker using Andrew's DNS zone. Wait for a
valid public certificate; do not bypass a browser TLS warning.

The checked-in Worker does not guess an embedding parent and currently emits neither a
`Content-Security-Policy` `frame-ancestors` directive nor `X-Frame-Options`. Before public release,
configure route-aware response headers in the Worker or a Cloudflare Response Header Transform
Rule:

- `/embed/speakers` and `/embed/itinerary` must allow only the exact approved parent origin(s) in
  `frame-ancestors` (plus `'self'` only if same-origin framing is intended);
- all other HTML routes should reject framing with `frame-ancestors 'none'`, unless Andrew has a
  separately documented same-origin requirement; and
- do not apply `X-Frame-Options: DENY` or `SAMEORIGIN` to an embed route that must work from an
  approved cross-origin parent.

`frame-ancestors` cannot be supplied by an HTML `<meta>` tag. Verify the final response header from
both an approved parent and an unapproved origin; the approved embed must render and the unapproved
frame must be blocked. Keep the approved origin out of repository copy until Andrew confirms the
actual public parent.

Verify from outside the Cloudflare dashboard:

```bash
dig +short programkit.dev
curl --fail --show-error https://programkit.dev/api/v1/health
curl --fail --show-error https://programkit.dev/public/agenda.json
curl --fail --show-error --remote-name --remote-header-name \
  https://programkit.dev/public/v1/events/evt_nyc_2026/calendar.ics
```

Then use a signed-out browser to check the operator demo, public CFP, reviewer workspace, speaker
portal, public agenda, speaker gallery, itinerary, private-file ownership, and final host framing
policy. Confirm that unsafe HTML remains rejected.

## 5. Make the repository public

Inspect the exact repository before changing visibility:

```bash
gh repo view redopage/programkit --json nameWithOwner,visibility,url,defaultBranchRef
```

After confirming the target is exactly `redopage/programkit`, Andrew may make it public:

```bash
gh repo edit redopage/programkit --visibility public --accept-visibility-change-consequences
```

Verify signed out that the README, Apache-2.0 license, quick start, docs, and default branch are
readable. Check the full public history for secrets before the visibility change; removing a secret
from the tip does not remove it from history.

## 6. Freeze submission links

Replace the placeholders in `submission-copy.md` with:

- the final TLS-valid product URL;
- the signed-out public repository URL; and
- the final walkthrough URL.

Open each link from a signed-out browser, then copy the final text into the competition form. Save
a screenshot or confirmation receipt after submission. The submission deadline is Wednesday,
August 12, 2026 at 10:00 PM Pacific.
