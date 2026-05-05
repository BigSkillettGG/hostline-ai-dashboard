import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, ShieldCheck, Zap, Languages, Lock, MessageSquare, Phone, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

import { SectionHeader } from "@/components/marketing/SectionHeader";
import { CallTranscriptCard } from "@/components/marketing/CallTranscriptCard";
import { MissedCallCalculator } from "@/components/marketing/MissedCallCalculator";
import { ProductTour } from "@/components/marketing/ProductTour";
import { ComparisonTable } from "@/components/marketing/ComparisonTable";
import { TestimonialCard } from "@/components/marketing/TestimonialCard";
import { LogoCloud } from "@/components/marketing/LogoCloud";
import { VoiceDemoPlayer } from "@/components/marketing/VoiceDemoPlayer";

import { testimonials, homeFaqs } from "@/data/marketing";

const heroRestaurant = "/marketing/hero-restaurant.jpg";
const hostOnPhone = "/marketing/host-on-phone.jpg";
const happyGuests = "/marketing/happy-guests.jpg";

export default function MarketingHome() {
  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-accent/50 via-background to-background" />
          <div className="absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute right-0 top-40 h-[380px] w-[380px] rounded-full bg-primary-glow/15 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{ backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)", backgroundSize: "22px 22px" }}
          />
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 pb-20 pt-16 md:pt-24 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <Badge variant="outline" className="mb-5 gap-1.5 border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" /> AI phone host for restaurants
            </Badge>
            <h1 className="text-[44px] font-semibold leading-[1.02] tracking-tight md:text-6xl lg:text-[76px]">
              Answer every call.<br />
              <span className="text-primary">Capture every order.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
              HostLine AI is the always-on phone host for your restaurant — taking pickup orders,
              booking tables, and routing complaints to a manager, 24/7.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/signup">Start free 14-day trial <ArrowRight className="ml-1 h-4 w-4" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                <a href="#live-demo"><Phone className="mr-1.5 h-4 w-4" /> Hear a sample call</a>
              </Button>
            </div>
            <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-success" /> No credit card</span>
              <span className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5 text-warning" /> Live in under 1 hour</span>
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5 text-info" /> SOC 2 ready</span>
            </div>

            {/* trust strip — honest version */}
            <div className="mt-12 border-t border-border pt-6">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Built for restaurants — works with the tools you already use
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted-foreground/70">
                {["Toast", "Square", "OpenTable", "Resy", "Twilio", "Stripe"].map((n) => (
                  <span key={n}>{n}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="relative lg:col-span-5">
            {/* faded restaurant backdrop */}
            <div className="pointer-events-none absolute -inset-6 -z-10 overflow-hidden rounded-3xl">
              <img
                src={heroRestaurant}
                alt=""
                aria-hidden
                className="h-full w-full object-cover opacity-30"
              />
              <div className="absolute inset-0 bg-gradient-to-br from-background/60 via-background/30 to-background/80" />
            </div>
            <CallTranscriptCard />
          </div>
        </div>
      </section>

      {/* LIVE DEMO */}
      <section id="live-demo" className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <SectionHeader
            eyebrow="Live demo"
            title="Real calls, answered by a restaurant-trained host."
            subtitle="Hear finished audio demos for parking questions and pickup orders, then preview the remaining call flows while we add the next recordings."
          />
          <div className="mt-10">
            <VoiceDemoPlayer />
          </div>
        </div>
      </section>

      {/* THE MATH OF A MISSED CALL */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <SectionHeader
            eyebrow="The cost of a missed call"
            title="Every unanswered ring is money walking out the door."
            subtitle="Independent restaurants miss 1 in 3 calls during peak hours. Most callers don't try again — they order from the place that picked up."
          />

          <div className="mt-10 grid grid-cols-3 gap-4 md:gap-8">
            {[
              { v: "62%", l: "of restaurant calls go unanswered during dinner rush" },
              { v: "85%", l: "of callers won't leave a voicemail or call back" },
              { v: "$1,400", l: "lost per week for the average 60-seat restaurant" },
            ].map((s) => (
              <div key={s.l} className="border-l-2 border-primary/40 pl-4 md:pl-6">
                <div className="text-3xl font-semibold tabular-nums tracking-tight md:text-5xl">{s.v}</div>
                <div className="mt-2 text-xs text-muted-foreground md:text-sm">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="mt-12">
            <MissedCallCalculator />
          </div>
        </div>
      </section>

      {/* PRODUCT TOUR */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <SectionHeader
            eyebrow="Product tour"
            title="One AI host. Every kind of call."
            subtitle="Vera handles the phone the way your best host would — only she works every shift, never gets flustered, and remembers every detail."
          />
          <div className="mt-10">
            <ProductTour />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <SectionHeader
                eyebrow="How it works"
                title="Live tonight. Seriously."
                subtitle="No new hardware. No phone trees. Most restaurants are answering calls with Vera within an hour of signing up."
              />
              <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
                {[
                  { n: "01", t: "Forward your line", d: "Keep your number. We give you a quick instruction for your carrier." },
                  { n: "02", t: "Upload your menu", d: "PDF, photo, or POS sync. Vera learns prices, modifiers, and specials." },
                  { n: "03", t: "Train Vera in 10 min", d: "Answer a few questions about hours, parking, allergens, and tone." },
                  { n: "04", t: "Go live", d: "Vera picks up the very next call. You get a live transcript and SMS alerts." },
                ].map((s) => (
                  <div key={s.n} className="relative bg-card p-5">
                    <div className="text-[11px] font-semibold tracking-wider text-primary">STEP {s.n}</div>
                    <div className="mt-2 text-base font-semibold">{s.t}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{s.d}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="relative overflow-hidden rounded-2xl border border-border shadow-[0_1px_0_hsl(var(--border)),0_30px_60px_-30px_hsl(var(--foreground)/0.25)]">
                <img
                  src={hostOnPhone}
                  alt="A friendly restaurant host smiling while answering the phone at a host stand"
                  loading="lazy"
                  className="h-[520px] w-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-foreground/85 via-foreground/40 to-transparent p-5 text-background">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-glow">Before HostLine</div>
                  <div className="mt-1 text-lg font-semibold">Your host is on the phone — not on the floor.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
          <SectionHeader
            eyebrow="vs. the alternatives"
            title="Cheaper than a host. Smarter than voicemail."
            subtitle="Compare the options most restaurants are using today."
          />
          <div className="mt-10">
            <ComparisonTable />
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="border-b border-border">
        {/* photo banner */}
        <div className="relative h-56 w-full overflow-hidden md:h-72">
          <img
            src={happyGuests}
            alt="Friends laughing together over dinner at a warm, candlelit restaurant"
            loading="lazy"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-background/10 via-background/40 to-background" />
        </div>

        <div className="mx-auto max-w-6xl px-5 pb-20 md:pb-28">
          <div className="-mt-16 md:-mt-24">
            <SectionHeader
              eyebrow="What operators say"
              title="Operators who picked up the phone — and a lot more orders."
            />
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {testimonials.map((t) => <TestimonialCard key={t.name} {...t} />)}
          </div>

          {/* qualitative "why operators switch" — replaces fabricated metrics */}
          <div className="mt-14 rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-6 md:p-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Why operators switch to HostLine
            </div>
            <div className="mt-5 grid gap-6 md:grid-cols-3">
              {[
                { t: "Never miss a dinner-rush call",  d: "When the line is busy or no one can pick up, Vera answers — instantly, every time." },
                { t: "Free up your host for the floor", d: "Your team stops juggling the phone and gets back to greeting and seating real guests." },
                { t: "Capture pickup orders 24/7",      d: "Late-night cravings, lunch crowds, holidays — Vera works every shift you'd rather not." },
              ].map((m) => (
                <div key={m.t}>
                  <div className="text-base font-semibold">{m.t}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{m.d}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* SECURITY */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
          <SectionHeader
            eyebrow="Built for restaurants — taken seriously"
            title="Safe handoffs. Honest disclosure. Real privacy."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {[
              { i: ShieldCheck, t: "Allergy & complaint escalation", d: "Vera detects allergy questions, complaints, and unusual asks — and routes them to a real person on your team in seconds." },
              { i: MessageSquare, t: "Honest AI disclosure",          d: "Vera always identifies as a virtual host. Customizable greeting, opt-in recording, and full transcripts on every call." },
              { i: Languages, t: "Speaks your guests' language",       d: "English, Spanish, French, Mandarin, Tagalog and 23 more — switched automatically based on the caller." },
              { i: Lock, t: "PCI-aware payment handling",              d: "Card capture handed off to Stripe-hosted flow. Vera never stores or speaks card numbers aloud." },
              { i: Zap, t: "99.99% uptime SLA",                        d: "Redundant carriers, hot failover to your existing line. If anything ever fails, your phone just rings — like before." },
              { i: Sparkles, t: "Improves every week",                 d: "Your dashboard shows what Vera missed. One click to teach her — improvements ship Sunday night." },
            ].map((f) => (
              <Card key={f.t} className="border-border/80">
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
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <SectionHeader eyebrow="FAQ" title="The questions every owner asks." align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {homeFaqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border">
                <AccordionTrigger className="text-left text-base font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary to-primary-glow" />
          <div
            className="absolute inset-0 opacity-15"
            style={{ backgroundImage: "radial-gradient(white 1px, transparent 1px)", backgroundSize: "26px 26px" }}
          />
        </div>
        <div className="mx-auto max-w-4xl px-5 py-20 text-center text-primary-foreground md:py-28">
          <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Stop sending your guests to voicemail.</h2>
          <p className="mx-auto mt-4 max-w-xl text-primary-foreground/85 md:text-lg">
            14 days free. Live in under an hour. Cancel any time.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="secondary" className="h-12 px-6 text-base">
              <Link to="/signup">Start free trial <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 border-primary-foreground/40 bg-transparent px-6 text-base text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
              <Link to="/pricing">See pricing <ChevronRight className="ml-1 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
