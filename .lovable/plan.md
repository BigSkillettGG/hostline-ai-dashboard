# Replace hero "texting" mock with a live phone-call visual

The current `CallTranscriptCard` uses chat bubbles, which reads like an SMS thread. I'll redesign it to clearly communicate **two people on a live phone call with audio flowing between them**.

## New design (single component: `src/components/marketing/CallTranscriptCard.tsx`)

Dark "in-call" surface (like a phone's call screen), with:

```text
┌──────────────────────────────────────────────┐
│ ● Live call · in progress           00:38    │
├──────────────────────────────────────────────┤
│                                              │
│   ( 👤 )         📞                ( ✨ )    │
│   Marco P.    ▮▮▮▮▮▮▮▮▮▮▮         Vera      │
│   +1 917…     Connected           AI host    │
│                                              │
├──────────────────────────────────────────────┤
│ 🎙 VERA SPEAKING                       0:14  │
│ "Absolutely. One large margherita,           │
│  one Caesar, ready 7:00."                    │
├──────────────────────────────────────────────┤
│ Intent          Items         ETA            │
│ Pickup order    3             7:00 PM        │
└──────────────────────────────────────────────┘
```

Key visual signals that this is a **voice call, not a chat**:

- Two circular avatars facing each other (caller on left with a person icon, Vera on right with a sparkle icon, primary-tinted).
- A phone-call icon in the middle with an **animated waveform** of bars between them — bars pulse and the wave direction flows from whoever is currently speaking toward the listener.
- "Pulsing rings" around whichever avatar is speaking right now (alternates every ~2.4s as the script advances).
- A live-call status bar at the top with a ticking `MM:SS` timer and a red/green "Live" pulse dot.
- A single rotating **caption** block ("VERA SPEAKING" / "MARCO SPEAKING") with the current spoken line — replaces the chat-thread bubbles entirely.
- A bottom strip showing what the AI extracted from the call (Intent / Items / ETA), reinforcing "this is a phone call being understood by AI".

## What stays / what's removed

- Removed: stacked chat bubbles, message-thread layout, "max-w-[85%] bubbles" styling.
- Kept: the same script lines, the corner accent dot, the outer card shell + shadow.
- No other files change. Same import path, same usage in `Home.tsx` — just a visual replacement.

## Tech notes

- Pure CSS animations (`animate-ping` for speaker rings, a small inline `@keyframes wave` for waveform bars, `animate-fade-in` on the caption). No new dependencies.
- Uses existing semantic tokens (`primary`, `success`, `background`, `foreground`, `muted-foreground`) — no hardcoded colors.
- Two `setInterval`s: one to advance the speaker every 2.4s, one to tick the call timer every 1s.
