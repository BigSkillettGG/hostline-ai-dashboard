# HostLine AI Architecture

This app is the admin and operations dashboard. The real-time phone agent should run as a separate service because phone audio needs long-lived WebSockets, low latency, retries, and provider-specific event handling.

## Recommended Stack

- Dashboard: React, Vite, shadcn/ui, Tailwind.
- Database/auth/storage: Supabase.
- Web deployment: Vercel or Netlify.
- Voice service: Node/TypeScript on Fly.io, Render, or AWS.
- Telephony: Twilio.
- Voice orchestration MVP: Twilio ConversationRelay.
- Premium/custom voice path: Twilio Media Streams plus OpenAI Realtime or Deepgram Flux plus ElevenLabs Flash.
- LLM/tool execution: OpenAI.
- TTS: ElevenLabs.
- Observability: structured call events, provider latency spans, transcripts, and tool-call audit logs.

## Services

### Dashboard App

Owns restaurant setup, operations views, order review, reservation review, knowledge base, menu, integrations, users, and analytics.

### Voice Service

Owns inbound phone sessions, streaming audio, barge-in, turn detection, tool calls, escalation, call summaries, and transcript persistence.

### Integration Workers

Own POS, reservation, SMS, printing, and kitchen tablet delivery. Integration failures should create staff-review tasks instead of dropping orders.

## Core Data Objects

- Organization.
- Location.
- User.
- Phone number.
- Agent configuration.
- Knowledge section.
- FAQ.
- Menu category.
- Menu item.
- Modifier group.
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

## Deployment Shape

The dashboard can be deployed independently from the voice service.

```
Caller -> Twilio -> Voice Service -> LLM + tools
                       |             |
                       |             -> POS / reservation / SMS / printer APIs
                       |
                       -> Supabase -> Dashboard
```

## First Working Milestone

1. Supabase schema and seed data.
2. Dashboard reads from Supabase instead of local mocks.
3. Twilio webhook answers a call with a static greeting.
4. Voice service creates a call record.
5. FAQ call flow works from the knowledge base.
6. Pickup order flow creates an order in staff-review mode.
7. Dashboard shows the new call and order.
