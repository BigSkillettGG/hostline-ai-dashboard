# SignalHost Next Actions

Keep this file current so work can resume after context compaction.

## Current Immediate Mode

The user requested a persistent memory system because repeated context compaction caused regressions. This file is part of that system.

Current slice:

- Apply and verify the third compatibility-safe Phase 1 migration only after its repository checkpoint is pushed and an exact database-capable deployment path is available.
- Keep the existing `phone_numbers` table and all current Vapi/Twilio bindings as the compatibility source; `telephony_accounts`, `sip_trunks`, and `number_routes` are ownership/control-plane identities only.
- Keep every backfilled number route `observed` and `runtime_enforced = false`.
- Do not import the global Twilio SIP trunk, make a new route operational, change a provider binding, or connect department queues to live calls until a separately verified runtime slice.
- Do not change live assistants, phone numbers, webhooks, prompts, tools, voices, models, or routes.
- Keep production application, repository implementation, and runtime activation as three explicitly separate states.

Status update:

- Commercial repository audit completed on 2026-08-05 at `f91ffa5`; the blueprint records existing, incomplete, mock/fallback, obsolete, missing, and risk states.
- Phase 0 is deployed and healthy at `d34e498`: Vapi is preferred, direct OpenAI Realtime SIP is the maintained fallback, ConversationRelay is the legacy fallback, and LiveKit is quarantined. Catalog reporting remains intentionally non-routing (`routingPolicyEnforced: false`).
- The Phase 1 hierarchy contract is documented in `docs/COMMERCIAL_HIERARCHY_FOUNDATION.md`.
- Additive migration `20260806010000_commercial_hierarchy_foundation.sql` now defines channel partners, partner memberships, departments, department memberships, the deterministic `SignalHost Direct` parent, default General Reception backfill/trigger, and partner-aware RLS helpers.
- Routing contract `docs/COMMERCIAL_ROUTING_FOUNDATION.md` and additive migration `20260806020000_commercial_routing_foundation.sql` define human staff directory entries, callback-only department queues, queue members, and verification-gated transfer targets.
- Current handoff remains callback/task/alert. `business_contacts`, alert-routing JSON, `agent_configs`, `phone_numbers`, free-text task assignment, Vapi assistants, and all live routes are unchanged.
- Cross-location staff/queue/target references are rejected; browser users cannot self-verify transfer targets or silently edit verified routing details.
- Existing organization/location IDs, bootstrap writes, dashboard queries, demos, and voice routing remain unchanged. Default departments inherit location access.
- Checked-in Supabase types and clean-install schema/RLS snapshots represent the new objects.
- Verification is green: 94 test files / 574 tests, TypeScript, lint with zero errors and eight pre-existing warnings, all three production builds, and independent PostgreSQL parsing of both migrations and SQL snapshots.
- Both Phase 1 migrations were applied in order to the connected production Supabase project on 2026-08-06 through the authenticated Lovable database path.
- Lovable recorded the deployment under generated versions `20260806043652` and `20260806043823` and regenerated `src/integrations/supabase/types.ts` from the live schema. Those exact versions remain as documented no-op ledger markers; their required `service_role` grants are folded into the two canonical migrations and the clean-install RLS snapshot.
- Post-deployment reconciliation verification is green: 95 test files / 576 tests, TypeScript, lint with zero errors and eight pre-existing warnings, and dashboard, voice-service, and LiveKit-agent production builds.
- Live PostgREST verification resolves all eight new tables. Authenticated checks across all six demo tenants confirm the existing location remains visible, its organization has a channel partner, and the location has exactly one default General Reception department with one active callback-only Primary Queue.
- Anonymous access cannot read the populated partner/department foundation rows, and the checked-in migrations enable RLS on all eight tables. A dedicated executable cross-partner/cross-organization/cross-location/cross-department negative test harness remains open before UI/runtime dependency expands.
- Production voice verification remained green after the database deployment: `https://hostline-voice.onrender.com` is production-ready, Vapi is preferred, direct routing-policy enforcement remains off, and LiveKit remains quarantined.
- Phase 1 slice 3 is implemented in the repository under `docs/COMMERCIAL_TELEPHONY_FOUNDATION.md` and migration `20260806070000_commercial_telephony_ownership_foundation.sql`.
- The slice adds non-secret telephony account ownership/billing/customer-relationship metadata, dormant SIP trunk identities, a required compatibility account on `phone_numbers`, and observed default-department number routes. Legacy service/script inserts remain compatible through a default-account/observed-route trigger path.
- Browser users cannot self-verify a trunk/route, enable runtime enforcement, alter observed routes, move numbers across locations, or attach an unauthorized provider account. Current voice/runtime code does not read the new route table.
- Slice 3 repository verification is green: 97 test files / 586 tests, TypeScript, lint with zero errors and eight pre-existing warnings, and dashboard, voice-service, and LiveKit-agent production builds.
- The slice 3 migration is not yet applied to production. Do not make UI/runtime code depend on its tables until live backfill, RLS, demo-login, and voice-health verification is recorded.
- Number routes, AI agent/workflow/knowledge/report scoping, production-backed location/department switching, immutable support audit, and executable cross-tenant RLS tests remain later Phase 1 slices.
- The Vapi executor still lacks some tools advertised by fixed assistants; action parity is a later verified slice, not part of this non-routing foundation change.
- Vapi pilot location allow-list now includes all six demo businesses.
- Vapi demo provisioning has been run successfully for all six demos.
- `scripts/provision-vapi-demos.mjs` is now idempotent: it reuses an active Vapi number for a demo location instead of creating another one, unless `--force-new-phone-number` is explicitly passed.
- The script now tries alternate area codes when Vapi has no number inventory in the preferred area code.
- Latest Olive & Ember Vapi test showed the assistant was assigned correctly, but the synced assistant used stale direct-OpenAI-Realtime settings (`gpt-realtime-2025-08-28` + OpenAI voice `marin`) instead of the preferred Vapi baseline (`gpt-5.2-instant` + Vapi voice `Elliot`).
- Code now guards Vapi assistant sync against that stale env leak: direct Realtime model names are mapped back to the Vapi API value `gpt-5.2-chat-latest` (shown in the Vapi dashboard as GPT 5.2 Instant), and `VAPI_OPENAI_VOICE_ID` no longer overrides the Vapi voice unless `VAPI_VOICE_PROVIDER=openai` is explicitly set.
- After deploying commit `8304db7`, Vapi assistant/phone sync succeeded for all six demo businesses and reused the existing primary Vapi numbers.
- A later sync bug created duplicate fixed assistants because the script reused existing Vapi phone numbers but did not reuse the assistant ID already attached to each phone number. This has been cleaned up: each primary demo number now has exactly one matching fixed Vapi assistant, and all six assistants were re-synced to the Vapi baseline.

