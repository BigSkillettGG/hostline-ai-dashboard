# HostLine AI Dashboard

HostLine AI is an AI phone host for restaurants. This repository contains the admin dashboard generated with Lovable and hardened for the first real product pass.

## What The App Covers

- Calls, transcripts, summaries, outcomes, and review queues.
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

## Next Engineering Milestones

1. Add Supabase and replace mock data with real tables.
2. Add auth, organizations, locations, and roles.
3. Build the separate Node/TypeScript voice service.
4. Create a Twilio webhook that opens a call session and writes call records.
5. Implement FAQ calls from the knowledge base.
6. Implement staff-review pickup orders before POS integrations.
7. Add Toast as the first POS integration.
