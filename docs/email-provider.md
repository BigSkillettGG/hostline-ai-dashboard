# Email Provider

SignalHost now has provider-ready direct email delivery for owner reports and staff alerts. The first supported provider is Resend because the API is simple, works well for transactional product email, and keeps the voice service provider-neutral enough to swap later.

## Current Status

- Direct email is optional. The product still works without it.
- Owner daily reports deliver by SMS, email, and/or `OWNER_REPORT_WEBHOOK_URL` depending on contact preferences and configured channels.
- Staff alerts can deliver by SMS, direct email, and/or webhook.
- Webhook delivery can still connect to Lovable automation, Zapier, Make, Slack, or a custom workflow.

## Render Environment Variables

Add these to the Render voice service after DNS is verified with the provider:

```text
EMAIL_PROVIDER=resend
EMAIL_FROM=SignalHost <reports@signalhost.ai>
EMAIL_REPLY_TO=support@signalhost.ai
RESEND_API_KEY=re_...
```

`EMAIL_REPLY_TO` is optional. `EMAIL_PROVIDER` is also optional when `RESEND_API_KEY` is present, but setting it makes the configuration obvious.

## Setup Steps

1. Pick provider.
2. Add SPF, DKIM, and DMARC records for `signalhost.ai`.
3. Verify the sending domain in the provider.
4. Add the Render environment variables above.
5. Redeploy the Render voice service.
6. Open `/health` and confirm `emailDeliveryConfigured: true`.

## Still Later

- Add branded email templates for billing/account events.
- Add inbound email provider parsing when owner email commands move beyond the current authenticated webhook shape.
- Consider Postmark if deliverability or template management becomes the priority.
