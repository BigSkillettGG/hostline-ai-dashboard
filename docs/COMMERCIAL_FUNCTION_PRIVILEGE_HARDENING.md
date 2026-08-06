# Commercial Function Privilege Hardening

## Risk addressed

PostgreSQL grants `EXECUTE` on newly created functions to `PUBLIC` unless it is explicitly revoked. The commercial hierarchy, routing, and telephony migrations use `SECURITY DEFINER` helpers so RLS can evaluate scoped relationships without recursion.

Most helpers only return an access decision or internal identifier, but `ensure_default_telephony_account(text)` can create a compatibility account. Leaving that helper executable through PostgREST RPC would allow an untrusted caller to invoke an internal write path outside the intended phone-number trigger.

## Contract

Migration `20260806170000_commercial_function_privilege_hardening.sql`:

- revokes all commercial helper execution from `PUBLIC`, `anon`, and `authenticated`;
- restores all helper execution to `service_role`;
- restores `authenticated` execution only for functions referenced directly by RLS policies;
- keeps trigger functions, internal relationship lookups, normalization helpers, and `ensure_default_telephony_account(text)` unavailable as customer/anonymous RPCs; and
- does not change table grants, policies, rows, routes, providers, or voice configuration.

Trigger execution remains compatible because PostgreSQL checks the trigger-function privilege when the trigger is created; the existing triggers execute their `SECURITY DEFINER` internals as the function owner.

## Production evidence

Migration `20260806170000_commercial_function_privilege_hardening.sql` was applied to the connected production database on 2026-08-06 without runtime changes. Lovable recorded that production application under generated version `20260806173859`; the generated file is retained as a no-op ledger marker while the named canonical migration remains the source of truth. Live privilege inspection confirmed:

- `anon` has no execution privilege on all 49 covered helpers;
- `authenticated` retains execution only on the 20 predicates referenced directly by RLS;
- internal lookups, trigger functions, and `ensure_default_telephony_account(text)` remain unavailable to `authenticated`;
- `service_role` retains execution on all 49 helpers; and
- commercial row counts and dormant route state were unchanged.

Post-application verification passed `npm run check:commercial-telephony` for all six customer identities, `npm run check:commercial-write-isolation` for all 48 cross-tenant PATCH denials, and the production voice health check. Controlled service-role provisioning remains the positive trigger-compatibility check when the next disposable phone-number fixture is introduced; production data should not be mutated solely to manufacture that evidence.
