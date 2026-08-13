<!-- Canonical: https://programkit.dev/docs/integrations/email -->
<!-- Markdown: https://programkit.dev/docs/integrations/email.md -->

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

Product notifications are connected to the binding through the event Durable Object. Submission
confirmations, decisions, reviewer reminders, portal invitations, approved campaigns, and
automatic task reminders create one resolved outbox record per recipient as part of the domain
operation. The object alarm drains queued messages after the transaction, records each attempt and
provider message ID, and retries failures after 1, 5, 30, and 120 minutes up to five attempts.

Calendar-invite campaigns resolve each recipient against the latest published schedule before the
campaign enters the outbox. A scheduled speaker receives one personalized `.ics` attachment with
their confirmed sessions, times, and rooms. The attachment is stored with the outbox record so a
later schedule edit cannot silently change an already approved delivery. Cloudflare Email Service
sends it as `text/calendar`, which can be imported by Google Calendar, Outlook, and Apple Calendar.

The operator can search and filter the exact recipient, subject, body, trigger, queued or sent time,
attempt count, provider ID, and last delivery error in Communications. A draft, submitted, or
approved campaign can be cancelled before it creates outbox messages. An individual queued or
retrying message can also be cancelled before provider acceptance. Workspace exports include the
same records in `csv/outbound-messages.csv`. A message is marked `sent` only after Cloudflare Email
accepts it. The anonymous demo has no outbound binding, so its messages remain safe, inspectable
outbox examples instead of contacting real recipients.

Event-scoped email suppressions stop every queued or retrying message to the normalized address and
block future messages before they enter the delivery queue. Organizers can inspect and remove a
suppression in Communications; removal permits future messages but never restarts already stopped
ones. Suppression records are auditable domain state and are included in
`csv/email-suppressions.csv`.

Automatic speaker-task reminders are enabled by default when an organizer creates a task. The
scheduler considers four windows: seven days before, two days before, when due, and one day
overdue. It sends only the latest newly reached window, skips complete, waived, declined, and
withdrawn assignments, and uses the durable trigger key to avoid queueing the same reminder twice.

## Hosted app sign-in

`app.programkit.dev` offers passwordless email sign-in through the same app-only Cloudflare Email
Service binding alongside email and password. The demo host remains anonymous and never receives
an outbound mail binding. A self-hosted deployment can therefore start without an email provider,
while a configured deployment can offer the lower-friction email-link path.

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

The hosted app sign-in screen, password derivation, email delivery, one-time exchange, session
validation, event membership, team invitations, event creation, switching, and logout are
implemented. Public participants can create a separate event-scoped password account and recover
matching submission, reviewer, and speaker capabilities by normalized email. Authenticated
password changes and other-session revocation are implemented; account recovery and optional MFA
remain. See
[Identity, events, and storage ownership](/docs/architecture/identity-and-tenancy.md).

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

The outbox covers submission confirmations, decision notices, invitations, reminders, approved
campaigns, and personalized calendar attachments. Manual suppression and pre-provider cancellation
are enforced by the same durable state transition used by the UI and API. Recipient self-service
unsubscribe, provider bounce/complaint ingestion, a dead-letter action, and provider-level
idempotency across a crash immediately after provider acceptance remain before using bulk mail for
a production event.

## Self-hosting

A self-hosted installation must use its own sending domain and sender. Do not copy ProgramKit's
official sender into another deployment.

1. Enable Cloudflare Email Sending for a subdomain you control.
2. Let Cloudflare configure or verify the required bounce, SPF, DKIM, and DMARC records.
3. Add a `send_email` binding to your production Wrangler environment.
4. Restrict `allowed_sender_addresses` to the exact application sender.
5. For a custom domain, set `PROGRAMKIT_APP_ORIGIN` to the installation's exact public HTTPS
   origin. A `workers.dev` installation uses its current request origin automatically.
6. Configure the support or reply-to address separately through Email Routing or another inbox.
7. Run one direct delivery test before enabling product notifications and team invitations.

Cloudflare's official documentation covers [Email Sending](https://developers.cloudflare.com/email-service/),
[send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/), and
[Email Routing](https://developers.cloudflare.com/email-service/get-started/route-emails/).

## Safety boundary

Outbound mail remains disabled for anonymous demos. The hosted staff sign-in has verified identity,
workspace-scoped event selection, application resend limits, auditable product-delivery history,
manual suppression, and safe pre-provider cancellation. Event-scoped participant accounts are
implemented; stronger reviewer and speaker invitation lifecycle, edge abuse controls, self-service
unsubscribe, provider bounce/complaint ingestion, and a final live-inbox acceptance run are still
required before sending to a real event.
