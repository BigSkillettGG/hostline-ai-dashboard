# SignalHost Commercial Product Blueprint

Status: source-of-truth commercial blueprint

Evidence date: 2026-08-05

Repository baseline: `main` at `f91ffa5`

Scope: what exists now, what can safely be sold, and the architecture required for direct and white-label distribution

## Executive decision

SignalHost is a substantial working product, but it is not yet a commercially complete front-desk operating system. It already has a real multi-tenant dashboard foundation, six working vertical demos, a deployed voice service, Vapi-managed inbound voice, a maintained direct OpenAI Realtime SIP implementation, call/transcript persistence, knowledge and onboarding, request and staff-task capture, owner reporting, web chat, number provisioning, and billing/integration scaffolding.

The commercial gap is not “build an AI receptionist.” The gap is to turn the existing receptionist and operations features into an accountable, partner-aware system with:

1. the full platform hierarchy and delegated administration;
2. a provider-neutral voice/action contract with Vapi as the preferred runtime;
3. a durable resolution engine for ownership, SLA, reminders, escalation, updates, and closure;
4. real delivery and business-system adapters instead of configuration surfaces and mocks;
5. white-label branding, partner-owned telephony, usage, support, and billing boundaries; and
6. a dealership reference package built on generic platform primitives.

Vapi is the default production voice runtime because it materially outperformed the custom voice paths in live testing. Direct OpenAI Realtime SIP remains a maintained fallback and engineering asset. Twilio ConversationRelay is legacy fallback only. LiveKit, OpenAI Agents SDK experiments, and ElevenLabs voice experiments are quarantined from default routing unless a deliberate, measured test reopens them.

No existing call route should be silently changed while the provider boundary is introduced. Provider choice must become an explicit policy, not a side effect of which webhook or environment variable happens to be configured.

## Evidence and confidence boundary

This blueprint is based on direct inspection of:

- `AGENTS.md`, `CLAUDE.md`, founder notes, current project memory, known-good state, voice quality ledger and lock, architecture documents, deployment/runbooks, pilot notes, decision records, product specs, and roadmap documents;
- git status, recent commits, and voice-history commits;
- the React application, route guards, authentication and tenant bootstrap, Supabase REST layer, mock/fallback boundaries, and super-admin surfaces;
- all 16 Supabase migrations and generated database types;
- the Vapi, OpenAI Realtime SIP, ConversationRelay, LiveKit, telephony, call-store, notification, email, billing, reporting, web-chat, and integration code paths;
- 89 test files, the TypeScript build graph, lint configuration, and all production build targets;
- the six current demo accounts; and
- read-only deployed checks against `signalhost.ai` and the Render voice service health/readiness endpoints.

Observed verification baseline before this blueprint:

- six of six demo accounts authenticate successfully;
- dashboard, voice-service, and LiveKit-agent production builds succeed;
- TypeScript succeeds;
- 550 of 551 tests pass; the one failure is a stale assertion expecting the former OpenAI VAD threshold of `0.93` while runtime and voice history intentionally lock `0.98`;
- lint has two errors because it scans the generated `dist-voice/server.mjs`; source lint produces warnings but no source errors;
- the browser bundle is approximately 1.38 MB uncompressed / 371 KB gzip and Vite warns that it needs code splitting;
- no repository CI workflow or checked-in Render/Vercel infrastructure definition exists;
- the only pre-existing dirty worktree content is untracked `tmp/`, which is unrelated and must remain untouched.

The deployed voice service reported Vapi, OpenAI Realtime SIP, LiveKit, Twilio provisioning, Twilio signature enforcement, call recording, OpenAI, and Supabase as configured. It reported staff alert delivery, guest/shared SMS, Stripe, email, address validation, ordering, and reservation integrations as not configured. Its `productionReady: true` value is therefore only the legacy OpenAI/Twilio readiness definition, not commercial product readiness and not Vapi-default readiness.

## Commercial operating model

The required ownership hierarchy is:

```text
SignalHost platform
  Channel partner
    Customer organization
      Location / dealership rooftop
        Department
          Numbers and routes
          Queues and transfer targets
          AI agents and policies
          Workflows and SLA policies
          Knowledge scopes
          Integrations
          Reporting scopes
```

The telecom or channel partner can retain ownership of phone numbers, trunks, PBX relationships, carrier billing, and the customer relationship. SignalHost owns the intelligence plane: configuration, conversation behavior, workflow execution, resolution accountability, administration, reporting, and customer experience.

Direct SignalHost customers use the same model through a SignalHost-owned default partner. This avoids separate direct-sales and partner product forks.

## Resolution ladder

Every interaction must produce a durable outcome through one of four ordered levels:

1. **Answer** — provide a verified answer from scoped knowledge or a connected system.
2. **Act** — complete an authorized transaction or workflow and record the result.
3. **Connect** — route or transfer to the correct person, queue, or external endpoint with context.
4. **Own** — create a resolution case with an accountable assignee, acknowledgement deadline, resolution SLA, reminders, escalation, customer updates, and explicit closure.

