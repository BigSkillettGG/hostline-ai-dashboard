# Hero polish, honest stats, and add real imagery

Four focused changes across the marketing home + call card.

## 1. Fix the jumping caption in the call graphic

In `src/components/marketing/CallTranscriptCard.tsx`, Marco's 4th line is currently shorter than the others, so the caption block height changes and the whole card shifts.

- Replace `"Perfect. And a bottle of the house red, please."` with a longer two-line line, e.g.:
  `"Perfect. Can you also add an order of garlic knots and two tiramisus?"`
- Update the AI-extracted footer to match: `Items` becomes `4` (and the order summary stays believable).
- Also pin a `min-h` on the caption block (≈ `min-h-[68px]`) so any future line-length change still doesn't bounce the card.

## 2. Fix the weird "underline" behind "busiest employee"

The orange band behind the words isn't reading as an underline — it looks like a misaligned highlight bar. I'll remove it. The new headline (below) won't need an underline gimmick at all.

## 3. Rewrite the hero headline + subhead (punchier, real value)

Replace the current 3-clause headline with something tight and outcome-led. Proposed copy (final wording open to your tweaks):

- **Eyebrow** (unchanged): "AI phone host for restaurants"
- **Headline**: **"Answer every call. Capture every order."**
- **Sub-headline**: "HostLine AI is the always-on phone host for your restaurant — taking pickup orders, booking tables, and routing complaints to a manager, 24/7."
- Keep the two CTAs ("Start free trial" / "Hear a sample call") and the trust strip below.

This drops from ~22 words to ~6 words on the H1, and the value (orders captured, no missed calls) lands in the first glance.

## 4. Remove fabricated stats; replace with honest framing

Two places have invented numbers — both get pulled or reframed.

**Trust strip under hero** — currently "Trusted by 400+ independent restaurants" with five made-up restaurant names. Replace with a softer, honest line:
- "Built with restaurant operators across the US."
- Replace the fake-restaurant row with a small **integration logo row** ("Works with Toast · Square · OpenTable · Resy · Twilio") in muted text, which is true.

**"Live metrics" block under testimonials** ("1.2M calls answered / 340k orders / $14.6M / 82,000 hours") — this whole block gets removed. In its place, a soft **"Why operators switch"** card with three qualitative points (no fake numbers):
- "Never miss a dinner-rush call"
- "Free up your host for the floor"
- "Capture pickup orders 24/7"

## 5. Add real imagery

Generate three restaurant-themed photographs via the AI image gateway and use them in the marketing home. All saved to `public/marketing/` so they're served as static assets.

Images to generate (Nano banana 2 — fast + high quality):
1. `hero-restaurant.jpg` — warm, candid shot of a busy independent Italian-style restaurant interior at dinner, soft golden light, guests visible but blurred, no logos, no faces in sharp focus. Used as a **background/side photo on the hero** behind/next to the call card.
2. `host-on-phone.jpg` — a friendly female host at a wood-grain restaurant podium holding a phone receiver, smiling, warm interior in background. Used in the "Product tour" or "How it works" section as a contextual photo.
3. `happy-guests.jpg` — a small group of diners laughing together at a table with food and wine, warm restaurant lighting, candid. Used in the **testimonials** section as a wide banner above the quotes.

Where each image lands:

- **Hero**: introduce a faded restaurant interior photo as a tinted backdrop on the right side, behind the call card (low opacity, ~15-25%), to add warmth without competing with the UI mock.
- **How it works**: small portrait-shaped photo of the host on the phone, placed alongside the 4-step strip.
- **Testimonials**: full-bleed banner photo of happy guests above the three testimonial cards, with an overlay gradient so the section header sits on top.

All photo placements use existing semantic tokens for any overlays / borders, and respect the warm terracotta brand palette.

## Files touched

- `src/components/marketing/CallTranscriptCard.tsx` — line swap + min-height on caption.
- `src/pages/marketing/Home.tsx` — new headline/subhead, remove underline span, swap fake-restaurant trust row for integrations row, replace live-metrics block with qualitative card, add the three images in their sections.
- `public/marketing/hero-restaurant.jpg`, `host-on-phone.jpg`, `happy-guests.jpg` — new generated images.

## Out of scope

- Pricing page (not mentioned).
- Real customer logos (we only have integration partners, which we'll show instead).
- Sourcing real testimonials — quotes stay attributed to plausibly-named restaurants but the "live metric" fabrications are removed.
