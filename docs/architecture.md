# SignalHost Architecture

SignalHost is a customer communication platform for local businesses. The current demos span restaurants and field-service businesses; automotive dealerships are the first high-complexity commercial reference implementation. The core system remains industry-neutral.

The architecture has three layers:

- Core platform: conversations, knowledge lookup, business links, customer requests, staff tasks, transcripts, alerts, analytics, and account setup.
- Channel adapters: phone voice today, website chat next, SMS follow-up now, and later email or social inboxes.
- Vertical playbooks: current restaurant, home-service, and salon demos remain supported; automotive dealerships are the next high-complexity reference template, implemented through reusable platform primitives.

The dashboard is the admin and operations app. The real-time phone agent runs as a separate service because phone audio needs long-lived WebSockets, low latency, retries, and provider-specific event handling.

## Recommended Stack

- Dashboard: React, Vite, shadcn/ui, Tailwind.
- Database/auth/storage: Supabase.
- Web deployment: Vercel or Netlify.
- Voice service: Node/TypeScript on Fly.io, Render, or AWS.
- Telephony: Twilio.
- Preferred voice orchestration: Vapi, with SignalHost-owned context, actions, persistence, administration, and reporting.
- Maintained voice fallback: direct OpenAI Realtime SIP.
- Legacy voice fallback: Twilio ConversationRelay.
- LLM/tool execution: OpenAI.
- Voice/TTS: Vapi-managed voices on the preferred path; OpenAI Realtime voice profiles on the maintained fallback.
- Observability: structured call events, provider latency spans, transcripts, and tool-call audit logs.

## Services

### Dashboard App

Owns customer setup, operations views, request/order/reservation review, knowledge, vertical configuration, integrations, users, and analytics.

The Calls, Orders, and Reservations pages can read from Supabase REST using `VITE_SUPABASE_URL` and either `VITE_SUPABASE_PUBLISHABLE_KEY` or the legacy `VITE_SUPABASE_ANON_KEY`. If Supabase is missing or unavailable, these pages fall back to sample data and mark the source in the UI. The Orders and Reservations pages can also persist status changes back to Supabase.

Dashboard auth can run in local demo mode or Supabase Auth mode. In Supabase mode, dashboard REST calls use the signed-in user's access token so `docs/supabase-rls.sql` can enforce scoped access. The commercial hierarchy is SignalHost platform -> channel partner -> customer organization -> location/rooftop -> department. Existing customer users retain organization memberships (`owner`, `admin`, `manager`, `staff`); partner users use partner memberships (`owner`, `admin`, `operator`, `viewer`); SignalHost internal users use `platform_admins`. The demo workspace is a seeded local sales/development experience, not a production role.

The additive hierarchy foundation is defined in `docs/COMMERCIAL_HIERARCHY_FOUNDATION.md` and migration `20260806010000_commercial_hierarchy_foundation.sql`. The subsequent dormant routing-identity foundation is defined in `docs/COMMERCIAL_ROUTING_FOUNDATION.md` and migration `20260806020000_commercial_routing_foundation.sql`. Both migrations were applied to production in order on 2026-08-06 and verified through live PostgREST plus all six authenticated demo tenants. Together they supply stable partner, department, human-directory, queue, membership, and destination identities without changing the current single-location UI or any live route. Scoped switching, runtime-enforced number routing, runtime transfer adapters, executable cross-tenant isolation tests, and support-audit controls remain later work.

The telephony ownership foundation in `docs/COMMERCIAL_TELEPHONY_FOUNDATION.md` and migration `20260806070000_commercial_telephony_ownership_foundation.sql` extends the control plane with non-secret carrier/runtime/PBX account ownership, dormant SIP trunk identities, and observed number-to-default-department routes. It was applied and verified in production on 2026-08-06 with all six authenticated demo tenants. `phone_numbers` remains the live compatibility record, the global Twilio SIP trunk remains environment-managed, every verified backfilled route remains non-enforced, and neither the dashboard nor voice runtimes read the new route table. `npm run check:commercial-telephony` is the repeatable read-only production/RLS verification command.

