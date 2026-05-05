export type OnboardingFieldControl = "short" | "long" | "url" | "select" | "toggle";

export type OnboardingStepId =
  | "basics"
  | "menus"
  | "hours"
  | "orders"
  | "reservations"
  | "policies"
  | "escalations"
  | "voice"
  | "launch";

export interface OnboardingField {
  id: string;
  label: string;
  prompt: string;
  placeholder?: string;
  control: OnboardingFieldControl;
  required?: boolean;
  options?: string[];
}

export interface OnboardingSection {
  id: OnboardingStepId;
  title: string;
  eyebrow: string;
  assistantPrompt: string;
  outcome: string;
  fields: OnboardingField[];
}

export type OnboardingDraftValue = string | boolean | undefined;
export type OnboardingDraft = Record<string, OnboardingDraftValue>;

export const assignedDemoPhoneNumber = "+1 (415) 555-0199";

export const onboardingSections: OnboardingSection[] = [
  {
    id: "basics",
    title: "Restaurant basics",
    eyebrow: "Identity",
    assistantPrompt: "Let us start with the details the host should know before it answers a single call.",
    outcome: "Greeting, location context, staff escalation, and account owner details.",
    fields: [
      {
        id: "restaurantName",
        label: "Restaurant name",
        prompt: "What name should the host use on calls?",
        placeholder: "Olive & Ember",
        control: "short",
        required: true,
      },
      {
        id: "concept",
        label: "Concept and cuisine",
        prompt: "How would staff describe the restaurant in one or two sentences?",
        placeholder: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, and seasonal cocktails.",
        control: "long",
        required: true,
      },
      {
        id: "primaryLocation",
        label: "Primary location",
        prompt: "What address should callers hear for directions, pickup, and parking?",
        placeholder: "182 Valencia St, San Francisco, CA 94103",
        control: "short",
        required: true,
      },
      {
        id: "timezone",
        label: "Timezone",
        prompt: "Which timezone should drive hours, specials, reservations, and after-hours behavior?",
        control: "select",
        required: true,
        options: ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"],
      },
      {
        id: "escalationPhone",
        label: "Staff escalation phone",
        prompt: "Who should get alerts when the host needs a human?",
        placeholder: "+1 (415) 555-0148",
        control: "short",
        required: true,
      },
    ],
  },
  {
    id: "menus",
    title: "Menus and pricing",
    eyebrow: "Food and drink",
    assistantPrompt: "Now we need the menu brain: items, prices, modifiers, drinks, and when anything changes.",
    outcome: "Menu sources, item catalog, modifiers, dietary flags, alcohol rules, and timed pricing.",
    fields: [
      {
        id: "menuUrl",
        label: "Menu link",
        prompt: "Where can we fetch the most current menu?",
        placeholder: "https://restaurant.com/menu",
        control: "url",
        required: true,
      },
      {
        id: "menuUploadNotes",
        label: "Uploaded files or notes",
        prompt: "List any PDFs, photos, spreadsheets, or POS exports staff will provide.",
        placeholder: "Dinner PDF, brunch photo menu, wine list spreadsheet.",
        control: "long",
      },
      {
        id: "menuCategories",
        label: "Menu sections",
        prompt: "Which categories should callers be able to order from?",
        placeholder: "Starters, pizza, pasta, entrees, kids, dessert, NA drinks, cocktails, wine, beer.",
        control: "long",
        required: true,
      },
      {
        id: "modifiers",
        label: "Modifiers and substitutions",
        prompt: "Which choices, add-ons, removals, sizes, temperatures, and sauces matter?",
        placeholder: "Gluten-free crust +$4, add chicken +$6, no anchovy, spicy level 1-5.",
        control: "long",
        required: true,
      },
      {
        id: "timedPricing",
        label: "Timed pricing",
        prompt: "What prices or items change by time, day, service, or happy hour?",
        placeholder: "Happy hour Tue-Fri 4-6 PM, half-price oysters Sunday, brunch menu Sat-Sun until 2 PM.",
        control: "long",
      },
      {
        id: "drinkRules",
        label: "Drink menu rules",
        prompt: "What should the host know about cocktails, wine, beer, NA drinks, last call, and ID rules?",
        placeholder: "Cocktails are dine-in only. Bottled wine can be ordered for pickup. Last call 30 minutes before close.",
        control: "long",
      },
    ],
  },
  {
    id: "hours",
    title: "Hours and service periods",
    eyebrow: "Schedule",
    assistantPrompt: "Next, let us map the restaurant clock so the host never promises the wrong thing.",
    outcome: "Regular hours, holidays, service windows, specials, cutoffs, and blackout periods.",
    fields: [
      {
        id: "regularHours",
        label: "Regular hours",
        prompt: "What are normal open and close hours for each day?",
        placeholder: "Mon closed, Tue-Thu 5-10 PM, Fri 5-11 PM, Sat noon-11 PM, Sun noon-9 PM.",
        control: "long",
        required: true,
      },
      {
        id: "servicePeriods",
        label: "Service periods",
        prompt: "When do breakfast, lunch, brunch, dinner, late night, and bar service run?",
        placeholder: "Lunch Mon-Fri 11-3, dinner daily 5-close, brunch Sat-Sun 10-2.",
        control: "long",
      },
      {
        id: "specialsSchedule",
        label: "Specials schedule",
        prompt: "Which daily specials, prix fixe menus, or recurring events should callers hear about?",
        placeholder: "Taco Tuesday, Sunday roast, live jazz Thursdays, chef tasting menu first Friday.",
        control: "long",
      },
      {
        id: "holidayExceptions",
        label: "Holiday and special-day hours",
        prompt: "Which dates have special menus, closures, deposits, or different hours?",
        placeholder: "Mother's Day brunch only, Thanksgiving closed, New Year's Eve prix fixe.",
        control: "long",
        required: true,
      },
      {
        id: "orderingCutoffs",
        label: "Ordering cutoffs",
        prompt: "When should the host stop accepting pickup orders or certain items?",
        placeholder: "Kitchen closes 30 minutes before close. Pizza unavailable after 10 PM.",
        control: "long",
      },
    ],
  },
  {
    id: "orders",
    title: "Order workflow",
    eyebrow: "Pickup",
    assistantPrompt: "Now let us decide how phone orders should move from caller to staff.",
    outcome: "Order-taking rules, pickup estimates, payment mode, review queue, POS, printer, and kitchen routing.",
    fields: [
      {
        id: "takeOrders",
        label: "Take phone orders",
        prompt: "Should the host capture pickup orders?",
        control: "toggle",
        required: true,
      },
      {
        id: "defaultPickupEta",
        label: "Default pickup ETA",
        prompt: "What pickup estimate should the host use when the POS or kitchen is not connected?",
        placeholder: "25 minutes",
        control: "short",
        required: true,
      },
      {
        id: "paymentPolicy",
        label: "Payment policy",
        prompt: "How should the host explain payment?",
        placeholder: "Pay at pickup. No card numbers over the phone.",
        control: "long",
        required: true,
      },
      {
        id: "orderDestination",
        label: "Order destination",
        prompt: "Where should new phone orders go first?",
        control: "select",
        required: true,
        options: ["Staff review queue", "Kitchen tablet", "Kitchen printer", "POS integration", "Both tablet and printer"],
      },
      {
        id: "upsellRules",
        label: "Upsell rules",
        prompt: "What should the host suggest without being annoying?",
        placeholder: "Offer tiramisu with pasta, sparkling water with pickup orders, no upsells after caller says no.",
        control: "long",
      },
    ],
  },
  {
    id: "reservations",
    title: "Reservations and events",
    eyebrow: "Booking",
    assistantPrompt: "Let us teach the host what can be booked, what needs approval, and what changes on special days.",
    outcome: "Reservation provider, party-size rules, deposits, seating areas, holidays, private events, and waitlist handling.",
    fields: [
      {
        id: "takeReservations",
        label: "Handle reservations",
        prompt: "Should the host book or request reservations?",
        control: "toggle",
        required: true,
      },
      {
        id: "reservationProvider",
        label: "Reservation provider",
        prompt: "Which system should reservations connect to?",
        control: "select",
        required: true,
        options: ["OpenTable", "Yelp Guest Manager", "SevenRooms", "Resy", "Tock", "Manual requests only", "No reservations"],
      },
      {
        id: "partyRules",
        label: "Party-size rules",
        prompt: "Which party sizes can be confirmed automatically, and which need staff?",
        placeholder: "Auto-confirm up to 6 if integration has availability. Parties 8+ need manager confirmation.",
        control: "long",
        required: true,
      },
      {
        id: "specialReservationDays",
        label: "Special reservation days",
        prompt: "Which days have special menus, deposits, seating rules, or blackout periods?",
        placeholder: "Mother's Day, Valentine's Day, graduation weekend, restaurant week, patio-only events.",
        control: "long",
        required: true,
      },
      {
        id: "privateEvents",
        label: "Private events and catering",
        prompt: "What should happen when callers ask about buyouts, catering, or large groups?",
        placeholder: "Collect date, guest count, budget, contact info, then escalate to events manager.",
        control: "long",
      },
    ],
  },
  {
    id: "policies",
    title: "Guest policies",
    eyebrow: "FAQs",
    assistantPrompt: "This is the everyday question bank: the details callers ask when staff are busy.",
    outcome: "Parking, directions, accessibility, allergies, delivery, fees, family rules, pets, and common FAQs.",
    fields: [
      {
        id: "parking",
        label: "Parking and directions",
        prompt: "What should callers know about parking, entrance, landmarks, and transit?",
        placeholder: "Metered street parking nearby. Paid lot at 17th and Valencia. Entrance on Valencia.",
        control: "long",
        required: true,
      },
      {
        id: "allergyPolicy",
        label: "Allergy policy",
        prompt: "How should the host handle allergies, cross-contact, and dietary restrictions?",
        placeholder: "Flag severe allergies for staff confirmation. Gluten-free crust available, cross-contact possible.",
        control: "long",
        required: true,
      },
      {
        id: "deliveryPolicy",
        label: "Delivery and third-party apps",
        prompt: "Does the restaurant offer delivery or only pickup?",
        placeholder: "Direct pickup only. Delivery through Uber Eats and DoorDash; app issues handled by the app.",
        control: "long",
      },
      {
        id: "feesAndRules",
        label: "Fees and house rules",
        prompt: "Which rules should the host know about corkage, cake fees, dress code, pets, kids, and accessibility?",
        placeholder: "Corkage $25, cake fee $2/person, service animals only, wheelchair accessible entrance.",
        control: "long",
      },
      {
        id: "customFaqs",
        label: "Custom FAQs",
        prompt: "What questions do staff answer over and over?",
        placeholder: "Do you sell gift cards? Can I bring a cake? Do you have vegan options?",
        control: "long",
      },
    ],
  },
  {
    id: "escalations",
    title: "Escalations & alerts",
    eyebrow: "Manager alerts",
    assistantPrompt: "Tell us how to handle upset callers and sales calls so the right person hears about them.",
    outcome: "Manager contacts for complaints and sales/vendor calls, plus default callback behavior.",
    fields: [
      {
        id: "complaintsManagerPhone",
        label: "Manager phone for complaints (SMS)",
        prompt: "Who should get a text when a caller is upset or reports an issue?",
        placeholder: "+1 (415) 555-0148",
        control: "short",
        required: true,
      },
      {
        id: "salesManagerEmail",
        label: "Manager email for sales/vendor calls",
        prompt: "Where should we email summaries of vendor and sales calls?",
        placeholder: "owner@oliveandember.com",
        control: "short",
        required: true,
      },
      {
        id: "offerComplaintCallback",
        label: "Offer a manager callback for complaints",
        prompt: "Should the AI host promise the caller that the manager will call them back?",
        control: "toggle",
      },
      {
        id: "askSalesIntent",
        label: "Ask sales callers to identify themselves",
        prompt: "Should the host ask whether it's a sales/vendor inquiry before deciding what to do?",
        control: "toggle",
      },
    ],
  },
  {
    id: "voice",
    title: "Voice and behavior",
    eyebrow: "Host",
    assistantPrompt: "Now let us make the host sound like the restaurant and behave the way staff expect.",
    outcome: "Host name, tone, greeting, disclosure, answer timing, SMS confirmations, languages, and handoff rules.",
    fields: [
      {
        id: "hostName",
        label: "Host name",
        prompt: "What should the AI host call itself?",
        placeholder: "Vera",
        control: "short",
        required: true,
      },
      {
        id: "tone",
        label: "Tone",
        prompt: "What style should callers hear?",
        control: "select",
        required: true,
        options: ["Warm", "Professional", "Bright", "Calm", "Playful"],
      },
      {
        id: "greeting",
        label: "Greeting",
        prompt: "What should callers hear first?",
        placeholder: "Thanks for calling {restaurant_name}, this is Vera, the restaurant's virtual host. How can I help?",
        control: "long",
        required: true,
      },
      {
        id: "callHandling",
        label: "Answer timing",
        prompt: "When should the host answer?",
        control: "select",
        required: true,
        options: ["Immediately", "After 3 rings", "After-hours only", "Manual on/off"],
      },
      {
        id: "smsConfirmations",
        label: "SMS confirmations",
        prompt: "Should guests receive text confirmations for orders and reservation requests?",
        control: "toggle",
      },
    ],
  },
  {
    id: "launch",
    title: "Phone launch",
    eyebrow: "Twilio",
    assistantPrompt: "Last step: assign the HostLine number, test the first call, and forward the restaurant line.",
    outcome: "Twilio number, forwarding mode, test script, launch checklist, and dashboard handoff.",
    fields: [
      {
        id: "mainPhone",
        label: "Restaurant main line",
        prompt: "Which number do guests call today?",
        placeholder: "+1 (415) 555-0148",
        control: "short",
        required: true,
      },
      {
        id: "forwardingMode",
        label: "Forwarding mode",
        prompt: "How should calls reach the host?",
        control: "select",
        required: true,
        options: ["Forward all calls", "Forward only unanswered calls", "After-hours forwarding", "Port number later"],
      },
      {
        id: "assignedHostLineNumber",
        label: "HostLine number",
        prompt: "This is the number the restaurant forwards calls to.",
        placeholder: assignedDemoPhoneNumber,
        control: "short",
        required: true,
      },
      {
        id: "firstTestCall",
        label: "First test call",
        prompt: "What should the owner test first?",
        placeholder: "Ask hours, place a pickup order, ask about Mother's Day reservations, then check dashboard.",
        control: "long",
        required: true,
      },
    ],
  },
];

