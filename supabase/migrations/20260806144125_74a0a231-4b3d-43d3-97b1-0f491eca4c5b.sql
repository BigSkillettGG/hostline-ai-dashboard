-- Production migration ledger compatibility marker.
--
-- Lovable applied the full contents of
-- 20260806070000_commercial_telephony_ownership_foundation.sql under this
-- generated migration version while deploying on 2026-08-06. Clean
-- installations already execute the canonical migration above, so repeating
-- its DDL here would be redundant. Keep this versioned no-op so local migration
-- history remains reconcilable with the production Supabase migration ledger.

select 1;
