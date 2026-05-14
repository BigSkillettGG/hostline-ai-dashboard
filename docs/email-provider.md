# Email Provider

SignalHost now has provider-ready direct email delivery for owner reports and staff alerts, plus Resend inbound email routing for trusted owner commands. The first supported provider is Resend because the API is simple, works well for transactional product email, and gives us signed inbound webhooks.

## Current Status

- Direct email is optional. The product still works without it.
- Owner daily reports deliver by SMS, email, and/or `OWNER_REPORT_WEBHOOK_URL` depending on contact preferences and configured channels.
- Staff alerts can deliver by SMS, direct email, and/or webhook.
- Trusted owner/manager emails can route into `/resend/inbound-email`, then into the shared owner-command runtime.
- Each launched business gets a generated SignalHost email alias such as `ava-olive-and-ember+<location-id>@agents.signalhost.ai`. The readable prefix is for humans; the plus-addressed location id lets one webhook route commands to the right business without creating separate inboxes.
- Webhook delivery can still connect to Lovable automation, Zapier, Make, Slack, or a custom workflow.

## Render Environment Variables

Add these to the Render voice service after DNS is verified with the provider:

```text
EMAIL_PROVIDER=resend
EMAIL_FROM=SignalHost <reports@signalhost.ai>
EMAIL_REPLY_TO=support@signalhost.ai
OWNER_EMAIL_INBOUND_ADDRESS=updates@agents.signalhost.ai
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
```

`EMAIL_REPLY_TO` is optional for outbound reports/alerts. `OWNER_EMAIL_INBOUND_ADDRESS` is a fallback reply-to for bot replies; when a message arrives at a specific agent alias, SignalHost replies to that same alias so the owner can continue the thread with the named agent. `EMAIL_PROVIDER` is also optional when `RESEND_API_KEY` is present, but setting it makes the configuration obvious.

## Outbound Setup Steps

1. Pick provider.
2. Add SPF, DKIM, and DMARC records for `signalhost.ai`.
3. Verify the sending domain in the provider.
4. Add the Render environment variables above.
5. Redeploy the Render voice service.
6. Open `/health` and confirm `emailDeliveryConfigured: true`.

## Inbound Owner Email Setup

Do not enable receiving on the root `signalhost.ai` domain because Gmail/Google Workspace handles human inboxes there. Use a separate subdomain for the agents, such as `agents.signalhost.ai`.

1. In Resend, add `agents.signalhost.ai` as a receiving domain.
2. Add only the DNS records Resend gives for that subdomain.
3. Create an inbound route/webhook for received email.
4. Set the webhook URL to:

```text
https://hostline-voice.onrender.com/resend/inbound-email
```

5. Subscribe it to the `email.received` event.
6. Copy the webhook signing secret into Render as `RESEND_WEBHOOK_SECRET`.
7. Set `OWNER_EMAIL_INBOUND_ADDRESS` to a fallback address on the same receiving subdomain:

```text
updates@agents.signalhost.ai
```

8. Redeploy the Render voice service.
9. Open `/health` and confirm:

```text
resendInboundEmailConfigured: true
resendInboundEmailVerificationConfigured: true
```

Inbound owner emails only run commands when the sender matches a trusted `business_contacts.email` with owner-assistant permissions enabled. The launch center generates the per-business address from the selected SignalHost name, business name, and live `locations.id`.

## Still Later

- Add branded email templates for billing/account events.
- Consider Postmark if deliverability or template management becomes the priority.
