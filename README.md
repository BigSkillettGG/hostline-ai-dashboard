# HostLine AI Dashboard

HostLine AI is an AI phone host for restaurants. This repository contains the admin dashboard generated with Lovable and hardened for the first real product pass.

## What The App Covers

- Calls, transcripts, summaries, outcomes, and review queues. The Calls page reads from Supabase when dashboard keys are configured and falls back to sample data otherwise.
- Pickup orders with pay-at-pickup workflow. The Orders page reads from Supabase when dashboard keys are configured, falls back to sample data otherwise, and persists status changes when live.
- Reservation bookings and manual staff-confirmed requests.
- Menu, availability, modifiers, prep times, and upsell suggestions.
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
- `POST /debug/reply` in non-production for testing restaurant replies.

It also creates staff-review pickup orders from clear order language when menu items are recognized. These orders are pay-at-pickup and are not auto-sent to the kitchen or POS.

See `services/voice/README.md` for provider setup.

## Onboarding

The app now includes a guided onboarding surface at `/app/onboarding`. It captures the restaurant profile, menu sources, service periods, order rules, reservation rules, policies, voice behavior, and phone launch details needed before the first test call.

When `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and `VITE_SUPABASE_DEMO_LOCATION_ID` are set, onboarding drafts sync to the `onboarding_profiles` table. Without those values, the dashboard saves the draft to local browser storage.

See:

- `docs/onboarding-knowledge-scope.md`
- `docs/production-roadmap.md`

## Next Engineering Milestones

1. Expand menu ingestion so uploaded/linked menus create structured menu rows.
2. Connect dashboard reservations to Supabase queries.
3. Implement FAQ calls from the restaurant knowledge base.
4. Add staff notification channels for orders, complaints, and handoffs.
5. Add Toast as the first POS integration.
6. Add OpenTable as the first reservation integration.
