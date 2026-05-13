# Email Provider Pin

SignalHost owns domains now, so direct email delivery should be added after the core owner-assistant loop is stable.

## Current Decision

- Do not build custom email delivery until an email provider is selected and domain DNS is configured.
- Owner daily reports can already deliver through SMS or `OWNER_REPORT_WEBHOOK_URL`.
- Webhook delivery can temporarily connect to Lovable automation, Zapier, Make, Slack, or an email workflow.

## Provider Options To Evaluate

- Resend: simple developer API, good fit for product emails and daily reports.
- Postmark: strong transactional deliverability and templates.
- Lovable built-in email: worth checking first if it supports authenticated domain sending, templates, and server-side secrets cleanly.

## Setup Later

1. Pick provider.
2. Add SPF, DKIM, and DMARC records for `signalhost.ai`.
3. Add provider API key to Render voice service.
4. Add direct email delivery to owner daily reports, staff notifications, and billing/account messages.