The current product supports portions of levels 1, 2, and 4, but level 4 is currently a request/task capture mechanism, not a resolution system. “We’ll have someone call you” is not complete until the system can prove assignment, acknowledgement, updates, and resolution.

## Existing and usable

### Platform and tenant foundation

- Supabase authentication, profiles, organization membership, platform-admin access, invitation scaffolding, and row-level security are implemented.
- Tenant bootstrap creates an organization, first location, owner membership, onboarding profile, default agent configuration, and trusted contact for a signed-in user.
- The dashboard has admin/super-admin route separation, reusable location-scoped queries, request timeouts, token-refresh handling, error boundaries, and recent polling/reliability hardening.
- Organization-to-location isolation is implemented in database policy and application requests for the present two-level tenant model.
- Super-admin surfaces exist for tenants, telephony, usage, billing, reporting, security, operations, and system controls, although some surfaces are ahead of the underlying commercial model.

### Voice and conversation runtime

- Vapi assistant and phone-number provisioning/reconciliation scripts exist and the six current vertical demos use fixed Vapi assistants/numbers.
- The Vapi webhook bridge authenticates signed/secret webhook requests when a secret is configured, loads SignalHost context, starts call records, persists transcript and terminal artifacts, and executes a useful subset of SignalHost actions.
- Direct OpenAI Realtime SIP is a large, mature, heavily tested fallback implementation with interruption control, background-speech protection, prompt-leak filtering, tool execution, recording, summaries, metrics, and failure recovery.
- Twilio number search, purchase, release, lifecycle tracking, SIP-trunk assignment, webhook fallback, signature validation, and recording callbacks exist.
- Call records, transcript turns, recordings, intent/outcome, summary, confidence, review state, and interaction insight are represented and used by dashboard surfaces.
- Generic safety context prevents one demo business’s knowledge from leaking into another location when live context loading fails.
- Web chat uses the same broad business context and can answer, return links, and create customer requests.

### Configuration, knowledge, and operations

- Location-level agent configuration, greetings, persona/voice selection, hours, FAQs, knowledge sections, menu/service content, policies, business links, alert routing, and onboarding profiles exist.
- Knowledge suggestions, temporary business updates, owner commands, daily briefs/reports, trusted contacts, and alert-event audit records exist.
- Customer requests and staff tasks can be created from voice and dashboard workflows.
- Shared message-thread and message-event tables support reply correlation and owner/customer SMS routing logic.
- Customer follow-up email can be owner-approved, delivered, audited, and used to resolve a request/task when email is configured.
- Billing account, subscription state, plan catalog, checkout, customer portal, and Stripe webhook code exist.
- Scenario Lab and other side-effect-free test tools provide useful conversation QA without placing calls or creating live operational side effects.

### Demonstration assets

- Six vertical demo identities and logins work: restaurant, HVAC, plumbing, roofing, electrical, and salon/barbershop.
- The deployed dashboard and voice service are reachable.
- Marketing call examples, transcript demonstrations, voice previews, and guided setup flows provide a credible product narrative when clearly identified as demonstrations.

## Existing but incomplete

### Tenant and access model

- The persistent hierarchy ends at organization → location. Channel partners, departments, queues, employees/agents, workflow assignments, knowledge scopes, and report scopes are absent.
- The dashboard location selector displays more than one location conceptually, but the authenticated active location is chosen as the first location of the first membership. Production location switching is not implemented.
- Database roles are richer than the application role gate, but the UI effectively collapses owner/admin/manager/staff into a broad admin experience.
- Platform administration is not yet delegated to partners and lacks partner-scoped support impersonation/audit controls.

### Vapi production path

- Vapi is operational but still named and guarded as a “pilot” in code, environment variables, health checks, and runbooks.
- Fixed Vapi assistants are given the shared OpenAI tool declaration, but the Vapi executor implements only context lookup, customer-request capture, manual reservation capture, callback task creation, and call completion. It does not implement advertised guest confirmation, business-link delivery, or address normalization actions.
- The direct OpenAI path has a broader action runtime than Vapi, creating provider-dependent customer outcomes and lock-in risk.
- Vapi has no implemented live-transfer action and current prompts explicitly avoid transfer/hold behavior.
- Vapi call session state is in process memory. Restarts and multiple instances can lose or split session state.
- Transcript events and end-of-call artifacts can both append the same turns, and terminal webhook ordering/idempotency is not covered by focused tests.
- Provider identity is stored inconsistently in call payload JSON rather than through a canonical provider/session model.

### Resolution and workflow ownership

- `customer_requests` and `staff_tasks` capture unresolved work, but there is no SLA policy, assignment identity, acknowledgement state, reminder schedule, escalation path, customer-update cadence, or immutable lifecycle history.
- `assigned_to` is free text rather than a department/user/queue assignment.
- Resolution can be manually marked or inferred from a follow-up send, but proof of actual customer resolution is weak.
- Requests are not grouped into a provider-neutral case object shared by calls, SMS, email, web chat, transfers, and integrations.

### Telephony, messaging, billing, and integrations

