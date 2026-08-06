# SignalHost Agent Instructions

Before making changes in this repository, read:

1. `docs/AGENT_BRIEFING.md`
2. `docs/FOUNDER_NOTES.md`
3. `docs/KNOWN_GOOD_STATE.md`
4. `docs/VOICE_QUALITY_LEDGER.md`
5. `docs/CHANGE_PROTOCOL.md`
6. `docs/NEXT_ACTIONS.md`

After reading them, say: "I have reloaded the SignalHost project memory."

Voice work is especially fragile. If the task touches calls, OpenAI Realtime, Twilio, SIP, LiveKit, recordings, transcripts, greetings, VAD, interruption handling, speakerphone behavior, routing, or call quality, do not skip the memory reload.

Do not make a fix when the user only asks for analysis.

Do not say calls cannot be listened to. Use the deployed debug endpoint described in `docs/AGENT_BRIEFING.md`.

Primary live voice direction is Vapi. Direct OpenAI Realtime SIP is the maintained fallback. ElevenLabs is preview/legacy only, LiveKit is quarantined, and Twilio ConversationRelay is legacy fallback only. Do not change live routing without a measured test and explicit rollback.
