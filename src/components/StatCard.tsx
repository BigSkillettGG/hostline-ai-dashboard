import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, delta, icon: Icon, format, accent = false,
}: {
  label: string; value: number; delta: number; icon: LucideIcon; format?: "money" | "number"; accent?: boolean;
}) {
  const positive = delta >= 0;
  const display = format === "money"
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : value.toLocaleString();
  const deltaDisplay = format === "money"
    ? `${positive ? "+" : "−"}$${Math.abs(delta).toLocaleString()}`
    : `${positive ? "+" : "−"}${Math.abs(delta)}`;
  const hasDelta = delta !== 0;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 bg-[image:var(--gradient-surface)] transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-[var(--shadow-elevated)]",
        accent && "border-primary/25 ring-1 ring-primary/10"
      )}
    >
      {/* top hairline accent */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent opacity-80",
          accent && "via-primary/60"
        )}
      />
      {/* subtle corner glow on accent */}
      {accent && (
        <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-primary/10 blur-2xl" />
      )}
      <CardContent className="relative p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-105",
              accent
                ? "bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-glow)]"
                : "bg-primary/10 text-primary group-hover:bg-primary/15"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-3 text-[28px] leading-none font-semibold tracking-tight tabular-nums">
          {display}
        </div>
        <div
          className={cn(
            "mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
            !hasDelta && "text-muted-foreground",
            hasDelta && positive && "text-success",
            hasDelta && !positive && "text-destructive"
          )}
        >
          {hasDelta ? (
            positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />
          ) : (
            <span className="h-1 w-1 rounded-full bg-muted-foreground/50" />
          )}
          {hasDelta ? deltaDisplay : "No change"}
          <span className="ml-1 font-normal text-muted-foreground">vs yesterday</span>
        </div>
      </CardContent>
    </Card>
  );
}
