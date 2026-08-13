# Roles and access

ProgramKit separates installation policy, event-team membership, participant identity, and public
event routing. These are different controls and should not be treated as one global role list.

## Installation owner

The first account that successfully supplies the private setup code claims a self-hosted
installation. That account becomes the owner of its first event and can choose the organizer
signup policy in **Settings → Installation access**.

After the claim, the default self-host policy is **Invite-only**. The owner can switch to **Open
organizer signup** when anyone with the installation URL should be able to create an organization
and first event.

Open organizer signup does not make event data public. Every event still has separate membership.

## Event team roles

| Role          | Typical capability                                                         |
| ------------- | -------------------------------------------------------------------------- |
| Owner         | Full event control, team policy, API keys, and owner-only destructive work |
| Administrator | Operate the event and manage viewers within server-enforced policy         |
| Viewer        | Read the organizer workspace without mutation capability                   |

Invitation tokens are bound to one email, expire, work once, and create membership only for the
target event. Removing a member takes effect against the authoritative event access object even if
an account switcher or cookie is stale.

## Organizer accounts

Organizer accounts can use passwords. A configured email binding also enables magic-link sign-in
and transactional delivery. Password changes happen from Settings and revoke every other account
session plus pending sign-in links while keeping the current browser signed in.

Account recovery, ownership transfer, and deployment-specific MFA or external OIDC remain
production-hardening work. Review [Security](../../SECURITY.md) before relying on the installation
for sensitive data.

## Participant accounts

Participant accounts are event-scoped and use a separate credential and session namespace. They
can recover matching submissions, reviews, and speaker portals but never receive staff membership.

## Scoped links and public routes

- CFP and agenda links expose only public event projections.
- Reviewer and speaker links are record-scoped.
- A public event routing cookie selects the event for public projections; it is not staff
  authentication.
- API keys are event-scoped server-to-server credentials with explicit scopes, expiry, last-used
  state, and revocation.
- MCP resolves the owner session or API key before selecting an event workspace.

## Recommended self-host policy

1. Keep organizer signup invite-only.
2. Create named accounts for each operator; do not share the owner password.
3. Use the viewer role for stakeholders who only need visibility.
4. Create one short-lived API key per external client.
5. Review account sessions and event membership regularly.
6. Revoke access immediately when a person or integration leaves the event.

The canonical implementation boundary is documented in
[Identity, events, and storage ownership](../architecture/identity-and-tenancy.md).
