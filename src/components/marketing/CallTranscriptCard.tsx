import { useEffect, useState } from "react";
import { Mic, User, Sparkles, PhoneCall } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = { who: "vera" | "caller"; text: string; dur: string };

const SCRIPT: Line[] = [
  { who: "vera",   text: "Thanks for calling Trattoria Rinaldi, this is Vera. How can I help?", dur: "0:04" },
  { who: "caller", text: "Hi — can I order a large margherita and a Caesar for pickup at 7?",   dur: "0:09" },
  { who: "vera",   text: "Absolutely. One large margherita, one Caesar, ready 7:00.",           dur: "0:14" },
  { who: "caller", text: "Perfect. And a bottle of the house red, please.",                     dur: "0:18" },
  { who: "vera",   text: "Got it. Total is $48.50. Confirming via text — see you at 7.",        dur: "0:24" },
];

export function CallTranscriptCard({ className }: { className?: string }) {
  const [active, setActive] = useState(0);
  const [elapsed, setElapsed] = useState(38);

  useEffect(() => {
    const id = setInterval(() => setActive((i) => (i + 1) % SCRIPT.length), 2400);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");
  const current = SCRIPT[active];
  const speaker = current.who;

  return (
    <div
      className={cn(
        "relative rounded-2xl border border-border bg-card p-1 shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_hsl(var(--foreground)/0.18)]",
        className,
      )}
    >
      <div className="overflow-hidden rounded-[14px] bg-gradient-to-br from-foreground to-[hsl(var(--foreground)/0.88)] text-background">
        {/* status bar */}
        <div className="flex items-center justify-between border-b border-background/10 px-5 py-3 text-[11px] font-medium text-background/70">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live call · in progress
          </div>
          <div className="tabular-nums">{mm}:{ss}</div>
        </div>

        {/* the two callers */}
        <div className="px-6 pt-7 pb-5">
          <div className="flex items-center justify-between gap-3">
            <Caller
              name="Marco P."
              sub="+1 (917) 555-0142"
              icon={User}
              tone="neutral"
              isActive={speaker === "caller"}
            />

            <div className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-success/20 text-success ring-2 ring-success/30">
                <PhoneCall className="h-3.5 w-3.5" />
              </div>
              <Waveform direction={speaker === "caller" ? "left" : "right"} />
              <div className="text-[10px] uppercase tracking-[0.18em] text-background/50">Connected</div>
            </div>

            <Caller
              name="Vera"
              sub="AI host · Trattoria"
              icon={Sparkles}
              tone="primary"
              isActive={speaker === "vera"}
            />
          </div>
        </div>

        {/* live caption */}
        <div className="border-t border-background/10 bg-background/5 px-6 py-4">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em]">
            <Mic className="h-3 w-3" />
            <span className={speaker === "vera" ? "text-primary-glow" : "text-background/80"}>
              {speaker === "vera" ? "Vera" : "Marco"} speaking
            </span>
            <span className="ml-auto tabular-nums text-background/50">{current.dur}</span>
          </div>
          <p
            key={active}
            className="mt-2 animate-fade-in text-[15px] leading-snug text-background"
          >
            "{current.text}"
          </p>
        </div>

        {/* extracted by AI */}
        <div className="grid grid-cols-3 gap-px border-t border-background/10 bg-background/10 text-[11px]">
          <Stat label="Intent" value="Pickup order" />
          <Stat label="Items" value="3" />
          <Stat label="ETA" value="7:00 PM" />
        </div>
      </div>

      <div className="pointer-events-none absolute -right-3 -top-3 h-6 w-6 rounded-full bg-primary shadow-lg ring-4 ring-background" />
    </div>
  );
}

function Caller({
  name, sub, icon: Icon, tone, isActive,
}: {
  name: string; sub: string; icon: any; tone: "primary" | "neutral"; isActive: boolean;
}) {
  return (
    <div className="flex w-[34%] flex-col items-center text-center">
      <div className="relative">
        {isActive && (
          <>
            <span className={cn(
              "absolute inset-0 -m-1 animate-ping rounded-full opacity-60",
              tone === "primary" ? "bg-primary/40" : "bg-background/30",
            )} />
            <span className={cn(
              "absolute inset-0 -m-3 rounded-full opacity-40",
              tone === "primary" ? "bg-primary/20" : "bg-background/15",
            )} />
          </>
        )}
        <div className={cn(
          "relative flex h-14 w-14 items-center justify-center rounded-full ring-2 transition-transform",
          tone === "primary"
            ? "bg-primary text-primary-foreground ring-primary/40"
            : "bg-background/15 text-background ring-background/20",
          isActive && "scale-105",
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-3 text-sm font-semibold text-background">{name}</div>
      <div className="text-[11px] leading-tight text-background/60">{sub}</div>
    </div>
  );
}

function Waveform({ direction }: { direction: "left" | "right" }) {
  const bars = 14;
  return (
    <div className="flex h-6 items-center gap-[3px]">
      {Array.from({ length: bars }).map((_, i) => {
        const distFromCenter = Math.abs(i - bars / 2);
        const baseH = 18 - distFromCenter * 1.6;
        const delay = (direction === "left" ? bars - i : i) * 70;
        return (
          <span
            key={i}
            className="w-[2px] rounded-full bg-success/80"
            style={{
              height: `${Math.max(4, baseH)}px`,
              animation: "wave 1.1s ease-in-out infinite",
              animationDelay: `${delay}ms`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes wave {
          0%, 100% { transform: scaleY(0.35); opacity: 0.55; }
          50%      { transform: scaleY(1);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-foreground px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-background/50">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-background">{value}</div>
    </div>
  );
}