export const productionWorkstreams = [
  "Self-service auth, billing, organization, and location signup",
  "Conversational onboarding and restaurant knowledge extraction",
  "Menu ingestion from PDFs, images, links, spreadsheets, and POS exports",
  "Twilio number provisioning, forwarding instructions, and live call routing",
  "Realtime voice latency tuning across Twilio, transcription, LLM, and ElevenLabs",
  "Supabase persistence, RLS, roles, audit logs, and admin workflows",
  "Staff-review order queue, kitchen tablet, and printer delivery",
  "Toast ordering integration, then Square, Clover, and bridge partners",
  "OpenTable reservations, then Yelp Guest Manager, SevenRooms, Resy, and Tock",
  "SMS confirmations, staff alerts, low-confidence review, and human handoff",
  "Analytics, call QA, transcript review, and launch-readiness monitoring",
  "Compliance, security, secrets, observability, deployment, and support tooling",
] as const;

export const sampleOnboardingDraft: OnboardingDraft = {
  assignedHostLineNumber: assignedDemoPhoneNumber,
  callHandling: "After 3 rings",
  concept: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, and weekend brunch.",
  defaultPickupEta: "25 minutes",
  escalationPhone: "+1 (415) 555-0148",
  forwardingMode: "Forward only unanswered calls",
  greeting: "Thanks for calling {restaurant_name}, this is Vera, the restaurant's virtual host. How can I help?",
  hostName: "Vera",
  mainPhone: "+1 (415) 555-0148",
  menuCategories: "Starters, wood-fired pizza, pasta, dessert, cocktails, wine, beer, and NA drinks.",
  menuUrl: "https://oliveandember.example/menu",
  modifiers: "Gluten-free crust +$4, light cheese, no anchovy, add chicken +$6.",
  orderDestination: "Staff review queue",
  parking: "Metered street parking on Valencia. Paid lot at 17th and Valencia.",
  partyRules: "Auto-confirm up to 6 with availability. Parties 8 or more need manager confirmation.",
  paymentPolicy: "Pay at pickup. No card numbers over the phone.",
  primaryLocation: "182 Valencia St, San Francisco, CA 94103",
  regularHours: "Mon closed, Tue-Thu 5-10 PM, Fri 5-11 PM, Sat noon-11 PM, Sun noon-9 PM.",
  reservationProvider: "OpenTable",
  restaurantName: "Olive & Ember",
  specialReservationDays: "Mother's Day brunch uses a special prix fixe menu and requires staff confirmation.",
  takeOrders: true,
  takeReservations: true,
  timezone: "America/Los_Angeles",
  tone: "Warm",
};

export function calculateOnboardingProgress(
  draft: OnboardingDraft,
  sections: OnboardingSection[] = onboardingSections,
) {
  const requiredFields = sections.flatMap((section) => section.fields.filter((field) => field.required));
  const completedRequired = requiredFields.filter((field) => hasDraftValue(draft[field.id])).length;
  const missingBySection = sections.map((section) => ({
    id: section.id,
    missing: section.fields
      .filter((field) => field.required && !hasDraftValue(draft[field.id]))
      .map((field) => field.label),
  }));

  return {
    completedRequired,
    missingBySection,
    percent: requiredFields.length ? Math.round((completedRequired / requiredFields.length) * 100) : 100,
    totalRequired: requiredFields.length,
  };
}

function hasDraftValue(value: OnboardingDraftValue) {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && value.trim().length > 0;
}
