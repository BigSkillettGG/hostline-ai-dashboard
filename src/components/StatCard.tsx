import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, delta, icon: Icon, format,
}: {
  label: string; value: number; delta: number; icon: LucideIcon; format?: "money" | "number";
}) {
  const positive = delta >= 0;
  const display = format === "money"
    ? value.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : value.toLocaleString();
  const deltaDisplay = format === "money"
    ? `${positive ? "+" : "−"}$${Math.abs(delta)}`
    : `${positive ? "+" : "−"}${Math.abs(delta)}`;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs font-medium text-muted-foreground">{label}</div>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{display}</div>
        <div className={cn(
          "mt-1 inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
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
