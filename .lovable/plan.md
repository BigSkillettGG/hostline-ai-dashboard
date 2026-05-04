# HostLine AI — Admin Dashboard

A polished, operational SaaS dashboard for restaurant owners to manage their AI phone host. Designed as a daily-use ops tool, not a marketing site. Lands directly on the dashboard.

## Design direction

- Clean, modern restaurant-tech feel — think Toast / Square / Resy admin.
- Light theme by default with a refined dark mode. Neutral surfaces with a single warm accent (a deep terracotta/amber) for primary actions and key stats; semantic colors for success/warning/danger.
- Inter for UI, tabular numerals for metrics. Compact density with generous touch targets where it matters (toggles, drawers).
- shadcn/ui components throughout. Lucide icons. Subtle motion on drawers, tabs, and status changes.
- Consistent page shell: collapsible left sidebar + top bar (location switcher, search, notifications, user menu).
- All pages include empty states, loading skeletons, and realistic sample data for a fictional restaurant ("Olive & Ember", a neighborhood Italian spot).

## App shell

- Left sidebar with sections: Dashboard, Calls, Orders, Reservations, Menu, Knowledge Base, Voice Agent, Integrations, Settings.
- Top bar: location switcher, global search, AI agent on/off pill (shows "Live" or "Paused"), notification bell, profile menu.
- Responsive: sidebar collapses to icons on tablet, becomes a sheet on mobile. Tables become stacked cards on small screens.

## Pages

### 1. Dashboard (default route)
- Stat cards: Calls answered, Missed calls recovered, Orders captured, Reservation requests, Estimated revenue captured, Calls needing review. Each shows today's value, delta vs. yesterday, and a sparkline.
- Call volume by hour — bar chart (recharts) with a peak-hour highlight.
- Recent activity feed: mixed stream of calls, new orders, reservations, escalations, with timestamps and quick actions.
- Secondary row: Top intents (FAQ, Order, Reservation, Hours, Other) and Containment rate.

### 2. Calls
- Filter bar: date range, intent, outcome, status, confidence threshold, search by phone.
- Table columns: Caller, Time, Duration, Intent, Outcome, Confidence (bar), Status badge.
- Row click opens a right-side drawer with tabs: Transcript (turn-by-turn with speaker labels), Summary (AI-generated), Recording (waveform placeholder + play controls), Extracted data (order or reservation card), Follow-up (assign to staff, mark resolved, add note, send SMS).

### 3. Orders
- Toggle between Kanban (New, Accepted, In Progress, Completed, Canceled) and Table view.
- Order cards show customer, items count, total, ETA, "Pay at pickup" label when applicable, source call link.
- Order detail drawer: customer info, full itemized list with modifiers and notes, pickup ETA editor, source call link, Print ticket and Send SMS buttons, status actions.

### 4. Reservations
- Two tabs: Confirmed and Manual requests (needs staff confirmation banner).
- Table: Guest, Phone, Party size, Date, Time, Notes, Status, Source (AI host / web / walk-in).
- Row actions: Confirm, Suggest alt time, Decline, Add note. Detail drawer with full context and source call.

### 5. Menu
- Left rail: categories with counts and reordering. Right pane: items grid/list with availability toggle, price, prep time, modifiers count, upsell badges.
- Item editor sheet: name, description, price, prep time, modifiers (groups + options + price deltas), availability schedule, upsell suggestions.
- Upload area at top: drag-and-drop for PDF / image / CSV menu import (UI only, with parsed preview placeholder).

### 6. Knowledge Base
- Sectioned editor with collapsible cards for: Hours, Location, Parking, Pickup policy, Delivery policy, Allergy policy, Large parties, Private events, Dress code, Accessibility, Gift cards, Custom FAQs.
- Each section has rich-text-style fields, last-updated timestamp, and "Used in X calls this week".
- Custom FAQs supports add/edit/delete with question + answer pairs.

### 7. Voice Agent
- Two-column layout. Left: configuration form — host name, greeting (with variable chips like {restaurant_name}), tone (Warm / Professional / Playful), call handling mode (Always answer / After hours / Overflow), answer-after-rings, after-hours behavior, escalation phone number.
- Capabilities section with toggles: Answer FAQs, Take orders, Handle reservations, Send SMS confirmations, Escalate to staff.
- Right: Voice preview card with selectable voice, sample phrase player, and a "Test call" button that simulates a call.

### 8. Integrations
- Grid of integration cards: Toast, OpenTable, Square, Clover, SevenRooms, Yelp Guest Manager, Resy, Tock, Printer, Kitchen Tablet.
- Each card: logo placeholder, short description, status pill (Not connected / Connected / Needs attention), primary action (Connect / Manage / Fix).
- Clicking opens a setup-flow dialog with stepper placeholders (Authorize → Map data → Test → Done).

### 9. Settings
- Tabs: Restaurant profile, Locations, Users & roles, Phone numbers, Business hours, Notifications.
- Profile: name, cuisine, logo, timezone, contact.
- Locations: list with add/edit.
- Users: invite, role select (Owner, Manager, Staff), last active.
- Phone numbers: forwarding numbers, AI host number, port-in status.
- Business hours: weekly schedule editor with holiday overrides.
- Notifications: per-event toggles for email/SMS/push (escalations, missed calls, new orders, reservation requests).

## Sample data

A `src/data/` folder seeds realistic mock data: ~40 calls across intents and outcomes, ~15 orders across statuses, ~12 reservations (mix of confirmed and pending), full menu (5 categories, ~25 items with modifiers), populated knowledge base, integration statuses, and 3 staff users. Used to power every page so the product feels alive immediately.

## Empty & loading states

- Every list/table has a tailored empty state with an icon, one-line message, and a primary action.
- Skeleton loaders for tables, cards, and drawers using shadcn `Skeleton`.

## Out of scope (this pass)

- No real backend, auth, or external API calls. Data structures are shaped to map cleanly to Supabase tables later (calls, orders, reservations, menu_items, knowledge_sections, integrations, users, locations).
- No actual telephony, payments, or printing — buttons are wired to toasts.

## Technical notes

- React + Vite + Tailwind + shadcn/ui (already installed). recharts for charts. react-router-dom for routing. lucide-react for icons.
- Routing: `/` → Dashboard, plus `/calls`, `/orders`, `/reservations`, `/menu`, `/knowledge`, `/voice-agent`, `/integrations`, `/settings`. Shared `AppLayout` with sidebar + topbar wraps all routes.
- Design tokens added in `index.css` (HSL): warm neutral surfaces, terracotta/amber accent, semantic success/warning/danger, plus chart palette. Tailwind config extended to expose them.
- State is local (useState / context) with mock data modules; ready to swap to Supabase queries later.
