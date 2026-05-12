import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardCheck,
  ClipboardList,
  Clock,
  MessageSquareText,
  PhoneCall,
  ShieldAlert,
  Sparkles,
  Zap,
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

  const primaryUseCase = solution.useCases[0];
  const secondaryUseCase = solution.useCases[1] ?? solution.useCases[0];
  const tertiaryUseCase = solution.useCases[2] ?? solution.useCases[0];

  return (
    <>
      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto grid min-h-[calc(100svh-10rem)] max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-20">
          <div>
            <Badge variant="outline" className="mb-5 border-background/25 bg-background/10 text-background">
              {solution.label}
            </Badge>
            <h1 className="max-w-3xl text-5xl font-semibold leading-none md:text-7xl">
              {solution.heroTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-background/76">{solution.heroSubtitle}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6">
                <Link to={`/signup?industry=${solution.slug}`}>
                  {solution.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-background/35 bg-transparent px-6 text-background hover:bg-background/10 hover:text-background">
                <Link to={`/pricing?industry=${solution.slug}`}>See pricing</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-background/15 bg-background/8 p-5 shadow-2xl">
            <div className="flex items-center justify-between gap-4 border-b border-background/15 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase text-primary-glow">Live request</div>
                <div className="mt-1 text-lg font-semibold">{solution.label} caller</div>
              </div>
              <Badge variant="outline" className="border-background/20 bg-background/10 text-background">
                <Clock className="mr-1.5 h-3 w-3" />
                Answered now
              </Badge>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Caller needs", primaryUseCase],
                ["HostLine handles", secondaryUseCase],
                ["Staff receives", tertiaryUseCase],
              ].map(([label, body], index) => (
                <div key={label} className={cn("rounded-md border p-4", index === 1 ? "border-primary/35 bg-primary/10" : "border-background/15 bg-background/8")}>
                  <div className="text-xs font-semibold uppercase text-background/48">{label}</div>
                  <p className="mt-2 text-sm leading-6 text-background/84">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-background/15 pt-4 text-center">
              {solution.outcomeMetrics.map((metric) => (
                <div key={metric} className="rounded-md bg-background/8 p-3">
                  <Check className="mx-auto h-4 w-4 text-primary-glow" />
                  <div className="mt-2 text-xs leading-5 text-background/70">{metric}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow={`${solution.label} call handling`}
            title={`Give ${solution.customerNoun}s a real answer before they call someone else.`}
            subtitle={solution.proofPoint}
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
        <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeader
              eyebrow="Setup interview"
              title="The owner does not configure software. They answer smart questions."
              subtitle="The onboarding interview builds the knowledge base, call policy, text-link behavior, and escalation map behind the AI."
            />
            <Button asChild className="mt-8">
              <Link to={`/signup?industry=${solution.slug}`}>Start this setup</Link>
            </Button>
          </div>

          <div className="grid gap-4">
            {solution.setupFocus.map((item, index) => (
              <div key={item} className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-start gap-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{item.split(",")[0]}</div>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow="Integrations and links"
            title="Start link-first. Connect deeper systems when the workflow deserves it."
            subtitle="The middle tier can send booking, quote, order, or intake links. The high tier can wire into the systems that matter for the vertical."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solution.integrations.map((integration) => (
              <div key={integration} className="rounded-lg border border-border bg-background p-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                    <Zap className="h-4 w-4" />
                  </div>
                  <div className="font-semibold">{integration}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow={`${solution.label} pricing`}
            title="Three tiers that match the value of the call."
            subtitle="Basic covers answering. Middle captures work. High end connects the operating systems."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {solution.pricing.map((tier) => (
              <Card key={tier.id} className={cn("flex flex-col border-border/80", tier.id === "growth" && "border-primary/40 shadow-md")}>
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
        <h2 className="mt-5 text-3xl font-semibold md:text-4xl">Put HostLine on the next {solution.label.toLowerCase()} call.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          The fastest path is still simple: choose the solution, answer the interview, forward the line, and test.
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
  return [PhoneCall, CalendarCheck, MessageSquareText, ShieldAlert, ClipboardList, ClipboardCheck][index % 6];
}
