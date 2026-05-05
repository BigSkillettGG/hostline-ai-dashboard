
# Call escalations: complaints + sales/vendor calls

Add structured handling for two new call types — **customer complaints** and **sales/vendor calls** — with manager alerts (SMS / email) and a logged record for each.

## 1. New call types in the data model

`src/data/mock.ts`:

- Extend `CallIntent` with `"complaint"` and `"sales"`.
- Extend `CallOutcome` with `"manager_alerted"` and `"message_taken"`.
- Add a new optional field on `Call`: `escalation?: { type: "complaint" | "sales"; severity?: "low" | "medium" | "high"; summary: string; alertedAt: string; alertedTo: string[]; channels: ("sms" | "email")[]; status: "pending_callback" | "callback_made" | "closed" }`.
- Seed 3–4 sample calls: an angry-customer complaint (food order wrong), a vendor sales call, a "speak to the manager" caller who turned out to be a supplier, and one resolved complaint with `callback_made`.

## 2. Calls page — surface escalations

`src/pages/Calls.tsx`:

- Add `complaint` and `sales` to the intent filter and `intentColor` map (red for complaint, amber for sales).
- New "Type" column or badge stack already covered by intent badge — no extra column needed.
- In the call detail Sheet, when `call.escalation` exists, add a new **Escalation** card (above transcript) showing: type, severity, who was alerted, channel(s), timestamp, callback status, and the AI-generated summary that was sent. Buttons: "Mark callback made", "Re-send alert".

## 3. New page — Escalations log

`src/pages/Escalations.tsx`, route `/app/escalations`, sidebar entry under **Operations** (Phone icon, between Calls and Orders).

- Table: time, caller, type (complaint / sales), severity, summary (truncated), alert channels, status, actions.
- Tabs: All · Complaints · Sales/Vendor · Awaiting callback.
- Row click → same call Sheet as Calls page (reuses Calls detail).
- Empty state copy: "No escalations yet — when the AI host hands a caller off, it'll show up here."

## 4. Settings — Alerts & Escalation Routing

New file: `src/pages/settings/Alerts.tsx`, route `/app/settings/alerts`, added to Settings group in sidebar.

Two routing blocks:

**Customer complaints**
- Toggle: "Offer to connect a manager when a caller sounds upset"
- Toggle: "Tell caller a manager will call them back" (default on)
- Recipient list (add/remove rows): name, phone, email, channels (SMS / Email / Both)
- Severity threshold (Low / Medium / High) for triggering
- Quiet hours (optional) — off by default; if on, alerts queue until next opening hour

**Sales / vendor calls**
- Recipient list (separate from complaints; usually different people, e.g. owner only, not floor manager)
- Default behavior: take a message, do not transfer
- Toggle: "Ask caller to identify intent (vendor / supplier / sales / other) before deciding"

Each recipient row reuses the team contact shape from `Team.tsx` where possible. Persisted to localStorage under `hostline.alertRouting` for now (mock).

## 5. Voice Agent — behavior preview

`src/pages/VoiceAgent.tsx`: add a small "Escalation behaviors" card linking to Settings → Alerts, with two read-only example exchanges:

- Complaint: "I'm sorry to hear that. I'll let the manager know right away and they'll call you back shortly. Could you tell me what happened so I can pass along the details?"
- Sales: "Thanks for reaching out. The manager isn't available to take sales calls live — I can take a message and pass it along. What's this regarding?"

## 6. Onboarding — one new step

`src/pages/Onboarding.tsx` + `src/domain/onboarding.ts`: add a new section **"Escalations & alerts"** with 3 fields:

- Manager phone number(s) for complaints (SMS)
- Manager email(s) for sales/vendor messages
- Default: should the AI offer a callback for complaints? (yes/no)

Pre-fills the new Alerts settings page on save.

## 7. Wiring (mock-only this pass)

- "Send alert" actions show toasts: `"Text sent to Maria (+1 415-555-0148)"` / `"Email sent to owner@oliveandember.com"`.
- New escalations are appended to a local `escalations` array in mock.ts so the new page renders realistic data.
- Real Twilio SMS + Lovable Email wiring is **out of scope** this pass — leave a TODO comment in `Alerts.tsx` and the escalation card pointing at the future edge function (`supabase/functions/send-escalation-alert`).

## Out of scope

- Actual outbound SMS (Twilio) and email sending — would require enabling Lovable Cloud + Twilio connector + email domain.
- Sentiment detection model for "angry caller" — handled by the voice agent's runtime, surfaced here only as a flag.
- Manager mobile push / app — alerts are SMS/email only for v1.

## Files

**New**
- `src/pages/Escalations.tsx`
- `src/pages/settings/Alerts.tsx`

**Edited**
- `src/data/mock.ts` (types + seed data + escalations array)
- `src/pages/Calls.tsx` (intent filter, color, escalation card in Sheet)
- `src/pages/VoiceAgent.tsx` (escalation behavior card)
- `src/pages/Onboarding.tsx` + `src/domain/onboarding.ts` (new step)
- `src/components/AppSidebar.tsx` (Escalations under Operations; Alerts under Settings)
- `src/App.tsx` (two new routes)
