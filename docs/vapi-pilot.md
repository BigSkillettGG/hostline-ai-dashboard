# Vapi Pilot

Status: controlled demo rollout.

Vapi is now the preferred path for the next demo-call tests because early Vapi calls were much better on handset and speakerphone than the previous direct-SIP and LiveKit attempts. Keep rollout controlled and reversible: create or attach Vapi numbers, sync assistants from SignalHost, and keep SignalHost as the source of business knowledge, tools, transcripts, recordings, and owner workflows.

## Why We Are Testing It

Vapi helps us use a managed voice-agent orchestration layer while keeping the SignalHost product brain and operating system:

- phone/SIP orchestration
- interruptions and endpointing
- observability
- simulations
- server-hosted tool calls
- call transcripts and end-of-call reports

The pilot still uses SignalHost business context, SignalHost tools, SignalHost call logging, and SignalHost owner workflows.

## First Test Business

Use Harbor Plumbing for the first Vapi pilot.

```text
Business: Harbor Plumbing
Location ID: 22222222-2222-4222-8222-222222222222
Current SignalHost number: +1 781 694 6083
Vapi webhook URL: https://hostline-voice.onrender.com/vapi/webhook?locationId=22222222-2222-4222-8222-222222222222
Greeting: Thank you for calling Harbor Plumbing. How can I help you?
```

Use a new Vapi test number first for any new demo. After it passes, the Vapi number can become the demo account's primary AI number.

Generate the exact setup values with:

```powershell
node scripts\setup-vapi-demo.mjs --business=harbor
```

## Render Variables

Add these to the existing `hostline-voice` Render service only when we are ready to test Vapi:

```text
VAPI_API_KEY=your_vapi_private_key
VAPI_WEBHOOK_SECRET=make_up_a_long_random_secret
VAPI_PILOT_ENABLED=true
VAPI_PILOT_LOCATION_IDS=22222222-2222-4222-8222-222222222222
VAPI_OPENAI_MODEL=gpt-5.2-chat-latest
VAPI_VOICE_PROVIDER=vapi
VAPI_VOICE_ID=Elliot
```

Optional:

```text
VAPI_API_BASE_URL=https://api.vapi.ai
VAPI_MAX_CALL_SECONDS=600
VAPI_PILOT_ASSISTANT_ID=asst_...
VAPI_PILOT_PHONE_NUMBER_ID=pn_...
```

Do not remove or change the existing OpenAI Realtime SIP variables.

## SignalHost Endpoints

Admin preview:

```text
GET https://hostline-voice.onrender.com/vapi/pilot-config?locationId=<location_uuid>
```

Webhook URL to paste into Vapi:

```text
https://hostline-voice.onrender.com/vapi/webhook?locationId=<location_uuid>
```

Assistant sync endpoint, if we want SignalHost to create/update the Vapi assistant:

```text
POST https://hostline-voice.onrender.com/vapi/sync-assistant
```

Body:

```json
{
  "locationId": "<location_uuid>",
  "assistantId": "optional_existing_vapi_assistant_id"
}
```

Phone-number sync endpoint, if we want SignalHost to create/update the Vapi phone number.
By default, numbers point to the SignalHost server URL so Vapi asks us for a fresh dynamic assistant on each call:

```text
POST https://hostline-voice.onrender.com/vapi/sync-phone-number
```

Body for creating a new free Vapi number:

```json
{
  "locationId": "<location_uuid>",
  "numberDesiredAreaCode": "781",
  "name": "SignalHost Harbor Plumbing"
}
```

Body for attaching an existing Vapi phone number:

```json
{
  "locationId": "<location_uuid>",
  "phoneNumberId": "<vapi_phone_number_id>",
  "name": "SignalHost Harbor Plumbing"
}
```

Only include `assistantId` when intentionally attaching a permanent Vapi assistant. The preferred demo path is no `assistantId`, because SignalHost returns the business-specific assistant dynamically from `/vapi/webhook`.

## Automated Demo Provisioning

Dry run all demo businesses:

```powershell
npm run provision:vapi-demos
```

Dry run duplicate-assistant cleanup:

```powershell
npm run reconcile:vapi-demos
```

Delete only unassigned duplicate fixed assistants after reviewing the dry run:

```powershell
npm run reconcile:vapi-demos -- --commit
```

Create/sync Vapi assistants only, if intentionally testing permanent assistants:

```powershell
npm run provision:vapi-demos -- --commit --sync-assistants
```

Create new free Vapi numbers, attach each number to the dynamic SignalHost server URL, persist the numbers to Supabase, and make them the primary AI numbers for each demo location:

```powershell
npm run provision:vapi-demos -- --commit --create-phone-numbers --make-primary
```

