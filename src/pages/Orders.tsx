import { useState } from "react";
import { PageHeader, PageBody } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { orders as seed, type Order, type OrderStatus } from "@/data/mock";
import { formatMoney, formatTime } from "@/lib/format";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, Send, Clock, Phone, ShoppingBag } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

const columns: { key: OrderStatus; label: string; tint: string }[] = [
  { key: "new", label: "New", tint: "border-l-info" },
  { key: "accepted", label: "Accepted", tint: "border-l-warning" },
  { key: "in_progress", label: "In Progress", tint: "border-l-primary" },
  { key: "completed", label: "Completed", tint: "border-l-success" },
  { key: "canceled", label: "Canceled", tint: "border-l-muted-foreground/40" },
];

export default function Orders() {
  const [orders, setOrders] = useState<Order[]>(seed);
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [selected, setSelected] = useState<Order | null>(null);

  const advance = (id: string, dir: 1 | -1) => {
    const order = ["new", "accepted", "in_progress", "completed"];
    setOrders(os => os.map(o => {
      if (o.id !== id) return o;
      const i = order.indexOf(o.status);
      const next = order[Math.max(0, Math.min(order.length - 1, i + dir))];
      return { ...o, status: next as OrderStatus };
    }));
  };

  return (
    <>
      <PageHeader
        title="Orders"
        description={`${orders.filter(o => o.status !== "completed" && o.status !== "canceled").length} active · ${orders.length} today`}
        actions={
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList className="h-9">
              <TabsTrigger value="kanban" className="text-xs">Kanban</TabsTrigger>
              <TabsTrigger value="table" className="text-xs">Table</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      />
      <PageBody>
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
                    {items.map(o => (
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
                          {o.items.reduce((s, i) => s + i.qty, 0)} items
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {o.payAtPickup && <Badge variant="outline" className="border-warning/30 bg-warning/10 text-warning text-[10px]">Pay at pickup</Badge>}
                          {o.etaMinutes > 0 && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5"><Clock className="h-2.5 w-2.5" />{o.etaMinutes}m</Badge>
                          )}
                          {o.sourceCallId && <Badge variant="secondary" className="text-[10px] gap-0.5"><Phone className="h-2.5 w-2.5" />Call</Badge>}
                        </div>
                      </Card>
                    ))}
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
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(o => (
                  <TableRow key={o.id} className="cursor-pointer" onClick={() => setSelected(o)}>
                    <TableCell className="font-mono text-xs">{o.id}</TableCell>
                    <TableCell>
                      <div className="font-medium text-sm">{o.customer}</div>
                      <div className="text-xs text-muted-foreground">{o.phone}</div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{o.items.reduce((s, i) => s + i.qty, 0)}</TableCell>
                    <TableCell className="font-medium tabular-nums">{formatMoney(o.total)}</TableCell>
                    <TableCell className="text-sm tabular-nums">{o.etaMinutes ? `${o.etaMinutes}m` : "—"}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{o.status.replace(/_/g, " ")}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatTime(o.createdAt)}</TableCell>
                  </TableRow>
                ))}
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

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-muted-foreground">Pickup ETA (minutes)</label>
                    <Input type="number" defaultValue={selected.etaMinutes} className="mt-1 h-9" />
                  </div>
                  <Button size="sm" variant="outline" onClick={() => toast.success("ETA updated")}>Update</Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => { advance(selected.id, 1); toast.success("Advanced"); }}>Advance status</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success("Sent to printer")}><Printer className="mr-1.5 h-3.5 w-3.5" />Print</Button>
                  <Button size="sm" variant="outline" onClick={() => toast.success("SMS sent")}><Send className="mr-1.5 h-3.5 w-3.5" />Send SMS</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
