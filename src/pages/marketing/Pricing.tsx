import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Minus, Sparkles } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { industrySolutions } from "@/data/industry-solutions";
import { cn } from "@/lib/utils";

const pricingFaqs = [
  { q: "What counts as a call or chat?", a: "Any answered phone call or website chat conversation that lasts long enough for the AI to provide help. Silent calls, failed calls, and obvious spam can be filtered out." },
  { q: "Do you charge by the minute?", a: "No. The public pricing model is by answered call or chat, with overage billed per extra interaction." },
  { q: "Can pricing change by industry?", a: "Yes. A salon with short appointment calls and an HVAC company with emergency triage have different volume and value profiles, so each solution has its own starting point." },
  { q: "Can I start without integrations?", a: "Yes. Basic and middle tiers can capture requests and send links. The high tier is where deeper tools like Toast, ServiceTitan, Jobber, or Boulevard make sense." },
  { q: "Is there a setup fee?", a: "Not for standard self-service setup. White-glove onboarding and custom integrations can be quoted separately." },
];

export default function Pricing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedIndustry = searchParams.get("industry");
  const initialIndustry = useMemo(
    () => industrySolutions.find((solution) => solution.slug === requestedIndustry) ?? industrySolutions[0],
    [requestedIndustry],
  );
  const [selectedSlug, setSelectedSlug] = useState(initialIndustry.slug);
  const [annual, setAnnual] = useState(false);
  const selected = industrySolutions.find((solution) => solution.slug === selectedSlug) ?? industrySolutions[0];
  const factor = annual ? 0.85 : 1;

  const chooseIndustry = (slug: string) => {
    setSelectedSlug(slug);
    setSearchParams({ industry: slug });
  };

  return (
    <>
      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 md:py-20 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
          <Badge variant="outline" className="mb-5 gap-1.5 border-background/25 bg-background/10 text-background">
            <Sparkles className="h-3 w-3" />
            Pricing by solution
          </Badge>
          <h1 className="max-w-3xl text-5xl font-semibold leading-none md:text-7xl">
            Pay by the call or chat.
            <span className="block text-background/58">Not by the minute.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-background/72">
            Every industry starts with full answering coverage, then adds booking, request capture, and integrations as the workflow gets more valuable.
          </p>
          <div className="mt-7 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-2 rounded-lg border border-background/20 bg-background/10 px-3 py-2 shadow-sm">
            <span className={!annual ? "text-sm font-medium" : "text-sm text-background/55"}>Monthly</span>
            <Switch checked={annual} onCheckedChange={setAnnual} />
            <span className={annual ? "text-sm font-medium" : "text-sm text-background/55"}>Annual</span>
            <Badge variant="outline" className="border-background/20 bg-background/10 text-background">Save 15%</Badge>
          </div>
          </div>

          <div className="rounded-lg border border-background/15 bg-background/8 p-5">
            <div className="text-xs font-semibold uppercase text-primary-glow">Current selection</div>
            <div className="mt-3 text-2xl font-semibold">{selected.label}</div>
            <p className="mt-2 text-sm leading-6 text-background/70">{selected.proofPoint}</p>
            <div className="mt-5 grid gap-2">
              {selected.pricing.map((tier) => (
                <div key={tier.id} className="flex items-center justify-between rounded-md border border-background/15 bg-background/8 px-4 py-3 text-sm">
                  <span>{tier.name}</span>
                  <span className="font-semibold">${Math.round(tier.monthly * factor)}/mo</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-8">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {industrySolutions.map((solution) => (
              <button
                key={solution.slug}
                className={cn(
                  "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  selected.slug === solution.slug
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
                onClick={() => chooseIndustry(solution.slug)}
                type="button"
              >
                {solution.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-16">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              eyebrow={`${selected.label} plans`}
              title={`Built around ${selected.customerNoun} conversations.`}
              subtitle={selected.proofPoint}
            />
            <Button asChild variant="outline">
              <Link to={`/solutions/${selected.slug}`}>View solution page</Link>
            </Button>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {selected.pricing.map((tier) => (
              <Card key={tier.id} className={cn("relative flex flex-col border-border/80", tier.id === "growth" && "border-primary/40 shadow-md")}>
                {tier.id === "growth" && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 shadow-sm">Most popular</Badge>
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="text-base font-semibold">{tier.name}</div>
                  <p className="mt-2 min-h-14 text-sm text-muted-foreground">{tier.blurb}</p>
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-5xl font-semibold">${Math.round(tier.monthly * factor)}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {annual ? `billed annually, saves $${Math.round(tier.monthly * 12 * 0.15)}/yr` : "billed monthly"}
                  </div>
                  <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div className="font-medium">{tier.includedInteractions.toLocaleString()} calls or chats included</div>
                    <div className="text-xs text-muted-foreground">{tier.overage}</div>
                  </div>
                  <Button asChild className="mt-5 w-full" variant={tier.id === "growth" ? "default" : "outline"} size="lg">
                    <Link to={`/signup?industry=${selected.slug}&plan=${tier.id}`}>
                      Start free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <SectionHeader
            eyebrow="Plan logic"
            title="Basic answers. Middle captures work. High end connects systems."
            subtitle="That pattern stays consistent across every industry, even when the exact workflow changes."
          />
          <div className="mt-10 overflow-hidden rounded-lg border border-border bg-background">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-5 py-4 font-semibold">Capability</th>
                    <th className="px-5 py-4 text-center font-semibold">Basic</th>
                    <th className="px-5 py-4 text-center font-semibold text-primary">Middle</th>
                    <th className="px-5 py-4 text-center font-semibold">High end</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["AI phone answering", true, true, true],
                    ["Website chat", true, true, true],
                    ["FAQs, hours, service area, policies", true, true, true],
                    ["Request/order/appointment capture", false, true, true],
                    ["Send booking, quote, order, or intake links", false, true, true],
                    ["Advanced industry integrations", false, false, true],
                    ["Multi-location support", false, false, true],
                  ].map(([label, basic, middle, high]) => (
                    <tr key={String(label)} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 font-medium">{label}</td>
                      {[basic, middle, high].map((value, index) => (
                        <td key={index} className={cn("px-5 py-3 text-center", index === 1 && "bg-primary/5")}>
                          {value ? <Check className="mx-auto h-4 w-4 text-success" /> : <Minus className="mx-auto h-4 w-4 text-muted-foreground/40" />}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-16">
          <SectionHeader eyebrow="FAQ" title="Pricing questions." align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {pricingFaqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q} className="border-border">
                <AccordionTrigger className="text-left text-base font-medium">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center">
        <h2 className="text-3xl font-semibold md:text-4xl">Try it on a real phone line.</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Start with the right industry template, then tune the details during onboarding.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <Button asChild size="lg" className="h-12 px-6"><Link to={`/signup?industry=${selected.slug}`}>Start free</Link></Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6"><Link to="/">Back to overview</Link></Button>
        </div>
      </section>
    </>
  );
}
