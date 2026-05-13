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

## Examples

- "Tonight's special is lobster ravioli. Mention it when callers ask about specials."
- "We are closed tomorrow for a private event."
- "Storm mode: prioritize active roof leaks and collect photos."
- "Sarah is out sick today. Send her booking requests to the main link."
- "We are running 20 minutes behind. Set expectations gently."

## Current Scope

The UI keeps this local for now so the live database does not need an immediate migration. The domain model is ready for backend persistence. Owner Assistant commands already use the same shared state, which makes the future SMS command path much smaller.

## Persistence Path

The baseline Supabase schema now includes `business_live_updates`.

Next backend step:

1. Add the table to the live Lovable Supabase database.
2. Add RLS policies for owners/admins/managers.
3. Add Supabase REST functions for create/read/clear.
4. Load active updates into the voice service restaurant context.
5. Replace local command writes with Supabase-backed writes.
