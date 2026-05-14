import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageBody } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Brain,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  Globe2,
  ListChecks,
  Megaphone,
  MessageSquare,
  Phone,
  PhoneIncoming,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calls as sampleCalls, orders as sampleOrders, reservations as sampleReservations } from "@/data/mock";
import type { Call, Order, Reservation } from "@/data/mock";
import { buildDailyBrief, type DailyBriefFollowUp, type DailyBriefSuggestion } from "@/domain/daily-brief";
import type { StaffTask } from "@/domain/staff-tasks";
import { adaptDemoDataForBusiness } from "@/domain/vertical-demo-data";
import {
  formatVerticalIntent,
  getVerticalInsightProfile,
  type VerticalInsightProfile,
} from "@/domain/vertical-insights";
import {
  assignedDemoPhoneNumber,
  calculateOnboardingProgress,
} from "@/domain/onboarding";
import {
  buildProductTestReadiness,
  type ProductReadinessItem,
  type ProductReadinessStatus,
} from "@/domain/product-test-readiness";
import { summarizeScenarioRuns, voiceScenarios } from "@/domain/scenario-lab";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatTime, formatMoney } from "@/lib/format";
import { getAuthReadiness, isPlatformAdminUser, useCurrentUser } from "@/lib/auth";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
import { loadScenarioRuns } from "@/lib/scenario-run-storage";
import {
  fetchCallsFromSupabase,
  fetchOrdersFromSupabase,
  fetchReservationsFromSupabase,
  fetchStaffTasksFromSupabase,
  fetchTenantDirectoryFromSupabase,
  getActiveSupabaseLocationId,
  isSupabaseConfigured,
} from "@/lib/supabase-rest";
import {
  deliverOwnerDailyReport,
  fetchVoiceServiceHealth,
  generateOwnerDailyReport,
  isVoiceServiceConfigured,
} from "@/lib/voice-service";
import { toast } from "sonner";

const intentColor: Record<string, string> = {
  complaint: "text-destructive",
  faq: "text-info",
  hours: "text-info",
  order: "text-primary",
  other: "text-muted-foreground",
  reservation: "text-warning",
  sales: "text-warning",
};

type ActivityItem =
  | { item: Call; t: string; type: "call" }
  | { item: Order; t: string; type: "order" }
  | { item: Reservation; t: string; type: "reservation" }
  | { item: StaffTask; t: string; type: "task" };

const emptyCalls: Call[] = [];
const emptyOrders: Order[] = [];
const emptyReservations: Reservation[] = [];
const emptyTasks: StaffTask[] = [];

