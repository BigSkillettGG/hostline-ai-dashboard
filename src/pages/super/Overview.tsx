import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenants } from "@/data/tenants";
import { Building2, PhoneCall, DollarSign, AlertTriangle, LucideIcon } from "lucide-react";

function MiniStat({ label, value, icon: Icon, tone = "default" }: { label: string; value: string; icon: LucideIcon; tone?: "default" | "warning" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className={`flex h-7 w-7 items-center justify-center rounded-md ${tone === "warning" ? "bg-warning/15 text-warning" : "bg-primary/10 text-primary"}`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default function SuperOverview() {
  const totalCalls = tenants.reduce((s, t) => s + t.callsThisMonth, 0);
  const mrr = tenants.reduce((s, t) => s + t.mrrCents, 0) / 100;
  const alerts = tenants.filter((t) => t.status !== "healthy").length;

  return (
    <>
      <PageHeader title="HostLine AI · Operations" description="Internal overview across all tenants" />
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Active tenants" value={tenants.length.toString()} icon={Building2} />
          <MiniStat label="Calls this month" value={totalCalls.toLocaleString()} icon={PhoneCall} />
          <MiniStat label="MRR" value={`$${mrr.toLocaleString()}`} icon={DollarSign} />
          <MiniStat label="Needs attention" value={alerts.toString()} icon={AlertTriangle} tone={alerts > 0 ? "warning" : "default"} />
        </div>

        <Card className="mt-5">
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent tenant activity</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-md border border-border">
              {tenants.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.plan} · {t.callsThisMonth.toLocaleString()} calls</div>
                  </div>
                  <Badge variant="outline" className={
                    t.status === "healthy" ? "border-success/30 bg-success/10 text-success"
                    : t.status === "attention" ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                  }>
                    {t.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
