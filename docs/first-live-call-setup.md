# First Live Call Setup

This checklist gets SignalHost from deployed code to the first real call with Vera.

## Secrets You Need

Dashboard build:

```bash
VITE_AUTH_MODE=supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
VITE_SUPABASE_DEMO_LOCATION_ID=<locations.id>
VITE_VOICE_SERVICE_URL=https://voice.your-domain.com
```

Voice service:

```bash
NODE_ENV=production
PORT=8787
PUBLIC_HTTP_BASE_URL=https://voice.your-domain.com
PUBLIC_WS_BASE_URL=wss://voice.your-domain.com
VOICE_SERVICE_ALLOWED_ORIGIN=https://app.your-domain.com
SIGNALHOST_INTERNAL_API_KEY=<optional-server-side-check-key>

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=<sb_secret_... or legacy service_role JWT>
SUPABASE_DEMO_LOCATION_ID=<locations.id>

TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_MESSAGING_SERVICE_SID=MG...
TWILIO_DEFAULT_COUNTRY=US
REQUIRE_TWILIO_SIGNATURE=true
TWILIO_SPEECH_TIMEOUT_MS=1800
TWILIO_LANGUAGE=en-US
EMAIL_PROVIDER=resend
EMAIL_FROM=SignalHost <reports@signalhost.ai>
EMAIL_REPLY_TO=support@signalhost.ai
RESEND_API_KEY=re_...

OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-5-mini
OPENAI_REPLY_TIMEOUT_MS=4500
OPENAI_REALTIME_MODEL=...
OPENAI_REALTIME_VERA_VOICE=...
OPENAI_REALTIME_MAYA_VOICE=...
OPENAI_REALTIME_MARCO_VOICE=...
OPENAI_REALTIME_THEO_VOICE=...
```

Do not commit any real secret values. Put them in the deployment provider's environment variable UI. For local-only testing, put them in `.env.local`, which is gitignored.

Dashboard-to-voice admin requests use the signed-in Supabase user's bearer token. Do not create a `VITE_SIGNALHOST_INTERNAL_API_KEY`; browser-exposed internal keys are not a production-safe control.

## Supabase

1. Create a Supabase project.
2. Run `docs/supabase-schema.sql`.
3. Run `docs/supabase-rls.sql`.
4. Create one `organizations` row and one `locations` row.
5. Copy that `locations.id` into `SUPABASE_DEMO_LOCATION_ID` and `VITE_SUPABASE_DEMO_LOCATION_ID`.
6. Create a Supabase Auth user for yourself.
7. Insert a `user_memberships` row with role `owner`.
8. Insert a `platform_admins` row for your user if you want super admin access.
9. Add onboarding profile, agent config, FAQs, knowledge sections, and menu rows for the test location.

## Deploy Voice Service

The voice service can deploy from `services/voice/Dockerfile`.

Build command:

```bash
npm run build:voice
```

Start command:

```bash
npm run start:voice
```

After deploy:

```bash
SIGNALHOST_INTERNAL_API_KEY=<optional-server-side-check-key> npm run check:voice -- https://voice.your-domain.com <locations.id>
```

The super admin Telephony page shows the same first-call readiness path in the dashboard. Use it as the no-terminal checklist once Lovable and the voice-service deploy have their environment variables set.

The check should show:

- Health: ok
- Production ready: yes
- Voice webhook URL
- OpenAI Realtime SIP readiness or legacy ConversationRelay websocket URL
- TwiML preview: ok

## Configure Twilio

1. Buy or use a Twilio voice-capable phone number.
2. Set the number's Voice webhook to the Telephony page's generated URL:

```text
POST https://voice.your-domain.com/twilio/voice?locationId=<locations.id>
```

3. Keep `REQUIRE_TWILIO_SIGNATURE=true`.
4. Call the number.

## First Test Call Script

Use short calls first:

1. "What time are you open tonight?"
2. "Do you have parking?"
3. "I want to place a pickup order."
4. "One margherita pizza."
5. "And a caesar salad."
6. "That's all, under Tim."
7. "Can I make a reservation tomorrow at 7 for four under Tim?"
8. "I have a severe peanut allergy."
9. "The connection is bad, can you repeat that?"

After the call, check:

- Super admin Telephony readiness.
- Calls page transcript.
- Orders page staff-review order.
- Reservations page staff-review request.
- Tasks page for allergy/low-confidence review or complaint/handoff tasks.
