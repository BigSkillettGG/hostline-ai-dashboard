import { Link } from "react-router-dom";
import { ArrowRight, PhoneCall, ShoppingBag, CalendarDays, Sparkles, ShieldCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MarketingHome() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-accent/40 via-background to-background" />
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <Badge variant="outline" className="mb-5 border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="mr-1 h-3 w-3" /> AI phone host for restaurants
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight md:text-6xl">
            Never miss a call. Take orders, reservations, and questions — automatically.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            HostLine AI answers your restaurant's phone 24/7 with a warm, natural voice.
            Captures pickup orders, books reservations, answers FAQs, and routes the rest to your team.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/signup">Start free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/pricing">See pricing</Link>
            </Button>
            <span className="text-xs text-muted-foreground">No credit card · 14-day trial</span>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px bg-border px-0 md:grid-cols-4">
          {[
            { v: "98%", l: "Calls answered" },
            { v: "<2s", l: "Average pickup" },
            { v: "+27%", l: "Pickup orders captured" },
            { v: "24/7", l: "Always on" },
          ].map((s) => (
            <div key={s.l} className="bg-background px-5 py-6 text-center">
              <div className="text-2xl font-semibold tabular-nums md:text-3xl">{s.v}</div>
              <div className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 max-w-2xl">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Built for the dinner rush</h2>
          <p className="mt-2 text-muted-foreground">
            Set up in minutes. Forward your line. Your AI host handles the busy times so your team can focus on the floor.
          </p>
        </div>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { i: PhoneCall, t: "Answers every call", d: "Greets in your brand's tone, identifies as virtual, and never puts a guest on hold." },
            { i: ShoppingBag, t: "Takes pickup orders", d: "Reads from your menu, captures modifiers, confirms ETA, and sends you the ticket." },
            { i: CalendarDays, t: "Books reservations", d: "Integrated with OpenTable & Resy, or routed to staff for confirmation." },
          ].map((f) => (
            <Card key={f.t}>
              <CardContent className="p-5">
                <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <f.i className="h-4 w-4" />
                </div>
                <div className="text-sm font-semibold">{f.t}</div>
                <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust */}
      <section className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 md:grid-cols-3">
          {[
            { i: ShieldCheck, t: "Allergy & escalation aware", d: "Automatically routes allergy questions, complaints, and unusual requests to a human." },
            { i: Clock, t: "After-hours answers", d: "Hours, location, parking, dress code — answered any time, in your words." },
            { i: Sparkles, t: "Improves every week", d: "We tune your voice host based on real call transcripts and your feedback." },
          ].map((f) => (
            <div key={f.t}>
              <f.i className="mb-3 h-5 w-5 text-primary" />
              <div className="text-sm font-semibold">{f.t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Stop sending guests to voicemail.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Most restaurants miss 1 in 3 calls. HostLine AI picks up every one.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/signup">Start free trial</Link></Button>
          <Button asChild variant="outline" size="lg"><Link to="/pricing">View pricing</Link></Button>
        </div>
      </section>
    </>
  );
}
