## Goal

Get ElevenLabs, OpenAI, and Twilio credentials wired up in two places:
1. **Lovable Cloud** — so future in-app features (edge functions) can use them.
2. **The `services/voice/` Node service** — so the actual phone backend can run end-to-end.

## Step 1 — Link / create connections (Lovable side)

I will:

- **Twilio** — link the existing workspace connection (`std_01kmr6t25ke6zt3trv4npn9z81`) to this project. No new credentials needed from you. This exposes `TWILIO_API_KEY` (gateway key) to edge functions.
- **ElevenLabs** — start the connect flow. You will paste an ElevenLabs API key (from elevenlabs.io → Profile → API Keys → "Create API Key", scoped to Text-to-Speech + Conversational AI).
- **OpenAI** — add as a Lovable Cloud secret named `OPENAI_API_KEY` via the secure secret prompt (you'll paste your key — never share it in chat).

Lovable Cloud will be enabled if it isn't already (required to store secrets).

## Step 2 — Voice service environment variables (your hosting provider)

The `services/voice/` Node service runs outside Lovable. I cannot push secrets to its host. Instead I'll give you the exact list to paste into your host's env-var UI (Fly, Render, Railway, Docker, etc.). Based on `.env.example` and `services/voice/src/env.ts`, the keys you need to set there are:

```text
# Twilio
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...   # optional, for SMS confirmations
REQUIRE_TWILIO_SIGNATURE=true

# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=BZgkqPqms7Kj9ulSkVzn
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

Note: the voice service uses Twilio's classic Account SID + Auth Token (not the gateway), so even though Lovable's Twilio connector is linked, the voice host still needs its own raw Twilio credentials. You can grab those from console.twilio.com → Account → API keys & tokens.

## Step 3 — Verify

- Run `fetch_secrets` to confirm `TWILIO_API_KEY`, `ELEVENLABS_API_KEY`, `OPENAI_API_KEY` are present in Lovable Cloud.
- For the voice service, after you set its env vars and redeploy, run the existing readiness check:
  ```sh
  npm run check:voice -- https://voice.your-domain.com <locations.id>
  ```
  Expected: "Production ready: yes".

## Out of scope

- No code changes in this pass. No new features built. Just credentials wired up so you (or a follow-up plan) can build on them.
- I will not modify `services/voice/` source — only document the env vars it needs.

## What you'll need ready before I implement

- ElevenLabs API key
- OpenAI API key (you confirmed you have one)
- Twilio Account SID + Auth Token (for the voice service host only — the workspace connection covers Lovable Cloud)
