# HostLine AI Dashboard

HostLine AI is an AI phone host for restaurants. This repository contains the admin dashboard generated with Lovable and hardened for the first real product pass.

## What The App Covers

- Calls, transcripts, summaries, outcomes, and review queues. The Calls page reads from Supabase when dashboard keys are configured and falls back to sample data otherwise.
- Pickup orders with pay-at-pickup workflow.
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

See `services/voice/README.md` for provider setup.

## Next Engineering Milestones

1. Add auth, organizations, locations, and roles.
2. Connect dashboard orders/reservations to Supabase queries.
3. Implement FAQ calls from the restaurant knowledge base.
4. Implement staff-review pickup orders before POS integrations.
5. Add Toast as the first POS integration.
6. Add OpenTable as the first reservation integration.
