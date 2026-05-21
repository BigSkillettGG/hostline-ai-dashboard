# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Opening greeting post-audio listen-window hardening.
- Keep direct OpenAI Realtime SIP with `gpt-realtime-2`.
- Do not change LiveKit, ElevenLabs, ConversationRelay, routing, business knowledge, model, voice, or general VAD settings while validating this fix.
- Deploy the voice service before asking the user to retest Olive & Ember.

## Current Voice Situation

The latest analyzed Olive & Ember calls hit the correct OpenAI Realtime SIP path. The off-menu restaurant spoken-response issue has a code fix pending live deploy.

Most recent analyzed issue:

- Call id `5fe287f2-ca29-4b7d-9b4b-9712de9f511d`: caller heard the greeting, then said "I want to place an order for takeout."
- Database transcript showed only two agent greetings and no caller turn.
- Audio diagnostic showed the caller's takeout request at about `5.15s` to `7.25s`; SignalHost repeated the greeting around `14.1s`.

Diagnosis:

- The prior opening lock overcorrected and left input disabled too long after audible greeting completion.
- The first real caller request landed inside that deaf window.
- First-listen recovery repeated the greeting because no caller transcript had been accepted.

Fix implemented:

- Opening turn detection remains disabled during greeting generation and audio playout.
- When an opening audio-complete event arrives (`response.audio.done` or `output_audio_buffer.stopped`), SignalHost waits a short `700ms` guard and then restores listening.
- The longer transcript-estimated guard remains only as a fallback if the audio-complete event is missing.
- First-listen recovery still repeats the exact greeting only when no accepted caller turn arrives after listening is restored.
- No model, voice, routing, provider, business knowledge, tools, or general VAD settings were changed.

Older opening-timing issue:

- Full greeting appears in transcript.
- Audio diagnostic shows greeting audio from about `1.0s` to `3.9s`.
- Caller said "Hello?" around `8.5s`.
- Agent did not respond until around `13.5s`.
- End of call had broken overlap.

After deploy, retest Olive & Ember with: "I want to place an order for takeout." Expected behavior: SignalHost hears that first request and does not repeat the greeting.

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
