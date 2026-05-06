import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, BellRing, CheckCircle2, RefreshCw, Settings, XCircle } from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { StaffAlertEvent, StaffAlertEventStatus } from "@/domain/alert-events";
import { summarizeAlertRecipients } from "@/domain/alert-events";
import {
  fetchStaffAlertEventsFromSupabase,
  isStaffAlertEventPersistenceConfigured,
} from "@/lib/supabase-rest";
import { formatTime } from "@/lib/format";

type TabKey = "all" | StaffAlertEventStatus;

const sampleAlertEvents: StaffAlertEvent[] = [
  {
    callerPhone: "+1 (415) 555-0177",
    callId: "c_011",
    channels: ["sms", "email/webhook"],
    createdAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    emailRecipientCount: 1,
    fallbackUsed: false,
    id: "alert_sample_1",
    kind: "complaint",
    message: "Complaint alert - Olive & Ember",
    recipients: [
      { channel: "both", email: "maria@oliveandember.com", id: "maria", name: "Maria Lombardi", phone: "+1 415-555-0148" },
    ],
    sentAt: new Date(Date.now() - 14 * 60_000).toISOString(),
    severity: "high",
    smsRecipientCount: 1,
    status: "sent",
    summary: "Complaint or refund risk detected.",
  },
  {
    channels: ["sms"],
    createdAt: new Date(Date.now() - 46 * 60_000).toISOString(),
    emailRecipientCount: 0,
    errorMessage: "Twilio staff alert failed: 400 invalid destination",
    fallbackUsed: false,
    id: "alert_sample_2",
    kind: "delivery_failure",
    message: "Order delivery failure - Olive & Ember",
    recipients: [
      { channel: "sms", email: "", id: "manager", name: "Manager on duty", phone: "+1 415-555-0148" },
    ],
    severity: "high",
    smsRecipientCount: 1,
    status: "failed",
    summary: "Kitchen printer did not acknowledge order ticket.",
  },
  {
    channels: [],
    createdAt: new Date(Date.now() - 82 * 60_000).toISOString(),
    emailRecipientCount: 0,
    errorMessage: "Route disabled",
    fallbackUsed: false,
    id: "alert_sample_3",
    kind: "sales",
    message: "Sales/vendor message - Olive & Ember",
    recipients: [],
    severity: "medium",
    smsRecipientCount: 0,
    status: "skipped",
    summary: "Vendor sales call logged without staff interruption.",
  },
];
const emptyAlertEvents: StaffAlertEvent[] = [];

const statusLabels: Record<TabKey, string> = {
  all: "All",
  failed: "Failed",
  sent: "Sent",
  skipped: "Skipped",
};

const kindLabels: Record<StaffAlertEvent["kind"], string> = {
  complaint: "Complaint",
  delivery_failure: "Delivery failure",
  handoff: "Handoff",
  low_confidence: "Low confidence",
  order: "Order",
  reservation: "Reservation",
  sales: "Sales",
};

function statusBadgeClass(status: StaffAlertEventStatus) {
  if (status === "sent") return "border-success/20 bg-success/10 text-success";
  if (status === "failed") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-warning/30 bg-warning/10 text-warning";
}

function kindBadgeClass(kind: StaffAlertEvent["kind"]) {
  if (kind === "complaint" || kind === "delivery_failure") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (kind === "order") return "border-primary/20 bg-primary/10 text-primary";
  if (kind === "reservation") return "border-success/20 bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
}

export default function AlertLog() {
  const [tab, setTab] = useState<TabKey>("all");
  const persistenceConfigured = isStaffAlertEventPersistenceConfigured();
  const alertQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: fetchStaffAlertEventsFromSupabase,
    queryKey: ["staff-alert-events", "supabase"],
    refetchInterval: 30_000,
  });
  const usingSupabase = Boolean(persistenceConfigured && alertQuery.isSuccess);
  const events = usingSupabase ? (alertQuery.data ?? emptyAlertEvents) : sampleAlertEvents;
  const filtered = tab === "all" ? events : events.filter((event) => event.status === tab);
  const counts = useMemo(
    () => ({
      all: events.length,
      failed: events.filter((event) => event.status === "failed").length,
      sent: events.filter((event) => event.status === "sent").length,
      skipped: events.filter((event) => event.status === "skipped").length,
    }),
    [events],
  );

  return (
    <>
      <PageHeader
        title="Alert Log"
        description="Audit staff alert routing, delivery, skipped routes, and failures"
        actions={
          <>
            <Badge variant="outline" className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {counts.failed > 0 && (
              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                {counts.failed} failed
              </Badge>
            )}
            {persistenceConfigured && (
              <Button size="sm" variant="outline" onClick={() => alertQuery.refetch()} disabled={alertQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${alertQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <Link to="/app/settings/alerts">
                <Settings className="mr-1.5 h-3.5 w-3.5" />
                Routing
              </Link>
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        {alertQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase alert events could not be loaded, so this page is showing sample data. {alertQuery.error instanceof Error ? alertQuery.error.message : ""}
          </Card>
        )}
        {!persistenceConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_SUPABASE_DEMO_LOCATION_ID to show live alert delivery events.
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={BellRing} label="Total alerts" value={counts.all.toString()} />
          <MetricCard icon={CheckCircle2} label="Sent" value={counts.sent.toString()} />
          <MetricCard icon={XCircle} label="Failed" value={counts.failed.toString()} />
          <MetricCard icon={AlertTriangle} label="Skipped" value={counts.skipped.toString()} />
        </div>

        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <TabsList>
            {(Object.keys(statusLabels) as TabKey[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {statusLabels[key]}
                <span className="ml-1.5 text-muted-foreground tabular-nums">{counts[key]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead>Time</TableHead>
                <TableHead>Route</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Summary</TableHead>
                <TableHead>Recipients</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Fallback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center">
                    <BellRing className="mx-auto h-8 w-8 text-muted-foreground/50" />
                    <p className="mt-2 text-sm font-medium">No alert events in this view</p>
                    <p className="text-xs text-muted-foreground">Alert delivery attempts will show up here once the voice service sends them.</p>
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="text-xs text-muted-foreground tabular-nums">{formatTime(event.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={kindBadgeClass(event.kind)}>
                      {kindLabels[event.kind]}
                    </Badge>
                    <div className="mt-1 text-[11px] capitalize text-muted-foreground">{event.severity}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadgeClass(event.status)}>
                      {event.status}
                    </Badge>
                    {event.errorMessage && (
                      <div className="mt-1 max-w-[13rem] truncate text-[11px] text-destructive" title={event.errorMessage}>
                        {event.errorMessage}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-sm">
                    <p className="line-clamp-2 text-sm">{event.summary}</p>
                    {event.callerPhone && (
                      <div className="mt-1 text-xs text-muted-foreground tabular-nums">{event.callerPhone}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{summarizeAlertRecipients(event.recipients)}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {event.smsRecipientCount} SMS / {event.emailRecipientCount} email
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {event.channels.length ? event.channels.map((channel) => (
                        <Badge key={channel} variant="secondary" className="text-[10px]">
                          {channel}
                        </Badge>
                      )) : (
                        <span className="text-xs text-muted-foreground">None</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={event.fallbackUsed ? "border-warning/30 bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}>
                      {event.fallbackUsed ? "Fallback" : "Route"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </PageBody>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof BellRing;
  label: string;
  value: string;
}) {
  return (
    <Card className="flex items-center gap-3 p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </div>
    </Card>
  );
}
