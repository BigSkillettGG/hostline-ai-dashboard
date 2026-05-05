
# Menu URLs + Music & Entertainment knowledge

Two small additions, no backend wiring yet — UI + local state, structured to map cleanly to scheduled jobs (Firecrawl-style scrape) later.

## 1. Menu page — Menu source URLs

On `/app/menu`, add a "Menu URLs" card alongside the existing upload card (two-column on desktop, stacked on mobile).

- List of source URLs the AI host should keep in sync with.
- Per row: link, status badge (synced / error / pending), sync frequency (hourly / daily / weekly), last-sync timestamp, manual re-sync button, remove button.
- Add row: URL input + frequency select + Add button. Validates `http(s)` URL on submit (toast on bad input).
- Seeded with one example for Olive & Ember so the UI looks alive.
- Local state only this pass; the data shape (`{ url, frequency, lastSyncedAt, status }`) matches what a future Firecrawl-backed sync job would return.

## 2. Knowledge Base — Music & Entertainment

On `/app/knowledge`, add a new section below the existing accordion + custom FAQs.

A single "Music & Entertainment" card with two ways to keep the AI host accurate:

- **Live calendar URL** — same URL-with-frequency pattern as menu sources, for restaurants that already publish a "what's on" page (e.g. their site, a Bandsintown/Songkick page).
- **Scheduled events** — manual list of upcoming acts:
  - Date, start time, end time, performer/act name, type (Live music / DJ / Trivia / Open mic / Other), notes (cover charge, age restriction, etc.).
  - Add/edit/remove inline. Sorted by date.
  - Empty state: "No events scheduled — add tonight's act so the AI host can answer 'who's playing tonight?'".
- A short helper above both inputs explaining the AI host will reference these when callers ask about music or entertainment.

## Technical notes

- New file: `src/types/sources.ts` with `MenuSource` and `EntertainmentEvent` interfaces (so both pages import the same shape).
- Edits:
  - `src/pages/Menu.tsx` — add Menu URLs card, local state, URL validation.
  - `src/pages/Knowledge.tsx` — add Music & Entertainment card with URL list + events list.
- Components reused: existing shadcn `Card`, `Input`, `Select`, `Button`, `Badge`, `Switch`. No new dependencies.
- Sync wiring (Firecrawl + Lovable Cloud cron) is out of scope this pass — added as TODO comments at the top of each new card.

## Out of scope

- Actual scraping / sync execution (would use Firecrawl behind an Edge Function, gated by Lovable Cloud being enabled).
- Diff preview between scraped menu and current menu.
- Recurring-event rules (every Friday, etc.) — only single-date events for now.
