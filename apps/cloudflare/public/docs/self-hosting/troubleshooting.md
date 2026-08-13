<!-- Canonical: https://programkit.dev/docs/self-hosting/troubleshooting -->
<!-- Markdown: https://programkit.dev/docs/self-hosting/troubleshooting.md -->

# Self-host troubleshooting

Start with the failure category below. Do not fix an authorization or storage problem by weakening
the trust boundary.

## Wrangler is not logged in

Run:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler whoami
```

If needed:

```bash
pnpm --filter @programkit/app-cloudflare exec wrangler login --use-keyring
```

When the login reaches multiple accounts, pass `--account` to `selfhost:setup` using the exact
account name or ID.

## R2 is not enabled

Open the selected Cloudflare account's **Storage & databases → R2 → Overview**, activate its R2
subscription, and rerun `pnpm selfhost:setup`. R2 activation belongs to the account, not the Worker.

## Worker or bucket already exists

The setup script stops before overwriting an unrelated resource. Choose a new name:

```bash
pnpm selfhost:setup -- --name my-programkit-2 --bucket my-programkit-2-assets
```

Use `--reuse-worker` or `--reuse-bucket` only after confirming that the existing resource belongs to
this installation and its data should be adopted.

## Deploy refuses a no-provision configuration

`--no-provision` is for inspection only. Run normal setup so the account, Worker name, and R2 bucket
checks can pass, then deploy.

## First-owner signup is unavailable

Check that:

- the deployment profile is `hosted-app`;
- `PROGRAMKIT_SIGNUP_MODE` is `bootstrap`;
- `PROGRAMKIT_BOOTSTRAP_TOKEN` exists as a Worker secret and has at least 16 characters; and
- the installation has not already been claimed.

If the installation is already initialized, sign in with an existing owner or accept an event
invitation. Do not rotate the bootstrap secret to manufacture another owner.

## Setup code is rejected

Use the exact value installed during deployment. The CLI copy is
`.programkit/bootstrap-token`. Leading or trailing whitespace is not part of the code. If the
secret was replaced before the first claim, install the intended value and retry; after a
successful claim, the code is no longer a signup mechanism.

## Password works but email does not

Password sign-in is independent of email. Magic links, invitations, confirmations, reminders, and
campaigns require a configured email binding plus `PROGRAMKIT_EMAIL_FROM`. Check
[Cloudflare email](/docs/integrations/email.md).

## Upload says storage is unavailable

Confirm the Worker has a `PROGRAMKIT_FILES` R2 binding to the intended bucket. Check file type and
size limits, event membership, and Worker logs. Browser clients never receive R2 credentials.

If an owner deletion is cleanup-pending, retry cleanup from Files. Do not manually remove random R2
keys; ProgramKit validates event-rooted keys and keeps audit tombstones.

## API returns 401 or 403

- Save the complete copy-once key, not the truncated display value.
- Send `Authorization: Bearer YOUR_KEY` over HTTPS.
- Confirm the key belongs to the event being accessed.
- Check expiry, revocation, and scopes.
- Create a replacement key instead of broadening a key whose owner or usage is unclear.

The [HTTP API guide](/docs/api.md) lists the supported routes and key contract.

## MCP client cannot connect

Confirm the endpoint is `https://YOUR_HOST/mcp`, the key is available to the client as
`PROGRAMKIT_API_KEY`, and the key uses the **Agent operations** preset. For Codex:

```bash
codex mcp add programkit \
  --url https://YOUR_HOST/mcp \
  --bearer-token-env-var PROGRAMKIT_API_KEY
```

If a downloaded plugin still points to an old domain, download it again from the current
installation. See [Connect an agent](/docs/agents/connect.md) and the protocol troubleshooting in
[`@programkit/agent`](https://forge.smol.ai/andheller/programkit/blob/main/packages/agent/README.md).

## Plugin ZIP downloads but will not install

Agent Plugins defines a directory package; ZIP is ProgramKit's transport format. Unzip the archive
and install the contained directory or local marketplace according to the client. MCP-native
clients can skip the plugin and register `/mcp` directly.

## Custom-domain links use the wrong origin

Keep the Worker route and `PROGRAMKIT_APP_ORIGIN` aligned, then redeploy. Re-download the Agent
Plugin after an origin change because `mcp.json` contains a literal absolute URL.

## Build or validation fails

Use the recorded package manager and Node requirement:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

Do not hand-edit generated `routeTree.gen.ts`, `docs/api/openapi.json`, or the embedded plugin source.
Use their generators and rerun the complete check.
