# SignalHost Voice Service

This service is the production path for inbound restaurant phone calls.

## What It Does Today

- Serves Twilio Voice webhook TwiML at `POST /twilio/voice`.
- Connects calls to Twilio ConversationRelay over `wss://.../twilio/conversation-relay`.
- Searches and provisions Twilio numbers through internal telephony endpoints when Twilio credentials are configured.
- Processes queued menu URL/text ingestion jobs through `POST /ingestion/run-next`.
- Handles website chat messages at `POST /web-chat/message` using the same business context, configured links, and customer request fallback as the phone agent.
- Supports side-effect-free Scenario Lab reply testing at `POST /agent/test-reply` for dashboard QA and deploy smoke tests.
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
- Generates owner daily reports and can deliver them through SMS or an owner-report webhook.
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
docker build -f services/voice/Dockerfile -t signalhost-voice .
docker run --env-file .env.production -p 8787:8787 signalhost-voice
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

To exercise the curated Scenario Lab cases against a deployed service without placing live calls:

```sh
SIGNALHOST_INTERNAL_API_KEY=your-internal-key npm run scenario:lab -- --url https://voice.your-domain.com --location-id your-location-id
```

Useful filters:

```sh
npm run scenario:lab -- --url https://voice.your-domain.com --priority critical --strict
npm run scenario:lab -- --list
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
- Optional `SIGNALHOST_INTERNAL_API_KEY` for server-side deployment checks such as `scripts/check-voice-deployment.mjs`. Do not expose it as a dashboard `VITE_` variable.
- OpenAI API key for real LLM replies.
- ElevenLabs voice ID for branded voice.
- `TWILIO_SMS_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` for direct SMS staff alerts, guest confirmations, and owner daily reports. `STAFF_ALERT_SMS_TO` remains the fallback recipient when no Supabase route is configured.
- Optional `OWNER_REPORT_WEBHOOK_URL` for delivering owner daily report payloads to Zapier, Make, Slack, email automation, or another internal worker.
- `STAFF_ALERT_WEBHOOK_URL` for webhook alerts. Email recipients configured in the dashboard are included in the webhook payload for your email/helpdesk/Zapier layer.
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` for checkout, customer portal, and subscription status webhooks.
- Supabase project with `docs/supabase-schema.sql` applied.
- `SUPABASE_PUBLISHABLE_KEY` for validating Supabase user sessions.
- `SUPABASE_SECRET_KEY` or legacy service role key stored only on the voice-service backend.
- `SUPABASE_DEMO_LOCATION_ID` set to a real `locations.id` value.

When Supabase is configured, Twilio requests can include `locationId` in the webhook URL or ConversationRelay custom parameters. The service loads `locations`, `agent_configs`, `onboarding_profiles`, `menu_categories`, `menu_items`, `knowledge_sections`, and `faqs` for that location. Without a matching profile, calls use the demo context.

## Internal Telephony Endpoints

- `POST /tenant/bootstrap` creates the signed-in user's organization, owner membership, first location, onboarding profile, and default agent config after website signup. It requires a Supabase bearer token and uses the backend-only service role key.
- `GET /billing/status?locationId=...` returns the stored Stripe subscription state for the location's organization.
- `POST /billing/checkout-session` creates a Stripe subscription checkout session from SignalHost's server-side plan catalog and stores checkout-started state.
- `POST /billing/customer-portal` creates a Stripe customer portal session once a Stripe customer exists.
- `POST /stripe/webhook` verifies Stripe signatures and updates `billing_accounts` from checkout, subscription, and invoice events.
- `POST /owner-reports/daily` generates and saves today's owner report for the location.
- `POST /owner-reports/daily/deliver` generates and saves today's owner report, then delivers it to owner/manager contacts through SMS and/or `OWNER_REPORT_WEBHOOK_URL`. Use an internal API key from a Render Cron Job for scheduled delivery.
- `GET /telephony/available-numbers?areaCode=415&limit=5` searches Twilio local numbers with voice and SMS enabled.
- `POST /telephony/provision-number` purchases a selected number, sets its voice webhook to `/twilio/voice?locationId=...`, writes `phone_numbers`, and updates `locations.ai_host_phone`. If `phoneNumber` is omitted, the service searches Twilio with `areaCode`, `contains`, and `country`, then provisions the first match. When Supabase is configured, it refuses to buy a second unreleased active/trial number for the same location.
- `POST /telephony/release-number` releases a Twilio number by `providerSid` and marks the matching `phone_numbers` row as released.
- `POST /telephony/release-expired-trials` releases trial numbers whose grace period has ended. This endpoint is internal-key protected and supports `{ "dryRun": true }`.
- `GET /twilio/live-call-config?locationId=...` returns the generated live call URLs.
- `GET /twilio/twiml-preview?locationId=...` renders the TwiML preview used to verify ConversationRelay before calling.
- `POST /twilio/sms` receives inbound SMS replies for the shared SignalHost sender. Trusted owner/manager numbers are routed into owner-assistant commands first; customer replies still route to the most recent open message thread, ask for disambiguation if needed, and create a staff task for routed replies.
- `POST /agent/test-reply` accepts `{ message, locationId, channel, transcript, scenarioId }` and returns Vera's reply plus simulated tool actions. It is admin-protected and does not create real texts, orders, reservations, or staff callbacks.
- `POST /twilio/recording-status` receives Twilio recording callbacks. Configure Twilio call/SIP recording to send completed recording events to `https://your-voice-service/twilio/recording-status`; the service stores the MP3 URL on `calls.recording_url`.
- `POST /ingestion/run-next` processes one queued menu ingestion job, fetches URL/text content, parses menu items, replaces `menu_categories` and `menu_items`, and updates `ingestion_jobs` plus `menu_sources`.
- Staff alert routing is loaded from `alert_routing_configs` per location when Supabase is configured. If no route exists, the service falls back to `STAFF_ALERT_SMS_TO`.
- Staff alert outcomes are logged to `staff_alert_events` when Supabase is configured. Logging failures are warned but do not block the live call.
- `POST /web-chat/message` accepts `{ message, locationId, transcript, visitorName, visitorPhone, visitorEmail }` and returns a chat-friendly reply plus any created business-link or staff-request actions. This endpoint is public for embedded site widgets and is IP rate-limited.

In production, provisioning, menu ingestion, TwiML preview, live-call config, and hosted voice preview requests require a Supabase bearer token for a platform admin or a restaurant owner/admin. `SIGNALHOST_INTERNAL_API_KEY` remains a server-side-only legacy path for deployment checks.

## Important Safety Defaults

- Payment is pay at pickup.
- The AI does not collect card numbers.
- Staff-review orders are logged to the staff queue first. Kitchen printer, tablet, and POS delivery should stay explicit until each destination is connected and tested.
- Manual reservation requests are not confirmed until staff confirms them.
- Severe allergies are escalated or flagged for staff confirmation.
- Human handoff remains a first-class fallback path.
