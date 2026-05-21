# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Realtime SIP latency and self-interruption hardening.
- Keep direct OpenAI Realtime SIP with `gpt-realtime-2`.
- Do not change LiveKit, ElevenLabs, ConversationRelay, routing, business knowledge, model, or voice while validating this fix.
- Deploy the voice service before asking the user to retest Olive & Ember.

## Current Voice Situation

The latest analyzed Olive & Ember calls hit the correct OpenAI Realtime SIP path. The current code fix is pending live deploy.

Most recent analyzed issue:

- Call id `58c11551-cb85-4b27-84c7-cf15acc70fba`: caller heard the full Olive & Ember greeting, asked to place a takeout order, then asked for pepperoni pizza and Caesar salad.
- The greeting was clean in the recording.
- Response latency was too high: about `8.3s` after the first caller request and about `4.1s` after the item request.
- The off-menu response began correctly but was truncated/incomplete.

Diagnosis:

- Opening greeting and first request capture are working for this call.
- The remaining failures were stale input audio around agent replies plus overly slow response-delay caps.
- Render may still have old env values set, so code defaults alone are not enough.

Fix implemented:

- Clear OpenAI Realtime `input_audio_buffer` before every post-opening agent `response.create`.
- Clear OpenAI Realtime `input_audio_buffer` before restoring listening after the opening greeting and after normal agent audio.
- Tightened latency caps so stale Render values cannot keep calls on the old slow profile:
  - manual response delay default `300ms`, cap `500ms`
  - detail-capture delay default `850ms`, cap `1000ms`
  - server VAD silence default `600ms`, cap `700ms`
- No model, voice, routing, provider, business knowledge, or tools were changed.

Recently fixed opening-timing issue:

- Full greeting appears in transcript.
- Audio diagnostic shows greeting audio from about `1.0s` to `3.9s`.
- Caller said "Hello?" around `8.5s`.
- Agent did not respond until around `13.5s`.
- End of call had broken overlap.

After deploy, retest Olive & Ember with: "I want to place an order for takeout." Expected behavior: SignalHost hears the first request, answers faster, does not repeat the greeting, and does not truncate its own answer.

Likely next technical discussions:

- How to make greeting playout/listening unlock more deterministic.
- How to avoid false post-greeting dead air.
- How to keep current speakerphone progress without loosening the system.
- How to recover naturally when a caller says the agent was interrupted or cut off.

## High Priority Product Work Still Open

These are important but should not distract from the current voice stability issue unless the user chooses them:

- Stripe checkout/subscription activation.
- Final SMS/A2P registration and production texting.
- Production email/webhook hardening.
- Owner assistant polish.
- Learning loop polish.
- Follow-up queue and revenue recovery.
- More vertical-specific analytics/reporting QA.
- Address capture/geocoding with Google Places.
- Integration/premium toolkit strategy.

## Call Testing Checklist

When the user makes a test call:

1. Ask/identify which number/business.
2. Fetch latest call for that location.
3. Confirm call path.
4. Use audio diagnostic.
5. Summarize exactly what happened.
6. Only propose changes after analysis.

## Do Not Forget

- The user is highly sensitive to regressions now.
- Do not say a call cannot be listened to; use the debug path.
- Do not make fixes when the user asks only for analysis.
- Do not re-open LiveKit unless explicitly requested.
- Do not switch voice providers.
- Do not change routing while debugging prompt/voice behavior.
