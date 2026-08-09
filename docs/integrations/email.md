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

Outbound mail must remain disabled for anonymous demos. A real application must add verified
identity, workspace-scoped authorization, rate limits, abuse controls, unsubscribe and suppression
handling where applicable, and auditable delivery history before sending to real participants.
