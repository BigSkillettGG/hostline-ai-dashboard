import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  FileText,
  Headphones,
  Moon,
  Pause,
  PhoneCall,
  Play,
  ShoppingBag,
  Sparkles,
  UserRound,
  Utensils,
  Volume2,
  Wine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PlaybackState = "done" | "idle" | "playing";
type Speaker = "vera" | "caller";

interface DemoLine {
  speaker: Speaker;
  text: string;
}

interface DemoScenario {
  audioUrl?: string;
  caller: {
    color: string;
    initials: string;
    name: string;
    phone: string;
  };
  captured: string;
  icon: LucideIcon;
  id: string;
  intent: string;
  label: string;
  lines: DemoLine[];
  outcome: string;
}

const scenarios: DemoScenario[] = [
  {
    audioUrl: "/audio/call-faq.mp3",
    caller: { color: "#4A90D9", initials: "MP", name: "Marco P.", phone: "+1 (917) 555-0142" },
    captured: "Parking answer",
    icon: Clock,
    id: "faq",
    intent: "FAQ",
    label: "Hours and parking",
    outcome: "Resolved",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you tonight?" },
      { speaker: "caller", text: "Hey, what time do you guys close on Sundays?" },
      { speaker: "vera", text: "We're open until 9 PM on Sundays. Kitchen takes last orders at 8:30." },
      { speaker: "caller", text: "And is there parking nearby?" },
      { speaker: "vera", text: "There's metered street parking on Valencia, and a paid lot at 17th and Valencia, about a two minute walk." },
      { speaker: "caller", text: "Perfect, thanks!" },
      { speaker: "vera", text: "You're welcome. Anything else I can help with tonight?" },
    ],
  },
  {
    audioUrl: "/audio/call-order.mp3",
    caller: { color: "#D4568E", initials: "SM", name: "Sarah M.", phone: "+1 (415) 555-0238" },
    captured: "3 items",
    icon: ShoppingBag,
    id: "order",
    intent: "Order",
    label: "Pickup order",
    outcome: "$54 captured",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you?" },
      { speaker: "caller", text: "I'd like to place a pickup order. Two margherita pizzas and a Caesar salad." },
      { speaker: "vera", text: "Got it. Two margheritas and one Caesar. Any modifications? We can do gluten-free crust for four dollars more." },
      { speaker: "caller", text: "Gluten-free on one pizza, and no anchovy on the Caesar." },
      { speaker: "vera", text: "Perfect. One regular margherita, one gluten-free, Caesar no anchovy. That's fifty four dollars. What name for pickup?" },
      { speaker: "caller", text: "Sarah." },
      { speaker: "vera", text: "Sarah, your order will be ready in about 25 minutes. Pay at the counter. Sending you a text confirmation now." },
    ],
  },
  {
    caller: { color: "#8B5CF6", initials: "PS", name: "Priya S.", phone: "+1 (510) 555-0391" },
    captured: "Party of 6",
    icon: CalendarDays,
    id: "reservation",
    intent: "Reservation",
    label: "Reservation",
    outcome: "Staff review",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you?" },
      { speaker: "caller", text: "I'd like to book a table for six this Saturday at 7:30." },
      { speaker: "vera", text: "Saturday at 7:30 for six. I'll put in a reservation request for you. Any special occasion?" },
      { speaker: "caller", text: "It's my mom's sixtieth birthday. Could we get a quiet table near the window?" },
      { speaker: "vera", text: "Happy birthday to her. I've noted the birthday and window preference. What name should I put it under?" },
      { speaker: "caller", text: "Priya Shah." },
      { speaker: "vera", text: "Priya, I've sent the request to the team. You'll get a text once they confirm. Anything else?" },
    ],
  },
  {
    caller: { color: "#059669", initials: "JR", name: "James R.", phone: "+1 (628) 555-0187" },
    captured: "Wine upsell",
    icon: Wine,
    id: "specials",
    intent: "FAQ",
    label: "Specials and wine",
    outcome: "Upsell offered",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you?" },
      { speaker: "caller", text: "What specials do you have tonight?" },
      { speaker: "vera", text: "Tonight's special is a wood-fired branzino with lemon and capers for thirty four dollars. The chef's burrata is also back with heirloom tomatoes." },
      { speaker: "caller", text: "Ooh, nice. Do you have good red wines by the glass?" },
      { speaker: "vera", text: "We have a Chianti Classico and a Montepulciano, both around sixteen dollars. Full wine list is on our website too." },
      { speaker: "caller", text: "Is there live music tonight?" },
      { speaker: "vera", text: "Not tonight, but we have live jazz every Thursday from 7 to 10. Would you like to make a reservation for Thursday?" },
    ],
  },
  {
    caller: { color: "#D97706", initials: "LK", name: "Linda K.", phone: "+1 (831) 555-0445" },
    captured: "Allergy flag",
    icon: Utensils,
    id: "allergy",
    intent: "FAQ",
    label: "Dietary and allergy",
    outcome: "Staff-safe answer",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you?" },
      { speaker: "caller", text: "My daughter has a severe nut allergy. Can you accommodate that?" },
      { speaker: "vera", text: "I want to be upfront. We do use nuts in several dishes, and cross-contact is possible in our kitchen. For severe allergies, I'd recommend speaking with the chef directly." },
      { speaker: "caller", text: "Okay. Do you have gluten-free options?" },
      { speaker: "vera", text: "We do. Gluten-free pizza crust is available for four dollars more, and several pasta dishes can be made with gluten-free pasta. I can note the allergy for your order." },
      { speaker: "caller", text: "That's helpful. What about vegan options?" },
      { speaker: "vera", text: "Our roasted vegetable antipasto and the marinara pizza are both vegan. I can also ask the kitchen about modifications on other dishes." },
    ],
  },
  {
    caller: { color: "#DC2626", initials: "?", name: "+1 (415) 555-0177", phone: "+1 (415) 555-0177" },
    captured: "Manager alert",
    icon: AlertTriangle,
    id: "complaint",
    intent: "Complaint",
    label: "Complaint",
    outcome: "Escalated",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help you?" },
      { speaker: "caller", text: "I was there last night and my order was completely wrong. I got chicken instead of salmon." },
      { speaker: "vera", text: "I'm really sorry to hear that. That's not the experience we want for you. Let me get the manager involved right away." },
      { speaker: "caller", text: "This is the second time it's happened. I want a refund." },
      { speaker: "vera", text: "I understand your frustration. I've texted the manager with the details. They'll call you back within the hour to make this right." },
      { speaker: "caller", text: "Fine. My number is 415-555-0177." },
      { speaker: "vera", text: "Got it. The manager will reach out shortly. I'm sorry again. We want to fix this." },
    ],
  },
  {
    caller: { color: "#0891B2", initials: "CR", name: "Carlos R.", phone: "+1 (650) 555-0299" },
    captured: "After-hours request",
    icon: Moon,
    id: "afterhours",
    intent: "Reservation",
    label: "After hours",
    outcome: "Captured",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember. We're closed right now, but this is Vera. I can still help." },
      { speaker: "caller", text: "Oh, when do you open tomorrow?" },
      { speaker: "vera", text: "We open at 5 PM tomorrow, Tuesday. Kitchen takes orders until 9:30." },
      { speaker: "caller", text: "Can I make a reservation for tomorrow at 7?" },
      { speaker: "vera", text: "I can put in a request for tomorrow at 7. How many guests?" },
      { speaker: "caller", text: "Four, under the name Rodriguez." },
      { speaker: "vera", text: "Done. Party of four, tomorrow at 7, under Rodriguez. The team will confirm by text in the morning. Anything else?" },
    ],
  },
];

