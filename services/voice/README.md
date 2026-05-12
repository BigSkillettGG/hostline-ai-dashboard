# HostLine Voice Service

This service is the production path for inbound restaurant phone calls.

## What It Does Today

- Serves Twilio Voice webhook TwiML at `POST /twilio/voice`.
- Connects calls to Twilio ConversationRelay over `wss://.../twilio/conversation-relay`.
- Searches and provisions Twilio numbers through internal telephony endpoints when Twilio credentials are configured.
- Processes queued menu URL/text ingestion jobs through `POST /ingestion/run-next`.
- Handles website chat messages at `POST /web-chat/message` using the same business context, configured links, and customer request fallback as the phone agent.
- Configures ConversationRelay to use ElevenLabs TTS by default.
- Receives ConversationRelay setup, prompt, DTMF, interrupt, and error messages.
- Generates restaurant-host replies with OpenAI Responses API when `OPENAI_API_KEY` is set.
- Falls back to deterministic restaurant-safe replies when OpenAI is not configured.
- Uses a fast phone-host playbook before OpenAI for routine and high-risk calls such as complaints, vendor calls, lost items, delivery drivers, order changes, allergies, payment safety, and wrong numbers.
- Times out slow OpenAI replies using `OPENAI_REPLY_TIMEOUT_MS` and falls back safely instead of leaving dead air.
- Handles unclear audio, bad connections, and rude callers with short recovery replies and staff-review tasks when needed.
- Persists calls and transcript turns to Supabase when the server has a secret key and location ID.
- Persists OpenAI Realtime SIP calls to Supabase, including caller/agent transcript turns, call summary, intent/outcome, and staff-review status.
- Accepts Twilio recording status callbacks at `POST /twilio/recording-status` and attaches the recording URL to the matching call row.
- Loads the onboarded restaurant profile from Supabase for greetings, policies, hours, parking, reservation rules, menu items, FAQs, and knowledge sections.
- Creates staff-review pickup orders when the caller clearly asks for pickup/takeout and mentions recognized menu items.
- Accumulates multi-turn pickup order drafts, so callers can pause between items before saying they are done.
- Records a staff-review order delivery attempt for each captured phone order.
- Creates staff-confirmed reservation requests when a caller provides date, time, party size, and guest details.
- Sends staff alerts by Supabase-configured route for captured orders, reservation requests, complaints, human handoffs, delivery failures, low-confidence reviews, and sales/vendor messages.
- Writes staff alert delivery audit rows to `staff_alert_events` for sent, skipped, and failed alerts.
- Provides a direct ElevenLabs preview endpoint at `POST /voice/preview`.
- Validates Twilio signatures when `REQUIRE_TWILIO_SIGNATURE=true`.
- Caps request body sizes and rate-limits expensive admin/preview endpoints to protect provider spend and service stability.

## Local Run

```sh
cp .env.example .env.local
npm run dev:voice
```

## Production Build

```sh
npm run build:voice
npm run start:voice
```

The production build bundles the TypeScript service to `dist-voice/server.mjs` and runs it with plain Node. The Docker image uses the same build output.

```sh
docker build -f services/voice/Dockerfile -t hostline-voice .
docker run --env-file .env.production -p 8787:8787 hostline-voice
```

Health endpoints:

- `GET /health`: liveness plus readiness details. This should stay `200` so the host knows the process is alive.
- `GET /ready`: returns `200` only when required production secrets, public URLs, CORS, and Twilio signature checks are ready.
- `GET /twilio/live-call-config`: Supabase-authenticated admin endpoint that returns the exact Twilio Voice webhook, ConversationRelay websocket, and callback URLs for a location.
- `GET /twilio/twiml-preview`: Supabase-authenticated admin endpoint that renders the TwiML Twilio will receive for the first live call.

After deployment:

```sh
npm run check:voice -- https://voice.your-domain.com
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
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` for number search/provisioning.
- Supabase Auth plus `SUPABASE_SECRET_KEY` for protecting dashboard admin endpoints in production.
- Optional `HOSTLINE_INTERNAL_API_KEY` for server-side deployment checks such as `scripts/check-voice-deployment.mjs`. Do not expose it as a dashboard `VITE_` variable.
- OpenAI API key for real LLM replies.
- ElevenLabs voice ID for branded voice.
- `TWILIO_SMS_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` for direct SMS staff alerts. `STAFF_ALERT_SMS_TO` remains the fallback recipient when no Supabase route is configured.
- `STAFF_ALERT_WEBHOOK_URL` for webhook alerts. Email recipients configured in the dashboard are included in the webhook payload for your email/helpdesk/Zapier layer.
- Supabase project with `docs/supabase-schema.sql` applied.
- `SUPABASE_PUBLISHABLE_KEY` for validating Supabase user sessions.
- `SUPABASE_SECRET_KEY` or legacy service role key stored only on the voice-service backend.
- `SUPABASE_DEMO_LOCATION_ID` set to a real `locations.id` value.

When Supabase is configured, Twilio requests can include `locationId` in the webhook URL or ConversationRelay custom parameters. The service loads `locations`, `agent_configs`, `onboarding_profiles`, `menu_categories`, `menu_items`, `knowledge_sections`, and `faqs` for that location. Without a matching profile, calls use the demo context.

## Internal Telephony Endpoints

- `GET /telephony/available-numbers?areaCode=415&limit=5` searches Twilio local numbers with voice and SMS enabled.
- `POST /telephony/provision-number` purchases a selected number, sets its voice webhook to `/twilio/voice?locationId=...`, writes `phone_numbers`, and updates `locations.ai_host_phone`.
- `GET /twilio/live-call-config?locationId=...` returns the generated live call URLs.
- `GET /twilio/twiml-preview?locationId=...` renders the TwiML preview used to verify ConversationRelay before calling.
- `POST /twilio/recording-status` receives Twilio recording callbacks. Configure Twilio call/SIP recording to send completed recording events to `https://your-voice-service/twilio/recording-status`; the service stores the MP3 URL on `calls.recording_url`.
- `POST /ingestion/run-next` processes one queued menu ingestion job, fetches URL/text content, parses menu items, replaces `menu_categories` and `menu_items`, and updates `ingestion_jobs` plus `menu_sources`.
- Staff alert routing is loaded from `alert_routing_configs` per location when Supabase is configured. If no route exists, the service falls back to `STAFF_ALERT_SMS_TO`.
- Staff alert outcomes are logged to `staff_alert_events` when Supabase is configured. Logging failures are warned but do not block the live call.
- `POST /web-chat/message` accepts `{ message, locationId, transcript, visitorName, visitorPhone, visitorEmail }` and returns a chat-friendly reply plus any created business-link or staff-request actions. This endpoint is public for embedded site widgets and is IP rate-limited.

In production, provisioning, menu ingestion, TwiML preview, live-call config, and hosted voice preview requests require a Supabase bearer token for a platform admin or a restaurant owner/admin. `HOSTLINE_INTERNAL_API_KEY` remains a server-side-only legacy path for deployment checks.

## Important Safety Defaults

- Payment is pay at pickup.
- The AI does not collect card numbers.
- Staff-review orders are logged to the staff queue first. Kitchen printer, tablet, and POS delivery should stay explicit until each destination is connected and tested.
- Manual reservation requests are not confirmed until staff confirms them.
- Severe allergies are escalated or flagged for staff confirmation.
- Human handoff remains a first-class fallback path.
