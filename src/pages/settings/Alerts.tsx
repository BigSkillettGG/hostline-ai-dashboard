import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeAlert,
  Briefcase,
  CalendarDays,
  Gauge,
  MessageCircleWarning,
  PhoneForwarded,
  Plus,
  RefreshCw,
  Save,
  ShoppingBag,
  Trash2,
  Truck,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  alertRouteMetas,
  createEmptyRecipient,
  defaultAlertRoutingConfig,
  normalizeAlertRoutingConfig,
  resolveAlertRoute,
  type AlertChannel,
  type AlertRecipient,
  type AlertRouteKind,
  type AlertRoutingConfig,
  type AlertSeverity,
} from "@/domain/alert-routing";
import {
  fetchAlertRoutingConfigFromSupabase,
  isAlertRoutingPersistenceConfigured,
  saveAlertRoutingConfigToSupabase,
} from "@/lib/supabase-rest";
import { toast } from "sonner";

const STORAGE_KEY = "signalhost.alertRouting";

const routeIcons: Record<AlertRouteKind, typeof BadgeAlert> = {
  complaint: MessageCircleWarning,
  delivery_failure: Truck,
  handoff: PhoneForwarded,
  low_confidence: Gauge,
  order: ShoppingBag,
  reservation: CalendarDays,
  sales: Briefcase,
};

const routeAccents: Record<AlertRouteKind, string> = {
  complaint: "text-destructive",
  delivery_failure: "text-destructive",
  handoff: "text-info",
  low_confidence: "text-warning",
  order: "text-primary",
  reservation: "text-success",
  sales: "text-warning",
};

