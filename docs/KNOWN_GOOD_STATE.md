# Known Good State

This file records what must be preserved. Read it before changing voice behavior, routing, onboarding, reporting, demo data, or owner-assistant features.

## Current Strategic State

SignalHost should feel like an AI front desk employee, not an IVR.

The strongest product direction is:

- Answer customers by phone, chat, SMS, and email.
- Use structured business knowledge from onboarding.
- Capture requests cleanly.
- Alert the right owner/manager/staff contact.
- Report what happened.
- Learn from corrections and temporary updates.
- Help recover revenue through follow-up.

## Known Good Voice Direction

Baseline details are frozen in `docs/VOICE_BASELINE_LOCK.md`. Read that file before changing live voice routing or Realtime tuning.

Primary live calls should use:

- OpenAI Realtime SIP
- `gpt-realtime-2`
- OpenAI Realtime voices
- Twilio number/SIP trunk routing
- Supabase call logging

The user liked:

- More expressive `gpt-realtime-2` speech.
- Natural probing questions when they qualify the request without sounding rigid.
- The agent explaining the next step when it feels human and useful.
- Low-noise speakerphone calls that get all the way through.

Preserve these.

## Known Bad Or Quarantined Paths

Do not accidentally revert to these:

- ElevenLabs for live calls.
- Twilio ConversationRelay as the main experience.
- LiveKit as default routing.
- Vapi as default routing.
- Odd/non-human voice names like Marin, Coral, Cedar, or Verse.
- Rigid IVR-style flows that ignore the LLM's conversational ability.

LiveKit may remain in code/docs as an experiment, but it is not the default unless the user explicitly restarts that pilot.

Vapi may remain in code/docs as an experiment, but it is not the default unless the user explicitly starts a controlled A/B pilot.

## Greeting Contract

Every business should answer:

```text
Thank you for calling {business name}. How can I help you?
```

The greeting should:

- Be complete and audible.
- Sound upbeat and confident.
- Not introduce the assistant by name by default.
- Not say it is virtual by default.
- Not be interrupted by echo or background noise.

Post-greeting agent replies should also protect themselves from echo:

- Any normal post-opening agent speech must lock Realtime input before `response.create`.
- Do not rely on `response.created` as the first moment to disable listening; that is only a backup.
- Clear Realtime `input_audio_buffer` before each post-opening `response.create`.
- Clear Realtime `input_audio_buffer` before restoring listening after greeting audio and normal agent audio.

If a caller asks "Is this Harbor Plumbing?" the correct shape is:

```text
Yes, you've reached Harbor Plumbing. How can I help you?
```

Do not say the assistant is not Harbor Plumbing in a confusing way.

## Caller Language Contract

Never call the caller a "lead."

Allowed caller-facing alternatives:

- request
- service request
- message
- details
- appointment request
- reservation request
- order request
- follow-up

Internal systems may still use lead/opportunity/value-tier concepts.

## Demo Data Contract

The six demo businesses should stay vertical-specific:

- Olive & Ember: restaurant
- Summit Air: HVAC
- Harbor Plumbing: plumbing
- RidgeLine Roofing: roofing
- BrightWire Electric: electrical
- Luna Studio: salon/barbershop

Reports, analytics, onboarding questions, and demo knowledge must stay vertical-specific. Electricians should not see reservation language. Restaurants should not see HVAC service-area triage unless the product intentionally supports a cross-vertical generic field.

## Owner Assistant Contract

Owners and trusted contacts should be able to communicate with SignalHost through:

- Dashboard
- Phone
- SMS when available
- Email when available

Owner commands should share the same command router regardless of channel. Permanent/sensitive knowledge changes may require approval depending on permissions. Temporary updates can usually apply immediately with expiration.

## Debugging Contract

When the user says a call went badly, do not guess from memory.

Required sequence:

1. Identify the business and approximate call time.
2. Fetch the latest call or exact call id from Supabase/debug endpoint.
3. Confirm the call path.
4. Use `/debug/calls/{id}?audio=true`.
5. Compare database transcript against audio diagnostic.
6. Summarize what actually happened.
7. Only then propose a fix.

Do not say we cannot listen to calls. We can analyze the recording through the deployed debug path when a recording is attached.

## Current Risk Area

The current high-risk area is speakerphone echo and greeting/listening timing.

Do not make broad changes to business logic, vertical prompts, or owner flows while trying to fix speakerphone behavior. Keep audio-path fixes narrow and reversible.

## Opening Greeting Lock

The opening greeting is special. Do not treat it like a normal agent response.

For the first greeting:

- Start the session with input turn detection set to `null`.
- Send the exact greeting: `Thank you for calling {business name}. How can I help you?`
- Do not restore caller listening on `response.done`.
- Do not restore caller listening on `response.audio.done` instantly.
- Restore caller listening after the opening audio-complete event plus the short opening playout guard.
- Keep the longer transcript-estimated guard only as a fallback if the audio-complete event is missing.
- Do not let raw `input_audio_buffer.speech_started` cancel the first-listen recovery unless an accepted caller transcript arrives.
- Keep generic response latency tight: manual response delay defaults to `300ms` and caps at `500ms`; server VAD silence defaults to `600ms` and caps at `700ms`.

Reason:

- The database transcript can contain the full greeting before PSTN audio is safely heard by the caller.
- Speakerphone or handset echo can trigger false speech-start events during the opening.
- The safest current fix is a hard opening playout lock during the greeting, followed by a short post-audio guard so the first real caller request is not missed.
