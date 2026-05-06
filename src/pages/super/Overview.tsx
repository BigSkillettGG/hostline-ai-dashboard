import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  DollarSign,
  LucideIcon,
  PhoneCall,
  RefreshCw,
  ServerCog,
  XCircle,
} from "lucide-react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { tenants } from "@/data/tenants";
import { fetchVoiceServiceHealth, isVoiceServiceConfigured } from "@/lib/voice-service";

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
  const totalCalls = tenants.reduce((sum, tenant) => sum + tenant.callsThisMonth, 0);
  const mrr = tenants.reduce((sum, tenant) => sum + tenant.mrrCents, 0) / 100;
  const alerts = tenants.filter((tenant) => tenant.status !== "healthy").length;
  const voiceConfigured = isVoiceServiceConfigured();
  const healthQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: fetchVoiceServiceHealth,
    queryKey: ["voice-service-health"],
    refetchInterval: 60_000,
  });
  const readinessChecks = healthQuery.data?.readinessChecks ?? [];
  const missingRequired = readinessChecks.filter((check) => check.required && !check.ready).length;

  return (
    <>
      <PageHeader title="HostLine AI Operations" description="Internal overview across all tenants" />
      <PageBody>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MiniStat label="Active tenants" value={tenants.length.toString()} icon={Building2} />
          <MiniStat label="Calls this month" value={totalCalls.toLocaleString()} icon={PhoneCall} />
          <MiniStat label="MRR" value={`$${mrr.toLocaleString()}`} icon={DollarSign} />
          <MiniStat label="Needs attention" value={alerts.toString()} icon={AlertTriangle} tone={alerts > 0 ? "warning" : "default"} />
        </div>

        <Card className="mt-5">
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ServerCog className="h-4 w-4 text-primary" />
                Production readiness
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Voice service deployment, secrets, and webhook safety checks</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={
                  healthQuery.data?.productionReady
                    ? "border-success/30 bg-success/10 text-success"
                    : "border-warning/30 bg-warning/10 text-warning"
                }
              >
                {healthQuery.data?.productionReady ? "Production ready" : voiceConfigured ? `${missingRequired || "Several"} missing` : "Not connected"}
              </Badge>
              {voiceConfigured && (
                <Button variant="outline" size="sm" onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching}>
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
                  Check
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!voiceConfigured ? (
              <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
                Set VITE_VOICE_SERVICE_URL to monitor the deployed voice service.
              </div>
            ) : healthQuery.isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Voice service health check failed. {healthQuery.error instanceof Error ? healthQuery.error.message : ""}
              </div>
            ) : readinessChecks.length ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {readinessChecks.map((check) => (
                  <div key={check.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{check.label}</div>
                      {check.ready ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <XCircle className={check.required ? "h-4 w-4 text-warning" : "h-4 w-4 text-muted-foreground"} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                    {!check.required && <Badge variant="secondary" className="mt-2">Optional</Badge>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                Checking voice service readiness...
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-5">
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent tenant activity</CardTitle></CardHeader>
          <CardContent>
            <div className="divide-y divide-border rounded-md border border-border">
              {tenants.slice(0, 6).map((tenant) => (
                <div key={tenant.id} className="flex items-center justify-between p-3">
                  <div>
                    <div className="text-sm font-medium">{tenant.name}</div>
                    <div className="text-xs text-muted-foreground">{tenant.plan} - {tenant.callsThisMonth.toLocaleString()} calls</div>
                  </div>
                  <Badge variant="outline" className={
                    tenant.status === "healthy" ? "border-success/30 bg-success/10 text-success"
                    : tenant.status === "attention" ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-destructive/30 bg-destructive/10 text-destructive"
                  }>
                    {tenant.status}
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
