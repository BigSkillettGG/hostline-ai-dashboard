import { getBusinessTemplate, type BusinessType } from "./business-templates";
import { buildAgentEmailIdentity } from "./agent-email";
import { signalHostVoiceProfilesById, type SignalHostVoiceProfileId } from "./voice-selection";

export type DemoPlanName = "Basic" | "Growth" | "Premium";
export type DemoTenantStatus = "healthy" | "attention" | "critical";

export interface DemoBusinessLink {
  description: string;
  label: string;
  linkType: string;
  url: string;
}

export interface DemoSiteSection {
  body: string;
  title: string;
}

export interface VerticalDemoProfile {
  accountEmail: string;
  accountPassword: string;
  aiNumber: string;
  businessName: string;
  businessType: BusinessType;
  city: string;
  demoSiteSlug: string;
  faqs: Array<{ answer: string; question: string }>;
  includedInteractions: number;
  knowledgeSections: DemoSiteSection[];
  links: DemoBusinessLink[];
  locationId: string;
  mainPhone: string;
  monthlyPriceCents: number;
  mrrCents: number;
  onboardingStatus: "ready_for_test_call" | "needs_attention";
  organizationId: string;
  ownerEmail: string;
  ownerName: string;
  ownerPhone: string;
  planName: DemoPlanName;
  samplePrompts: string[];
  status: DemoTenantStatus;
  subtitle: string;
  testScenarios: string[];
  timezone: string;
  voiceProfileId: SignalHostVoiceProfileId;
  websiteSections: DemoSiteSection[];
}

