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

## Next Steps

1. Persist `business_contacts` from onboarding into Supabase.
2. Add owner SMS verification before accepting text commands.
3. Let owner assistant commands create temporary live updates.
4. Add an LLM answer layer with the deterministic report as tool/context.
5. Log owner assistant questions and useful missing intents for product tuning.
