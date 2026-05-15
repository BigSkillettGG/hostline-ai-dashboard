import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { Building2, ExternalLink, FileText, RefreshCw, Search } from "lucide-react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { tenants, type Tenant } from "@/data/tenants";
import {
  fetchTenantDirectoryFromSupabase,
  isSupabaseConfigured,
  type TenantDirectoryRecord,
  type TenantDirectoryStatus,
} from "@/lib/supabase-rest";
import { startDemoSession, updateCurrentUserAccess } from "@/lib/auth";
import { toast } from "sonner";

interface TenantTableRow {
  addressOrArea: string;
  aiNumber: string;
  businessLabel: string;
  callsThisMonth: number;
  id: string;
  includedInteractions: number;
  locationId: string;
  monthlyPrice: number;
  name: string;
  onboardingProgressPercent: number;
  onboardingStatus: string;
  organizationId: string;
  ownerEmail: string;
  planName: string;
  source: "demo" | "live";
  status: TenantDirectoryStatus;
  websiteDemoPath?: string;
}

export default function SuperTenants() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const supabaseConfigured = isSupabaseConfigured();
  const tenantQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory"],
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => {
    if (tenantQuery.data?.length) return tenantQuery.data.map(mapDirectoryTenant);
    return tenants.map(mapMockTenant);
  }, [tenantQuery.data]);
  const filtered = rows.filter((tenant) =>
    [
      tenant.name,
      tenant.addressOrArea,
      tenant.businessLabel,
      tenant.locationId,
      tenant.organizationId,
      tenant.ownerEmail,
      tenant.planName,
    ].some((value) => value.toLowerCase().includes(q.toLowerCase())),
  );
  const liveRows = rows.filter((tenant) => tenant.source === "live").length;
  const needsAttention = rows.filter((tenant) => tenant.status !== "healthy").length;

  function viewAsTenant(tenant: TenantTableRow) {
    if (tenant.source === "demo") {
      startDemoSession("admin", tenant.id);
      toast.success(`Opening ${tenant.name}'s demo workspace`);
      navigate("/app");
      return;
    }

    if (tenant.source !== "live" || tenant.locationId === "not-created") {
      toast.error("Only live tenants with a Supabase location can be opened.");
      return;
    }

    updateCurrentUserAccess({
      activeLocationId: tenant.locationId,
      activeOrganizationId: tenant.organizationId,
    });
    toast.success(`Viewing ${tenant.name} as SignalHost staff`);
    navigate("/app");
  }

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Live organizations, locations, onboarding state, and phone provisioning"
        actions={
          supabaseConfigured ? (
            <Button variant="outline" size="sm" onClick={() => void tenantQuery.refetch()} disabled={tenantQuery.isFetching}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${tenantQuery.isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          ) : null
        }
      />
      <PageBody>
        <div className="mb-4 grid gap-3 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Directory source</div>
                  <div className="mt-1 text-2xl font-semibold">{liveRows ? "Live" : "Demo"}</div>
                </div>
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {liveRows ? `${liveRows} Supabase location${liveRows === 1 ? "" : "s"} loaded` : "Using sample tenant data"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Visible tenants</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</div>
              <p className="mt-1 text-xs text-muted-foreground">Organizations and first-class locations</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs font-medium text-muted-foreground">Needs attention</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{needsAttention}</div>
              <p className="mt-1 text-xs text-muted-foreground">Missing number, early onboarding, or critical setup</p>
            </CardContent>
          </Card>
        </div>

        {tenantQuery.isError && (
          <div className="mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
            Could not load live tenants. Showing demo rows. {tenantQuery.error instanceof Error ? tenantQuery.error.message : ""}
          </div>
        )}

        <div className="mb-3 flex items-center gap-2">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search business, owner, vertical, location ID..."
              className="h-9 pl-8"
            />
          </div>
        </div>
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-medium">Business</th>
                    <th className="px-4 py-2.5 text-left font-medium">Vertical</th>
                    <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                    <th className="px-4 py-2.5 text-right font-medium">Usage</th>
                    <th className="px-4 py-2.5 text-left font-medium">SignalHost number</th>
                    <th className="px-4 py-2.5 text-left font-medium">Onboarding</th>
                    <th className="px-4 py-2.5 text-left font-medium">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{tenant.name}</div>
                        <div className="text-xs text-muted-foreground">{tenant.addressOrArea}</div>
                        <div className="mt-1 font-mono text-[10px] text-muted-foreground">loc {tenant.locationId}</div>
                      </td>
                      <td className="px-4 py-3">{tenant.businessLabel}</td>
                      <td className="px-4 py-3">
                        <div>{tenant.planName}</div>
                        <div className="text-xs text-muted-foreground">${tenant.monthlyPrice}/mo</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {tenant.callsThisMonth.toLocaleString()} / {tenant.includedInteractions.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{tenant.aiNumber}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium tabular-nums">{tenant.onboardingProgressPercent}%</div>
                        <div className="text-xs text-muted-foreground">{formatStatusText(tenant.onboardingStatus)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={statusBadgeClass(tenant.status)}>{tenant.status}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {tenant.source === "live" && tenant.locationId !== "not-created" ? (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={`/super/tenants/${tenant.locationId}`}>
                                <FileText className="mr-1.5 h-3.5 w-3.5" />
                                Details
                              </Link>
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" disabled>
                              <FileText className="mr-1.5 h-3.5 w-3.5" />
                              Details
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              void navigator.clipboard?.writeText(tenant.locationId);
                              toast.success(`Copied location ID for ${tenant.name}`);
                            }}
                          >
                            Copy ID
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => viewAsTenant(tenant)}
                            disabled={tenant.source === "live" && tenant.locationId === "not-created"}
                          >
                            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                            App
                          </Button>
                          {tenant.websiteDemoPath && (
                            <Button size="sm" variant="outline" asChild>
                              <Link to={tenant.websiteDemoPath} target="_blank">
                                Site
                              </Link>
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function mapDirectoryTenant(tenant: TenantDirectoryRecord): TenantTableRow {
  return {
    addressOrArea: tenant.addressOrArea,
    aiNumber: tenant.aiHostPhone ?? "Not provisioned",
    businessLabel: tenant.businessLabel,
    callsThisMonth: tenant.callsThisMonth,
    id: tenant.locationId,
    includedInteractions: tenant.includedInteractions,
    locationId: tenant.locationId,
    monthlyPrice: tenant.monthlyPrice,
    name: tenant.locationName,
    onboardingProgressPercent: tenant.onboardingProgressPercent,
    onboardingStatus: tenant.onboardingStatus,
    organizationId: tenant.organizationId,
    ownerEmail: tenant.ownerEmail,
    planName: tenant.planName,
    source: "live",
    status: tenant.status,
    websiteDemoPath: undefined,
  };
}

function mapMockTenant(tenant: Tenant): TenantTableRow {
  return {
    addressOrArea: tenant.city,
    aiNumber: tenant.aiNumber,
    businessLabel: tenant.businessLabel ?? "Restaurant",
    callsThisMonth: tenant.callsThisMonth,
    id: tenant.id,
    includedInteractions: tenant.includedCalls,
    locationId: tenant.locationId ?? tenant.id,
    monthlyPrice: tenant.mrrCents / 100,
    name: tenant.name,
    onboardingProgressPercent: tenant.status === "critical" ? 35 : tenant.status === "attention" ? 78 : 100,
    onboardingStatus: tenant.status === "healthy" ? "ready_for_test_call" : "needs_attention",
    organizationId: tenant.organizationId ?? tenant.id,
    ownerEmail: tenant.ownerEmail,
    planName: tenant.plan,
    source: "demo",
    status: tenant.status,
    websiteDemoPath: tenant.websiteDemoPath,
  };
}

function statusBadgeClass(status: TenantDirectoryStatus) {
  if (status === "healthy") return "border-success/30 bg-success/10 text-success";
  if (status === "attention") return "border-warning/30 bg-warning/10 text-warning";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function formatStatusText(value: string) {
  return value.replace(/_/g, " ");
}
