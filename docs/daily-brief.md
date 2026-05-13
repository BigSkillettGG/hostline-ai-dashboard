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

The Dashboard `Save report` button calls this endpoint. This is the foundation for a scheduled daily email/SMS digest.

## Next Step

Add a scheduled worker that calls the same report service near each location's closing time, then sends the saved report to owner contacts by email or SMS.
