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

## Deployment gate

This migration is repository-only until production application is recorded. After application:

1. confirm anonymous and authenticated RPC calls to `ensure_default_telephony_account(text)` are denied;
2. rerun `npm run check:commercial-telephony` across all six customer identities;
3. confirm the dashboard directory and workspace selector still load;
4. confirm phone provisioning/service-role writes still create compatibility account/route references; and
5. recheck production voice health.
