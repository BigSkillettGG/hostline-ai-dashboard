# Business Live Updates And Modes

This slice starts the "owner can brief SignalHost like a staff member" layer.

## What It Does Now

- Adds a mode selector in the Knowledge Base:
  - Normal
  - Busy
  - After hours
  - Emergency
  - Holiday
  - Promo
  - Staffing shortage
- Adds temporary updates with expiration:
  - Today only
  - Through tomorrow
  - Custom date/time
  - Until cleared
- Builds an instruction block that can be sent to the voice service later.
- Supports mode-scoped updates, such as "only use this during Busy mode."
- Shares the local live state between the Knowledge Base and Owner Assistant.
- Lets the Owner Assistant create live updates and mode changes from plain owner commands.
- Persists live updates and current business mode to Supabase when the live tables are available.
- Loads active live updates into the voice and website-chat runtime context.

## Examples

- "Tonight's special is lobster ravioli. Mention it when callers ask about specials."
- "We are closed tomorrow for a private event."
- "Storm mode: prioritize active roof leaks and collect photos."
- "Sarah is out sick today. Send her booking requests to the main link."
- "We are running 20 minutes behind. Set expectations gently."

## Current Scope

The dashboard uses Supabase-backed live updates when `business_live_settings` and `business_live_updates` are migrated. If those tables are not available yet, the dashboard falls back to local browser storage so preview work does not break.

The voice service reads active live updates into restaurant/business context and places them above permanent knowledge in model instructions. Active special, promotion, and event updates are also folded into the specials policy so callers asking about specials get the live answer.

## Persistence Path

The baseline Supabase schema now includes `business_live_settings` and `business_live_updates`.

Next backend step:

1. Apply the `20260513170000_business_live_updates.sql` migration in the live Lovable Supabase database.
2. Add verified owner SMS commands on top of the same command parser.
3. Add dashboard history/audit for who created or cleared each update.
4. Add optional expiry cleanup for old cleared updates.
