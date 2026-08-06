# Known Good State

This file records what must be preserved. Read it before changing voice behavior, routing, onboarding, reporting, demo data, or owner-assistant features.

## Current Strategic State

SignalHost should feel like an AI front desk employee, not an IVR.

The strongest product direction is:

- Answer customers by phone, chat, SMS, and email.
- Use structured business knowledge from onboarding.
- Capture requests cleanly.
- Alert the right owner/manager/staff contact.
- Report what happened.
- Learn from corrections and temporary updates.
- Help recover revenue through follow-up.

## Commercial Hierarchy Foundation

The required hierarchy is SignalHost platform -> channel partner -> customer organization -> location/rooftop -> department, with queues, agents, workflows, knowledge, and reporting scoped below it in later slices.

The first Phase 1 foundation slice preserves these invariants:

- Direct customers use the deterministic `SignalHost Direct` channel partner rather than a separate product fork.
- Existing organization and location IDs are unchanged.
- Every location receives a default `General Reception` department with `inherit_location` access, so current organization memberships keep working.
- Partner roles extend existing helper-based organization/location RLS; customer membership never grants access to sibling organizations under the same partner.
- Customer and partner users cannot reassign an organization to another partner or remove/move/restrict the default department.
- Queues, transfer targets, real scope switching, partner branding, and support-audit controls are still unfinished.
- The hierarchy and routing-identity migrations were applied in order to production on 2026-08-06; repository implementation and production schema now agree for these two slices.

The canonical contract is `docs/COMMERCIAL_HIERARCHY_FOUNDATION.md`. Production application is verified, but dashboard or voice dependencies must still be introduced through narrow slices with role, fallback, and regression coverage.

The subsequent routing-identity foundation in `docs/COMMERCIAL_ROUTING_FOUNDATION.md` preserves these additional invariants:

- `staff_directory_entries` represents human employees/contractors; it does not replace the location-level AI `agent_configs` record or trusted `business_contacts`.
- Every department receives a callback-only Primary Queue. That queue is an ownership identity, not proof of live telephony routing.
- Queue membership and transfer-target references cannot cross location/department ownership boundaries; linked users lose queue-derived access when their base tenant affiliation is removed.
- Transfer targets start dormant, require service-recorded verification before activation, and require re-verification after routing-relevant changes.
- Existing alert JSON, trusted-contact fallbacks, free-text task assignment, fixed Vapi assistants/numbers, and all voice prompts/routes remain unchanged.
- No runtime may claim or attempt live transfer merely because a transfer-target row exists.

Production verification completed on 2026-08-06:

- PostgREST resolves `channel_partners`, `partner_memberships`, `departments`, `department_memberships`, `staff_directory_entries`, `queues`, `queue_members`, and `transfer_targets` in the connected production project.
- The production migration ledger uses generated versions `20260806043652` and `20260806043823`. Keep their checked-in no-op marker files, keep the full DDL in canonical versions `20260806010000` and `20260806020000`, and keep explicit `service_role` grants in the canonical migrations and RLS snapshot.
- All six demo users still authenticate and retain their existing location access.
- Each checked demo organization has a channel partner, and each checked location has exactly one default General Reception department and one active callback-only Primary Queue.
- Anonymous access cannot read populated partner/department foundation rows. Full executable negative isolation coverage across partner, organization, location, and department boundaries is still required before broader UI/runtime use.
- Production voice health remained ready with Vapi preferred, routing-policy enforcement disabled, and LiveKit quarantined; the migration did not activate a route or change voice configuration.

The subsequent telephony ownership foundation in `docs/COMMERCIAL_TELEPHONY_FOUNDATION.md` is also applied and verified in production. It preserves these invariants:

- Existing `phone_numbers` remains the compatibility source used by Vapi/Twilio provisioning, lifecycle, messaging, and dashboard code.
- Telephony resource ownership, billing responsibility, and end-customer relationship ownership are separate fields; provider credentials never belong in account/trunk settings.
- Existing/new numbers receive a SignalHost-managed compatibility account when no explicit account is supplied.
- Every number receives one primary `observed` route to its location's default department. Observed means documented, not runtime-enforced.
- SIP trunks and explicit number routes require service-recorded verification and `runtime_enforced = true` before active status.
- The deployed global Twilio SIP trunk is not backfilled or tenant-manageable in this slice.
- Vapi remains preferred, no runtime reads `number_routes`, and no current provider/number/assistant/webhook/prompt/model/voice/tool/route is changed.
- All six authenticated demo tenants passed the read-only `npm run check:commercial-telephony` gate on 2026-08-06: 21 visible phone numbers had 21 primary observed routes, every number had a telephony account reference, each tenant saw only its own location/department/number/route rows, and partner-global accounts/trunks remained hidden.
- Production voice health remained ready after application. Vapi and all current runtime routes remain unchanged.
- Lovable recorded the applied telephony DDL under generated version `20260806144125`. Keep its checked-in no-op marker, the full DDL in canonical version `20260806070000`, and the live-regenerated Supabase types so clean installs and the production ledger remain reconcilable.

