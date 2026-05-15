import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, MessageCircle, Phone, Star } from "lucide-react";
import {
  buildDemoAgentEmail,
  getDemoBusinessLabel,
  getDemoVoiceEmployeeName,
  getVerticalDemoProfile,
} from "@/domain/demo-verticals";
import { Button } from "@/components/ui/button";

const voiceServiceUrl = (import.meta.env.VITE_VOICE_SERVICE_URL ?? "https://hostline-voice.onrender.com").replace(/\/$/, "");

export default function DemoSite() {
  const params = useParams();
  const profile = getVerticalDemoProfile(params.demoSlug);
  const agentName = getDemoVoiceEmployeeName(profile);
  const agentEmail = buildDemoAgentEmail(profile);
  const businessLabel = getDemoBusinessLabel(profile);

  useEffect(() => {
    const typedWindow = window as Window & { SignalHostChatLoaded?: boolean };
    typedWindow.SignalHostChatLoaded = false;
    document.querySelectorAll(".signalhost-chat-root").forEach((node) => node.remove());
    document.querySelectorAll("script[data-signalhost-demo-site='true']").forEach((node) => node.remove());

    const script = document.createElement("script");
    script.src = "/signalhost-chat.js";
    script.async = true;
    script.dataset.signalhostDemoSite = "true";
    script.dataset.locationId = profile.locationId;
    script.dataset.title = `${agentName} at ${profile.businessName}`;
    script.dataset.subtitle = `Ask about ${businessLabel.toLowerCase()}, hours, links, or next steps.`;
    script.dataset.voiceServiceUrl = voiceServiceUrl;
    script.dataset.prompts = JSON.stringify(profile.samplePrompts.slice(0, 3));
    script.dataset.accentColor = "#ea580c";
    script.dataset.primaryColor = "#1f1711";
    document.body.appendChild(script);

    return () => {
      script.remove();
      document.querySelectorAll(".signalhost-chat-root").forEach((node) => node.remove());
      typedWindow.SignalHostChatLoaded = false;
    };
  }, [agentName, businessLabel, profile]);

  return (
    <div className="min-h-screen bg-[#fbfaf7] text-[#1f1711]">
      <header className="sticky top-0 z-20 border-b border-[#eadfd4] bg-[#fbfaf7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div>
            <div className="text-lg font-semibold">{profile.businessName}</div>
            <div className="text-xs uppercase tracking-[0.2em] text-[#8a6d58]">{businessLabel}</div>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-[#604b3c] md:flex">
            <a href="#services" className="hover:text-[#1f1711]">Services</a>
            <a href="#about" className="hover:text-[#1f1711]">About</a>
            <a href={`mailto:${agentEmail.address}`} className="hover:text-[#1f1711]">Contact</a>
          </nav>
          <Button asChild className="bg-[#1f1711] text-white hover:bg-[#3a2a20]">
            <a href={`tel:${profile.aiNumber.replace(/[^\d+]/g, "")}`}>
              <Phone className="mr-2 h-4 w-4" />
              Call
            </a>
          </Button>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Link to="/super/demos" className="mb-7 inline-flex items-center gap-2 text-sm text-[#725947] hover:text-[#1f1711]">
              <ArrowLeft className="h-4 w-4" />
              Demo library
            </Link>
            <div className="mb-5 inline-flex rounded-full border border-[#eadfd4] bg-white px-3 py-1 text-xs font-medium text-[#7a5a42]">
              Live SignalHost chat demo
            </div>
            <h1 className="max-w-3xl text-5xl font-semibold leading-[0.98] md:text-7xl">
              {profile.websiteSections[0]?.title ?? profile.businessName}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[#604b3c]">
              {profile.websiteSections[0]?.body ?? profile.subtitle}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-[#ea580c] text-white hover:bg-[#c94a08]">
                <a href={`tel:${profile.aiNumber.replace(/[^\d+]/g, "")}`}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call {agentName}
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-[#d7c8b8] bg-white">
                <a href={`mailto:${agentEmail.address}`}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Email {agentName}
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#eadfd4] bg-white p-4 shadow-[0_28px_80px_rgba(31,23,17,0.12)]">
            <div className="rounded-[22px] bg-[#1f1711] p-6 text-white">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <div className="text-sm text-white/55">SignalHost employee</div>
                  <div className="mt-1 text-2xl font-semibold">{agentName}</div>
                </div>
                <div className="rounded-full bg-[#ea580c] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]">Live</div>
              </div>
              <div className="grid gap-3 py-6">
                {profile.samplePrompts.map((prompt) => (
                  <div key={prompt} className="rounded-2xl border border-white/10 bg-white/8 p-4 text-sm leading-6 text-white/82">
                    "{prompt}"
                  </div>
                ))}
              </div>
              <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
                <DemoMetric label="Voice" value={agentName} />
                <DemoMetric label="Email" value={agentEmail.routable ? "Routable" : "Draft"} />
                <DemoMetric label="Text" value="Ready later" />
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="border-y border-[#eadfd4] bg-white">
          <div className="mx-auto grid max-w-6xl gap-5 px-5 py-14 md:grid-cols-3">
            {profile.websiteSections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-[#eadfd4] bg-[#fbfaf7] p-6">
                <CalendarClock className="mb-5 h-5 w-5 text-[#ea580c]" />
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-3 text-sm leading-6 text-[#604b3c]">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="about" className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-8 lg:grid-cols-[0.75fr_1fr] lg:items-start">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#8a6d58]">Why people call</div>
              <h2 className="mt-3 text-3xl font-semibold">A working demo for real customer questions.</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {profile.testScenarios.map((scenario) => (
                <div key={scenario} className="rounded-2xl border border-[#eadfd4] bg-white p-4 text-sm font-medium text-[#4b3b2f]">
                  <Star className="mb-3 h-4 w-4 fill-[#ea580c] text-[#ea580c]" />
                  {scenario}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

function DemoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">{label}</div>
      <div className="mt-1 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}
