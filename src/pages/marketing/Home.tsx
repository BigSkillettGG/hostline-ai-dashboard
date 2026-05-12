import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  ClipboardList,
  Headphones,
  MessageSquareText,
  Phone,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { VoiceDemoPlayer } from "@/components/marketing/VoiceDemoPlayer";
import { industrySolutions } from "@/data/industry-solutions";

const heroRestaurant = "/marketing/hero-restaurant.jpg";
const hostOnPhone = "/marketing/host-on-phone.jpg";

const faqs = [
  { q: "Does this only work for restaurants?", a: "No. Restaurants are the first polished demo, but the platform now supports restaurants, HVAC, plumbers, roofers, electricians, and hair salons or barbershops." },
  { q: "Will callers know they are talking to AI?", a: "The greeting is configurable by business. The agent is designed to sound like a polished front-desk operator while staying conservative and safe in sensitive situations." },
  { q: "How long does setup take?", a: "Most businesses can test the first call the same day. Choose an industry, answer the setup interview, add links or files, and forward the phone line to HostLine." },
  { q: "What if the AI does not know the answer?", a: "It takes a clean message, alerts staff, saves the transcript, and avoids promising anything it cannot verify." },
  { q: "Can I keep my current phone number?", a: "Yes. You can port the number later or simply forward unanswered, busy, after-hours, or all calls to your HostLine number." },
];

export default function MarketingHome() {
  return (
    <>
      <section className="relative overflow-hidden border-b border-border bg-card/35">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
          <div>
            <Badge variant="outline" className="mb-5 gap-1.5 border-primary/30 bg-primary/10 text-primary">
              <Sparkles className="h-3 w-3" />
              AI phone and website chat for local businesses
            </Badge>
            <h1 className="max-w-4xl text-4xl font-semibold leading-none text-foreground md:text-6xl lg:text-7xl">
              Be where your customers are, every time they reach out.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
              HostLine answers calls and website chats, captures requests, sends links, books or queues appointments, escalates sensitive issues, and gives your team the transcript.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-12 px-6 text-base">
                <Link to="/signup">
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="h-12 px-6 text-base">
                <a href="#solutions">
                  See solutions
                  <Phone className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
            <div className="mt-6 grid gap-3 text-sm text-muted-foreground sm:grid-cols-3">
              {["Phone and website chat", "Setup interview included", "No hardware required"].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-success" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-lg border border-border bg-background shadow-sm">
              <img src={hostOnPhone} alt="A front desk team member answering the phone" className="h-72 w-full object-cover md:h-96" />
              <div className="border-t border-border p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase text-primary">Live customer request</div>
                    <p className="mt-1 text-sm text-muted-foreground">Call answered, intent detected, staff task created.</p>
                  </div>
                  <div className="rounded-md bg-success/10 px-3 py-2 text-sm font-semibold text-success">Resolved</div>
                </div>
              </div>
            </div>
            <div className="absolute -bottom-6 left-5 right-5 rounded-lg border border-border bg-background p-4 shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Headphones className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">"Hi, thank you for calling. How can I help you?"</div>
                  <p className="mt-1 text-xs text-muted-foreground">Natural voice for calls. Same knowledge base for chat.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="solutions" className="border-b border-border">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeader
            eyebrow="Solutions"
            title="Six launch industries. One flexible operating brain."
            subtitle="Each solution has its own use cases, pricing, integrations, onboarding questions, and voice behavior."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {industrySolutions.map((solution) => (
              <Card key={solution.slug} className="group border-border/80 transition-shadow hover:shadow-md">
                <CardContent className="flex h-full flex-col p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-lg font-semibold">{solution.label}</div>
                    <Badge variant="secondary">${solution.pricing[0].monthly}/mo</Badge>
                  </div>
                  <p className="mt-3 min-h-20 text-sm leading-6 text-muted-foreground">{solution.heroSubtitle}</p>
                  <div className="mt-5 space-y-2 text-sm">
                    {solution.useCases.slice(0, 3).map((useCase) => (
                      <div key={useCase} className="flex gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                        <span>{useCase}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Button asChild className="flex-1">
                      <Link to={`/solutions/${solution.slug}`}>Explore</Link>
                    </Button>
                    <Button asChild variant="outline" className="flex-1">
                      <Link to={`/signup?industry=${solution.slug}`}>Sign up</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="live-demo" className="border-b border-[#2c2119] bg-[#120f0c]">
        <div className="mx-auto max-w-6xl px-5 py-20 md:py-24">
          <VoiceDemoPlayer />
        </div>
      </section>

      <section id="how" className="border-b border-border bg-card/35">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <SectionHeader
            eyebrow="How it works"
            title="A setup interview becomes the AI's operating manual."
            subtitle="The owner does not need to understand prompts, databases, or integrations. They answer plain-English questions and HostLine turns that into call behavior."
          />
          <div className="mt-10 grid gap-5 md:grid-cols-4">
            {[
              { icon: ClipboardList, title: "Choose an industry", body: "Restaurants, HVAC, plumbers, roofers, electricians, or salons and barbershops." },
              { icon: MessageSquareText, title: "Answer the interview", body: "Hours, policies, services, prices, links, safety rules, staff routing, and tone." },
              { icon: Phone, title: "Forward the phone", body: "Keep the current number. Forward missed, busy, after-hours, or all calls to HostLine." },
              { icon: CalendarCheck, title: "Capture the work", body: "Calls and chats become requests, appointments, orders, transcripts, tasks, and analytics." },
            ].map((step) => (
              <div key={step.title} className="rounded-lg border border-border bg-background p-5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <div className="text-sm font-semibold">{step.title}</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="overflow-hidden rounded-lg border border-border">
            <img src={heroRestaurant} alt="A busy local business serving customers" className="h-96 w-full object-cover" />
          </div>
          <div>
            <SectionHeader
              eyebrow="What it handles"
              title="More than FAQs. More than voicemail."
              subtitle="HostLine is designed around the real calls that interrupt local businesses all day."
            />
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {[
                "Availability, hours, directions, parking, service area",
                "Booking links, quote links, order links, intake forms",
                "Orders, appointments, reservations, estimates, and staff-review queues",
                "Complaints, refunds, safety issues, allergies, and uncertain requests",
                "Lost items, delivery drivers, vendors, hiring, donations, and press",
                "Website chat with the same brain as the phone agent",
              ].map((item) => (
                <div key={item} className="flex gap-2 rounded-lg border border-border bg-card/30 p-3 text-sm">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-card/35">
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

      <section className="mx-auto max-w-4xl px-5 py-20 text-center">
        <div className="mx-auto inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Zap className="h-5 w-5" />
        </div>
        <h2 className="mt-5 text-3xl font-semibold md:text-4xl">Start with your next missed call.</h2>
        <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
          Pick the industry, answer the setup interview, and test the first call on a real phone line.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6">
            <Link to="/signup">Start free</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 px-6">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>
    </>
  );
}
