import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Copy, CreditCard, DollarSign, FileText, RefreshCw, Search, TimerReset } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { tenants } from "@/data/tenants";
import {
  mapDirectoryTenantToBillingTenant,
  mapMockTenantToBillingTenant,
  summarizePlatformBilling,
  type PlatformBillingTenant,
  type PlatformBillingTrialStatus,
  type PlatformBillingUsageStatus,
} from "@/domain/platform-billing";
import { fetchTenantDirectoryFromSupabase, isSupabaseConfigured } from "@/lib/supabase-rest";
import { cn } from "@/lib/utils";

export default function SuperBilling() {
  const [query, setQuery] = useState("");
  const supabaseConfigured = isSupabaseConfigured();
  const tenantQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["super-billing-tenant-directory"],
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => {
    if (tenantQuery.data?.length) return tenantQuery.data.map((tenant) => mapDirectoryTenantToBillingTenant(tenant));
    return tenants.map((tenant) => mapMockTenantToBillingTenant(tenant));
  }, [tenantQuery.data]);
  const summary = useMemo(() => summarizePlatformBilling(rows), [rows]);
  const filtered = rows.filter((tenant) =>
    [
      tenant.businessLabel,
      tenant.locationId,
      tenant.name,
      tenant.ownerEmail,
      tenant.planName,
      tenant.usageStatus,
      tenant.trialStatus,
    ].some((value) => value.toLowerCase().includes(query.toLowerCase())),
  );

  return (
    <>
      <PageHeader
        title="Billing"
        description="Revenue, plan usage, overage pressure, and trial-number cleanup risk"
        actions={
          supabaseConfigured ? (
            <Button variant="outline" size="sm" onClick={() => void tenantQuery.refetch()} disabled={tenantQuery.isFetching}>
              <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", tenantQuery.isFetching && "animate-spin")} />
              Refresh
            </Button>
          ) : null
        }
      />
      <PageBody className="space-y-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard icon={DollarSign} label="MRR" value={formatDollars(summary.mrr)} detail={`${summary.tenantCount} tenants`} />
          <MetricCard icon={CreditCard} label="ARR run-rate" value={formatDollars(summary.arr)} detail={summary.liveCount ? `${summary.liveCount} live tenants` : "Demo tenant data"} />
          <MetricCard icon={AlertTriangle} label="Over plan" value={String(summary.overPlanCount)} detail={`${formatMoney(summary.estimatedOverageCents)} estimated overage`} tone={summary.overPlanCount ? "danger" : "success"} />
          <MetricCard icon={TimerReset} label="Cleanup risk" value={String(summary.cleanupRiskCount)} detail="Trial numbers in grace or release due" tone={summary.cleanupRiskCount ? "warning" : "success"} />
          <MetricCard icon={AlertTriangle} label="Setup critical" value={String(summary.criticalSetupCount)} detail="Tenants blocking launch" tone={summary.criticalSetupCount ? "danger" : "success"} />
        </div>

        {tenantQuery.isError ? (
          <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Could not load live tenant billing data. Showing demo rows. {tenantQuery.error instanceof Error ? tenantQuery.error.message : ""}
          </div>
        ) : null}

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle className="text-base">Tenant billing operations</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Use this to catch overage surprises, expired trial numbers, and tenants that need billing or setup attention.
                </p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 pl-8"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tenant, plan, status..."
                  value={query}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Business</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                    <th className="px-4 py-2.5 text-left font-medium">Usage</th>
                    <th className="px-4 py-2.5 text-right font-medium">Overage</th>
                    <th className="px-4 py-2.5 text-left font-medium">Trial number</th>
                    <th className="px-4 py-2.5 text-right font-medium">MRR</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((tenant) => (
                    <BillingTenantRow key={`${tenant.source}-${tenant.id}`} tenant={tenant} />
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length ? (
              <div className="p-8 text-center text-sm text-muted-foreground">No tenants match that billing search.</div>
            ) : null}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function BillingTenantRow({ tenant }: { tenant: PlatformBillingTenant }) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="font-medium">{tenant.name}</div>
        <div className="text-xs text-muted-foreground">{tenant.businessLabel} · {tenant.ownerEmail}</div>
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{tenant.locationId}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline">{tenant.planName}</Badge>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{tenant.source === "live" ? "Live" : "Demo"}</span>
          {tenant.billingStatus ? (
            <Badge variant="outline" className={billingStatusBadgeClass(tenant.billingStatus)}>
              {billingStatusLabel(tenant.billingStatus)}
            </Badge>
          ) : null}
        </div>
      </td>
      <td className="min-w-52 px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between gap-3">
          <Badge variant="outline" className={usageBadgeClass(tenant.usageStatus)}>{usageLabel(tenant.usageStatus)}</Badge>
          <span className="text-xs tabular-nums text-muted-foreground">
            {tenant.callsThisMonth.toLocaleString()} / {tenant.includedInteractions.toLocaleString()}
          </span>
        </div>
        <Progress value={tenant.usagePercent} />
      </td>
      <td className={cn("px-4 py-3 text-right tabular-nums", tenant.overageInteractions ? "font-medium text-destructive" : "text-muted-foreground")}>
        <div>{tenant.overageInteractions.toLocaleString()}</div>
        <div className="text-xs">{formatMoney(tenant.estimatedOverageCents)}</div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={trialBadgeClass(tenant.trialStatus)}>{trialLabel(tenant.trialStatus)}</Badge>
        <div className="mt-1 text-xs text-muted-foreground">
          {tenant.aiHostPhone ?? "No SignalHost number"}
          {tenant.trialGraceEndsAt ? ` · cleanup ${formatDate(tenant.trialGraceEndsAt)}` : ""}
        </div>
      </td>
      <td className="px-4 py-3 text-right font-medium tabular-nums">{formatDollars(tenant.monthlyPrice)}</td>
      <td className="px-4 py-3 text-right">
        <div className="flex justify-end gap-2">
          {tenant.source === "live" && tenant.locationId !== "not-created" ? (
            <Button size="sm" variant="outline" asChild>
              <Link to={`/super/tenants/${tenant.locationId}`}>
                <FileText className="mr-1.5 h-3.5 w-3.5" />
                Details
              </Link>
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(tenant.locationId);
              toast.success(`Copied location ID for ${tenant.name}`);
            }}
          >
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            Copy ID
          </Button>
        </div>
      </td>
    </tr>
  );
}

