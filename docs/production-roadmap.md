# Production Roadmap

This roadmap assumes SignalHost starts with independent restaurants and local service businesses, while preserving a path to multi-location groups, enterprise chains, and larger service brands later.

## Workstream Count

There are 12 production workstreams:

1. Self-service auth, billing, organization, and location signup.
2. Conversational onboarding and vertical-specific knowledge extraction.
3. Menu ingestion from PDFs, images, links, spreadsheets, and POS exports.
4. Twilio number provisioning, forwarding instructions, and live call routing.
5. Realtime voice latency tuning across Twilio, transcription, LLM, and ElevenLabs.
6. Supabase persistence, RLS, roles, audit logs, and admin workflows.
7. Staff-review order queue, kitchen tablet, and printer delivery.
8. Link-first order, reservation, appointment, and quote workflows, then vertical integrations when demand proves them.
9. Restaurant integrations such as Toast, Square, Clover, OpenTable, Yelp Guest Manager, SevenRooms, Resy, and Tock after the link/manual flows are durable.
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
- Orders can read and update from Supabase, including delivery attempts for staff queue, kitchen tablet, printer, and future POS handoff.
- Clear pickup orders can create staff-review orders.
- Captured phone orders now create a staff-review delivery record so staff can audit whether an order reached an operational destination.
- Kitchen staff now have a tablet-style fulfillment board for accepting new phone tickets, starting prep, marking orders ready, and recording kitchen-tablet delivery acknowledgement.
- Reservations can read, create, and update status in Supabase, with provider fields ready for OpenTable-style sync.
- The voice service can create staff-confirmed reservation requests from multi-turn calls.
- OpenAI Realtime can now save reservation requests through a structured tool instead of only discussing reservations conversationally.
- OpenTable is documented as the first direct reservation integration path because its official partner materials include API sandbox access, Booking API, Sync API, and Directory API reservation links. Resy remains after partner access.
- The voice service now has an OpenTable reservation adapter that can post confirmed bookings to a configured OpenTable sandbox reservations endpoint, then persist provider-confirmed reservation rows in Supabase. Without credentials, it keeps the staff-confirmed fallback.
- The Calls page now has a call-review and tuning loop so owners can mark good, wrong, awkward, missing-knowledge, or should-have-escalated answers and optionally turn corrections into knowledge-base material.
- The Menu page can parse pasted menu text and replace a location's structured Supabase menu rows.
- The Menu page can persist menu URL sources and queue ingestion jobs for later extraction workers.
- The voice backend can process queued menu URL/text ingestion jobs into structured Supabase menu rows.
- Onboarding scope, guided setup UI, and Supabase onboarding profile persistence are now part of the app.
- The live voice service can load onboarded restaurant context from Supabase for call greetings and replies.
- The voice backend has internal Twilio number search/provisioning endpoints, and the dashboard can read persisted phone-number forwarding status.
- Signup now captures business phone and preferred area code, then onboarding presents a self-service launch assistant that can assign the first available local Twilio trial number, store it on the profile, and guide the first test call.
- Billing now shows plan, trial number status, usage, cleanup timing, and trial guardrails, while the voice backend blocks duplicate active trial-number purchases for a location.
- Stripe checkout, customer portal, signed webhook handling, and `billing_accounts` subscription persistence are now wired through the voice service using a server-side plan catalog.
- Calls now have a derived interaction-status foundation in the dashboard: follow-up need, urgency, value tier, knowledge-gap signal, owner report bucket, and recommended next action. The schema baseline includes matching persisted columns for the next migration, but the dashboard derives them safely until the live database is updated.
- The Dashboard now generates a daily narrative owner brief from live calls, chats, orders, reservations, staff tasks, and interaction-status signals, with copy-ready text for future email/SMS delivery.
- The Knowledge Base now has a local Business Live Updates and Modes layer for temporary owner instructions such as specials, closures, emergency mode, holiday rules, promotions, and staffing shortages. The schema baseline includes `business_live_updates` for the next persistence slice.
- The Owner Assistant page now lets owners ask dashboard-chat questions about today's summary, urgent calls, follow-ups, opportunities, knowledge gaps, complaints, orders, and reservations. Onboarding now captures trusted owner name, phone, and email, and the schema baseline includes `business_contacts`.
- The Owner Assistant can now create local live updates and switch business modes from plain owner commands like "tonight's special is lobster ravioli," "we're closed tomorrow," and "set busy mode." These updates share state with the Knowledge Base live-updates panel.
- Business live updates now have Supabase persistence via `business_live_settings` and `business_live_updates`; the voice and website-chat runtime loads active updates into model instructions and gives them priority over permanent knowledge.
- The onboarding phone launch flow tracks direct-call, no-answer forwarding, and busy-line forwarding verification before no-busy-signal coverage is treated as ready.
- The live voice service includes Supabase FAQs and knowledge sections in model instructions and deterministic fallback replies.
- Alert routing rules can now persist per location, and the voice service can use those rules to route staff SMS/webhook alerts by event type and severity.
- Staff alert delivery attempts now write audit events that the dashboard can review in the Alert Log.
- Staff follow-ups now have a Tasks queue for callbacks, alert failures, reservation reviews, low-confidence calls, and order handoff issues.
- The live voice service now creates staff Tasks for complaint callbacks, human handoff requests, and low-confidence special-handling topics even when staff alerts are delivered successfully.
- The live voice service can now send caller-facing SMS confirmations for captured pickup orders and reservation requests when enabled for the location.
- Supabase Auth mode, user access-token REST calls, organization memberships, platform admins, and production RLS policies are now documented and scaffolded.
- Restaurant memberships now distinguish owner, admin, manager, and staff access in the dashboard, with a demo workspace that is separate from production roles.
- Team invitations now have a dashboard flow, local demo fallback, Supabase REST hooks, and RLS-backed `team_invitations` schema.
- The voice service health response now includes production readiness checks for deployment URLs, secrets, Supabase, OpenAI, ElevenLabs, Twilio, CORS, and signature enforcement.
- The voice service now has a bundled production build, Dockerfile, `/ready` endpoint, and deployment-check script for the first live call bring-up.
- The internal Telephony page now shows live-call webhook URLs, ConversationRelay websocket targets, TwiML preview, and first-call checklist status from the deployed voice service.
- The live voice runtime now includes first-call hardening for unclear audio, rude callers, multi-turn order capture, OpenAI response timeouts, prompt failure recovery, and structured turn-latency logs.
- Dashboard-to-voice admin calls now use Supabase bearer-token authorization for platform admins and restaurant owners/admins instead of a browser-exposed internal API key.
- The Telephony page now has a first-call readiness checklist that combines voice-service health, provider secrets, restaurant context, webhook URLs, TwiML preview, and manual Twilio setup prompts.
- The voice service now caps request body sizes, returns clean 400/413 errors for malformed or oversized requests, and rate-limits expensive admin/preview endpoints.
- The voice runtime now has a fast phone-host playbook for routine and high-risk restaurant calls, including complaints, human handoffs, vendor calls, delivery app issues, delivery drivers, lost items, allergies, private events, payment safety, wrong numbers, and order or reservation changes.

## Key Product Standard

The first restaurant-owner test call should feel specific to that restaurant. If the host cannot answer hours, location, parking, menu basics, order policy, reservation policy, and escalation behavior, the account is not ready for launch.
