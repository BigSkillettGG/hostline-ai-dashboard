# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Narrow restaurant off-menu spoken-response guard.
- No model, VAD, voice, greeting, routing, provider, timing, or recording changes.
- Deploy the voice service before asking the user to retest the pepperoni-pizza scenario.

## Current Voice Situation

The latest analyzed Olive & Ember calls hit the correct OpenAI Realtime SIP path. The off-menu restaurant spoken-response issue has a code fix pending live deploy.

Current open issue:

- Long/important agent responses can still be partially audible to the caller even when the database transcript contains the full text.

Most recent off-menu retest:

- Call id `c5dd4f91-607e-4236-a5f3-ad9313b047c9`.
- Caller requested large pepperoni pizza and Caesar salad.
- Pepperoni pizza is not on the configured Olive & Ember menu.
- The model did not use a tool, so the backend off-menu guard did not fire.
- The agent shifted toward staff confirmation later, but first acknowledged "large pepperoni pizza" too confidently.
- The staff-confirmation sentence audibly cut off around "take", and the agent did not recover when the caller asked what it had been saying.

Fix implemented:

- Deterministic Realtime repair instructions now detect off-menu restaurant pickup-order items before spoken response.
- If an item is not on the configured menu, SignalHost must clarify and offer alternatives or staff confirmation before asking for name/phone.
- "You got interrupted / you didn't finish / what were you saying" now routes through the same off-menu clarification recovery when relevant.
- No model, VAD, voice, greeting, routing, provider, timing, or recording changes were made.

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
