# LiveKit Harbor Plumbing pilot

This pilot keeps OpenAI as the brain and puts LiveKit in the phone audio path for the Harbor Plumbing demo only. The goal is to test whether LiveKit SIP plus Krisp noise cancellation handles speakerphone, background TV, and echo better than the direct OpenAI SIP path.

## What the code now supports

- `GET /livekit/pilot-config?locationId=22222222-2222-4222-8222-222222222222`
  returns Harbor setup status, the LiveKit inbound trunk JSON, and the dispatch rule JSON.
- `POST /twilio/livekit-voice?locationId=22222222-2222-4222-8222-222222222222`
  returns TwiML that bridges Twilio Voice into LiveKit SIP only when `LIVEKIT_TWILIO_WEBHOOK_ENABLED=true`.
- `POST /twilio/voice`
  can route only pilot locations to LiveKit when `LIVEKIT_ROUTE_ON_TWILIO_VOICE=true`.
- `POST /telephony/repair-openai-sip-routing`
  reattaches an existing Twilio number to the OpenAI Realtime SIP trunk and updates SignalHost's phone number record.
- `/health` includes `liveKitHarborPilotConfigured`, `liveKitHarborPilotRoutingEnabled`, and `liveKitTwilioWebhookEnabled`.
- `services/livekit-agent/src/agent.ts`
  runs the LiveKit worker named `signalhost-harbor`. It joins the LiveKit room, applies telephony background voice cancellation, uses OpenAI Realtime for conversation, and reuses SignalHost business context/tools for Harbor.

## Deploy shape

This pilot uses two running processes:

1. The existing voice service on Render. It returns TwiML and bridges Harbor calls into LiveKit.
2. A separate LiveKit worker. It must be running for the LiveKit room to have an agent that answers the call.

The worker can be deployed as a second Render Web Service or Background Worker using the same GitHub repo.

Build command:

```bash
npm install && npm run build:livekit-agent
```

Start command:

```bash
npm run start:livekit-agent
```

## Required Render variables

Set these on both the voice service and the LiveKit worker unless noted:

```bash
LIVEKIT_URL=wss://YOUR-PROJECT.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
LIVEKIT_SIP_ENDPOINT=YOUR-PROJECT-ID.sip.livekit.cloud
LIVEKIT_INBOUND_AUTH_USERNAME=choose-a-username
LIVEKIT_INBOUND_AUTH_PASSWORD=choose-a-long-password
LIVEKIT_PHONE_NUMBER=+17816946083
LIVEKIT_AGENT_NAME=signalhost-harbor
LIVEKIT_AGENT_INPUT_NOISE_CANCELLATION=true
LIVEKIT_ROOM_PREFIX=harbor-call-
LIVEKIT_PILOT_LOCATION_IDS=22222222-2222-4222-8222-222222222222
LIVEKIT_KRISP_ENABLED=true
LIVEKIT_TWILIO_WEBHOOK_ENABLED=false
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_DEMO_LOCATION_ID=22222222-2222-4222-8222-222222222222
```

Set this on the voice service only. Leave it off until the LiveKit trunk, dispatch rule, and agent worker are all ready:

```bash
LIVEKIT_ROUTE_ON_TWILIO_VOICE=false
```

Turn it on only when Harbor should route through LiveKit from the normal `/twilio/voice` webhook:

```bash
LIVEKIT_ROUTE_ON_TWILIO_VOICE=true
```

The dedicated `/twilio/livekit-voice` webhook is quarantined by default. Turn this on only during a deliberate LiveKit test window:

```bash
LIVEKIT_TWILIO_WEBHOOK_ENABLED=true
```

Do not leave both LiveKit switches on for normal demo calls.

## LiveKit setup

In LiveKit Cloud:

1. Create an inbound SIP trunk for the Harbor number.
2. Use the JSON from `/livekit/pilot-config`.
3. Make sure the trunk has `krispEnabled: true`.
4. Create a dispatch rule from the JSON in `/livekit/pilot-config`.
5. The dispatch rule should send calls to agent name `signalhost-harbor`.
6. Deploy and start the LiveKit worker before pointing Harbor's Twilio number at the LiveKit webhook.

## Speakerphone/noise test requirements

For Harbor speakerphone testing, both LiveKit noise layers should be on:

- The LiveKit inbound trunk should have `krispEnabled: true`.
- The Render LiveKit worker should have `LIVEKIT_AGENT_INPUT_NOISE_CANCELLATION=true`.

The worker defaults this setting on unless it is explicitly set to `false`, but keeping the variable visible in Render makes the test easier to audit. When it is active, the worker boot log prints `nodeNoiseCancellationEnabled: true`.

If a caller produces repeated audio bursts that cannot become a clean final transcript, the worker now marks the call for review and offers the caller a quieter-place/text fallback instead of letting background audio drive the conversation.

## Twilio setup

For normal Harbor demo calls, use the OpenAI Realtime SIP trunk route. If a number was accidentally pointed at the LiveKit webhook, repair it with:

```bash
POST https://hostline-voice.onrender.com/telephony/repair-openai-sip-routing
Authorization: Bearer <platform admin Supabase token>
Content-Type: application/json

{
  "locationId": "22222222-2222-4222-8222-222222222222",
  "phoneNumber": "+17816946083"
}
```

For a deliberate LiveKit test window only, use either:

- Voice webhook: `https://hostline-voice.onrender.com/twilio/livekit-voice?locationId=22222222-2222-4222-8222-222222222222`
- Or the normal webhook with `LIVEKIT_ROUTE_ON_TWILIO_VOICE=true`: `https://hostline-voice.onrender.com/twilio/voice?locationId=22222222-2222-4222-8222-222222222222`

The dedicated LiveKit webhook affects only Harbor, but it must also have `LIVEKIT_TWILIO_WEBHOOK_ENABLED=true`. LiveKit TwiML no longer falls back to Twilio ConversationRelay; if LiveKit fails to connect, it fails loudly instead of putting callers into the old lower-quality voice path.

## Why this is different from the current path

The current path sends Harbor directly to OpenAI Realtime SIP. LiveKit cannot improve that audio unless Twilio sends the call to LiveKit first. This pilot adds the Twilio-to-LiveKit bridge and the setup payloads needed for LiveKit to receive the SIP caller, apply SIP-level noise cancellation, and dispatch an OpenAI-powered agent into the room.
