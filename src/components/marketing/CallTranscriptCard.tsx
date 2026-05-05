import { useEffect, useState } from "react";
import { Phone, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

type Line = { who: "vera" | "caller"; text: string };

const SCRIPT: Line[] = [
  { who: "vera",   text: "Thanks for calling Trattoria Rinaldi, this is Vera. How can I help?" },
  { who: "caller", text: "Hi — can I order a large margherita and a Caesar for pickup at 7?" },
  { who: "vera",   text: "Absolutely. One large margherita, one Caesar, ready 7:00. Anything to drink?" },
  { who: "caller", text: "A bottle of the house red, please." },
  { who: "vera",   text: "Got it. Total is $48.50. Confirming via text — see you at 7." },
];

export function CallTranscriptCard({ className }: { className?: string }) {
  const [count, setCount] = useState(1);

  useEffect(() => {
    const id = setInterval(() => {
      setCount((c) => (c >= SCRIPT.length ? 1 : c + 1));
    }, 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className={cn(
      "relative rounded-2xl border border-border bg-card p-1 shadow-[0_1px_0_hsl(var(--border)),0_24px_48px_-24px_hsl(var(--foreground)/0.18)]",
      className,
    )}>
      <div className="rounded-[14px] bg-gradient-to-br from-background to-muted/40 p-5">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">Incoming · pickup</div>
              <div className="text-xs text-muted-foreground">+1 (917) 555-0142 · 00:38</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            Live
          </div>
        </div>

        {/* transcript */}
        <div className="mt-4 min-h-[230px] space-y-2.5">
          {SCRIPT.slice(0, count).map((l, i) => (
            <div
              key={i}
              className={cn(
                "flex animate-fade-in",
                l.who === "vera" ? "justify-start" : "justify-end",
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-snug",
                  l.who === "vera"
                    ? "bg-primary/10 text-foreground rounded-bl-sm"
                    : "bg-foreground text-background rounded-br-sm",
                )}
              >
                {l.who === "vera" && (
                  <div className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                    <Sparkles className="h-2.5 w-2.5" /> Vera
                  </div>
                )}
                {l.text}
              </div>
            </div>
          ))}
        </div>

        {/* footer */}
        <div className="mt-5 flex items-center justify-between border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <span>Auto-detected: <span className="font-medium text-foreground">Pickup order</span></span>
          <span className="tabular-nums">ETA confirmed · 7:00 PM</span>
        </div>
      </div>

      {/* corner accent */}
      <div className="pointer-events-none absolute -right-3 -top-3 h-6 w-6 rounded-full bg-primary shadow-lg ring-4 ring-background" />
    </div>
  );
}