export function VoiceDemoPlayer() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [playback, setPlayback] = useState<PlaybackState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioFallback, setAudioFallback] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<number | null>(null);

  const scenario = scenarios[scenarioIndex];
  const effectiveDuration = duration || estimateScenarioSeconds(scenario.lines);
  const progress = effectiveDuration > 0 ? Math.min(100, (elapsed / effectiveDuration) * 100) : 0;
  const activeLineIndex = playback === "idle" ? -1 : getActiveLineIndex(scenario.lines, elapsed, effectiveDuration);
  const isReadyAudio = Boolean(scenario.audioUrl);

  const clearPlaybackResources = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.onloadedmetadata = null;
      audioRef.current.ontimeupdate = null;
      audioRef.current = null;
    }
  }, []);

  const startScriptPreview = useCallback((nextScenario: DemoScenario, failedAudio = false) => {
    const previewDuration = estimateScenarioSeconds(nextScenario.lines);

    setDuration(previewDuration);
    setAudioFallback(failedAudio);

    timerRef.current = window.setInterval(() => {
      setElapsed((current) => {
        const nextElapsed = Math.min(previewDuration, current + 0.25);
        if (nextElapsed >= previewDuration) {
          if (timerRef.current !== null) {
            window.clearInterval(timerRef.current);
            timerRef.current = null;
          }
          setPlayback("done");
        }
        return nextElapsed;
      });
    }, 250);
  }, []);

  const stop = useCallback(() => {
    clearPlaybackResources();
    setPlayback("idle");
    setElapsed(0);
    setDuration(0);
  }, [clearPlaybackResources]);

  useEffect(() => () => clearPlaybackResources(), [clearPlaybackResources]);

  const play = useCallback((nextScenarioIndex = scenarioIndex) => {
    clearPlaybackResources();

    const nextScenario = scenarios[nextScenarioIndex];
    setScenarioIndex(nextScenarioIndex);
    setPlayback("playing");
    setElapsed(0);
    setDuration(0);
    setAudioFallback(false);

    if (!nextScenario.audioUrl) {
      startScriptPreview(nextScenario);
      return;
    }

    const audio = new Audio(nextScenario.audioUrl);
    audioRef.current = audio;

    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };

    audio.ontimeupdate = () => {
      setElapsed(audio.currentTime);
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };

    audio.onended = () => {
      setElapsed(Number.isFinite(audio.duration) ? audio.duration : estimateScenarioSeconds(nextScenario.lines));
      setPlayback("done");
      audioRef.current = null;
    };

    audio.onerror = () => {
      clearPlaybackResources();
      startScriptPreview(nextScenario, true);
    };

    void audio.play().catch(() => {
      clearPlaybackResources();
      startScriptPreview(nextScenario, true);
    });
  }, [clearPlaybackResources, scenarioIndex, startScriptPreview]);

  const chooseScenario = (index: number) => {
    stop();
    setScenarioIndex(index);
    setAudioFallback(false);
  };

  const statusText = useMemo(() => {
    if (playback === "playing") return isReadyAudio && !audioFallback ? "Live audio playing" : "Script preview playing";
    if (playback === "done") return "Call complete";
    return isReadyAudio ? "Audio ready" : "Script preview";
  }, [audioFallback, isReadyAudio, playback]);

  return (
    <div className="mx-auto max-w-5xl text-white">
      <div className="mx-auto max-w-3xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <span className="h-px w-7 bg-primary/60" />
          Live demo
        </div>
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl lg:text-[44px] lg:leading-[1.05]">
          Listen to Vera handle real restaurant calls.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/60 md:text-lg">
          Finished audio is live for parking questions and pickup orders, with the remaining scenarios available as timed previews.
        </p>
      </div>

      <div className="mt-10 -mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
        <div className="flex gap-2 sm:flex-wrap sm:justify-center">
          {scenarios.map((item, index) => {
            const Icon = item.icon;
            const isActive = index === scenarioIndex;

            return (
              <button
                aria-pressed={isActive}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground shadow-[0_0_0_4px_hsl(var(--primary)/0.14)]"
                    : "border-white/10 bg-white/[0.04] text-white/65 hover:border-primary/50 hover:bg-white/[0.07] hover:text-white",
                )}
                key={item.id}
                onClick={() => chooseScenario(index)}
                type="button"
              >
                <Icon className="h-4 w-4" />
                {item.label}
                {item.audioUrl && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success sm:hidden" />
                    <span className="hidden sm:inline">Audio</span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-[#18120e] shadow-[0_32px_100px_-42px_rgba(0,0,0,0.85)]">
        <div className="border-b border-white/10 bg-[#1c1611] px-5 py-4 md:px-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-white/45">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1">
                  <PhoneCall className="h-3.5 w-3.5 text-primary" />
                  Olive & Ember inbound line
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1">
                  <Volume2 className="h-3.5 w-3.5 text-primary" />
                  {scenario.label}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight md:text-2xl">
                {scenario.caller.name} is calling. Vera picks up.
              </h3>
            </div>

            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
              {isReadyAudio && !audioFallback ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <Headphones className="h-4 w-4 text-primary" />
              )}
              {statusText}
            </div>
          </div>
        </div>

        {audioFallback && (
          <div className="border-b border-warning/20 bg-warning/10 px-5 py-3 text-xs text-white/70 md:px-7">
            The full-call MP3 did not load, so this scenario is playing as a timed transcript preview.
          </div>
        )}

        <div className="grid gap-px bg-white/10">
          <div className="grid gap-px bg-white/10 lg:grid-cols-[1fr_260px_1fr]">
            <PersonPanel active={activeLineIndex >= 0 && scenario.lines[activeLineIndex]?.speaker === "caller"} caller={scenario.caller} speaker="caller" />

            <div className="flex min-h-[240px] flex-col items-center justify-center bg-[#241b14] px-5 py-8 text-center">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#18120e] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
                <span className={cn("h-2 w-2 rounded-full", playback === "playing" ? "bg-success" : "bg-primary")} />
                {playback === "playing" ? "Connected" : playback === "done" ? "Complete" : "Ready"}
              </div>

              <Button
                aria-label={playback === "playing" ? "Stop demo call" : "Play demo call"}
                className="h-[72px] w-[72px] rounded-full bg-primary p-0 text-primary-foreground shadow-[0_18px_50px_-16px_hsl(var(--primary))] hover:bg-primary/90"
                onClick={() => (playback === "playing" ? stop() : play())}
              >
                {playback === "playing" ? <Pause className="h-8 w-8" /> : <Play className="ml-1 h-8 w-8" />}
              </Button>

              <div className="mt-6 flex h-7 items-end justify-center gap-1">
                {Array.from({ length: 22 }).map((_, index) => (
                  <span
                    className={cn(
                      "w-1 rounded-full bg-primary/70 transition-all",
                      playback === "playing" ? "animate-pulse" : "h-1 opacity-40",
                    )}
                    key={index}
                    style={{
                      animationDelay: `${index * 55}ms`,
                      height: playback === "playing" ? `${6 + ((index * 7) % 18)}px` : undefined,
                    }}
                  />
                ))}
              </div>

              <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
                {playback === "playing" ? "On the call" : playback === "done" ? "Replay call" : "Press play"}
              </div>
              <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
                <PhoneCall className="h-4 w-4 text-primary" />
                {formatElapsed(elapsed)} / {formatElapsed(effectiveDuration)}
              </div>
            </div>

            <PersonPanel active={activeLineIndex >= 0 && scenario.lines[activeLineIndex]?.speaker === "vera"} caller={scenario.caller} speaker="vera" />
          </div>

          <div className="bg-[#18120e]">
            <div className="h-1.5 bg-white/10">
              <div className="h-full rounded-r-full bg-primary transition-[width]" style={{ width: `${progress}%` }} />
            </div>

            <div className="grid gap-px bg-white/10 sm:grid-cols-4">
              <DemoStat label="Intent" value={scenario.intent} />
              <DemoStat label="Outcome" value={scenario.outcome} />
              <DemoStat label="Captured" value={scenario.captured} />
              <DemoStat label="Caller" value={scenario.caller.name} />
            </div>
          </div>

          <div className="max-h-[430px] overflow-y-auto bg-[#211912] px-4 py-5 md:px-7">
            <div className="mx-auto max-w-3xl space-y-3">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/35">
                  <FileText className="h-4 w-4 text-primary" />
                  Live transcript
                </div>
                <div className="text-xs text-white/35">{scenario.lines.length} turns</div>
              </div>

              {scenario.lines.map((line, index) => {
                const isVera = line.speaker === "vera";
                const isActive = index === activeLineIndex;
                const hasPlayed = playback !== "idle" && index < activeLineIndex;

                return (
                  <div
                    className={cn(
                      "flex transition-opacity",
                      isVera ? "justify-end" : "justify-start",
                      playback === "idle" && "opacity-75",
                      hasPlayed && "opacity-70",
                    )}
                    key={`${scenario.id}-${index}`}
                  >
                    <div
                      className={cn(
                        "max-w-[86%] rounded-lg border px-4 py-3 text-sm leading-relaxed shadow-sm md:max-w-[72%]",
                        isVera
                          ? "border-primary/30 bg-primary/15 text-white"
                          : "border-white/10 bg-white/[0.055] text-white/85",
                        isActive && "border-primary bg-primary/25 shadow-[0_0_0_3px_hsl(var(--primary)/0.18)]",
                      )}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em]">
                        {isVera ? (
                          <Sparkles className="h-3 w-3 text-primary" />
                        ) : (
                          <UserRound className="h-3 w-3 text-white/45" />
                        )}
                        <span className={isVera ? "text-primary" : "text-white/45"}>
                          {isVera ? "Vera" : scenario.caller.name}
                        </span>
                      </div>
                      {line.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonPanel({
  active,
  caller,
  speaker,
}: {
  active: boolean;
  caller: DemoScenario["caller"];
  speaker: Speaker;
}) {
  const isVera = speaker === "vera";
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center bg-[#211912] px-5 py-6 text-center sm:min-h-[240px] sm:py-8">
      <div className="mb-3 rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
        {isVera ? "Restaurant host" : "Caller"}
      </div>
      <div className="relative">
        {active && <span className="absolute inset-[-8px] rounded-full border border-primary/50" />}
        <div
          className={cn(
            "flex h-[72px] w-[72px] items-center justify-center rounded-full text-lg font-semibold ring-4 transition-transform",
            isVera ? "bg-primary text-primary-foreground ring-primary/15" : "text-white ring-white/10",
            active && "scale-105 ring-primary/35",
          )}
          style={isVera ? undefined : { background: caller.color }}
        >
          {isVera ? "V" : caller.initials}
        </div>
      </div>
      <div className="mt-4 text-sm font-semibold text-white">{isVera ? "Vera" : caller.name}</div>
      <div className="mt-1 text-xs text-white/40">{isVera ? "AI host - Olive & Ember" : caller.phone}</div>
      <div className={cn(
        "mt-4 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px]",
        active ? "border-primary/35 bg-primary/10 text-primary" : "border-white/10 bg-white/[0.04] text-white/30",
      )}>
        <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-white/25")} />
        {active ? "Speaking" : "Listening"}
      </div>
    </div>
  );
}

function DemoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#18120e] px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.16em] text-white/30">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function estimateScenarioSeconds(lines: DemoLine[]) {
  const wordCount = lines.reduce((total, line) => total + line.text.split(/\s+/).length, 0);
  return Math.max(18, Math.round(wordCount * 0.36 + lines.length * 0.55));
}

function getActiveLineIndex(lines: DemoLine[], elapsed: number, duration: number) {
  if (duration <= 0) return 0;

  const weights = lines.map((line) => Math.max(1.6, line.text.split(/\s+/).length * 0.34));
  const totalWeight = weights.reduce((total, weight) => total + weight, 0);
  const target = (elapsed / duration) * totalWeight;
  let running = 0;

  for (let index = 0; index < weights.length; index += 1) {
    running += weights[index];
    if (target <= running) return index;
  }

  return lines.length - 1;
}

function formatElapsed(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}
