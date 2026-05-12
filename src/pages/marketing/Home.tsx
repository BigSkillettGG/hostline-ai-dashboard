import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Phone,
  PhoneCall,
  Scissors,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { VoiceDemoPlayer } from "@/components/marketing/VoiceDemoPlayer";
import { industrySolutions } from "@/data/industry-solutions";
import { cn } from "@/lib/utils";

const heroImage = "/marketing/host-on-phone.jpg";
const localBusinessImage = "/marketing/happy-guests.jpg";

const faqs = [
  { q: "Does this only work for restaurants?", a: "No. Restaurants are the first polished demo, but the platform supports restaurants, HVAC, plumbers, roofers, electricians, and hair salons or barbershops." },
  { q: "Will callers know they are talking to AI?", a: "The greeting and disclosure are configurable. The experience is designed to feel like a polished operator while staying conservative in sensitive situations." },
  { q: "How long does setup take?", a: "Most businesses can test a first call the same day. Pick an industry, answer the setup interview, add links or files, and forward the phone line to SignalHost." },
  { q: "What if the AI does not know the answer?", a: "It takes a clean message, alerts staff, saves the transcript, and avoids promising anything it cannot verify." },
  { q: "Can I keep my current phone number?", a: "Yes. You can port the number later or forward unanswered, busy, after-hours, or all calls to your SignalHost number." },
];

const heroMetrics = [
  ["0", "busy signals"],
  ["24/7", "answer coverage"],
  ["1", "clean staff handoff"],
];

const heroTranscript = [
  ["Caller", "Hi, are you still taking pickup orders tonight?"],
  ["SignalHost", "Yes. Kitchen is open until 9:30. What can I get started for you?"],
  ["Caller", "Two margheritas, one gluten-free, and a Caesar."],
  ["SignalHost", "Got it. That's 54 dollars, ready in about 25 minutes. What name should I put on the order?"],
];

const urgentMoments = [
  { title: "Dinner rush", body: "Pickup order, allergy question, parking, patio seating, and a host who cannot get to the phone.", solution: "Restaurants", icon: Phone },
  { title: "No heat", body: "A homeowner is cold, frustrated, and ready to book the first HVAC company that answers.", solution: "HVAC", icon: AlertTriangle },
  { title: "Active leak", body: "Someone is standing in water and needs calm triage before a dispatcher calls back.", solution: "Plumbers", icon: Wrench },
  { title: "Storm lead", body: "A roof is leaking, photos are ready, and three contractors are being called at once.", solution: "Roofers", icon: ShieldCheck },
  { title: "Sparking outlet", body: "A safety-sensitive call needs careful escalation, not a casual AI guess.", solution: "Electricians", icon: Zap },
  { title: "Color appointment", body: "A client wants pricing, provider preference, timing, and a booking link after hours.", solution: "Salons", icon: Scissors },
];

const operatingModes = [
  ["Voice operator", "Answers overflow, missed, after-hours, busy, and test-forwarded calls with the business's knowledge."],
  ["Website concierge", "The same brain handles website chat, sends links, captures requests, and keeps context consistent."],
  ["Staff command center", "Transcripts, summaries, call recordings, alerts, tasks, outcomes, and follow-up live in one place."],
];

const staffArtifacts = [
  ["Intent", "Pickup order"],
  ["Outcome", "$54 captured"],
  ["Risk", "Low"],
  ["Next step", "Ready at 7:10"],
];