export const verticalDemoProfiles: VerticalDemoProfile[] = [
  {
    accountEmail: "demo.restaurant@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (415) 555-0142",
    businessName: "Olive & Ember",
    businessType: "restaurant",
    city: "San Francisco, CA",
    demoSiteSlug: "olive-ember",
    faqs: [
      {
        question: "Do you have specials tonight?",
        answer: "Tonight's specials are saffron risotto with scallops, grilled artichokes with lemon aioli, and a blood orange spritz.",
      },
      {
        question: "Do you have parking?",
        answer: "There is a small lot behind the restaurant, plus two-hour street parking on Valencia. Guests can enter through the patio gate.",
      },
      {
        question: "Can you handle severe allergies?",
        answer: "The kitchen can discuss ingredients, but severe allergies should always be reviewed by staff before ordering.",
      },
    ],
    includedInteractions: 800,
    knowledgeSections: [
      {
        title: "Restaurant style",
        body: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, weekend brunch, and warm host-style service.",
      },
      {
        title: "Reservations and ordering",
        body: "Guests can request reservations, large parties, private events, takeout orders, parking guidance, allergy help, and menu recommendations.",
      },
      {
        title: "Escalation rules",
        body: "Escalate severe allergies, complaints, private events over 20 guests, refund requests, lost items, and anything the kitchen must confirm.",
      },
    ],
    links: [
      { description: "Online ordering link for takeout.", label: "Order takeout", linkType: "ordering", url: "https://oliveandember.example/order" },
      { description: "Reservation link for standard parties.", label: "Book a table", linkType: "reservation", url: "https://oliveandember.example/reservations" },
      { description: "Private dining inquiry form.", label: "Private events", linkType: "private_event", url: "https://oliveandember.example/events" },
    ],
    locationId: "78d8053b-631d-4811-939f-61f0efe1d82a",
    mainPhone: "+1 (415) 555-0148",
    monthlyPriceCents: 24900,
    mrrCents: 24900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "0125aaa8-d9cf-41c6-814b-488bac63249e",
    ownerEmail: "maria@oliveandember.com",
    ownerName: "Maria Lombardi",
    ownerPhone: "+1 (415) 555-0184",
    planName: "Growth",
    samplePrompts: [
      "Do you have any specials tonight?",
      "Can I make a reservation for four at 7?",
      "My son has a severe peanut allergy. What should I do?",
    ],
    status: "healthy",
    subtitle: "A busy neighborhood restaurant that needs calm answers during dinner rush.",
    testScenarios: ["parking FAQ", "takeout order", "large party request", "severe allergy escalation"],
    timezone: "America/Los_Angeles",
    voiceProfileId: "ava",
    websiteSections: [
      { title: "Dinner that moves at your pace", body: "Wood-fired pizza, handmade pasta, bright cocktails, and a patio that fills fast." },
      { title: "Private events", body: "Host birthdays, rehearsal dinners, team gatherings, and holiday meals with a dedicated event lead." },
      { title: "Weekend brunch", body: "Saturday and Sunday brunch runs from 10 AM to 2 PM with seasonal specials." },
    ],
  },
  {
    accountEmail: "demo.hvac@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (617) 555-0181",
    businessName: "Summit Air",
    businessType: "hvac",
    city: "Boston, MA",
    demoSiteSlug: "summit-air",
    faqs: [
      {
        question: "Do you offer emergency service?",
        answer: "Yes. No-heat, no-cooling, leaking equipment, and unsafe equipment calls are treated as urgent and routed to dispatch.",
      },
      {
        question: "What areas do you serve?",
        answer: "Summit Air serves Boston, Cambridge, Somerville, Newton, Brookline, Quincy, and most towns inside Route 128.",
      },
      {
        question: "Do you install heat pumps?",
        answer: "Yes. Summit Air installs ducted and ductless heat pumps and can schedule a comfort consultation for estimates.",
      },
    ],
    includedInteractions: 800,
    knowledgeSections: [
      {
        title: "HVAC services",
        body: "Heating repair, AC repair, tune-ups, emergency no-heat and no-cooling calls, heat pump installation, indoor air quality, and system replacement estimates.",
      },
      {
        title: "Dispatch intake",
        body: "For urgent calls, capture name, phone, address, equipment type, symptoms, whether the system is running, and whether anyone is vulnerable to heat or cold.",
      },
      {
        title: "Safety boundaries",
        body: "Do not give repair instructions beyond safe basics. Escalate burning smells, carbon monoxide concerns, electrical issues, and gas smells immediately.",
      },
    ],
    links: [
      { description: "Main appointment request page.", label: "Schedule service", linkType: "appointment", url: "https://summitair.example/schedule" },
      { description: "Heat pump consultation form.", label: "Heat pump estimate", linkType: "quote", url: "https://summitair.example/heat-pumps" },
      { description: "Maintenance plan details.", label: "Maintenance plan", linkType: "service_plan", url: "https://summitair.example/maintenance" },
    ],
    locationId: "11111111-1111-4111-8111-111111111111",
    mainPhone: "+1 (617) 555-0100",
    monthlyPriceCents: 24900,
    mrrCents: 24900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "11111111-1111-4111-9111-111111111111",
    ownerEmail: "jamie@summitair.example",
    ownerName: "Jamie O'Neill",
    ownerPhone: "+1 (617) 555-0114",
    planName: "Growth",
    samplePrompts: [
      "My heat stopped working. Can someone come out today?",
      "Do you service Brookline?",
      "Can I get a quote for a ductless heat pump?",
    ],
    status: "healthy",
    subtitle: "A service company that needs urgent calls triaged before the next competitor answers.",
    testScenarios: ["no-heat emergency", "service area check", "maintenance plan question", "replacement estimate request"],
    timezone: "America/New_York",
    voiceProfileId: "miles",
    websiteSections: [
      { title: "Fast heat and AC help", body: "Emergency repair, scheduled maintenance, and clear replacement advice from licensed technicians." },
      { title: "Heat pump specialists", body: "Ducted and ductless systems designed for New England homes and changing energy needs." },
      { title: "Maintenance plans", body: "Priority scheduling, seasonal tune-ups, filter reminders, and member-only repair discounts." },
    ],
  },
  {
    accountEmail: "demo.plumbing@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (781) 555-0166",
    businessName: "Harbor Plumbing",
    businessType: "plumbing",
    city: "Quincy, MA",
    demoSiteSlug: "harbor-plumbing",
    faqs: [
      {
        question: "Do you handle emergency leaks?",
        answer: "Yes. Active leaks, burst pipes, sewer backups, and no-water calls are urgent and should be routed to the on-call plumber.",
      },
      {
        question: "Can you replace a water heater?",
        answer: "Yes. Harbor Plumbing replaces tank and tankless water heaters. Capture fuel type, size, age, leak status, and urgency.",
      },
      {
        question: "What should I do if water is actively leaking?",
        answer: "If it is safe, turn off the nearest shutoff or the main water valve, then wait for the team to call back.",
      },
    ],
    includedInteractions: 800,
    knowledgeSections: [
      {
        title: "Plumbing services",
        body: "Emergency leaks, burst pipes, water heaters, drain clearing, sewer backups, fixtures, toilets, faucets, garbage disposals, and small remodel plumbing.",
      },
      {
        title: "Emergency intake",
        body: "For active water, sewer backup, or no-water calls, capture address, safe access instructions, whether water is still running, and best callback number.",
      },
      {
        title: "Safe guidance",
        body: "Offer simple safe steps like shutting off water when possible, but do not give complicated DIY repair instructions.",
      },
    ],
    links: [
      { description: "General plumbing service request.", label: "Request service", linkType: "appointment", url: "https://harborplumbing.example/service" },
      { description: "Water heater estimate form.", label: "Water heater estimate", linkType: "quote", url: "https://harborplumbing.example/water-heaters" },
      { description: "Emergency callback request.", label: "Emergency callback", linkType: "urgent", url: "https://harborplumbing.example/emergency" },
    ],
    locationId: "22222222-2222-4222-8222-222222222222",
    mainPhone: "+1 (781) 555-0108",
    monthlyPriceCents: 24900,
    mrrCents: 24900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "22222222-2222-4222-9222-222222222222",
    ownerEmail: "nora@harborplumbing.example",
    ownerName: "Nora Hayes",
    ownerPhone: "+1 (781) 555-0195",
    planName: "Growth",
    samplePrompts: [
      "I have water coming through the ceiling. What should I do?",
      "Can you replace a tankless water heater?",
      "Do you service Quincy Point?",
    ],
    status: "healthy",
    subtitle: "A plumbing team that cannot afford voicemail when water is already moving.",
    testScenarios: ["active leak triage", "water heater estimate", "drain issue", "service area question"],
    timezone: "America/New_York",
    voiceProfileId: "aiden",
    websiteSections: [
      { title: "Emergency plumbing response", body: "Leaks, clogs, water heaters, and sewer issues handled with calm dispatch and clear next steps." },
      { title: "Water heater replacement", body: "Tank, tankless, gas, and electric replacements with clear intake before a quote." },
      { title: "Local service area", body: "Serving Quincy, Braintree, Weymouth, Milton, Dorchester, and nearby South Shore towns." },
    ],
  },
  {
    accountEmail: "demo.roofing@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (508) 555-0137",
    businessName: "RidgeLine Roofing",
    businessType: "roofing",
    city: "Worcester, MA",
    demoSiteSlug: "ridgeline-roofing",
    faqs: [
      {
        question: "Do you handle storm damage?",
        answer: "Yes. Storm damage, active leaks, missing shingles, and emergency tarping requests should be treated as high priority.",
      },
      {
        question: "Do you work with insurance claims?",
        answer: "Yes. RidgeLine can document roof damage and help homeowners understand the inspection process, but final coverage decisions come from the insurer.",
      },
      {
        question: "Can I get a roof replacement estimate?",
        answer: "Yes. Capture address, roof type, leak status, project timing, and whether the homeowner wants repair or replacement guidance.",
      },
    ],
    includedInteractions: 2000,
    knowledgeSections: [
      {
        title: "Roofing services",
        body: "Roof repairs, replacements, inspections, emergency tarping, storm damage documentation, gutters, skylights, and insurance-claim support.",
      },
      {
        title: "Storm intake",
        body: "For storm calls, ask whether water is actively entering, whether there are missing shingles, if tarping is needed, and whether photos are available.",
      },
      {
        title: "High-value leads",
        body: "Roof replacements, storm damage, insurance claim help, and active leaks should be marked as high-value opportunities and sent to the owner quickly.",
      },
    ],
    links: [
      { description: "Roof inspection request.", label: "Request inspection", linkType: "appointment", url: "https://ridgelineroofing.example/inspection" },
      { description: "Photo upload for roof damage.", label: "Upload roof photos", linkType: "photo_upload", url: "https://ridgelineroofing.example/photos" },
      { description: "Storm damage intake form.", label: "Storm damage help", linkType: "urgent", url: "https://ridgelineroofing.example/storm" },
    ],
    locationId: "33333333-3333-4333-8333-333333333333",
    mainPhone: "+1 (508) 555-0102",
    monthlyPriceCents: 54900,
    mrrCents: 54900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "33333333-3333-4333-9333-333333333333",
    ownerEmail: "carla@ridgelineroofing.example",
    ownerName: "Carla Benton",
    ownerPhone: "+1 (508) 555-0151",
    planName: "Premium",
    samplePrompts: [
      "A tree branch damaged my roof. Can you help?",
      "Can I upload photos before someone comes out?",
      "Do you help with insurance claims?",
    ],
    status: "healthy",
    subtitle: "A roofing company built for storm surges, inspection leads, and high-value callbacks.",
    testScenarios: ["storm damage intake", "photo upload link", "insurance FAQ", "replacement estimate"],
    timezone: "America/New_York",
    voiceProfileId: "maya",
    websiteSections: [
      { title: "Roof repair and replacement", body: "Fast inspections, clear estimates, and reliable crews for repairs, replacements, and urgent tarping." },
      { title: "Storm response", body: "RidgeLine helps document damage, collect photos, and prioritize active leaks after severe weather." },
      { title: "Insurance-aware intake", body: "The team can gather the details insurers usually ask for before the first appointment." },
    ],
  },
  {
    accountEmail: "demo.electrical@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (978) 555-0198",
    businessName: "BrightWire Electric",
    businessType: "electrical",
    city: "Lowell, MA",
    demoSiteSlug: "brightwire-electric",
    faqs: [
      {
        question: "Do you install EV chargers?",
        answer: "Yes. Capture vehicle type, charger type, panel location, parking location, and whether the customer can upload panel photos.",
      },
      {
        question: "What should I do if I smell burning?",
        answer: "Treat burning smells, sparking, smoke, exposed wires, and hot panels as urgent safety calls. Advise the caller to avoid the area and wait for a licensed electrician.",
      },
      {
        question: "Do you do panel upgrades?",
        answer: "Yes. BrightWire handles panel upgrades, service upgrades, generator wiring, EV chargers, lighting, outlets, and troubleshooting.",
      },
    ],
    includedInteractions: 800,
    knowledgeSections: [
      {
        title: "Electrical services",
        body: "Troubleshooting, panel upgrades, EV chargers, generators, recessed lighting, outlets, switches, service upgrades, and urgent safety calls.",
      },
      {
        title: "Safety triage",
        body: "Escalate sparking, burning smells, smoke, hot panels, exposed wires, repeated breaker trips, or partial power outage. Do not provide unsafe DIY electrical advice.",
      },
      {
        title: "Estimate intake",
        body: "For EV chargers, generators, and panel upgrades, capture address, equipment goals, panel location, photos, timing, and preferred callback window.",
      },
    ],
    links: [
      { description: "Electrical service request.", label: "Schedule electrical service", linkType: "appointment", url: "https://brightwire.example/service" },
      { description: "EV charger estimate form.", label: "EV charger estimate", linkType: "quote", url: "https://brightwire.example/ev-chargers" },
      { description: "Panel photo upload.", label: "Upload panel photos", linkType: "photo_upload", url: "https://brightwire.example/photos" },
    ],
    locationId: "44444444-4444-4444-8444-444444444444",
    mainPhone: "+1 (978) 555-0120",
    monthlyPriceCents: 24900,
    mrrCents: 24900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "44444444-4444-4444-9444-444444444444",
    ownerEmail: "derek@brightwire.example",
    ownerName: "Derek Lin",
    ownerPhone: "+1 (978) 555-0128",
    planName: "Growth",
    samplePrompts: [
      "Can you install an EV charger in my garage?",
      "My breaker keeps tripping. Is that urgent?",
      "Do you do panel upgrades?",
    ],
    status: "healthy",
    subtitle: "A licensed electrical contractor where safety calls need the right next step immediately.",
    testScenarios: ["EV charger intake", "safety triage", "panel upgrade quote", "service area question"],
    timezone: "America/New_York",
    voiceProfileId: "aiden",
    websiteSections: [
      { title: "Licensed electrical work", body: "Repairs, upgrades, chargers, lighting, and safety troubleshooting for homes and small businesses." },
      { title: "EV charger installs", body: "Collect the right details before dispatch: vehicle, charger, panel, parking, and photo upload." },
      { title: "Safety-first service", body: "Urgent electrical concerns get prioritized without giving unsafe DIY instructions." },
    ],
  },
  {
    accountEmail: "demo.salon@signalhost.ai",
    accountPassword: "SignalHostDemo!2026",
    aiNumber: "+1 (339) 555-0155",
    businessName: "Luna Studio",
    businessType: "salon_barber",
    city: "Cambridge, MA",
    demoSiteSlug: "luna-studio",
    faqs: [
      {
        question: "Can I book a color consultation?",
        answer: "Yes. Color corrections, major blonding changes, and first-time vivid color should start with a consultation.",
      },
      {
        question: "Do you take walk-ins?",
        answer: "Walk-ins are accepted when a stylist or barber has space, but booking ahead is strongly recommended.",
      },
      {
        question: "How long does balayage take?",
        answer: "Balayage is usually a longer appointment, often 2.5 to 4 hours depending on hair length, history, and desired result.",
      },
    ],
    includedInteractions: 200,
    knowledgeSections: [
      {
        title: "Salon services",
        body: "Haircuts, barber cuts, beard trims, blowouts, color, highlights, balayage, gloss, treatments, kids cuts, bridal styling, and consultations.",
      },
      {
        title: "Booking rules",
        body: "Color corrections, major blonding, vivid color, bridal parties, and first-time extension requests require consultation before booking the main service.",
      },
      {
        title: "Client experience",
        body: "Keep the tone warm and stylish. Help clients find the right service and send the correct booking link or take a message for the front desk.",
      },
    ],
    links: [
      { description: "Main booking link.", label: "Book online", linkType: "booking", url: "https://lunastudio.example/book" },
      { description: "Color consultation booking.", label: "Color consultation", linkType: "consultation", url: "https://lunastudio.example/color-consult" },
      { description: "Bridal inquiry form.", label: "Bridal inquiry", linkType: "event", url: "https://lunastudio.example/bridal" },
    ],
    locationId: "55555555-5555-4555-8555-555555555555",
    mainPhone: "+1 (339) 555-0122",
    monthlyPriceCents: 9900,
    mrrCents: 9900,
    onboardingStatus: "ready_for_test_call",
    organizationId: "55555555-5555-4555-9555-555555555555",
    ownerEmail: "tessa@lunastudio.example",
    ownerName: "Tessa Ward",
    ownerPhone: "+1 (339) 555-0173",
    planName: "Basic",
    samplePrompts: [
      "I want to go blonde. Should I book a consultation?",
      "Do you have any barber appointments tomorrow?",
      "How long does balayage usually take?",
    ],
    status: "healthy",
    subtitle: "A salon front desk that turns service questions into the right booking path.",
    testScenarios: ["service matcher", "color consultation", "walk-in question", "bridal inquiry"],
    timezone: "America/New_York",
    voiceProfileId: "maya",
    websiteSections: [
      { title: "Cuts, color, and style", body: "Modern cuts, color work, barber services, blowouts, and consultations in a calm studio setting." },
      { title: "Book the right service", body: "Clients can ask what to book and get pointed to the right appointment or consultation." },
      { title: "Events and bridal", body: "The studio captures date, party size, location, timing, and styling needs before the team follows up." },
    ],
  },
];