- Twilio provisioning assumes SignalHost-managed Twilio credentials and one location-oriented number flow. It does not model partner-owned carriers, trunks, PBXs, number inventories, routing policies, or delegated provisioning.
- Vapi provisioning is script/admin-endpoint driven rather than part of a provider-neutral number-routing control plane.
- Shared SMS routing code exists, but the deployed environment reports no guest confirmation/shared SMS configuration; A2P registration and per-tenant sender policy are not represented as commercial readiness gates.
- Email code exists, but deployed outbound/inbound email is not configured.
- Stripe code/schema exists, but deployed billing is not configured and the model is direct-customer oriented rather than partner wholesale/resale aware.
- The dashboard integrations page uses mock data and simulated connection dialogs. Server-side integration readiness mostly reports environment credentials rather than managed tenant connections.
- An OpenTable adapter exists, but production credentials are absent and the broader reservation/ordering registry is largely readiness scaffolding.
- No dealer CRM, DMS, scheduler, inventory, financing, trade-in, or repair-order adapter exists.

### Reporting and operations

- Location analytics and owner reports exist, but there is no department roll-up, partner roll-up, queue/employee performance, workflow conversion, SLA attainment, or reseller report schedule.
- Prometheus-style process metrics exist, but no checked-in alert rules, central telemetry, incident runbook integration, or error-tracking pipeline is evident.
- Health/readiness checks describe OpenAI SIP as primary, require legacy ConversationRelay websocket configuration, and classify Vapi as optional. They do not represent the preferred runtime or commercial dependencies.

## Demo, mock, or fallback only

- The Integrations dashboard is mock-only; its connect flow does not establish a live OAuth/API connection.
- Several dashboard pages intentionally use sample data when Supabase is absent or a query fails. This is appropriate for demo resilience but must never look like live customer data in commercial tenants.
- Marketing call cards mix real audio assets with transcript/sample demonstrations.
- Scenario Lab is explicitly side-effect-free and must not be used as evidence that a live provider action succeeded.
- Restaurant deterministic replies, generic safety context, and local fallback stores are failure-safety behavior, not a substitute for a configured tenant.
- ConversationRelay is a legacy voice fallback/test route.
- Demo accounts, seeded IDs, demo passwords, fixed demo assistant reconciliation, and `SUPABASE_DEMO_LOCATION_ID` are demonstration/bootstrap mechanisms, not a scalable tenant-routing design.
- Local in-memory rate limits and Vapi session state are single-instance fallbacks, not horizontally safe production state.
- Advanced voice preview and some ElevenLabs assets are preview/marketing capabilities, not the default production call runtime.

## Obsolete or quarantined

The code can remain until replacements are proven, but the following must not drive new product design:

- Documentation that says direct OpenAI Realtime SIP is the primary production runtime is obsolete. The implementation is maintained fallback.
- Documentation that calls Vapi an optional/quarantined pilot is obsolete. Vapi is the preferred default; its remaining “pilot” names are migration debt.
- The earlier Vapi dynamic-assistant recommendation is obsolete for the current demos. Fixed assistant assignment is the known working mode after dynamic request failures; dynamic mode remains a capability to retest deliberately.
- LiveKit/Harbor A/B routing, SIP handoff, and agent code are quarantined experiments. They must remain disabled by default unless a named test plan reopens them.
- Twilio ConversationRelay plus Google/ElevenLabs TTS is a legacy fallback, not a target architecture.
- ElevenLabs production-voice experiments are quarantined to previews or the legacy fallback path.
- OpenAI Agents SDK realtime location experiments are not the preferred production path.
- Runbooks that instruct operators to point the production number at `/twilio/voice` without distinguishing Vapi, direct SIP, LiveKit, and ConversationRelay are unsafe and obsolete.
- Restaurant-only product language in core type names and service descriptions is historical implementation debt, not the target domain model.
- The old MVP instruction to lightly disclose AI by default conflicts with the current approved greeting/brand posture and should not be used for configuration defaults.
- README milestones that describe already-built authentication/RLS/tenant bootstrap as future work are obsolete.

Historical voice-quality ledger entries should remain intact. Their header and current-baseline section must distinguish historical experiments from current policy rather than rewriting results.

## Missing for direct commercial sales

### Commercial readiness blockers

- A canonical commercial-readiness definition that gates launch on the selected voice runtime, authenticated webhooks, persistence, notification delivery, support access, retention settings, and a tested fallback.
- Live, tenant-manageable SMS and email delivery with sender verification/A2P status, consent/opt-out handling, delivery receipts, retry policy, and failure queues.
- A resolution case engine with accountable assignment, acknowledgement, SLA clocks, reminders, escalation, customer updates, reopen, and final-resolution evidence.
- Production Vapi action parity, idempotent webhook/event handling, durable session state, and failure replay.
- Real location switching, scoped roles, user management, department ownership, and audit history.
- Self-service provisioning that connects number/runtime/assistant/knowledge/workflow state and can safely roll back.
- Subscription activation, invoicing state, entitlement enforcement, trial lifecycle, cancellation, taxes, refunds/credits policy, and internal reconciliation with live Stripe configuration.
- Support tooling for tenant diagnostics, safe impersonation, configuration history, data export, retention/deletion, and incident audit.
- Security/compliance baseline: secrets inventory/rotation, dependency and code scanning, backup/restore drills, privacy/recording consent settings, retention controls, DPA/subprocessor documentation, and a formal incident response process.
- CI for test/typecheck/lint/build/migration checks and reproducible deployment configuration.
- Error tracking, job/queue health, provider latency/error dashboards, synthetic call checks, and alert ownership.
- Clear product-state labels so mocks/fallbacks cannot be mistaken for live integrations or real operational results.

