# SignalHost MVP Spec

SignalHost is an AI phone and website chat operator for local businesses. The first production vertical is restaurants, but the platform is built around a broader promise: never lose a valuable customer moment because staff are busy, closed, in the field, or stuck in service.

## Target Customers

- Independent restaurants.
- HVAC, plumbing, roofing, electrical, and salon/barbershop operators.
- Small and mid-sized multi-location groups.
- Enterprise chains and larger service brands later, after the product has durable integrations and compliance patterns.

The product should remain vertical-aware without becoming vertical-locked. Restaurants, trades, and salons all use the same core system, but each gets a different onboarding interview, knowledge model, escalation rules, pricing, and marketing page.

## MVP Wedge

The first wedge is missed calls, staff phone overload, and website visitor capture.

SignalHost should answer calls and website chats based on business configuration, resolve FAQs, send booking/order/intake links, capture orders or appointment requests when enabled, send confirmations when messaging is configured, and escalate when a human should take over.

## Restaurant Configuration

Each location needs these setup controls:

- Call handling mode: answer immediately, answer after X rings, only after hours, or only when manually enabled.
- Orders: enabled or disabled.
- Reservations: disabled, integrated booking, or manual request flow.
- Payment mode: pay at pickup for MVP.
- Order destination: POS integration, kitchen tablet, printer, staff review queue, or any combination supported by the location.
- Escalation: manager/staff phone number and conditions.
- Voice: host name, tone, greeting, disclosure preference, confirmation style.
- Knowledge base: hours, address, parking, pickup policy, delivery policy, allergy policy, large parties, private events, dress code, accessibility, gift cards, and custom FAQs.
- Menu: items, categories, modifiers, prices, prep times, 86'd availability, and upsell suggestions.

The self-service onboarding flow should collect these details through a conversational interview before the restaurant reaches the live dashboard. See `docs/onboarding-knowledge-scope.md` for the full knowledge map.

## Call Flows

### FAQ

The AI answers questions from the restaurant knowledge base and offers SMS confirmation when useful.

### Pickup Order

The AI captures item, quantity, modifiers, guest name, phone number, notes, and pickup timing. It reads back the order, confirms pay at pickup, sends the order to the configured destination, and texts the guest a summary.

### Reservation

If an integration is connected, the AI checks availability and books through the provider. If no integration is connected, the AI creates a request, tells the guest it needs staff confirmation, and alerts the restaurant.

### Escalation

The AI escalates allergies, complaints, refunds, payment questions, private events, catering, alcohol edge cases, unclear orders, low confidence, and explicit human requests.

## Production Voice Path

The MVP phone path uses Twilio ConversationRelay first because it gives us low-latency phone audio, real-time speech recognition, text-to-speech playback, and interruption handling while our application owns the restaurant logic.

Voice defaults:

- Telephony: Twilio Voice.
- Phone AI transport: Twilio ConversationRelay.
- TTS provider: ElevenLabs.
- TTS voice model: ElevenLabs Flash 2.5 via ConversationRelay voice configuration.
- LLM: OpenAI Responses API using `gpt-5-mini` by default for cost and latency.
- Payments: pay at pickup only.

The direct ElevenLabs Text to Speech endpoint is used for dashboard voice previews. Live phone calls should use ConversationRelay's ElevenLabs TTS path until we need lower-level audio control.

## Integration Priority

### Ordering/POS

1. Toast.
2. Square for Restaurants.
3. Clover.
4. SpotOn.
5. Bridge partners such as Chowly or Checkmate later.

### Reservations

1. OpenTable.
2. Yelp Guest Manager.
3. SevenRooms.
4. Resy.
5. Tock.
6. SpotOn Reserve where useful.

## MVP Non-Goals

- No AI collection of raw credit card numbers.
- No DoorDash-first ordering workflow.
- No enterprise SSO/procurement workflow.
- No hidden AI impersonation. The default greeting should lightly disclose the AI host.
- No hand-built full POS replacement.

## Production Workstreams

The production build is tracked as 12 workstreams. See `docs/production-roadmap.md` for the current sequence and scope.

## Pilot Success Metrics

- Calls answered.
- Missed calls recovered.
- Orders captured.
- Revenue captured.
- Staff handoffs.
- Calls needing review.
- Order correction rate.
- Guest abandonment rate.
- Average latency from caller stop to AI response.
