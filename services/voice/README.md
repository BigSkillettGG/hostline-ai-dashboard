# HostLine Voice Service

This service is the production path for inbound restaurant phone calls.

## What It Does Today

- Serves Twilio Voice webhook TwiML at `POST /twilio/voice`.
- Connects calls to Twilio ConversationRelay over `wss://.../twilio/conversation-relay`.
- Searches and provisions Twilio numbers through internal telephony endpoints when Twilio credentials are configured.
- Processes queued menu URL/text ingestion jobs through `POST /ingestion/run-next`.
- Configures ConversationRelay to use ElevenLabs TTS by default.
- Receives ConversationRelay setup, prompt, DTMF, interrupt, and error messages.
- Generates restaurant-host replies with OpenAI Responses API when `OPENAI_API_KEY` is set.
- Falls back to deterministic restaurant-safe replies when OpenAI is not configured.
- Persists calls and transcript turns to Supabase when the server has a secret key and location ID.
- Loads the onboarded restaurant profile from Supabase for greetings, policies, hours, parking, reservation rules, menu items, FAQs, and knowledge sections.
- Creates staff-review pickup orders when the caller clearly asks for pickup/takeout and mentions recognized menu items.
- Records a staff-review order delivery attempt for each captured phone order.
- Creates staff-confirmed reservation requests when a caller provides date, time, party size, and guest details.
- Sends staff alerts by Supabase-configured route for captured orders, reservation requests, complaints, human handoffs, delivery failures, low-confidence reviews, and sales/vendor messages.
- Writes staff alert delivery audit rows to `staff_alert_events` for sent, skipped, and failed alerts.
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

If you enable `HOSTLINE_INTERNAL_API_KEY` while testing the dashboard provisioning UI, set the matching dashboard env var only in trusted local or admin builds:

```sh
VITE_HOSTLINE_INTERNAL_API_KEY=dev-only-key
```

Set your Twilio phone number Voice webhook to:

```text
POST https://your-tunnel.ngrok.app/twilio/voice
```

## Required Provider Setup

- Twilio account with ConversationRelay enabled and Predictive/Generative AI terms accepted.
- Twilio phone number pointed at `/twilio/voice`.
- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` for number search/provisioning.
- `HOSTLINE_INTERNAL_API_KEY` for protecting internal provisioning endpoints in production.
- OpenAI API key for real LLM replies.
- ElevenLabs voice ID for branded voice.
- `TWILIO_SMS_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID` for direct SMS staff alerts. `STAFF_ALERT_SMS_TO` remains the fallback recipient when no Supabase route is configured.
- `STAFF_ALERT_WEBHOOK_URL` for webhook alerts. Email recipients configured in the dashboard are included in the webhook payload for your email/helpdesk/Zapier layer.
- Supabase project with `docs/supabase-schema.sql` applied.
- `SUPABASE_SECRET_KEY` or legacy service role key stored only on the voice-service backend.
- `SUPABASE_DEMO_LOCATION_ID` set to a real `locations.id` value.

When Supabase is configured, Twilio requests can include `locationId` in the webhook URL or ConversationRelay custom parameters. The service loads `locations`, `agent_configs`, `onboarding_profiles`, `menu_categories`, `menu_items`, `knowledge_sections`, and `faqs` for that location. Without a matching profile, calls use the demo context.

## Internal Telephony Endpoints

- `GET /telephony/available-numbers?areaCode=415&limit=5` searches Twilio local numbers with voice and SMS enabled.
- `POST /telephony/provision-number` purchases a selected number, sets its voice webhook to `/twilio/voice?locationId=...`, writes `phone_numbers`, and updates `locations.ai_host_phone`.
- `POST /ingestion/run-next` processes one queued menu ingestion job, fetches URL/text content, parses menu items, replaces `menu_categories` and `menu_items`, and updates `ingestion_jobs` plus `menu_sources`.
- Staff alert routing is loaded from `alert_routing_configs` per location when Supabase is configured. If no route exists, the service falls back to `STAFF_ALERT_SMS_TO`.
- Staff alert outcomes are logged to `staff_alert_events` when Supabase is configured. Logging failures are warned but do not block the live call.

When `HOSTLINE_INTERNAL_API_KEY` is set, callers must send `x-hostline-api-key`. In production, provisioning and ingestion worker endpoints are rejected unless this key is configured.

## Important Safety Defaults

- Payment is pay at pickup.
- The AI does not collect card numbers.
- Staff-review orders are logged to the staff queue first. Kitchen printer, tablet, and POS delivery should stay explicit until each destination is connected and tested.
- Manual reservation requests are not confirmed until staff confirms them.
- Severe allergies are escalated or flagged for staff confirmation.
- Human handoff remains a first-class fallback path.
