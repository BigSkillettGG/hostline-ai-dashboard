## Goal
Confirm why the existing call logging/transcript pipeline is not surfacing the last two calls in the dashboard, using the current code and backend as-is.

## What I already verified
- **Dashboard backend URL:** the frontend reads from `VITE_SUPABASE_URL`, currently `https://bzxueegzsxwrcybsrvhh.supabase.co`.
- **Dashboard read paths:**
  - `src/integrations/supabase/client.ts`
  - `src/lib/supabase-rest.ts`
- **Voice persistence code exists already:**
  - `services/voice/src/call-store.ts`
  - `services/voice/src/conversation-relay.ts`
  - `services/voice/src/server.ts`
  - `services/voice/src/notification-service.ts`
- **Inbound call route exists already:** `POST /twilio/voice`
- **Related callback routes exist already:**
  - `POST /twilio/recording-status`
  - `POST /twilio/conversation-ended`
  - WebSocket `/twilio/conversation-relay`
- **Current database state:** all relevant tables exist, but right now the live backend has **0 rows** in `calls`, `transcript_turns`, `call_feedback`, `staff_alert_events`, `orders`, `reservations`, and `phone_numbers`.
- **Phone search in current backend:** no matches for `781-307-2672`, `7813072672`, `+17813072672`, or `17813072672` in the queried tables.
- **Immediate DB error evidence:** no recent Postgres log evidence of RLS failures, permission errors, or inserts failing on those call tables.

## Current hypothesis
The missing calls are most likely caused by **the deployed voice service not writing into this same backend**, or **Twilio not hitting the deployed `/twilio/voice` route**. The code itself already supports persistence.

## Investigation plan
1. **Document the exact persistence map from code**
   - Calls/transcripts/recordings:
     - `createCallStore()` in `services/voice/src/call-store.ts`
     - `startCall`, `addTranscriptTurn`, `completeCall`, `attachCallRecording`
   - Call-triggered downstream writes:
     - `createStaffReviewOrder`, `createStaffReviewReservation`, `createStaffTask`
   - Dashboard-only feedback writes:
     - `createCallFeedbackInSupabase()` in `src/lib/supabase-rest.ts`

2. **Answer the write/read target question precisely**
   - **Dashboard reads from:** `https://bzxueegzsxwrcybsrvhh.supabase.co`
   - **Voice service code is designed to write to:** `env.SUPABASE_URL` using `env.SUPABASE_SECRET_KEY`
   - Determine whether the **deployed** voice runtime is actually using that same URL, or whether it is pointing somewhere else / missing env entirely.

3. **Verify the exact tables and columns the existing pipeline writes**
   - `calls`: `caller_name`, `caller_phone`, `external_call_sid`, `external_session_id`, `location_id`, `started_at`, `status`, `twilio_payload`, plus later `duration_seconds`, `intent`, `outcome`, `confidence`, `summary`, `recording_url`
   - `transcript_turns`: `call_id`, `offset_seconds`, `speaker`, `text`
   - `staff_alert_events`: `call_id`, `caller_phone`, `kind`, `severity`, `status`, `summary`, `message`, `location_id`, `recipients`, `channels`, `route_snapshot`, `error_message`, `sent_at`
   - `staff_tasks`: `call_id`, `location_id`, `title`, `body`, `status`, `task_type`, `priority`, `due_at`
   - `orders`, `order_items`, `order_delivery_attempts`
   - `reservations`
   - `call_feedback` is written by the dashboard, not by the voice call runtime

4. **Confirm schema alignment in the current backend**
   - Check that all write-target tables and required columns above exist in the current database
   - Confirm whether any required data such as `location_id` would be missing at runtime

5. **Verify failure mode instead of guessing**
   - Check whether the voice service would fall back to **`NoopCallStore`** if any of these are missing:
     - `SUPABASE_URL`
     - `SUPABASE_SECRET_KEY`
     - `SUPABASE_DEMO_LOCATION_ID`
   - If so, the runtime would accept calls but persist nothing
   - Cross-check for evidence of RLS/service-role/schema failures versus “not writing at all”

6. **Verify webhook expectations end-to-end**
   - Expected inbound route: `POST /twilio/voice?locationId=<location-id>`
   - Expected Twilio continuation flow:
     ```text
     Twilio number
       -> POST /twilio/voice
       -> TwiML with ConversationRelay websocket
       -> /twilio/conversation-relay
       -> transcript + call persistence
       -> /twilio/conversation-ended
       -> /twilio/recording-status
     ```
   - Confirm whether the provisioned phone number/webhook is expected to hit that route

7. **Check deployed runtime configuration, not just repo code**
   - Inspect the live voice service health/config endpoints to determine whether it is actually configured for backend writes
   - Compare its live backend target with the dashboard backend target
   - If the live voice service URL is unavailable or unset, identify that as the blocker

## Technical details
- **Key files / functions already identified**
  - `services/voice/src/call-store.ts`
    - `createCallStore`
    - `startCall`
    - `startRealtimeCall`
    - `addTranscriptTurn`
    - `attachCallRecording`
    - `completeCall`
    - `createStaffReviewOrder`
    - `createStaffReviewReservation`
    - `createStaffTask`
  - `services/voice/src/conversation-relay.ts`
    - `persistCallerTurn`
    - `persistAgentTurn`
    - `completeSessionCall`
    - `maybeAdvanceStaffReviewOrder`
    - `maybeCreateStaffReviewReservation`
    - `maybeCreateStaffFollowUpTask`
  - `services/voice/src/server.ts`
    - `/twilio/voice`
    - `/twilio/recording-status`
    - `/twilio/conversation-ended`
  - `src/lib/supabase-rest.ts`
    - `fetchCallsFromSupabase`
    - `fetchCallFeedbackFromSupabase`
    - `createCallFeedbackInSupabase`

## Expected outcome
A definitive answer on whether the issue is:
- live voice service env mismatch,
- missing `SUPABASE_DEMO_LOCATION_ID`,
- Twilio webhook misrouting,
- or a real insert failure.

If you approve, I’ll use the live service/backend checks next to prove which of those is happening.