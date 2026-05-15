## Plan

Apply `supabase/migrations/20260515130000_seed_vertical_demo_accounts.sql` to the Lovable Cloud database, then verify the seed.

### Steps

1. Run the full migration SQL via the migration tool. It is idempotent: it upserts six organizations, creates/refreshes six demo auth users (password `SignalHostDemo!2026`), and seeds locations, phone numbers, calls, and transcripts for each vertical.

2. Verify with read queries:
   - `public.locations` contains all six fixed UUIDs (Olive & Ember, Summit Air, Harbor Plumbing, RidgeLine Roofing, BrightWire Electric, Luna Studio).
   - `auth.users` contains the six `demo.*@signalhost.ai` accounts with confirmed emails.
   - Spot-check `public.phone_numbers` has one row per location.

3. Report back: migration status, location row presence, and demo user presence. (Login attempts via REST require running the script outside the SQL tool — confirming the rows + confirmed_at timestamp + password hash is the practical verification here.)

### Notes

- Olive & Ember location (`78d8053b-...`) already exists from prior seeds; the migration's `on conflict do update` will refresh it without breaking FKs.
- No application code changes are needed.