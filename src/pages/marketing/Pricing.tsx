import { useState } from "react";
import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const tiers = [
  {
    name: "Starter",
    monthly: 99,
    calls: 200,
    overage: "$0.55 / call",
    locations: "1 location",
    highlight: false,
    features: [
      "AI host on your number",
      "FAQs & hours",
      "Reservation requests",
      "SMS confirmations",
      "Email support",
    ],
  },
  {
    name: "Growth",
    monthly: 249,
    calls: 800,
    overage: "$0.40 / call",
    locations: "1 location",
    highlight: true,
    features: [
      "Everything in Starter",
      "Pickup order taking",
      "Menu & modifier handling",
      "Toast / Square integrations",
      "Call analytics",
      "Priority email & chat support",
    ],
  },
  {
    name: "Pro",
    monthly: 549,
    calls: 2000,
    overage: "$0.30 / call",
    locations: "Up to 3 locations",
    highlight: false,
    features: [
      "Everything in Growth",
      "Multi-location",
      "OpenTable & Resy",
      "Custom voice tuning",
      "API access",
      "Dedicated success manager",
    ],
  },
];

const faqs = [
  { q: "What counts as a call?", a: "Any inbound call your AI host picks up that lasts longer than 10 seconds. Wrong-numbers and silent calls don't count." },
  { q: "What happens if I go over my plan?", a: "We'll keep answering calls. Overage is billed at the per-call rate listed for your tier. We notify you at 80% and 100% of your included calls." },
  { q: "Can I bring my own phone number?", a: "Yes. You can port your existing line, or forward to a HostLine AI number. Most setups take under 15 minutes." },
  { q: "Is there a contract?", a: "No. Monthly plans cancel any time. Annual billing saves 15% and is billed up front." },
  { q: "Do you support multiple locations?", a: "Pro includes up to 3 locations. Need more? Talk to us about Enterprise." },
];

export default function Pricing() {
  const [annual, setAnnual] = useState(false);
  const factor = annual ? 0.85 : 1;

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Simple pricing that scales with your phone</h1>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Pick a tier based on how many calls you take per month. Go over and you only pay for what you use — never lose a guest.
        </p>
        <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-card px-3 py-1.5">
          <span className={!annual ? "text-sm font-medium" : "text-sm text-muted-foreground"}>Monthly</span>
          <Switch checked={annual} onCheckedChange={setAnnual} />
          <span className={annual ? "text-sm font-medium" : "text-sm text-muted-foreground"}>
            Annual <Badge variant="secondary" className="ml-1">Save 15%</Badge>
          </span>
        </div>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {tiers.map((t) => (
          <Card key={t.name} className={t.highlight ? "border-primary/40 shadow-lg ring-1 ring-primary/20" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{t.name}</CardTitle>
                {t.highlight && <Badge>Most popular</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tabular-nums">${Math.round(t.monthly * factor)}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="text-xs text-muted-foreground">{annual ? "billed annually" : "billed monthly"}</div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                <div className="font-medium tabular-nums">{t.calls.toLocaleString()} calls / mo</div>
                <div className="text-xs text-muted-foreground">Then {t.overage}</div>
                <div className="text-xs text-muted-foreground">{t.locations}</div>
              </div>
              <Button asChild className="w-full" variant={t.highlight ? "default" : "outline"}>
                <Link to="/signup">Start free trial</Link>
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

      <Card className="mt-6 border-dashed">
        <CardContent className="flex flex-col items-start justify-between gap-3 p-5 sm:flex-row sm:items-center">
          <div>
            <div className="text-sm font-semibold">Need more than 2,000 calls or 3 locations?</div>
            <div className="text-sm text-muted-foreground">Custom pricing, SLAs, dedicated infrastructure, and onboarding.</div>
          </div>
          <Button variant="outline" asChild><a href="mailto:sales@hostline.ai">Talk to sales</a></Button>
        </CardContent>
      </Card>

      <div className="mt-16">
        <h2 className="text-xl font-semibold tracking-tight">Frequently asked</h2>
        <Accordion type="single" collapsible className="mt-4">
          {faqs.map((f) => (
            <AccordionItem key={f.q} value={f.q}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
}
