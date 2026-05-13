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

The dashboard generates the brief client-side from already-loaded data. This keeps it safe while we iterate.

## Next Step

Move brief generation into the voice/backend service so SignalHost can send daily email/SMS digests and answer owner questions like, "What happened today?"
