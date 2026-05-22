# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Convert the manual Vapi pilot into repeatable demo provisioning.
- Keep the voice behavior untouched while adding automation.
- Extend the same SignalHost/Vapi setup to all six demo vertical businesses once tested.

Status update:

- Vapi pilot location allow-list now includes all six demo businesses.
- Vapi demo provisioning has been run successfully for all six demos.
- `scripts/provision-vapi-demos.mjs` is now idempotent: it reuses an active Vapi number for a demo location instead of creating another one, unless `--force-new-phone-number` is explicitly passed.
- The script now tries alternate area codes when Vapi has no number inventory in the preferred area code.

Current Vapi demo numbers:

| Business | Vapi number |
| --- | --- |
| Olive & Ember | `+1 781 523 0245` |
| Summit Air | `+1 781 523 0249` |
| Harbor Plumbing | `+1 781 523 0283` |
| RidgeLine Roofing | `+1 508 905 1359` |
| BrightWire Electric | `+1 978 384 2922` |
| Luna Studio | `+1 781 523 0279` |

Cleanup note:

- Supabase also shows older extra Vapi rows for Olive & Ember: `+1 781 523 0266` and `+1 781 523 0284`.
- They are not the current primary `ai_host_phone`, but they should be released/removed from Vapi later so they do not clutter the Vapi account.

## Current Voice Situation

Vapi pilot scaffolding has been added and is now the preferred controlled demo-rollout path:

- Admin config endpoint: `/vapi/pilot-config`
- Assistant sync endpoint: `/vapi/sync-assistant`
- Phone-number sync endpoint: `/vapi/sync-phone-number`
- Server webhook endpoint: `/vapi/webhook`
- Setup/runbook: `docs/vapi-pilot.md`
- Bulk demo script: `npm run provision:vapi-demos`
- It reuses SignalHost business context, tools, and call logging.
- The user explicitly approved extending Vapi to the other demo businesses after strong test calls.

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

## Current Vapi Demo State

As of 2026-05-22, the six primary demo businesses are on fixed Vapi assistants
attached to their existing Vapi phone numbers. Do not rely on Vapi dynamic
assistant-request routing for these demos unless intentionally retesting it.

Current primary numbers:

- Olive & Ember: `+1 781 523 0245`
- Summit Air: `+1 781 523 0249`
- Harbor Plumbing: `+1 781 523 0283`
- RidgeLine Roofing: `+1 508 905 1359`
- BrightWire Electric: `+1 978 384 2922`
- Luna Studio: `+1 781 523 0279`

Vapi fixed assistant sync works only after omitting custom `serverMessages`; let
Vapi use its default server events for tool calls and end-of-call reports.

Known cleanup: older Olive & Ember Vapi rows for `+1 781 523 0266` and
`+1 781 523 0284` still appear in `phone_numbers` as active and are not the
current primary test numbers.

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
