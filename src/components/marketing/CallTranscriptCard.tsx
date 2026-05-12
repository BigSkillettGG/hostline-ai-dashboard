import { useEffect, useState } from "react";
import { Mic, PhoneCall, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = { who: "vera" | "caller"; text: string; dur: string };

const SCRIPT: Line[] = [
  { who: "vera", text: "Thanks for calling Trattoria Rinaldi. How can I help you?", dur: "0:04" },
  { who: "caller", text: "Hi, can I order a large margherita and one Caesar salad for pickup at 7?", dur: "0:10" },
  { who: "vera", text: "Absolutely. One large margherita and one Caesar salad, ready at 7.", dur: "0:16" },
  { who: "caller", text: "Perfect. Can you also add garlic knots and two tiramisus?", dur: "0:22" },
  { who: "vera", text: "Got it. Garlic knots and two tiramisus added. Total is $54.12. Confirming via text now.", dur: "0:29" },
];

export function CallTranscriptCard({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(38);

  useEffect(() => {
    const id = window.setInterval(() => setActive((index) => (index + 1) % SCRIPT.length), 4200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setElapsed((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  const current = SCRIPT[active];
  const isVeraSpeaking = current.who === "vera";
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div className={cn("relative rounded-md border border-border bg-card p-1 shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_hsl(var(--foreground)/0.18)]", className)}>
      <div className="overflow-hidden rounded-md bg-foreground text-background">
        <div className="flex items-center justify-between border-b border-background/10 px-5 py-3 text-[11px] font-medium text-background/70">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live call in progress
          </div>
          <div className="tabular-nums">{mm}:{ss}</div>
        </div>

        <div className="px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-7">
          <div className="flex items-center justify-between gap-3">
            <Caller name="Marco P." sub="+1 (917) 555-0142" icon={User} tone="neutral" isActive={!isVeraSpeaking} />

            <div className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success ring-2 ring-success/30">
                <PhoneCall className="h-3.5 w-3.5" />
              </div>
              <Waveform direction={isVeraSpeaking ? "right" : "left"} />
              <div className="text-[10px] uppercase text-background/50">Connected</div>
            </div>

            <Caller name="Vera" sub="AI host - Trattoria" icon={Sparkles} tone="primary" isActive={isVeraSpeaking} />
          </div>
        </div>

        <div className="border-t border-background/10 bg-background/5 px-6 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase">
            <Mic className="h-3 w-3" />
            <span className={isVeraSpeaking ? "text-primary-glow" : "text-background/80"}>
              {isVeraSpeaking ? "Vera" : "Marco"} speaking
            </span>
            <span className="ml-auto tabular-nums text-background/50">{current.dur}</span>
          </div>
          <p key={active} className="mt-2 min-h-[44px] animate-fade-in text-[15px] leading-snug text-background">
            "{current.text}"
          </p>
        </div>

        <div className="grid grid-cols-3 gap-px border-t border-background/10 bg-background/10 text-[11px]">
          <Stat label="Intent" value="Pickup order" />
          <Stat label="Items" value="4" />
          <Stat label="ETA" value="7:00 PM" />
        </div>
      </div>
    </div>
  );
}

function Caller({
  name,
  sub,
  icon: Icon,
  tone,
  isActive,
}: {
  name: string;
  sub: string;
  icon: typeof User;
  tone: "primary" | "neutral";
  isActive: boolean;
}) {
  return (
    <div className="flex w-[34%] min-w-0 flex-col items-center text-center">
      <div
        className={cn(
          "relative flex h-12 w-12 items-center justify-center rounded-full ring-2 transition-transform sm:h-14 sm:w-14",
          tone === "primary" ? "bg-primary text-primary-foreground ring-primary/40" : "bg-background/15 text-background ring-background/20",
          isActive && "scale-105",
        )}
      >
        {isActive && <span className="absolute inset-[-6px] rounded-full border border-background/30" />}
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </div>
      <div className="mt-3 w-full truncate text-sm font-semibold text-background">{name}</div>
      <div className="w-full truncate text-[11px] leading-tight text-background/60">{sub}</div>
    </div>
  );
}

function Waveform({ direction }: { direction: "left" | "right" }) {
  const bars = 14;
  return (
    <div className="flex h-6 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, index) => {
        const distFromCenter = Math.abs(index - bars / 2);
        const baseHeight = 18 - distFromCenter * 1.6;
        const delay = (direction === "left" ? bars - index : index) * 70;
        return (
          <span
            key={index}
            className="w-[2px] rounded-full bg-success/80"
            style={{
              animation: "wave 1.1s ease-in-out infinite",
              animationDelay: `${delay}ms`,
              height: `${Math.max(4, baseHeight)}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-foreground px-4 py-3">
      <div className="text-[10px] uppercase text-background/50">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-background">{value}</div>
    </div>
  );
}
