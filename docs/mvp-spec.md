# HostLine AI MVP Spec

HostLine AI is an AI phone host for restaurants. The MVP is built around one promise: never lose a valuable call because staff are busy, closed, or stuck in service.

## Target Customers

- Independent restaurants.
- Small and mid-sized multi-location groups.
- Enterprise chains later, after the product has durable integrations and compliance patterns.

The product should remain restaurant-type agnostic. Pizza shops, cafes, Thai restaurants, diners, and full-service restaurants should all configure the same core system differently.

## MVP Wedge

The first wedge is missed calls and staff phone overload.

HostLine should answer calls based on restaurant configuration, resolve FAQs, capture pickup orders, create reservation bookings or requests, send confirmations, and escalate when a human should take over.

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

## Call Flows

### FAQ

The AI answers questions from the restaurant knowledge base and offers SMS confirmation when useful.

### Pickup Order

The AI captures item, quantity, modifiers, guest name, phone number, notes, and pickup timing. It reads back the order, confirms pay at pickup, sends the order to the configured destination, and texts the guest a summary.

### Reservation

If an integration is connected, the AI checks availability and books through the provider. If no integration is connected, the AI creates a request, tells the guest it needs staff confirmation, and alerts the restaurant.

### Escalation

The AI escalates allergies, complaints, refunds, payment questions, private events, catering, alcohol edge cases, unclear orders, low confidence, and explicit human requests.

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
