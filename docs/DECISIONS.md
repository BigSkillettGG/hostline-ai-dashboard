# SignalHost Decision Log

This is the durable record of important product and architecture decisions. Add new decisions here instead of relying on chat memory.

## Voice Stack

### Use OpenAI Realtime SIP As Primary Live Voice

Decision:

- Production live calls should use OpenAI Realtime SIP.

Why:

- Lower latency than separate STT/LLM/TTS chains.
- One model can listen, reason, and speak naturally.
- Tool calling can stay inside the live conversation.
- `gpt-realtime-2` sounded more expressive and less robotic in testing.

Implication:

- Tune OpenAI Realtime SIP before adding another voice stack.
- Keep Twilio phone numbers/SIP trunk routing.

### Do Not Use ElevenLabs For Live Calls

Decision:

- ElevenLabs is not the live-call voice path.

Why:

- The product moved to OpenAI Realtime voice.
- Keeping a separate live TTS provider increases latency and complexity.

Implication:

- ElevenLabs references may remain for preview/legacy tests, but do not wire new live-call work to ElevenLabs unless the user explicitly reverses this decision.

### Treat LiveKit As Experimental

Decision:

- LiveKit is not the default production path.

Why:

- The Harbor pilot introduced dead air, no-answer states, routing complexity, and Render worker memory-limit failures.
- It did not clearly beat direct OpenAI Realtime SIP enough to justify default use.

Implication:

- Leave LiveKit docs/code for deliberate experiments only.
- Do not leave Harbor or any other primary demo line on LiveKit accidentally.

### Keep Twilio ConversationRelay As Legacy/Fallback Only

Decision:

- Twilio ConversationRelay is not the target live experience.

Why:

- The user experienced better results from OpenAI Realtime SIP.
- ConversationRelay can diverge in capability and voice quality.

Implication:

- Do not route demo numbers to ConversationRelay unless explicitly testing fallback.

## Product Architecture

### SignalHost Is Multi-Vertical

Decision:

- SignalHost serves multiple local-business verticals, not only restaurants.

Initial verticals:

- Restaurants
- HVAC
- Plumbers
- Roofers
- Electricians
- Hair salons and barbershops

Implication:

- Onboarding, analytics, reports, demo data, call classification, and owner summaries must be vertical-aware.

### Prefer Links And Staff-Review Flows Before Deep Integrations

Decision:

- V1 should support links and staff-review workflows before deep platform integrations.

Why:

- Deep integrations with POS/reservation/field-service platforms are valuable but can slow product validation.
- Many businesses can get value from link sending, intake capture, alerts, and follow-up.

Implication:

- Restaurant order/reservation links, contractor booking/quote links, and salon booking links are legitimate V1 behavior.
- Deep integrations are premium/future unless a pilot demands one.

### Owner Assistant Is Core

Decision:

- SignalHost should not only answer customers. It should report to the owner, accept updates, learn from unknown questions, and help recover revenue.

Implication:

- Owner assistant, temporary knowledge, daily briefs, learning loop, and follow-up queue are product differentiators.

## Messaging

### Use Shared SMS Architecture Initially

Decision:

- Use a centralized/shared texting architecture where feasible rather than requiring every new customer number to wait for separate A2P approval.

Why:

- Per-number SMS approval would slow onboarding.

Open concern:

- Reply routing must handle cases where the same consumer interacts with multiple SignalHost businesses.

### Email Uses Resend For Product Email And Inbound Owner Commands

Decision:

- Use Resend for outbound product email and inbound owner command routing.

Important DNS decision:

- Do not break Google Workspace/Gmail MX for `signalhost.ai`.
- Inbound bot email should use a subdomain such as `agents.signalhost.ai`.

Reference:

- `docs/email-provider.md`

## User Experience

### Greeting Does Not Disclose AI By Default

Decision:

- Default call greeting is short and business-branded.

Greeting:

```text
Thank you for calling {business name}. How can I help you?
```

### Caller Should Not Hear Internal CRM Language

Decision:

- Do not call customers "leads" out loud.

Internal systems can score opportunities; caller-facing language must remain human and natural.

