import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, MessageSquareText, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type LegalSection = {
  title: string;
  body?: string;
  items?: string[];
};

type LegalPageProps = {
  badge: string;
  title: string;
  intro: string;
  updated: string;
  sections: LegalSection[];
  asideTitle: string;
  asideItems: string[];
};

const updatedDate = "May 19, 2026";

function LegalPage({ badge, title, intro, updated, sections, asideTitle, asideItems }: LegalPageProps) {
  return (
    <>
      <section className="border-b border-border bg-foreground text-background">
        <div className="mx-auto max-w-6xl px-5 py-14 md:py-20">
          <Button asChild variant="ghost" className="-ml-3 mb-6 text-background/75 hover:bg-background/10 hover:text-background">
            <Link to="/">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to SignalHost
            </Link>
          </Button>
          <Badge variant="outline" className="mb-5 border-background/25 bg-background/10 text-background">
            {badge}
          </Badge>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">{title}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-background/72 md:text-lg">{intro}</p>
          <p className="mt-6 text-sm text-background/55">Last updated: {updated}</p>
        </div>
      </section>

      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 lg:grid-cols-[1fr_320px]">
          <div className="space-y-10">
            {sections.map((section) => (
              <section key={section.title} className="border-b border-border pb-8 last:border-b-0">
                <h2 className="text-2xl font-semibold text-foreground">{section.title}</h2>
                {section.body ? <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">{section.body}</p> : null}
                {section.items ? (
                  <ul className="mt-4 grid gap-3 text-sm leading-6 text-muted-foreground">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <aside className="h-fit rounded-lg border border-border bg-card p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {asideTitle}
            </div>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
              {asideItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="mt-5 rounded-md border border-border bg-background p-4 text-sm">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Mail className="h-4 w-4 text-primary" />
                Questions
              </div>
              <p className="mt-2 text-muted-foreground">Email us at hello@signalhost.ai.</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

export function SmsConsent() {
  return (
    <LegalPage
      badge="SMS consent"
      title="How customers opt in to SignalHost text messages"
      intro="This page documents the SignalHost SMS consent flow for customer-care and transactional text messages. SignalHost sends texts only when a customer asks for a text, agrees to receive one, or starts an SMS conversation with a SignalHost number."
      updated={updatedDate}
      asideTitle="Twilio review summary"
      asideItems={[
        "Use case: customer care and transactional follow-up.",
        "Opt-in is collected during phone calls, website chat, web forms, or inbound SMS.",
        "Texts are not sent for marketing blasts in the current product.",
        "Customers can reply STOP or HELP at any time.",
      ]}
      sections={[
        {
          title: "Who sends the messages",
          body: "SignalHost operates the texting workflow on behalf of local businesses that use SignalHost to answer phone calls, website chats, and customer requests.",
          items: [
            "The message identifies the relevant business when SignalHost is texting on that business's behalf.",
            "SignalHost may use one verified toll-free texting number for customer-care messages across participating businesses.",
            "SignalHost keeps message history connected to the correct business, customer phone number, and request thread.",
          ],
        },
        {
          title: "How a customer opts in",
          body: "A customer gives consent before SignalHost sends a text. Consent may happen in one of the flows below.",
          items: [
            "Phone call opt-in: the SignalHost assistant asks, for example, 'Would you like me to text a copy of that request to the number ending 1234?' A text is sent only after the caller says yes or asks for the text.",
            "Website chat or web form opt-in: the customer provides their mobile number and agrees to receive a text related to their request, such as a booking link, order link, appointment request, or callback update.",
            "Inbound SMS opt-in: the customer starts the text conversation by texting SignalHost first.",
            "Owner or staff opt-in: business owners and approved staff can add their own mobile numbers to receive operational alerts, reports, or follow-up notifications from SignalHost.",
          ],
        },
        {
          title: "What messages customers may receive",
          items: [
            "Reservation, appointment, quote, order, or service-request summaries.",
            "Links the customer asked for, such as ordering links, booking links, intake forms, photo upload links, or website chat follow-up links.",
            "Callback updates, staff follow-up notices, or answers to questions the customer asked SignalHost to check.",
            "Customer-care responses when the customer replies to SignalHost by text.",
          ],
        },
        {
          title: "Sample message language",
          items: [
            "Olive & Ember via SignalHost: Your reservation request for tonight at 6 PM was sent to the team. Reply here if you need to update anything. Reply STOP to opt out.",
            "Harbor Plumbing via SignalHost: We sent your service request to dispatch. Someone will follow up shortly. Reply HELP for help or STOP to opt out.",
            "SignalHost: Here is the booking link you requested: https://example.com/book. Message and data rates may apply.",
          ],
        },
        {
          title: "Opt-out and help",
          items: [
            "A recipient can reply STOP to opt out of SignalHost text messages.",
            "A recipient can reply START to opt back in where supported.",
            "A recipient can reply HELP for assistance or email hello@signalhost.ai.",
            "Message frequency varies based on the customer's request and conversation. Message and data rates may apply.",
          ],
        },
        {
          title: "Data sharing",
          body: "SignalHost does not sell mobile phone numbers, SMS opt-in data, or text messaging consent. SignalHost does not share SMS opt-in data with third parties or affiliates for their marketing or promotional purposes.",
        },
      ]}
    />
  );
}

export function Privacy() {
  return (
    <LegalPage
      badge="Privacy"
      title="SignalHost Privacy Policy"
      intro="This policy explains how SignalHost collects, uses, and protects information when businesses use SignalHost and when customers interact with SignalHost by phone, SMS, website chat, email, or web forms."
      updated={updatedDate}
      asideTitle="Privacy basics"
      asideItems={[
        "We collect information needed to answer, route, and summarize customer interactions.",
        "We use customer data to provide SignalHost services to the business being contacted.",
        "We do not sell SMS consent data or share it for third-party marketing.",
        "Businesses can request access, correction, or deletion support.",
      ]}
      sections={[
        {
          title: "Information we collect",
          items: [
            "Business account information, such as business name, industry, locations, hours, services, staff contacts, and billing or onboarding details.",
            "Customer interaction information, such as caller ID, phone numbers, chat messages, emails, SMS replies, transcripts, recordings, summaries, request details, and follow-up status.",
            "Operational information, such as logs, diagnostics, delivery status, usage counts, device/browser data, and service performance information.",
            "Uploaded or linked business knowledge, such as menus, service lists, policies, FAQs, booking links, order links, and temporary updates.",
          ],
        },
        {
          title: "How we use information",
          items: [
            "To answer calls, chats, texts, and emails for participating businesses.",
            "To create summaries, transcripts, staff tasks, alerts, reports, and follow-up records.",
            "To send customer-care and transactional messages that customers request or agree to receive.",
            "To improve SignalHost quality, reliability, safety, and support.",
            "To operate billing, onboarding, authentication, security, compliance, and customer support.",
          ],
        },
        {
          title: "SMS privacy",
          body: "SignalHost does not sell mobile phone numbers, SMS opt-in data, or text messaging consent. SignalHost does not share SMS opt-in data with third parties or affiliates for their marketing or promotional purposes.",
        },
        {
          title: "Service providers",
          body: "SignalHost uses trusted service providers to operate the product, such as cloud hosting, communications providers, AI infrastructure, payment processors, analytics, support, and email delivery. These providers process information only as needed to provide services to SignalHost.",
        },
        {
          title: "Data retention",
          body: "SignalHost keeps information for as long as needed to provide the service, comply with legal obligations, resolve disputes, enforce agreements, and support business records. Retention periods may vary by data type and customer configuration.",
        },
        {
          title: "Security",
          body: "SignalHost uses technical and organizational safeguards designed to protect information. No online service is perfect, but we work to keep access limited, monitored, and appropriate for the service.",
        },
        {
          title: "Your choices",
          items: [
            "SMS recipients can reply STOP to opt out or HELP for help.",
            "Businesses can update their knowledge base, contacts, settings, and notification preferences.",
            "Businesses may contact SignalHost to request access, correction, export, or deletion support where applicable.",
          ],
        },
      ]}
    />
  );
}

export function Terms() {
  return (
    <LegalPage
      badge="Terms"
      title="SignalHost Terms of Service"
      intro="These terms describe the basic rules for using SignalHost. They are written for the current pilot and early commercial product and may be updated as the product matures."
      updated={updatedDate}
      asideTitle="Service expectations"
      asideItems={[
        "SignalHost helps answer, route, and summarize business communications.",
        "Businesses remain responsible for their own policies, promises, and customer outcomes.",
        "SignalHost should not be used for emergencies or unsafe instructions.",
        "Messaging must follow consent, opt-out, and compliance rules.",
      ]}
      sections={[
        {
          title: "Using SignalHost",
          body: "SignalHost provides AI-assisted phone answering, website chat, SMS, email handling, knowledge-base workflows, call summaries, staff alerts, reporting, and related tools for local businesses.",
        },
        {
          title: "Business responsibility",
          items: [
            "Businesses are responsible for the accuracy of the information they provide to SignalHost, including hours, prices, services, menus, policies, service areas, links, and staff instructions.",
            "Businesses are responsible for reviewing sensitive requests, complaints, allergies, safety issues, price questions, and any item that requires human confirmation.",
            "Businesses are responsible for honoring customer commitments made by their staff or systems and for correcting SignalHost if information becomes outdated.",
          ],
        },
        {
          title: "AI limitations",
          body: "SignalHost is designed to be careful, helpful, and conservative, but AI systems can misunderstand speech, miss context, or make mistakes. SignalHost should be monitored, tested, and corrected by the business, especially before full launch.",
        },
        {
          title: "Messaging rules",
          items: [
            "Businesses may use SignalHost messaging only for lawful, consent-based communications.",
            "Customers must be able to opt out of SMS by replying STOP.",
            "SignalHost may suspend messaging that appears abusive, deceptive, unlawful, unsafe, or non-compliant.",
            "SignalHost does not support unsolicited marketing blasts in the current product.",
          ],
        },
        {
          title: "No emergency service",
          body: "SignalHost is not an emergency service. Businesses should instruct callers to contact emergency services where appropriate, and SignalHost should not be used as the only path for urgent life-safety communications.",
        },
        {
          title: "Acceptable use",
          items: [
            "Do not use SignalHost to send spam, phishing, harassment, fraud, illegal content, or deceptive communications.",
            "Do not upload or instruct SignalHost to use content you do not have the right to use.",
            "Do not attempt to bypass security, rate limits, identity checks, compliance systems, or platform restrictions.",
          ],
        },
        {
          title: "Changes and availability",
          body: "SignalHost may change features, pricing, limits, providers, and workflows over time. We work to keep the service reliable, but availability may be affected by carriers, AI providers, hosting providers, customer configuration, or other dependencies.",
        },
      ]}
    />
  );
}

export function SmsComplianceNote() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
      <MessageSquareText className="mt-0.5 h-4 w-4 text-primary" />
      <p className="leading-6 text-muted-foreground">
        SignalHost texts customers only after they ask for or agree to a text related to their request.
      </p>
    </div>
  );
}
