# Marketing site redesign

Goal: turn the current generic landing + pricing pages into a polished, conversion-focused SaaS experience that clearly explains the value of HostLine AI for independent restaurants.

## Diagnosis of what's broken today

- **Home is thin**: one short hero, four made-up stats, three-card "how it works", three-card trust strip, one CTA. No story, no proof, no product visualization, no objection handling.
- **Stats feel invented** ("98% / <2s / +27% / 24/7") and don't connect to a story.
- **Value prop is generic** ("never miss a call"). Doesn't quantify lost revenue, address owner pain (busy floor, after-hours, no host), or differentiate from voicemail/IVR/answering services.
- **No product surface shown**. Visitors can't picture what they get.
- **Pricing is a flat 3-card grid** with no comparison table, no ROI framing, no anchor on what a missed call actually costs.
- **Visual design**: flat, default shadcn cards, no real hierarchy, no imagery, no motion, no texture. Doesn't feel premium.

## New Home page structure

1. **Announcement bar** — small, dismissible: "New: Toast & Square integrations live."
2. **Hero (rebuilt)**
   - Eyebrow badge + headline + subhead (sharper copy: "Your phone is your busiest employee. Hire an AI host that never misses a shift.")
   - Primary CTA "Start free 14-day trial" + secondary "Hear a sample call" (opens dialog with audio waveform mock).
   - Right side: a stylized **mock call card** showing a live conversation transcript between caller + Vera, with a phone-frame look. Adds product surface to the hero.
   - Trust row: "Trusted by 400+ independent restaurants" + 5 grayscale logo placeholders.
3. **Pain section — "The math of a missed call"**
   - Three columns with big numbers framed as the *problem* the product solves: average ticket × missed calls/week × weeks = lost $/yr. Interactive mini calculator (table size, avg ticket → "you're losing ~$X/month").
4. **Product tour — tabs/sticky scroll**
   - Tabbed section: Pickup Orders · Reservations · FAQs · Complaints & Escalations · After-hours.
   - Each tab: short copy + a realistic UI mock (transcript card, order ticket, reservation row, escalation alert) using existing design tokens.
5. **How it works — 4 numbered steps**
   - Forward your line → Upload your menu → Train Vera in 10 min → Go live tonight. Each with a thin illustration/icon and 1-line copy.
6. **Comparison strip** — small table: HostLine AI vs Voicemail vs Generic IVR vs Human answering service. Checkmarks across rows like "Takes orders", "Books reservations", "Knows your menu", "24/7", "$/call".
7. **Proof: testimonials + metrics**
   - 3 testimonial cards with avatar, name, restaurant, city, quote.
   - A metric strip *below* the quotes (so stats feel earned, not invented), labeled "Across HostLine restaurants in the last 30 days": calls answered, orders captured, hours saved, $ recovered.
8. **Integrations logo grid** — Toast, Square, OpenTable, Resy, Twilio, Stripe (placeholder marks).
9. **Security & trust** — PCI-aware, allergy escalation, human handoff, call recording opt-in, GDPR/CCPA. Icon + 1 line each.
10. **FAQ accordion** (move 4 of the pricing FAQs here, leave billing-specific on pricing).
11. **Final CTA banner** — full-bleed warm gradient, headline + email capture + "Start free trial".
12. **Footer** — keep, expand link columns (Product / Company / Resources / Legal).

## New Pricing page structure

1. **Hero with monthly/annual toggle** (keep, polish copy + add "Save 2 months" badge on annual).
2. **Three pricing cards (rebuilt visuals)**: clearer hierarchy, "Most popular" ribbon, larger price, included calls highlighted, annual savings shown inline.
3. **ROI callout under cards**: "The average plan pays for itself after 3 recovered orders." with the same mini calculator from Home.
4. **Full feature comparison table**: rows grouped by Calls, Orders, Reservations, Integrations, Support, Admin. Tier columns with check / em-dash / value cells.
5. **Add-ons**: extra location, extra phone number, custom voice clone, premium support.
6. **Enterprise band** (keep, polish).
7. **Pricing FAQ** (keep, expand to 7-8 items focused on billing/usage).
8. **Final CTA**.

## Visual / design upgrades (applies to both pages)

- **Section rhythm**: alternate `bg-background` and `bg-card/40` with a thin top divider; add subtle radial gradients behind hero & final CTA using `--primary` / `--accent`.
- **Type scale**: bump h1 to `text-5xl md:text-7xl`, tighten tracking, use `font-semibold` not bold; lift section eyebrows to small uppercase tracked labels.
- **Cards**: replace flat shadcn cards in hero/product mocks with bordered cards that have inner highlight (`ring-1 ring-border`, soft `shadow-[0_1px_0_rgba(0,0,0,0.04),0_20px_40px_-20px_rgba(0,0,0,0.15)]`) and a tiny corner accent dot.
- **Mock UI elements**: build small reusable components for the call transcript card, order ticket, reservation row, and escalation alert — reused across product tour and hero.
- **Iconography**: keep lucide, but pair every section heading with a small monogram chip in primary tint.
- **Motion**: tasteful fade/slide-in on scroll for section headers and cards (CSS only, no extra deps — use Tailwind `animate-` + `IntersectionObserver` hook if needed). Hero call card auto-types one line of transcript every 2.5s.
- **Imagery**: no stock photos; lean into typographic and UI-mock compositions (consistent with the "AI for restaurants" positioning).
- **Copy pass**: shorter, sharper, owner-focused. Replace platitudes with concrete numbers and verbs.

## Files to add / change

- Edit `src/pages/marketing/Home.tsx` — full rewrite with new sections.
- Edit `src/pages/marketing/Pricing.tsx` — restructure with comparison table + ROI + add-ons.
- Edit `src/components/MarketingLayout.tsx` — add announcement bar slot, expand footer, slightly larger header padding, add "Sign in" / "Book a demo" split.
- New `src/components/marketing/` folder with small building blocks:
  - `SectionHeader.tsx` (eyebrow + title + subhead)
  - `CallTranscriptCard.tsx` (animated mock transcript)
  - `MissedCallCalculator.tsx` (two sliders → live $/mo)
  - `ProductTour.tsx` (tabs with UI mocks)
  - `ComparisonTable.tsx`
  - `TestimonialCard.tsx`
  - `LogoCloud.tsx`
  - `FAQAccordion.tsx` (thin wrapper around shadcn Accordion with marketing styling)
- New `src/data/marketing.ts` — testimonials, FAQ, comparison rows, integration logos, plan feature matrix (single source so Home + Pricing stay in sync).

## Out of scope

- Real analytics/AB testing wiring.
- Real customer logos (placeholders only, clearly labeled as samples).
- Backend changes; this is purely the public marketing surface.
- Login/Signup page redesign (can follow in a later pass).

After approval I'll implement in this order: shared building blocks + data → Home → Pricing → Layout polish.
