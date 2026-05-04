# Production Roadmap

This roadmap assumes HostLine AI starts with independent restaurants and multi-location groups, while preserving a path to enterprise chains later.

## Workstream Count

There are 12 production workstreams:

1. Self-service auth, billing, organization, and location signup.
2. Conversational onboarding and restaurant knowledge extraction.
3. Menu ingestion from PDFs, images, links, spreadsheets, and POS exports.
4. Twilio number provisioning, forwarding instructions, and live call routing.
5. Realtime voice latency tuning across Twilio, transcription, LLM, and ElevenLabs.
6. Supabase persistence, RLS, roles, audit logs, and admin workflows.
7. Staff-review order queue, kitchen tablet, and printer delivery.
8. Toast ordering integration, then Square, Clover, and bridge partners.
9. OpenTable reservations, then Yelp Guest Manager, SevenRooms, Resy, and Tock.
10. SMS confirmations, staff alerts, low-confidence review, and human handoff.
11. Analytics, call QA, transcript review, and launch-readiness monitoring.
12. Compliance, security, secrets, observability, deployment, and support tooling.

## Near-Term Build Order

1. Onboarding UI and knowledge scope.
2. Persist onboarding profile to Supabase tables.
3. Add Twilio number provisioning and forwarding status.
4. Use the onboarded location profile in the live voice service.
5. Load menu items from Supabase instead of demo context.
6. Add reservation request persistence and OpenTable integration path.
7. Add staff notification channels for orders and handoffs.
8. Add production auth, RLS, and organization/location switching.

## Current Product State

- Dashboard shell exists.
- Voice service exists.
- ElevenLabs preview endpoint exists.
- Twilio ConversationRelay webhook exists.
- Calls can persist to Supabase.
- Orders can read and update from Supabase.
- Clear pickup orders can create staff-review orders.
- Onboarding scope and guided setup UI are now part of the app.

## Key Product Standard

The first restaurant-owner test call should feel specific to that restaurant. If the host cannot answer hours, location, parking, menu basics, order policy, reservation policy, and escalation behavior, the account is not ready for launch.
