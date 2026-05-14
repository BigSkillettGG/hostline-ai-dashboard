# Interaction Status Foundation

SignalHost now derives operational status for every call or chat before the owner assistant and daily brief layers are built.

## Derived Signals

- `workflowStatus`: new, resolved, needs follow-up, needs review, waiting on customer, link sent, quote requested, escalated, or vendor/spam.
- `urgency`: low, normal, high, or urgent.
- `valueTier`: low, medium, high, very high, or risk.
- `followUpNeeded`: true when staff or owner action is likely needed.
- `knowledgeGap`: true when the answer was low confidence, unknown, corrected, or should be reviewed.
- `ownerReportBucket`: the future daily-report grouping.
- `recommendedAction`: the plain-English next step for the business.
- `tags`: compact labels used by filters, reports, and future follow-up queues.

## Current Behavior

The dashboard derives these signals from existing call fields, transcript text, call summaries, escalation state, linked orders/reservations, and review feedback. Live calls now also persist the same core fields at completion so owner reports, filters, and follow-up queues can query them directly.

## Persistence Path

The baseline Supabase schema now includes matching `calls` columns:

- `workflow_status`
- `urgency`
- `value_tier`
- `follow_up_needed`
- `knowledge_gap`
- `owner_report_bucket`
- `recommended_action`
- `tags`

The live migration adds those columns to Lovable Supabase. The voice service writes the persisted insight when calls complete and when it creates order, reservation, or customer-request records. Owner feedback can continue to re-derive the dashboard view until a later slice writes feedback-driven recalculations back to Supabase.
