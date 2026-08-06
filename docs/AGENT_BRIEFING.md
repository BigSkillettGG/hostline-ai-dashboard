# SignalHost Agent Briefing

Read this file before making changes. It is the persistent project memory for Codex and any other AI coding assistant working on SignalHost.

## Reload Ritual

At the start of a new work session, after context compaction, or before touching voice/routing code, read these files in order:

1. `docs/AGENT_BRIEFING.md`
2. `docs/FOUNDER_NOTES.md`
3. `docs/KNOWN_GOOD_STATE.md`
4. `docs/VOICE_QUALITY_LEDGER.md`
5. `docs/CHANGE_PROTOCOL.md`
6. `docs/NEXT_ACTIONS.md`
7. `docs/VOICE_BASELINE_LOCK.md` before changing live voice routing or Realtime tuning.

Then say: "I have reloaded the SignalHost project memory."

If the task involves phone calls, audio behavior, speakerphone behavior, OpenAI Realtime, Twilio, SIP, LiveKit, VAD, interruption handling, greeting behavior, recordings, transcripts, or call routing, do not skip this ritual.

## Product Truth

SignalHost is an AI front desk employee for local businesses. It answers phone calls, website chat, SMS, and email; uses a business-specific knowledge base; captures requests; sends links; alerts staff; reports to owners; and learns from owner corrections.

The current verticals are:

- Restaurants
- HVAC
- Plumbers
- Roofers
- Electricians
- Hair salons and barbershops

The product is no longer only a restaurant phone-answering app. Restaurants are one vertical in a broader SignalHost platform.

## Current Production Voice Direction

Preferred live-call path:

- Vapi-managed voice orchestration
- Current demo model: Vapi API value `gpt-5.2-chat-latest` (dashboard label GPT 5.2 Instant)
- Current demo voice: Vapi voice `Elliot`
- Fixed assistants attached to the six known-good demo numbers
- SignalHost `/vapi/webhook` for context, actions, transcripts, recordings, and owner workflows
- Supabase for calls, transcripts, tasks, requests, phone numbers, and demo data

Direct OpenAI Realtime SIP with `gpt-realtime-2`, OpenAI voices, and Twilio SIP routing remains the maintained fallback. Preserve its locked speakerphone behavior, but do not treat it as the preferred production runtime.

Do not treat ElevenLabs as the live-call voice provider. ElevenLabs was explored earlier and may still exist in preview/legacy code, tests, or docs, but it is not the default live-call runtime.

Do not route production demo calls back to Twilio ConversationRelay unless the user explicitly asks for legacy testing. ConversationRelay exists as legacy/fallback code and can produce a worse experience.

Do not route calls through LiveKit by default. LiveKit was tested as an experimental Harbor Plumbing speakerphone path, but it added complexity, latency, worker memory issues, and dead-air failures. Treat LiveKit as quarantined/experimental unless the user explicitly reopens it.

Vapi is the preferred production voice runtime after materially better handset and speakerphone tests. Legacy code and environment names still say `pilot`. It has its own docs and endpoints in `docs/vapi-pilot.md`, `/vapi/pilot-config`, `/vapi/sync-assistant`, `/vapi/sync-phone-number`, and `/vapi/webhook`. Keep provisioning automated and reversible; do not manually hand-build each demo unless debugging Vapi itself.

## Current Demo Businesses

Canonical demo data is in `docs/demo-testing-runbook.md`.

| Vertical | Business | Location ID | Current live number |
| --- | --- | --- | --- |
| Restaurants | Olive & Ember | `78d8053b-631d-4811-939f-61f0efe1d82a` | `+1 781 423 3898` |
| HVAC | Summit Air | `11111111-1111-4111-8111-111111111111` | `+1 617 545 0460` |
| Plumbers | Harbor Plumbing | `22222222-2222-4222-8222-222222222222` | `+1 781 694 6083` |
| Roofers | RidgeLine Roofing | `33333333-3333-4333-8333-333333333333` | `+1 508 290 3711` |
| Electricians | BrightWire Electric | `44444444-4444-4444-8444-444444444444` | `+1 978 933 7955` |
| Hair salons and barbershops | Luna Studio | `55555555-5555-4555-8555-555555555555` | `+1 339 330 4271` |

All demo numbers should answer as themselves, using their own knowledge base and vertical context. If a number answers as Olive & Ember, routing/location resolution is broken.

Current Vapi rollout demo numbers:

| Vertical | Business | Vapi number |
| --- | --- | --- |
| Restaurants | Olive & Ember | `+1 781 523 0245` |
| HVAC | Summit Air | `+1 781 523 0249` |
| Plumbers | Harbor Plumbing | `+1 781 523 0283` |
| Roofers | RidgeLine Roofing | `+1 508 905 1359` |
| Electricians | BrightWire Electric | `+1 978 384 2922` |
| Hair salons and barbershops | Luna Studio | `+1 781 523 0279` |

## Voice Behavior Requirements

Greeting must be:

```text
Thank you for calling {business name}. How can I help you?
```

This greeting should be upbeat, confident, and complete. It should not be cut off by echo, speakerphone leakage, background TV, or a false VAD event.

Never call a customer a "lead" out loud. Internally, customer requests can be lead-like, high-value, or sales opportunities, but caller-facing language should use words like request, details, message, appointment request, service request, reservation request, or follow-up.

After answering a question or completing a request, SignalHost should usually close the loop naturally:

```text
Can I help with anything else?
```

If the caller says no, SignalHost should say a short goodbye and end the call cleanly.

For high-risk or uncertain cases, SignalHost should not hallucinate. It should say it will check with the team and create a staff follow-up.

For severe allergies, safety risks, active leaks, electrical hazards, gas smell, complaints, refunds, legal/medical issues, and other sensitive topics, escalate or create a staff task instead of over-answering.

## Speakerphone and Audio Truth

Speakerphone reliability is a critical acceptance test. A call that works only with the phone against the caller's ear is not good enough.

The recurring failure pattern has been:

- The agent hears its own speech or faint speakerphone echo.
- False speech-start events interrupt or delay the agent.
- The greeting gets clipped or followed by dead air.
- The model sometimes responds to partial/noisy audio as if the caller spoke.

When diagnosing this, do not rely only on the database transcript. The transcript can say the greeting was spoken even when the recording shows the caller did not hear a clean, continuous greeting. Use the recording and audio diagnostic path.

## Call Listening and Debug Path

We can listen/analyze calls now. Do not say we cannot.

Use the deployed debug endpoint:

```text
GET https://hostline-voice.onrender.com/debug/calls/latest?locationId={LOCATION_ID}&audio=true
GET https://hostline-voice.onrender.com/debug/calls/{CALL_ID}?locationId={LOCATION_ID}&audio=true
```

These endpoints require voice-admin authorization with a Supabase bearer token. If local credentials are unavailable, ask the user for the latest call details or use available call JSON/recording URLs in `tmp/`.

The debug pack includes:

- Call row
- Twilio/OpenAI payload
- Transcript turns
- Observations
- Recording URL
- OpenAI audio diagnostic when `audio=true`

If needed, download the MP3 recording and inspect timing locally with `ffmpeg`.

Do not claim to have listened to audio unless you actually used the recording, audio diagnostic, or local audio analysis.

## Files That Explain The System

- Architecture: `docs/architecture.md`
- Demo testing: `docs/demo-testing-runbook.md`
- OpenAI Realtime: `docs/openai-realtime-pilot.md`
- LiveKit experiment: `docs/livekit-harbor-pilot.md`
- Vapi experiment: `docs/vapi-pilot.md`
- First live call: `docs/first-live-call-setup.md`
- Production deployment: `docs/deployment-production.md`
- Owner assistant: `docs/owner-assistant.md`
- Daily briefs: `docs/daily-brief.md`
- Business live updates: `docs/business-live-updates.md`
- Email provider: `docs/email-provider.md`
- Product roadmap: `docs/production-roadmap.md`

## Change Discipline

Voice quality changes are fragile. Do not change multiple independent variables in one patch unless the user explicitly approves.

Separate these concerns:

- Model choice
- Voice choice
- Greeting prompt
- Greeting playback timing
- Turn detection/VAD
- Manual response gating
- Interruption handling
- Business logic/tools
- Vertical playbook prompting
- Twilio/SIP routing
- Recording/logging

When a voice issue appears, first identify which path handled the call:

- `openai_realtime_sip`
- `livekit_agent`
- `twilio_conversation_relay`
- unknown

Then diagnose from the actual recording before proposing a fix.

## Things Not To Regress

- Keep SignalHost branding. Do not revert to HostLine in user-facing copy.
- Do not reintroduce neutral "AI host" language when "SignalHost" is intended.
- Do not use odd voice/persona names from the discarded set: Marin, Coral, Cedar, Verse.
- Do not make the agent sound like an IVR.
- Do not make flows rigid when the LLM can handle natural conversation.
- Do not hide uncertainty; escalate cleanly.
- Do not lose per-vertical behavior in onboarding, reports, analytics, or demo data.
- Do not remove recording/debug ability.
- Do not remove or bypass Supabase call logging.
- Do not delete the untracked `tmp/` diagnostics folder unless the user asks.