### Sellable capability gaps

- Live transfer and transfer-failure recovery.
- Business-hours, after-hours, overflow, failure, and department routing policies.
- Integration credential management, OAuth lifecycle, connection health, field mapping, retries, dead-letter handling, and audit.
- Generic appointment/action primitives beyond restaurant reservations.
- Department-specific knowledge, routing, workflows, analytics, and manager notifications.
- Versioned prompt/policy/workflow publishing with preview, approval, rollback, and change audit.
- Usage metering and gross-margin reporting by tenant, runtime, call minute, message, action, and integration.

## Missing for white-label telecom distribution

- `channel_partners` tenancy and partner membership/RBAC.
- Partner ownership or assignment of customer organizations, locations, departments, numbers, routes, plans, and support access.
- Partner branding profiles: product name, logos, colors, domains, legal/support links, email sender domains, SMS identity, voice/greeting defaults, and report templates.
- Partner portal and delegated customer administration with granular permissions and immutable support/impersonation audit.
- BYOC/BYON telephony inventory: carrier, account/subaccount, number, SIP trunk, PBX, DID, route, failover destination, CNAM/E911/A2P state, and ownership/billing party.
- Provider-neutral inbound routing contracts for Vapi BYOC/imported numbers, partner SIP/PBX forwarding, and future managed providers.
- Secure partner credential isolation and rotation; credentials cannot be global environment variables for a multi-partner product.
- Partner-facing provisioning APIs/webhooks, idempotency keys, status callbacks, inventory reconciliation, rate limits, and API audit.
- Wholesale and resale billing constructs: partner plan catalog, included usage, overage, markup, minimums/commitments, usage export, invoice reconciliation, and direct-bill versus partner-bill ownership.
- Partner-scoped reporting and exports across all customers without violating customer isolation.
- Branded onboarding, invite, login, dashboard, notification, report, and support experiences.
- Partner default policies with customer/location overrides and a deterministic inheritance model.
- Offboarding/port-out/export procedures that preserve the partner’s number and customer ownership.
- Contractual/operational boundaries for carrier support versus SignalHost intelligence/workflow support.

## Missing for the dealership reference implementation

Automotive must be implemented as a high-complexity configuration and adapter package on generic platform entities, not as hard-coded platform architecture.

### Domain and hierarchy

- Automotive business type and vocabulary in onboarding, runtime profiles, analytics, and UI.
- Dealer group organization with multiple rooftop locations.
- Sales, service, parts, finance, body shop, and general-reception departments.
- Department hours, queues, numbers, staff/employee directory, transfer targets, escalation managers, knowledge, and reports.

### Sales workflows

- Inventory lookup by year/make/model/trim/stock/VIN with explicit freshness and source attribution.
- Availability response that never guarantees a vehicle without a connected source.
- Test-drive request/scheduling, confirmation, reminder, assignment, and outcome.
- Trade-in link delivery and lead/request correlation.
- Financing/application link delivery with approved disclosures and no sensitive financial-data collection by voice.
- Salesperson/BDC routing and accountable callback when live connection fails.

### Service workflows

- Service scheduling adapter with vehicle, VIN, mileage, concern, preferred time, transportation/loaner needs, and recall/safety escalation.
- Service-status lookup with identity verification and a safe boundary around sensitive customer/vehicle details.
- Repair-order number capture and normalization.
- Advisor routing, after-hours intake, tow/emergency guidance policy, callback ownership, and customer update cadence.

### Parts workflows

- Vehicle/VIN/part description capture, fitment disclaimers, availability/price lookup when connected, and parts-counter routing.
- Special-order request, deposit boundary, pickup notification, and unresolved-request ownership.

### Integrations and reporting

- Adapter contracts and initial connectors for dealer CRM, DMS, scheduler/service lane, inventory/website feed, trade-in, and financing providers.
- Canonical vehicle, person, appointment, repair order, part request, opportunity/request, and external-record link models.
- Department conversion, missed-transfer, callback SLA, appointment, inventory-interest, service-status, and unresolved-case reporting.
- Dealer-group roll-up with rooftop and department drill-down.

## Technical debt and reliability risks

