# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Post-greeting agent-response input-lock hardening.
- Keep direct OpenAI Realtime SIP with `gpt-realtime-2`.
- Do not change LiveKit, ElevenLabs, ConversationRelay, routing, business knowledge, model, voice, or general VAD settings while validating this fix.
- Deploy the voice service before asking the user to retest Olive & Ember.

## Current Voice Situation

The latest analyzed Olive & Ember calls hit the correct OpenAI Realtime SIP path. The current code fix is pending live deploy.

Most recent analyzed issue:

- Call id `38959f15-825a-47a4-80eb-772a5102291b`: caller heard the greeting, asked to order takeout, then asked for one large pepperoni pizza and one Caesar salad.
- SignalHost asked what the caller wanted and then started the correct off-menu response.
- Audio diagnostic showed the response cut out after "I don't see..." and the caller had to say "Hello?"

Diagnosis:

- Opening greeting and first request capture are now working for this call.
- The remaining failure was a post-greeting response race.
- Normal agent replies were disabling turn detection only after OpenAI emitted `response.created`.
- That is too late: after `response.create` is sent, speakerphone or handset echo can already race the response.

Fix implemented:

- Added a single helper that disables Realtime input turn detection before every post-opening agent `response.create`.
- Routed manual replies, first-listen recovery, idle prompts, and tool follow-up replies through that helper.
- Kept the `response.created` listener as a backup safety net.
- No model, voice, routing, provider, business knowledge, tools, or general VAD settings were changed.

Recently fixed opening-timing issue:

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
