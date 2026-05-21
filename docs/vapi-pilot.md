# Vapi Pilot

Status: experimental, quarantined.

The primary SignalHost phone path remains OpenAI Realtime SIP through Twilio. Vapi is a controlled A/B pilot only. Do not move live demo numbers to Vapi unless the founder explicitly chooses that for a test.

## Why We Are Testing It

Vapi may help us compare a managed voice-agent orchestration layer against our direct OpenAI SIP path:

- phone/SIP orchestration
- interruptions and endpointing
- observability
- simulations
- server-hosted tool calls
- call transcripts and end-of-call reports

The pilot still uses SignalHost business context, SignalHost tools, SignalHost call logging, and SignalHost owner workflows.

## Render Variables

Add these to the existing `hostline-voice` Render service only when we are ready to test Vapi:

```text
VAPI_API_KEY=your_vapi_private_key
VAPI_WEBHOOK_SECRET=make_up_a_long_random_secret
VAPI_PILOT_ENABLED=true
VAPI_OPENAI_MODEL=gpt-4o-mini
VAPI_OPENAI_VOICE_ID=nova
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

## Vapi Dashboard Setup

1. Create or choose one test phone number in Vapi.
2. Create one assistant for one test business.
3. Set the assistant first message to:

```text
Thank you for calling {business name}. How can I help you?
```

4. Set the assistant server URL to the SignalHost webhook URL above.
5. If Vapi lets you send server headers, add:

```text
Authorization: Bearer <VAPI_WEBHOOK_SECRET>
```

6. Do not change the normal SignalHost demo numbers until the pilot earns it.

## Tool Bridge

The pilot webhook currently supports these SignalHost tools:

- `lookup_restaurant_context` / `lookup_business_context`
- `create_customer_request`
- `create_reservation_request`
- `request_staff_callback`
- `finish_call`

Unsupported tools return a safe result telling the assistant to route the issue to staff.

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
- Monitoring: https://docs.vapi.ai/observability/monitoring-quickstart
- Simulations: https://docs.vapi.ai/observability/simulations-quickstart