export default function MarketingHome() {
  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-border bg-[#14100d] text-background">
        <img src={heroImage} alt="" className="absolute inset-0 -z-20 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-[#120f0c]/78" />
        <div className="absolute inset-y-0 left-0 -z-10 hidden w-1/2 bg-[#120f0c]/40 xl:block" />

        <div className="mx-auto grid min-h-[calc(100svh-7.5rem)] max-w-6xl gap-12 px-5 py-14 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:py-18">
          <div>
            <Badge variant="outline" className="mb-5 border-background/25 bg-background/10 text-background">
              <Sparkles className="mr-1.5 h-3 w-3" />
              AI operator for phone and website chat
            </Badge>
            <h1 className="max-w-2xl text-5xl font-semibold leading-[0.96] md:text-7xl lg:text-[78px]">
              Miss the call. Lose the customer.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-background/78 md:text-xl">
              SignalHost answers like a trained front desk, captures what matters, sends the right link, and gives your team the transcript, recording, and next step.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/signup">
                  Start with your business
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 border-background/35 bg-background/10 px-6 text-base text-background hover:bg-background/20 hover:text-background">
                <a href="#live-demo">
                  Hear the demo
                  <PhoneCall className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>

            <div className="mt-10 hidden max-w-xl grid-cols-3 border-y border-background/15 2xl:grid">
              {heroMetrics.map(([value, label]) => (
                <div key={label} className="border-r border-background/15 py-4 pr-3 last:border-r-0">
                  <div className="text-3xl font-semibold text-primary-glow">{value}</div>
                  <div className="mt-1 text-xs uppercase text-background/50">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-md border border-background/16 bg-[#211912]/94 shadow-[0_34px_120px_-60px_rgba(0,0,0,0.95)]">
              <div className="flex items-center justify-between border-b border-background/12 bg-[#17120f] px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                    <PhoneCall className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold">Olive & Ember inbound</div>
                    <div className="text-xs text-background/45">Live call recovered</div>
                  </div>
                </div>
                <Badge variant="outline" className="border-success/30 bg-success/15 text-success">
                  Answering now
                </Badge>
              </div>

              <div className="grid gap-px bg-background/10 md:grid-cols-[1fr_230px]">
                <div className="bg-[#241c15] p-4 md:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="text-xs font-semibold uppercase text-background/40">Call transcript</div>
                    <div className="text-xs text-background/45">00:38</div>
                  </div>
                  <div className="space-y-3">
                    {heroTranscript.map(([speaker, text], index) => (
                      <div key={`${speaker}-${text}`} className={cn("flex", speaker === "SignalHost" && "justify-end")}>
                        <div
                          className={cn(
                            "max-w-[88%] rounded-md border px-3 py-2 text-sm leading-6",
                            speaker === "SignalHost"
                              ? "border-primary/30 bg-primary/16 text-background"
                              : "border-background/12 bg-background/7 text-background/82",
                            index === heroTranscript.length - 1 && "shadow-[0_0_0_3px_rgba(220,82,34,0.12)]",
                          )}
                        >
                          <div className="mb-1 text-[10px] font-semibold uppercase text-background/38">{speaker}</div>
                          {text}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-[#18120f] p-4">
                  <div className="text-xs font-semibold uppercase text-background/40">Staff handoff</div>
                  <div className="mt-4 space-y-2">
                    {staffArtifacts.map(([label, value]) => (
                      <div key={label} className="rounded-md border border-background/12 bg-background/7 px-3 py-2">
                        <div className="text-[10px] uppercase text-background/35">{label}</div>
                        <div className="mt-0.5 text-sm font-semibold">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 rounded-md border border-success/25 bg-success/12 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-success">
                      <Check className="h-4 w-4" />
                      Task created
                    </div>
                    <p className="mt-2 text-xs leading-5 text-background/60">
                      Kitchen sees the order, owner sees the transcript, caller gets confirmation when texting is enabled.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <SectionHeader
              eyebrow="The problem"
              title="Local businesses do not lose calls. They lose moments."
              subtitle="The customer is already choosing. SignalHost gives every high-intent moment a calm, useful answer before it disappears."
            />
            <div className="grid gap-3 sm:grid-cols-2">
              {urgentMoments.map((moment) => (
                <div key={moment.title} className="group border-l-2 border-border bg-card px-4 py-4 transition-colors hover:border-primary">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-muted text-primary">
                        <moment.icon className="h-4 w-4" />
                      </span>
                      <div className="font-semibold">{moment.title}</div>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{moment.solution}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{moment.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="live-demo" className="border-b border-[#2c2119] bg-[#120f0c]">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
          <VoiceDemoPlayer />
        </div>
      </section>

      <section id="solutions" className="border-b border-border bg-card/40">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
            <div>
              <SectionHeader
                eyebrow="Solutions"
                title="One platform. Different operating manuals."
                subtitle="A restaurant, plumber, salon, and HVAC shop do not get the same script. Each vertical gets its own intake flow, escalation rules, use cases, and pricing."
              />
              <Button asChild variant="outline" className="mt-8">
                <Link to="/pricing">Compare plans</Link>
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {industrySolutions.map((solution) => (
                <Link
                  key={solution.slug}
                  to={`/solutions/${solution.slug}`}
                  className="group border border-border bg-background p-5 transition-transform hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-lg font-semibold">{solution.label}</div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{solution.proofPoint}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <div className="mt-5 border-t border-border pt-4">
                    <div className="text-xs font-semibold uppercase text-primary">Example call</div>
                    <p className="mt-2 text-sm leading-6">{solution.useCases[0]}</p>
                  </div>
                  <div className="mt-5 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Starts at</span>
                    <span className="font-semibold">${solution.pricing[0].monthly}/mo</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="how" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <SectionHeader
                eyebrow="The setup"
                title="The onboarding interview is the product's training room."
                subtitle="Owners answer plain-English questions. SignalHost turns the answers into phone behavior, chat behavior, staff handoff, links, policies, and escalation rules."
              />
              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {operatingModes.map(([title, body]) => (
                  <div key={title} className="border-t-2 border-primary/40 pt-4">
                    <div className="font-semibold">{title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-hidden rounded-md border border-border bg-foreground text-background">
              <div className="border-b border-background/12 px-5 py-4">
                <div className="text-xs font-semibold uppercase text-primary-glow">Interview preview</div>
                <div className="mt-1 text-xl font-semibold">RidgeLine Roofing</div>
              </div>
              <div className="divide-y divide-background/12">
                {[
                  ["Question", "When should a leak be treated as urgent?"],
                  ["Owner answer", "Interior water, active dripping, ceiling bulge, or storm damage gets an immediate callback."],
                  ["AI behavior", "Collect photos, address, roof type, leak location, insurance status, and create an urgent task."],
                ].map(([label, body]) => (
                  <div key={label} className="px-5 py-4">
                    <div className="text-xs font-semibold uppercase text-background/38">{label}</div>
                    <p className="mt-2 text-sm leading-6 text-background/78">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-md border border-border bg-background">
            <img src={localBusinessImage} alt="Customers being served at a busy local business" className="h-[430px] w-full object-cover" />
          </div>
          <div>
            <SectionHeader
              eyebrow="The rule"
              title="Fast when clear. Careful when it matters."
              subtitle="SignalHost should never sound like an old IVR, and it should never casually guess on safety, allergies, refunds, exact availability, or anything your staff should own."
            />
            <div className="mt-8 grid gap-3">
              {[
                "Answer FAQs, hours, directions, pricing ranges, service area, policies, and links immediately.",
                "Capture orders, appointments, estimates, reservations, intake details, and customer requests.",
                "Escalate severe allergies, complaints, emergencies, uncertain substitutions, safety issues, and refund requests.",
                "Save transcripts, summaries, recordings, tasks, outcomes, and caller details for review.",
              ].map((item) => (
                <div key={item} className="flex gap-3 border border-border bg-background p-4">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="text-sm leading-6">{item}</span>
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
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold md:text-5xl">Give your business an operator that never blinks.</h2>
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
