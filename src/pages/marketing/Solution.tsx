import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardCheck,
  ClipboardList,
  Link2,
  MessageSquareText,
  PhoneCall,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { industrySolutions } from "@/data/industry-solutions";
import { cn } from "@/lib/utils";

const heroImage = "/marketing/host-on-phone.jpg";

export default function Solution() {
  const { industrySlug } = useParams();
  const solution = industrySolutions.find((item) => item.slug === industrySlug);

  if (!solution) return <Navigate to="/" replace />;

  const landing = solution.landing;
  const usesRestaurantImage = solution.businessType === "restaurant";
  const heroCopyClass = usesRestaurantImage ? "max-w-4xl" : "max-w-[700px]";
  const heroHeadlineClass = usesRestaurantImage
    ? "max-w-4xl text-5xl font-semibold leading-[0.98] md:text-7xl lg:text-[82px]"
    : "max-w-[700px] text-5xl font-semibold leading-[0.98] md:text-6xl lg:text-[72px]";

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-[#14100d] text-background">
        {usesRestaurantImage && <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-50" />}
        <div className="absolute inset-0 -z-10 bg-[#120f0c]/88" />
        <div className="absolute inset-x-0 bottom-0 -z-10 h-px bg-background/18" />
        {!usesRestaurantImage && <div className="absolute right-6 top-40 -z-10 hidden w-[360px] border border-background/10 bg-background/5 p-5 opacity-75 xl:block 2xl:w-[420px]">
          <div className="flex items-center justify-between border-b border-background/10 pb-3">
            <div className="text-xs font-semibold uppercase text-primary-glow">Inbound signal</div>
            <div className="text-xs text-background/45">00:12</div>
          </div>
          <div className="mt-4 space-y-3 text-sm">
            <div className="w-4/5 border border-background/12 bg-background/7 p-3">{landing.callerLine}</div>
            <div className="ml-auto w-4/5 border border-primary/35 bg-primary/14 p-3">{landing.operatorReply}</div>
          </div>
        </div>}
        <div className="mx-auto flex min-h-[calc(100svh-7.5rem)] max-w-6xl flex-col justify-center px-5 py-16 md:py-20">
          <div className={heroCopyClass}>
            <Badge variant="outline" className="mb-5 border-background/25 bg-background/10 text-background">
              {solution.label} landing page
            </Badge>
            <h1 className={heroHeadlineClass}>
              {landing.headline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-background/76 md:text-xl">
              {solution.heroSubtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to={`/signup?industry=${solution.slug}`}>
                  {solution.ctaLabel}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-background/35 bg-background/10 px-6 text-base text-background hover:bg-background/20 hover:text-background">
                <a href="#pricing">See {solution.label} pricing</a>
              </Button>
            </div>
          </div>

          <div className="mt-12 grid overflow-hidden rounded-md border border-background/15 bg-background/8 md:grid-cols-3">
            {landing.stats.map((stat) => (
              <div key={stat.label} className="border-b border-background/15 p-4 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="text-3xl font-semibold text-primary-glow">{stat.value}</div>
                <div className="mt-1 text-xs uppercase text-background/48">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <div className="text-xs font-semibold uppercase text-primary">{landing.callout}</div>
            <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">{landing.stakes}</h2>
            <p className="mt-5 text-base leading-7 text-muted-foreground">{landing.proof}</p>
          </div>

          <div className="overflow-hidden rounded-md border border-border bg-foreground text-background">
            <div className="flex items-center justify-between border-b border-background/12 px-5 py-4">
              <div>
                <div className="text-xs font-semibold uppercase text-primary-glow">Live call recovered</div>
                <div className="mt-1 text-lg font-semibold">{solution.label} caller</div>
              </div>
              <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
                Answered now
              </Badge>
            </div>
            <div className="grid gap-px bg-background/12 md:grid-cols-[1fr_0.82fr]">
              <div className="space-y-3 bg-[#211912] p-5">
                <TranscriptBubble speaker="Caller" text={landing.callerLine} />
                <TranscriptBubble speaker="SignalHost" text={landing.operatorReply} active />
              </div>
              <div className="bg-[#17120f] p-5">
                <div className="text-xs font-semibold uppercase text-background/40">Staff receives</div>
                <p className="mt-3 text-sm leading-6 text-background/76">{landing.staffHandoff}</p>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  {solution.outcomeMetrics.slice(0, 3).map((metric) => (
                    <div key={metric} className="rounded-md border border-background/12 bg-background/7 p-3">
                      <Check className="h-4 w-4 text-success" />
                      <div className="mt-2 text-xs leading-5 text-background/68">{metric}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]">
            <SectionHeader
              eyebrow={`${solution.label} calls`}
              title="Show the buyer you understand the calls they actually get."
              subtitle="Each paid-search or outbound visitor should see their own daily phone chaos reflected back clearly."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {solution.useCases.map((useCase, index) => {
                const Icon = getUseCaseIcon(index);
                return (
                  <div key={useCase} className="border-l-2 border-border bg-background px-4 py-4 transition-colors hover:border-primary">
                    <div className="flex gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <p className="text-sm leading-6 text-foreground">{useCase}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <SectionHeader
              eyebrow="Setup interview"
              title={`SignalHost learns how this ${solution.label.toLowerCase()} business works.`}
              subtitle="The owner answers normal questions. The answers become the operating manual behind phone calls, website chat, text links, escalation, and staff handoff."
            />
            <div className="mt-8 rounded-md border border-border bg-card p-5">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-primary" />
                <div className="font-semibold">{landing.cta}</div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                The page sells the promise. The onboarding interview makes the promise true for each individual business.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {solution.setupFocus.map((item, index) => (
              <div key={item} className="grid grid-cols-[56px_1fr] overflow-hidden rounded-md border border-border bg-background">
                <div className="flex items-center justify-center border-r border-border bg-muted/40 text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </div>
                <div className="p-4">
                  <div className="text-sm font-semibold">{item.split(",")[0]}</div>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase text-primary-glow">From answer to action</div>
              <h2 className="mt-3 text-4xl font-semibold leading-tight md:text-5xl">Not just a conversation. A completed handoff.</h2>
              <p className="mt-4 text-sm leading-6 text-background/68">
                SignalHost is judged by what staff can do after the call: return the right call first, confirm the right request, send the right link, or escalate the risky issue.
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                ["Answer", "Natural phone and website chat coverage, including after-hours and overflow."],
                ["Capture", "Caller details, intent, transcript, recording, request data, and urgency."],
                ["Route", "Staff task, link, booking request, estimate request, order workflow, or escalation."],
              ].map(([title, body]) => (
                <div key={title} className="rounded-md border border-background/14 bg-background/8 p-5">
                  <div className="text-lg font-semibold">{title}</div>
                  <p className="mt-3 text-sm leading-6 text-background/68">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow="Links and integrations"
            title="Start link-first. Connect deeper systems when the workflow earns it."
            subtitle="The middle tier can send booking, quote, order, or intake links. The high tier connects the platforms that matter for the vertical."
          />
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {solution.integrations.map((integration) => (
              <div key={integration} className="flex items-center gap-3 rounded-md border border-border bg-background p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="font-semibold">{integration}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow={`${solution.label} pricing`}
            title="Three tiers that match the value of the call."
            subtitle="Basic answers. Middle captures work. High end connects the operating systems."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {solution.pricing.map((tier) => (
              <div key={tier.id} className={cn("flex flex-col rounded-md border border-border bg-background p-5", tier.id === "growth" && "border-primary/45 shadow-md")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-base font-semibold">{tier.name}</div>
                  {tier.id === "growth" && <Badge>Popular</Badge>}
                </div>
                <p className="mt-3 min-h-14 text-sm leading-6 text-muted-foreground">{tier.blurb}</p>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-5xl font-semibold">${tier.monthly}</span>
                  <span className="pb-1 text-sm text-muted-foreground">/mo</span>
                </div>
                <div className="mt-4 rounded-md border border-border bg-muted/30 p-3 text-sm">
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
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 py-16 text-center md:py-20">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold md:text-4xl">{landing.cta}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Choose the {solution.label.toLowerCase()} setup, answer the interview, forward a test line, and hear the first call.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6">
            <Link to={`/signup?industry=${solution.slug}`}>{solution.ctaLabel}</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6">
            <Link to="/pricing">Compare all pricing</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

function TranscriptBubble({ active = false, speaker, text }: { active?: boolean; speaker: string; text: string }) {
  const isSignalHost = speaker === "SignalHost";
  return (
    <div className={cn("flex", isSignalHost && "justify-end")}>
      <div className={cn(
        "max-w-[90%] rounded-md border px-4 py-3 text-sm leading-6",
        isSignalHost ? "border-primary/35 bg-primary/16" : "border-background/14 bg-background/7",
        active && "shadow-[0_0_0_3px_rgba(220,82,34,0.12)]",
      )}>
        <div className="mb-1 text-[10px] font-semibold uppercase text-background/42">{speaker}</div>
        {text}
      </div>
    </div>
  );
}

function getUseCaseIcon(index: number) {
  return [PhoneCall, CalendarCheck, MessageSquareText, ShieldAlert, ClipboardList, ClipboardCheck][index % 6];
}
