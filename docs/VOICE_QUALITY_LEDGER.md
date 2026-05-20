# Voice Quality Ledger

This is the running diary for voice behavior. Update it after every meaningful test call diagnosis or voice-tuning change.

The goal is to prevent context loss, repeated fixes, and accidental regressions.

## How To Add An Entry

Use this shape:

```text
## YYYY-MM-DD HH:MM ET - Business / Number / Path

Call id:
Recording:
Environment:
What happened:
What worked:
What failed:
Diagnosis:
Change made:
Result:
Regression risk:
Next action:
```

## Current Voice Baseline

Primary target path:

- OpenAI Realtime SIP
- `gpt-realtime-2`
- OpenAI Realtime voice profiles
- Twilio SIP routing
- Supabase call logging

Important settings and behavior from `docs/openai-realtime-pilot.md`:

- `OPENAI_REALTIME_NOISE_REDUCTION=far_field`
- `OPENAI_REALTIME_TURN_DETECTION_MODE=semantic_vad`
- `OPENAI_REALTIME_TURN_EAGERNESS=low`
- `OPENAI_REALTIME_MANUAL_RESPONSE_GATING=true`
- `OPENAI_REALTIME_INTERRUPT_RESPONSE=false`

These settings were chosen to reduce false interruptions and speakerphone echo problems. Do not loosen them casually.

## Known Repeated Failure Modes

### Greeting Cutoff Or Dead Air

Symptom:

- Caller hears only part of the greeting, or hears greeting followed by too much silence.
- Database transcript may still show the full greeting.

Likely causes to investigate:

- Greeting generated/logged before the caller receives clean PSTN audio.
- Turn detection or response gating unlocks too early.
- False speech-start event from speakerphone echo.
- Audio playout finished event does not match real caller-side audio.

Required diagnostic:

- Use `/debug/calls/{id}?audio=true`.
- Compare audio segments to database transcript turns.
- If needed, inspect MP3 with `ffmpeg` for silence gaps and RMS/peak timing.

### Speakerphone Echo Interrupts

Symptom:

- Agent interrupts itself.
- Agent responds to phantom speech.
- Agent says "I'm here" or similar even though caller has not meaningfully spoken.

Likely causes to investigate:

- Incoming audio includes agent echo from caller speakerphone.
- VAD treats low-level echo/background as caller speech.
- Manual gating still allows partial/low-confidence audio through.

Required diagnostic:

- Check `speech starts` versus actual caller transcript turns in call summary.
- Check OpenAI audio diagnostic segments.
- Compare caller environment notes: quiet speakerphone, TV, car Bluetooth, noisy room.

### Customer-Facing Internal Language

Symptom:

- Agent says "lead" to caller.

Rule:

- Never call the caller a lead. Say "request," "details," "message," or "service request."

### Over-Solving Home Service Calls

Symptom:

- Agent tries to troubleshoot or solve too much instead of capturing a strong request.

Rule:

- Qualify enough to route well.
- For safety-sensitive or unclear home-service issues, collect details and create a follow-up instead of over-solving.

## 2026-05-18 - LiveKit Harbor Experiment

Business:

- Harbor Plumbing

Path:

- LiveKit + OpenAI Realtime worker

What happened:

- LiveKit was introduced to test whether SIP-level room handling and Krisp/noise cancellation would improve speakerphone behavior.
- It required a second Render worker and LiveKit dispatch/trunk setup.
- Multiple tests produced ringing/no answer, dead air, worker memory-limit emails, and routing confusion.

Decision:

- LiveKit is experimental/quarantined, not the production default.
- Harbor should normally use direct OpenAI Realtime SIP unless explicitly testing LiveKit.

Reference:

- `docs/livekit-harbor-pilot.md`

## 2026-05-19 - Return To Direct OpenAI Realtime SIP

Business:

- Harbor Plumbing and other demo numbers

Path:

- Direct OpenAI Realtime SIP

What worked:

- Speakerphone improved after using OpenAI Realtime noise reduction, semantic VAD, low eagerness, manual gating, and interruption suppression.
- Some calls were described by the user as nearly flawless or flawless in low-noise speakerphone settings.
- `gpt-realtime-2` sounded more expressive and less robotic than earlier models.

What remained fragile:

- Greeting could still be cut off.
- Interruption events could still occur from speakerphone echo.
- End-of-call behavior could still misfire.
- Latency sometimes felt long.

Guardrail:

- Keep the known-good OpenAI Realtime SIP direction. Tune carefully; do not revert to LiveKit or ConversationRelay.

## 2026-05-19 21:00 ET - Olive & Ember Latest Failure Review

Business:

- Olive & Ember

Location ID:

- `78d8053b-631d-4811-939f-61f0efe1d82a`

Call id:

- `196828e3-3938-4300-a29d-e47eb5d1999e`

Path:

- `openai_realtime_sip`
- `realtimeAcceptProvider=custom`

Recording/debug files:

- `tmp/latest-failure-review/latest-call.json`
- `tmp/latest-failure-review/latest-call.mp3`
- `tmp/latest-failure-review/latest-call.wav`
- `tmp/latest-failure-review/call-debug-audio.json`

Environment:

- User called Olive & Ember after recent hardening and reported a large regression.

Database transcript:

1. Agent: "Thank you for calling Olive and Ember. How can I help you?"
2. Caller: "Hello?"
3. Agent: "I'm here. How can I help you?"
4. Caller: "Wow, why didn't you answer the phone? Who is it?"
5. Agent: "Sorry about that. I can't see who's calling from here. Who is it, and what do you need?"

OpenAI audio diagnostic:

- Greeting audio segments appear from about `1.0s` to `3.9s`.
- Caller says "Hello?" around `8.5s`.
- Agent responds "I'm here. How can I help you?" around `13.5s`.
- This creates the caller experience of answer/dead-air/not answering.
- Ending diagnostic shows broken overlap: "Who is it and..." / caller noise / "where?"

Observations:

- The call did hit the current OpenAI Realtime SIP path, not old code.
- The transcript alone is misleading; audio timing shows the failure.
- The gap after greeting and after caller "Hello?" is the central defect.

Diagnosis:

- This is likely an opening timing/playout/listening unlock issue, not a business-knowledge issue.
- False speech/echo handling and post-greeting response timing are still fragile.

Change made:

- None. User explicitly requested analysis only.

Next action:

- Before changing code, propose a narrow fix that preserves the current OpenAI Realtime SIP progress and only addresses greeting/listening timing or false opening silence.

## 2026-05-20 10:50 ET - Olive & Ember First-Listen Recovery Patch

Business:

- Olive & Ember

Call id:

- `c198fddc-560d-49f4-ba47-79e7fae6e9cf`

Recording/debug files:

- `tmp/latest-failure-review/latest-call.mp3`
- `tmp/latest-failure-review/latest-call.wav`
- `tmp/latest-failure-review/call-debug-audio.json`
- `tmp/latest-failure-review/audio-level-analysis.json`

What happened:

- The opening greeting was present in the recording, but the caller experienced a long dead-air gap and said "Hello."
- When the caller asked whether SignalHost heard the earlier request, the agent replied defensively.
- When the caller asked to place a to-go order, the agent bundled too many collection questions at once.

Diagnosis:

- The issue was a first-listen recovery and conversational repair problem, not a model, VAD, or knowledge-base problem.
- No core VAD/gating/model settings were changed.

Change made:

- Added a post-greeting first-listen recovery prompt after roughly five seconds if no accepted caller turn exists.
- Canceled that recovery immediately on caller speech start or accepted caller transcript so it cannot talk over a real caller.
- Made "did you not hear me" after a generic help prompt recover warmly instead of saying only "I heard hello."
- Made restaurant pickup-order starts ask only for food items first, then collect name/callback/details later.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts`
- `node scripts\build-voice.mjs`

Regression risk:

- Low-to-moderate. The recovery adds one extra early check-in after a clean greeting when no caller request is captured, but it is canceled by speech-start and real transcript events.

## 2026-05-20 11:15 ET - Olive & Ember Speakerphone Playout Fallback Patch

Business:

- Olive & Ember

Call id:

- `f3cc1dfb-5b33-4645-9bbf-2f1338c9cd46`

Recording/debug files:

- `tmp/latest-olive-review/debug.json`
- `tmp/latest-olive-review/latest-call.mp3`
- `tmp/latest-olive-review/latest-call.wav`
- `tmp/latest-olive-review/local-audio-levels.json`

Environment:

- Caller used speakerphone.

What happened:

- Greeting played correctly.
- The order flow worked until the long order confirmation.
- The database transcript included "Would you like a text confirmation to the number ending 9218?"
- The actual recording cut off earlier at "Would you like a text confirmation to the number..."
- The repair response later cut off again after "one Caesar salad and one-".

Diagnosis:

- This was not solved by raising VAD. The live call was already at `server_vad` threshold `0.98`, and the local silence/RMS analysis showed low-level silence around the failures.
- The more likely fault was transcript-based response completion firing too early. The old fallback capped completion at 3 seconds after transcript completion, which can restore listening while PSTN audio is still playing.

Change made:

- Made `estimateOpenAIRealtimeResponseCompletionFallbackMs` use a conservative speech-duration estimate instead of a hard 3-second cap.
- Added a quality summary line whenever speech starts during an active response, even if it happens fewer than three times.
- Did not change model, VAD mode, threshold, greeting, routing, tools, prompts, or provider.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts`
- `node scripts\build-voice.mjs`

Regression risk:

- Low-to-moderate. If OpenAI/Twilio does not emit an audio-done event for a longer response, SignalHost may wait slightly longer before listening again. This is intentional and safer than cutting itself off on speakerphone echo.

Next action:

- Deploy and place the same speakerphone pickup-order test. Listen for whether long confirmations finish audibly before the caller can be accepted again.
