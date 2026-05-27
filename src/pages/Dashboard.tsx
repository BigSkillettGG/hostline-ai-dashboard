import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { PageBody } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CalendarDays,
  ClipboardList,
  Globe2,
  Mail,
  MessageCircle,
  Phone,
  PhoneIncoming,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import elliotAvatar from "@/assets/elliot-avatar.jpg";
import { calls as sampleCalls, orders as sampleOrders, reservations as sampleReservations } from "@/data/mock";
import type { Call, Order, Reservation } from "@/data/mock";
import { buildDailyBrief } from "@/domain/daily-brief";
import type { StaffTask } from "@/domain/staff-tasks";
import { adaptDemoDataForBusiness } from "@/domain/vertical-demo-data";
import {
  formatVerticalIntent,
  getVerticalInsightProfile,
  type VerticalInsightProfile,
} from "@/domain/vertical-insights";

import { formatTime, formatMoney } from "@/lib/format";
import { isPlatformAdminUser, useCurrentUser } from "@/lib/auth";
import { loadOnboardingDraft } from "@/lib/onboarding-draft";
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

const HOST_NAME = "Elliot";

const priorityBadge: Record<StaffTask["priority"], { label: string; className: string }> = {
  urgent: { label: "Urgent", className: "border-destructive/30 bg-destructive/10 text-destructive" },
  high: { label: "Needs manager", className: "border-warning/30 bg-warning/10 text-warning" },
  normal: { label: "Normal", className: "border-border bg-muted/50 text-foreground" },
  low: { label: "Low", className: "border-border bg-muted/30 text-muted-foreground" },
};

const taskTypeLabel: Record<StaffTask["type"], string> = {
  customer_request: "Customer callback requested",
  delivery_issue: "Order issue needs review",
  general: "Needs attention",
  low_confidence_review: "Question SignalHost couldn't answer",
  manager_callback: "Manager follow-up needed",
  order_follow_up: "Order request needs review",
  reservation_review: "Reservation request needs review",
};

