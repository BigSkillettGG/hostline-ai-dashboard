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

## 2026-05-20 11:45 ET - Olive & Ember Off-Menu Order Guard

Business:

- Olive & Ember

Call id:

- `cb3c7d25-c33b-49f9-90a8-4841dc927da7`

Recording/debug files:

- `tmp/pepperoni-review/latest-debug.json`
- `tmp/pepperoni-review/latest-call.mp3`

What happened:

- Caller asked for a pickup order with one pepperoni pizza and one Caesar salad.
- Pepperoni pizza is not a configured Olive & Ember menu item.
- SignalHost treated the requested items as accepted and saved a staff-review order request.

Diagnosis:

- The call used the correct `openai_realtime_sip` path.
- The menu/substitution knowledge was present in the runtime context, but the generic `create_customer_request` tool trusted the model's order summary.
- The backend did not block off-menu restaurant items from being silently saved as normal pickup orders.

Change made:

- Added a restaurant order validation guard inside `create_customer_request`.
- Off-menu pickup items now return `unknown_order_items` with listed menu alternatives instead of saving the request.
- Updated the realtime tool description so the model should use staff confirmation for off-menu or uncertain order items.
- Did not change voice model, VAD, greeting, routing, provider, timing, or audio settings.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts`
- `node scripts\build-voice.mjs`

Regression risk:

- Low. The guard only applies to restaurant `request_type: order` calls with configured menu items. Non-restaurant requests and normal staff requests are untouched.

## 2026-05-20 12:03 ET - Olive & Ember Pepperoni Retest After Off-Menu Guard

Business:

- Olive & Ember

Call id:

- `c5dd4f91-607e-4236-a5f3-ad9313b047c9`

Recording/debug files:

- `tmp/latest-call-analysis/latest-debug.json`
- `tmp/latest-call-analysis/latest-call.mp3`

Path:

- `openai_realtime_sip`
- Runtime config showed `gpt-realtime-2`, OpenAI voice `marin`, `far_field` noise reduction, `server_vad` threshold `0.98`, manual response gating on.

What happened:

- Caller asked for a takeout order.
- Caller requested a large pepperoni pizza and a Caesar salad.
- Pepperoni pizza is not a configured Olive & Ember menu item.
- Agent replied: "Got it, a large pepperoni pizza and one Caesar salad. For pickup, I still need your name and a callback number."
- After the caller provided name and callback number, the agent shifted to staff-confirmation language: "I'll set up a staff callback request so they can confirm and place that take..."
- The actual recording/audio diagnostic shows that sentence cut off at "take." The database transcript made it look more complete than the caller heard.
- Caller then asked what the agent was saying, but there was no useful recovery before the call ended.

What worked:

- Greeting was complete in the audio diagnostic.
- The call used the correct OpenAI Realtime SIP path.
- The agent did not say the order was fully placed after collecting the phone number; it moved toward staff confirmation.

What failed:

- The agent still spoke as if "pepperoni pizza" was an accepted draft item before telling the caller it was off-menu.
- The backend off-menu tool guard did not get a chance to fire because no tool call was used on this turn.
- The caller-facing staff-confirmation response cut off audibly.
- The agent did not recover when the caller said it was interrupted and asked what it had been saying.

Diagnosis:

- The previous backend guard is necessary but not sufficient. It prevents saving an off-menu restaurant order if the model calls `create_customer_request`, but it does not stop the model from generating a plain spoken response that acknowledges the off-menu item too confidently.
- This needs a prompt/tooling-layer guard before or during the spoken response: when restaurant pickup text contains an unavailable menu item, the model should immediately say the item is not on the menu and offer close menu alternatives or staff confirmation.
- The cut-off at the end looks like the recurring response playout/completion issue: the transcript can record more words than the caller actually hears.

Change made:

- None yet. This entry is analysis/memory only.

Next action:

- Propose a narrow forward-only fix that reinforces off-menu handling in the restaurant prompt/tool instructions without changing voice model, VAD, greeting, routing, provider, or timing.
- Separately consider a narrow recovery fix for "you got interrupted / what were you saying" so the agent repeats the last incomplete sentence instead of going silent.

## 2026-05-20 13:15 ET - Olive & Ember Off-Menu Spoken Guard Patch

Business:

- Olive & Ember

Call id driving the fix:

- `c5dd4f91-607e-4236-a5f3-ad9313b047c9`

What happened:

- Caller asked for a large pepperoni pizza and a Caesar salad.
- Pepperoni pizza was not on the configured Olive & Ember menu.
- The model answered too confidently in plain speech before any tool call: "Got it, a large pepperoni pizza..."
- Because no tool was used, the previous backend `create_customer_request` off-menu guard did not get a chance to fire.
- When the caller said the agent got interrupted and asked what it was saying, the recovery did not reliably restate a safe next step.

Diagnosis:

- Backend persistence validation was necessary but insufficient.
- The Realtime per-turn repair instructions also need to detect off-menu restaurant order items before generating spoken output.

Change made:

- Added a restaurant off-menu spoken-response guard inside deterministic Realtime repair instructions.
- If a restaurant pickup order mentions an item not found in the configured menu, SignalHost must not say "got it" for that item, must not ask for name/phone yet, and must offer close menu alternatives or staff confirmation first.
- Expanded mid-call recovery detection for phrases like "you got interrupted," "you didn't finish," and "what were you saying."
- If an off-menu order was already in progress and audio cut out, recovery now apologizes briefly and returns to the off-menu clarification instead of saving or accepting the order.
- No changes were made to model, voice, greeting, VAD, threshold, noise reduction, routing, provider, timing, or call recording.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts`
- `node scripts\build-voice.mjs`

