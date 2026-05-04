# Restaurant Onboarding Knowledge Scope

The onboarding interview must create enough structured context for a restaurant owner to place a first test call and hear a host that sounds prepared. The product should collect this in a conversational flow, but store it as structured data that can power prompts, tool calls, dashboard settings, and integrations.

## Setup Sections

### Restaurant Basics

- Restaurant name, legal/account name, brand voice, cuisine, concept, number of locations.
- Primary address, pickup entrance, neighborhood landmarks, timezone, main phone.
- Owner, manager, billing contact, escalation contact, notification phone and email.
- Multi-location rules: shared menu, local menu, shared hours, local holidays, location-specific phone routing.

### Menus And Pricing

- Menu links, uploaded PDFs, images, spreadsheets, POS exports, and source freshness.
- Categories: breakfast, lunch, brunch, dinner, late night, dessert, kids, catering, drinks, specials.
- Items: name, aliases, description, price, tax category, prep time, availability, 86 status.
- Modifiers: required choices, optional add-ons, removals, size, spice level, doneness, side choices, sauces.
- Combos, bundles, family meals, catering trays, minimum notice rules.
- Time-aware pricing: happy hour, lunch pricing, brunch-only items, event menus, seasonal pricing.
- Drink menu: cocktails, beer, wine, NA drinks, bottle availability, last call, ID policy, pickup restrictions.
- Dietary flags: vegetarian, vegan, gluten-free, dairy-free, nut-free, shellfish, pork, halal, kosher notes.
- Upsells: pairings, dessert prompts, drink suggestions, rules for not repeating declined upsells.

### Hours And Service Periods

- Regular hours by day.
- Service windows: breakfast, lunch, brunch, dinner, bar, patio, late night, counter service.
- Kitchen close, last seating, last call, pickup cutoffs, delivery cutoffs.
- Daily specials, recurring events, live music, trivia, chef specials, limited menus.
- Holiday closures, special hours, private buyouts, blackout dates.
- Special menu days: Mother's Day, Valentine's Day, New Year's Eve, restaurant week, game days.

### Orders

- Whether the AI can take orders.
- Pickup-only, delivery handoff, curbside, dine-in preorders, catering inquiry behavior.
- Payment mode: pay at pickup for MVP, no card collection over phone.
- Destination: staff review, kitchen tablet, printer, POS, or combinations.
- Staff acceptance rules, confirmation script, pickup ETA, rush-hour ETA, item-level prep times.
- Order edit and cancellation policy.
- Allergy escalation and low-confidence review.
- Large order and catering thresholds.

### Reservations

- Whether reservations are accepted.
- Provider: OpenTable, Yelp Guest Manager, SevenRooms, Resy, Tock, manual request, or none.
- Auto-confirm rules, party-size limits, seating area preferences, patio rules, bar seating.
- Waitlist behavior and walk-in policy.
- Deposits, cancellation fee, credit card requirement, no-show policy.
- Special reservation days with unique menus, pricing, seating times, deposits, or blackout periods.
- Private events, catering, buyouts, large-party inquiry collection.

### Guest Policies And FAQs

- Parking, transit, directions, pickup entrance, accessibility.
- Allergy policy, dietary accommodations, cross-contact language.
- Delivery apps, direct delivery policy, third-party issue handling.
- Corkage, cake fee, split checks, gratuity, service charge, gift cards.
- Dress code, age policy, kids menu, strollers, pets, service animals.
- Patio, heaters, weather closures, music volume, sports viewing, Wi-Fi.
- Refunds, complaints, lost and found, donations, press, job inquiries.

### Voice And Behavior

- Host name, tone, accent preference, greeting, disclosure preference.
- Answer timing: immediately, after rings, after-hours only, manual pause.
- Languages, confirmation style, interruption handling.
- Human handoff rules: complaints, refunds, allergies, unclear orders, private events, explicit staff request.
- SMS confirmations for orders, reservation requests, directions, and links.

### Phone Launch

- Restaurant main line, current carrier, phone provider admin access.
- Assigned Twilio number, forwarding mode, no-answer timing, after-hours routing.
- Test call checklist: FAQ, menu, order, reservation, handoff, dashboard review.
- Go-live status, rollback number, support contact.

## Storage Shape

The interview should eventually write to:

- `organizations` and `locations` for account/location identity.
- `agent_configs` for voice, call handling, capabilities, and escalation.
- `knowledge_documents` and `faqs` for restaurant policies and Q&A.
- `menu_categories`, `menu_items`, and modifiers/options for order understanding.
- `integration_connections` for POS, reservations, SMS, printers, and kitchen devices.
- `phone_numbers` or equivalent for Twilio number assignment and forwarding status.

## First-Call Standard

Before asking a restaurant owner to call the AI, the system should know:

- The restaurant name and greeting.
- Regular hours and today's availability.
- Main address, parking, pickup policy, and allergy policy.
- At least one menu source with core items and modifiers.
- Whether orders and reservations are enabled.
- Where captured orders and reservation requests should go.
- Staff escalation phone number.
- Assigned Twilio number and forwarding instructions.