The script is intentionally idempotent for active Vapi demo numbers: if a demo location already has an active Vapi number in Supabase, it reuses and re-syncs that number instead of buying another one. To intentionally force a fresh number, add:

```powershell
npm run provision:vapi-demos -- --include=plumbing --commit --create-phone-numbers --make-primary --force-new-phone-number
```

If Vapi has no inventory in a preferred area code, the script tries the remaining preferred area codes for that demo, then any area codes Vapi suggests, then lets Vapi choose any available number.

Provision only one vertical:

```powershell
npm run provision:vapi-demos -- --include=plumbing --commit --create-phone-numbers --make-primary
```

Attach existing Vapi phone numbers instead of creating new ones:

```powershell
npm run provision:vapi-demos -- --commit --make-primary --phone-number-ids=plumbing:c31aeea7-e06d-4ea3-9f79-ca20d613d934
```

Required local environment variables for the script:

```text
SIGNALHOST_ADMIN_EMAIL=tim@hostline.ai
SIGNALHOST_ADMIN_PASSWORD=...
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VOICE_SERVICE_URL=https://hostline-voice.onrender.com
```

The script does not run destructive actions by default. Without `--commit`, it only prints the intended changes.

The assistant reconciliation script also does not run destructive actions by default. It keeps the assistant currently assigned to each real demo phone number, deletes only unassigned duplicate assistants with the exact expected demo assistant name, and repairs the stored Supabase `vapiAssistantId` if the phone-number assignment is the newer source of truth.

## Vapi Dashboard Setup

1. Create or choose one test phone number in Vapi.
2. Use a new Vapi test number or import a spare Twilio number. Do not import the current SignalHost number for the first test.
3. Create a fixed Vapi assistant for the test business and assign that assistant to the phone number.
4. Set the assistant first message to:

```text
Thank you for calling {business name}. How can I help you?
```

5. Set the assistant or phone number server URL to the SignalHost webhook URL above.
6. If Vapi lets you send server headers, add:

```text
x-vapi-secret: <VAPI_WEBHOOK_SECRET>
```

7. Do not change the normal SignalHost demo numbers until the pilot earns it.

Note: Vapi can request a transient assistant from a server when a phone number has no
`assistantId`, but the dashboard/free-number path can fail with a generic "set your
assistant ID" error. For this pilot, prefer the fixed assistant path: assign a Vapi
assistant to the phone number, then use the SignalHost server URL for call events,
tool calls, recordings, and logs.

## Model Choice

For the current Vapi pilot, prefer the model that tested best in the dashboard:

```text
Dashboard label: GPT 5.2 Instant
API value: gpt-5.2-chat-latest
```

If Vapi later exposes a stronger realtime voice model in the dashboard/API, test it against this baseline before changing all demos. Do not use `gpt-4o-mini` for the real comparison; it was only an early plumbing placeholder.

## Tool Bridge

The pilot webhook currently supports these SignalHost tools:

- `lookup_restaurant_context` / `lookup_business_context`
- `create_customer_request`
- `create_reservation_request`
- `request_staff_callback`
- `finish_call`

Unsupported tools return a safe result telling the assistant to route the issue to staff.

## Server Events

Do not set a custom `serverMessages` list when syncing fixed Vapi assistants unless
we have retested it against the current Vapi API. Vapi's validation changed once and
blocked assistant creation. The safer pilot baseline is to omit `serverMessages` and
let Vapi send its default server events, including tool calls and end-of-call reports.

## A/B Test Plan

Run the same script on both numbers:

1. Normal handset, quiet room.
2. Speakerphone, quiet room.
3. Speakerphone, TV or room noise.
4. Caller interrupts during a long answer.
5. Caller asks a knowledge-base question.
6. Caller asks for a callback/request.
7. Caller says no when asked if they need anything else.

Score each call:

- greeting completed cleanly
- latency after caller stops
- self-interruption count
- caller interruption handling
- answer accuracy
- request capture quality
- natural closeout
- transcript and recording saved

## Source Notes

Vapi docs used for this pilot design:

- Introduction: https://docs.vapi.ai/quickstart/introduction
- How Vapi works: https://docs.vapi.ai/how-vapi-works
- Server URL events: https://docs.vapi.ai/server-url/events
- Free telephony: https://docs.vapi.ai/free-telephony
- Create phone number: https://docs.vapi.ai/api-reference/phone-numbers/create
- Update phone number: https://docs.vapi.ai/api-reference/phone-numbers/update
- Monitoring: https://docs.vapi.ai/observability/monitoring-quickstart
- Simulations: https://docs.vapi.ai/observability/simulations-quickstart