export const verticalDemoProfilesBySlug = Object.fromEntries(
  verticalDemoProfiles.map((profile) => [profile.demoSiteSlug, profile]),
) as Record<string, VerticalDemoProfile>;

export const verticalDemoProfilesByType = Object.fromEntries(
  verticalDemoProfiles.map((profile) => [profile.businessType, profile]),
) as Partial<Record<BusinessType, VerticalDemoProfile>>;

export function getVerticalDemoProfile(value: string | BusinessType | undefined): VerticalDemoProfile {
  if (!value) return verticalDemoProfiles[0];
  return (
    verticalDemoProfilesBySlug[value] ??
    verticalDemoProfilesByType[value as BusinessType] ??
    verticalDemoProfiles.find((profile) => profile.businessName.toLowerCase() === value.toLowerCase()) ??
    verticalDemoProfiles[0]
  );
}

export function getDemoVoiceEmployeeName(profile: VerticalDemoProfile) {
  return signalHostVoiceProfilesById[profile.voiceProfileId]?.employeeName ?? "SignalHost";
}

export function getDemoBusinessLabel(profile: VerticalDemoProfile) {
  return getBusinessTemplate(profile.businessType).label;
}

export function buildDemoAgentEmail(profile: VerticalDemoProfile) {
  return buildAgentEmailIdentity({
    businessName: profile.businessName,
    hostName: getDemoVoiceEmployeeName(profile),
    locationId: profile.locationId,
  });
}
