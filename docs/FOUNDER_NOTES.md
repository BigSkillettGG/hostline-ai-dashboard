# Founder Notes And Product Taste

This file captures user preferences, product instincts, recurring feedback, and past conversation context that should survive chat compaction.

It is not a static spec. Update it whenever the user gives a strong preference, correction, rejection, strategic decision, or memorable testing observation.

If this file conflicts with the user's latest instruction, the latest instruction wins. Otherwise, use this file to preserve continuity.

## Working Relationship

The user wants a proactive coding partner, but regressions are deeply frustrating. When a feature gets better, do not accidentally undo it later.

The user values:

- Clear memory of prior work.
- Honest diagnosis before fixes.
- Narrow changes that do not create hidden regressions.
- Direct explanations in plain English.
- Step-by-step instructions when external setup is needed.
- A high standard: "world-class," "award-winning," and "best in class" are recurring targets.

The user does not want:

- Rebuilding the same thing repeatedly.
- Forgetting prior decisions after context compaction.
- Making fixes when only analysis was requested.
- Guessing from transcripts when audio is available.
- Robotic IVR-style behavior.
- Broad speculative rewrites when a narrow fix is needed.

When the user is angry, do not become defensive. Acknowledge the problem, use the persistent memory, and do the smallest useful thing.

## Product Vision

SignalHost should not be "just an AI receptionist."

It should feel like an AI front desk employee that:

- Answers customers.
- Knows the business.
- Captures useful requests.
- Sends links and confirmations.
- Alerts owners/managers/staff.
- Reports what happened.
- Learns from owner corrections.
- Follows up on open opportunities.
- Helps recover revenue.

The product should work for the owner even when no customers are calling.

The bigger promise:

```text
SignalHost answers customers wherever they reach out, then comes back to the owner with what happened, what needs follow-up, what it did not know, and where the business may be losing money.
```

## Brand And Positioning

Current brand:

- SignalHost
- Domain: `signalhost.ai`

Do not revert to HostLine in user-facing copy unless referring to legacy repo/service names.

SignalHost language is preferred over generic "AI host" language.

The marketing website should be vertical-specific. The homepage is less important than the individual vertical landing pages because marketing traffic will likely go to those pages.

The vertical landing pages should be compelling enough to use as real campaign landing pages.

## Initial Verticals

The first vertical groups are:

1. Restaurants
2. HVAC
3. Plumbers
4. Roofers
5. Electricians
6. Hair salons and barbershops

Use "verticals," "industries," "business types," or "solutions," not "categories" when possible.

Each vertical needs:

- Vertical-specific onboarding.
- Vertical-specific knowledge base fields.
- Vertical-specific call classification.
- Vertical-specific owner reports.
- Vertical-specific analytics.
- Vertical-specific demo data.
- Vertical-specific landing page copy and use cases.

Do not show restaurant-specific analytics like reservations to electricians, plumbers, or HVAC companies.

## Voice Experience Standards

The live voice experience is the most important product proof point.

The user cares intensely about:

- Fast response latency.
- Natural conversation.
- Upbeat, energetic greeting.
- Complete greeting.
- Speakerphone reliability.
- Car Bluetooth reliability.
- Background TV/noise handling.
- The agent not interrupting itself.
- Natural loop-closing: "Can I help with anything else?"
- Clean goodbye and call ending.
- Not sounding like a legacy IVR.

The current desired greeting is:

```text
Thank you for calling {business name}. How can I help you?
```

No default name introduction.

No default "virtual assistant" disclosure.

The voice should sound friendly, energetic, polished, and human enough to feel like a good employee. It should not be funny, sassy, cutesy, or weird.

If a response will take slightly longer, a natural stall phrase is good:

- "Let me check that."
- "Give me one moment."
- "Let me take a quick look."

But do not overuse filler phrases or make the agent sound fake.

The user likes it when the agent briefly explains the next step, as long as it sounds natural.

## Voice Provider And Routing Decisions

The current live-call direction is Vapi. It materially outperformed the custom direct-SIP and LiveKit implementations in handset and speakerphone tests. Direct OpenAI Realtime SIP remains a maintained fallback and must retain its known-good behavior.

Important:

- Do not use ElevenLabs as the default live-call runtime.
- Do not switch back to ConversationRelay as the primary path.
- Do not default to LiveKit.
- Treat LiveKit as an experiment that caused enough instability to quarantine.
- Do not silently reroute known-good Vapi numbers or rebuild their fixed assistants.
- Keep SignalHost business actions provider-neutral so the product is not permanently locked to Vapi.

For the maintained direct fallback, `gpt-realtime-2` sounded better and more expressive to the user than earlier realtime models.

The user wants OpenAI Realtime's intelligence to shine. Do not over-constrain the agent into rigid IVR scripts.

## Speakerphone And Noise Preferences

Speakerphone is a must-have.

The user repeatedly described the issue like audio engineering gating/compression:

- Background noise and the agent's own echo should not count as caller speech.
- The gate should be high enough that faint TV/speakerphone leakage does not interrupt.
- A real caller's voice should still be heard.

If the environment is too noisy to understand, the agent should behave like a person:

```text
I'm having trouble hearing you clearly. It sounds like there may be a lot of background noise. I can text you so we can keep going that way.
```

Texting may be placeholder until A2P registration is complete, but the product behavior should be designed around that fallback.

## Call Debugging Preferences

The user expects the assistant to listen to/analyze real calls because we built that capability.

When the user says a call was bad:

- Fetch the latest call.
- Confirm the business and call path.
- Use the recording/debug endpoint.
- Compare transcript to actual audio diagnostic.
- Explain what happened.
- Do not make changes unless asked.

Do not say "I can't listen" unless the recording is actually missing or the debug endpoint is unavailable.

## Conversation Style For Customers

The agent should be conversational, not scripted.

It should use the LLM to understand context. Examples:

- "six tonight" should mean 6 PM tonight in most reservation/appointment contexts.
- If the caller gives partial details, ask only for the missing pieces.
- If the caller already gave the time, do not ask again generically.

For home services, do not over-solve. Qualify enough to create a great request and route it. Avoid unsafe DIY guidance.

For restaurants, do not guarantee severe allergy safety. Escalate to staff.

For substitutions/customizations, the agent should understand the restaurant's configured flexibility. If uncertain, it can submit the request but avoid guaranteeing it.

## Customer-Facing Language Rules

Never call a customer a "lead" out loud.

Use:

- request
- details
- message
- appointment request
- service request
- reservation request
- order request
- follow-up

Do not say things like:

```text
I'll send this lead in.
```

Say:

```text
I'll send these details to the team so they can follow up.
```

## Owner Assistant Preferences

The owner should be able to communicate with SignalHost through:

- Dashboard
- Phone
- SMS when registration is ready
- Email

Trusted contacts should be based on stored phone/email identity:

- Owner
- Admin
- Manager
- Staff

Permission levels matter. Some manager changes may require owner approval.

Owner commands should support:

- Temporary updates.
- Permanent knowledge suggestions.
- Asking what happened today.
- Asking about urgent calls.
- Asking about open follow-ups.
- Correcting a bad answer.
- Teaching SignalHost something new.

Example owner update:

```text
We're closed tomorrow.
```

SignalHost should understand it as temporary business knowledge with an expiration.

## Reporting Preferences

Reports should feel narrative and vertical-specific, not like generic dashboards.

The daily report should sound like:

```text
Here's what I handled today.
```

Reports should include:

- Calls/chats handled.
- Important requests.
- Urgent issues.
- Complaints.
- Unknown questions.
- Open follow-ups.
- Suggested knowledge updates.
- High-value opportunities.

Do not show irrelevant vertical terms.

For example:

- Electrician reports should not mention reservations.
- HVAC reports should talk about service calls, no-heat/no-AC, maintenance, estimates.
- Restaurant reports can mention reservations, orders, private events, catering, allergy questions.

## Onboarding Preferences

Onboarding should be incredibly easy for non-technical business owners.

It should feel like a conversational interview, not a giant settings form.

It should:

- Ask all questions needed to build a powerful knowledge base.
- Explain why questions matter.
- Use examples.
- Use tooltips/help text.
- Avoid overwhelming the owner.
- Support uploads and links.
- Produce a launch center at the end.

The post-interview launch center should include:

- Assigned SignalHost phone number.
- Forwarding instructions.
- Website chat snippet and instructions.
- Agent email address.
- Texting instructions or placeholder.
- How to talk to/update the agent.
- What to test first.
- What the agent can do.
- What still needs external setup.

## Voice Names

The user rejected odd names like:

- Marin
- Coral
- Cedar
- Verse

Voice/employee names should feel normal and human. Names can subtly imply AI if tasteful, but should not sound fake or silly.

## Messaging And Email Preferences

Texting is important, but Twilio A2P registration is still a real-world blocker.

The likely architecture is a shared texting setup rather than forcing every customer number through separate registration.

Email is set up with Google Workspace for `tschneider@signalhost.ai`.

Resend is used for product email/inbound command routing, but do not break Gmail MX for `signalhost.ai`. Inbound bot email should use a subdomain such as `agents.signalhost.ai`.

Each business can have a generated agent email address:

```text
{agent-name}-{business-slug}+{location-id}@agents.signalhost.ai
```

## External Setup Instruction Style

When giving setup instructions, talk plainly and slowly.

The user prefers:

- Very specific step-by-step instructions.
- Exact fields to paste into.
- Exact values or placeholders.
- No assuming command-line comfort.
- Clear separation between Lovable, Render, Twilio, OpenAI, Supabase, Resend, Namecheap, and Google Workspace.

Avoid dumping raw command-line instructions unless needed.

## Pricing Preferences

Three tiers per vertical:

- Basic
- Middle
- High end / Premium

Basic should cover major functions with a monthly call/chat allowance somewhere around `$39-$99/month`.

Overage is preferred by call/chat rather than by minute, if feasible.

Middle can include more action-taking such as bookings, reservations, orders, or appointment intake.

High end can include integrations and premium vertical tools.

## Product Build Preferences

The user wants to move fast but not recklessly.

Good build order:

1. Sellable V1 foundations.
2. Owner assistant / feels-like-employee layer.
3. Temporary knowledge and business modes.
4. Narrative reports.
5. Learning loop.
6. Follow-up/revenue recovery.
7. Workflow statuses.
8. Revenue/opportunity scoring.
9. Vertical tools.
10. Deeper integrations/connections.

But do not rebuild features that already exist. Always inspect what is already built first.

## Strong Warnings

Before touching voice:

- Reload memory.
- Identify call path.
- Analyze audio.
- Propose narrow fix.
- Preserve known good behavior.

Before touching onboarding:

- Confirm all features have a tie-back to onboarding/knowledge/settings.
- Keep it simple for non-technical users.

Before touching marketing:

- Make vertical landing pages strong enough for real campaigns.
- Do not settle for generic SaaS copy.

Before touching reporting:

- Make it vertical-specific.
- Make it useful to the owner, not just pretty.
