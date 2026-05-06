import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  orders as seed,
  type Order,
  type OrderDeliveryAttempt,
  type OrderDeliveryDestination,
  type OrderStatus,
} from "@/data/mock";
import { formatMoney, formatTime } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Send, Clock, Phone, ShoppingBag, RefreshCw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  createOrderDeliveryAttemptInSupabase,
  fetchOrdersFromSupabase,
  isSupabaseConfigured,
  updateOrderStatusInSupabase,
} from "@/lib/supabase-rest";

const columns: { key: OrderStatus; label: string; tint: string }[] = [
  { key: "new", label: "New", tint: "border-l-info" },
  { key: "accepted", label: "Accepted", tint: "border-l-warning" },
  { key: "in_progress", label: "In Progress", tint: "border-l-primary" },
  { key: "completed", label: "Completed", tint: "border-l-success" },
  { key: "canceled", label: "Canceled", tint: "border-l-muted-foreground/40" },
];
const orderFlow: OrderStatus[] = ["new", "accepted", "in_progress", "completed"];

const deliveryDestinationLabels: Record<string, string> = {
  kitchen_tablet: "Kitchen tablet",
  pos: "POS",
  printer: "Kitchen printer",
  staff_review: "Staff queue",
};

const deliveryStatusLabels: Record<string, string> = {
  failed: "Failed",
  not_configured: "Not configured",
  pending: "Pending",
  sent: "Sent",
};

function deliveryLabel(destination: string) {
  return deliveryDestinationLabels[destination] ?? destination.replace(/_/g, " ");
}

function deliveryBadgeClass(status?: string) {
  if (status === "sent") return "border-success/20 bg-success/10 text-success";
  if (status === "failed") return "border-destructive/20 bg-destructive/10 text-destructive";
  if (status === "not_configured") return "border-warning/30 bg-warning/10 text-warning";
  return "border-info/20 bg-info/10 text-info";
}

function attemptTimestamp(attempt: OrderDeliveryAttempt) {
  return new Date(attempt.deliveredAt ?? attempt.createdAt ?? 0).getTime();
}

function deliveryAttemptsFor(order: Order) {
  return [...(order.deliveryAttempts ?? [])].sort((a, b) => attemptTimestamp(b) - attemptTimestamp(a));
}

function latestDeliveryAttempt(order: Order) {
  return deliveryAttemptsFor(order)[0];
}

