import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Clock,
  Headphones,
  MessageSquareText,
  Phone,
  Scissors,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { VoiceDemoPlayer } from "@/components/marketing/VoiceDemoPlayer";
import { industrySolutions } from "@/data/industry-solutions";
import { cn } from "@/lib/utils";

const heroImage = "/marketing/host-on-phone.jpg";
const localBusinessImage = "/marketing/happy-guests.jpg";

const faqs = [
  { q: "Does this only work for restaurants?", a: "No. Restaurants are the first polished demo, but the platform now supports restaurants, HVAC, plumbers, roofers, electricians, and hair salons or barbershops." },
  { q: "Will callers know they are talking to AI?", a: "The greeting is configurable by business. The agent is designed to sound like a polished front-desk operator while staying conservative and safe in sensitive situations." },
  { q: "How long does setup take?", a: "Most businesses can test the first call the same day. Choose an industry, answer the setup interview, add links or files, and forward the phone line to HostLine." },
  { q: "What if the AI does not know the answer?", a: "It takes a clean message, alerts staff, saves the transcript, and avoids promising anything it cannot verify." },
  { q: "Can I keep my current phone number?", a: "Yes. You can port the number later or simply forward unanswered, busy, after-hours, or all calls to your HostLine number." },
];

const urgentMoments = [
  { title: "The dinner rush", body: "A guest wants pickup, a table, parking, and allergy clarity while the host stand is buried.", solution: "Restaurants", icon: Phone },
  { title: "The no-heat call", body: "A homeowner needs help now, not tomorrow's voicemail.", solution: "HVAC", icon: AlertTriangle },
  { title: "The active leak", body: "The caller is standing in water and deciding which plumber to trust.", solution: "Plumbers", icon: Wrench },
  { title: "The storm lead", body: "A roof is leaking, photos are ready, and three contractors are being called at once.", solution: "Roofers", icon: ShieldCheck },
  { title: "The sparking outlet", body: "A safety-sensitive electrical call needs careful triage and a fast callback.", solution: "Electricians", icon: Zap },
  { title: "The color appointment", body: "A client needs pricing, timing, provider preference, and a booking link after hours.", solution: "Salons", icon: Scissors },
];

const operatingModes = [
  "Answer the phone with a natural voice",
  "Handle website chat with the same knowledge",
  "Send booking, quote, order, or intake links",
  "Capture appointments, orders, estimates, and requests",
  "Escalate complaints, safety issues, allergies, and uncertainty",
  "Log transcripts, summaries, tasks, recordings, and analytics",
];

