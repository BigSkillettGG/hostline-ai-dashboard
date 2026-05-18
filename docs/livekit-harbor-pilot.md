# LiveKit Harbor Plumbing pilot

This pilot keeps OpenAI as the brain and puts LiveKit in the phone audio path for the Harbor Plumbing demo only. The goal is to test whether LiveKit SIP plus Krisp noise cancellation handles speakerphone, background TV, and echo better than the direct OpenAI SIP path.

## What the code now supports

- `GET /livekit/pilot-config?locationId=22222222-2222-4222-8222-222222222222`
  returns Harbor setup status, the LiveKit inbound trunk JSON, and the dispatch rule JSON.
- `POST /twilio/livekit-voice?locationId=22222222-2222-4222-8222-222222222222`
  returns TwiML that bridges Twilio Voice into LiveKit SIP.
- `POST /twilio/voice`
  can route only pilot locations to LiveKit when `LIVEKIT_ROUTE_ON_TWILIO_VOICE=true`.
- `/health` includes `liveKitHarborPilotConfigured` and `liveKitHarborPilotRoutingEnabled`.
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
LIVEKIT_ROOM_PREFIX=harbor-call-
LIVEKIT_PILOT_LOCATION_IDS=22222222-2222-4222-8222-222222222222
LIVEKIT_KRISP_ENABLED=true
OPENAI_API_KEY=...
SUPABASE_URL=...
SUPABASE_SECRET_KEY=...
SUPABASE_DEMO_LOCATION_ID=22222222-2222-4222-8222-222222222222
```

Set this on the voice service only. Leave it off until the LiveKit trunk, dispatch rule, and agent worker are all ready:

```bash
LIVEKIT_ROUTE_ON_TWILIO_VOICE=false
```

Turn it on only when Harbor should route through LiveKit:

```bash
LIVEKIT_ROUTE_ON_TWILIO_VOICE=true
```

## LiveKit setup

In LiveKit Cloud:

1. Create an inbound SIP trunk for the Harbor number.
2. Use the JSON from `/livekit/pilot-config`.
3. Make sure the trunk has `krispEnabled: true`.
4. Create a dispatch rule from the JSON in `/livekit/pilot-config`.
5. The dispatch rule should send calls to agent name `signalhost-harbor`.
6. Deploy and start the LiveKit worker before pointing Harbor's Twilio number at the LiveKit webhook.

## Twilio setup

For the Harbor test number, use either:

- Voice webhook: `https://hostline-voice.onrender.com/twilio/livekit-voice?locationId=22222222-2222-4222-8222-222222222222`
- Or the normal webhook with `LIVEKIT_ROUTE_ON_TWILIO_VOICE=true`: `https://hostline-voice.onrender.com/twilio/voice?locationId=22222222-2222-4222-8222-222222222222`

The dedicated LiveKit webhook is safer for the first test because it affects only Harbor.

## Why this is different from the current path

The current path sends Harbor directly to OpenAI Realtime SIP. LiveKit cannot improve that audio unless Twilio sends the call to LiveKit first. This pilot adds the Twilio-to-LiveKit bridge and the setup payloads needed for LiveKit to receive the SIP caller, apply SIP-level noise cancellation, and dispatch an OpenAI-powered agent into the room.
