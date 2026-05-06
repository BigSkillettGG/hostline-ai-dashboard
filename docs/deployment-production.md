# Production Deployment

HostLine has two deployable surfaces:

- Dashboard: Vite React app, hosted as a static site.
- Voice service: Node HTTP/WebSocket service that Twilio reaches for `/twilio/voice` and `/twilio/conversation-relay`.

## Dashboard Environment

```bash
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_DEMO_LOCATION_ID=<temporary-active-location-id>
VITE_VOICE_SERVICE_URL=https://voice.your-domain.com
VITE_HOSTLINE_INTERNAL_API_KEY=<same-value-as-voice-service>
```

Keep the Supabase service-role key out of the dashboard. Browser requests should use the publishable key plus the signed-in user's access token so RLS applies.

## Voice Service Environment

```bash
NODE_ENV=production
PORT=8787
PUBLIC_HTTP_BASE_URL=https://voice.your-domain.com
PUBLIC_WS_BASE_URL=wss://voice.your-domain.com
VOICE_SERVICE_ALLOWED_ORIGIN=https://app.your-domain.com
HOSTLINE_INTERNAL_API_KEY=<random-strong-secret>

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=<service-role-secret>
SUPABASE_DEMO_LOCATION_ID=<temporary-active-location-id>

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
REQUIRE_TWILIO_SIGNATURE=true

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini

ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=UgBBYS2sOqTuMpoF3BR0
ELEVENLABS_MODEL_ID=eleven_flash_v2_5
```

## Required Checks

The voice service `/health` response includes `productionReady` and `readinessChecks`. The super admin Overview page displays these checks when `VITE_VOICE_SERVICE_URL` is set.

Required production checks:

- Public HTTP and WebSocket URLs are set.
- Dashboard origin is locked down; `VOICE_SERVICE_ALLOWED_ORIGIN=*` is not production-ready.
- Internal API key is set on both dashboard and voice service.
- Supabase service-role access is configured for the voice service.
- OpenAI and ElevenLabs keys are present.
- Twilio account SID/auth token are present.
- Twilio signature validation is enabled.

Optional checks:

- Guest SMS confirmation sender is configured.
- Staff alert destination is configured.

## Deployment Order

1. Run `docs/supabase-schema.sql`, then `docs/supabase-rls.sql`.
2. Create platform admin users and initial restaurant memberships.
3. Deploy the voice service with production secrets.
4. Point Twilio voice webhooks to `https://voice.your-domain.com/twilio/voice`.
5. Deploy the dashboard with `VITE_AUTH_MODE=supabase`.
6. Open the super admin Overview and confirm production readiness.
