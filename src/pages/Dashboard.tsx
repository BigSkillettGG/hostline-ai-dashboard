import { PageBody } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import {
  Phone, PhoneIncoming, ShoppingBag, CalendarDays, DollarSign,
  AlertCircle, Activity, ArrowRight, Sparkles, Calendar,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, callVolumeByHour, calls, orders, reservations, topIntents } from "@/data/mock";
import {
  Area, AreaChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from "recharts";
import { formatTime, formatMoney } from "@/lib/format";
import { Link } from "react-router-dom";

const intentColor: Record<string, string> = {
  order: "text-primary",
  reservation: "text-warning",
  faq: "text-info",
  hours: "text-info",
  other: "text-muted-foreground",
};

export default function Dashboard() {
  const peakHour = callVolumeByHour.reduce((m, c) => c.calls > m.calls ? c : m, callVolumeByHour[0]);
  const totalCalls = callVolumeByHour.reduce((s, c) => s + c.calls, 0);

  const activity = [
    ...calls.slice(0, 5).map(c => ({ type: "call" as const, t: c.time, item: c })),
    ...orders.slice(0, 4).map(o => ({ type: "order" as const, t: o.createdAt, item: o })),
    ...reservations.slice(0, 3).map((r, i) => ({ type: "reservation" as const, t: new Date(Date.now() - (i + 1) * 18 * 60_000).toISOString(), item: r })),
  ].sort((a, b) => +new Date(b.t) - +new Date(a.t)).slice(0, 8);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      {/* Polished hero header */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/5 via-background to-background">
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="absolute right-1/3 -bottom-32 h-64 w-64 rounded-full bg-warning/10 blur-3xl pointer-events-none" />
        <div className="relative px-4 py-6 md:px-6 md:py-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>{today}</span>
                <span className="mx-1.5 h-1 w-1 rounded-full bg-muted-foreground/40" />
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                  AI host live
                </span>
              </div>
              <h1 className="mt-1.5 text-[26px] md:text-[28px] font-semibold tracking-tight">
                Good evening, Maria
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Vera handled <span className="font-medium text-foreground tabular-nums">{totalCalls}</span> calls today and captured{" "}
                <span className="font-medium text-foreground">{formatMoney(dashboardStats.revenueCaptured.value)}</span> in revenue.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-card/80 px-3 py-2 shadow-sm backdrop-blur">
                <div className="relative">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-sm font-semibold text-primary-foreground">
                    V
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
                </div>
                <div className="leading-tight">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    Vera is answering
                  </div>
                  <a href="tel:+14155550142" className="block text-sm font-semibold tabular-nums tracking-tight hover:text-primary">
                    (415) 555-0142
                  </a>
                </div>
              </div>
              <Button variant="outline" size="sm">Export report</Button>
              <Button size="sm" asChild>
                <Link to="/app/calls">View calls<ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <PageBody className="space-y-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Calls answered" value={dashboardStats.callsAnswered.value} delta={dashboardStats.callsAnswered.delta} icon={Phone} accent />
          <StatCard label="Missed recovered" value={dashboardStats.missedRecovered.value} delta={dashboardStats.missedRecovered.delta} icon={PhoneIncoming} />
          <StatCard label="Orders captured" value={dashboardStats.ordersCaptured.value} delta={dashboardStats.ordersCaptured.delta} icon={ShoppingBag} />
          <StatCard label="Reservation requests" value={dashboardStats.reservationRequests.value} delta={dashboardStats.reservationRequests.delta} icon={CalendarDays} />
          <StatCard label="Revenue captured" value={dashboardStats.revenueCaptured.value} delta={dashboardStats.revenueCaptured.delta} icon={DollarSign} format="money" />
          <StatCard label="Needs review" value={dashboardStats.needsReview.value} delta={dashboardStats.needsReview.delta} icon={AlertCircle} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Call volume</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Peak at <span className="font-medium text-foreground">{peakHour.hour}</span> · {peakHour.calls} calls · {totalCalls} total today
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
                  <button className="rounded px-2 py-1 text-[11px] font-medium bg-muted">Today</button>
                  <button className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50">7d</button>
                  <button className="rounded px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted/50">30d</button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={callVolumeByHour} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
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
                        fontSize: 12,
                        boxShadow: "0 4px 12px hsl(var(--foreground) / 0.08)",
                      }}
                      labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      formatter={(v: number) => [`${v} calls`, ""]}
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
                  <p className="mt-0.5 text-xs text-muted-foreground">What callers asked for</p>
                </div>
                <Sparkles className="h-4 w-4 text-primary/60" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {topIntents.map(i => {
                const total = topIntents.reduce((s, x) => s + x.value, 0);
                const pct = (i.value / total) * 100;
                return (
                  <div key={i.name}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium">{i.name}</span>
                      <span className="text-muted-foreground tabular-nums">{i.value} · {Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-primary-glow transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="mt-4 rounded-lg border border-success/20 bg-success/5 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Containment</div>
                    <div className="mt-0.5 text-2xl font-semibold tabular-nums text-success">86%</div>
                  </div>
                  <Badge variant="secondary" className="bg-success/15 text-success border-0">+4%</Badge>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Calls fully resolved without staff handoff
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
            <ul className="divide-y divide-border">
              {activity.map((a, i) => (
                <li key={i} className="group flex items-center gap-3 px-6 py-3 text-sm transition-colors hover:bg-muted/30">
                  {a.type === "call" && (
                    <>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-info/10 text-info ring-4 ring-info/5">
                        <Phone className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">
                          <span className="font-medium">{(a.item as any).caller}</span>
                          <span className={`ml-2 text-xs font-medium capitalize ${intentColor[(a.item as any).intent]}`}>{(a.item as any).intent}</span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{(a.item as any).summary}</div>
                      </div>
                    </>
                  )}
                  {a.type === "order" && (
                    <>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary ring-4 ring-primary/5">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate"><span className="font-medium">New order</span> · {(a.item as any).customer}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney((a.item as any).total)} · ETA {(a.item as any).etaMinutes}m
                        </div>
                      </div>
                    </>
                  )}
                  {a.type === "reservation" && (
                    <>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-warning/15 text-warning ring-4 ring-warning/5">
                        <CalendarDays className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate"><span className="font-medium">{(a.item as any).guest}</span> · party of {(a.item as any).partySize}</div>
                        <div className="text-xs text-muted-foreground">{(a.item as any).date} at {(a.item as any).time}</div>
                      </div>
                    </>
                  )}
                  <div className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{formatTime(a.t)}</div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