export default function Alerts() {
  const queryClient = useQueryClient();
  const persistenceConfigured = isAlertRoutingPersistenceConfigured();
  const [config, setConfig] = useState<AlertRoutingConfig>(() => readLocalConfig());

  const routingQuery = useQuery({
    enabled: persistenceConfigured,
    queryFn: fetchAlertRoutingConfigFromSupabase,
    queryKey: ["alert-routing", "supabase"],
  });

  useEffect(() => {
    if (routingQuery.isSuccess) {
      setConfig(routingQuery.data ?? defaultAlertRoutingConfig);
    }
  }, [routingQuery.data, routingQuery.isSuccess]);

  const saveMutation = useMutation({
    mutationFn: saveAlertRoutingConfigToSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Alert routing save failed");
    },
    onSuccess: async (savedConfig) => {
      setConfig(savedConfig);
      writeLocalConfig(savedConfig);
      await queryClient.invalidateQueries({ queryKey: ["alert-routing", "supabase"] });
      toast.success("Alert routing saved");
    },
  });

  const enabledRoutes = alertRouteMetas.filter((route) => config.routes[route.kind]?.enabled).length;
  const recipientCount = alertRouteMetas.reduce(
    (sum, route) => sum + (config.routes[route.kind]?.recipients.filter((recipient) => recipient.email || recipient.phone).length ?? 0),
    0,
  );
  const smsRouteCount = useMemo(
    () => alertRouteMetas.filter((route) => resolveAlertRoute(config, route.kind, "high").smsRecipients.length > 0).length,
    [config],
  );

  const updateRoute = (kind: AlertRouteKind, patch: Partial<AlertRoutingConfig["routes"][AlertRouteKind]>) => {
    setConfig((current) => ({
      ...current,
      routes: {
        ...current.routes,
        [kind]: {
          ...current.routes[kind],
          ...patch,
        },
      },
    }));
  };

  const addRecipient = (kind: AlertRouteKind) => {
    updateRoute(kind, {
      recipients: [...config.routes[kind].recipients, createEmptyRecipient()],
    });
  };

  const updateRecipient = (kind: AlertRouteKind, id: string, patch: Partial<AlertRecipient>) => {
    updateRoute(kind, {
      recipients: config.routes[kind].recipients.map((recipient) =>
        recipient.id === id ? { ...recipient, ...patch } : recipient,
      ),
    });
  };

  const removeRecipient = (kind: AlertRouteKind, id: string) => {
    updateRoute(kind, {
      recipients: config.routes[kind].recipients.filter((recipient) => recipient.id !== id),
    });
  };

  const save = () => {
    const normalized = normalizeAlertRoutingConfig(config);

    if (persistenceConfigured) {
      saveMutation.mutate(normalized);
      return;
    }

    writeLocalConfig(normalized);
    setConfig(normalized);
    toast.success("Alert routing saved locally");
  };

  return (
    <>
      <PageHeader
        title="Alerts & Routing"
        description="Choose who gets notified for orders, complaints, handoffs, delivery failures, and review risks"
        actions={
          <>
            <Badge variant="outline" className={persistenceConfigured ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {persistenceConfigured ? "Live Supabase" : "Local settings"}
            </Badge>
            {persistenceConfigured && (
              <Button variant="outline" size="sm" onClick={() => routingQuery.refetch()} disabled={routingQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${routingQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Button size="sm" onClick={save} disabled={saveMutation.isPending}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save changes
            </Button>
          </>
        }
      />
      <PageBody className="space-y-5">
        {routingQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase alert routing could not be loaded, so this page is showing local settings. {routingQuery.error instanceof Error ? routingQuery.error.message : ""}
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-3">
          <SummaryCard label="Enabled routes" value={enabledRoutes.toString()} />
          <SummaryCard label="Recipients" value={recipientCount.toString()} />
          <SummaryCard label="SMS-backed routes" value={smsRouteCount.toString()} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {alertRouteMetas.map((route) => {
            const Icon = routeIcons[route.kind];
            const rule = config.routes[route.kind];
            const resolved = resolveAlertRoute(config, route.kind, "high");

            return (
              <Card key={route.kind}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Icon className={`h-4 w-4 ${routeAccents[route.kind]}`} />
                        {route.label}
                      </CardTitle>
                      <p className="mt-1 text-xs text-muted-foreground">{route.description}</p>
                    </div>
                    <Switch checked={rule.enabled} onCheckedChange={(enabled) => updateRoute(route.kind, { enabled })} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-md border border-border p-3">
                      <Label className="text-xs">Severity threshold</Label>
                      <Select
                        value={rule.severityThreshold}
                        onValueChange={(severityThreshold) =>
                          updateRoute(route.kind, { severityThreshold: severityThreshold as AlertSeverity })
                        }
                      >
                        <SelectTrigger className="mt-2 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low and above</SelectItem>
                          <SelectItem value="medium">Medium and above</SelectItem>
                          <SelectItem value="high">High only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between rounded-md border border-border p-3">
                      <div>
                        <div className="text-sm font-medium">Quiet hours</div>
                        <div className="text-xs text-muted-foreground">Hold non-urgent alerts for staff review.</div>
                      </div>
                      <Switch
                        checked={rule.quietHoursEnabled}
                        onCheckedChange={(quietHoursEnabled) => updateRoute(route.kind, { quietHoursEnabled })}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                      {resolved.smsRecipients.length} SMS
                    </Badge>
                    <Badge variant="secondary" className="text-[11px]">
                      {resolved.emailRecipients.length} email/webhook
                    </Badge>
                    {!rule.enabled && (
                      <Badge variant="outline" className="bg-muted text-[11px] text-muted-foreground">
                        Disabled
                      </Badge>
                    )}
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</div>
                    <RecipientList
                      kind={route.kind}
                      onAdd={addRecipient}
                      onRemove={removeRecipient}
                      onUpdate={updateRecipient}
                      recipients={rule.recipients}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}

function RecipientList({
  kind,
  onAdd,
  onRemove,
  onUpdate,
  recipients,
}: {
  kind: AlertRouteKind;
  onAdd: (kind: AlertRouteKind) => void;
  onRemove: (kind: AlertRouteKind, id: string) => void;
  onUpdate: (kind: AlertRouteKind, id: string, patch: Partial<AlertRecipient>) => void;
  recipients: AlertRecipient[];
}) {
  return (
    <div className="space-y-2">
      {recipients.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
          No recipients yet. Add at least one person before enabling this route.
        </div>
      )}
      {recipients.map((recipient) => (
        <div key={recipient.id} className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-12">
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Name</Label>
            <Input
              className="h-9"
              onChange={(event) => onUpdate(kind, recipient.id, { name: event.target.value })}
              placeholder="Manager name"
              value={recipient.name}
            />
          </div>
          <div className="space-y-1 sm:col-span-3">
            <Label className="text-xs">Phone</Label>
            <Input
              className="h-9"
              onChange={(event) => onUpdate(kind, recipient.id, { phone: event.target.value })}
              placeholder="+1 415-555-0000"
              value={recipient.phone}
            />
          </div>
          <div className="space-y-1 sm:col-span-4">
            <Label className="text-xs">Email</Label>
            <Input
              className="h-9"
              onChange={(event) => onUpdate(kind, recipient.id, { email: event.target.value })}
              placeholder="manager@restaurant.com"
              value={recipient.email}
            />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label className="text-xs">Channel</Label>
            <div className="flex items-center gap-1">
              <Select
                value={recipient.channel}
                onValueChange={(channel) => onUpdate(kind, recipient.id, { channel: channel as AlertChannel })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
              <Button
                className="h-9 w-9 shrink-0 text-destructive"
                onClick={() => onRemove(kind, recipient.id)}
                size="icon"
                variant="ghost"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      ))}
      <Button size="sm" variant="outline" onClick={() => onAdd(kind)}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add recipient
      </Button>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </Card>
  );
}

function readLocalConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeAlertRoutingConfig(JSON.parse(raw)) : defaultAlertRoutingConfig;
  } catch {
    return defaultAlertRoutingConfig;
  }
}

function writeLocalConfig(config: AlertRoutingConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
