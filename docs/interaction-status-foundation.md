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

The dashboard derives these signals from existing call fields, transcript text, call summaries, escalation state, linked orders/reservations, and review feedback. This avoids breaking the live Supabase database while we are still moving fast.

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

Next migration step: add those columns to the live Lovable Supabase database, then update the voice service to write the derived insight at call completion and update it when owner feedback is saved.