function MetricCard({
  detail,
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  detail: string;
  icon: typeof DollarSign;
  label: string;
  tone?: "danger" | "default" | "success" | "warning";
  value: string;
}) {
  const iconClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : tone === "danger"
          ? "bg-destructive/10 text-destructive"
          : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md", iconClass)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function usageLabel(status: PlatformBillingUsageStatus) {
  if (status === "over_limit") return "Over plan";
  if (status === "near_limit") return "Near limit";
  if (status === "not_configured") return "No plan";
  return "On track";
}

function usageBadgeClass(status: PlatformBillingUsageStatus) {
  if (status === "over_limit") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "near_limit") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "not_configured") return "bg-muted text-muted-foreground";
  return "border-success/30 bg-success/10 text-success";
}

function billingStatusLabel(status: string) {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  if (normalized === "active") return "Paid";
  if (normalized === "trialing") return "Stripe trial";
  if (normalized === "past due") return "Past due";
  if (normalized === "checkout started") return "Checkout";
  if (normalized === "canceled") return "Canceled";
  return normalized;
}

function billingStatusBadgeClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === "active" || normalized === "trialing") return "border-success/30 bg-success/10 text-success";
  if (normalized === "past_due" || normalized === "unpaid") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (normalized === "checkout_started" || normalized === "incomplete") return "border-warning/30 bg-warning/10 text-warning";
  return "bg-muted text-muted-foreground";
}

function trialLabel(status: PlatformBillingTrialStatus) {
  if (status === "release_due") return "Release due";
  if (status === "grace_period") return "Grace";
  if (status === "trialing") return "Trial";
  if (status === "released") return "Released";
  if (status === "no_number") return "No number";
  if (status === "no_dates") return "No dates";
  return "Active";
}

function trialBadgeClass(status: PlatformBillingTrialStatus) {
  if (status === "release_due") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (status === "grace_period") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "trialing" || status === "active") return "border-success/30 bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
}

function formatDollars(value: number) {
  return new Intl.NumberFormat([], {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat([], {
    currency: "USD",
    maximumFractionDigits: 2,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "invalid date";
  return date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
  });
}
