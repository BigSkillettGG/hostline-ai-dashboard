# SignalHost Commercial Routing Foundation

Status: Phase 1 slice 2 data and authorization contract; production migration applied and verified 2026-08-06

Evidence baseline: `bc03fe1`

## Purpose

This contract adds durable identities for human staff, operational queues, queue membership, and transfer destinations beneath the department level:

```text
Department
  Staff directory entries
  Queues
    Queue members
  Transfer targets
```

It does not make live transfer available. Current Vapi, direct OpenAI Realtime SIP, ConversationRelay, and LiveKit capability reporting all identify live transfer as unavailable. Current handoff behavior remains accountable callback/task/alert creation.

## Current-system truth preserved

- `agent_configs` is the current location-level AI persona/configuration record. It is not a human employee directory.
- `business_contacts` stores trusted owner/manager/front-desk/billing contacts and owner-assistant permissions. It is not a complete employee directory.
- `alert_routing_configs` stores working notification recipients and rules as JSON. This slice does not rewrite or reinterpret those routes.
- `staff_tasks.assigned_to` remains free text until the resolution-ownership phase introduces structured assignment compatibility.
- `phone_numbers` remains location-scoped. Number-to-department/queue routing is a later provider-routing slice.
- The current Escalations page remains demo/mock UI. New tables do not make it production-backed.

## Entities

### Staff directory entries

`staff_directory_entries` represents a routable human employee or contractor at one location. An entry can optionally link to:

- an Auth user through `user_id`;
- a trusted contact through `business_contact_id`; and
- a primary department through `primary_department_id`.

The record keeps operational display and reachability fields such as name, title, phone, email, and PBX extension. It can participate in more than one queue at the same location; the primary department is an ownership/default scope, not a prohibition on cross-department coverage.

This table is deliberately separate from future AI agent profiles. Department-scoped AI personas and runtime assignments will extend or replace the current singleton `agent_configs` model in a later slice.

### Queues

Every existing and new department receives one `Primary Queue` with:

```text
slug: primary
routing_mode: callback_only
status: active
is_default: true
```

The queue is initially an ownership/work bucket. `callback_only` means SignalHost may capture and assign accountable follow-up, but must not tell a caller that it is transferring or placing them on hold.

Supported routing-mode vocabulary:

- `callback_only`: no live connection; own the request through callback workflow;
- `live_transfer`: live connection only after runtime/provider support is verified;
- `hybrid`: attempt a verified live target, then fall back to accountable callback;
- `external`: routing is controlled by an external PBX/carrier workflow.

No current runtime consumes this field.

### Queue members

`queue_members` links staff directory entries to queues at the same location. Roles are:

- `supervisor`: future queue oversight and escalation ownership;
- `member`: future queue work and transfer/callback participation.

Membership status can be active or inactive without deleting historical identity.

### Transfer targets

`transfer_targets` describes a provider-neutral destination owned by a department. Target kinds are:

- `queue`;
- `staff`;
- `pstn`;
- `sip_uri`;
- `pbx_extension`;
- `voicemail`; and
- `callback`.

Targets start in `draft`. An `active` target requires `verified_at`; authenticated customer/partner users cannot self-verify a target, while a future SignalHost verification service can record verification before a manager activates it. Routing-relevant changes to a verified/active target require it to leave the verified state and be reverified. This is a data-integrity gate, not proof that a voice runtime implements transfer. `supports_live_transfer` defaults to false, and no existing runtime is changed to query this table.

Provider credentials and secrets must never be stored in `destination`, `settings`, or `external_id`. A later credential-vault/provider-adapter layer will own secrets. `provider_key` and `external_id` are non-secret references only.

## Compatibility rules

1. The migration is additive and depends on the partner/department foundation migration.
2. Existing IDs and rows are not changed or deleted.
3. Existing/new departments receive a callback-only default queue; no phone number or live call route points to it.
4. Existing `business_contacts` are not automatically copied into the staff directory, avoiding accidental transfer eligibility or duplicate people.
5. Existing alert routing JSON and trusted-contact fallbacks remain the production notification path.
6. Transfer targets remain dormant until a later runtime adapter explicitly consumes only verified, active, capability-compatible records.
7. Current Vapi fixed assistants, numbers, prompts, tools, webhook behavior, model, and voice remain unchanged.
8. Direct OpenAI SIP, ConversationRelay, and LiveKit routing remain unchanged.

## Scope and authorization

- Staff directory entries are location-owned and may optionally inherit a primary department's visibility.
- A user can read their own linked staff entry.
- A restricted department protects its primary staff directory entries, while authorized queue users can see entries participating in their accessible queues.
- Queue access inherits department access.
- Queue membership management requires department management access.
- Transfer-target access and management inherit department access.
- Cross-location queue membership is rejected by a database trigger.
- A linked Auth user must have continuing platform, partner, organization, or department affiliation with the entry's location; queue membership does not survive removal of that base tenant affiliation.
- Queue/staff transfer targets are rejected when their referenced queue or staff entry is outside the target department's location boundary.
- Default queues cannot be moved, unset, or deleted by customer/partner users.

## Explicit non-goals for this slice

- Enabling live transfer in Vapi or another voice runtime.
- Assigning a number, call, AI agent, workflow, knowledge record, task, request, or report to a department/queue.
- Replacing `alert_routing_configs` or `business_contacts`.
- Backfilling employee directory records from demo data.
- Building queue, directory, transfer, or escalation UI.
- Modeling schedules, presence, skills, ring strategy, overflow, failover, voicemail media, or PBX credentials.
- Claiming an active transfer target is reachable without an external verification operation and runtime support.

## Acceptance criteria

- Migration contains no table/column drop, truncation, or row deletion.
- Every existing/new department receives exactly one default callback-only Primary Queue.
- Staff directory links cannot cross a location boundary.
- Staff directory Auth links cannot grant queue access to an otherwise unrelated tenant user.
- Queue membership cannot cross a location boundary.
- Queue and staff transfer targets cannot cross their department/location boundary.
- Active transfer targets require a verification timestamp.
- New tables have RLS enabled before authenticated browser grants.
- Checked-in schema, RLS snapshots, and Supabase types remain aligned.
- Current demos, tenant bootstrap, alert delivery, and voice paths remain unchanged and green.
