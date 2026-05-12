import type { BusinessType } from "@/domain/business-templates";

export interface IndustryPricingTier {
  id: "basic" | "growth" | "pro";
  name: string;
  monthly: number;
  includedInteractions: number;
  overage: string;
  blurb: string;
  features: string[];
}

export interface IndustrySolution {
  businessType: BusinessType;
  ctaLabel: string;
  customerNoun: string;
  heroTitle: string;
  heroSubtitle: string;
  integrations: string[];
  label: string;
  landing: {
    callout: string;
    callerLine: string;
    cta: string;
    headline: string;
    operatorReply: string;
    proof: string;
    staffHandoff: string;
    stakes: string;
    stats: Array<{ label: string; value: string }>;
  };
  outcomeMetrics: string[];
  proofPoint: string;
  setupFocus: string[];
  slug: string;
  staffNoun: string;
  useCases: string[];
  valuePillars: Array<{ title: string; body: string }>;
  pricing: IndustryPricingTier[];
}

export const industrySolutions: IndustrySolution[] = [
  {
    businessType: "restaurant",
    ctaLabel: "Start restaurant setup",
    customerNoun: "guest",
    heroTitle: "An AI host that answers every restaurant call.",
    heroSubtitle:
      "Handle dinner-rush questions, pickup orders, reservation requests, delivery driver calls, allergies, complaints, and after-hours questions without pulling your host off the floor.",
    integrations: ["Toast", "Square", "Clover", "OpenTable", "Resy", "Yelp Reservations"],
    label: "Restaurants",
    landing: {
      callout: "Dinner rush does not wait for voicemail.",
      callerLine: "Do you have a table for four tonight, and can I place a pickup order too?",
      cta: "Turn dinner-rush calls into orders and reservation requests.",
      headline: "When the host stand is slammed, SignalHost still picks up.",
      operatorReply: "I can help with both. Let me take the order first, then I will collect the reservation request and send the team the details.",
      proof: "Built for the messy mix of orders, reservations, allergies, parking, specials, and complaint calls restaurants get every night.",
      staffHandoff: "Order details, reservation request, caller number, transcript, recording, allergy flags, and staff task.",
      stakes: "Missed calls become lost covers, lost pickup revenue, and guests who call the restaurant down the street.",
      stats: [
        { label: "covered", value: "rush hour" },
        { label: "captured", value: "orders" },
        { label: "protected", value: "allergy calls" },
      ],
    },
    outcomeMetrics: ["pickup orders captured", "reservation requests saved", "hosts back on the floor"],
    proofPoint: "Built for missed calls, busy lines, and the questions restaurants get all night.",
    setupFocus: [
      "Menus, modifiers, substitutions, timed pricing, happy hour, and specials",
      "Pickup order rules, payment policy, kitchen routing, and online ordering links",
      "Reservation rules, private dining, holidays, deposits, waitlist, and seating areas",
      "Allergy, complaint, lost-and-found, vendor, hiring, donation, and delivery-driver policies",
    ],
    slug: "restaurants",
    staffNoun: "host",
    useCases: [
      "Takes a pickup order with modifiers, name, phone number, ETA, and staff review",
      "Answers tonight's specials, wine questions, brunch hours, parking, patio seating, and live music",
      "Collects reservation requests when OpenTable or Resy is not connected",
      "Sends ordering or reservation links when that is the restaurant's preferred flow",
      "Escalates severe allergies, refund requests, complaints, and uncertain substitution requests",
      "Takes vendor messages and delivery-driver pickup questions without interrupting service",
    ],
    valuePillars: [
      { title: "Recover missed revenue", body: "Dinner-rush calls become orders and reservation requests instead of voicemails." },
      { title: "Protect the guest experience", body: "Your host can greet people at the door while Vera handles routine phone traffic." },
      { title: "Know what happened", body: "Every call has a transcript, summary, intent, staff task, and optional recording." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 79,
        includedInteractions: 250,
        overage: "$0.45 per extra call or chat",
        blurb: "For small restaurants that need reliable call coverage.",
        features: ["24/7 AI answering", "Hours, directions, FAQs", "Reservation request capture", "Call transcripts and staff alerts"],
      },
      {
        id: "growth",
        name: "Service",
        monthly: 199,
        includedInteractions: 800,
        overage: "$0.35 per extra call or chat",
        blurb: "For busy independents taking orders and reservation requests.",
        features: ["Everything in Basic", "Pickup order capture", "Menu, modifiers, specials", "SMS-ready confirmations", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 399,
        includedInteractions: 1800,
        overage: "$0.25 per extra call or chat",
        blurb: "For multi-location restaurants and connected workflows.",
        features: ["Everything in Service", "Toast or Square integration", "OpenTable or Resy workflow", "Advanced routing", "Priority support"],
      },
    ],
  },
  {
    businessType: "hvac",
    ctaLabel: "Start HVAC setup",
    customerNoun: "customer",
    heroTitle: "Book more HVAC jobs without missing emergency calls.",
    heroSubtitle:
      "Answer no-heat, no-AC, tune-up, filter, warranty, financing, and after-hours calls while your techs stay in the field and dispatch stays focused.",
    integrations: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Zapier", "HubSpot"],
    label: "HVAC",
    landing: {
      callout: "The first company to answer often wins the job.",
      callerLine: "My heat is out, I have kids at home, and I need someone today.",
      cta: "Capture emergency HVAC demand before the next company answers.",
      headline: "Book more HVAC jobs when the phone spikes.",
      operatorReply: "I am sorry you are dealing with that. I will collect the address, system type, urgency, and callback number so dispatch can prioritize you.",
      proof: "Designed for no-heat, no-AC, tune-up, warranty, financing, membership, and after-hours calls during seasonal surges.",
      staffHandoff: "Urgency, equipment type, address, membership status, preferred window, callback number, and safety flags.",
      stakes: "During heat waves and cold snaps, every unanswered call is a ready-to-book homeowner moving down the search results.",
      stats: [
        { label: "triaged", value: "emergency" },
        { label: "booked", value: "tune-ups" },
        { label: "captured", value: "estimates" },
      ],
    },
    outcomeMetrics: ["emergency leads captured", "tune-ups booked", "dispatch interruptions reduced"],
    proofPoint: "Perfect for seasonal spikes, after-hours emergencies, and callers who need reassurance fast.",
    setupFocus: [
      "Heating, cooling, indoor air quality, maintenance plans, and equipment brands",
      "Emergency thresholds, service areas, trip fees, financing, warranties, and safety disclaimers",
      "Appointment links, estimate links, dispatch rules, photos, and property details",
      "Membership plans, seasonal promotions, callback timing, and escalation rules",
    ],
    slug: "hvac",
    staffNoun: "dispatcher",
    useCases: [
      "Captures no-heat and no-AC calls with address, urgency, equipment type, and callback number",
      "Books tune-ups or sends a scheduling link when the caller is ready",
      "Explains service area, emergency fees, financing, maintenance plans, and warranty basics",
      "Collects estimate requests for system replacement, mini-splits, ductwork, and IAQ upgrades",
      "Flags gas smell, carbon monoxide, electrical hazards, and unsafe situations for immediate human follow-up",
      "Handles vendor calls, employment questions, and existing-job status requests",
    ],
    valuePillars: [
      { title: "Win the urgent call", body: "When a homeowner has no heat or no AC, the company that answers first usually wins." },
      { title: "Qualify before dispatch", body: "Capture equipment, urgency, address, and access details before your team calls back." },
      { title: "Sell the maintenance plan", body: "Vera can mention tune-ups, memberships, and seasonal promos at the right moment." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 89,
        includedInteractions: 200,
        overage: "$0.55 per extra call or chat",
        blurb: "For owner-operated HVAC shops that need every lead answered.",
        features: ["24/7 AI answering", "Service area and FAQ answers", "Emergency lead capture", "Staff callback alerts"],
      },
      {
        id: "growth",
        name: "Dispatch",
        monthly: 249,
        includedInteractions: 700,
        overage: "$0.40 per extra call or chat",
        blurb: "For shops that want appointment and estimate intake handled automatically.",
        features: ["Everything in Basic", "Appointment request capture", "Estimate and tune-up links", "Membership and promo scripts", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 549,
        includedInteractions: 1600,
        overage: "$0.30 per extra call or chat",
        blurb: "For high-volume HVAC teams with connected dispatch.",
        features: ["Everything in Dispatch", "ServiceTitan or Jobber workflow", "Advanced emergency routing", "Multi-location support", "Priority support"],
      },
    ],
  },
  {
    businessType: "plumbing",
    ctaLabel: "Start plumbing setup",
    customerNoun: "customer",
    heroTitle: "Answer every leak, clog, and water-heater call.",
    heroSubtitle:
      "Turn missed calls into qualified plumbing jobs, collect the right details, and protect your team from vague voicemails and repeat phone tag.",
    integrations: ["Housecall Pro", "Jobber", "ServiceTitan", "Google Calendar", "Zapier", "QuickBooks"],
    label: "Plumbers",
    landing: {
      callout: "Leaks do not leave calm voicemails.",
      callerLine: "There is water coming through the ceiling. Do you have anyone available?",
      cta: "Answer urgent plumbing calls with calm, useful intake.",
      headline: "When water is moving, your phone has to answer.",
      operatorReply: "I can help get the right details to the team. Is the water actively flowing, and do you know where the shutoff valve is?",
      proof: "Built for leaks, clogged drains, water heaters, sewer backups, fixture installs, emergency pricing, and property-manager calls.",
      staffHandoff: "Leak location, shutoff status, property type, urgency, photos/link prompt, access notes, and caller details.",
      stakes: "Plumbing callers are high intent. If they reach voicemail, they usually keep calling until someone answers.",
      stats: [
        { label: "captured", value: "leaks" },
        { label: "routed", value: "urgent" },
        { label: "organized", value: "job details" },
      ],
    },
    outcomeMetrics: ["leaks triaged", "estimates requested", "callbacks prioritized"],
    proofPoint: "Built for urgent, messy, high-intent calls where speed and confidence matter.",
    setupFocus: [
      "Leaks, drains, toilets, water heaters, fixtures, sump pumps, remodels, and emergency service",
      "Service area, trip fees, emergency pricing, licenses, warranties, and safety instructions",
      "Photo intake, quote requests, booking links, access notes, property type, and shutoff status",
      "Commercial work, remodels, permit-sensitive jobs, and after-hours callback rules",
    ],
    slug: "plumbers",
    staffNoun: "dispatcher",
    useCases: [
      "Collects leak location, severity, shutoff status, property type, and access notes",
      "Answers water heater replacement, drain clearing, toilet repair, and fixture install questions",
      "Sends quote or booking links for non-emergency jobs",
      "Escalates active flooding, sewer backups, gas line requests, and safety issues",
      "Explains service area, diagnostic fees, emergency rates, warranties, and payment basics",
      "Takes messages from vendors, inspectors, property managers, and repeat customers",
    ],
    valuePillars: [
      { title: "Never miss the emergency", body: "Plumbing callers are motivated. If you miss them, they call the next plumber." },
      { title: "Get cleaner job details", body: "Vera asks the practical questions your dispatcher needs before calling back." },
      { title: "Keep promises conservative", body: "The AI can collect requests without over-promising price, availability, or safety." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 79,
        includedInteractions: 200,
        overage: "$0.55 per extra call or chat",
        blurb: "For small plumbing shops that cannot afford missed calls.",
        features: ["24/7 AI answering", "Emergency intake", "Service area FAQs", "Staff callback alerts"],
      },
      {
        id: "growth",
        name: "Dispatch",
        monthly: 229,
        includedInteractions: 650,
        overage: "$0.40 per extra call or chat",
        blurb: "For growing teams that want better intake and appointment requests.",
        features: ["Everything in Basic", "Booking and quote links", "Photo/intake form prompts", "Existing-job status capture", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 499,
        includedInteractions: 1500,
        overage: "$0.30 per extra call or chat",
        blurb: "For plumbing companies with dispatch software and high call volume.",
        features: ["Everything in Dispatch", "Housecall Pro or Jobber workflow", "Advanced escalation routing", "Multi-location support", "Priority support"],
      },
    ],
  },
  {
    businessType: "roofing",
    ctaLabel: "Start roofing setup",
    customerNoun: "homeowner",
    heroTitle: "Capture every roof repair, storm, and estimate call.",
    heroSubtitle:
      "Qualify roofing leads, collect storm and insurance details, send estimate links, and route urgent leak calls before the next contractor answers.",
    integrations: ["JobNimbus", "AccuLynx", "CompanyCam", "Jobber", "Google Calendar", "Zapier"],
    label: "Roofers",
    landing: {
      callout: "Storm leads come in waves.",
      callerLine: "The storm last night damaged my roof, and now there is a leak upstairs.",
      cta: "Capture storm, repair, and inspection leads while crews are in the field.",
      headline: "After the storm, SignalHost catches the calls your crew cannot.",
      operatorReply: "I can get this to the team quickly. I will collect your address, roof type, leak location, photos, and insurance status.",
      proof: "Built for storm damage, emergency tarping, inspections, estimates, financing, warranties, and active leak escalation.",
      staffHandoff: "Address, storm date, roof type, leak status, photo prompt, insurance context, urgency, and callback number.",
      stakes: "Roofing demand is bursty. If your office misses the surge, another contractor owns the relationship.",
      stats: [
        { label: "captured", value: "storm leads" },
        { label: "flagged", value: "active leaks" },
        { label: "ready", value: "inspection notes" },
      ],
    },
    outcomeMetrics: ["storm leads captured", "estimate requests organized", "urgent leaks escalated"],
    proofPoint: "Especially useful after storms, during inspection season, and when crews are on roofs instead of phones.",
    setupFocus: [
      "Roof repairs, replacements, inspections, gutters, skylights, storm damage, and emergency tarping",
      "Service area, roof type, insurance process, estimate windows, photos, and property access",
      "Lead qualification, appointment links, quote links, financing, warranty, and project timeline rules",
      "Urgent leak escalation, safety boundaries, weather delays, and commercial roofing workflows",
    ],
    slug: "roofers",
    staffNoun: "office team",
    useCases: [
      "Captures storm damage calls with address, roof type, photos, leak status, and insurance context",
      "Schedules or requests roof inspections without interrupting sales reps",
      "Explains service area, estimate timing, financing, warranties, and emergency tarping basics",
      "Routes active interior leaks and unsafe situations to urgent staff follow-up",
      "Collects commercial roofing requests separately from residential repair calls",
      "Handles vendor, supplier, warranty, and existing-project status calls",
    ],
    valuePillars: [
      { title: "Respond faster after storms", body: "The first roofing company to answer and organize the lead has the advantage." },
      { title: "Qualify before the inspection", body: "Capture photos, roof type, insurance status, and urgency before the callback." },
      { title: "Keep sales reps selling", body: "Routine questions and appointment requests stop breaking their day." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 69,
        includedInteractions: 175,
        overage: "$0.55 per extra call or chat",
        blurb: "For local roofers that want every lead captured.",
        features: ["24/7 AI answering", "Repair and estimate intake", "Service area FAQs", "Urgent leak alerts"],
      },
      {
        id: "growth",
        name: "Sales",
        monthly: 219,
        includedInteractions: 600,
        overage: "$0.40 per extra call or chat",
        blurb: "For roofing teams that need better lead qualification.",
        features: ["Everything in Basic", "Inspection request capture", "Quote and photo links", "Storm and insurance scripts", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 479,
        includedInteractions: 1400,
        overage: "$0.30 per extra call or chat",
        blurb: "For roofers that want connected sales and production workflows.",
        features: ["Everything in Sales", "JobNimbus or AccuLynx workflow", "CompanyCam handoff", "Multi-market support", "Priority support"],
      },
    ],
  },
  {
    businessType: "electrical",
    ctaLabel: "Start electrician setup",
    customerNoun: "customer",
    heroTitle: "An AI dispatcher for electrical calls and urgent safety issues.",
    heroSubtitle:
      "Capture panel, outlet, EV charger, generator, lighting, and emergency electrical calls while keeping safety-sensitive conversations conservative.",
    integrations: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Zapier", "HubSpot"],
    label: "Electricians",
    landing: {
      callout: "Electrical calls need confidence and caution.",
      callerLine: "The outlet is sparking and half the room lost power. Is that dangerous?",
      cta: "Route urgent electrical calls without guessing on safety.",
      headline: "A safer front desk for electrical demand.",
      operatorReply: "I do not want to guess on safety. I will collect the details and mark this urgent so a licensed team member can call you back.",
      proof: "Built for outlets, panels, EV chargers, generators, lighting, inspections, permits, emergency rates, and safety escalation.",
      staffHandoff: "Symptom, panel/breaker notes, property type, safety concern, preferred window, address, and callback number.",
      stakes: "The highest-value electrical calls are often the ones that require the most careful intake.",
      stats: [
        { label: "escalated", value: "safety" },
        { label: "captured", value: "EV leads" },
        { label: "qualified", value: "projects" },
      ],
    },
    outcomeMetrics: ["urgent calls escalated", "estimates booked", "job details captured"],
    proofPoint: "Designed for high-intent callers who need confidence, safety, and a fast callback.",
    setupFocus: [
      "Repairs, panel upgrades, EV chargers, generators, lighting, outlets, inspections, and commercial work",
      "Safety escalation, licensing, permits, service area, trip fees, and after-hours emergency policy",
      "Estimate links, booking links, property details, photos, access notes, and preferred service windows",
      "Existing-job status, warranty calls, vendor calls, and commercial maintenance requests",
    ],
    slug: "electricians",
    staffNoun: "dispatcher",
    useCases: [
      "Captures breaker, outlet, panel, lighting, EV charger, and generator requests",
      "Escalates burning smells, sparking, partial power loss, and other safety-sensitive calls",
      "Sends booking or estimate links for non-urgent electrical work",
      "Explains permits, licenses, service area, diagnostic fees, and emergency rates",
      "Collects property type, access, photos, preferred time, and callback details",
      "Routes commercial maintenance and existing-job status calls to the right staff path",
    ],
    valuePillars: [
      { title: "Protect urgent calls", body: "Safety-sensitive callers get careful triage and fast staff escalation." },
      { title: "Capture profitable projects", body: "EV chargers, panels, generators, and lighting estimates never disappear into voicemail." },
      { title: "Reduce dispatcher load", body: "Routine FAQs and job-detail collection happen before the callback." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 79,
        includedInteractions: 200,
        overage: "$0.55 per extra call or chat",
        blurb: "For small electrical contractors that need every call answered.",
        features: ["24/7 AI answering", "Safety-aware intake", "Service area FAQs", "Urgent staff alerts"],
      },
      {
        id: "growth",
        name: "Dispatch",
        monthly: 239,
        includedInteractions: 650,
        overage: "$0.40 per extra call or chat",
        blurb: "For growing teams that need appointment and estimate capture.",
        features: ["Everything in Basic", "Estimate request capture", "Booking links", "Commercial request routing", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 519,
        includedInteractions: 1500,
        overage: "$0.30 per extra call or chat",
        blurb: "For electrical teams with connected field-service workflows.",
        features: ["Everything in Dispatch", "ServiceTitan or Jobber workflow", "Advanced safety escalation", "Multi-location support", "Priority support"],
      },
    ],
  },
  {
    businessType: "salon_barber",
    ctaLabel: "Start salon setup",
    customerNoun: "client",
    heroTitle: "A front desk that books clients while your stylists stay with clients.",
    heroSubtitle:
      "Answer appointment, price, color, barber, cancellation, product, bridal, and after-hours questions without making clients wait on hold.",
    integrations: ["Boulevard", "Vagaro", "Square Appointments", "Mindbody", "Google Calendar", "Zapier"],
    label: "Hair Salons and Barbershops",
    landing: {
      callout: "Clients call while hands are busy.",
      callerLine: "Do you have any color appointments this week, and how much does balayage start at?",
      cta: "Book and qualify clients without interrupting the chair.",
      headline: "Your stylists stay with clients. SignalHost handles the phone.",
      operatorReply: "I can help. Balayage starts at the listed consultation price, and I can collect your preferred day, stylist, and color history.",
      proof: "Built for haircuts, color, barber services, consultations, bridal, cancellations, deposits, patch tests, and retail questions.",
      staffHandoff: "Service requested, preferred provider, date/time, color history, hair length, callback number, and booking-link status.",
      stakes: "Every missed call is a client who may book the salon that answered faster.",
      stats: [
        { label: "captured", value: "new clients" },
        { label: "protected", value: "chair time" },
        { label: "handled", value: "reschedules" },
      ],
    },
    outcomeMetrics: ["appointments requested", "front-desk interruptions reduced", "new clients captured"],
    proofPoint: "Great for studios that miss calls while cutting, coloring, shampooing, or checking out clients.",
    setupFocus: [
      "Cuts, color, blowouts, barber services, treatments, bridal, packages, product lines, and starting prices",
      "Provider requests, durations, patch tests, deposits, cancellations, late arrivals, and same-day policies",
      "Booking links, staff-confirmed requests, waitlist, first-visit notes, and contraindications",
      "Retail products, gift cards, memberships, accessibility, parking, and client communication preferences",
    ],
    slug: "hair-salons-barbershops",
    staffNoun: "front desk",
    useCases: [
      "Answers service prices, duration, stylist availability, haircut types, color consultations, and product questions",
      "Books or requests appointments through the salon's preferred link or staff-review queue",
      "Collects color history, hair length, provider preference, first-visit notes, and desired date/time",
      "Handles cancellations, late arrivals, waitlist requests, bridal inquiries, and group appointments",
      "Explains deposits, no-show fees, patch tests, accessibility, parking, children, and pet policies",
      "Sends booking, intake, or retail links when the client wants the next step by text",
    ],
    valuePillars: [
      { title: "Book while hands are busy", body: "Stylists and barbers do not have to stop mid-service to answer routine calls." },
      { title: "Give new clients confidence", body: "Vera can explain services, starting prices, and what information the salon needs." },
      { title: "Reduce front-desk chaos", body: "Appointment requests, changes, and cancellation questions arrive organized." },
    ],
    pricing: [
      {
        id: "basic",
        name: "Basic",
        monthly: 49,
        includedInteractions: 150,
        overage: "$0.40 per extra call or chat",
        blurb: "For solo stylists, barbers, and small studios.",
        features: ["24/7 AI answering", "Hours, prices, policies", "Booking request capture", "Client transcripts"],
      },
      {
        id: "growth",
        name: "Studio",
        monthly: 149,
        includedInteractions: 500,
        overage: "$0.30 per extra call or chat",
        blurb: "For salons that want appointment flow and front-desk relief.",
        features: ["Everything in Basic", "Booking and intake links", "Provider preference capture", "Cancellation and waitlist handling", "Website chat"],
      },
      {
        id: "pro",
        name: "Scale",
        monthly: 349,
        includedInteractions: 1200,
        overage: "$0.22 per extra call or chat",
        blurb: "For multi-chair salons, barbershops, and spas with connected booking.",
        features: ["Everything in Studio", "Boulevard, Vagaro, or Square workflow", "Multi-location support", "Advanced routing", "Priority support"],
      },
    ],
  },
];

export function getIndustrySolution(value: string | undefined): IndustrySolution {
  return industrySolutions.find((solution) => solution.slug === value || solution.businessType === value) ?? industrySolutions[0];
}

export function getIndustryByBusinessType(value: BusinessType): IndustrySolution {
  return industrySolutions.find((solution) => solution.businessType === value) ?? industrySolutions[0];
}
