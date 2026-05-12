# Mobile polish for the marketing site

Tighten the marketing site on phones (≈360–414px) so nothing gets clipped, headlines scale down, and dense rows wrap cleanly. No content or copy changes — purely responsive class adjustments.

## Issues found

**Marketing layout / chrome**
- Announcement bar text ("New: Toast & Square integrations now live — sync orders straight to your POS. Learn more →") wraps awkwardly into 3–4 lines on small screens. No hamburger menu — primary nav links (Product, Pricing, Live demo, How it works, Talk to sales) are completely hidden under `md:flex`.
- Footer is a 1-column stack on mobile with lots of empty vertical space because `md:grid-cols-5` only kicks in at 768px+.

**Home — Hero**
- H1 `text-[44px]` at base is too large at 360px — causes the awkward "Answer every / call." break and "Capture every / order." overflow risk.
- Trust badges row ("No credit card · Live in under 1 hour · SOC 2 ready") uses `flex items-center gap-4` with no wrap → labels crash into each other on narrow phones.
- Trust strip integration names are a flat row of 6 brand names — wraps but feels cramped.

**Home — "Cost of a missed call" stats**
- `grid-cols-3` forced at all breakpoints with `text-3xl md:text-5xl` numbers + label below. At 360px the third column is squeezed and labels truncate.

**Home — Testimonials banner**
- `-mt-16 md:-mt-24` pulls the section header up over the photo banner, but on mobile the eyebrow + h2 sit on a noisy image area and become hard to read.

**Live demo (VoiceDemoPlayer)**
- 7 tab pills + "Audio" sub-badges wrap to 3–4 rows and feel busy. The center play column (`lg:grid-cols-[1fr_260px_1fr]`) renders full-width at mobile, fine — but the per-person panels above/below get tall and the play button sits in the middle of a long scroll.

**ProductTour**
- 5 tabs wrap to 2 rows — OK but tight. Inside the card, `p-6` text + the mock UI panel each get full width and the section becomes very tall.

**Comparison tables (Home + Pricing)**
- Both rely on `overflow-x-auto` only. On a 360px screen users see 1.5 columns and have to scroll horizontally inside a section that already scrolls vertically. Easy to miss.

**MissedCallCalculator**
- Result panel `text-4xl md:text-5xl` currency value can clip on 360px when number is e.g. "$10,824".

**CallTranscriptCard**
- Two callers each `w-[34%]` with center waveform → at 390px the phone number `+1 (917) 555-0142` and "AI host · Trattoria" subtitles wrap to 2 lines; overall card looks cramped.

**Pricing page**
- H1 `text-4xl md:text-6xl` OK, but the toggle row (`Monthly · Switch · Annual [Save 2 months]`) overflows on 360px because the badge sits on the same line.
- Tier card "Most popular" badge with `-top-3` is fine; price `text-5xl` OK.

## Changes (frontend / Tailwind only)

1. **MarketingLayout.tsx**
   - Announcement bar: hide the long subtext under `hidden sm:inline`, keep "New: Toast & Square integrations live →" on mobile.
   - Footer grid: add `grid-cols-2 sm:grid-cols-2 md:grid-cols-5` so Product/Company/Legal sit side by side on phones.
   - Add a simple Sheet-based hamburger (Menu icon) on `<md` showing the same nav links + auth buttons, using existing `@/components/ui/sheet`.

2. **Home.tsx — Hero**
   - H1: `text-[34px] sm:text-[40px] md:text-6xl lg:text-[76px]` and `leading-[1.05]`.
   - Trust badges row: add `flex-wrap gap-y-2`.
   - Sub-paragraph: tighten `mt-5 max-w-md sm:max-w-xl`.
   - CTA buttons: stack with `w-full sm:w-auto` so they don't squeeze.

3. **Home.tsx — missed-call stats**
   - Switch to `grid-cols-1 sm:grid-cols-3 gap-6`. On mobile, full-width rows with the orange left border read better than 3 squeezed columns.
   - Number sizes: `text-4xl sm:text-3xl md:text-5xl`.

4. **Home.tsx — Testimonials banner**
   - Reduce banner height on mobile: `h-40 sm:h-56 md:h-72`.
   - Drop the `-mt-16` pull-up on mobile (`md:-mt-24` only) so the section header sits cleanly below the image.

5. **VoiceDemoPlayer.tsx**
   - Tab row: replace `flex flex-wrap justify-center` with horizontally scrollable strip on `<sm` (`-mx-5 px-5 overflow-x-auto flex-nowrap snap-x`); pills `whitespace-nowrap`.
   - Caller PersonPanel min height reduced on mobile.
   - Hide the small "Audio" badge text under `hidden sm:inline`, keep the green dot.

6. **ProductTour.tsx**
   - Tab row: same scroll-on-mobile treatment.
   - Card: reduce mobile padding `p-5` (was `p-6`).

7. **ComparisonTable.tsx + Pricing comparison**
   - On `<md`, render a stacked card layout: one card per row with feature label as title and 4 mini key/value rows for HostLine/Voicemail/IVR/Service. Keep the full table behind `hidden md:block`.

8. **MissedCallCalculator.tsx**
   - Result number: `text-3xl sm:text-4xl md:text-5xl` and `break-words`.
   - Add `min-w-0` on the inner flex containers so labels don't push the value off-screen.

9. **CallTranscriptCard.tsx**
   - Caller name/sub: allow shrink (`min-w-0`, `truncate` on phone number sub-line).
   - Reduce avatar to `h-12 w-12` on `<sm`, padding `px-4 pt-5 pb-4`.
   - Caption text: `text-sm sm:text-[15px]`.

10. **Pricing.tsx**
    - Billing toggle: wrap row with `flex-wrap justify-center gap-2` and move "Save 2 months" badge under the toggle on `<sm`.
    - H1: `text-3xl sm:text-4xl md:text-6xl`.

## Verification

After edits:
- Reload `/` and `/pricing` at 360, 390, and 414 wide via the preview viewport.
- Confirm: no horizontal page scroll; no clipped headlines; tap targets ≥40px; comparison tables readable without horizontal scrolling on phones.
- Spot-check tablet (768px) and desktop (1280px) to make sure nothing regressed.

## Out of scope

- Copy changes, new sections, or color/theme changes.
- Backend, voice service, or auth code.
