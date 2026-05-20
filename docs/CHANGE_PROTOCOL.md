# SignalHost Change Protocol

Use this protocol to avoid regressions.

## Before Any Change

1. Run `git status --short`.
2. Read `docs/AGENT_BRIEFING.md`.
3. Read `docs/FOUNDER_NOTES.md` for user preferences and product taste.
4. If touching voice/routing, read `docs/KNOWN_GOOD_STATE.md` and `docs/VOICE_QUALITY_LEDGER.md`.
5. Identify whether the change is:
   - documentation only
   - frontend only
   - database/migration
   - voice behavior
   - call routing
   - onboarding/knowledge
   - reporting/analytics
   - owner assistant
5. State which category it is before editing.

## Voice Change Rules

Voice changes are high risk.

Do not change more than one of these at a time without explicit approval:

- OpenAI model
- OpenAI voice
- greeting text
- greeting timing
- turn detection mode
- VAD threshold
- semantic VAD eagerness
- manual response gating
- interruption handling
- tool-calling behavior
- Twilio/OpenAI SIP routing
- LiveKit routing
- ConversationRelay fallback

If the user asks to diagnose a call, first analyze. Do not make a fix unless the user asks for one.

## Required Voice Diagnosis Steps

1. Fetch the latest call or the specific call id.
2. Confirm business, location id, number, and call path.
3. Use the deployed debug endpoint with `audio=true`.
4. Compare:
   - database transcript
   - audio diagnostic transcript
   - timing of segments
   - quality notes in summary
   - speech-start count versus real caller turns
5. Identify whether the failure is:
   - routing/location resolution
   - greeting playout
   - false interruption/echo
   - VAD sensitivity
   - prompt/business logic
   - tool failure
   - model reasoning
   - call ending
   - provider/network issue
6. Only then propose a narrow fix.

## Required Post-Change Checks

For documentation-only changes:

```powershell
git diff -- docs
```

For TypeScript/frontend/voice changes:

```powershell
npm run lint
npm run build
```

For voice-service-only changes, also run the voice tests if available:

```powershell
npm run test:voice
```

If local `npm` is unavailable, say that and run the closest available check. Do not pretend tests ran.

## Update The Memory

After a meaningful change, update one or more of:

- `docs/FOUNDER_NOTES.md`
- `docs/VOICE_QUALITY_LEDGER.md`
- `docs/KNOWN_GOOD_STATE.md`
- `docs/DECISIONS.md`
- `docs/NEXT_ACTIONS.md`

If a test call produced a new known-good state, write it down immediately.

If a change is rolled back or quarantined, write that down too.

## Git Safety

- Do not revert user or Lovable changes unless explicitly asked.
- Do not delete `tmp/` diagnostics unless asked.
- Do not make destructive git commands.
- Keep commits narrow and named after the actual change.

## Deployment Safety

Before telling the user to test a call, confirm:

- The relevant commit was pushed.
- Render deployed the service successfully.
- The number is routed to the intended path.
- The business/location id is correct.
- The call path matches the intended test.