function orderItemCount(order: Order) {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

function createLocalDeliveryAttempt(destination: OrderDeliveryDestination): OrderDeliveryAttempt {
  const now = new Date().toISOString();
  const randomId = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `delivery_${Date.now()}`;

  return {
    createdAt: now,
    deliveredAt: now,
    destination,
    id: randomId,
    status: "sent",
  };
}

export default function Orders() {
  const queryClient = useQueryClient();
  const [sampleOrders, setSampleOrders] = useState<Order[]>(seed);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selected, setSelected] = useState<Order | null>(null);
  const supabaseConfigured = isSupabaseConfigured();
  const orderQuery = useQuery({
    enabled: supabaseConfigured,
    queryFn: fetchOrdersFromSupabase,
    queryKey: ["orders", "supabase"],
    refetchInterval: 30_000,
  });
  const usingSupabase = Boolean(supabaseConfigured && orderQuery.isSuccess);
  const orders = usingSupabase ? (orderQuery.data ?? []) : sampleOrders;
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: OrderStatus }) => updateOrderStatusInSupabase(id, status),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Order status update failed");
    },
    onSuccess: async (_, variables) => {
      setSelected((current) => current?.id === variables.id ? { ...current, status: variables.status } : current);
      await queryClient.invalidateQueries({ queryKey: ["orders", "supabase"] });
      toast.success("Order status updated");
    },
  });
  const deliveryMutation = useMutation({
    mutationFn: createOrderDeliveryAttemptInSupabase,
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Order delivery update failed");
    },
    onSuccess: async (attempt, variables) => {
      if (attempt) {
        setSelected((current) => current?.id === variables.orderId
          ? {
              ...current,
              deliveryAttempts: [attempt, ...(current.deliveryAttempts ?? [])],
              destination: variables.destination,
            }
          : current);
      }
      await queryClient.invalidateQueries({ queryKey: ["orders", "supabase"] });
      toast.success(`${deliveryLabel(variables.destination)} delivery recorded`);
    },
  });

  const advance = (id: string, dir: 1 | -1) => {
    const order = orders.find((item) => item.id === id);
    if (!order) return;

    const i = orderFlow.indexOf(order.status);
    const next = orderFlow[Math.max(0, Math.min(orderFlow.length - 1, i + dir))];
    if (!next || next === order.status) return;

    if (usingSupabase) {
      statusMutation.mutate({ id, status: next });
      return;
    }

    setSampleOrders(os => os.map(o => {
      if (o.id !== id) return o;
      return { ...o, status: next };
    }));
    setSelected((current) => current?.id === id ? { ...current, status: next } : current);
    toast.success("Advanced");
  };

  const sendOrderToDestination = (order: Order, destination: OrderDeliveryDestination) => {
    if (usingSupabase) {
      deliveryMutation.mutate({
        destination,
        orderId: order.id,
        payload: {
          itemCount: orderItemCount(order),
          orderStatus: order.status,
          source: "dashboard",
          total: order.total,
        },
        status: "sent",
      });
      return;
    }

    const attempt = createLocalDeliveryAttempt(destination);
    setSampleOrders((current) => current.map((item) => {
      if (item.id !== order.id) return item;
      return {
        ...item,
        deliveryAttempts: [attempt, ...(item.deliveryAttempts ?? [])],
        destination,
      };
    }));
    setSelected((current) => current?.id === order.id
      ? {
          ...current,
          deliveryAttempts: [attempt, ...(current.deliveryAttempts ?? [])],
          destination,
        }
      : current);
    toast.success(`${deliveryLabel(destination)} delivery recorded`);
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${orders.filter(o => o.status !== "completed" && o.status !== "canceled").length} active · ${orders.length} today`}
        actions={
          <>
            <Badge variant="outline" className={usingSupabase ? "border-success/20 bg-success/10 text-success" : "bg-muted text-muted-foreground"}>
              {usingSupabase ? "Live Supabase" : "Sample data"}
            </Badge>
            {supabaseConfigured && (
              <Button variant="outline" size="sm" onClick={() => orderQuery.refetch()} disabled={orderQuery.isFetching}>
                <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${orderQuery.isFetching ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            )}
            <Tabs value={view} onValueChange={(v) => setView(v as any)}>
              <TabsList className="h-9">
                <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
                <TabsTrigger value="table" className="text-xs">Table</TabsTrigger>
              </TabsList>
            </Tabs>
          </>
        }
      />
      <PageBody className="space-y-4">
        {orderQuery.isError && (
          <Card className="border-warning/30 bg-warning/10 p-3 text-sm text-muted-foreground">
            Supabase orders could not be loaded, so this page is showing sample data. {orderQuery.error instanceof Error ? orderQuery.error.message : ""}
          </Card>
        )}
        {!supabaseConfigured && (
          <Card className="border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
            Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to show real orders from Supabase.
          </Card>
        )}
        {view === "kanban" ? (
          <div className="grid gap-3 lg:grid-cols-5">
            {columns.map(col => {
              const items = orders.filter(o => o.status === col.key);
              return (
                <div key={col.key} className="flex flex-col rounded-lg border border-border bg-muted/20 p-2">
                  <div className="flex items-center justify-between px-1.5 py-1.5">
                    <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{col.label}</div>
                    <Badge variant="secondary" className="h-5 text-[10px] tabular-nums">{items.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {items.length === 0 && (
                      <div className="rounded-md border border-dashed border-border/60 px-3 py-6 text-center text-xs text-muted-foreground">
                        Empty
                      </div>
                    )}
                    {items.map(o => {
                      const delivery = latestDeliveryAttempt(o);
                      return (
                        <Card
                          key={o.id}
                          className={`cursor-pointer border-l-2 ${col.tint} p-3 hover:shadow-sm transition-shadow`}
                          onClick={() => setSelected(o)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">{o.customer}</div>
                              <div className="text-xs text-muted-foreground tabular-nums">{o.phone}</div>
                            </div>
                            <div className="text-sm font-semibold tabular-nums">{formatMoney(o.total)}</div>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {orderItemCount(o)} items
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {delivery && (
                              <Badge variant="outline" className={`text-[10px] ${deliveryBadgeClass(delivery.status)}`}>
                                {deliveryLabel(delivery.destination)} {deliveryStatusLabels[delivery.status] ?? delivery.status}
                              </Badge>
                            )}
                            {o.payAtPickup && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">Pay at pickup</Badge>}
                            {o.etaMinutes > 0 && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5"><Clock className="h-2.5 w-2.5" />{o.etaMinutes}m</Badge>
                            )}
                            {o.sourceCallId && <Badge variant="secondary" className="text-[10px] gap-0.5"><Phone className="h-2.5 w-2.5" />Call</Badge>}
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Delivery</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => {
                  const delivery = latestDeliveryAttempt(o);
                  return (
                    <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{o.customer}</div>
                      <div className="text-xs text-muted-foreground">{o.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{orderItemCount(o)}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatMoney(o.total)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{o.etaMinutes ? `${o.etaMinutes}m` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{o.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell>
                      {delivery ? (
                        <Badge variant="outline" className={deliveryBadgeClass(delivery.status)}>
                          {deliveryLabel(delivery.destination)}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not sent</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        )}
      </PageBody>

      <Sheet open={!!selected} onOpenChange={o => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Order {selected.id}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div className="rounded-md border border-border p-3">
                  <div className="text-xs font-medium text-muted-foreground">Customer</div>
                  <div className="mt-1 font-medium">{selected.customer}</div>
                  <div className="text-sm text-muted-foreground tabular-nums">{selected.phone}</div>
                  {selected.sourceCallId && (
                    <div className="mt-2 inline-flex items-center gap-1 text-xs text-info">
                      <Phone className="h-3 w-3" />
                      Source call: {selected.sourceCallId}
                    </div>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</div>
                  <div className="divide-y divide-border rounded-md border border-border">
                    {selected.items.map((it, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{it.qty}× {it.name}</div>
                          {it.modifiers?.map((m, j) => (
                            <div key={j} className="text-xs text-muted-foreground">+ {m}</div>
                          ))}
                          {it.notes && <div className="mt-0.5 text-xs italic text-muted-foreground">"{it.notes}"</div>}
                        </div>
                        <div className="text-sm font-medium tabular-nums">{formatMoney(it.qty * it.price)}</div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-muted/30">
                      <div className="text-sm font-semibold">Total</div>
                      <div className="text-base font-semibold tabular-nums">{formatMoney(selected.total)}</div>
                    </div>
                  </div>
                  {selected.payAtPickup && (
                    <Badge variant="outline" className="mt-3 border-warning/30 bg-warning/10 text-warning">Pay at pickup</Badge>
                  )}
                </div>

                <div className="rounded-md border border-border">
                  <div className="flex items-center justify-between border-b border-border px-3 py-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery</div>
                    {latestDeliveryAttempt(selected) ? (
                      <Badge variant="outline" className={deliveryBadgeClass(latestDeliveryAttempt(selected)?.status)}>
                        {deliveryLabel(latestDeliveryAttempt(selected)?.destination ?? "staff_review")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-muted text-muted-foreground">Not sent</Badge>
                    )}
                  </div>
                  <div className="divide-y divide-border">
                    {deliveryAttemptsFor(selected).length ? (
                      deliveryAttemptsFor(selected).slice(0, 4).map((attempt) => (
                        <div key={attempt.id} className="flex items-start justify-between gap-3 p-3">
                          <div>
                            <div className="text-sm font-medium">{deliveryLabel(attempt.destination)}</div>
                            {attempt.errorMessage && (
                              <div className="mt-0.5 text-xs text-destructive">{attempt.errorMessage}</div>
                            )}
                          </div>
                          <div className="text-right">
                            <Badge variant="outline" className={deliveryBadgeClass(attempt.status)}>
                              {deliveryStatusLabels[attempt.status] ?? attempt.status}
                            </Badge>
                            {(attempt.deliveredAt || attempt.createdAt) && (
                              <div className="mt-1 text-[11px] text-muted-foreground">
                                {formatTime(attempt.deliveredAt ?? attempt.createdAt ?? "")}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground">
                        No delivery attempts yet. Send this order to the kitchen tablet or printer when staff is ready.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground">Pickup ETA (minutes)</label>
                    <Input type="number" defaultValue={selected.etaMinutes} className="mt-1 h-9" />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toast.success("ETA updated")}>Update</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => advance(selected.id, 1)} disabled={statusMutation.isPending}>Advance status</Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendOrderToDestination(selected, "printer")}
                    disabled={deliveryMutation.isPending}
                  >
                    <Printer className="mr-1.5 h-3.5 w-3.5" />
                    Send to printer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendOrderToDestination(selected, "kitchen_tablet")}
                    disabled={deliveryMutation.isPending}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    Send to tablet
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