The first commercial workspace-switching slice preserves these additional invariants:

- The live directory and Supabase RLS remain the access source of truth; changing local active scope never grants access.
- Supabase sign-in hydrates both organization and partner memberships.
- Customer and partner roles are recalculated for the selected organization/partner instead of carrying a role across scopes.
- The header selector lists only RLS-visible live locations and invalidates queries after an explicit switch.
- Platform staff tenant view remains visibly identified. Support-session audit and department switching remain unfinished.
- No voice, provider, phone, assistant, route, or runtime behavior changes with dashboard scope.
- Verification is green: 97 test files / 590 tests, TypeScript, lint with zero errors and eight pre-existing warnings, all three production builds, the authenticated production RLS verifier, and a real Supabase customer browser login. The customer menu showed only its own live location. A seeded partner demo identity is still needed for production browser coverage of multi-customer partner switching.

The commercial function-privilege hardening slice revokes PostgreSQL's default `PUBLIC` execution from all commercial helpers. Migration `20260806170000_commercial_function_privilege_hardening.sql` was applied to production on 2026-08-06. Live inspection confirmed `anon` denial on all 49 covered helpers, authenticated execution only on the 20 direct RLS predicates, service-only internal/trigger/write helpers, and service-role execution on all 49. Commercial row counts and dormant route state were unchanged. Both production isolation gates passed after application.

The customer-to-customer production write-isolation gate is also passing. `npm run check:commercial-write-isolation` authenticated as all six demo customers and denied 48 current-value PATCH probes across partner administration, organizations, locations, departments, queues, phone numbers, number routes, and telephony accounts. No probe returned a writable row, no insert/delete was issued, and no business data changed. Repository verification is green at 99 test files / 599 tests, TypeScript, lint with zero errors and eight pre-existing warnings, the read-only production gate, and whitespace validation. Partner-role and controlled insert/delete coverage remain open.

The repository now carries explicit department navigation context below the active location. The header loads only RLS-visible active departments, keeps a valid selection or chooses the location default, and clears stale department state on location switches. This is navigation context only: existing calls, requests, workflows, knowledge, and reports remain location-scoped until their department ownership is deliberately modeled. The dashboard through commit `d6c9dc179e70ba6259820dc452d34a951c5c3628` was published to `signalhost.ai` on 2026-08-06. The live bundle exposes partner and department workspace controls and no longer contains `second location (soon)`; both production isolation gates passed after publication. A controlled partner identity is still needed for browser coverage of multi-customer partner switching.

The repository and deployed voice health metadata now label Vapi consistently as the preferred managed runtime. The legacy readiness-check ID and implementation filenames may still contain `vapi_pilot`, but the public label/detail no longer claims Vapi is quarantined or that direct OpenAI SIP is primary. Production `/health` remains `productionReady: true`, reports `preferredProvider: vapi`, labels the check `Vapi preferred runtime`, keeps direct OpenAI Realtime SIP as maintained fallback, and keeps LiveKit quarantined.

## Known Good Voice Direction

Baseline details are frozen in `docs/VOICE_BASELINE_LOCK.md`. Read that file before changing Vapi assignments or direct OpenAI Realtime fallback routing/tuning.

The preferred production voice direction is Vapi, because Vapi test calls were materially better on both handset and speakerphone than the previous direct-SIP and LiveKit experiments. Legacy names may still call it a pilot while the provider boundary is introduced.

Vapi demo calls should preserve:

- SignalHost business context and tools through `/vapi/webhook`
- Vapi-managed phone/voice orchestration
- Vapi assistant/server setup generated from SignalHost, not manually rebuilt each time
- Supabase call logging, transcripts, recordings, tasks, and owner workflows
- No caller-facing use of the word "lead"

The direct fallback path remains:

- OpenAI Realtime SIP
- `gpt-realtime-2`
- OpenAI Realtime voices
- Twilio number/SIP trunk routing
- Supabase call logging

The user liked:

- More expressive `gpt-realtime-2` speech.
- Natural probing questions when they qualify the request without sounding rigid.
- The agent explaining the next step when it feels human and useful.
- Low-noise speakerphone calls that get all the way through.