export default function Dashboard() {
  const user = useCurrentUser();
  const platformAdmin = isPlatformAdminUser(user);
  const activeLocationId = getActiveSupabaseLocationId();
  const supabaseConfigured = isSupabaseConfigured();
  const liveEnabled = Boolean(supabaseConfigured && activeLocationId);
  const voiceConfigured = isVoiceServiceConfigured();

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

  const dashboardTasks = liveEnabled ? taskQuery.data ?? emptyTasks : emptyTasks;
  const activeTenant = tenantQuery.data?.find((tenant) => tenant.locationId === activeLocationId);
  const draft = loadOnboardingDraft();
  const businessType = activeTenant?.businessType ?? draft.businessType;
  const verticalProfile = useMemo(() => getVerticalInsightProfile(businessType), [businessType]);
  const businessName = activeTenant?.locationName ?? String(draft.restaurantName || "your business");
  const assignedPhoneNumber = activeTenant?.aiHostPhone ??
    String(draft.assignedSignalHostNumber || draft.assignedHostLineNumber || draft.assignedPhoneNumber || "");
  const aiHostPhone = assignedPhoneNumber || "(415) 555-0142";
  const phoneIsDemo = !assignedPhoneNumber;
  const tenantSlug = (activeTenant?.locationName ?? String(draft.restaurantName || "host"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "host";
  const hostEmail = String(draft.contactEmail || draft.email || "").trim() || `elliot+${tenantSlug}@signalhost.ai`;
  const websiteChatConfigured = false; // until live website chat status is wired up

  const demoData = useMemo(
    () => adaptDemoDataForBusiness({
      businessType,
      calls: sampleCalls,
      orders: sampleOrders,
      reservations: sampleReservations,
    }),
    [businessType],
  );
  const dashboardCalls = liveEnabled ? callQuery.data ?? emptyCalls : demoData.calls;
  const dashboardOrders = liveEnabled ? orderQuery.data ?? emptyOrders : demoData.orders;
  const dashboardReservations = liveEnabled ? reservationQuery.data ?? emptyReservations : demoData.reservations;

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

  const totalCalls = recentCalls.length;
  const ordersCaptured = recentOrders.length;
  const reservationRequests = dashboardReservations.filter((r) =>
    r.createdAt ? isWithinLastHours(r.createdAt, 24) : true,
  ).length;
  const missedRecovered = recentCalls.filter((c) => c.outcome !== "missed" && c.outcome !== "voicemail").length;
  const openTasks = dashboardTasks
    .filter((t) => t.status === "open" || t.status === "in_progress")
    .sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  const needsAttentionCount = openTasks.length;
  const websiteChats = 0; // placeholder until live chat metric exists

  const activity = useMemo(() => buildActivity(dashboardCalls, dashboardOrders, dashboardReservations, recentTasks), [
    dashboardCalls, dashboardOrders, dashboardReservations, recentTasks,
  ]);

  const hasLiveError = callQuery.isError || orderQuery.isError || reservationQuery.isError || taskQuery.isError;

  // Owner-friendly status
  const setupNeeded = !liveEnabled || phoneIsDemo;
  const hostStatus: { label: string; tone: "ok" | "warn" | "off" } = setupNeeded
    ? { label: "Needs setup", tone: "warn" }
    : { label: "Answering calls", tone: "ok" };

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  const saveReportMutation = useMutation({
    mutationFn: () => generateOwnerDailyReport(activeLocationId),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save brief"),
    onSuccess: (result) => toast.success(result.reportId ? "Brief saved" : "Brief generated"),
  });
  const deliverReportMutation = useMutation({
    mutationFn: () => deliverOwnerDailyReport(activeLocationId),
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not send brief"),
    onSuccess: (result) => {
      const sent = result.delivery?.attempts.filter((a) => a.status === "sent").length ?? 0;
      toast.success(sent ? `Brief sent to ${sent} channel${sent === 1 ? "" : "s"}` : "Brief generated, but no delivery channel is ready");
    },
  });
  const reportBusy = saveReportMutation.isPending || deliverReportMutation.isPending;

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
      {/* Page header — elevated hero strip */}
      <div className="relative border-b border-border/60 bg-[image:var(--gradient-hero)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_hsl(var(--primary)/0.08),_transparent_55%)]" />
        <div className="relative px-4 py-7 md:px-8 md:py-9">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{today}</span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${hostStatus.tone === "ok" ? "bg-success animate-pulse" : "bg-warning"}`} />
              {hostStatus.tone === "ok" ? "Live" : "Setup pending"}
            </span>
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight md:text-[32px]">{businessName}</h1>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Today, {HOST_NAME} handled{" "}
            <span className="font-semibold text-foreground tabular-nums">{totalCalls}</span>{" "}
            {totalCalls === 1 ? "call" : "calls"},{" "}
            <span className="font-semibold text-foreground tabular-nums">{websiteChats as number}</span>{" "}
            {(websiteChats as number) === 1 ? "chat" : "chats"}, and flagged{" "}
            <span className="font-semibold text-foreground tabular-nums">{needsAttentionCount}</span>{" "}
            {needsAttentionCount === 1 ? "item" : "items"} for your attention.
          </p>
        </div>
      </div>

      <PageBody className="space-y-6">
        {platformAdmin && activeTenant && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm">
            <div className="font-medium text-foreground">SignalHost staff view</div>
            <p className="mt-1 text-muted-foreground">
              You are viewing {activeTenant.locationName} with live tenant data.
            </p>
          </Card>
        )}
        {hasLiveError && (
          <Card className="border-warning/30 bg-warning/10 p-4 text-sm text-muted-foreground">
            Some live data could not load. It will refresh automatically.
          </Card>
        )}
        {setupNeeded && (
          <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning/5 p-4 text-sm">
            <div>
              <div className="font-medium text-foreground">SignalHost needs phone setup before it can answer calls.</div>
              <p className="mt-1 text-muted-foreground">
                Finish phone forwarding so customers reach your host.
              </p>
            </div>
            <Button size="sm" asChild>
              <Link to="/app/settings">Review phone setup</Link>
            </Button>
          </Card>
        )}

        {/* Host Profile + Quick Actions */}
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 relative overflow-hidden border-border/70 shadow-[var(--shadow-elevated)]">
            {/* Ambient backdrop */}
            <div className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-80" />
            <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-primary-glow/10 blur-3xl" />

            <div className="relative grid gap-0 md:grid-cols-[auto_1fr]">
              <div className="flex items-center justify-center p-6 md:p-8">
                <div className="relative">
                  <div className="absolute -inset-2 rounded-full bg-[image:var(--gradient-primary)] opacity-20 blur-xl" />
                  <Avatar className="relative h-28 w-28 ring-4 ring-background shadow-[var(--shadow-glow)]">
                    <AvatarImage src={elliotAvatar} alt={`${HOST_NAME}, your SignalHost host`} className="object-cover" />
                    <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">
                      {HOST_NAME[0]}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={`absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full ring-[3px] ring-background ${
                      hostStatus.tone === "ok"
                        ? "bg-success after:absolute after:inset-0 after:rounded-full after:bg-success after:animate-ping after:opacity-60"
                        : hostStatus.tone === "warn"
                        ? "bg-warning"
                        : "bg-muted-foreground"
                    }`}
                  />
                </div>
              </div>
              <div className="p-5 md:p-6 md:pl-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-primary">
                    Your SignalHost host
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2.5">
                  <h2 className="text-2xl font-semibold tracking-tight">{HOST_NAME}</h2>
                  <Badge
                    variant="outline"
                    className={
                      hostStatus.tone === "ok"
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-warning/30 bg-warning/10 text-warning"
                    }
                  >
                    <span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${hostStatus.tone === "ok" ? "bg-success" : "bg-warning"}`} />
                    {hostStatus.label}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Call or text your host.
                </p>

                <div className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
                  <ContactRow icon={Phone} label="Call or text" value={aiHostPhone} href={`tel:${aiHostPhone}`} />
                  <ContactRow icon={Mail} label="Email" value={hostEmail} href={`mailto:${hostEmail}`} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" asChild>
                    <Link to="/app/assistant">
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Message {HOST_NAME}
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="border-border/70 shadow-[var(--shadow-card)] flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3">
              <div className="space-y-0.5">
                <QuickAction to="/app/needs-attention" icon={AlertTriangle} label="Review needs attention" badge={needsAttentionCount || undefined} />
                <QuickAction to="/app/calls" icon={Phone} label="View calls" />
                <QuickAction to="/app/reservations" icon={CalendarDays} label="View reservations" />
              </div>

              {!websiteChatConfigured && (
                <Link
                  to="/app/website-chat"
                  className="group mt-auto block rounded-lg border border-warning/30 bg-warning/5 p-3 transition-all hover:border-warning/50 hover:bg-warning/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-warning/15 text-warning">
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-warning">To do</span>
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-foreground">Set up website chat</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">Add the snippet so {HOST_NAME} can answer visitors on your site.</div>
                    </div>
                    <ArrowRight className="mt-1 h-3.5 w-3.5 text-muted-foreground transition-all group-hover:text-warning group-hover:translate-x-0.5" />
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>
        </div>


        {/* Needs Attention */}
        <Card className="border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-warning/10 text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-base font-semibold tracking-tight">
                  Needs attention
                </CardTitle>
                {needsAttentionCount > 0 && (
                  <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">
                    {needsAttentionCount}
                  </Badge>
                )}
              </div>
              <Link to="/app/needs-attention" className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {openTasks.length === 0 ? (
              <div className="mx-6 my-2 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 text-success">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="font-medium text-foreground">All clear</div>
                <div>Nothing needs your attention right now. Nice.</div>
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {openTasks.slice(0, 6).map((task) => {
                  const badge = priorityBadge[task.priority];
                  return (
                    <li key={task.id} className="group/row flex items-start gap-3 px-6 py-3.5 text-sm transition-colors hover:bg-muted/30">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/10 text-warning ring-4 ring-warning/5">
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{taskTypeLabel[task.type]}</span>
                          <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{task.title}</div>
                      </div>
                      <Button size="sm" variant="ghost" asChild className="opacity-70 transition-opacity group-hover/row:opacity-100">
                        <Link to="/app/needs-attention">Review</Link>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Activity metrics */}
        <div>
          <div className="mb-3 flex items-end justify-between px-1">
            <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Today's activity
            </h2>
            <span className="text-[11px] text-muted-foreground">Last 24 hours</span>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatCard label="Calls answered" value={totalCalls} delta={0} icon={Phone} accent />
            <StatCard label="Missed recovered" value={missedRecovered} delta={0} icon={PhoneIncoming} />
            <StatCard label="Website chats" value={websiteChats} delta={0} icon={MessageCircle} />
            <StatCard label={verticalProfile.primaryWorkflow.metricLabel} value={ordersCaptured} delta={0} icon={ShoppingBag} />
            <StatCard label={verticalProfile.secondaryWorkflow.metricLabel} value={reservationRequests} delta={0} icon={CalendarDays} />
            <Link to="/app/needs-attention" className="contents">
              <StatCard label="Needs attention" value={needsAttentionCount} delta={0} icon={AlertTriangle} />
            </Link>
          </div>
        </div>


        {/* Daily brief */}
        <Card className="relative overflow-hidden border-border/70 shadow-[var(--shadow-card)]">
          <div className="absolute inset-y-0 left-0 w-1 bg-[image:var(--gradient-primary)]" />
          <CardHeader className="pb-3 pl-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <CardTitle className="text-base font-semibold tracking-tight">Daily brief</CardTitle>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">{dailyBrief.dateLabel}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={copyDailyBrief}>Copy brief</Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!voiceConfigured || reportBusy}
                  onClick={() => deliverReportMutation.mutate()}
                >
                  {deliverReportMutation.isPending ? "Sending..." : "Send brief"}
                </Button>
                <Button size="sm" asChild>
                  <Link to="/app/needs-attention">Review needs attention</Link>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-7">
            <p className="text-[15px] leading-7 text-foreground/85">
              {totalCalls === 0 && ordersCaptured === 0 && reservationRequests === 0
                ? `No new customer interactions for ${businessName} yet today.`
                : dailyBrief.ownerMessage}
            </p>
            {platformAdmin && voiceConfigured && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={reportBusy}
                  onClick={() => saveReportMutation.mutate()}
                >
                  {saveReportMutation.isPending ? "Saving..." : "Save report (staff)"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="border-border/70 shadow-[var(--shadow-card)]">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Activity className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-base font-semibold tracking-tight">Recent activity</CardTitle>
              </div>
              <Link to="/app/calls" className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors hover:text-primary/80">
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-2">
            {activity.length === 0 ? (
              <div className="mx-6 my-2 rounded-lg border border-dashed border-border/70 bg-muted/20 px-6 py-10 text-center text-sm text-muted-foreground">
                No recent activity yet.
              </div>
            ) : (
              <ul className="divide-y divide-border/70">
                {activity.map((activityItem) => (
                  <li
                    key={`${activityItem.type}-${activityItem.t}-${activityItem.item.id}`}
                    className="group flex items-center gap-3 px-6 py-3.5 text-sm transition-colors hover:bg-muted/30"
                  >
                    {activityItem.type === "call" && <CallActivity businessType={businessType} item={activityItem.item} />}
                    {activityItem.type === "order" && <OrderActivity item={activityItem.item} profile={verticalProfile} />}
                    {activityItem.type === "reservation" && <ReservationActivity item={activityItem.item} profile={verticalProfile} />}
                    {activityItem.type === "task" && <TaskActivity item={activityItem.item} />}
                    <div className="text-[11px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">{formatTime(activityItem.t)}</div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-all group-hover:text-muted-foreground group-hover:translate-x-0.5" />
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


function ContactRow({
  icon: Icon, label, value, href, muted,
}: {
  icon: typeof Phone; label: string; value: string; href?: string; muted?: boolean;
}) {
  const content = (
    <div className="group/contact flex items-center gap-3 rounded-lg border border-border/70 bg-card/80 px-3 py-2.5 backdrop-blur-sm transition-all hover:border-primary/30 hover:bg-card hover:shadow-[var(--shadow-card)]">
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary group-hover/contact:bg-primary/15"}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 leading-tight">
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</div>
        <div className={`truncate text-sm font-medium tabular-nums ${muted ? "text-muted-foreground" : "text-foreground"}`}>{value}</div>
      </div>
    </div>
  );
  if (href && !muted) return <a href={href} className="block">{content}</a>;
  return content;
}

function QuickAction({
  to, icon: Icon, label, badge,
}: { to: string; icon: typeof Phone; label: string; badge?: number }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-sm transition-all hover:bg-muted/50"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <span className="font-medium text-foreground/90">{label}</span>
      </span>
      <span className="flex items-center gap-2">
        {badge !== undefined && (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning">{badge}</Badge>
        )}
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

function CallActivity({ businessType, item }: { businessType: unknown; item: Call }) {
  const callerKnown = item.caller && !/^unknown/i.test(item.caller);
  const displayName = callerKnown ? item.caller : "Caller";
  return (
    <>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info ring-4 ring-info/5">
        <Phone className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">{displayName}</span>
          <span className={`text-[11px] font-medium ${intentColor[item.intent] ?? "text-muted-foreground"}`}>
            {formatVerticalIntent(item.intent, businessType)}
          </span>
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
        <div className="truncate"><span className="font-medium">{profile.primaryWorkflow.activityTitle}</span> · {item.customer}</div>
        <div className="text-xs text-muted-foreground">
          {item.total > 0 ? `${formatMoney(item.total)} · ` : ""}{item.etaMinutes ? `ETA ${item.etaMinutes}m` : item.status.replace(/_/g, " ")}
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
          <span className="font-medium">
            {profile.businessType === "restaurant" ? item.guest : profile.secondaryWorkflow.activityTitle}
          </span>
          {profile.businessType === "restaurant" ? ` · party of ${item.partySize}` : ` · ${item.guest}`}
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
        <div className="truncate"><span className="font-medium">{taskTypeLabel[item.type]}</span> · {item.title}</div>
        <div className="text-xs text-muted-foreground capitalize">{item.priority} priority · {item.status.replace(/_/g, " ")}</div>
      </div>
    </>
  );
}

function buildActivity(
  calls: Call[], orders: Order[], reservations: Reservation[], tasks: StaffTask[],
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

function priorityRank(p: StaffTask["priority"]) {
  return p === "urgent" ? 4 : p === "high" ? 3 : p === "normal" ? 2 : 1;
}
