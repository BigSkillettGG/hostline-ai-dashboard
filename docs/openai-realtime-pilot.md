# OpenAI Realtime SIP Pilot

This pilot lets us test OpenAI's phone-native realtime stack without removing the existing Twilio ConversationRelay route.

## What This Adds

- OpenAI sends the voice service a webhook when a SIP call arrives.
- The voice service accepts the call with restaurant-specific instructions.
- The voice service opens a sideband WebSocket so HostLine can provide restaurant context tools.
- The current Twilio webhook at `/twilio/voice` stays unchanged.

## Render Environment Variables

Keep all existing Render variables. Add these optional pilot variables:

```text
OPENAI_REALTIME_MODEL=gpt-realtime
OPENAI_REALTIME_FEMALE_VOICE=marin
OPENAI_REALTIME_MALE_VOICE=cedar
```

Optional later:

```text
OPENAI_PROJECT_ID=proj_...
OPENAI_WEBHOOK_SECRET=whsec_...
```

Do not add `OPENAI_WEBHOOK_SECRET` until the OpenAI webhook is configured and the first unsigned pilot call works. The service will reject webhooks if the secret is wrong.

## HostLine URLs

Admin config endpoint:

```text
https://hostline-voice.onrender.com/openai/realtime/live-call-config?locationId=YOUR_LOCATION_ID
```

OpenAI webhook endpoint:

```text
https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=YOUR_LOCATION_ID
```

For the demo restaurant, use the Lovable/Supabase `locations.id` value you are testing with. If you do not know it yet, use the same location id already used by the Twilio live-call config.

## OpenAI Dashboard Setup

1. Open the OpenAI dashboard.
2. Go to the Realtime/SIP setup area.
3. Add the HostLine webhook URL:

```text
https://hostline-voice.onrender.com/openai/realtime/webhook?locationId=YOUR_LOCATION_ID
```

4. Use the SIP URI that OpenAI shows in the dashboard when routing a test number or SIP trunk.
5. Leave the existing Twilio phone number alone until this pilot route sounds better.

## Test Script

Use a separate test number for this route.

1. Call the OpenAI pilot number.
2. Ask: "Do you have specials tonight?"
3. Ask a second question in the same call: "What time do you close?"
4. Pause for a couple of seconds and then ask: "Can I make a reservation for six tonight?"
5. Interrupt Vera while she is speaking.
6. Say: "No thanks, that's all."

Pass criteria:

- Vera does not restart the opening greeting mid-call.
- Vera answers multiple questions in one call.
- Vera handles a short pause without starting over.
- Vera asks only for missing reservation details.
- Vera says a natural goodbye and the call ends cleanly.