| Risk | Current evidence | Commercial consequence | Required treatment |
|---|---|---|---|
| Voice-provider policy is implicit | Separate Vapi, OpenAI SIP, ConversationRelay, and LiveKit routes/configuration; stale readiness labels | Operators can provision or monitor the wrong runtime | Canonical provider catalog, per-route policy, capability checks, and explicit fallback |
| Vapi action drift | Fixed assistant advertises tools missing from its executor | The agent may promise actions that return unsupported errors | Shared action runtime and provider conformance tests |
| Non-idempotent Vapi lifecycle | In-memory sessions; transcript plus artifact append; no lifecycle tests | Duplicate turns, incorrect terminal state, lost state on restart | Durable provider sessions/events, idempotency keys, ordered reducers, replay tests |
| Incomplete hierarchy | Schema stops at organization/location | No partner, department, queue, or delegated reporting isolation | Add hierarchy with additive migrations and RLS tests |
| Weak request accountability | Free-text assignee and no SLA/event timeline | Captured callbacks can be forgotten | Resolution case state machine, assignment entities, scheduler, escalation, customer updates |
| Migration provenance ambiguity | 16 migrations include repeated/consolidated changes and runtime legacy fallbacks | New installs and upgrades can diverge | Migration ledger, clean-room migration test, generated-type check, retire compatibility fallbacks only after proof |
| Schema/type drift | Database `call_intent` enum is narrower than some frontend/domain values | Failed writes or silent coercion | Canonical interaction taxonomy and migration/type generation checks |
| Single demo-location dependency | Several backend configured checks require `SUPABASE_DEMO_LOCATION_ID` | Tenant routing can depend on a global demo setting | Route by number/provider session and require explicit tenant context |
| Large coupled modules | Supabase REST client ~3,800 lines; OpenAI SIP ~5,500 lines; server ~2,400 lines | High regression radius and hard provider reuse | Extract boundaries incrementally behind characterization tests |
| Mock/live blending | Several pages fall back to sample data; Integrations is mock-only | Commercial users can misread demo state as operational state | Explicit environment/data-source badges and no silent mock fallback for paid tenants |
| Missing CI/IaC | No `.github` workflows and no checked-in Render definition | Manual verification/deploy drift | Required PR checks and reproducible deployment manifests |
| Generated output is linted | `dist-voice` is not ignored; lint fails on bundle comments | A standard quality gate is red | Ignore all generated build directories and lint source |
| Stale test contract | VAD runtime changed to `0.98`; test still expects `0.93` | Baseline suite is red and hides new regressions | Align assertion with intentional locked runtime |
| No real integration control plane | UI is mock and credentials are global environment variables | Cannot safely onboard many tenants/partners | Tenant-scoped encrypted connections, OAuth lifecycle, health and delivery logs |
| In-process fallbacks | Vapi sessions and default rate limits are local memory | Multi-instance correctness and abuse controls degrade | Durable store/queue and distributed rate limit as commercial requirements |
| Bundle and dependency freshness | Large frontend chunk; stale browsers database warning | Slow load and maintenance/security exposure | Route-level splitting and scheduled dependency maintenance |
| Documentation contradicts production | Canonical and historical docs name different primary runtimes and webhooks | Future agents/operators can regress routing | Update canonical memory; label historical runbooks obsolete/quarantined |

## Recommended target architecture

### 1. Control plane

The dashboard and administrative APIs manage hierarchy, users, branding, number routes, provider policies, agent profiles, knowledge scopes, workflow versions, integration connections, SLAs, billing/usage policy, and reporting permissions.

Configuration follows a deterministic inheritance chain:

```text
platform default
  -> partner default/brand
    -> organization policy
      -> location policy
        -> department policy
          -> number/queue/agent override
```

Every published configuration is versioned, auditable, previewable, and rollback-capable. Runtime sessions bind to a published snapshot so a mid-call edit cannot change behavior unpredictably.

### 2. Canonical commercial data model

Additive core entities:

- `channel_partners`, `partner_memberships`, `partner_brand_profiles`;
- `organization_partner_assignments` or a partner foreign key with migration-safe ownership history;
- `departments`, `department_memberships`, `queues`, `queue_members`, `transfer_targets`;
- `telephony_accounts`, `sip_trunks`, `phone_numbers`, `number_routes`, `routing_policies`;
- `agent_profiles`, `agent_assignments`, `knowledge_scopes`, `workflow_definitions`, `workflow_versions`;
- `provider_connections`, `provider_runtime_policies`, `provider_sessions`, `provider_events`;
- `interactions` and `interaction_participants` across voice/SMS/email/chat;
- `resolution_cases`, `case_assignments`, `case_events`, `sla_policies`, `reminder_jobs`, `escalation_policies`, `customer_updates`;
- `integration_connections`, `external_record_links`, `action_attempts`, `outbox_events`, `delivery_attempts`;
- `usage_events`, `partner_rate_cards`, `customer_entitlements`, and billing reconciliation records;
- `audit_events` for configuration, support, identity, provider, workflow, and data-access changes.

Existing tables should be migrated and adapted incrementally. Do not replace working call, request, task, knowledge, billing, or message tables in one rewrite.

### 3. Provider-neutral interaction runtime

Define a `VoiceRuntimeAdapter` contract around provider-specific media/orchestration only:

```text
provision or attach route
build/publish provider assistant configuration
authenticate and normalize provider events
start/recover/end provider session
emit normalized transcript and lifecycle events
invoke canonical SignalHost actions
attempt transfer when capability/policy permits
report provider health and capabilities
```