Regression risk:

- Low. The new guard is scoped to restaurant contexts where a caller appears to be placing a pickup/takeout order and the menu validator finds a category-style item that does not match configured menu items.

Next action:

- After deploy, test Olive & Ember with: "I'd like a large pepperoni pizza and a Caesar salad."
- Expected behavior: SignalHost should say it does not see pepperoni pizza on the menu, offer configured pizza alternatives or staff confirmation, and only collect name/callback after the item choice is resolved.

## 2026-05-20 17:20 ET - Opening Greeting Playout Lock Patch

Business:

- Olive & Ember

Call ids driving the fix:

- `97aefcb9-da0e-45a9-b921-84e4bc831010`
- `dcba2d8d-d5d9-45d3-910e-924703e3ac4e`

Path:

- Direct OpenAI Realtime SIP
- `gpt-realtime-2`

What happened:

- The database transcript could show the full greeting while the caller heard only part of it or did not hear it cleanly.
- One call captured the full greeting in audio but still closed quickly with no accepted caller turn.
- Another call showed the caller complaining that the phone had not answered, even though the database transcript contained the greeting.

Diagnosis:

- This is an opening playout/listening-lock defect, not a business-knowledge defect.
- OpenAI Realtime can emit transcript/generation completion before PSTN caller-side audio is safely finished.
- Re-enabling turn detection immediately on `response.done` or `response.audio.done` can let handset/speakerphone echo reopen the microphone while the greeting is still effectively in flight.
- A raw `input_audio_buffer.speech_started` event is not enough to prove the caller made a meaningful request; accepted caller transcript is the safer signal.

Research basis:

- Official OpenAI Realtime VAD docs confirm VAD is controlled through `session.audio.input.turn_detection` and can be disabled by setting it to `null`.
- Official OpenAI Realtime VAD docs confirm `semantic_vad` with low eagerness is the least interruptive conversational mode.
- Official OpenAI Realtime SIP docs confirm the sideband WebSocket is the correct control plane after accepting a SIP call.

Change made:

