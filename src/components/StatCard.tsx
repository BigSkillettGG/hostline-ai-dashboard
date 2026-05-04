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

  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5",
      accent && "border-primary/30 bg-gradient-to-br from-primary/5 to-transparent"
    )}>
      <div className={cn(
        "absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent",
        accent && "via-primary/50"
      )} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            accent ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary/15"
          )}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-2.5 text-[26px] leading-none font-semibold tracking-tight tabular-nums">{display}</div>
        <div className={cn(
          "mt-2 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
          positive ? "text-success" : "text-destructive"
        )}>
          {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {deltaDisplay}
          <span className="ml-1 font-normal text-muted-foreground">vs yesterday</span>
        </div>
      </CardContent>
    </Card>
  );
}
