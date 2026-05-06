import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChefHat,
  Clock,
  Phone,
  RefreshCw,
  TabletSmartphone,
  Timer,
  Utensils,
} from "lucide-react";
import { PageBody, PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { orders as seed, type Order, type OrderDeliveryAttempt, type OrderStatus } from "@/data/mock";
import {
  buildKitchenDeliveryPayload,
  getKitchenActionLabel,
  getNextKitchenStatus,
  hasSentDeliveryAttempt,
  isActiveKitchenOrder,
  orderAgeMinutes,
  orderItemCount,
  sortKitchenTickets,
} from "@/domain/order-fulfillment";
import { formatMoney, formatTime } from "@/lib/format";
import {
  createOrderDeliveryAttemptInSupabase,
  fetchOrdersFromSupabase,
  isSupabaseConfigured,
  updateOrderStatusInSupabase,
} from "@/lib/supabase-rest";
import { toast } from "sonner";

type KitchenLaneStatus = Extract<OrderStatus, "new" | "accepted" | "in_progress">;

const lanes: Array<{
  accent: string;
  empty: string;
  label: string;
  status: KitchenLaneStatus;
}> = [
  {
    accent: "border-l-info",
    empty: "No new phone orders waiting.",
    label: "New",
    status: "new",
  },
  {
    accent: "border-l-warning",
    empty: "No accepted tickets waiting to start.",
    label: "Accepted",
    status: "accepted",
  },
  {
    accent: "border-l-primary",
    empty: "Nothing is cooking right now.",
    label: "In prep",
    status: "in_progress",
  },
];
const emptyOrders: Order[] = [];

function createLocalKitchenAttempt(): OrderDeliveryAttempt {
  const now = new Date().toISOString();
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `kitchen_${Date.now()}`;

  return {
    createdAt: now,
    deliveredAt: now,
    destination: "kitchen_tablet",
    id,
    status: "sent",
  };
}

function statusBadgeClass(status: OrderStatus) {
  if (status === "new") return "border-info/20 bg-info/10 text-info";
  if (status === "accepted") return "border-warning/30 bg-warning/10 text-warning";
  if (status === "in_progress") return "border-primary/20 bg-primary/10 text-primary";
  if (status === "completed") return "border-success/20 bg-success/10 text-success";
  return "bg-muted text-muted-foreground";
}

function etaLabel(order: Order) {
  const age = orderAgeMinutes(order);
  if (!order.etaMinutes) return `${age}m old`;
  const remaining = order.etaMinutes - age;
  if (remaining < 0) return `${Math.abs(remaining)}m late`;
  if (remaining === 0) return "Due now";
  return `${remaining}m left`;
}

function isLate(order: Order) {
  return Boolean(order.etaMinutes && orderAgeMinutes(order) > order.etaMinutes && order.status !== "completed");
}

export default function Kitchen() {
  const queryClient = useQueryClient();
  const [sampleOrders, setSampleOrders] = useState<Order[]>(seed);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const supabaseConfigured = isSupabaseConfigured();
  const orderQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchOrdersFromSupabase,
    queryKey: ["orders", "supabase"],
    refetchInterval: 10_000,
  });
  const usingSupabase = Boolean(supabaseConfigured && orderQuery.isSuccess);
  const orders = usingSupabase ? (orderQuery.data ?? emptyOrders) : sampleOrders;

  const activeOrders = useMemo(
    () => orders.filter(isActiveKitchenOrder).sort(sortKitchenTickets),
    [orders],
  );
  const completedOrders = useMemo(
    () => orders.filter((order) => order.status === "completed").sort(sortKitchenTickets).slice(0, 8),
    [orders],
  );
  const avgAge = activeOrders.length
    ? Math.round(activeOrders.reduce((sum, order) => sum + orderAgeMinutes(order), 0) / activeOrders.length)
    : 0;
  const phoneOrders = activeOrders.filter((order) => order.sourceCallId).length;
  const lateOrders = activeOrders.filter(isLate).length;

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatusInSupabase(id, status),
  });
  const deliveryMutation = useMutation({
    mutationFn: createOrderDeliveryAttemptInSupabase,
  });

  const updateLocalTicket = (order: Order, nextStatus: OrderStatus) => {
    const attempts = hasSentDeliveryAttempt(order, "kitchen_tablet") ? [] : [createLocalKitchenAttempt()];

    setSampleOrders((current) => current.map((ticket) => {
      if (ticket.id !== order.id) return ticket;

      return {
        ...ticket,
        deliveryAttempts: [...attempts, ...(ticket.deliveryAttempts ?? [])],
        destination: attempts.length ? "kitchen_tablet" : ticket.destination,
        status: nextStatus,
      };
    }));
  };

  const advanceTicket = async (order: Order) => {
    const nextStatus = getNextKitchenStatus(order.status);
    if (!nextStatus) return;

    if (!usingSupabase) {
      updateLocalTicket(order, nextStatus);
      toast.success(`${order.customer} moved to ${nextStatus.replace(/_/g, " ")}`);
      return;
    }

    setBusyOrderId(order.id);
    try {
      if (!hasSentDeliveryAttempt(order, "kitchen_tablet")) {
        await deliveryMutation.mutateAsync({
          destination: "kitchen_tablet",
          orderId: order.id,
          payload: buildKitchenDeliveryPayload(order, getKitchenActionLabel(order.status)),
          status: "sent",
        });
      }

      await statusMutation.mutateAsync({ id: order.id, status: nextStatus });
      await queryClient.invalidateQueries({ queryKey: ["orders", "supabase"] });
      toast.success(`${order.customer} moved to ${nextStatus.replace(/_/g, " ")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kitchen ticket update failed");
    } finally {
      setBusyOrderId(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Kitchen"
        description={`${activeOrders.length} active tickets / ${phoneOrders} from phone orders`}
        actions={
          <>
            <Badge variant="outline" className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {lateOrders > 0 && (
              <Badge variant="outline" className="border-destructive/20 bg-destructive/10 text-destructive">
                {lateOrders} late
              </Badge>
            )}
            {supabaseConfigured && (
              <Button variant="outline" size="sm" onClick={() => orderQuery.refetch()} disabled={orderQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${orderQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setShowCompleted((value) => !value)}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              {showCompleted ? "Hide ready" : "Show ready"}
            </Button>
          </>
        }
      />
      <PageBody className="space-y-4">
        {orderQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase kitchen tickets could not be loaded, so this page is showing sample data. {orderQuery.error instanceof Error ? orderQuery.error.message : ""}
          </Card>
        )}
        {!supabaseConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to run this tablet from live phone orders.
          </Card>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard icon={ChefHat} label="Active" value={activeOrders.length.toString()} />
          <MetricCard icon={Phone} label="Phone orders" value={phoneOrders.toString()} />
          <MetricCard icon={Timer} label="Avg age" value={`${avgAge}m`} />
          <MetricCard icon={TabletSmartphone} label="Tablet sync" value={usingSupabase ? "Live" : "Local"} />
        </div>

        <div className="grid gap-3 xl:grid-cols-3">
          {lanes.map((lane) => {
            const laneOrders = orders.filter((order) => order.status === lane.status).sort(sortKitchenTickets);
            return (
              <section key={lane.status} className="min-w-0 rounded-lg border border-border bg-muted/20 p-2">
                <div className="flex items-center justify-between px-1.5 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lane.label}</div>
                    <Badge variant="secondary" className="h-5 text-[10px] tabular-nums">{laneOrders.length}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  {laneOrders.length === 0 && (
                    <div className="rounded-md border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground">
                      {lane.empty}
                    </div>
                  )}
                  {laneOrders.map((order) => (
                    <KitchenTicketCard
                      key={order.id}
                      accent={lane.accent}
                      busy={busyOrderId === order.id}
                      onAdvance={advanceTicket}
                      order={order}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>

        {showCompleted && (
          <section className="rounded-lg border border-border bg-muted/20 p-2">
            <div className="flex items-center justify-between px-1.5 py-1.5">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready / completed</div>
              <Badge variant="secondary" className="h-5 text-[10px] tabular-nums">{completedOrders.length}</Badge>
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {completedOrders.length === 0 ? (
                <div className="rounded-md border border-dashed border-border/70 px-3 py-8 text-center text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
                  No completed tickets yet.
                </div>
              ) : (
                completedOrders.map((order) => (
                  <KitchenTicketCard
                    key={order.id}
                    accent="border-l-success"
                    busy={false}
                    onAdvance={advanceTicket}
                    order={order}
                  />
                ))
              )}
            </div>
          </section>
        )}
      </PageBody>
    </>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ChefHat;
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

function KitchenTicketCard({
  accent,
  busy,
  onAdvance,
  order,
}: {
  accent: string;
  busy: boolean;
  onAdvance: (order: Order) => void;
  order: Order;
}) {
  const nextStatus = getNextKitchenStatus(order.status);
  const tabletSynced = hasSentDeliveryAttempt(order, "kitchen_tablet");
  const late = isLate(order);

  return (
    <Card className={`border-l-2 ${accent} p-3 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-base font-semibold">{order.customer}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="tabular-nums">{formatTime(order.createdAt)}</span>
            {order.sourceCallId && (
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />
                Phone
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold tabular-nums">{formatMoney(order.total)}</div>
          <Badge variant="outline" className={`mt-1 ${statusBadgeClass(order.status)}`}>
            {order.status.replace(/_/g, " ")}
          </Badge>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Badge variant="secondary" className="gap-1 text-[11px]">
          <Utensils className="h-3 w-3" />
          {orderItemCount(order)} items
        </Badge>
        <Badge variant="outline" className={`gap-1 text-[11px] ${late ? "border-destructive/20 bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
          <Clock className="h-3 w-3" />
          {etaLabel(order)}
        </Badge>
        <Badge variant="outline" className={tabletSynced ? "border-success/20 bg-success/10 text-success text-[11px]" : "border-warning/30 bg-warning/10 text-warning text-[11px]"}>
          {tabletSynced ? "Tablet synced" : "Tablet not acked"}
        </Badge>
        {order.payAtPickup && (
          <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[11px]">
            Pay at pickup
          </Badge>
        )}
      </div>

      <div className="mt-3 divide-y divide-border rounded-md border border-border bg-background/60">
        {order.items.map((item, index) => (
          <div key={`${item.name}-${index}`} className="p-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">{item.qty}x {item.name}</div>
                {item.modifiers?.map((modifier) => (
                  <div key={modifier} className="text-xs text-muted-foreground">+ {modifier}</div>
                ))}
                {item.notes && <div className="mt-0.5 text-xs italic text-muted-foreground">"{item.notes}"</div>}
              </div>
              <div className="text-xs font-medium tabular-nums text-muted-foreground">
                {formatMoney(item.qty * item.price)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="mt-3 rounded-md border border-warning/30 bg-warning/10 p-2 text-xs text-warning">
          {order.notes}
        </div>
      )}

      <Button
        className="mt-3 h-11 w-full"
        disabled={!nextStatus || busy}
        onClick={() => onAdvance(order)}
      >
        {busy ? "Updating..." : getKitchenActionLabel(order.status)}
      </Button>
    </Card>
  );
}
