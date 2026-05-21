# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Opening greeting playout lock and first-listen recovery hardening.
- Keep direct OpenAI Realtime SIP with `gpt-realtime-2`.
- Do not change LiveKit, ElevenLabs, ConversationRelay, routing, business knowledge, model, voice, or general VAD settings while validating this fix.
- Deploy the voice service before asking the user to retest Olive & Ember.

## Current Voice Situation

The latest analyzed Olive & Ember calls hit the correct OpenAI Realtime SIP path. The off-menu restaurant spoken-response issue has a code fix pending live deploy.

Current open issue:

- Opening greeting could be partially audible or appear as dead air to the caller even when the database transcript contains the full greeting.

Most recent opening-greeting failures:

- Call id `97aefcb9-da0e-45a9-b921-84e4bc831010`: audio diagnostic captured the full Olive & Ember greeting, but the call closed quickly with no accepted caller turn.
- Call id `dcba2d8d-d5d9-45d3-910e-924703e3ac4e`: database transcript showed the greeting, but audio diagnostic did not present a clean greeting to the caller; caller said the phone did not answer.

Fix implemented:

- Opening turn detection remains disabled through greeting generation, audio completion, and a separate playout guard.
- `response.done` and `response.audio.done` no longer reopen the microphone for the opening greeting by themselves.
- First-listen recovery now repeats the exact greeting if no accepted caller turn exists.
- Raw speech-start events pause first-listen recovery but do not cancel it unless a real caller transcript is accepted.
- Caller complaints like "you didn't answer" trigger a brief apology and exact greeting repeat.
- No model, voice, routing, provider, business knowledge, tools, or general VAD settings were changed.

Older opening-timing issue:

- Full greeting appears in transcript.
- Audio diagnostic shows greeting audio from about `1.0s` to `3.9s`.
- Caller said "Hello?" around `8.5s`.
- Agent did not respond until around `13.5s`.
- End of call had broken overlap.

Do not make additional voice fixes until the user reports the next test call or explicitly asks for a new change.

Likely next technical discussions:

- How to make greeting playout/listening unlock more deterministic.
- How to avoid false post-greeting dead air.
- How to keep current speakerphone progress without loosening the system.
- How to make off-menu restaurant handling happen before any spoken acknowledgment, not only inside persistence tools.
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