Preserve these.

## Known Bad Or Quarantined Paths

Do not accidentally revert to these:

- ElevenLabs for live calls.
- Twilio ConversationRelay as the main experience.
- LiveKit as default routing.
- Odd/non-human voice names like Marin, Coral, Cedar, or Verse.
- Rigid IVR-style flows that ignore the LLM's conversational ability.

LiveKit may remain in code/docs as an experiment, but it is not the default unless the user explicitly restarts that pilot.

Vapi is the preferred runtime, not merely a pilot comparison. The user explicitly approved moving demo businesses toward Vapi after strong test calls. Keep Vapi changes controlled and automated through `docs/vapi-pilot.md` and `scripts/provision-vapi-demos.mjs`.

## Greeting Contract

Every business should answer:

```text
Thank you for calling {business name}. How can I help you?
```

The greeting should:

- Be complete and audible.
- Sound upbeat and confident.
- Not introduce the assistant by name by default.
- Not say it is virtual by default.
- Not be interrupted by echo or background noise.

Post-greeting agent replies should also protect themselves from echo:

- Any normal post-opening agent speech must lock Realtime input before `response.create`.
- Do not rely on `response.created` as the first moment to disable listening; that is only a backup.
- Clear Realtime `input_audio_buffer` before each post-opening `response.create`.
- Clear Realtime `input_audio_buffer` before restoring listening after greeting audio and normal agent audio.

If a caller asks "Is this Harbor Plumbing?" the correct shape is:

```text
Yes, you've reached Harbor Plumbing. How can I help you?
```

Do not say the assistant is not Harbor Plumbing in a confusing way.

## Caller Language Contract

Never call the caller a "lead."

Allowed caller-facing alternatives:

- request
- service request
- message
- details
- appointment request
- reservation request
- order request
- follow-up

Internal systems may still use lead/opportunity/value-tier concepts.

## Demo Data Contract

The six demo businesses should stay vertical-specific:

- Olive & Ember: restaurant
- Summit Air: HVAC
- Harbor Plumbing: plumbing
- RidgeLine Roofing: roofing
- BrightWire Electric: electrical
- Luna Studio: salon/barbershop

Reports, analytics, onboarding questions, and demo knowledge must stay vertical-specific. Electricians should not see reservation language. Restaurants should not see HVAC service-area triage unless the product intentionally supports a cross-vertical generic field.

## Owner Assistant Contract

Owners and trusted contacts should be able to communicate with SignalHost through:

- Dashboard
- Phone
- SMS when available
- Email when available

Owner commands should share the same command router regardless of channel. Permanent/sensitive knowledge changes may require approval depending on permissions. Temporary updates can usually apply immediately with expiration.

## Debugging Contract

When the user says a call went badly, do not guess from memory.

Required sequence:

1. Identify the business and approximate call time.
2. Fetch the latest call or exact call id from Supabase/debug endpoint.
3. Confirm the call path.
4. Use `/debug/calls/{id}?audio=true`.
5. Compare database transcript against audio diagnostic.
6. Summarize what actually happened.
7. Only then propose a fix.

Do not say we cannot listen to calls. We can analyze the recording through the deployed debug path when a recording is attached.

## Current Risk Area

The current high-risk area is speakerphone echo and greeting/listening timing.

Do not make broad changes to business logic, vertical prompts, or owner flows while trying to fix speakerphone behavior. Keep audio-path fixes narrow and reversible.

## Opening Greeting Lock

The opening greeting is special. Do not treat it like a normal agent response.

For the first greeting:

- Start the session with input turn detection set to `null`.
- Send the exact greeting: `Thank you for calling {business name}. How can I help you?`
- Do not restore caller listening on `response.done`.
- Do not restore caller listening on `response.audio.done` instantly.
- Restore caller listening after the opening audio-complete event plus the short opening playout guard.
- Keep the longer transcript-estimated guard only as a fallback if the audio-complete event is missing.
- Do not let raw `input_audio_buffer.speech_started` cancel the first-listen recovery unless an accepted caller transcript arrives.
- Keep generic response latency tight: manual response delay defaults to `300ms` and caps at `500ms`; server VAD silence defaults to `600ms` and caps at `700ms`.

Reason:

- The database transcript can contain the full greeting before PSTN audio is safely heard by the caller.
- Speakerphone or handset echo can trigger false speech-start events during the opening.
- The safest current fix is a hard opening playout lock during the greeting, followed by a short post-audio guard so the first real caller request is not missed.
