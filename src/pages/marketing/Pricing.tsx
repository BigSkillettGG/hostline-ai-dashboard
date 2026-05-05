import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

import { SectionHeader } from "@/components/marketing/SectionHeader";
import { MissedCallCalculator } from "@/components/marketing/MissedCallCalculator";
import { featureMatrix, addOns } from "@/data/marketing";

const tiers = [
  {
    id: "starter", name: "Starter", monthly: 99, calls: 200, overage: "$0.55 / call",
    blurb: "For small spots that just need the phone covered.",
    cta: "Start free trial",
    features: ["AI host on your number", "FAQs, hours, directions", "Reservation requests", "SMS confirmations"],
  },
  {
    id: "growth", name: "Growth", monthly: 249, calls: 800, overage: "$0.40 / call",
    blurb: "Most popular for busy independent restaurants.",
    cta: "Start free trial", highlight: true,
    features: ["Everything in Starter", "Pickup order taking", "Toast / Square sync", "Bilingual EN + ES", "Call analytics"],
  },
  {
    id: "pro", name: "Pro", monthly: 549, calls: 2000, overage: "$0.30 / call",
    blurb: "For multi-location operators and high-volume kitchens.",
    cta: "Start free trial",
    features: ["Everything in Growth", "Up to 3 locations", "OpenTable & Resy", "Custom voice tuning", "API access", "Dedicated CSM"],
  },
];

const faqs = [
  { q: "What counts as a call?", a: "Any inbound call Vera picks up that lasts longer than 10 seconds. Wrong-numbers and silent calls don't count." },
  { q: "What happens if I go over my plan?", a: "We keep answering. Overage is billed at the per-call rate listed for your tier. We notify you at 80% and 100% of your included calls." },
  { q: "Can I bring my own phone number?", a: "Yes. Port your existing line, or forward to a HostLine number. Most setups take under 15 minutes." },
  { q: "Is there a contract?", a: "No. Monthly plans cancel any time. Annual billing saves 15% and is billed up front." },
  { q: "Do you support multiple locations?", a: "Pro includes up to 3. Each one gets its own number, menu, and analytics. Need more? See Enterprise." },
  { q: "Is there a setup fee?", a: "No setup fee on monthly plans. Annual plans include a free white-glove onboarding call with our team." },
  { q: "Do you charge for outbound SMS confirmations?", a: "All standard SMS confirmations to US/Canada are included. International SMS billed at cost." },
  { q: "What if I'm unhappy?", a: "Cancel any time in one click. We don't send retention reps after you. We'd rather earn it back." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const factor = annual ? 0.85 : 1;

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-accent/40 via-background to-background" />
        <div className="mx-auto max-w-4xl px-5 py-16 text-center md:py-20">
          <Badge variant="outline" className="mb-5 gap-1.5 border-primary/30 bg-primary/10 text-primary">
            <Sparkles className="h-3 w-3" /> Simple, usage-based pricing
          </Badge>
          <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
            Pay for the calls you answer.<br />
            <span className="text-muted-foreground">Never lose a guest again.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            Pick a plan based on monthly call volume. Go over and you only pay for what you use — there's no
            penalty for being busy.
          </p>
          <div className="mt-7 inline-flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1.5 shadow-sm">
            <span className={!annual ? "text-sm font-medium" : "text-sm text-muted-foreground"}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={annual ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
              Annual <Badge variant="secondary" className="ml-1">Save 2 months</Badge>
            </span>
          </div>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-12 md:py-16">
          <div className="grid gap-5 md:grid-cols-3">
            {tiers.map((t) => (
              <Card
                key={t.id}
                className={cn(
                  "relative flex flex-col",
                  t.highlight ? "border-primary/40 shadow-[0_1px_0_hsl(var(--border)),0_30px_60px_-24px_hsl(var(--primary)/0.35)] ring-1 ring-primary/20" : "border-border/80",
                )}
              >
                {t.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 shadow-sm">Most popular</Badge>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{t.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{t.blurb}</p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-5xl font-semibold tabular-nums tracking-tight">${Math.round(t.monthly * factor)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {annual ? `billed annually · save $${Math.round(t.monthly * 12 * 0.15)}/yr` : "billed monthly"}
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div className="font-medium tabular-nums">{t.calls.toLocaleString()} calls / mo included</div>
                    <div className="text-xs text-muted-foreground">Then {t.overage}</div>
                  </div>
                  <Button asChild className="w-full" variant={t.highlight ? "default" : "outline"} size="lg">
                    <Link to="/signup">{t.cta}</Link>
                  </Button>
                  <ul className="space-y-2 text-sm">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            14-day free trial on every plan. No credit card required.
          </p>
        </div>
      </section>

      {/* ROI */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeader
            eyebrow="Return on investment"
            title="Pays for itself after 3 recovered orders."
            subtitle="Slide the dials below to see what HostLine could be worth to your restaurant."
            align="center"
          />
          <div className="mt-10">
            <MissedCallCalculator />
          </div>
        </div>
      </section>

      {/* COMPARISON TABLE */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeader
            eyebrow="Compare every feature"
            title="What's included in each plan."
            align="center"
          />

          <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-4 font-semibold">Feature</th>
                    {["Starter", "Growth", "Pro"].map((c, i) => (
                      <th key={c} className={cn("px-5 py-4 text-center font-semibold", i === 1 && "bg-primary/10 text-primary")}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {featureMatrix.groups.map((g) => (
                    <>
                      <tr key={g.title} className="border-b border-border bg-muted/15">
                        <td colSpan={4} className="px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</td>
                      </tr>
                      {g.rows.map((r) => (
                        <tr key={r.label} className="border-b border-border/60 last:border-0">
                          <td className="px-5 py-3 font-medium">{r.label}</td>
                          {(["starter","growth","pro"] as const).map((k, i) => {
                            const v = (r as any)[k];
                            return (
                              <td key={k} className={cn("px-5 py-3 text-center", i === 1 && "bg-primary/5")}>
                                {typeof v === "boolean"
                                  ? (v ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />)
                                  : <span className="tabular-nums">{v}</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ADD-ONS */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeader eyebrow="Add-ons" title="Extras for when you need them." />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {addOns.map((a) => (
              <Card key={a.name} className="border-border/80">
                <CardContent className="p-5">
                  <div className="text-sm font-semibold">{a.name}</div>
                  <div className="mt-1 text-xs font-medium text-primary">{a.price}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ENTERPRISE */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center md:p-8">
              <div>
                <div className="text-base font-semibold">Enterprise & 4+ locations</div>
                <div className="mt-1 text-sm text-muted-foreground">Custom pricing, SLAs, dedicated infrastructure, white-glove onboarding, SSO.</div>
              </div>
              <Button asChild variant="default" size="lg">
                <a href="mailto:sales@hostline.ai">Talk to sales <ArrowRight className="ml-1 h-4 w-4" /></a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <SectionHeader eyebrow="FAQ" title="Pricing & billing questions." align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border">
                <AccordionTrigger className="text-left text-base font-medium">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Try it on your real phone line. Free for 14 days.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Most operators recover the cost of their plan in the first weekend.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6 text-base"><Link to="/signup">Start free trial</Link></Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base"><Link to="/">Back to overview</Link></Button>
        </div>
      </section>
    </>
  );
}
