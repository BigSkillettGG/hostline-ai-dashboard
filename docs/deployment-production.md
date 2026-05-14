# Production Deployment

SignalHost has two deployable surfaces:

- Dashboard: Vite React app, hosted as a static site.
- Voice service: Node HTTP/WebSocket service that Twilio reaches for `/twilio/voice` and `/twilio/conversation-relay`.

## Dashboard Environment

```bash
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_DEMO_LOCATION_ID=<temporary-active-location-id>
VITE_VOICE_SERVICE_URL=https://voice.your-domain.com
```

Keep the Supabase service-role key out of the dashboard. Browser requests should use the publishable key plus the signed-in user's access token so RLS applies.

## Voice Service Environment

```bash
NODE_ENV=production
PORT=8787
PUBLIC_HTTP_BASE_URL=https://voice.your-domain.com
PUBLIC_WS_BASE_URL=wss://voice.your-domain.com
VOICE_SERVICE_ALLOWED_ORIGIN=https://app.your-domain.com
SIGNALHOST_INTERNAL_API_KEY=<optional-server-side-check-key>

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=<service-role-secret>
SUPABASE_DEMO_LOCATION_ID=<temporary-active-location-id>

DASHBOARD_PUBLIC_URL=https://app.your-domain.com
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_SUCCESS_URL=https://app.your-domain.com/app/billing?checkout=success
STRIPE_CANCEL_URL=https://app.your-domain.com/app/billing?checkout=cancelled
STRIPE_PORTAL_RETURN_URL=https://app.your-domain.com/app/billing

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
OWNER_REPORT_WEBHOOK_URL=https://hooks.example.com/signalhost-owner-report  # optional
EMAIL_PROVIDER=resend
EMAIL_FROM=SignalHost <reports@signalhost.ai>
EMAIL_REPLY_TO=support@signalhost.ai
OWNER_EMAIL_INBOUND_ADDRESS=updates@inbound.signalhost.ai
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
REQUIRE_TWILIO_SIGNATURE=true
TWILIO_SPEECH_TIMEOUT_MS=1800

OPENAI_API_KEY=...
OPENAI_MODEL=gpt-5-mini
OPENAI_REALTIME_MODEL=...
OPENAI_REALTIME_VERA_VOICE=...
OPENAI_REALTIME_MAYA_VOICE=...
OPENAI_REALTIME_MARCO_VOICE=...
OPENAI_REALTIME_THEO_VOICE=...
```

## Voice Service Build

Local production build:

```bash
npm run build:voice
npm run start:voice
```

Container build:

```bash
docker build -f services/voice/Dockerfile -t signalhost-voice .
docker run --env-file .env.production -p 8787:8787 signalhost-voice
```

Deployment hosts should run the image command:

```bash
node dist-voice/server.mjs
```

## Required Checks

The voice service `/health` response includes `productionReady` and `readinessChecks`. The `/ready` endpoint returns `200` only when required checks pass and `503` otherwise. The super admin Overview page displays these checks when `VITE_VOICE_SERVICE_URL` is set.

For billing, the owner Billing page calls `GET /billing/readiness?locationId=...`. Use that card before the first checkout test. It shows the exact Stripe webhook endpoint, required Stripe events, return URLs, test/live mode, and whether Supabase can persist billing state and convert the trial number to paid.

Required production checks:

- Public HTTP and WebSocket URLs are set.
- Dashboard origin is locked down; `VOICE_SERVICE_ALLOWED_ORIGIN=*` is not production-ready.
- Dashboard-to-voice admin requests are protected by Supabase user sessions.
- Supabase service-role access is configured for the voice service.
- OpenAI keys are present.
- Twilio account SID/auth token are present.
- Twilio signature validation is enabled.

Optional checks:

- Guest SMS confirmation sender is configured.
- Staff alert destination is configured.
- Direct email delivery is configured.

## Deployment Order

1. Run `docs/supabase-schema.sql`, then `docs/supabase-rls.sql`.
2. Create platform admin users and initial restaurant memberships.
3. Deploy the voice service with production secrets.
4. Point Twilio voice webhooks to `https://voice.your-domain.com/twilio/voice`.
5. Deploy the dashboard with `VITE_AUTH_MODE=supabase`.
6. Open the super admin Overview and confirm production readiness.
7. Run `npm run check:voice -- https://voice.your-domain.com`.

Set `SIGNALHOST_INTERNAL_API_KEY` only in the voice-service environment, or in the shell before running the check command, if you want server-side deployment checks to include live-call URL and TwiML preview checks. Do not expose it as a dashboard `VITE_` variable.

## First Live Call Checklist

Before assigning a customer-facing number:

- `/health` returns JSON with `ok: true`.
- `/ready` returns `200` and `productionReady: true`.
- `/twilio/live-call-config?locationId=<location-id>` returns `voiceWebhookUrl` and `conversationRelayUrl`.
- `/twilio/twiml-preview?locationId=<location-id>` returns a `<ConversationRelay>` TwiML response.
- Twilio number Voice webhook is `POST https://voice.your-domain.com/twilio/voice?locationId=<location-id>`.
- `PUBLIC_HTTP_BASE_URL` exactly matches the public HTTPS origin Twilio calls.
- `PUBLIC_WS_BASE_URL` is the same host with `wss://`.
- `REQUIRE_TWILIO_SIGNATURE=true`.
- The location has onboarding profile, agent config, FAQs, knowledge sections, and menu rows in Supabase.
- Super admin Overview shows all required readiness checks passing.
