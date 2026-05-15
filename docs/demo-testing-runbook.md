# SignalHost Demo Testing Runbook

This is the short checklist for testing every vertical with real calls, website chat, email, and future SMS.

## Demo Accounts

All demo owner accounts use this password:

```text
SignalHostDemo!2026
```

| Vertical | Business | Owner login | Location ID | Website demo |
| --- | --- | --- | --- | --- |
| Restaurants | Olive & Ember | demo.restaurant@signalhost.ai | 78d8053b-631d-4811-939f-61f0efe1d82a | /demo-sites/olive-ember |
| HVAC | Summit Air | demo.hvac@signalhost.ai | 11111111-1111-4111-8111-111111111111 | /demo-sites/summit-air |
| Plumbers | Harbor Plumbing | demo.plumbing@signalhost.ai | 22222222-2222-4222-8222-222222222222 | /demo-sites/harbor-plumbing |
| Roofers | RidgeLine Roofing | demo.roofing@signalhost.ai | 33333333-3333-4333-8333-333333333333 | /demo-sites/ridgeline-roofing |
| Electricians | BrightWire Electric | demo.electrical@signalhost.ai | 44444444-4444-4444-8444-444444444444 | /demo-sites/brightwire-electric |
| Hair salons and barbershops | Luna Studio | demo.salon@signalhost.ai | 55555555-5555-4555-8555-555555555555 | /demo-sites/luna-studio |

The demo library in the dashboard is at `/super/demos`.

## First-Time Supabase Seed

The six vertical demo businesses live in:

```text
supabase/migrations/20260515130000_seed_vertical_demo_accounts.sql
```

If the demo logins do not work, ask Lovable to apply that migration. Use this exact prompt:

```text
Please apply the migration file supabase/migrations/20260515130000_seed_vertical_demo_accounts.sql to the Lovable Supabase database. After it runs, verify:

1. public.locations has six rows for Olive & Ember, Summit Air, Harbor Plumbing, RidgeLine Roofing, BrightWire Electric, and Luna Studio.
2. The auth users demo.restaurant@signalhost.ai, demo.hvac@signalhost.ai, demo.plumbing@signalhost.ai, demo.roofing@signalhost.ai, demo.electrical@signalhost.ai, and demo.salon@signalhost.ai can sign in with SignalHostDemo!2026.
3. public.phone_numbers has one demo row per location.
4. public.calls and public.transcript_turns contain the demo seed calls.
```

## Verify Demo Readiness

Run this locally from the repo root:

```bash
npm run check:demos
```

If `npm` is not available in a local shell, this is the same check:

```powershell
node scripts\check-demo-verticals.mjs
```

For deeper live checks, include a platform admin login:

```powershell
$env:SIGNALHOST_ADMIN_EMAIL="tim@hostline.ai"
$env:SIGNALHOST_ADMIN_PASSWORD="your password"
npm run check:demos
```

The script does not print auth tokens. It only reports whether demo logins work, which live locations exist, which numbers are attached, and recent calls with recording URLs.

## Calling Each Vertical

Fake `555` numbers in seed data are useful for UI demos but cannot receive real calls.

To make a vertical callable, provision a real Twilio number for that location. The phone number must be stored in either:

- `public.phone_numbers.phone_number`
- `public.locations.ai_host_phone`

The voice service now reads the dialed Twilio number from OpenAI/Twilio SIP headers, then picks the matching `location_id` before loading knowledge. That means multiple demo numbers can share the same OpenAI SIP trunk.

Current live state: Olive & Ember already has a real Twilio number. The other verticals need real Twilio numbers before phone testing.

## Texting Each Vertical

Inbound and outbound SMS routing is implemented around `message_threads` and `message_events`, but production outbound texting is still gated by Twilio A2P registration.

Until A2P is complete, treat SMS as a placeholder/demo channel. Once Twilio allows texting:

1. Set each Twilio number SMS webhook to `/twilio/sms`.
2. Make sure the number is in `public.phone_numbers`.
3. Customer replies will route to the correct business when the message thread is active.

## Emailing Each Vertical

Agent email addresses are generated as:

```text
{agent-name}-{business-slug}+{location-id}@agents.signalhost.ai
```

Inbound email routes by the location ID in the email address. This works once Resend inbound receiving is active for the `agents.signalhost.ai` subdomain.

## What To Capture During Heavy Testing

When a call feels wrong, capture:

- Business/vertical tested.
- Approximate time of call.
- Caller phone number.
- What you asked.
- What SignalHost said.
- What you expected.
- Whether TV, speakerphone, Bluetooth, car audio, or background noise was present.

Then check `/super/calls` for:

- Transcript.
- Summary.
- Intent/outcome.
- Quality flags.
- Recording link.

If the recording link is missing, run:

```text
https://hostline-voice.onrender.com/twilio/recording-diagnostics?callSid=CA...
```

Use the Twilio Call SID from the call log.
