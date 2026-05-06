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
3. Use the onboarded location profile in the live voice service.
4. Twilio number provisioning and forwarding status.
5. Add extraction workers for uploaded PDFs, images, and CSV menu files.
6. Add production auth, RLS, and organization/location switching.

## Current Product State

- Dashboard shell exists.
- Voice service exists.
- ElevenLabs preview endpoint exists.
- Twilio ConversationRelay webhook exists.
- Calls can persist to Supabase.
- Orders can read and update from Supabase.
- Clear pickup orders can create staff-review orders.
- Reservations can read, create, and update status in Supabase, with provider fields ready for OpenTable-style sync.
- The voice service can create staff-confirmed reservation requests from multi-turn calls.
- The Menu page can parse pasted menu text and replace a location's structured Supabase menu rows.
- The Menu page can persist menu URL sources and queue ingestion jobs for later extraction workers.
- The voice backend can process queued menu URL/text ingestion jobs into structured Supabase menu rows.
- Onboarding scope, guided setup UI, and Supabase onboarding profile persistence are now part of the app.
- The live voice service can load onboarded restaurant context from Supabase for call greetings and replies.
- The voice backend has internal Twilio number search/provisioning endpoints, and the dashboard can read persisted phone-number forwarding status.
- The onboarding phone launch flow tracks direct-call, no-answer forwarding, and busy-line forwarding verification before no-busy-signal coverage is treated as ready.
- The live voice service includes Supabase FAQs and knowledge sections in model instructions and deterministic fallback replies.

## Key Product Standard

The first restaurant-owner test call should feel specific to that restaurant. If the host cannot answer hours, location, parking, menu basics, order policy, reservation policy, and escalation behavior, the account is not ready for launch.
