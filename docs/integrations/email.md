# Cloudflare email

ProgramKit uses two different Cloudflare email products for two different jobs:

- Cloudflare Email Routing receives human mail for `support@programkit.dev` and forwards it to the
  project owner.
- Cloudflare Email Service sends application mail from the dedicated `mail.programkit.dev`
  subdomain.

The dedicated sending subdomain keeps application reputation and DNS separate from normal human
mail. The automated sender is `notifications@mail.programkit.dev`; replies should use the support
address when a message expects a human response.

## Current hosted configuration

The `app` Wrangler profile defines the only outbound binding:

```json
{
  "name": "EMAIL",
  "allowed_sender_addresses": ["notifications@mail.programkit.dev"],
  "remote": true
}
```

The `demo` profile intentionally has no email binding. An anonymous capability workspace cannot
send external mail. The official sending domain has Cloudflare-managed bounce, SPF, DKIM, and
DMARC records, and a one-time direct delivery test succeeded on 2026-08-09.

The binding is ready, but product notifications are not yet connected to it. `campaign.send`
currently records a `demo-outbox` result and contacts no provider. This distinction is deliberate:
delivery should not happen inside a domain transaction or become a best-effort side effect.

## Hosted app sign-in

`app.programkit.dev` now uses passwordless email sign-in through the same app-only Cloudflare Email
Service binding. The demo host remains anonymous and never receives an outbound mail binding.

The Worker creates a 256-bit, 15-minute, single-use token and stores only its hash. A successful
callback exchanges it for a 30-day HTTP-only, secure, same-site session cookie whose secret is also
stored only as a hash. Requests return the same check-your-email response whether or not an
address already exists. Resends have a 45-second cooldown and an hourly account limit. Callback
URLs come from the configured canonical application origin rather than an untrusted request host.

Cloudflare provides official [magic-link](https://developers.cloudflare.com/email-service/examples/email-sending/magic-link/)
and [signup](https://developers.cloudflare.com/email-service/examples/email-sending/signup-flow/)
examples. Those examples demonstrate delivery, not the complete security boundary. Follow OWASP's
[authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
and [session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
guidance for token handling, enumeration resistance, session rotation, logout, and expiry.

The hosted app sign-in screen, delivery, one-time exchange, session validation, event membership,
event creation, switching, and logout are implemented. Team invitations and participant,
reviewer, public-link, MCP, and file authorization remain incomplete, so the hosted app must not
accept real participant data yet. See
[Identity, events, and storage ownership](../architecture/identity-and-tenancy.md).

## Required delivery path

```text
named operation
      │
      ├── commit domain records and durable outbox entry
      ▼
queue or Durable Object alarm
      │
      ├── render versioned template
      ├── send with an idempotent delivery key
      ├── record provider message ID and attempts
      └── retry or expose a terminal failure
```

The outbox must cover submission confirmations, decision notices, reminders, and calendar invite
delivery. It needs suppression state, retry limits, provider response storage, and an operator view
for failed or delayed mail. Do not mark a communication delivered when it is only queued.

## Self-hosting

A self-hosted installation must use its own sending domain and sender. Do not copy ProgramKit's
official sender into another deployment.

1. Enable Cloudflare Email Sending for a subdomain you control.
2. Let Cloudflare configure or verify the required bounce, SPF, DKIM, and DMARC records.
3. Add a `send_email` binding to your production Wrangler environment.
4. Restrict `allowed_sender_addresses` to the exact application sender.
5. Configure the support or reply-to address separately through Email Routing or another inbox.
6. Run one direct delivery test before enabling product notifications.

Cloudflare's official documentation covers [Email Sending](https://developers.cloudflare.com/email-service/),
[send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/), and
[Email Routing](https://developers.cloudflare.com/email-service/get-started/route-emails/).

## Safety boundary

Outbound mail remains disabled for anonymous demos. The hosted staff sign-in has verified identity,
workspace-scoped event selection, and application resend limits. Edge abuse controls, participant
identity, unsubscribe and suppression handling where applicable, and auditable product-delivery
history are still required before sending to real participants.