Vapi is the default adapter. Direct OpenAI Realtime SIP is the maintained fallback adapter. ConversationRelay and LiveKit remain non-default adapters with explicit lifecycle labels.

Provider adapters must not own business actions. A shared, channel-neutral `ActionRuntime` executes knowledge lookup, link/SMS/email delivery, appointment/request creation, customer identity/vehicle capture, transfer requests, integration actions, and resolution-case creation. Every action has an idempotency key, authorization policy, audit record, structured result, retry classification, and customer-safe failure response.

This boundary prevents Vapi lock-in while preserving Vapi’s superior production conversation quality.

### 4. Durable event and resolution plane

Provider events are authenticated, stored idempotently, normalized, and reduced into interaction/session state. Side effects use an outbox/worker model rather than relying on a live webhook request or process memory.

The resolution state machine should minimally support:

```text
new -> assigned -> acknowledged -> in_progress -> waiting_customer
    -> waiting_external -> resolved -> confirmed_closed
                          \-> breached -> escalated
resolved/closed -> reopened
```

An interaction can resolve at answer/action/connection time. Otherwise it must create or attach to a resolution case before the interaction ends. SLA clocks and customer update rules are policy-driven at platform/partner/org/location/department/workflow scope.

### 5. Telephony ownership boundary

Model numbers and routes independently of ownership:

- SignalHost-managed Vapi/Twilio for direct customers;
- Vapi BYOC/imported carrier trunks for partners where supported;
- partner PBX/DID forwarding or SIP routing into a SignalHost runtime;
- partner-controlled failover back to a queue, voicemail, or another carrier endpoint.

The route record identifies owner, billing party, carrier/provider IDs, inbound runtime, department/queue, recording/consent policy, messaging capability, failover, and operational state. Porting and carrier billing stay outside SignalHost unless explicitly contracted.

### 6. Integration adapter plane

Use canonical request/action records and adapter contracts. Credentials are tenant/partner scoped, encrypted, rotated, and never modeled only as global environment variables. Each adapter exposes capabilities, connection health, field mappings, rate limits, retries, idempotency, webhook reconciliation, and external record links.

Automotive adapters map dealer-specific data into generic platform capabilities such as inventory lookup, appointment scheduling, case/status lookup, contact/opportunity sync, and document/link delivery.

### 7. Reporting and white-label experience

Use a common semantic layer with scope dimensions for partner, organization, location, department, queue, agent, workflow, runtime provider, interaction channel, resolution level, SLA, and integration outcome. Branding is applied at delivery time to portals, login/invites, dashboards, notifications, reports, and support content without forking product code.

## Phased implementation plan

### Phase 0 — Source-of-truth and provider-boundary foundation

Dependencies: none.

Work:

- Establish Vapi as the canonical preferred runtime in code and current memory.
- Add a provider catalog with canonical IDs, aliases, lifecycle state, configuration/enablement, and honest capability status.
- Expose the catalog in health/readiness payloads without changing live routing.
- Correct stale quality-gate configuration and preserve historical voice locks.
- Label conflicting runbooks and experimental paths so they cannot silently become defaults.

Acceptance criteria:

- Health output identifies Vapi as preferred and labels fallback/quarantined providers.
- Legacy provider labels normalize without changing stored historical values.
- No number, assistant, webhook, or live call route is changed by the slice.
- Provider catalog behavior is unit tested.
- Test, typecheck, lint, and all production builds pass, aside from explicitly documented source warnings.
- `tmp/` and unrelated files are untouched.

### Phase 1 — Commercial hierarchy and authorization

Dependencies: Phase 0 provider vocabulary and an approved migration/backfill plan.

Work:

- Add channel partner, department, queue, transfer target, and scoped membership entities through additive migrations.
- Introduce a direct-sales default SignalHost partner.
- Implement reliable organization/location/department switching and policy inheritance.
- Add partner/customer role matrices and immutable support access audit.
- Backfill current organizations/locations with no user-visible change.

Acceptance criteria:

- Existing six demos and current users retain access after migration.
- RLS tests prove cross-partner, cross-organization, cross-location, and cross-department isolation.
- A partner admin can manage assigned customers but not platform/global or other-partner records.
- A customer admin can switch authorized locations/departments and never see unauthorized data.
- Direct customers operate through the same hierarchy with SignalHost as partner.

### Phase 2 — Resolution ownership engine

Dependencies: Phase 1 identities/departments/queues.

Work:

- Add resolution cases, structured assignments, event history, SLA/reminder/escalation policies, and customer updates.
- Adapt existing customer requests and staff tasks into the case flow without deleting them.
- Add scheduler/worker/outbox support and notification delivery receipts.
- Make unresolved interaction completion require a case or explicit disposition.

Acceptance criteria:

- Every curated unresolved scenario has an owner, acknowledgement target, resolution target, escalation, customer-update rule, and auditable closure.
- A missed acknowledgement/resolution deadline produces the correct reminder/escalation exactly once.
- Customer updates and staff deliveries have retriable delivery state and failure visibility.
- Managers can report open, breached, escalated, resolved, reopened, and confirmed-closed cases by scope.

