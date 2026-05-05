# Sidebar reorder + dashboard escalation stats

## 1. Sidebar (`src/components/AppSidebar.tsx`)
Move **Escalations** to the bottom of the Operations group, below Reservations:
- Dashboard → Calls → Orders → Reservations → Escalations

## 2. Dashboard stats (`src/data/mock.ts` + `src/pages/Dashboard.tsx`)
Replace the ambiguous **Needs review** tile (and drop **Revenue captured** from the top row to keep it at 6 tiles) with two distinct escalation tiles, sourced from the existing `escalation.type` data:

- **Complaints escalated** — angry/upset callers, wrong orders, manager handoffs (icon: `AlertTriangle`, accent red/warning)
- **Sales / vendor calls** — calls where Vera took a message for the manager (icon: `Megaphone`, neutral)

In `dashboardStats`, replace `needsReview` with:
```ts
complaints: { value: 3, delta: 1 },
salesCalls: { value: 5, delta: 2 },
```
(Revenue captured tile stays — we just swap the last tile for the two new ones, ending with 6 tiles total: Calls answered, Missed recovered, Orders, Reservations, Complaints, Sales/Vendor. Revenue moves into the existing chart row subtitle, or we keep 7 tiles wrapping on xl. Final layout: 6 tiles, Revenue removed from top row since it's already shown in the hero subtitle.)

Each new tile is wrapped in a `Link` to `/app/escalations?type=complaint` and `/app/escalations?type=sales` so clicking drills in.

## 3. Escalations page filter (`src/pages/Escalations.tsx`)
Read the `?type=` query param on mount and preselect the matching tab (Complaints / Sales) so the dashboard tiles deep-link cleanly.

## Out of scope
- Real sentiment detection — counts come from mock `escalation.type`.
- No changes to the Escalations page layout beyond honoring the query param.
