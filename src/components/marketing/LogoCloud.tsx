import { integrations } from "@/data/marketing";

export function LogoCloud() {
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-6">
      {integrations.map((name) => (
        <div
          key={name}
          className="flex h-16 items-center justify-center bg-card text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          {name}
        </div>
      ))}
    </div>
  );
}