export default function MarketingHome() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-foreground text-background">
        <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="absolute inset-0 -z-10 bg-foreground/72" />
        <div className="absolute inset-y-0 left-0 -z-10 hidden w-2/3 bg-foreground/35 lg:block" />

        <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-6xl flex-col justify-center px-5 py-16 md:py-20">
          <div className="max-w-3xl">
            <Badge variant="outline" className="mb-5 border-background/25 bg-background/10 text-background">
              <Sparkles className="mr-1.5 h-3 w-3" />
              AI operator for phone and website chat
            </Badge>
            <h1 className="text-5xl font-semibold leading-[0.98] md:text-7xl lg:text-[84px]">
              Your business picked up.
              <span className="block text-background/68">Even when nobody could.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-background/78 md:text-xl">
              HostLine answers real customer conversations, captures the work, sends the right link, escalates the risky stuff, and hands your team the full story.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/signup">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-background/35 bg-background/10 px-6 text-base text-background hover:bg-background/20 hover:text-background">
                <a href="#solutions">
                  Explore solutions
                  <Phone className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="mt-14 grid overflow-hidden rounded-lg border border-background/15 bg-background/8 backdrop-blur-sm md:grid-cols-3">
            {[
              { label: "Answered", value: "Every missed, busy, after-hours, or overflow call" },
              { label: "Captured", value: "Requests, appointments, orders, estimates, and transcripts" },
              { label: "Escalated", value: "Safety, complaints, allergies, uncertainty, and human callbacks" },
            ].map((item) => (
              <div key={item.label} className="border-b border-background/15 p-4 md:border-b-0 md:border-r md:last:border-r-0">
                <div className="text-xs font-semibold uppercase text-primary-glow">{item.label}</div>
                <div className="mt-2 text-sm leading-6 text-background/78">{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <SectionHeader
            eyebrow="The moment that matters"
            title="The caller is already ready to buy, book, or leave."
            subtitle="HostLine is built for the moments where a missed call becomes lost revenue, bad service, or another company winning the job."
          />
          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {urgentMoments.map((moment) => (
              <Card key={moment.title} className="border-border/80">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <moment.icon className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary">{moment.solution}</Badge>
                  </div>
                  <div className="mt-5 text-lg font-semibold">{moment.title}</div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{moment.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="solutions" className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <SectionHeader
              eyebrow="Solutions"
              title="Six verticals. Six operating manuals. One platform."
              subtitle="Each solution gets specific use cases, pricing, links, escalation rules, and onboarding questions."
            />
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/pricing">Compare pricing</Link>
            </Button>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {industrySolutions.map((solution, index) => (
              <Link
                key={solution.slug}
                to={`/solutions/${solution.slug}`}
                className={cn(
                  "group flex min-h-[390px] flex-col rounded-lg border border-border bg-background p-5 transition-transform hover:-translate-y-1 hover:shadow-lg",
                  index === 0 && "md:col-span-2 xl:col-span-1",
                )}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xl font-semibold text-foreground">{solution.label}</div>
                  <Badge variant="secondary">${solution.pricing[0].monthly}/mo</Badge>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{solution.heroSubtitle}</p>

                <div className="mt-5 space-y-2">
                  {solution.outcomeMetrics.map((metric) => (
                    <div key={metric} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-success" />
                      <span>{metric}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <div className="rounded-md border border-border bg-muted/30 p-4">
                    <div className="text-xs font-semibold uppercase text-primary">Example call</div>
                    <p className="mt-2 text-sm leading-6 text-foreground">{solution.useCases[0]}</p>
                  </div>
                  <div className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">
                    Explore {solution.label}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section id="live-demo" className="border-b border-[#2c2119] bg-[#120f0c]">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
          <VoiceDemoPlayer />
        </div>
      </section>

      <section id="how" className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionHeader
              eyebrow="The interview engine"
              title="Owners answer normal questions. The AI gets a real operating manual."
              subtitle="The onboarding flow adapts by industry so the AI knows what to say, what to capture, what link to send, and when to stop and ask staff."
            />
            <div className="mt-8 grid gap-3">
              {[
                "What calls should the AI handle, and what should it never promise?",
                "Which services, menu items, prices, links, fees, hours, and emergency rules matter?",
                "What needs a callback, staff review, human escalation, or text confirmation?",
              ].map((question) => (
                <div key={question} className="flex gap-3 rounded-lg border border-border bg-card/30 p-4">
                  <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm leading-6">{question}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-foreground p-5 text-background shadow-sm">
            <div className="flex items-center justify-between gap-4 border-b border-background/15 pb-4">
              <div>
                <div className="text-xs font-semibold uppercase text-primary-glow">Live setup preview</div>
                <div className="mt-1 text-lg font-semibold">RidgeLine Roofing</div>
              </div>
              <Badge variant="outline" className="border-background/20 bg-background/10 text-background">Roofers</Badge>
            </div>
            <div className="mt-5 space-y-3">
              {[
                ["Caller asks", "My roof is leaking into the upstairs bedroom after the storm."],
                ["AI captures", "Address, leak location, storm date, roof type, photos, insurance status, callback number."],
                ["Staff gets", "Urgent storm-damage task with transcript, summary, customer details, and recommended callback priority."],
              ].map(([label, body]) => (
                <div key={label} className="rounded-md border border-background/15 bg-background/8 p-4">
                  <div className="text-xs font-semibold uppercase text-background/48">{label}</div>
                  <p className="mt-2 text-sm leading-6 text-background/82">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="overflow-hidden rounded-lg border border-border">
            <img src={localBusinessImage} alt="Customers being served at a busy local business" className="h-[420px] w-full object-cover" />
          </div>
          <div>
            <SectionHeader
              eyebrow="What it handles"
              title="Not a phone tree. A front desk that knows when to be careful."
              subtitle="Fast answers when the answer is clear. Conservative handoff when the call involves safety, refunds, allergies, complaints, exact availability, or anything staff should own."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {operatingModes.map((item) => (
                <div key={item} className="flex gap-2 rounded-lg border border-border bg-background p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto max-w-3xl px-5 py-20">
          <SectionHeader eyebrow="FAQ" title="The questions every owner asks." align="center" />
          <Accordion type="single" collapsible className="mt-8">
            {faqs.map((faq) => (
              <AccordionItem key={faq.q} value={faq.q} className="border-border">
                <AccordionTrigger className="text-left text-base font-medium">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-16 md:flex-row md:items-center">
          <div>
            <div className="text-xs font-semibold uppercase text-primary-glow">Start with the next call</div>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Put a real AI operator on your line and website.</h2>
            <p className="mt-4 max-w-xl text-background/70">Pick the industry, answer the setup interview, and test it on a real phone line.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Button asChild size="lg" className="h-12 px-6">
              <Link to="/signup">Start free</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="h-12 border-background/35 bg-transparent px-6 text-background hover:bg-background/10 hover:text-background">
              <Link to="/pricing">See pricing</Link>
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
