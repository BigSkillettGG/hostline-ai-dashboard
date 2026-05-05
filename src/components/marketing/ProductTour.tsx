import { useState } from "react";
import { CalendarDays, ShoppingBag, AlertTriangle, MessageCircleQuestion, MoonStar, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const TABS = [
  { id: "orders",       icon: ShoppingBag,         label: "Pickup orders" },
  { id: "reservations", icon: CalendarDays,        label: "Reservations" },
  { id: "faq",          icon: MessageCircleQuestion, label: "FAQs" },
  { id: "escalations",  icon: AlertTriangle,       label: "Complaints" },
  { id: "afterhours",   icon: MoonStar,            label: "After-hours" },
];

export function ProductTour() {
  const [active, setActive] = useState("orders");

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
                isActive
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden border-border/80 shadow-[0_1px_0_hsl(var(--border)),0_30px_60px_-30px_hsl(var(--foreground)/0.18)]">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="space-y-3 p-6 md:p-10">
            {active === "orders" && <Copy
              title="Pickup orders, captured cleanly."
              body="Vera reads from your live menu, handles modifiers and substitutions, confirms ETA, takes the customer's name, and sends the ticket straight to your POS."
              bullets={["Toast & Square integrations", "Upsell prompts you control", "Allergy questions auto-escalated"]}
            />}
            {active === "reservations" && <Copy
              title="Bookings without the back-and-forth."
              body="Quotes availability live from OpenTable or Resy, confirms party size and special requests, then texts the guest a confirmation."
              bullets={["Waitlist offered when full", "Group & private dining routed to manager", "Cancellation reminders"]}
            />}
            {active === "faq" && <Copy
              title="Knows your restaurant cold."
              body="Hours, parking, dress code, gluten-free options, kid policy, gift cards — answered instantly in your tone of voice, in any language."
              bullets={["Trained on your menu & policies", "EN, ES, and 26 more languages", "Updates in real time"]}
            />}
            {active === "escalations" && <Copy
              title="Detects upset callers in seconds."
              body="If a guest sounds frustrated or mentions a complaint, Vera offers a manager callback, captures the details, and texts the right person on your team — instantly."
              bullets={["Sentiment-aware routing", "Custom escalation rules", "Full transcript + recording attached"]}
            />}
            {active === "afterhours" && <Copy
              title="Working the phones while you sleep."
              body="At 11pm someone calls about a holiday booking. Vera takes the request, holds the date, and your manager sees it first thing."
              bullets={["24/7/365 coverage", "Holiday & special hours support", "Voicemails transcribed & summarized"]}
            />}
          </div>

          {/* mock UI */}
          <div className="bg-muted/30 p-6 md:p-10">
            <MockUI tab={active} />
          </div>
        </div>
      </Card>
    </div>
  );
}

function Copy({ title, body, bullets }: { title: string; body: string; bullets: string[] }) {
  return (
    <>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">In the dashboard</div>
      <h3 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h3>
      <p className="text-muted-foreground">{body}</p>
      <ul className="mt-4 space-y-2 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </>
  );
}

function MockUI({ tab }: { tab: string }) {
  if (tab === "orders") return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">New ticket · 7:42 PM</div>
      <div className="rounded-lg border border-border bg-background p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="font-semibold">Order #1042 · Marco P.</div>
          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">Confirmed</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Pickup · 8:15 PM · +1 (917) 555-0142</div>
        <div className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
          <Row qty={1} item="Margherita Pizza (lg)" price="18.00" />
          <Row qty={1} item="Caesar Salad — no anchovies" price="12.00" />
          <Row qty={1} item="House Red — bottle" price="28.00" />
        </div>
        <div className="mt-3 flex justify-between border-t border-border pt-3 text-sm font-semibold tabular-nums">
          <span>Total</span><span>$58.00</span>
        </div>
      </div>
    </div>
  );
  if (tab === "reservations") return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">New reservation</div>
      <div className="rounded-lg border border-border bg-background p-4 text-sm shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 flex-col items-center justify-center rounded-md bg-primary/10 text-primary">
            <span className="text-[10px] font-semibold uppercase">Sat</span>
            <span className="text-lg font-semibold leading-none">14</span>
          </div>
          <div>
            <div className="font-semibold">Priya Shah · party of 6</div>
            <div className="text-xs text-muted-foreground">7:30 PM · Birthday · gluten-free</div>
          </div>
        </div>
        <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs">
          "Could we get a quiet table near the window? It's my mom's 60th."
        </div>
      </div>
    </div>
  );
  if (tab === "faq") return (
    <div className="space-y-2">
      {[
        "What time do you close on Sundays?",
        "Do you have gluten-free pasta?",
        "Is there parking nearby?",
      ].map((q) => (
        <div key={q} className="rounded-lg border border-border bg-background p-3 text-sm shadow-sm">
          <div className="text-xs text-muted-foreground">Caller</div>
          <div className="font-medium">{q}</div>
          <div className="mt-1.5 text-xs text-success">✓ Answered by Vera · 2.1s</div>
        </div>
      ))}
    </div>
  );
  if (tab === "escalations") return (
    <div className="space-y-2">
      <div className="rounded-lg border-l-4 border-l-destructive border border-border bg-background p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="font-semibold text-destructive">⚠ Complaint detected</div>
          <span className="text-[11px] text-muted-foreground">just now</span>
        </div>
        <div className="mt-1 text-xs text-muted-foreground">Sentiment: angry · keywords: "wrong order", "refund"</div>
        <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs italic">
          "I ordered the salmon and got chicken. This is the second time…"
        </div>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">Texted manager</span>
          <span className="rounded-full bg-muted px-2 py-0.5">Recording attached</span>
        </div>
      </div>
    </div>
  );
  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-border bg-background p-4 text-sm shadow-sm">
        <div className="flex items-center justify-between">
          <div className="font-semibold">After-hours · 11:42 PM</div>
          <span className="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-medium text-info">Held</span>
        </div>
        <div className="mt-2 text-xs text-muted-foreground">Holiday booking inquiry — Dec 23, party of 12</div>
        <div className="mt-3 rounded-md bg-muted/40 p-2 text-xs">
          Vera: "We're closed right now, but I've put a soft hold on Dec 23 at 7pm. The owner will confirm by 10am."
        </div>
      </div>
    </div>
  );
}

function Row({ qty, item, price }: { qty: number; item: string; price: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span><span className="text-muted-foreground tabular-nums">{qty}×</span> {item}</span>
      <span className="tabular-nums text-muted-foreground">${price}</span>
    </div>
  );
}