export default function Dashboard() {
  const user = useCurrentUser();
  const platformAdmin = isPlatformAdminUser(user);
  const activeLocationId = getActiveSupabaseLocationId();
  const supabaseConfigured = isSupabaseConfigured();
  const liveEnabled = Boolean(supabaseConfigured && activeLocationId);
  const voiceConfigured = isVoiceServiceConfigured();
  const authReadiness = getAuthReadiness();
  const scenarioSummary = useMemo(() => summarizeScenarioRuns(voiceScenarios, loadScenarioRuns("app")), []);

  const callQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchCallsFromSupabase(activeLocationId),
    queryKey: ["dashboard", "calls", activeLocationId],
    refetchInterval: 30_000,
  });
  const orderQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchOrdersFromSupabase(activeLocationId),
    queryKey: ["dashboard", "orders", activeLocationId],
    refetchInterval: 30_000,
  });
  const reservationQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchReservationsFromSupabase(activeLocationId),
    queryKey: ["dashboard", "reservations", activeLocationId],
    refetchInterval: 30_000,
  });
  const taskQuery = useQuery({
    enabled: liveEnabled,
    queryFn: () => fetchStaffTasksFromSupabase(activeLocationId),
    queryKey: ["dashboard", "tasks", activeLocationId],
    refetchInterval: 30_000,
  });
  const tenantQuery = useQuery({
    enabled: liveEnabled,
    queryFn: fetchTenantDirectoryFromSupabase,
    queryKey: ["tenant-directory", "dashboard", activeLocationId],
    staleTime: 60_000,
  });
  const voiceHealthQuery = useQuery({
    enabled: voiceConfigured,
    queryFn: fetchVoiceServiceHealth,
    queryKey: ["dashboard", "voice-health"],
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const dashboardTasks = useMemo(
    () => liveEnabled ? taskQuery.data ?? emptyTasks : emptyTasks,
    [liveEnabled, taskQuery.data],
  );
  const activeTenant = tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId);
  const draft = loadOnboardingDraft();
  const businessType = activeTenant?.businessType ?? draft.businessType;
  const verticalProfile = useMemo(() => getVerticalInsightProfile(businessType), [businessType]);
  const businessName = activeTenant?.locationName ?? String(draft.restaurantName || "your business");
  const assignedPhoneNumber = activeTenant?.aiHostPhone ??
    String(draft.assignedSignalHostNumber || draft.assignedHostLineNumber || draft.assignedPhoneNumber || "");
  const aiHostPhone = assignedPhoneNumber || "(415) 555-0142";
  const assignedPhoneNumberIsDemo = !assignedPhoneNumber ||
    assignedPhoneNumber === assignedDemoPhoneNumber ||
    assignedPhoneNumber.includes("555");
  const onboardingProgress = calculateOnboardingProgress(draft);
  const demoData = useMemo(
    () => adaptDemoDataForBusiness({
      businessType,
      calls: sampleCalls,
      orders: sampleOrders,
      reservations: sampleReservations,
    }),
    [businessType],
  );
  const dashboardCalls = useMemo(
    () => liveEnabled ? callQuery.data ?? emptyCalls : demoData.calls,
    [callQuery.data, demoData.calls, liveEnabled],
  );
  const dashboardOrders = useMemo(
    () => liveEnabled ? orderQuery.data ?? emptyOrders : demoData.orders,
    [demoData.orders, liveEnabled, orderQuery.data],
  );
  const dashboardReservations = useMemo(
    () => liveEnabled ? reservationQuery.data ?? emptyReservations : demoData.reservations,
    [demoData.reservations, liveEnabled, reservationQuery.data],
  );
  const recentCalls = useMemo(() => dashboardCalls.filter((call) => isWithinLastHours(call.time, 24)), [dashboardCalls]);
  const recentOrders = useMemo(() => dashboardOrders.filter((order) => isWithinLastHours(order.createdAt, 24)), [dashboardOrders]);
  const recentTasks = useMemo(() => dashboardTasks.filter((task) => isWithinLastHours(task.createdAt, 24)), [dashboardTasks]);
  const dailyBrief = useMemo(
    () => buildDailyBrief({
      businessType: String(businessType ?? ""),
      businessName,
      calls: dashboardCalls,
      orders: dashboardOrders,
      reservations: dashboardReservations,
      tasks: dashboardTasks,
    }),
    [businessName, businessType, dashboardCalls, dashboardOrders, dashboardReservations, dashboardTasks],
  );
  const callVolume = useMemo(() => buildHourlyCallVolume(recentCalls), [recentCalls]);
  const peakHour = callVolume.reduce((max, item) => (item.calls > max.calls ? item : max), callVolume[0]);
  const topIntents = useMemo(() => buildTopIntents(recentCalls, businessType), [businessType, recentCalls]);
  const totalCalls = recentCalls.length;
  const activeStaffFollowUps = dashboardTasks.filter((task) => task.status === "open" || task.status === "in_progress").length;
  const ordersCaptured = recentOrders.length;
  const reservationRequests = dashboardReservations.filter((reservation) =>
    reservation.createdAt ? isWithinLastHours(reservation.createdAt, 24) : true,
  ).length;
  const missedRecovered = recentCalls.filter((call) => call.outcome !== "missed" && call.outcome !== "voicemail").length;
  const salesCalls = recentCalls.filter((call) => call.intent === "sales").length;
  const revenueCaptured = recentOrders.reduce((sum, order) => sum + order.total, 0);
  const resolvedCalls = recentCalls.filter((call) =>
    call.outcome === "resolved" ||
    call.outcome === "order_placed" ||
    call.outcome === "reservation_booked",
  ).length;
  const containment = totalCalls ? Math.round((resolvedCalls / totalCalls) * 100) : 0;
  const activity = useMemo(() => buildActivity(dashboardCalls, dashboardOrders, dashboardReservations, recentTasks), [
    dashboardCalls,
    dashboardOrders,
    dashboardReservations,
    recentTasks,
  ]);
  const hasLiveError = callQuery.isError || orderQuery.isError || reservationQuery.isError || taskQuery.isError;
  const productReadiness = buildProductTestReadiness({
    assignedPhoneNumber,
    assignedPhoneNumberIsDemo,
    authMode: authReadiness.mode,
    authReady: authReadiness.ready,
    businessName,
    hasWebsiteUrl: Boolean(String(draft.websiteUrl || draft.website || "").trim()),
    liveEnabled,
    locationId: activeLocationId,
    onboardingProgressPercent: onboardingProgress.percent,
    openTaskCount: activeStaffFollowUps,
    recentCallCount: liveEnabled ? recentCalls.length : 0,
    scenarioSummary,
    selectedPlanName: String(draft.selectedPlanName || ""),
    supabaseConfigured,
    voiceHealth: voiceHealthQuery.data,
    voiceHealthError: voiceHealthQuery.isError,
    voiceServiceConfigured: voiceConfigured,
  });
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const saveReportMutation = useMutation({
    mutationFn: () => generateOwnerDailyReport(activeLocationId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not save owner report");
    },
    onSuccess: (result) => {
      toast.success(result.reportId ? "Owner report saved" : "Owner report generated");
    },
  });
  const deliverReportMutation = useMutation({
    mutationFn: () => deliverOwnerDailyReport(activeLocationId),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Could not send owner report");
    },
    onSuccess: (result) => {
      const sent = result.delivery?.attempts.filter((attempt) => attempt.status === "sent").length ?? 0;
      toast.success(sent ? `Owner report sent to ${sent} channel${sent === 1 ? "" : "s"}` : "Owner report generated, but no delivery channel is ready");
    },
  });
  const reportActionBusy = saveReportMutation.isPending || deliverReportMutation.isPending;

  async function copyDailyBrief() {
    try {
      await navigator.clipboard.writeText(dailyBrief.copyText);
      toast.success("Daily brief copied");
    } catch {
      toast.error("Could not copy daily brief");
    }
  }

  return (
    <>
      <div className="border-b border-border bg-background">
        <div className="px-4 py-6 md:px-6 md:py-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{today}</span>
                <span className="mx-1 h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success" />
                  {liveEnabled ? "Live customer data" : "Demo workspace"}
                </span>
              </div>
              <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight md:text-[28px]">
                {businessName}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                SignalHost handled <span className="font-medium text-foreground tabular-nums">{totalCalls}</span> calls in the last 24 hours
                {ordersCaptured > 0 && revenueCaptured > 0 ? (
                  <> and captured <span className="font-medium text-foreground">{formatMoney(revenueCaptured)}</span> in {verticalProfile.primaryWorkflow.ownerPhrase} value.</>
                ) : ordersCaptured > 0 ? (
                  <> and logged <span className="font-medium text-foreground tabular-nums">{ordersCaptured}</span> {ordersCaptured === 1 ? verticalProfile.primaryWorkflow.singular : verticalProfile.primaryWorkflow.plural}.</>
                ) : (
                  <> with <span className="font-medium text-foreground tabular-nums">{activeStaffFollowUps}</span> open staff follow-ups.</>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2 shadow-sm">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    S
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    SignalHost answering
                  </div>
                  <a href={`tel:${aiHostPhone}`} className="block text-sm font-semibold tabular-nums hover:text-primary">
                    {aiHostPhone}
                  </a>
                </div>
              </div>
              <Button
                disabled={!voiceConfigured || reportActionBusy}
                onClick={() => saveReportMutation.mutate()}
                size="sm"
                variant="outline"
              >
                {saveReportMutation.isPending ? "Saving..." : "Save report"}
              </Button>
              <Button
                disabled={!voiceConfigured || reportActionBusy}
                onClick={() => deliverReportMutation.mutate()}
                size="sm"
                variant="outline"
              >
                {deliverReportMutation.isPending ? "Sending..." : "Send report"}
              </Button>
              <Button size="sm" asChild>
                <Link to="/app/calls">View calls<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PageBody className="space-y-6">
        {platformAdmin && activeTenant && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm">
            <div className="font-medium text-foreground">SignalHost staff view</div>
            <p className="mt-1 text-muted-foreground">
              You are viewing {activeTenant.locationName} with live tenant data. Owner demo data remains separate.
            </p>
          </Card>
        )}
        {hasLiveError && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            Some live dashboard panels could not load. Calls, orders, reservations, and tasks will update automatically once Supabase responds.
          </Card>
        )}

        <ProductTestReadinessCard readiness={productReadiness} />

        <Card className="overflow-hidden border-primary/15">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_0.9fr]">
            <div className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  Daily brief
                </Badge>
                <span className="text-xs text-muted-foreground">{dailyBrief.dateLabel}</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">{dailyBrief.headline}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{dailyBrief.ownerMessage}</p>
              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                {dailyBrief.metrics.map((metric) => (
                  <div key={metric.label} className="rounded-md border border-border bg-muted/20 p-3">
                    <div className="text-[10px] font-medium uppercase text-muted-foreground">{metric.label}</div>
                    <div className="mt-1 text-xl font-semibold tabular-nums">{metric.value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button size="sm" onClick={copyDailyBrief}>
                  Copy brief
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/tasks">Open follow-ups</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/app/calls">Review calls</Link>
                </Button>
              </div>
            </div>
            <div className="border-t border-border bg-muted/20 p-5 md:p-6 lg:border-l lg:border-t-0">
              <div className="grid gap-4">
                <BriefList
                  empty="Nothing needs owner attention right now."
                  items={dailyBrief.followUps}
                  title="Needs attention"
                  type="followup"
                />
                <BriefList
                  empty="No knowledge updates suggested yet."
                  items={dailyBrief.suggestedUpdates}
                  title="Suggested updates"
                  type="suggestion"
                />
              </div>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Calls answered" value={totalCalls} delta={0} icon={Phone} accent />
          <StatCard label="Missed recovered" value={missedRecovered} delta={0} icon={PhoneIncoming} />
          <StatCard label={verticalProfile.primaryWorkflow.metricLabel} value={ordersCaptured} delta={0} icon={ShoppingBag} />
          <StatCard label={verticalProfile.secondaryWorkflow.metricLabel} value={reservationRequests} delta={0} icon={CalendarDays} />
          <Link to="/app/tasks" className="contents">
            <StatCard label={verticalProfile.dashboard.staffFollowUpsLabel} value={activeStaffFollowUps} delta={0} icon={AlertTriangle} />
          </Link>
          <Link to="/app/calls?intent=sales" className="contents">
            <StatCard label={verticalProfile.vendorMetricLabel} value={salesCalls} delta={0} icon={Megaphone} />
          </Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Call volume</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Peak at <span className="font-medium text-foreground">{peakHour.hour}</span> · {peakHour.calls} calls · {totalCalls} total in 24h
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
                  <button className="rounded px-2 py-1 text-[11px] font-medium bg-muted">24h</button>
                  <button className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50">7d</button>
                  <button className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50">30d</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callVolume} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="callFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.32} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="hour"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      interval={2}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                      width={36}
                    />
                    <Tooltip
                      cursor={{ stroke: "hsl(var(--primary))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      formatter={(value: number) => [`${value} calls`, ""]}
                    />
                    <ReferenceLine x={peakHour.hour} stroke="hsl(var(--primary))" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <Area
                      type="monotone"
                      dataKey="calls"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#callFill)"
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--background))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Top intents</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">{verticalProfile.dashboard.topIntentSubtitle}</p>
                </div>
                <Sparkles className="h-4 w-4 text-primary/60" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {topIntents.length === 0 && (
                <div className="rounded-md border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
                  No call intents yet.
                </div>
              )}
              {topIntents.map((intent) => (
                <div key={intent.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{intent.name}</span>
                    <span className="text-muted-foreground tabular-nums">{intent.value} · {intent.percent}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${intent.percent}%` }}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-4 rounded-md border border-success/20 bg-success/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase text-muted-foreground">Containment</div>
                    <div className="mt-0.5 text-2xl font-semibold tabular-nums text-success">{containment}%</div>
                  </div>
                  <Badge variant="secondary" className="border-0 bg-success/15 text-success">
                    <CheckCircle2 className="mr-1 h-3 w-3" />
                    Live
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Calls resolved without staff handoff
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                Recent activity
              </CardTitle>
              <Link to="/app/calls" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            {activity.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-muted-foreground">No live activity yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((activityItem) => (
                  <li key={`${activityItem.type}-${activityItem.t}-${activityItem.item.id}`} className="group flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/30">
                    {activityItem.type === "call" && <CallActivity businessType={businessType} item={activityItem.item} />}
                    {activityItem.type === "order" && <OrderActivity item={activityItem.item} profile={verticalProfile} />}
                    {activityItem.type === "reservation" && <ReservationActivity item={activityItem.item} profile={verticalProfile} />}
                    {activityItem.type === "task" && <TaskActivity item={activityItem.item} />}
                    <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatTime(activityItem.t)}</div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}

function ProductTestReadinessCard({ readiness }: { readiness: ReturnType<typeof buildProductTestReadiness> }) {
  const next = readiness.nextItem;

  return (
    <Card className="overflow-hidden border-primary/20">
      <div className="grid gap-0 xl:grid-cols-[0.9fr_1.6fr]">
        <div className="border-b border-border bg-muted/20 p-5 md:p-6 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={overallStatusClass(readiness.overallStatus)}>
              <ListChecks className="mr-1 h-3.5 w-3.5" />
              {readiness.readyCount}/{readiness.totalCount} ready
            </Badge>
            <span className="text-xs text-muted-foreground">{readiness.testableCount} testable now</span>
          </div>
          <h2 className="mt-3 text-xl font-semibold tracking-tight">{readiness.headline}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{readiness.summary}</p>

          <div className="mt-5 rounded-md border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                {readinessIcon(next)}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-medium uppercase text-muted-foreground">Next best test</div>
                <div className="mt-1 text-sm font-semibold">{next.label}</div>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{next.testPrompt ?? next.detail}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" asChild>
                <Link to={next.actionTo}>{next.actionLabel}<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/onboarding">Open launch center</Link>
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link to="/app/test-suite">Open test suite</Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 p-5 md:p-6 sm:grid-cols-2">
          {readiness.items.map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${readinessIconClass(item.status)}`}>
                    {readinessIcon(item)}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{item.label}</div>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                  </div>
                </div>
                <Badge variant="outline" className={`shrink-0 ${readinessBadgeClass(item.status)}`}>
                  {item.statusLabel}
                </Badge>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-muted-foreground">
                  {item.testPrompt ? "Has test prompt" : "Review setup"}
                </div>
                <Link to={item.actionTo} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                  {item.actionLabel}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function readinessIcon(item: ProductReadinessItem) {
  const className = "h-4 w-4";
  if (item.id === "workspace") return <Database className={className} />;
  if (item.id === "voice") return <Bot className={className} />;
  if (item.id === "phone_number") return <Phone className={className} />;
  if (item.id === "call_logging") return <ClipboardList className={className} />;
  if (item.id === "owner_learning") return <Brain className={className} />;
  if (item.id === "owner_commands") return <ShieldCheck className={className} />;
  if (item.id === "website_chat") return <MessageSquare className={className} />;
  if (item.id === "reports") return <Globe2 className={className} />;
  if (item.id === "test_suite") return <ListChecks className={className} />;
  return <CreditCard className={className} />;
}

function readinessIconClass(status: ProductReadinessStatus) {
  if (status === "ready") return "bg-success/10 text-success";
  if (status === "partial") return "bg-warning/15 text-warning";
  if (status === "needs_setup") return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
}

function readinessBadgeClass(status: ProductReadinessStatus) {
  if (status === "ready") return "border-success/20 bg-success/10 text-success";
  if (status === "partial") return "border-warning/20 bg-warning/10 text-warning";
  if (status === "needs_setup") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-border bg-muted/40 text-muted-foreground";
}

function overallStatusClass(status: ReturnType<typeof buildProductTestReadiness>["overallStatus"]) {
  if (status === "ready_to_test") return "border-0 bg-success/15 text-success";
  if (status === "setup_first") return "border-0 bg-warning/15 text-warning";
  return "border-0 bg-muted text-muted-foreground";
}

function CallActivity({ businessType, item }: { businessType: unknown; item: Call }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info ring-4 ring-info/5">
        <Phone className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span className="font-medium">{item.caller}</span>
          <span className={`ml-2 text-xs font-medium ${intentColor[item.intent]}`}>{formatVerticalIntent(item.intent, businessType)}</span>
        </div>
        <div className="truncate text-xs text-muted-foreground">{item.summary}</div>
      </div>
    </>
  );
}

function OrderActivity({ item, profile }: { item: Order; profile: VerticalInsightProfile }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
        <ShoppingBag className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate"><span className="font-medium">{profile.primaryWorkflow.activityTitle}</span> - {item.customer}</div>
        <div className="text-xs text-muted-foreground">
          {item.total > 0 ? `${formatMoney(item.total)} - ` : ""}{item.etaMinutes ? `ETA ${item.etaMinutes}m` : item.status.replace(/_/g, " ")}
        </div>
      </div>
    </>
  );
}

function ReservationActivity({ item, profile }: { item: Reservation; profile: VerticalInsightProfile }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning ring-4 ring-warning/5">
        <CalendarDays className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate">
          <span className="font-medium">{profile.businessType === "restaurant" ? item.guest : profile.secondaryWorkflow.activityTitle}</span>
          {profile.businessType === "restaurant" ? ` - party of ${item.partySize}` : ` - ${item.guest}`}
        </div>
        <div className="text-xs text-muted-foreground">{item.date} at {item.time}</div>
      </div>
    </>
  );
}

function TaskActivity({ item }: { item: StaffTask }) {
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-4 ring-destructive/5">
        <ClipboardList className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate"><span className="font-medium">Staff follow-up</span> · {item.title}</div>
        <div className="text-xs text-muted-foreground capitalize">{item.priority} priority · {item.status.replace(/_/g, " ")}</div>
      </div>
    </>
  );
}

function BriefList({
  empty,
  items,
  title,
  type,
}: {
  empty: string;
  items: DailyBriefFollowUp[] | DailyBriefSuggestion[];
  title: string;
  type: "followup" | "suggestion";
}) {
  return (
    <div>
      <div className="mb-2 text-xs font-medium uppercase text-muted-foreground">{title}</div>
      {items.length === 0 ? (
        <div className="rounded-md border border-dashed border-border bg-background/60 p-3 text-sm text-muted-foreground">
          {empty}
        </div>
      ) : (
        <div className="space-y-2">
          {items.slice(0, 3).map((item) => (
            <div key={item.id} className="rounded-md border border-border bg-background/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{item.title}</div>
                  <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {type === "followup" ? (item as DailyBriefFollowUp).action : (item as DailyBriefSuggestion).detail}
                  </div>
                </div>
                {type === "followup" && (
                  <Badge variant="outline" className="shrink-0 capitalize">
                    {(item as DailyBriefFollowUp).priority}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function buildActivity(
  calls: Call[],
  orders: Order[],
  reservations: Reservation[],
  tasks: StaffTask[],
): ActivityItem[] {
  return [
    ...calls.slice(0, 5).map((item) => ({ item, t: item.time, type: "call" as const })),
    ...orders.slice(0, 4).map((item) => ({ item, t: item.createdAt, type: "order" as const })),
    ...reservations.slice(0, 3).map((item) => ({
      item,
      t: item.createdAt ?? reservationDateTime(item),
      type: "reservation" as const,
    })),
    ...tasks.slice(0, 4).map((item) => ({ item, t: item.createdAt, type: "task" as const })),
  ].sort((first, second) => +new Date(second.t) - +new Date(first.t)).slice(0, 8);
}

function buildHourlyCallVolume(calls: Call[]) {
  const now = new Date();
  const buckets = Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getTime() - (23 - index) * 60 * 60_000);
    return {
      calls: 0,
      hour: formatHour(date),
      rawHour: date.getHours(),
    };
  });

  for (const call of calls) {
    const date = new Date(call.time);
    const bucket = buckets.find((item) => item.rawHour === date.getHours());
    if (bucket) bucket.calls += 1;
  }

  return buckets.map(({ hour, calls }) => ({ hour, calls }));
}

function buildTopIntents(calls: Call[], businessType: unknown) {
  const counts = new Map<string, number>();
  for (const call of calls) counts.set(call.intent, (counts.get(call.intent) ?? 0) + 1);
  const total = calls.length || 1;

  return [...counts.entries()]
    .sort((first, second) => second[1] - first[1])
    .slice(0, 5)
    .map(([intent, value]) => ({
      name: formatVerticalIntent(intent, businessType),
      percent: Math.round((value / total) * 100),
      value,
    }));
}

function isWithinLastHours(value: string | undefined, hours: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return false;
  return Date.now() - time <= hours * 60 * 60_000;
}

function reservationDateTime(reservation: Reservation) {
  if (!reservation.date) return new Date(0).toISOString();
  return new Date(`${reservation.date}T${reservation.time || "00:00"}:00`).toISOString();
}

function formatHour(date: Date) {
  const hour = date.getHours();
  const period = hour < 12 ? "AM" : "PM";
  const display = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${display}${period}`;
}
