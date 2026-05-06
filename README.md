# HostLine AI Dashboard

HostLine AI is an AI phone host for restaurants. This repository contains the admin dashboard generated with Lovable and hardened for the first real product pass.

## What The App Covers

- Calls, transcripts, summaries, outcomes, and review queues. The Calls page reads from Supabase when dashboard keys are configured and falls back to sample data otherwise.
- Pickup orders with pay-at-pickup workflow. The Orders page reads from Supabase when dashboard keys are configured, falls back to sample data otherwise, and persists status changes when live.
- Reservation bookings and manual staff-confirmed requests. The Reservations page reads from Supabase when dashboard keys are configured, persists status changes, and can create provider-tagged manual requests.
- Menu, availability, modifiers, prep times, and upsell suggestions. The Menu page can import pasted menu text into structured Supabase `menu_categories` and `menu_items` rows, with sample fallback when Supabase is not configured.
- Restaurant knowledge base and FAQs.
- Voice agent configuration.
- POS, reservation, printer, and kitchen tablet integration placeholders.

## Product Direction

The MVP focuses on missed calls and staff phone overload for independent restaurants and small multi-location groups. The dashboard should stay restaurant-type agnostic: each location configures whether the AI answers immediately, after several rings, after hours, or only when manually enabled.

See:

- `docs/mvp-spec.md`
- `docs/architecture.md`
- `docs/supabase-schema.sql`

## Local Development

```sh
npm install
npm run dev
```

The Lovable project uses Vite, React, TypeScript, Tailwind, shadcn/ui, Recharts, and React Router.

## Marketing Audio Demo

The homepage voice demo prefers full-call MP3 files in `public/audio`.

- `call-faq.mp3` powers the Hours and parking demo.
- `call-order.mp3` powers the Pickup order demo.

Scenarios without a full-call MP3 still play as timed transcript previews. The older ElevenLabs helper can still generate per-line clips while we iterate on voice direction:

```sh
ELEVENLABS_API_KEY=sk-... npm run marketing:audio
```

## Voice Service

The first production backend slice lives in `services/voice`.

```sh
cp .env.example .env.local
npm run dev:voice
```

It exposes:

- `POST /twilio/voice` for the Twilio Voice webhook.
- `wss://.../twilio/conversation-relay` for Twilio ConversationRelay.
- `POST /voice/preview` for ElevenLabs voice previews.
- `GET /telephony/available-numbers` and `POST /telephony/provision-number` for Twilio number launch.
- `POST /debug/reply` in non-production for testing restaurant replies.

It also includes Supabase FAQs and knowledge sections in live call replies, creates staff-review pickup orders from clear order language when menu items are recognized, and creates staff-confirmed reservation requests when date, time, party size, and guest details are captured. Orders are pay-at-pickup and are not auto-sent to the kitchen or POS.
Staff alerts can be sent by Twilio SMS or webhook for captured orders, reservation requests, complaints, and human handoffs.

See `services/voice/README.md` for provider setup.

## Onboarding

The app now includes a guided onboarding surface at `/app/onboarding`. It captures the restaurant profile, menu sources, service periods, order rules, reservation rules, policies, voice behavior, and phone launch details needed before the first test call.

When `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_DEMO_LOCATION_ID` are set, onboarding drafts sync to the `onboarding_profiles` table. Without those values, the dashboard saves the draft to local browser storage.

The Voice Agent settings page also persists locally and syncs to `agent_configs` when Supabase is configured. The voice service reads that table while building live restaurant call context.

The onboarding Phone launch card can search and assign Twilio numbers through the voice service. In local development the endpoints work without an internal key; for deployed environments, protect provisioning behind `HOSTLINE_INTERNAL_API_KEY` on the voice service and only expose a dashboard-side key from trusted admin/staging builds.

See:

- `docs/onboarding-knowledge-scope.md`
- `docs/production-roadmap.md`

## Next Engineering Milestones

1. Add file/link extraction jobs for uploaded PDFs, images, CSVs, and menu URLs.
2. Add Toast as the first POS integration.
3. Add OpenTable as the first live reservation API integration.
4. Add production auth, RLS, and organization/location switching.
