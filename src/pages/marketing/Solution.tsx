import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock,
  MessageSquareText,
  PhoneCall,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { industrySolutions } from "@/data/industry-solutions";
import { cn } from "@/lib/utils";

export default function Solution() {
  const { industrySlug } = useParams();
  const solution = industrySolutions.find((item) => item.slug === industrySlug);

  if (!solution) return <Navigate to="/" replace />;

  return (
    <>
      <section className="border-b border-border bg-card/30">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20">
          <div>
            <Badge variant="outline" className="mb-5 border-primary/30 bg-primary/10 text-primary">
              {solution.label}
            </Badge>
            <h1 className="max-w-3xl text-4xl font-semibold leading-none text-foreground md:text-6xl">
              {solution.heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-muted-foreground">{solution.heroSubtitle}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to={`/signup?industry=${solution.slug}`}>
                  {solution.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <Link to={`/pricing?industry=${solution.slug}`}>See pricing</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background shadow-sm">
            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase text-primary">Live request</div>
                  <div className="mt-1 text-lg font-semibold">{solution.label} caller</div>
                </div>
                <Badge variant="secondary" className="gap-1.5">
                  <Clock className="h-3 w-3" />
                  Answered now
                </Badge>
              </div>
            </div>
            <div className="space-y-3 p-5">
              {solution.useCases.slice(0, 3).map((line, index) => (
                <div key={line} className={cn("rounded-lg border p-4", index === 1 ? "border-primary/25 bg-primary/5" : "border-border bg-card/35")}>
                  <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    {index === 0 ? "Caller says" : index === 1 ? "HostLine captures" : "Staff receives"}
                  </div>
                  <p className="text-sm leading-6">{line}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-5">
              <div className="text-xs font-semibold uppercase text-primary">Why it wins</div>
              <p className="mt-2 text-sm text-muted-foreground">{solution.proofPoint}</p>
              <div className="mt-4 grid gap-2">
                {solution.outcomeMetrics.map((metric) => (
                  <div key={metric} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-success" />
                    <span>{metric}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow={`${solution.label} use cases`}
            title={`Calls ${solution.staffNoun}s should not have to chase.`}
            subtitle={`HostLine handles the common, urgent, repetitive, and after-hours conversations ${solution.customerNoun}s already bring to your phone line.`}
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {solution.useCases.map((useCase, index) => {
              const Icon = getUseCaseIcon(index);
              return (
                <Card key={useCase} className="border-border/80">
                  <CardContent className="flex gap-4 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="text-sm leading-6 text-foreground">{useCase}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow="Setup interview"
            title="Simple for the owner. Deep enough for a real AI operator."
            subtitle="The onboarding interview changes by industry, then turns answers into the knowledge base, policies, links, and escalation rules the AI uses on live calls and website chat."
          />
          <div className="mt-10 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-border bg-background p-5">
              <div className="text-sm font-semibold">The interview captures</div>
              <div className="mt-4 space-y-3">
                {solution.setupFocus.map((item) => (
                  <div key={item} className="flex gap-3">
                    <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {solution.valuePillars.map((pillar) => (
                <div key={pillar.title} className="rounded-lg border border-border bg-background p-5">
                  <div className="text-sm font-semibold">{pillar.title}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow={`${solution.label} pricing`}
            title="Three tiers. Overage by call or chat, not by the minute."
            subtitle="Start with full answering coverage, add booking and request capture, then connect the systems that make sense for the business."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {solution.pricing.map((tier) => (
              <Card key={tier.id} className={cn("flex flex-col border-border/80", tier.id === "growth" && "border-primary/40 shadow-sm")}>
                <CardContent className="flex flex-1 flex-col p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-base font-semibold">{tier.name}</div>
                    {tier.id === "growth" && <Badge>Popular</Badge>}
                  </div>
                  <p className="mt-2 min-h-12 text-sm text-muted-foreground">{tier.blurb}</p>
                  <div className="mt-5 flex items-end gap-1">
                    <span className="text-4xl font-semibold">${tier.monthly}</span>
                    <span className="pb-1 text-sm text-muted-foreground">/mo</span>
                  </div>
                  <div className="mt-3 rounded-md border border-border bg-muted/30 p-3 text-sm">
                    <div className="font-medium">{tier.includedInteractions.toLocaleString()} calls or chats included</div>
                    <div className="text-xs text-muted-foreground">{tier.overage}</div>
                  </div>
                  <ul className="mt-5 flex-1 space-y-2 text-sm">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button asChild className="mt-5 w-full" variant={tier.id === "growth" ? "default" : "outline"}>
                    <Link to={`/signup?industry=${solution.slug}&plan=${tier.id}`}>Start free</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center md:py-20">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold md:text-4xl">Give your next caller the feeling that someone picked up.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          HostLine answers by phone and website chat, uses the same knowledge base, and hands your team clean transcripts, tasks, and customer details.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6">
            <Link to={`/signup?industry=${solution.slug}`}>{solution.ctaLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6">
            <Link to="/">Back to all solutions</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function getUseCaseIcon(index: number) {
  return [PhoneCall, CalendarCheck, MessageSquareText, ShieldAlert, ClipboardList, Sparkles][index % 6];
}
