# Owner Assistant

This layer makes SignalHost feel more like a front-desk employee that the owner can brief, question, and correct.

## Owner Identity

The onboarding interview now captures:

- Owner or manager name
- Owner mobile phone
- Owner email

Those fields are the trusted identity foundation for:

- Daily reports
- Urgent escalation alerts
- Owner dashboard, phone, SMS, and email commands
- Owner-approved knowledge suggestions from rough calls
- Owner-approved follow-up
- Temporary live updates and permanent knowledge updates

The live schema includes `business_contacts` so each business can store owner, manager, front desk, and billing contacts outside the onboarding draft. Contact permissions control whether a person can use owner assistant commands, receive alerts, add temporary updates, approve permanent knowledge, resolve customer requests, or manage alert preferences.

## Dashboard Assistant

The new `/app/assistant` page lets an owner ask operational questions such as:

- What happened today?
- Any urgent calls?
- What needs follow-up?
- Any high-value opportunities?
- What questions did you not know?
- Any complaints?
- How many orders came in?
- How many reservation requests?

The first version uses deterministic business logic over calls, orders, reservations, staff tasks, interaction insight, and the daily brief. That keeps answers fast and grounded.

## Live Update Commands

The dashboard assistant can now also act on simple owner instructions:

- "Tonight's special is lobster ravioli"
- "We're closed tomorrow for a private event"
- "We're running 20 minutes behind"
- "Sarah is out sick today"
- "Set busy mode"
- "Set emergency mode"

Those commands create the same temporary live updates and business modes shown on the Knowledge Base page. When Supabase live-update tables are migrated, the assistant saves them to Supabase so the voice and website-chat runtime can use them. Local browser storage remains the preview fallback.

## Owner Command Channels

The shared owner command router is used by:

- Dashboard chat on `/app/assistant`
- Trusted owner or manager phone calls recognized by caller ID
- Trusted owner or manager SMS messages sent to the SignalHost SMS webhook
- Trusted owner or manager email messages sent through the provider-neutral `/owner/email-command` endpoint

Every channel runs through the same permission checks. Temporary live updates can be applied immediately for contacts with permission. Permanent knowledge can require owner approval depending on the contact's role and `requires_owner_approval` flag.

## Activity And Audit

Owner commands and SignalHost replies are written to `message_events` with `location_id`, channel provider, direction, status, and raw metadata. The Owner Assistant shows recent dashboard, phone, SMS, and email activity for the active location.

## Remaining Later Work

1. Add direct email delivery once a production email provider is selected.
2. Expand the learning loop so owner answers can respond back to waiting customers, not just train future calls.
3. Add richer owner-command analytics, such as common update types and command success rates.
