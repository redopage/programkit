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

## 3. Confirm Cloudflare resources and deploy

The checked-in app expects the `programkit-assets` R2 bucket. Inspect first:

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

Do not activate outbound email or Accelevents credentials merely to make the demo look connected.
If those provider boundaries are activated, store secrets in Cloudflare, preserve the durable
outbox-first contract, and retain one provider-confirmed smoke-test receipt.

## 4. Attach DNS and verify TLS

Point the intended `programkit.dev` host to the deployed Worker using Andrew's DNS zone. Wait for a
valid public certificate; do not bypass a browser TLS warning.

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
