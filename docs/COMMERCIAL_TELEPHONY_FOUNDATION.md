# Commercial Telephony Ownership Foundation

Status: Phase 1 slice 3 data and authorization contract; repository implementation only until production application is separately recorded

## Purpose

SignalHost must support direct service and white-label distribution without forcing a telecom or MSP to surrender its numbers, carrier account, SIP trunk, PBX relationship, billing responsibility, or end-customer relationship. This slice adds the ownership and route identities needed for that model without changing a live call path.

The hierarchy remains:

```text
SignalHost platform
  -> channel partner
    -> customer organization
      -> location / dealership rooftop
        -> department
          -> number and dormant route
```

## Current production truth preserved

- `phone_numbers` is the live compatibility record used by provisioning, Vapi demo scripts, Twilio lifecycle cleanup, dashboard verification, inbound SMS lookup, and location `ai_host_phone` selection.
- Current Vapi rows store the Vapi phone-number ID in `provider_sid`; current Twilio rows use Twilio identifiers and may represent webhook or direct OpenAI SIP behavior.
- The global Twilio SIP trunk relationship still lives in voice-service environment configuration. It is not silently converted into a tenant-manageable trunk by this slice.
- Vapi remains the preferred voice runtime. Direct OpenAI Realtime SIP remains the maintained fallback. No provider, number, assistant, webhook, prompt, model, voice, tool, or route changes here.

## New identities

### Telephony accounts

`telephony_accounts` records a non-secret commercial/technical relationship with a carrier, voice runtime, or PBX. Every account belongs to a channel partner and may be narrowed to an organization and location.

The record separately identifies:

- resource ownership: SignalHost, partner, or customer;
- billing responsibility: SignalHost, partner, or customer;
- end-customer relationship ownership: SignalHost or partner;
- provider and account kind;
- non-secret external account reference, capabilities, lifecycle, and settings.

Provider credentials, auth tokens, signing secrets, and private keys do not belong in this table or its JSON settings.

Existing numbers are backfilled to SignalHost-managed provider accounts so current inserts and upserts remain compatible. A trigger assigns the same default account when legacy provisioning code inserts a number without the new foreign key.

### SIP trunks and PBX relationships

`sip_trunks` records a trunk identity beneath a telephony account. It can describe inbound, outbound, or bidirectional connectivity and a non-secret signaling endpoint/reference.

Trunks begin in `draft`, are not runtime-enforced, and require service-recorded verification before `verified` or `active` state. Browser users cannot self-verify a trunk or enable runtime enforcement. The existing global Twilio SIP trunk is intentionally not backfilled because its deployed environment identity and ownership scope have not yet been safely imported.

PBX relationships are represented by `telephony_accounts.account_kind = 'pbx'`; PBX-specific adapters and credential storage remain later work.

### Number routes

`number_routes` maps an existing `phone_numbers` row to its department ownership and an optional queue, SIP trunk, or external destination. New routes are dormant by default.

Each existing and newly inserted number receives one primary `observed` route to the location's default department. `observed` means SignalHost recorded the compatibility location route; it does not mean the new route table drives the call.

An operational route requires all of the following in a later runtime slice:

1. service-recorded verification;
2. `status = 'active'`;
3. `runtime_enforced = true`;
4. a provider adapter that explicitly supports the route;
5. a tested failure/fallback policy.

No current runtime reads `number_routes` in this slice.

## Authorization and ownership rules

- Platform admins can manage all telephony accounts.
- Partner owners/admins can manage partner/customer-owned accounts assigned to their partner, but not SignalHost-owned accounts.
- Customer organization/location managers can manage only customer-owned accounts in their authorized scope.
- Customer membership does not expose a partner-global carrier/PBX account.
- A customer/partner user cannot attach a number to an account they are not authorized to manage; legacy null assignments may receive the compatibility SignalHost-managed default.
- Account, number, department, queue, and trunk references are rejected when their tenant/location scopes conflict.
- Trunk and route verification/runtime fields are service-controlled.
- Observed compatibility routes cannot be moved, activated, or deleted by customer/partner users.

## Explicit non-goals

This slice does not:

- import carrier credentials or the deployed global Twilio trunk;
- provision, port, release, forward, or rebind a number;
- change `locations.ai_host_phone`;
- make `number_routes` authoritative for inbound routing;
- enable live transfers, queue ringing/presence, PBX extensions, or failover;
- add partner/customer telephony administration UI;
- add provider billing reconciliation or wholesale rate cards;
- change Vapi, direct OpenAI SIP, ConversationRelay, ElevenLabs, or LiveKit behavior.

## Acceptance contract

- Existing `phone_numbers` IDs, provider values, provider IDs, status, lifecycle, webhooks, and location assignments are unchanged.
- Every existing/new number has a telephony account and one observed default-department route without changing live behavior.
- SignalHost-, partner-, and customer-owned account management paths are structurally distinct.
- Credentials cannot be stored in the modeled settings contract.
- Cross-partner, cross-organization, cross-location, cross-department, and invalid queue/trunk references are rejected by database functions/triggers.
- An active trunk or route requires verification and runtime enforcement recorded by a service path.
- Migration, schema/RLS snapshots, generated types, pure vocabulary tests, and migration contract tests agree.
- Test, typecheck, lint, and all production builds pass; `tmp/` remains untouched.
