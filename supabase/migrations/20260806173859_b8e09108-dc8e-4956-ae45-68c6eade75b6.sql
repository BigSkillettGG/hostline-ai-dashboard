-- Production migration ledger compatibility marker.
--
-- Lovable applied the full contents of
-- 20260806170000_commercial_function_privilege_hardening.sql under this
-- generated migration version while deploying on 2026-08-06. Clean
-- installations already execute the canonical migration above, so repeating
-- the privilege statements here would be redundant. Keep this versioned no-op
-- so local migration history remains reconcilable with the production Supabase
-- migration ledger.

select 1;
