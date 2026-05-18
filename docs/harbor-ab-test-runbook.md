# Harbor Voice A/B Test

Use Harbor Plumbing as the controlled test business. Keep the knowledge base, prompt, business hours, caller scenarios, and voice profile the same. Change only the phone transport.

## Variants

- **A: Direct OpenAI Realtime SIP**
  - Twilio number attached to the OpenAI SIP trunk.
  - OpenAI Realtime owns speech, turn detection, and the business tools.

- **B: LiveKit + OpenAI Realtime**
  - Twilio number points to `POST /twilio/livekit-voice?locationId=22222222-2222-4222-8222-222222222222`.
  - LiveKit owns SIP room handling, with OpenAI Realtime still acting as the brain and voice.

## Required Setup

- Harbor LiveKit number remains non-primary or primary as needed for the pilot.
- Harbor direct number is provisioned as an additional number with `makePrimary=false` so it does not replace the LiveKit pilot number on the location record.
- Use `POST /telephony/provision-number` with:
  - `locationId`: `22222222-2222-4222-8222-222222222222`
  - `areaCode`: a preferred test area code, usually `781` or `617`
  - `allowAdditionalNumber`: `true`
  - `makePrimary`: `false`
- Both variants must write calls to the same Harbor location:
  `22222222-2222-4222-8222-222222222222`.
- Both variants must attach recordings to `calls.recording_url`.

## Test Calls

Run the same calls against both numbers, ideally within the same 15-minute window.

1. Quiet handset:
   - “Hi, I have a leak under my kitchen sink. Can you help?”

2. Quiet speakerphone:
   - “My water heater is leaking. What should I do, and can someone come out?”

3. Background TV:
   - Ask about a clogged drain, then pause naturally before answering details.

4. Slow detail capture:
   - Give a name, address, and phone number slowly with pauses.

5. Closing:
   - After the agent asks whether anything else is needed, say “No, that’s it.”

## Scorecard

Score each category from 1 to 5.

- Greeting starts cleanly.
- Response latency feels natural.
- It does not interrupt itself or the caller.
- It ignores background TV/speakerphone noise.
- It captures name, address, phone, and issue correctly.
- It stays conversational, not IVR-like.
- It asks the right follow-up questions.
- It closes naturally after “No, that’s it.”
- Recording is attached and playable.
- Transcript matches the real audio.

## Decision Rule

Do not pick a winner from one call. Prefer the path that wins on repeatability:

- fewer false interruptions,
- fewer dead-air moments,
- lower perceived latency,
- better detail capture,
- better closeout,
- recordings that let us debug quickly.