### Voice Service

Owns inbound phone sessions, streaming audio, barge-in, turn detection, tool calls, escalation, call summaries, and transcript persistence.

The first implementation is in `services/voice`:

- `POST /twilio/voice` supports the legacy ConversationRelay path when needed.
- `wss://.../twilio/conversation-relay` receives legacy ConversationRelay setup, prompt, DTMF, interrupt, and error messages.
- `POST /vapi/webhook` is the preferred production provider bridge for call events and SignalHost actions.
- Direct OpenAI Realtime SIP remains the maintained fallback for low-latency voice and natural turn handling.
- `POST /voice/preview` uses OpenAI voice preview audio for dashboard samples.
- `POST /web-chat/message` gives the website chat widget the same core intelligence without phone-specific language, returning chat-safe replies, configured links, and staff follow-up actions.
- OpenAI Responses API powers the restaurant-host reply path when an API key is configured.
- A deterministic fallback responds safely without OpenAI during local development.
- Clear pickup-order language with recognized menu items creates a staff-review, pay-at-pickup order in Supabase.
- Reservation requests with date, time, party size, and guest name create staff-confirmed reservation rows in Supabase.
- Configured business links let the agent text ordering, reservation, booking, menu, quote, or intake links instead of forcing deep integrations.
- Generic customer requests support cross-industry workflows such as service appointments, estimates, leads, callbacks, and order/reservation requests. Until the `customer_requests` table is migrated, these safely fall back to staff tasks.
- Human handoff, complaint, and low-confidence special-handling prompts create staff task rows so managers have a follow-up queue even when the SMS alert succeeds.
- If SMS confirmations are enabled for the location and Twilio SMS is configured, captured phone orders and reservation requests send concise confirmations to the caller.
- `GET /health` returns legacy production readiness checks plus the canonical voice-runtime catalog. The legacy `productionReady` value is not yet the complete commercial launch gate.
- `GET /ready` returns `200` only when required production checks pass; container hosts can use `/health` for liveness and `/ready` for pre-call readiness.
- Internal Twilio endpoints expose generated webhook URLs and TwiML previews for the legacy ConversationRelay path; they are not proof that a Vapi assignment is ready.

### Integration Workers

Own POS, reservation, SMS, printing, and kitchen tablet delivery. Integration failures should create staff-review tasks instead of dropping orders.

## Current Core Data Objects

- Channel partner and partner membership.
- Organization.
- Location.
- Department and department membership.
- Human staff directory entry.
- Department queue and queue membership.
- Dormant transfer target.
- User.
- Phone number.
- Agent configuration.
- Knowledge section.
- FAQ.
- Menu category.
- Menu item.
- Modifier group.
- Business link.
- Customer request.
- Order.
- Order item.
- Reservation.
- Call.
- Transcript turn.
- Integration connection.
- Staff task.
- Notification.

## Voice Runtime Rules

- Keep responses short during order capture.
- Support interruption and barge-in.
- Never guarantee allergen safety.
- Confirm the full order before submission.
- Treat manual reservation requests as unconfirmed.
- Escalate low confidence.
- Persist every tool call with inputs, outputs, latency, and error details.
- Degrade safely: if POS submission fails, create a staff-review order and alert the restaurant.
- Staff-review orders are the default before any POS integration. They must be accepted by staff before kitchen production.

## Deployment Shape

The dashboard can be deployed independently from the voice service.

```
Caller / website visitor -> Channel Adapter -> LLM + tools
                                  |             |
                                  |             -> SMS / staff tasks / optional vertical integrations
                                  |
                                  -> Supabase -> Dashboard
```

## First Working Milestone

1. Supabase schema and seed data.
2. Voice service writes call setup, prompts, replies, and summaries to Supabase.
3. Voice service creates staff-confirmed reservation requests in Supabase.
4. FAQ call flow works from the knowledge base.
5. Dashboard shows the new call, staff-review order, and reservation request.
6. Toast integration pushes accepted orders into the POS.
