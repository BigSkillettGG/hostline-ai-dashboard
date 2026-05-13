# Owner Assistant

This slice starts the "SignalHost feels like an employee" layer.

## Owner Identity

The onboarding interview now captures:

- Owner or manager name
- Owner mobile phone
- Owner email

Those fields are the trusted identity foundation for:

- Daily reports
- Urgent escalation alerts
- Future owner SMS commands
- Owner-approved knowledge suggestions from rough calls
- Future owner-approved follow-up
- Future temporary knowledge updates by text

The baseline schema now includes `business_contacts` so the live database can store owner, manager, front desk, and billing contacts outside the onboarding draft.

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

The first version uses deterministic business logic over calls, orders, reservations, staff tasks, interaction insight, and the daily brief. That keeps answers fast and grounded before adding an LLM layer for broader natural language.

## Live Update Commands

The dashboard assistant can now also act on simple owner instructions:

- "Tonight's special is lobster ravioli"
- "We're closed tomorrow for a private event"
- "We're running 20 minutes behind"
- "Sarah is out sick today"
- "Set busy mode"
- "Set emergency mode"

Those commands create the same temporary live updates and business modes shown on the Knowledge Base page. When Supabase live-update tables are migrated, the assistant saves them to Supabase so the voice and website-chat runtime can use them. Local browser storage remains the preview fallback.

## Next Steps

1. Persist `business_contacts` from onboarding into Supabase.
2. Add owner SMS verification before accepting text commands.
3. Add owner SMS commands on top of the now-shared live-update parser.
4. Add an LLM answer layer with the deterministic report as tool/context.
5. Expand the learning loop so owner answers can respond back to waiting customers, not just train future calls.
6. Log owner assistant questions and useful missing intents for product tuning.