- Opening turn detection now stays disabled through greeting generation, audio completion, and an additional opening playout guard.
- `response.done` no longer restores listening for the opening greeting.
- `response.audio.done` no longer restores listening for the opening greeting by itself; it marks the greeting complete and waits for the guard.
- First-listen recovery waits longer and repeats the exact opening greeting if no accepted caller turn exists.
- First-listen recovery is paused, not canceled, by raw speech-start/speech-stop events until a real caller transcript is accepted.
- If a caller says they did not hear the greeting or that the phone did not answer, SignalHost apologizes briefly and repeats the exact greeting instead of arguing or explaining.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts --reporter=dot`
- `node scripts\build-voice.mjs`

Regression risk:

- Low-to-moderate. The opening may wait slightly longer before accepting the caller's first request, but this is intentionally safer than cutting off or interrupting the greeting.
- The change is scoped to the opening greeting and first-listen recovery. It does not change model, voice, business knowledge, routing, tools, provider, or general VAD settings.

Next action:

- Deploy and test Olive & Ember first without speakerphone, then on quiet speakerphone.
- Expected behavior: the caller hears the complete greeting before SignalHost listens or recovers.

## 2026-05-21 11:25 ET - Olive & Ember Opening Deaf Window Patch

Business:

- Olive & Ember

Call id driving the fix:

- `5fe287f2-ca29-4b7d-9b4b-9712de9f511d`

Path:

- Direct OpenAI Realtime SIP
- `gpt-realtime-2`

Recording/debug files:

- `tmp/latest-olive-analysis/latest-debug.json`

What happened:

- The caller heard the greeting.
- The caller then said: "Yeah, hi, I want to place an order for takeout."
- SignalHost did not respond to that request for several seconds.
- SignalHost repeated the opening greeting.

Database transcript:

1. Agent: "Thank you for calling Olive and Ember. How can I help you?"
2. Agent: "Thank you for calling Olive and Ember. How can I help you?"

OpenAI audio diagnostic:

- Agent greeting: about `1.0s` to `4.0s`.
- Caller request: about `5.15s` to `7.25s`.
- Repeated greeting: about `14.1s` to `17.05s`.
- No caller transcript turn was saved.

Diagnosis:

- The previous opening playout lock fixed greeting interruption but overcorrected.
- Input/listening stayed disabled too long after the greeting, so the first real caller request happened inside a deaf window.
- Because no caller transcript was accepted, first-listen recovery treated the call as empty and repeated the greeting.
- This was timing/state-machine behavior, not an LLM intelligence or knowledge-base issue.

Change made:

- Opening input still stays disabled during the greeting.
- When OpenAI emits the real opening audio-complete event (`response.audio.done` or `output_audio_buffer.stopped`), SignalHost now waits only a short `700ms` post-audio playout guard before restoring listening.
- The longer transcript-estimated fallback remains only for cases where the audio-complete event is missing.
- Added a regression test that recreates the exact failure: greeting completes, caller asks for takeout, and SignalHost must accept the first caller turn instead of repeating the greeting.
- No changes were made to model, voice, business knowledge, tools, provider, routing, or general VAD/noise settings.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts --reporter=dot`
- `node scripts\build-voice.mjs`

Regression risk:

- Low-to-moderate and scoped to the opening greeting. This intentionally shortens the post-greeting deaf window while keeping the opening protected from early echo.

Next action:

- Deploy and retest Olive & Ember.
- Expected behavior: full greeting, then the first caller request after the greeting is heard and answered without repeating the greeting.

## 2026-05-21 11:55 ET - Olive & Ember Post-Greeting Response Self-Interruption Patch

Business:

- Olive & Ember

Call id driving the fix:

- `38959f15-825a-47a4-80eb-772a5102291b`

Path:

- Direct OpenAI Realtime SIP
- `gpt-realtime-2`

Recording/debug files:

- `tmp/latest-olive-self-interrupt/target-debug.json`
- `tmp/latest-olive-self-interrupt/target-transcript.json`
- `tmp/latest-olive-self-interrupt/target-audio-diagnostic.json`

What happened:

- The opening greeting played correctly.
- The caller asked to place a takeout order.
- SignalHost asked what the caller wanted to order.
- The caller asked for one large pepperoni pizza and one Caesar salad.
- SignalHost started the correct off-menu response but audio cut out after "I don't see..."
- The caller then had to say "Hello?"

What worked:

- The opening greeting was complete.
- The first caller request after the greeting was accepted.
- The model understood the off-menu issue and started the right response shape instead of placing a pepperoni pizza order.

What failed:

- The normal post-greeting agent reply was allowed to begin before input was locked.
- Speakerphone or handset echo could race with the response and cut off the spoken output.

Diagnosis:

- The code was disabling turn detection in response to OpenAI's `response.created` event.
- That is too late for speakerphone echo because the service has already sent `response.create` and the model/audio response may be starting.
- This was a response state-machine race, not a restaurant knowledge-base failure.

Change made:

- Added a single helper for post-opening agent replies that disables Realtime input turn detection before sending `response.create`.
- Routed manual replies, first-listen recovery, idle check-ins, and tool follow-up replies through that helper.
- Kept the old `response.created` lock as a backup safety net.
- Did not change model, voice, routing, business knowledge, LiveKit, ElevenLabs, ConversationRelay, or general VAD settings.

Verification:

- `node node_modules\vitest\vitest.mjs run services\voice\src\openai-realtime-sip.test.ts --reporter=dot`
- `node scripts\build-voice.mjs`

Regression risk:

- Low and targeted. Agent replies may lock listening a few milliseconds earlier, which is the intended behavior. The existing post-response restore and listen guard still control when listening returns.

Next action:

- Deploy and retest Olive & Ember with an off-menu item plus a valid item.
- Expected behavior: SignalHost finishes the full off-menu clarification without cutting itself off, then continues the conversation.