### Phase 3 — Vapi production hardening and action parity

Dependencies: Phase 0 provider contract; Phase 2 canonical case/action records for unresolved work.

Work:

- Extract the shared ActionRuntime from provider-specific implementations.
- Make Vapi tools capability-derived so assistants cannot advertise unsupported actions.
- Add SMS/link/address/request/appointment parity, provider-neutral action audit, and safe retries.
- Persist provider sessions/events; enforce idempotency and terminal event ordering.
- Add live-transfer abstraction with Vapi implementation and accountable transfer-failure fallback.
- Add direct OpenAI fallback conformance tests for the same action contract.

Acceptance criteria:

- Vapi and direct OpenAI pass the same required action-conformance suite.
- Duplicate/out-of-order Vapi events produce one transcript/lifecycle result and no duplicate side effects.
- Restart/multi-instance tests recover session state.
- Tool declarations exactly match enabled capabilities for the tenant/provider.
- Failed transfer creates/updates a resolution case with caller confirmation and no lost request.
- Voice quality baseline is revalidated with real calls before any routing change.

### Phase 4 — Direct commercial launch foundation

Dependencies: Phases 1–3.

Work:

- Configure and verify outbound/inbound email, A2P-compliant SMS, delivery status/retries, and production Stripe.
- Add entitlements, usage metering, support tooling, retention/consent settings, audit exports, and commercial readiness checks.
- Add CI, clean-room migration tests, generated-type drift checks, dependency/security scanning, infrastructure manifests, centralized error tracking, and synthetic call/action monitors.
- Remove silent sample fallback from paid tenants and clearly badge demo data.

Acceptance criteria:

- A new direct tenant can sign up, pay, provision/attach a number, publish knowledge/workflows, pass a test call, and go live without database/manual-script intervention.
- Billing, messaging, email, support, retention, recording consent, and selected voice runtime all pass a launch gate.
- A failed action/delivery/provider dependency is visible, retried appropriately, and assigned when manual intervention is needed.
- Backup/restore and incident drills meet documented recovery targets.

### Phase 5 — Dealership reference implementation

Dependencies: hierarchy, resolution engine, provider action parity, and generic integration adapter contracts.

Work:

- Add automotive onboarding/profile, departments, vocabulary, workflow templates, knowledge scopes, and analytics.
- Implement inventory/test-drive, trade-in/finance-link, service scheduling/status, VIN/vehicle/RO capture, parts, directory routing, transfer, and callback workflows.
- Build the first real CRM/DMS/scheduler/inventory adapters selected with a pilot dealer.
- Add a dealership scenario/conformance suite and seeded non-production demo group/rooftops.

Acceptance criteria:

- Sales, service, parts, and reception each pass happy-path, unavailable-system, after-hours, transfer-failure, privacy, and unresolved-case scenarios.
- No inventory, appointment, service status, price, or parts availability is claimed without a connected authoritative source or explicit staff-confirmation status.
- Dealer group reporting rolls up rooftops and drills down to department/workflow/SLA.
- All automotive capabilities use generic platform contracts; another vertical can reuse departments, queues, cases, transfers, and adapter primitives.

### Phase 6 — White-label partner distribution

Dependencies: commercial direct-sales controls and stable dealership/general reference workflows.

Work:

- Deliver partner branding, domains, delegated portal, customer provisioning, policy inheritance, usage/rate cards, APIs/webhooks, and support boundaries.
- Implement BYOC/PBX/SIP inventory and routing patterns with at least one design partner.
- Add partner/customer billing ownership and wholesale reconciliation.

Acceptance criteria:

- A partner can onboard a customer while retaining number/trunk/PBX/billing ownership.
- Branding is partner-correct across auth, portal, notifications, reports, and support with no SignalHost leakage except contractually required notices.
- Partner API provisioning is idempotent, auditable, reconciled, and scoped.
- Partner users can report across only their customers; customer users remain isolated to assigned scopes.
- Offboarding preserves/export partner-owned numbers, configuration, and customer records according to policy.

### Phase 7 — Pilot certification and scale

Dependencies: selected direct or partner pilot scope complete.

Work:

- Run security/privacy review, load/soak tests, disaster recovery, carrier/provider failover, operational training, support escalation, and measured live-call QA.
- Freeze a pilot configuration and define go/no-go metrics by voice quality, containment, action success, transfer success, case SLA, delivery reliability, and customer satisfaction.

Acceptance criteria:

- No critical scenario loses an interaction or unresolved request.
- Provider, integration, worker, or notification failures fail visibly and recover according to runbook.
- Pilot metrics and thresholds are agreed with the customer/partner and observable before launch.
- Rollback and ownership contacts are verified in a live rehearsal.

## First approved foundation slice

Phase 0 is approved by this product direction because it changes no live routing and reduces the risk of future work targeting obsolete voice experiments. The first slice is deliberately limited to:

1. a canonical voice-runtime provider catalog and normalization boundary;
2. Vapi marked as preferred, OpenAI SIP as maintained fallback, ConversationRelay as legacy fallback, and LiveKit as quarantined;
3. catalog visibility in health/readiness output;
4. unit tests for provider identity, configuration, and legacy aliases;
5. correction of the stale VAD test assertion and generated-build lint scope; and
6. current project-memory updates that preserve the historical ledger.

It does **not** change a Vapi assistant, phone number, webhook, model, voice, tool list, prompt, transfer rule, or production call route. Schema/hierarchy migrations begin only after Phase 0 is verified and the additive migration/backfill contract is written.

### Phase 0 slice verification — 2026-08-05

- Added `services/voice/src/voice-runtime-provider.ts` and provider-boundary unit tests.
- Added the observational catalog to `/health` and `/ready` without changing the legacy readiness status code or any routing behavior.
- Updated current memory and operator docs to distinguish preferred, maintained-fallback, legacy-fallback, and quarantined paths while preserving historical ledger entries.
- Corrected the stale direct-SIP VAD assertion to the intentionally locked `0.98` value.
- Excluded generated build directories from source lint.
- Verification: 90 test files / 554 tests passed; TypeScript passed; lint passed with zero errors and eight pre-existing warnings; dashboard, voice-service, and LiveKit-agent builds passed.
- The existing frontend chunk-size and stale Browserslist warnings remain documented technical debt; they were not expanded into this slice.

### Phase 1 foundation slice status — partner and department identities

The first Phase 1 slice is implemented in the repository and was applied to production on 2026-08-06, while deliberately stopping before UI/runtime dependency:

- Added the explicit compatibility and role contract in `docs/COMMERCIAL_HIERARCHY_FOUNDATION.md`.
- Added an additive migration for `channel_partners`, `partner_memberships`, `departments`, and `department_memberships`.
- Seeded a deterministic `SignalHost Direct` parent and defaulted every existing/new organization to it.
- Backfilled every existing location with a default `General Reception` department and added a trigger for new locations.
- Kept default departments on inherited location access; protected the partner assignment and default-department compatibility contract from non-platform reassignment.
- Extended the existing organization helper functions so partner `owner`/`admin`/`operator`/`viewer` capabilities flow through current RLS policies without rewriting downstream tables.
- Updated checked-in Supabase types and clean-install schema/RLS snapshots.
- Added pure role-matrix tests and migration contract tests. Verification: 92 test files / 563 tests, TypeScript, lint with zero errors and eight pre-existing warnings, and all production builds pass. PostgreSQL parsing succeeds for the migration and both SQL snapshots.

That checkpoint was not the completion of Phase 1: production-backed scope switching, support-access audit, executable database isolation tests, partner administration, number routes, and downstream department scoping remain open. Production application is now verified, but current app and voice code still do not depend on the new objects.

### Phase 1 foundation slice status — dormant queues and transfer identities

The second Phase 1 slice is implemented in the repository as a data/authorization boundary only:

- Documented the current handoff truth and compatibility contract in `docs/COMMERCIAL_ROUTING_FOUNDATION.md`.
- Added human `staff_directory_entries` without conflating trusted contacts, Auth users, or location-level AI `agent_configs`.
- Added department-owned `queues` and `queue_members`, with one callback-only Primary Queue backfilled/created per department.
- Added provider-neutral `transfer_targets` for queue, staff, PSTN, SIP URI, PBX extension, voicemail, and callback destinations.
- Enforced location/department ownership with triggers and helper-based RLS.
- Required service-recorded verification before target activation and re-verification after routing-relevant changes.
- Updated checked-in Supabase types and clean-install schema/RLS snapshots.
- Added routing vocabulary and migration contract tests. Verification: 94 test files / 574 tests, TypeScript, lint with zero errors and eight pre-existing warnings, and all production builds pass. PostgreSQL parsing succeeds for both migrations and both SQL snapshots.

This slice does not implement live transfer, number routing, queue presence/ring strategy, structured task assignment, department-scoped AI agents/workflows/knowledge/reporting, or UI. Current handoff remains callback/task/alert, and all voice runtimes continue to report live transfer unavailable.

### Phase 1 production application checkpoint — 2026-08-06

- Applied `20260806010000_commercial_hierarchy_foundation.sql`, then `20260806020000_commercial_routing_foundation.sql`, to the connected production Supabase project through the authenticated Lovable database path.
- Retained the generated applied versions `20260806043652` and `20260806043823` as no-op ledger markers, folded the deployment-added `service_role` grants into the canonical migrations/RLS snapshot, and kept the live-regenerated Supabase types.
- Post-deployment reconciliation verification: 95 test files / 576 tests, TypeScript, lint with zero errors and eight pre-existing warnings, and all three production builds pass.
- Verified that all eight new tables resolve through live PostgREST.
- Verified all six demo users still authenticate and retain their existing location access.
- Verified each checked demo organization has a channel partner and each checked location has exactly one default General Reception department with one active callback-only Primary Queue.
- Confirmed production voice health remained ready with Vapi preferred, provider routing-policy enforcement disabled, and LiveKit quarantined.
- Executable negative isolation coverage across partner, organization, location, and department boundaries remains an explicit Phase 1 acceptance gap; production application alone does not close it.
