# Deploy to Cloudflare

This guide covers both supported deployment paths. They produce the same `hosted-app` profile and
one-origin architecture.

## Path A: Deploy to Cloudflare button

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/redopage/programkit)

This path needs a Cloudflare account with R2 enabled, but no local checkout, Node.js, pnpm,
Corepack, or terminal. It creates a working `workers.dev` installation first; you can attach your
own domain immediately afterward.

Cloudflare's flow clones the public GitHub mirror, detects the root build and deploy scripts, reads
`wrangler.jsonc`, and provisions the Worker resources it supports. During setup:

1. choose the destination Cloudflare account;
2. choose a Worker and repository name;
3. accept or change the R2 resource name;
4. enter a private `PROGRAMKIT_BOOTSTRAP_TOKEN` of at least 16 characters; and
5. start the build and deployment.

Save the bootstrap token outside the repository. The first owner must enter the same value once.
After the installation is claimed, it cannot be used to claim a second owner.

Cloudflare's deploy button currently accepts public GitHub or GitLab repositories. ProgramKit uses
its GitHub mirror for this flow even though Forge is the primary collaboration host. Release
owners must confirm the mirror is public and the candidate commit is synchronized before treating
the button as available.

### Put the installation on your domain

The domain must already be an active zone in the same Cloudflare account. After the button finishes:

1. open the new Worker in the Cloudflare dashboard;
2. open **Settings → Domains & Routes → Add → Custom Domain**;
3. enter a hostname such as `program.example.com`; and
4. set `PROGRAMKIT_APP_ORIGIN` to the same HTTPS origin under **Settings → Variables and Secrets**.

Cloudflare creates the DNS record and certificate. Re-download `/agent-plugin.zip` after changing
the origin so its MCP URL uses the new hostname. If the domain is not yet on Cloudflare, add the
zone first. The deploy button cannot safely choose an arbitrary domain before Cloudflare knows
which zone and account own it.

## Path B: clone and use the verified CLI

### 1. Clone and install

```bash
git clone https://forge.smol.ai/andheller/programkit.git
cd programkit
npm run setup
```

### 2. Authenticate Wrangler

```bash
npx --yes pnpm@11.20.0 --filter @programkit/app-cloudflare exec wrangler login --use-keyring
```

The keyring flag asks Wrangler to protect its OAuth credential through the operating system's
credential storage. CI can instead provide a narrowly scoped `CLOUDFLARE_API_TOKEN` through its
secret store.

### 3. Provision, deploy, and verify the installation

```bash
npx --yes pnpm@11.20.0 selfhost
```

The walkthrough asks for:

- Cloudflare account, when the login can reach more than one;
- Worker name;
- R2 bucket name; and
- optional custom domain.

It verifies that an unrelated Worker or bucket will not be reused accidentally, creates the bucket
when necessary, builds ProgramKit, deploys the bootstrap secret with the first Worker version, waits
for public health, verifies the plugin download, and writes ignored local installation files under
`.programkit/`.

For a repeatable non-interactive setup:

```bash
npx --yes pnpm@11.20.0 selfhost -- \
  --account "YOUR CLOUDFLARE ACCOUNT" \
  --name my-programkit \
  --bucket my-programkit-assets \
  --domain events.example.com
```

Omit `--domain` to use the generated `workers.dev` address. Account can be the account name or its
32-character ID.

### Inspect before deploying

To review the generated names and configuration before changing Worker traffic, keep the two-step
path:

```bash
npx --yes pnpm@11.20.0 selfhost:setup
# Review .programkit/wrangler.json and .programkit/self-host.json.
npx --yes pnpm@11.20.0 selfhost:deploy
```

`selfhost:deploy` sends the bootstrap secret alongside the code in one Worker deployment. It then
waits for `/healthz`, verifies `/agent-plugin.zip`, prints the public URL and first-owner setup code,
and records the source revision, Worker version, resource names, targets, and verification result in
`.programkit/deployment-receipt.json`. The receipt contains no secret values.

