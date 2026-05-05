import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tenants } from "@/data/tenants";
import { Building2, PhoneCall, DollarSign, AlertTriangle } from "lucide-react";
import StatCard from "@/components/StatCard";

export default function SuperOverview() {
  const totalCalls = tenants.reduce((s, t) => s + t.callsThisMonth, 0);
  const mrr = tenants.reduce((s, t) => s + t.mrrCents, 0) / 100;
  const alerts = tenants.filter((t) => t.status !== "healthy").length;

  return (
    <>
      <PageHeader title="HostLine AI · Operations" description="Internal overview across all tenants" />
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active tenants" value={tenants.length.toString()} icon={Building2} />
          <StatCard label="Calls this month" value={totalCalls.toLocaleString()} icon={PhoneCall} delta={{ value: "+12%", positive: true }} />
          <StatCard label="MRR" value={`$${mrr.toLocaleString()}`} icon={DollarSign} delta={{ value: "+8%", positive: true }} />
          <StatCard label="Tenants needing attention" value={alerts.toString()} icon={AlertTriangle} tone={alerts > 0 ? "warning" : "default"} />
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
