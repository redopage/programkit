# First owner and organizer signup

A new self-host must establish one installation owner without leaving an unrestricted race for the
first account. ProgramKit uses a private bootstrap secret for that one-time claim.

## How the claim works

1. The deploy path installs `PROGRAMKIT_BOOTSTRAP_TOKEN` as a Worker secret.
2. The first signup form asks for the same setup code.
3. The Worker compares derived values without forwarding the raw secret into account storage.
4. A successful request reserves and completes the first owner.
5. The installation records that it is initialized and rejects another owner bootstrap.
6. Organizer signup returns to invite-only unless the owner explicitly changes it.

The setup code does not become a normal login credential. Owners sign in with their password or a
configured magic link after the claim.

## Deploy-button setup code

When using Deploy to Cloudflare, choose a long random value for `PROGRAMKIT_BOOTSTRAP_TOKEN`, save
it temporarily in a password manager, and enter the same value on the first account form.

You can generate one locally with:

```bash
openssl rand -base64 24
```

## CLI setup code

`pnpm selfhost` creates a 32-character random code in the ignored
`.programkit/bootstrap-token` file, sends it with the first Worker deployment, and prints it after
the public smoke checks pass. The two-step `selfhost:setup` and `selfhost:deploy` path provides the
same behavior when an operator wants to inspect the generated configuration first.

## Choose the organizer signup policy

After signing in as the owner, open **Settings → Installation access**.

### Invite-only

Recommended for private or internal self-hosts. An existing owner or administrator invites people
to an event, and the invitation establishes only that event's role.

### Open organizer signup

Anyone with the installation URL can create an organizer account, organization, and first event.
Use this only when the installation is intentionally a public SaaS service and the operator has
added the abuse protection, terms, support, monitoring, and lifecycle controls that public signup
requires.

Open organizer signup does not expose other events. Event membership and storage remain isolated.

## Team invitations

Event owners can invite administrators or viewers. Administrators can invite and remove viewers.
An invitation:

- is bound to one normalized email;
- targets one event and organization;
- expires after seven days;
- works once; and
- stores only the token hash.

Team invitation delivery requires email configuration. Until email is configured, operate the
installation with the owner account; ProgramKit does not return raw invitation secrets for manual
sharing. Do not expose invitation secrets through logs or add a bypass around the email-bound
acceptance flow.

## Owner safety checklist

- Use a unique owner password and keep the owner account personal.
- Leave organizer signup invite-only unless public SaaS signup is intentional.
- Add separate administrator and viewer accounts instead of sharing credentials.
- Review active account sessions in Settings.
- Revoke departed members and unused API keys promptly.
- Store deployment secrets in Cloudflare or a secrets manager, never event records.
- Document an ownership-transfer and account-recovery procedure before the installation becomes
  business-critical; automated flows are not yet complete.

The full account and membership model is in
[Identity, events, and storage ownership](../architecture/identity-and-tenancy.md).