Do not paste that code into an issue, build log, chat room, or committed configuration. Once the
owner claim succeeds, delete any copied version you no longer need. The ignored local copy remains
in `.programkit/bootstrap-token` until the operator removes it.

## One copy-and-paste deployment command

After installation and Wrangler login, a named installation can be provisioned, deployed, and
checked in one command:

```bash
npx --yes pnpm@11.20.0 selfhost -- \
  --name my-programkit \
  --bucket my-programkit-assets
```

## Generated local files

| Path                                  | Purpose                                    | Commit? |
| ------------------------------------- | ------------------------------------------ | ------- |
| `.programkit/wrangler.json`           | Installation-specific Worker configuration | No      |
| `.programkit/self-host.json`          | Selected account and owned resource names  | No      |
| `.programkit/bootstrap-token`         | Private first-owner setup code             | No      |
| `.programkit/deployment-receipt.json` | Version, resources, URL, and smoke result  | No      |

Rerunning `selfhost:setup` reuses the recorded names. Use `--reuse-worker` or `--reuse-bucket` only
when the existing resource is deliberately part of this installation. `--no-provision` generates
configuration for inspection but does not authorize `selfhost:deploy`; rerun normal setup before
deploying.

To keep two test installations in one checkout, set a safe generated-directory name:

```bash
PROGRAMKIT_SELFHOST_DIRECTORY=.programkit-staging pnpm selfhost:setup
PROGRAMKIT_SELFHOST_DIRECTORY=.programkit-staging pnpm selfhost:deploy
```

The value must be `.programkit` or start with `.programkit-` and contain lowercase letters,
numbers, and hyphens.

## Claim the installation

Open the deployed URL and create the first account. The form asks for the private setup code in
addition to the owner's identity and password. The first successful claim initializes the
installation and event; later signups follow the owner's access policy.

Continue with [First owner and access policy](first-owner.md).

## Verify the deployment

In the browser:

1. create and switch between two events;
2. upload an event logo or speaker file and download it again;
3. confirm **Settings → Installation access** is invite-only;
4. create a short-lived read key in **Data & connections**;
5. download `/agent-plugin.zip`; and
6. open a public form and published agenda in a signed-out browser.

From a terminal:

```bash
curl --fail https://YOUR_HOST/api/health
curl --fail --head https://YOUR_HOST/agent-plugin.zip
```

Event data routes require an authenticated browser or event-scoped API key. A `401` on a private
route is correct before credentials are supplied.

## Custom domains

Passing `--domain events.example.com` adds the Worker custom-domain route and sets
`PROGRAMKIT_APP_ORIGIN` to the same HTTPS origin. The hostname must be in a zone the selected
Cloudflare account can manage.

If the origin changes later, update the Worker route and `PROGRAMKIT_APP_ORIGIN`, redeploy, then
re-download the Agent Plugin so its literal MCP URL points to the new origin. API key rotation is
separate; the plugin never contains the secret.

On `workers.dev`, links use the current Worker origin. A custom-domain installation must keep its
route and `PROGRAMKIT_APP_ORIGIN` aligned; the CLI writes both when `--domain` is supplied.

## R2 activation errors

The setup script checks the selected account before creating a bucket. If Cloudflare reports that
R2 is not enabled, open that account's **Storage & databases → R2 → Overview**, activate the R2
subscription, and rerun setup. Do not use `--reuse-bucket` to bypass an account-level activation
failure.

See [Troubleshooting](troubleshooting.md) for collision, account, build, login, and file issues.

## Cloudflare references

- [Deploy to Cloudflare buttons](https://developers.cloudflare.com/workers/platform/deploy-buttons/)
- [Wrangler login and account commands](https://developers.cloudflare.com/workers/wrangler/commands/general/)
- [Activate and get started with R2](https://developers.cloudflare.com/r2/get-started/)
