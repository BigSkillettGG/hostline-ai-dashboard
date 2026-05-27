## Goal

Polish the Elliot host contact card so it's just contact info, and stop wrongly flagging the demo workspace as needing phone setup. Frontend-only.

## 1. Host Contact Card (`src/pages/Dashboard.tsx`)

Current card mixes contact info, a "View calls" button, the website snippet, and a "Review phone setup" CTA. Slim it down to pure contact info.

- **Header copy:** change subtitle from current text to **"Call or text your host"**.
- **Show one phone number, not two.** Today the number is rendered both in the header block and as a `ContactRow`. Keep a single prominent display (the `ContactRow` "Call or text" line) and drop the duplicate in the header.
- **Remove buttons inside the card:**
  - Remove the **"View calls"** button (already in Quick Actions).
  - Remove the **"Review phone setup"** / phone-setup CTA from the card. Setup lives under Settings; the card is for contact info only.
- **Add Elliot's email** as a `ContactRow` with a `mailto:` link, sitting alongside the phone row.
- **Move the Website Snippet** out of the contact card and into **Quick Actions** (per your choice). Remove it from the card entirely.
- Keep the **Message Elliot** action (it's a contact channel).

Resulting card contents: avatar + name + "Call or text your host" subtitle, status pill, phone row, email row, message-host action. Nothing else.

### Email source — assumption to confirm

There is no `aiHostEmail` field on the tenant/location records or in Supabase today. The only email we can surface without backend changes is the onboarding `draft.contactEmail || draft.email` (the owner's email). I'll wire the row to that.

If you meant a different per-host email (e.g. an `elliot@…` alias provisioned somewhere I didn't find), point me at where it's stored and I'll swap the source — but I won't add a schema/backend change in this pass since you scoped it to frontend.

## 2. "Needs phone setup" false alarm

In `src/pages/Dashboard.tsx:148-150` the check is:

```ts
const phoneIsDemo =
  !assignedPhoneNumber ||
  assignedPhoneNumber === assignedDemoPhoneNumber ||
  assignedPhoneNumber.includes("555");
```

Olive & Ember's real provisioned demo number is `+1 (415) 555-0142` — it contains `"555"`, so the heuristic flags every demo-vertical number as unconfigured even though the line works.

Fix per your choice (**only show when no number is assigned**):

```ts
const phoneIsDemo = !assignedPhoneNumber;
```

Drop both the `assignedDemoPhoneNumber` equality check and the `.includes("555")` guard. `setupNeeded` then becomes true only when there's literally no number on the tenant, which matches reality for working demo workspaces.

Side effect: the "Needs Attention" / "Review phone setup" tile and any banner driven by `setupNeeded` will disappear for Olive & Ember and the other demo verticals. That's the intent.

## 3. Quick Actions

Add a **"Website snippet"** action to the Quick Actions grid that routes to the same destination the card link used (the embed/snippet screen under Settings). No other Quick Actions changes.

## Out of scope

- No Supabase schema changes, no new backend fields, no auth/billing/call-processing changes.
- No new per-tenant host email column — using existing `draft.contactEmail` until you tell me otherwise.
- No layout changes outside the contact card, the `setupNeeded` derivation, and the Quick Actions list.

## Files touched

- `src/pages/Dashboard.tsx` — card contents, `phoneIsDemo` logic, Quick Actions entry.

That's it. Approve and I'll implement.