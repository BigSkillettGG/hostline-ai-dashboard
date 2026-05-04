# HostLine Voice Service

This service is the production path for inbound restaurant phone calls.

## What It Does Today

- Serves Twilio Voice webhook TwiML at `POST /twilio/voice`.
- Connects calls to Twilio ConversationRelay over `wss://.../twilio/conversation-relay`.
- Configures ConversationRelay to use ElevenLabs TTS by default.
- Receives ConversationRelay setup, prompt, DTMF, interrupt, and error messages.
- Generates restaurant-host replies with OpenAI Responses API when `OPENAI_API_KEY` is set.
- Falls back to deterministic restaurant-safe replies when OpenAI is not configured.
- Persists calls and transcript turns to Supabase when the server has a secret key and location ID.
- Provides a direct ElevenLabs preview endpoint at `POST /voice/preview`.
- Validates Twilio signatures when `REQUIRE_TWILIO_SIGNATURE=true`.

## Local Run

```sh
cp .env.example .env.local
npm run dev:voice
```

For local Twilio testing, expose the service with a tunnel such as ngrok and set:

```sh
PUBLIC_HTTP_BASE_URL=https://your-tunnel.ngrok.app
PUBLIC_WS_BASE_URL=wss://your-tunnel.ngrok.app
VITE_VOICE_SERVICE_URL=https://your-tunnel.ngrok.app
```

Set your Twilio phone number Voice webhook to:

```text
POST https://your-tunnel.ngrok.app/twilio/voice
```

## Required Provider Setup

- Twilio account with ConversationRelay enabled and Predictive/Generative AI terms accepted.
- Twilio phone number pointed at `/twilio/voice`.
- OpenAI API key for real LLM replies.
- ElevenLabs voice ID for branded voice.
- Supabase project with `docs/supabase-schema.sql` applied.
- `SUPABASE_SECRET_KEY` or legacy service role key stored only on the voice-service backend.
- `SUPABASE_DEMO_LOCATION_ID` set to a real `locations.id` value.

## Important Safety Defaults

- Payment is pay at pickup.
- The AI does not collect card numbers.
- Manual reservation requests are not confirmed until staff confirms them.
- Severe allergies are escalated or flagged for staff confirmation.
- Human handoff remains a first-class fallback path.
