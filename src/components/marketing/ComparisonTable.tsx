import { Check, Minus } from "lucide-react";
import { comparisonRows } from "@/data/marketing";
import { cn } from "@/lib/utils";

const COLS: { key: "hostline" | "voicemail" | "ivr" | "human"; label: string; highlight?: boolean }[] = [
  { key: "hostline",  label: "HostLine AI", highlight: true },
  { key: "voicemail", label: "Voicemail" },
  { key: "ivr",       label: "IVR menu" },
  { key: "human",     label: "Answering service" },
];

function renderValue(v: unknown) {
  if (typeof v === "boolean") {
    return v
      ? <Check className="mx-auto h-4 w-4 text-success" />
      : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />;
  }
  return <span className="tabular-nums text-foreground">{String(v)}</span>;
}

export function ComparisonTable() {
  return (
    <>
      {/* Mobile: stacked cards */}
      <div className="grid gap-3 md:hidden">
        {comparisonRows.map((row) => (
          <div key={row.label} className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="text-sm font-semibold">{row.label}</div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {COLS.map((c) => {
                const v = (row as any)[c.key];
                return (
                  <div
                    key={c.key}
                    className={cn(
                      "flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2",
                      c.highlight && "border-primary/40 bg-primary/5",
                    )}
                  >
                    <span className={cn("text-muted-foreground", c.highlight && "text-primary")}>{c.label}</span>
                    <span className="ml-2 flex items-center">{renderValue(v)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Tablet/Desktop: full table */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card shadow-sm md:block">
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
                        {renderValue(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
