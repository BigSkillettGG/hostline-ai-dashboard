# SignalHost Pilot Readiness

Use this when testing a real business number end to end. The goal is not just "the call answered." The goal is:

1. The call reaches OpenAI Realtime through the SignalHost webhook.
2. Supabase saves the call row.
3. Supabase saves the transcript turns.
4. SignalHost writes an interaction insight for reporting.
5. A human can add QA feedback.
6. The next dashboard/reporting view reflects that feedback.

## Before the Test Call

Open `/super/telephony` while signed in as a platform admin.

Set the Location ID field to the live test location. For Olive & Ember, use the current `public.locations.id`.

Click **Check service**.

The important card is **Pilot readiness**. Required checks should pass before judging the call quality:

- Voice backend online
- OpenAI Realtime SIP ready
- Supabase call logging ready
- SignalHost number active

Recommended checks can be finished during the pilot:

- Forwarding verified
- Recording attached
- Feedback loop tested
- Owner delivery channels

## Test Call Script

Call the SignalHost number directly first.

Run one short normal question:

> Do you have any specials tonight?

Then ask one follow-up without hanging up:

> Great. Can I make a reservation for two at 6 tonight?

Then test the close:

> No, that's all.

The call should end naturally after SignalHost says goodbye.

## After the Call

Open `/super/calls`.

Confirm:

- The latest call is present.
- The caller number is present.
- The transcript is present.
- The summary is specific.
- The intent, workflow status, urgency, value tier, and owner-report bucket are populated.

Open the call detail and add one QA note, even if the answer was good. For example:

- Category: `Good answer`
- Note: `Pilot test passed. Reservation follow-up sounded natural.`

Return to `/super/telephony` and click **Check service**.

The **Pilot readiness** card should now show:

- Recent live call logged
- Transcript saved
- Reporting signal created
- Feedback loop tested

## If Something Fails

If no call appears, check Render environment variables:

- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_DEMO_LOCATION_ID`
- `OPENAI_API_KEY`
- `PUBLIC_HTTP_BASE_URL`
- `OPENAI_PROJECT_ID`

If the call appears without transcript turns, inspect Render logs for OpenAI Realtime sideband errors.

If transcript exists but reporting signal is missing, confirm the latest Supabase migration for persisted interaction insight columns has been applied.

If feedback saves but reporting does not change, refresh `/super/calls` and check for errors from `updateCallInteractionInsightInSupabase`.

## Lovable Supabase Migration Prompt

If Lovable is managing Supabase and the pilot card says reporting, workflow status, or phone-number lifecycle fields are missing, paste this into Lovable:

```text
Please apply the pending Supabase migrations from the repository to the connected Lovable Supabase project.

Start with these two migrations because the live pilot needs them:

1. supabase/migrations/20260513112000_phone_number_lifecycle_and_sms_threads.sql
2. supabase/migrations/20260514133000_call_interaction_status.sql

After applying them, verify:

- public.phone_numbers has trial_started_at, trial_ends_at, trial_grace_ends_at, released_at, release_reason, sms_webhook_url, and provisioning_source.
- public.calls has workflow_status, urgency, value_tier, follow_up_needed, knowledge_gap, owner_report_bucket, recommended_action, and tags.
- The Olive & Ember location still exists with id 78d8053b-631d-4811-939f-61f0efe1d82a.
```
