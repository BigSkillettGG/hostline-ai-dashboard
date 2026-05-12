import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { integrations } from "@/data/mock";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Plug, AlertTriangle, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const statusMap = {
  connected: { label: "Connected", cls: "bg-success/15 text-success border-success/20", icon: Check, action: "Manage" },
  not_connected: { label: "Not connected", cls: "bg-muted text-muted-foreground border-border", icon: Plus, action: "Connect" },
  needs_attention: { label: "Needs attention", cls: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle, action: "Fix" },
};

export default function Integrations() {
  const [open, setOpen] = useState<typeof integrations[number] | null>(null);
  const grouped = integrations.reduce<Record<string, typeof integrations>>((acc, i) => {
    (acc[i.category] ||= [] as any).push(i);
    return acc;
  }, {});
  const openRequiredEnv = open && "requiredEnv" in open ? open.requiredEnv : [];
  const openStatus = open ? statusMap[open.status] : null;
  const OpenStatusIcon = openStatus?.icon;

  return (
    <>
      <PageHeader
        title="Integrations"
        description="Connect SignalHost to the tools you already use"
      />
      <PageBody className="space-y-6">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {list.map(i => {
                const s = statusMap[i.status];
                const Icon = s.icon;
                return (
                  <Card key={i.id} className="p-4 hover:shadow-sm transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-foreground/70 font-semibold">
                        {i.name.slice(0, 2).toUpperCase()}
                      </div>
                      <Badge variant="outline" className={cn("gap-1", s.cls)}>
                        <Icon className="h-3 w-3" />{s.label}
                      </Badge>
                    </div>
                    <div className="mt-3">
                      <div className="text-sm font-semibold">{i.name}</div>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{i.desc}</p>
                    </div>
                    <Button
                      variant={i.status === "connected" ? "outline" : "default"}
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => setOpen(i)}
                    >
                      {s.action}
                    </Button>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </PageBody>

      <Dialog open={!!open} onOpenChange={o => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plug className="h-4 w-4" />{open?.name} setup</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <ol className="space-y-3">
              {["Add credentials", "Map fields", "Run test", "Enable live sync"].map((step, i) => (
                <li key={step} className="flex items-center gap-3">
                  <div className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    i === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>{i + 1}</div>
                  <div className="text-sm">{step}</div>
                </li>
              ))}
            </ol>
            {openStatus && (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current status</div>
                <div className="mt-1 flex items-center gap-2 text-sm">
                  <Badge variant="outline" className={cn("gap-1", openStatus.cls)}>
                    {OpenStatusIcon && <OpenStatusIcon className="h-3 w-3" />}{openStatus.label}
                  </Badge>
                  <span className="text-muted-foreground">{open?.desc}</span>
                </div>
              </div>
            )}
            {openRequiredEnv.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Credential keys</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {openRequiredEnv.map((key) => (
                    <Badge key={key} variant="secondary" className="font-mono text-[11px]">{key}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(null)}>Cancel</Button>
              <Button onClick={() => setOpen(null)}><Plus className="mr-2 h-4 w-4" />Continue</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
