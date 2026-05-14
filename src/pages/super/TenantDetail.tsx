import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CalendarDays,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  type LucideIcon,
  Phone,
  PhoneCall,
  RefreshCw,
  ServerCog,
  Settings2,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { defaultRestaurantAgentConfig } from "@/domain/restaurant-config";
import type { Call } from "@/data/mock";
import {
  fetchAgentConfigFromSupabase,
  fetchCallsFromSupabase,
  fetchOnboardingProfileFromSupabase,
  fetchOrdersFromSupabase,
  fetchPhoneNumbersFromSupabase,
  fetchReservationsFromSupabase,
  fetchStaffAlertEventsFromSupabase,
  fetchStaffTasksFromSupabase,
  fetchTenantDirectoryFromSupabase,
  isSupabaseConfigured,
  type PhoneNumberRecord,
  type TenantDirectoryRecord,
  type TenantDirectoryStatus,
} from "@/lib/supabase-rest";
import { fetchVoiceServiceHealth, isVoiceServiceConfigured } from "@/lib/voice-service";
import { updateCurrentUserAccess } from "@/lib/auth";
import { formatDuration, formatMoney, formatTime } from "@/lib/format";
import { toast } from "sonner";

function MiniStat({
  icon: Icon,
  label,
  tone = "default",
  value,
}: {
  icon: LucideIcon;
  label: string;
  tone?: "default" | "warning" | "success";
  value: string;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warning/15 text-warning"
        : "bg-primary/10 text-primary";

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
          </div>
          <div className={`flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const emptyPhones: PhoneNumberRecord[] = [];

export default function TenantDetail() {
  const { locationId = "" } = useParams();
  const navigate = useNavigate();
  const supabaseConfigured = isSupabaseConfigured();
  const enabled = supabaseConfigured && Boolean(locationId);
  const voiceConfigured = isVoiceServiceConfigured();

  const tenantQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory"],
    refetchInterval: 60_000,
  });
  const callsQuery = useQuery({
    enabled,
    queryFn: () => fetchCallsFromSupabase(locationId),
    queryKey: ["tenant-detail", "calls", locationId],
    refetchInterval: 30_000,
  });
  const ordersQuery = useQuery({
    enabled,
    queryFn: () => fetchOrdersFromSupabase(locationId),
    queryKey: ["tenant-detail", "orders", locationId],
    refetchInterval: 30_000,
  });
  const reservationsQuery = useQuery({
    enabled,
    queryFn: () => fetchReservationsFromSupabase(locationId),
    queryKey: ["tenant-detail", "reservations", locationId],
    refetchInterval: 30_000,
  });
  const tasksQuery = useQuery({
    enabled,
    queryFn: () => fetchStaffTasksFromSupabase(locationId),
    queryKey: ["tenant-detail", "tasks", locationId],
    refetchInterval: 30_000,
  });
  const alertsQuery = useQuery({
    enabled,
    queryFn: () => fetchStaffAlertEventsFromSupabase(locationId),
    queryKey: ["tenant-detail", "alerts", locationId],
    refetchInterval: 30_000,
  });
  const phoneQuery = useQuery({
    enabled,
    queryFn: () => fetchPhoneNumbersFromSupabase(locationId),
    queryKey: ["tenant-detail", "phones", locationId],
    refetchInterval: 60_000,
  });
  const agentConfigQuery = useQuery({
    enabled,
    queryFn: () => fetchAgentConfigFromSupabase(defaultRestaurantAgentConfig, locationId),
    queryKey: ["tenant-detail", "agent-config", locationId],
    refetchInterval: 60_000,
  });
  const onboardingQuery = useQuery({
    enabled,
    queryFn: () => fetchOnboardingProfileFromSupabase(locationId),
    queryKey: ["tenant-detail", "onboarding", locationId],
    refetchInterval: 60_000,
  });
  const healthQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: fetchVoiceServiceHealth,
    queryKey: ["voice-service-health"],
    refetchInterval: 60_000,
  });

  const tenant = tenantQuery.data?.find((record) => record.locationId === locationId);
  const calls = callsQuery.data ?? [];
  const orders = ordersQuery.data ?? [];
  const reservations = reservationsQuery.data ?? [];
  const tasks = tasksQuery.data ?? [];
  const alerts = alertsQuery.data ?? [];
  const phones = phoneQuery.data ?? emptyPhones;
  const agentConfig = agentConfigQuery.data;
  const onboardingDraft = onboardingQuery.data;
  const activeTasks = tasks.filter((task) => task.status === "open" || task.status === "in_progress");
  const failedAlerts = alerts.filter((alert) => alert.status === "failed");
  const needsReviewCalls = calls.filter((call) => call.status === "needs_review" || call.confidence < 60);
  const recentOrders = orders.filter((order) => isWithinLastHours(order.createdAt, 24));
  const recentReservations = reservations.filter((reservation) =>
    reservation.createdAt ? isWithinLastHours(reservation.createdAt, 24) : false,
  );
  const orderValue = recentOrders.reduce((sum, order) => sum + order.total, 0);
  const latestCall = calls[0];
  const setupChecks = useMemo(
    () => buildSetupChecks({ healthReady: healthQuery.data?.productionReady, latestCall, phones, tenant }),
    [healthQuery.data?.productionReady, latestCall, phones, tenant],
  );
  const hasLoadError =
    tenantQuery.isError ||
    callsQuery.isError ||
    ordersQuery.isError ||
    reservationsQuery.isError ||
    tasksQuery.isError ||
    alertsQuery.isError ||
    phoneQuery.isError ||
    agentConfigQuery.isError ||
    onboardingQuery.isError;

  function copyLocationId() {
    void navigator.clipboard?.writeText(locationId);
    toast.success("Location ID copied");
  }

  function viewAsTenant() {
    if (!tenant) return;
    updateCurrentUserAccess({
      activeLocationId: tenant.locationId,
      activeOrganizationId: tenant.organizationId,
    });
    toast.success(`Viewing ${tenant.locationName} as SignalHost staff`);
    navigate("/app");
  }

  return (
    <>
      <PageHeader
        title={tenant?.locationName ?? "Tenant command center"}
        description={tenant ? `${tenant.businessLabel} customer operations, setup, and live call history` : locationId}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/super/tenants">
                <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                Tenants
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={copyLocationId}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Copy ID
            </Button>
            <Button size="sm" onClick={viewAsTenant} disabled={!tenant}>
              View owner app
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        }
      />
      <PageBody className="space-y-5">
        {!supabaseConfigured && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-warning">
            Supabase is not configured in this dashboard build, so live tenant details cannot load.
          </Card>
        )}

        {hasLoadError && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            Some tenant data could not load. Refresh after checking Supabase RLS and the platform admin session.
          </Card>
        )}

        {tenantQuery.isSuccess && !tenant && (
          <Card className="border-dashed p-8 text-center">
            <BuildingFallback locationId={locationId} />
          </Card>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <MiniStat label="Calls loaded" value={calls.length.toLocaleString()} icon={PhoneCall} />
          <MiniStat label="Open staff items" value={activeTasks.length.toLocaleString()} icon={AlertTriangle} tone={activeTasks.length ? "warning" : "success"} />
          <MiniStat label="24h orders" value={recentOrders.length.toLocaleString()} icon={ShoppingBag} />
          <MiniStat label="24h order value" value={formatMoney(orderValue)} icon={ShoppingBag} />
          <MiniStat label="Reservation requests" value={recentReservations.length.toLocaleString()} icon={CalendarDays} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2Icon />
                Tenant profile
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <Fact label="Business" value={tenant?.locationName ?? "Loading..."} />
              <Fact label="Vertical" value={tenant?.businessLabel ?? "Loading..."} />
              <Fact label="Owner" value={tenant ? `${tenant.ownerName} - ${tenant.ownerEmail}` : "Loading..."} />
              <Fact label="Plan" value={tenant ? `${tenant.planName} - $${tenant.monthlyPrice}/mo` : "Loading..."} />
              <Fact label="Main phone" value={tenant?.mainPhone ?? "Not set"} />
              <Fact label="SignalHost phone" value={tenant?.aiHostPhone ?? "Not provisioned"} />
              <Fact label="Timezone" value={tenant?.timezone ?? "Unknown"} />
              <Fact label="Location ID" value={locationId} mono />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ServerCog className="h-4 w-4 text-primary" />
                  Setup checklist
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">The quick "can this customer run live calls?" view.</p>
              </div>
              <Badge variant="outline" className={statusBadgeClass(tenant?.status)}>
                {tenant?.status ?? "loading"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              {setupChecks.map((check) => (
                <div key={check.label} className="flex items-start gap-2 rounded-md border border-border p-2.5">
                  {check.ready ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{check.label}</div>
                    <div className="text-xs text-muted-foreground">{check.detail}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PhoneCall className="h-4 w-4 text-primary" />
                  Recent calls and transcripts
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Latest persisted calls for this specific location.</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/super/calls">All calls</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {callsQuery.isLoading ? (
                <EmptyState text="Loading live calls..." />
              ) : calls.length === 0 ? (
                <EmptyState text="No calls have been recorded for this tenant yet." />
              ) : (
                <div className="divide-y divide-border rounded-md border border-border">
                  {calls.slice(0, 6).map((call) => (
                    <CallRow key={call.id} call={call} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Attention queue
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Open tasks, failed alerts, and low-confidence calls.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <AttentionGroup
                empty="No open staff tasks."
                items={activeTasks.slice(0, 4).map((task) => ({
                  detail: `${task.priority} priority - ${formatTime(task.createdAt)}`,
                  id: task.id,
                  label: task.title,
                }))}
                title="Tasks"
              />
              <AttentionGroup
                empty="No failed alerts."
                items={failedAlerts.slice(0, 4).map((alert) => ({
                  detail: alert.errorMessage || alert.summary,
                  id: alert.id,
                  label: `${alert.kind} alert failed`,
                }))}
                title="Alert failures"
              />
              <AttentionGroup
                empty="No low-confidence calls."
                items={needsReviewCalls.slice(0, 4).map((call) => ({
                  detail: `${call.intent} - ${call.confidence}% - ${formatTime(call.time)}`,
                  id: call.id,
                  label: call.summary,
                }))}
                title="Needs review"
              />
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-primary" />
                Phone provisioning
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {phones.length === 0 ? (
                <EmptyState text="No SignalHost phone number has been provisioned." />
              ) : (
                phones.map((phone) => (
                  <div key={phone.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-mono text-sm font-medium">{phone.phoneNumber}</div>
                      <Badge variant="outline" className={phone.forwardingStatus === "verified" ? "border-success/30 bg-success/10 text-success" : "border-warning/30 bg-warning/10 text-warning"}>
                        {phone.forwardingStatus.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground">
                      <span>Main line: {phone.restaurantMainLine ?? tenant?.mainPhone ?? "Not set"}</span>
                      <span>Webhook: {phone.voiceWebhookUrl ?? tenant?.voiceWebhookUrl ?? "Not set"}</span>
                      <span>Updated: {phone.updatedAt ? formatTime(phone.updatedAt) : "Unknown"}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="h-4 w-4 text-primary" />
                Agent configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Fact label="Host" value={agentConfig?.hostName ?? "Not configured"} />
              <Fact label="Tone" value={agentConfig?.tone ?? "Not configured"} />
              <Fact label="Call mode" value={agentConfig?.callHandlingMode?.replace(/_/g, " ") ?? "Not configured"} />
              <Fact label="Orders" value={agentConfig?.orders.enabled ? "Enabled" : "Disabled or unset"} />
              <Fact label="Reservations" value={agentConfig?.capabilities.handleReservations ? `${agentConfig.reservations.mode.replace(/_/g, " ")}` : "Disabled or unset"} />
              <Fact label="Escalation phone" value={agentConfig?.escalationPhoneNumber ?? "Not set"} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-primary" />
                Onboarding snapshot
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Fact label="Progress" value={tenant ? `${tenant.onboardingProgressPercent}% - ${tenant.onboardingStatus.replace(/_/g, " ")}` : "Loading..."} />
              <Fact label="Business name" value={readDraftText(onboardingDraft, "restaurantName") ?? tenant?.locationName ?? "Not set"} />
              <Fact label="Primary location" value={readDraftText(onboardingDraft, "primaryLocation") ?? tenant?.addressOrArea ?? "Not set"} />
              <Fact label="Business type" value={readDraftText(onboardingDraft, "businessType") ?? tenant?.businessLabel ?? "Not set"} />
              <Fact label="Reservation link" value={readDraftText(onboardingDraft, "reservationLink") ?? "Not set"} />
              <Fact label="Ordering link" value={readDraftText(onboardingDraft, "onlineOrderingLink") ?? "Not set"} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 className="h-4 w-4 text-primary" />
                Voice service health
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Global runtime health. Useful before blaming tenant setup.</p>
            </div>
            {voiceConfigured && (
              <Button variant="outline" size="sm" onClick={() => void healthQuery.refetch()} disabled={healthQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${healthQuery.isFetching ? "animate-spin" : ""}`} />
                Check
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!voiceConfigured ? (
              <EmptyState text="Set VITE_VOICE_SERVICE_URL to monitor voice service health here." />
            ) : healthQuery.isError ? (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Health check failed. {healthQuery.error instanceof Error ? healthQuery.error.message : ""}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {(healthQuery.data?.readinessChecks ?? []).slice(0, 9).map((check) => (
                  <div key={check.id} className="rounded-md border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium">{check.label}</div>
                      {check.ready ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-warning" />}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                  </div>
                ))}
                {!healthQuery.data?.readinessChecks?.length && <EmptyState text="Checking health..." />}
              </div>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function CallRow({ call }: { call: Call }) {
  const transcriptPreview = call.transcript
    .slice(0, 2)
    .map((turn) => `${turn.speaker === "agent" ? "SignalHost" : "Caller"}: ${turn.text}`)
    .join(" ");

  return (
    <div className="grid gap-3 p-3 md:grid-cols-[1fr_auto] md:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium">{call.caller}</div>
          <div className="font-mono text-xs text-muted-foreground">{call.phone}</div>
          <Badge variant="outline" className={intentBadgeClass(call.intent)}>{call.intent}</Badge>
          <Badge variant="outline" className={call.status === "needs_review" ? "border-warning/30 bg-warning/10 text-warning" : "border-success/30 bg-success/10 text-success"}>
            {call.status.replace(/_/g, " ")}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{call.summary}</p>
        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
          {transcriptPreview || "Transcript not available yet."}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <div className="text-xs text-muted-foreground tabular-nums">{formatTime(call.time)} - {formatDuration(call.duration)}</div>
        {call.recordingUrl && (
          <Button variant="outline" size="sm" asChild>
            <a href={call.recordingUrl} target="_blank" rel="noreferrer">Recording</a>
          </Button>
        )}
      </div>
    </div>
  );
}

function Fact({ label, mono = false, value }: { label: string; mono?: boolean; value: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-[11px] font-medium uppercase text-muted-foreground">{label}</div>
      <div className={`mt-1 truncate text-sm font-medium ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </div>
    </div>
  );
}

function AttentionGroup({
  empty,
  items,
  title,
}: {
  empty: string;
  items: Array<{ detail: string; id: string; label: string }>;
  title: string;
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-md border border-border p-3">
              <div className="line-clamp-2 text-sm font-medium">{item.label}</div>
              <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function BuildingFallback({ locationId }: { locationId: string }) {
  return (
    <div className="mx-auto max-w-md">
      <div className="text-base font-semibold">Tenant not found</div>
      <p className="mt-1 text-sm text-muted-foreground">
        No tenant directory row was visible for location ID <span className="font-mono">{locationId}</span>.
      </p>
      <Button className="mt-4" variant="outline" asChild>
        <Link to="/super/tenants">Back to tenants</Link>
      </Button>
    </div>
  );
}

function Building2Icon() {
  return <Settings2 className="h-4 w-4 text-primary" />;
}

function buildSetupChecks({
  healthReady,
  latestCall,
  phones,
  tenant,
}: {
  healthReady?: boolean;
  latestCall?: Call;
  phones: Array<{ forwardingStatus: string; phoneNumber: string; voiceWebhookUrl?: string }>;
  tenant?: TenantDirectoryRecord;
}) {
  const primaryPhone = phones[0];

  return [
    {
      detail: tenant ? `${tenant.locationName} exists in Supabase.` : "No visible tenant directory row yet.",
      label: "Supabase tenant",
      ready: Boolean(tenant),
    },
    {
      detail: tenant ? `${tenant.onboardingProgressPercent}% complete.` : "Onboarding row not visible.",
      label: "Onboarding",
      ready: Boolean(tenant && tenant.onboardingProgressPercent >= 80),
    },
    {
      detail: primaryPhone ? primaryPhone.phoneNumber : "No phone number row found.",
      label: "SignalHost phone number",
      ready: Boolean(primaryPhone || tenant?.aiHostPhone),
    },
    {
      detail: primaryPhone?.forwardingStatus?.replace(/_/g, " ") ?? "Forwarding has not been verified.",
      label: "Forwarding",
      ready: primaryPhone?.forwardingStatus === "verified",
    },
    {
      detail: primaryPhone?.voiceWebhookUrl || tenant?.voiceWebhookUrl || "Voice webhook is missing.",
      label: "Voice webhook",
      ready: Boolean(primaryPhone?.voiceWebhookUrl || tenant?.voiceWebhookUrl),
    },
    {
      detail: latestCall ? `Last call ${formatTime(latestCall.time)}.` : "No persisted calls yet.",
      label: "Live call logging",
      ready: Boolean(latestCall),
    },
    {
      detail: healthReady ? "Voice service reports production-ready." : "Voice service has missing readiness checks or is not connected.",
      label: "Voice runtime",
      ready: Boolean(healthReady),
    },
  ];
}

function statusBadgeClass(status?: TenantDirectoryStatus) {
  if (status === "healthy") return "border-success/30 bg-success/10 text-success";
  if (status === "critical") return "border-destructive/30 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/10 text-warning";
}

function intentBadgeClass(intent: string) {
  if (intent === "order") return "border-primary/20 bg-primary/10 text-primary";
  if (intent === "reservation") return "border-warning/30 bg-warning/10 text-warning";
  if (intent === "complaint") return "border-destructive/30 bg-destructive/10 text-destructive";
  if (intent === "sales") return "border-warning/30 bg-warning/10 text-warning";
  return "border-border bg-muted text-muted-foreground";
}

function readDraftText(draft: unknown, key: string) {
  if (!draft || typeof draft !== "object" || Array.isArray(draft)) return undefined;
  const value = (draft as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function isWithinLastHours(value: string | undefined, hours: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60_000;
}
