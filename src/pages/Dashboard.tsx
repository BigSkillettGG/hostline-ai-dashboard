import { PageHeader, PageBody } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Phone, PhoneIncoming, ShoppingBag, CalendarDays, DollarSign, AlertCircle, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, callVolumeByHour, calls, orders, reservations, topIntents } from "@/data/mock";
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from "recharts";
import { formatTime, formatMoney } from "@/lib/format";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const peakHour = callVolumeByHour.reduce((m, c) => c.calls > m.calls ? c : m, callVolumeByHour[0]);

  const activity = [
    ...calls.slice(0, 4).map(c => ({ type: "call" as const, t: c.time, item: c })),
    ...orders.slice(0, 3).map(o => ({ type: "order" as const, t: o.createdAt, item: o })),
    ...reservations.slice(0, 2).map(r => ({ type: "reservation" as const, t: new Date().toISOString(), item: r })),
  ].sort((a, b) => +new Date(b.t) - +new Date(a.t)).slice(0, 8);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Today's activity for Olive & Ember · Valencia"
        actions={
          <>
            <Button variant="outline" size="sm">Export</Button>
            <Button size="sm">View calls</Button>
          </>
        }
      />
      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Calls answered" value={dashboardStats.callsAnswered.value} delta={dashboardStats.callsAnswered.delta} icon={Phone} />
          <StatCard label="Missed recovered" value={dashboardStats.missedRecovered.value} delta={dashboardStats.missedRecovered.delta} icon={PhoneIncoming} />
          <StatCard label="Orders captured" value={dashboardStats.ordersCaptured.value} delta={dashboardStats.ordersCaptured.delta} icon={ShoppingBag} />
          <StatCard label="Reservation requests" value={dashboardStats.reservationRequests.value} delta={dashboardStats.reservationRequests.delta} icon={CalendarDays} />
          <StatCard label="Revenue captured" value={dashboardStats.revenueCaptured.value} delta={dashboardStats.revenueCaptured.delta} icon={DollarSign} format="money" />
          <StatCard label="Needs review" value={dashboardStats.needsReview.value} delta={dashboardStats.needsReview.delta} icon={AlertCircle} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Call volume by hour</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Peak at <span className="font-medium text-foreground">{peakHour.hour}</span> · {peakHour.calls} calls
                  </p>
                </div>
                <Badge variant="secondary" className="text-[11px]">Today</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={callVolumeByHour} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                    <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      cursor={{ fill: "hsl(var(--muted))" }}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    />
                    <Bar dataKey="calls" radius={[4, 4, 0, 0]}>
                      {callVolumeByHour.map((c, i) => (
                        <Cell key={i} fill={c.hour === peakHour.hour ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.35)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Top intents</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">What callers asked for</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {topIntents.map(i => {
                const pct = (i.value / topIntents.reduce((s, x) => s + x.value, 0)) * 100;
                return (
                  <div key={i.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-muted-foreground tabular-nums">{i.value}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-md border border-border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-muted-foreground">Containment rate</div>
                    <div className="mt-0.5 text-lg font-semibold tabular-nums">86%</div>
                  </div>
                  <Badge variant="secondary" className="bg-success/15 text-success border-0">+4%</Badge>
                </div>
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
              <Link to="/calls" className="text-xs text-primary hover:underline">View all</Link>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-border">
              {activity.map((a, i) => (
                <li key={i} className="flex items-center gap-3 px-6 py-3 text-sm">
                  {a.type === "call" && (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-info/10 text-info"><Phone className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate"><span className="font-medium">{(a.item as any).caller}</span> · {(a.item as any).intent}</div>
                        <div className="text-xs text-muted-foreground truncate">{(a.item as any).summary}</div>
                      </div>
                    </>
                  )}
                  {a.type === "order" && (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary"><ShoppingBag className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate"><span className="font-medium">New order</span> · {(a.item as any).customer}</div>
                        <div className="text-xs text-muted-foreground">{formatMoney((a.item as any).total)} · ETA {(a.item as any).etaMinutes}m</div>
                      </div>
                    </>
                  )}
                  {a.type === "reservation" && (
                    <>
                      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/15 text-warning"><CalendarDays className="h-3.5 w-3.5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate"><span className="font-medium">{(a.item as any).guest}</span> · party of {(a.item as any).partySize}</div>
                        <div className="text-xs text-muted-foreground">{(a.item as any).date} at {(a.item as any).time}</div>
                      </div>
                    </>
                  )}
                  <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatTime(a.t)}</div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
