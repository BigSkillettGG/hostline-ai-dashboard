import { Check, Minus } from "lucide-react";
import { comparisonRows } from "@/data/marketing";
import { cn } from "@/lib/utils";

const COLS = [
  { key: "hostline",  label: "HostLine AI", highlight: true },
  { key: "voicemail", label: "Voicemail" },
  { key: "ivr",       label: "IVR menu" },
  { key: "human",     label: "Answering service" },
] as const;

export function ComparisonTable() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-5 py-3 font-semibold"> </th>
              {COLS.map((c) => (
                <th key={c.key} className={cn(
                  "px-5 py-3 text-center font-semibold",
                  c.highlight && "bg-primary/10 text-primary"
                )}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {comparisonRows.map((row, i) => (
              <tr key={row.label} className={cn("border-b border-border/60 last:border-0", i % 2 === 1 && "bg-muted/15")}>
                <td className="px-5 py-3 font-medium">{row.label}</td>
                {COLS.map((c) => {
                  const v = (row as any)[c.key];
                  return (
                    <td key={c.key} className={cn("px-5 py-3 text-center", c.highlight && "bg-primary/5")}>
                      {typeof v === "boolean"
                        ? (v ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />)
                        : <span className="tabular-nums text-foreground">{v}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
