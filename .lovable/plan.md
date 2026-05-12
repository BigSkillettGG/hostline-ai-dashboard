## Seed Olive & Ember demo organization + location

Insert one organization and one location into Supabase so the voice service has a real `location_id` to write calls into.

### Data to insert

- `public.organizations`: name = `Olive & Ember`
- `public.locations`:
  - name = `Olive & Ember`
  - organization_id = (the new org id)
  - phone = `NULL` (placeholder until you provide a real Twilio number)
  - ai_host_phone = `NULL`
  - timezone = `America/Los_Angeles` (matches the existing mock for Olive & Ember in `src/data/mock.ts`)

Both inserts go through the `supabase--insert` tool in a single statement using a CTE so we can capture and return both UUIDs deterministically.

### After insert I will return

1. `public.organizations.id` (UUID)
2. `public.locations.id` (UUID)
3. A confirming `SELECT` showing the new row in `public.locations`
4. The exact UUID to paste into Render as `SUPABASE_DEMO_LOCATION_ID` (same as #2)

### Notes

- No schema changes — pure data insert, no migration needed.
- No code changes, no UI changes.
- You can update `phone` / `ai_host_phone` later once your Twilio number is provisioned; the voice service only needs the `location_id` to start persisting calls.
- After Render is updated with `SUPABASE_DEMO_LOCATION_ID`, `SUPABASE_URL`, and `SUPABASE_SECRET_KEY`, `/health` should flip `supabaseConfigured: true` and the next call will create rows in `calls` + `transcript_turns`, visible in `/super/calls`.