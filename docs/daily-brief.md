# Daily Narrative Brief

The daily brief is the first owner-facing assistant layer. It turns SignalHost activity into a short, human report instead of asking owners to interpret raw dashboards.

## Inputs

- Calls and website chats from the last 24 hours.
- Orders captured in the last 24 hours.
- Reservation requests created in the last 24 hours.
- Active staff tasks.
- Derived interaction-status signals: urgency, value tier, knowledge gaps, follow-up need, and owner report bucket.

## Output

- A headline: the most important thing the owner should know.
- A plain-English owner message.
- Key metrics: calls, chats, orders, reservations, open follow-ups, high-value opportunities.
- Needs-attention list.
- Suggested knowledge or website updates.
- Copy-ready text for email, SMS, or an owner-assistant chat response.

## Current Scope

The dashboard generates the brief client-side from already-loaded data for fast display. The voice service can also generate the same daily report server-side through `POST /owner-reports/daily`.

Server-side generation:

- Reads the location, calls, orders, reservations, and staff tasks from Supabase.
- Builds the same narrative brief used by the dashboard.
- Upserts the result into `owner_reports` for the current business day in the location timezone.
- Returns the generated report so the dashboard can confirm it was saved.

The Dashboard `Save report` button calls this endpoint. The Dashboard `Send report` button calls `POST /owner-reports/daily/deliver`, which generates the report, looks for owner/manager recipients in `business_contacts`, falls back to onboarding owner contact fields, and delivers through configured SMS/webhook channels.

Delivery channels:

- SMS: requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_SMS_FROM_NUMBER`.
- Webhook: optional `OWNER_REPORT_WEBHOOK_URL`, useful for Zapier, Make, Slack, email automation, or a later internal email worker.
- Email: contacts are recognized, but direct email is intentionally skipped until a real email provider is added.

## Next Step

Add a scheduled worker, such as a Render Cron Job, that calls `POST /owner-reports/daily/deliver` near each location's closing time with the internal API key header. Then add a direct email provider such as Resend or Postmark.
