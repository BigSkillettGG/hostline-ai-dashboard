# SignalHost Claude Instructions

This project has persistent memory files because chat context has caused regressions.

Before making changes, read:

1. `docs/AGENT_BRIEFING.md`
2. `docs/FOUNDER_NOTES.md`
3. `docs/KNOWN_GOOD_STATE.md`
4. `docs/VOICE_QUALITY_LEDGER.md`
5. `docs/CHANGE_PROTOCOL.md`
6. `docs/NEXT_ACTIONS.md`

Primary live voice direction is OpenAI Realtime SIP. Treat LiveKit as experimental, ElevenLabs as not the live-call provider, and Twilio ConversationRelay as legacy/fallback.

When diagnosing test calls, use the call recording/debug workflow in `docs/AGENT_BRIEFING.md` before proposing changes.