Current Vapi demo numbers:

| Business | Vapi number |
| --- | --- |
| Olive & Ember | `+1 781 523 0245` |
| Summit Air | `+1 781 523 0249` |
| Harbor Plumbing | `+1 781 523 0283` |
| RidgeLine Roofing | `+1 508 905 1359` |
| BrightWire Electric | `+1 978 384 2922` |
| Luna Studio | `+1 781 523 0279` |

Cleanup note:

- Supabase also shows older extra Vapi rows for Olive & Ember: `+1 781 523 0266` and `+1 781 523 0284`.
- They are not the current primary `ai_host_phone`, but they should be released/removed from Vapi later so they do not clutter the Vapi account.

## Current Voice Situation

Vapi legacy-pilot scaffolding is the current preferred production voice path while naming and provider boundaries are migrated:

- Admin config endpoint: `/vapi/pilot-config`
- Assistant sync endpoint: `/vapi/sync-assistant`
- Phone-number sync endpoint: `/vapi/sync-phone-number`
- Server webhook endpoint: `/vapi/webhook`
- Setup/runbook: `docs/vapi-pilot.md`
- Bulk demo script: `npm run provision:vapi-demos`
- Duplicate assistant cleanup script: `npm run reconcile:vapi-demos`
- It reuses SignalHost business context, tools, and call logging.
- The user explicitly approved extending Vapi to the other demo businesses after strong test calls.

The OpenAI Realtime notes below are historical direct-fallback tuning evidence. They are not the current default-runtime declaration.

Most recent analyzed issue:

- Call id `58c11551-cb85-4b27-84c7-cf15acc70fba`: caller heard the full Olive & Ember greeting, asked to place a takeout order, then asked for pepperoni pizza and Caesar salad.
- The greeting was clean in the recording.
- Response latency was too high: about `8.3s` after the first caller request and about `4.1s` after the item request.
- The off-menu response began correctly but was truncated/incomplete.

Diagnosis:

- Opening greeting and first request capture are working for this call.
- The remaining failures were stale input audio around agent replies plus overly slow response-delay caps.
- Render may still have old env values set, so code defaults alone are not enough.

Fix implemented:

- Clear OpenAI Realtime `input_audio_buffer` before every post-opening agent `response.create`.
- Clear OpenAI Realtime `input_audio_buffer` before restoring listening after the opening greeting and after normal agent audio.
- Tightened latency caps so stale Render values cannot keep calls on the old slow profile:
  - manual response delay default `300ms`, cap `500ms`
  - detail-capture delay default `850ms`, cap `1000ms`
  - server VAD silence default `600ms`, cap `700ms`
- No model, voice, routing, provider, business knowledge, or tools were changed.

Recently fixed opening-timing issue:

- Full greeting appears in transcript.
- Audio diagnostic shows greeting audio from about `1.0s` to `3.9s`.
- Caller said "Hello?" around `8.5s`.
- Agent did not respond until around `13.5s`.
- End of call had broken overlap.

After deploy, retest Olive & Ember with: "I want to place an order for takeout." Expected behavior: SignalHost hears the first request, answers faster, does not repeat the greeting, and does not truncate its own answer.

Likely next technical discussions:

- How to make greeting playout/listening unlock more deterministic.
- How to avoid false post-greeting dead air.
- How to keep current speakerphone progress without loosening the system.
- How to recover naturally when a caller says the agent was interrupted or cut off.

## High Priority Product Work Still Open

These are important but should not distract from the current voice stability issue unless the user chooses them:

- Stripe checkout/subscription activation.
- Final SMS/A2P registration and production texting.
- Production email/webhook hardening.
- Owner assistant polish.
- Learning loop polish.
- Follow-up queue and revenue recovery.
- More vertical-specific analytics/reporting QA.
- Address capture/geocoding with Google Places.
- Integration/premium toolkit strategy.

## Current Vapi Demo State

As of 2026-05-22, the six primary demo businesses are on fixed Vapi assistants
attached to their existing Vapi phone numbers. Do not rely on Vapi dynamic
assistant-request routing for these demos unless intentionally retesting it.

Current primary numbers:

- Olive & Ember: `+1 781 523 0245`
- Summit Air: `+1 781 523 0249`
- Harbor Plumbing: `+1 781 523 0283`
- RidgeLine Roofing: `+1 508 905 1359`
- BrightWire Electric: `+1 978 384 2922`
- Luna Studio: `+1 781 523 0279`

Vapi fixed assistant sync works only after omitting custom `serverMessages`; let
Vapi use its default server events for tool calls and end-of-call reports.

Vapi voice/model baseline for demos:

- Dashboard label: GPT 5.2 Instant
- Vapi API model value: `gpt-5.2-chat-latest`
- Voice provider: `vapi`
- Voice ID: `Elliot`
- Do not let `OPENAI_REALTIME_MODEL`, `VAPI_OPENAI_MODEL=gpt-realtime-*`, or
  `VAPI_OPENAI_VOICE_ID=marin` overwrite this baseline during demo sync.
- Do not send Deepgram `keytermsPrompt` in Vapi assistant sync; Vapi currently
  rejects that field for this assistant payload.
- Vapi requires model temperature to be at least `0.6`; assistant sync must not
  send lower values.

Known cleanup: older Olive & Ember Vapi rows for `+1 781 523 0266` and
`+1 781 523 0284` still appear in `phone_numbers` as active and are not the
current primary test numbers.

Vapi assistant cleanup status:

- Completed after deploying the voice service with `/vapi/resources` and `/vapi/delete-assistant`.
- Final reconciliation showed no duplicate demo assistants.
- Each demo assistant is synced to the preferred baseline:
  - Dashboard label: GPT 5.2 Instant
  - Vapi API model value: `gpt-5.2-chat-latest`
  - Model temperature: `0.6`
  - Voice provider: `vapi`
  - Voice ID: `Elliot`

## Call Testing Checklist

When the user makes a test call:

1. Ask/identify which number/business.
2. Fetch latest call for that location.
3. Confirm call path.
4. Use audio diagnostic.
5. Summarize exactly what happened.
6. Only propose changes after analysis.

## Do Not Forget

- The user is highly sensitive to regressions now.
- Do not say a call cannot be listened to; use the debug path.
- Do not make fixes when the user asks only for analysis.
- Do not re-open LiveKit unless explicitly requested.
- Do not switch voice providers.
- Do not change routing while debugging prompt/voice behavior.
