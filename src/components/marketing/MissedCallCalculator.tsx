import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, TrendingUp } from "lucide-react";

export function MissedCallCalculator() {
  const [missed, setMissed] = useState(35);    // missed calls / week
  const [ticket, setTicket] = useState(42);    // avg ticket $

  const { lostMonth, lostYear, recoveredMonth } = useMemo(() => {
    // assume 60% of missed callers would have ordered
    const ordersWeek = missed * 0.6;
    const lostMonth = Math.round(ordersWeek * ticket * 4.3);
    const lostYear = lostMonth * 12;
    const recoveredMonth = Math.round(lostMonth * 0.85); // Vera recovers ~85%
    return { lostMonth, lostYear, recoveredMonth };
  }, [missed, ticket]);

  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <Card className="overflow-hidden border-border/80 shadow-[0_1px_0_hsl(var(--border)),0_30px_60px_-30px_hsl(var(--foreground)/0.18)]">
      <div className="grid gap-0 md:grid-cols-5">
        {/* sliders */}
        <CardContent className="space-y-6 p-6 md:col-span-3 md:p-8">
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-sm font-medium">Missed calls per week</label>
              <span className="text-lg font-semibold tabular-nums">{missed}</span>
            </div>
            <Slider value={[missed]} onValueChange={([v]) => setMissed(v)} min={5} max={150} step={1} />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>5</span><span>150</span></div>
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label className="text-sm font-medium">Average ticket value</label>
              <span className="text-lg font-semibold tabular-nums">${ticket}</span>
            </div>
            <Slider value={[ticket]} onValueChange={([v]) => setTicket(v)} min={15} max={150} step={1} />
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>$15</span><span>$150</span></div>
          </div>

          <p className="text-xs text-muted-foreground">
            Based on industry data: ~60% of missed callers don't call back. SignalHost recovers ~85% of them.
          </p>
        </CardContent>

        {/* result */}
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:col-span-2 md:p-8">
          <div className="text-[11px] font-semibold uppercase text-muted-foreground">You're losing</div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
            <span className="text-3xl font-semibold tabular-nums text-foreground sm:text-4xl md:text-5xl">{fmt(lostMonth)}</span>
            <span className="text-sm text-muted-foreground">/ month</span>
          </div>
          <div className="mt-1 inline-flex items-center gap-1 text-xs text-destructive">
            <TrendingDown className="h-3 w-3 shrink-0" />
            <span>{fmt(lostYear)} per year in lost revenue</span>
          </div>

          <div className="mt-6 rounded-lg border border-primary/30 bg-background/70 p-4 backdrop-blur">
            <div className="text-[11px] font-semibold uppercase text-primary">With SignalHost</div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
              <span className="text-2xl font-semibold tabular-nums text-foreground">+{fmt(recoveredMonth)}</span>
              <span className="text-xs text-muted-foreground">recovered / mo</span>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-success">
              <TrendingUp className="h-3 w-3 shrink-0" />
              Pays for itself many times over
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
