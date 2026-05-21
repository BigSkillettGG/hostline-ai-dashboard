# Voice Baseline Lock

This file freezes the current intended live voice path so future edits do not accidentally undo a working state.

## Primary Live Path

Use this path for production-style test calls unless the user explicitly asks for an experiment:

- Provider: OpenAI Realtime SIP
- Model: `gpt-realtime-2`
- Live-call provider: custom OpenAI Realtime accept payload by default
- Voice provider: OpenAI Realtime voices
- Telephony: Twilio numbers and SIP/OpenAI Realtime routing
- Logging: Supabase `calls`, `transcript_turns`, and recording metadata

Do not switch the default live path back to:

- ElevenLabs
- Twilio ConversationRelay
- LiveKit
- OpenAI Agents SDK pilot

Those paths can stay in the repo as experiments or fallbacks, but they are not the default working path.

## Current Voice Behavior To Preserve

The following settings are deliberately conservative because speakerphone echo and greeting barge-in are fragile:

- `OPENAI_REALTIME_MODEL`: defaults to `gpt-realtime-2`
- `OPENAI_REALTIME_NOISE_REDUCTION`: defaults to `far_field`
- `OPENAI_REALTIME_SPEED`: defaults to `1.02`
- `OPENAI_REALTIME_GREETING_DELAY_MS`: defaults to `900`
- `OPENAI_REALTIME_MANUAL_RESPONSE_GATING`: defaults to enabled
- `OPENAI_REALTIME_TURN_DETECTION_MODE`: use `semantic_vad` in deployed testing when configured
- `OPENAI_REALTIME_TURN_EAGERNESS`: defaults to `low`
- `OPENAI_REALTIME_INTERRUPT_RESPONSE`: effectively disabled
- Server VAD fallback threshold: clamps to the speakerphone-safe range `0.97` to `0.98`
- Post-response listen guard: `550ms`
- Opening greeting playout lock: turn detection stays disabled until after greeting audio completion plus the opening playout guard

Do not lower the gating sensitivity or re-enable model-side interruption without a specific test plan and rollback.

## Caller-Facing Contracts

Opening greeting:

```text
Thank you for calling {business name}. How can I help you?
```

If the caller asks whether they reached the business:

```text
Yes, you've reached {business name}. How can I help you?
```

Never call a customer a "lead" aloud. Internal systems may use lead/opportunity language, but caller-facing language should use:

- request
- service request
- message
- details
- appointment request
- reservation request
- order request
- follow-up

## Debugging Contract

When a call goes badly, do not guess. Use the recorded debug path:

```text
GET /debug/calls/latest?locationId={locationId}&audio=true
GET /debug/calls/{callId}?locationId={locationId}&audio=true
```

The debug response should include:

- call path
- transcript turns
- summary-derived quality observations
- runtime voice config when captured on the call
- OpenAI second-pass audio diagnostic when a recording is attached

## Audit Command

Use this before and after voice-routing changes:

```bash
npm run audit:voice
```

For live Supabase and deployed voice-service checks, set:

```bash
SIGNALHOST_ADMIN_EMAIL=...
SIGNALHOST_ADMIN_PASSWORD=...
VOICE_SERVICE_URL=https://hostline-voice.onrender.com
```

The audit command is read-only.
