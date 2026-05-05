import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, PhoneCall, Sparkles, UserRound, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Speaker = "vera" | "caller";

interface DemoLine {
  audioIndex: number;
  speaker: Speaker;
  text: string;
}

interface DemoScenario {
  caller: {
    color: string;
    initials: string;
    name: string;
    phone: string;
  };
  captured: string;
  id: string;
  intent: string;
  label: string;
  lines: DemoLine[];
  outcome: string;
}

const scenarios: DemoScenario[] = [
  {
    caller: { color: "#4A90D9", initials: "MP", name: "Marco P.", phone: "+1 (917) 555-0142" },
    captured: "Parking answer",
    id: "faq",
    intent: "FAQ",
    label: "Hours and parking",
    outcome: "Resolved",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help tonight?", audioIndex: 0 },
      { speaker: "caller", text: "Hey, what time do you guys close on Sundays?", audioIndex: 0 },
      { speaker: "vera", text: "We're open until 9 PM on Sundays. Kitchen takes last orders at 8:30.", audioIndex: 1 },
      { speaker: "caller", text: "And is there parking nearby?", audioIndex: 1 },
      { speaker: "vera", text: "There's metered street parking on Valencia, and a paid lot at 17th and Valencia, about a two minute walk.", audioIndex: 2 },
      { speaker: "caller", text: "Perfect, thanks!", audioIndex: 2 },
      { speaker: "vera", text: "You're welcome. Anything else I can help with tonight?", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#D4568E", initials: "SM", name: "Sarah M.", phone: "+1 (415) 555-0238" },
    captured: "3 items",
    id: "order",
    intent: "Order",
    label: "Pickup order",
    outcome: "$54 captured",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help?", audioIndex: 0 },
      { speaker: "caller", text: "I'd like to place a pickup order. Two margherita pizzas and a Caesar salad.", audioIndex: 0 },
      { speaker: "vera", text: "Got it. Two margheritas and one Caesar. Any modifications? We can do gluten-free crust for four dollars more.", audioIndex: 1 },
      { speaker: "caller", text: "Gluten-free on one pizza, and no anchovy on the Caesar.", audioIndex: 1 },
      { speaker: "vera", text: "Perfect. One regular margherita, one gluten-free, Caesar no anchovy. That's fifty four dollars. What name for pickup?", audioIndex: 2 },
      { speaker: "caller", text: "Sarah.", audioIndex: 2 },
      { speaker: "vera", text: "Sarah, your order will be ready in about 25 minutes. Pay at the counter. Sending you a text confirmation now.", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#8B5CF6", initials: "PS", name: "Priya S.", phone: "+1 (510) 555-0391" },
    captured: "Party of 6",
    id: "reservation",
    intent: "Reservation",
    label: "Reservation",
    outcome: "Staff review",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help?", audioIndex: 0 },
      { speaker: "caller", text: "I'd like to book a table for six this Saturday at 7:30.", audioIndex: 0 },
      { speaker: "vera", text: "Saturday at 7:30 for six. I'll put in a reservation request for you. Any special occasion?", audioIndex: 1 },
      { speaker: "caller", text: "It's my mom's sixtieth birthday. Could we get a quiet table near the window?", audioIndex: 1 },
      { speaker: "vera", text: "Happy birthday to her. I've noted the birthday and window preference. What name should I put it under?", audioIndex: 2 },
      { speaker: "caller", text: "Priya Shah.", audioIndex: 2 },
      { speaker: "vera", text: "Priya, I've sent the request to the team. You'll get a text once they confirm. Anything else?", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#059669", initials: "JR", name: "James R.", phone: "+1 (628) 555-0187" },
    captured: "Wine upsell",
    id: "specials",
    intent: "FAQ",
    label: "Specials and wine",
    outcome: "Upsell offered",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help?", audioIndex: 0 },
      { speaker: "caller", text: "What specials do you have tonight?", audioIndex: 0 },
      { speaker: "vera", text: "Tonight's special is a wood-fired branzino with lemon and capers for thirty four dollars. The chef's burrata is also back with heirloom tomatoes.", audioIndex: 1 },
      { speaker: "caller", text: "Ooh, nice. Do you have good red wines by the glass?", audioIndex: 1 },
      { speaker: "vera", text: "We have a Chianti Classico and a Montepulciano, both around sixteen dollars. Full wine list is on our website too.", audioIndex: 2 },
      { speaker: "caller", text: "Is there live music tonight?", audioIndex: 2 },
      { speaker: "vera", text: "Not tonight, but we have live jazz every Thursday from 7 to 10. Would you like to make a reservation for Thursday?", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#D97706", initials: "LK", name: "Linda K.", phone: "+1 (831) 555-0445" },
    captured: "Allergy flag",
    id: "allergy",
    intent: "FAQ",
    label: "Dietary and allergy",
    outcome: "Staff-safe answer",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help?", audioIndex: 0 },
      { speaker: "caller", text: "My daughter has a severe nut allergy. Can you accommodate that?", audioIndex: 0 },
      { speaker: "vera", text: "I want to be upfront. We do use nuts in several dishes, and cross-contact is possible in our kitchen. For severe allergies, I'd recommend speaking with the chef directly.", audioIndex: 1 },
      { speaker: "caller", text: "Okay. Do you have gluten-free options?", audioIndex: 1 },
      { speaker: "vera", text: "We do. Gluten-free pizza crust is available for four dollars more, and several pasta dishes can be made with gluten-free pasta. I can note the allergy for your order.", audioIndex: 2 },
      { speaker: "caller", text: "That's helpful. What about vegan options?", audioIndex: 2 },
      { speaker: "vera", text: "Our roasted vegetable antipasto and the marinara pizza are both vegan. I can also ask the kitchen about modifications on other dishes.", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#DC2626", initials: "?", name: "+1 (415) 555-0177", phone: "+1 (415) 555-0177" },
    captured: "Manager alert",
    id: "complaint",
    intent: "Complaint",
    label: "Complaint",
    outcome: "Escalated",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember, this is Vera. How can I help?", audioIndex: 0 },
      { speaker: "caller", text: "I was there last night and my order was completely wrong. I got chicken instead of salmon.", audioIndex: 0 },
      { speaker: "vera", text: "I'm really sorry to hear that. That's not the experience we want for you. Let me get the manager involved right away.", audioIndex: 1 },
      { speaker: "caller", text: "This is the second time it's happened. I want a refund.", audioIndex: 1 },
      { speaker: "vera", text: "I understand your frustration. I've texted the manager with the details. They'll call you back within the hour to make this right.", audioIndex: 2 },
      { speaker: "caller", text: "Fine. My number is 415-555-0177.", audioIndex: 2 },
      { speaker: "vera", text: "Got it. The manager will reach out shortly. I'm sorry again. We want to fix this.", audioIndex: 3 },
    ],
  },
  {
    caller: { color: "#0891B2", initials: "CR", name: "Carlos R.", phone: "+1 (650) 555-0299" },
    captured: "After-hours request",
    id: "afterhours",
    intent: "Reservation",
    label: "After hours",
    outcome: "Captured",
    lines: [
      { speaker: "vera", text: "Thanks for calling Olive and Ember. We're closed right now, but this is Vera. I can still help.", audioIndex: 0 },
      { speaker: "caller", text: "Oh, when do you open tomorrow?", audioIndex: 0 },
      { speaker: "vera", text: "We open at 5 PM tomorrow, Tuesday. Kitchen takes orders until 9:30.", audioIndex: 1 },
      { speaker: "caller", text: "Can I make a reservation for tomorrow at 7?", audioIndex: 1 },
      { speaker: "vera", text: "I can put in a request for tomorrow at 7. How many guests?", audioIndex: 2 },
      { speaker: "caller", text: "Four, under the name Rodriguez.", audioIndex: 2 },
      { speaker: "vera", text: "Done. Party of four, tomorrow at 7, under Rodriguez. The team will confirm by text in the morning. Anything else?", audioIndex: 3 },
    ],
  },
];

export function VoiceDemoPlayer() {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [state, setState] = useState<"done" | "idle" | "playing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioMissing, setAudioMissing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const runIdRef = useRef(0);
  const scenario = scenarios[scenarioIndex];
  const currentLine = visibleCount > 0 ? scenario.lines[visibleCount - 1] : undefined;

  const stop = useCallback(() => {
    runIdRef.current += 1;
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }, []);

  useEffect(() => {
    if (state !== "playing") return undefined;
    const timer = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => () => stop(), [stop]);

  const playClip = useCallback((url: string, runId: number) => {
    return new Promise<boolean>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      let settled = false;

      const settle = (played: boolean) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        audio.onended = null;
        audio.onerror = null;
        if (audioRef.current === audio) audioRef.current = null;
        resolve(played && runIdRef.current === runId);
      };

      const timeout = window.setTimeout(() => settle(false), 3500);
      audio.onended = () => settle(true);
      audio.onerror = () => settle(false);
      void audio.play().catch(() => settle(false));
    });
  }, []);

  const play = useCallback(async (nextScenarioIndex = scenarioIndex) => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    audioRef.current?.pause();
    const nextScenario = scenarios[nextScenarioIndex];

    setScenarioIndex(nextScenarioIndex);
    setVisibleCount(0);
    setElapsed(0);
    setState("playing");

    for (let index = 0; index < nextScenario.lines.length; index += 1) {
      if (runIdRef.current !== runId) return;

      const line = nextScenario.lines[index];
      setVisibleCount(index + 1);

      let played = false;
      if (!audioMissing) {
        const prefix = line.speaker === "vera" ? "vera" : "caller";
        played = await playClip(`/audio/${prefix}-${nextScenario.id}-${line.audioIndex}.mp3`, runId);
        if (!played && runIdRef.current === runId) setAudioMissing(true);
      }

      if (!played) {
        await sleep(Math.max(1300, line.text.split(" ").length * 115));
      }
    }

    if (runIdRef.current === runId) setState("done");
  }, [audioMissing, playClip, scenarioIndex]);

  const chooseScenario = (index: number) => {
    stop();
    setScenarioIndex(index);
    setVisibleCount(0);
    setElapsed(0);
  };

  return (
    <Card className="overflow-hidden border-border bg-foreground text-background shadow-[0_28px_80px_-36px_hsl(var(--foreground)/0.65)]">
      <div className="border-b border-background/10 px-5 py-4 md:px-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Badge className="mb-2 border-primary/30 bg-primary/20 text-primary-glow" variant="outline">
              <Volume2 className="mr-1 h-3 w-3" />
              Voice demo
            </Badge>
            <h3 className="text-xl font-semibold tracking-tight text-background md:text-2xl">
              Hear Vera handle real restaurant call scenarios.
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-background/60">
              Generate the ElevenLabs clips locally, then these demos play Vera and unique caller voices from /audio.
            </p>
          </div>
          <Button
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => (state === "playing" ? stop() : play())}
          >
            {state === "playing" ? <Pause className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
            {state === "playing" ? "Stop" : state === "done" ? "Replay call" : "Play call"}
          </Button>
        </div>
        {audioMissing && (
          <div className="mt-4 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-background/70">
            Audio files are not in public/audio yet, so the transcript is playing as a timed preview. Run npm run marketing:audio with ELEVENLABS_API_KEY to generate clips.
          </div>
        )}
      </div>

      <div className="grid gap-px bg-background/10 lg:grid-cols-[260px_1fr]">
        <div className="bg-foreground p-3">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {scenarios.map((item, index) => (
              <button
                className={cn(
                  "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  index === scenarioIndex
                    ? "border-primary/60 bg-primary/15 text-primary-glow"
                    : "border-background/10 bg-background/5 text-background/60 hover:bg-background/10 hover:text-background",
                )}
                key={item.id}
                onClick={() => chooseScenario(index)}
              >
                <span className="block font-medium">{item.label}</span>
                <span className="mt-0.5 block text-xs opacity-70">{item.outcome}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-foreground">
          <div className="grid gap-px bg-background/10 sm:grid-cols-3">
            <DemoStat label="Intent" value={scenario.intent} />
            <DemoStat label="Outcome" value={scenario.outcome} />
            <DemoStat label="Captured" value={scenario.captured} />
          </div>

          <div className="grid gap-px bg-background/10 md:grid-cols-[220px_1fr]">
            <div className="bg-foreground p-5">
              <div className="flex items-center justify-between gap-3 md:block">
                <SpeakerBadge active={currentLine?.speaker === "caller"} caller={scenario.caller} speaker="caller" />
                <div className="my-4 hidden h-px bg-background/10 md:block" />
                <div className="mx-3 h-px flex-1 bg-background/10 md:hidden" />
                <SpeakerBadge active={currentLine?.speaker === "vera"} caller={scenario.caller} speaker="vera" />
              </div>
              <div className="mt-5 flex items-center justify-center gap-2 rounded-full border border-background/10 bg-background/5 px-3 py-2 text-xs text-background/50">
                <PhoneCall className="h-3.5 w-3.5" />
                {state === "playing" ? formatElapsed(elapsed) : state === "done" ? `Ended at ${formatElapsed(elapsed)}` : "Ready"}
              </div>
            </div>

            <div className="max-h-[440px] min-h-[360px] overflow-y-auto bg-foreground px-5 py-4">
              {visibleCount === 0 ? (
                <div className="flex min-h-[320px] flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary-glow">
                    <Play className="h-6 w-6" />
                  </div>
                  <div className="mt-4 text-sm font-medium text-background">Choose a scenario and press play.</div>
                  <div className="mt-1 max-w-sm text-xs text-background/50">
                    Without generated audio, this still previews the transcript pacing.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {scenario.lines.slice(0, visibleCount).map((line, index) => (
                    <div
                      className={cn(
                        "rounded-lg border px-4 py-3",
                        line.speaker === "vera"
                          ? "border-primary/25 bg-primary/10"
                          : "border-background/10 bg-background/5",
                      )}
                      key={`${scenario.id}-${index}`}
                    >
                      <div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
                        {line.speaker === "vera" ? (
                          <Sparkles className="h-3 w-3 text-primary-glow" />
                        ) : (
                          <UserRound className="h-3 w-3 text-background/50" />
                        )}
                        <span className={line.speaker === "vera" ? "text-primary-glow" : "text-background/50"}>
                          {line.speaker === "vera" ? "Vera" : scenario.caller.name}
                        </span>
                        {state === "playing" && index === visibleCount - 1 && (
                          <span className="ml-auto flex items-center gap-[3px]">
                            {Array.from({ length: 8 }).map((_, barIndex) => (
                              <span
                                className="h-3 w-[2px] animate-pulse rounded-full bg-success"
                                key={barIndex}
                                style={{ animationDelay: `${barIndex * 90}ms` }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <p className="text-sm leading-relaxed text-background/90">{line.text}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}

function DemoStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-foreground px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.16em] text-background/35">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-background">{value}</div>
    </div>
  );
}

function SpeakerBadge({
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
    <div className="flex flex-col items-center text-center">
      <div
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-sm font-semibold ring-4 transition-transform",
          isVera ? "bg-primary text-primary-foreground ring-primary/20" : "text-white ring-background/10",
          active && "scale-105",
        )}
        style={isVera ? undefined : { background: caller.color }}
      >
        {isVera ? "V" : caller.initials}
      </div>
      <div className="mt-2 text-sm font-semibold text-background">{isVera ? "Vera" : caller.name}</div>
      <div className="text-[11px] text-background/45">{isVera ? "AI host" : caller.phone}</div>
    </div>
  );
}

function formatElapsed(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
