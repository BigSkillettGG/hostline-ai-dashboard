
# HostLine AI — Roles, Marketing site, Sidebar reorg

Four threads of work, all in this one project. No backend/auth wiring yet — we mock roles and login locally so the flows are testable; we wire to Lovable Cloud auth as a follow-up once the UX is approved.

## 1. Role model: Admin vs Super Admin

Two app personas:

- **Admin** (restaurant operator) — what `/app/*` shows today, trimmed and reorganized.
- **Super Admin** (HostLine AI staff) — new `/super/*` area for internal tooling.

Mock auth: a `useCurrentUser` hook backed by `localStorage` returns `{ role: 'admin' | 'superadmin', email, restaurantId }`. The marketing login form sets it. A dev role-switcher chip lives in the top bar so we can flip personas without re-logging in. Designed so swapping in Supabase `user_roles` later is a one-file change.

### What moves to Super Admin (hidden from Admin)

From the current Voice Agent page, move the technical knobs:
- Voice provider/model selection, latency tuning, ASR confidence thresholds
- Raw greeting/prompt template editing (Admin keeps a friendly wizard with tone + variable chips only)
- Disclosure script wording, fallback/transfer logic, after-hours raw behavior
- Webhook URLs, test-call simulator with payload inspector

### Super Admin pages (`/super/*`)

```text
/super                  Overview: tenants, MRR, calls today, alerts
/super/tenants          List of restaurants — search, status, impersonate, suspend
/super/tenants/:id      Single restaurant: usage, plan, overrides, audit log
/super/voice-agent      Global voice/model defaults, prompt library, A/B prompts
/super/telephony        Twilio numbers, port-in queue, SIP routing, webhook health
/super/billing          Plans, customer usage vs included calls, manual credits, invoices
/super/audit            System-wide activity log
```

Sidebar for Super Admin is a separate component (`SuperSidebar`) with its own nav. The top bar shows a red "HostLine AI Staff" pill so it's visually distinct.

## 2. Admin sidebar reorganization

Restructure into Operations + a collapsible Settings section.

```text
OPERATIONS
  Dashboard
  Calls
  Orders
  Reservations

CONTENT
  Menu
  Knowledge Base

SETTINGS  (collapsible group, collapsed by default)
  Voice Agent
  Integrations
  Phone & Hours
  Team
  Restaurant Profile
  Billing
```

- Onboarding stays accessible but moves out of the main rail — surfaced via a top-bar "Finish setup" pill until complete, then hidden.
- The current `/settings` page is split into the sub-routes above (each tab becomes its own page) so Settings can act as a real expandable section, not a single dumping ground.
- Within Voice Agent (Admin view), advanced fields collapse behind an "Advanced" disclosure; the truly internal ones are gone (now Super Admin only).

## 3. Marketing site

Lives in the same project under marketing routes; app routes move under `/app/*`. Subdomain split (`hostline.ai` vs `app.hostline.ai`) becomes a hosting config later — code is already structured for it.

```text
/                 Marketing home (hero, how-it-works, sample call, social proof, CTA)
/pricing          Three tiers + FAQ
/login            Email + password (mock)
/signup           Email + password (mock) → /app/onboarding
/app/*            Existing dashboard (Admin)
/super/*          Super Admin
```

- New `MarketingLayout` with its own top nav (Logo, Product, Pricing, Login, "Start free") and a footer.
- After login: Admin → `/app`, Super Admin → `/super`.
- Logout returns to `/`.
- Visual style: same tokens as the app (warm neutral + terracotta accent), but more spacious — large hero, generous type, restaurant photography placeholders.

### Pricing page

Three tiers: **Starter / Growth / Pro**, billed monthly with annual toggle (-15%).

| Tier | Included calls/mo | Locations | Overage | Highlights |
|------|------------------:|----------:|---------|------------|
| Starter | 200 | 1 | $0.55/call | FAQs, reservations, SMS confirms |
| Growth | 800 | 1 | $0.40/call | + Order taking, integrations, analytics |
| Pro | 2,000 | up to 3 | $0.30/call | + Multi-location, priority support, API |

Plus a "Need more?" Enterprise card (contact sales). FAQ accordion below.

## 4. Voice Agent page (Admin) cleanup

Reduce overwhelm using progressive disclosure:
- Top: simple cards — Host name, Tone (Warm/Professional/Playful), Greeting preview.
- Capabilities: clear toggle list (Answer FAQs, Take orders, Reservations, SMS confirms, Escalate).
- Call handling: when to answer + escalation phone — that's it.
- Everything else moves into `<Collapsible>` "Advanced" sections, or to Super Admin.

## Technical notes

- New files:
  - `src/lib/auth.ts` — mock `useCurrentUser`, `signIn`, `signOut`, role guard.
  - `src/components/RequireRole.tsx` — route guard.
  - `src/components/MarketingLayout.tsx`, `src/components/MarketingNav.tsx`, `src/components/MarketingFooter.tsx`.
  - `src/components/SuperSidebar.tsx`, `src/components/SuperLayout.tsx`.
  - `src/pages/marketing/Home.tsx`, `Pricing.tsx`, `Login.tsx`, `Signup.tsx`.
  - `src/pages/super/Overview.tsx`, `Tenants.tsx`, `TenantDetail.tsx`, `VoiceAgentAdvanced.tsx`, `Telephony.tsx`, `Billing.tsx`, `Audit.tsx`.
  - `src/pages/settings/PhoneHours.tsx`, `Team.tsx`, `RestaurantProfile.tsx`, `Billing.tsx` (split from current `Settings.tsx`).
- `App.tsx` routes reshuffled: `/` marketing, `/app/*` admin (wrapped in `RequireRole="admin"`), `/super/*` super admin.
- `AppSidebar.tsx` updated with grouped sections + collapsible Settings group; existing routes re-pointed to `/app/...`.
- `VoiceAgent.tsx` slimmed; advanced fields gated behind Admin-vs-SuperAdmin.
- Mock data extended in `src/data/mock.ts` with a `tenants` list and `plans` for super admin views.
- No real auth, billing, or telephony calls — buttons fire toasts; structure ready to bind to Lovable Cloud + `user_roles` table later.

## Out of scope this pass

- Real auth (Lovable Cloud / Supabase) — follow-up once flows are approved.
- Real Stripe/Paddle billing — pricing page is presentational.
- Subdomain hosting split — single deploy for now, routes only.
