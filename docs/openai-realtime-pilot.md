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
OPENAI_REALTIME_NOISE_REDUCTION=far_field
OPENAI_REALTIME_TURN_DETECTION_MODE=server_vad
OPENAI_REALTIME_SERVER_VAD_THRESHOLD=0.72
OPENAI_REALTIME_SERVER_VAD_SILENCE_MS=550
OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS=250
OPENAI_REALTIME_IDLE_TIMEOUT_MS=9000
OPENAI_REALTIME_INTERRUPT_RESPONSE=false
```

The realtime defaults are intentionally speakerphone-safe. `far_field` noise reduction plus server VAD at a higher threshold makes Vera less likely to treat room noise, car audio, or her own voice echoing through the caller's speaker as an interruption. If handset calls feel too slow after speakerphone is stable, test `OPENAI_REALTIME_SERVER_VAD_SILENCE_MS=450` before lowering the threshold.

Optional semantic VAD test mode:

```text
OPENAI_REALTIME_TURN_DETECTION_MODE=semantic_vad
OPENAI_REALTIME_TURN_EAGERNESS=low
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

Admin preflight endpoint:

```text
https://hostline-voice.onrender.com/openai/realtime/preflight?locationId=YOUR_LOCATION_ID
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

## Before The First Pilot Call

After Render deploys this code, the preflight endpoint should report:

- Public voice URL: OK
- OpenAI API key: OK
- OpenAI realtime model: OK
- Restaurant context: OK

The OpenAI project ID and webhook secret can be optional during the first test. Add `OPENAI_PROJECT_ID` when you want the service to print the exact SIP URI. Add `OPENAI_WEBHOOK_SECRET` only after the unsigned test works and the webhook secret from OpenAI has been copied into Render.

## Test Script

Use a separate test number for this route.

1. Call the OpenAI pilot number.
2. Ask: "Do you have specials tonight?"
3. Ask a second question in the same call: "What time do you close?"
4. Pause for a couple of seconds and then ask: "Can I make a reservation for six tonight?"
5. Interrupt Vera while she is speaking.
6. Say: "No thanks, that's all."
7. Repeat the call on speakerphone or car Bluetooth.

Pass criteria:

- Vera does not restart the opening greeting mid-call.
- Vera answers multiple questions in one call.
- Vera handles a short pause without starting over.
- Speakerphone or car audio does not cause Vera to constantly restart, interrupt herself, or answer phantom speech.
- Vera asks only for missing reservation details.
- After each answer, Vera asks whether she can help with anything else.
- Vera says a natural goodbye and the call ends cleanly.
