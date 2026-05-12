import {
  businessTypeOptions,
  getBusinessTemplate,
  normalizeBusinessType,
  type BusinessType,
} from "./business-templates";

export type OnboardingFieldControl = "short" | "long" | "url" | "select" | "toggle";
export type OnboardingFieldOption = string | { label: string; value: string };

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
  businessTypes?: BusinessType[];
  id: string;
  label: string;
  prompt: string;
  placeholder?: string;
  control: OnboardingFieldControl;
  required?: boolean;
  options?: OnboardingFieldOption[];
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
        id: "businessType",
        label: "Business type",
        prompt: "Which template should shape the setup interview and AI behavior?",
        control: "select",
        required: true,
        options: businessTypeOptions,
      },
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
        id: "substitutionPolicy",
        label: "Off-menu requests",
        prompt: "When callers ask for items or substitutions that are not exactly on the menu, what can the host accept, note for staff, or decline?",
        placeholder: "Simple pizza changes are okay if ingredients are in-house. Off-menu proteins, severe allergy changes, and price changes need staff confirmation.",
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
        id: "orderHandlingMode",
        label: "What Vera should do",
        prompt: "When a caller wants to order, what should Vera do first?",
        control: "select",
        required: true,
        options: [
          "Capture order for staff review",
          "Send online ordering link",
          "Capture order and also offer online ordering link",
          "Do not handle orders",
        ],
      },
      {
        id: "onlineOrderingUrl",
        label: "Online ordering link",
        prompt: "If callers can order online, what link should Vera text them?",
        placeholder: "https://oliveandember.example/order",
        control: "url",
      },
      {
        businessTypes: ["home_services", "professional_services", "retail", "salon_spa"],
        id: "appointmentBookingUrl",
        label: "Appointment booking link",
        prompt: "If customers can book online, what link should the AI send?",
        placeholder: "https://business.example/book",
        control: "url",
      },
      {
        businessTypes: ["home_services", "professional_services"],
        id: "quoteRequestUrl",
        label: "Quote request link",
        prompt: "If customers can request an estimate online, what link should the AI send?",
        placeholder: "https://business.example/quote",
        control: "url",
      },
      {
        businessTypes: ["home_services", "professional_services", "salon_spa"],
        id: "intakeFormUrl",
        label: "Intake form link",
        prompt: "If customers should fill out an intake form before staff follow-up, what link should the AI send?",
        placeholder: "https://business.example/intake",
        control: "url",
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
        id: "orderChangePolicy",
        label: "Order changes and cancellations",
        prompt: "What should the host do if someone wants to change, cancel, or check a pickup order?",
        placeholder: "Collect the order name, phone number, requested change, and flag staff before promising anything.",
        control: "long",
      },
      {
        id: "deliveryDriverPolicy",
        label: "Delivery driver pickup instructions",
        prompt: "What should DoorDash, Uber Eats, Grubhub, or courier drivers do when they arrive?",
        placeholder: "Drivers check in at the pickup counter with the guest name. No phone handoffs during service.",
        control: "long",
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
        prompt: "Should Vera answer reservation questions or collect reservation requests?",
        control: "toggle",
        required: true,
      },
      {
        id: "reservationSourceToday",
        label: "Current reservation workflow",
        prompt: "How does the restaurant manage reservations today?",
        control: "select",
        required: true,
        options: [
          "OpenTable",
          "Resy",
          "SevenRooms",
          "Yelp Guest Manager",
          "Google / booking link",
          "Paper book",
          "Phone calls only",
          "Spreadsheet or calendar",
          "No formal system",
          "No reservations",
        ],
      },
      {
        id: "reservationHandlingMode",
        label: "What Vera should do",
        prompt: "When a caller asks for a reservation, what should Vera do first?",
        control: "select",
        required: true,
        options: [
          "Confirm through connected reservation system",
          "Send caller a booking link",
          "Create request for staff confirmation",
          "Save pending request in HostLine",
          "Confirm in HostLine when rules allow",
          "Take a message only",
          "Say we do not take reservations",
        ],
      },
      {
        id: "reservationProvider",
        label: "Connected provider",
        prompt: "If Vera should connect to a reservation system, which one should we integrate with?",
        control: "select",
        required: true,
        options: ["OpenTable", "Yelp Guest Manager", "SevenRooms", "Resy", "Tock", "Google / booking link", "Manual requests only", "No reservations"],
      },
      {
        id: "reservationBookingUrl",
        label: "Booking link",
        prompt: "If Vera should text or read a booking link, what URL should she use?",
        placeholder: "https://www.opentable.com/r/olive-and-ember",
        control: "url",
      },
      {
        id: "autoConfirmPartyLimit",
        label: "Auto-confirm party limit",
        prompt: "What is the largest party Vera may confirm without staff, if auto-confirm is enabled?",
        placeholder: "6",
        control: "short",
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
        id: "largePartyThreshold",
        label: "Large-party threshold",
        prompt: "At what party size should Vera treat the call as a large-party or event inquiry?",
        placeholder: "8 or more",
        control: "short",
      },
      {
        id: "reservationMinNotice",
        label: "Minimum notice",
        prompt: "How much notice is required before a reservation can be confirmed?",
        placeholder: "Same-day is okay before 4 PM; otherwise staff confirmation.",
        control: "short",
      },
      {
        id: "reservationAdvanceWindow",
        label: "Advance booking window",
        prompt: "How far ahead can callers book?",
        placeholder: "Up to 60 days ahead.",
        control: "short",
      },
      {
        id: "reservationCutoffRules",
        label: "Cutoff rules",
        prompt: "When should Vera stop taking or confirming reservations for a service?",
        placeholder: "No same-day reservations after 4 PM Friday or Saturday.",
        control: "long",
      },
      {
        id: "seatingAreas",
        label: "Seating areas",
        prompt: "Which areas can callers request, and which are first come or staff-confirmed?",
        placeholder: "Dining room, bar, patio, chef counter. Patio requests are not guaranteed.",
        control: "long",
      },
      {
        id: "privateRoomPolicy",
        label: "Private rooms",
        prompt: "Can guests reserve private rooms, semi-private spaces, patios, or event areas?",
        placeholder: "Private dining room seats 14-24 and always needs events manager approval.",
        control: "long",
      },
      {
        id: "depositPolicy",
        label: "Deposits and credit cards",
        prompt: "When are deposits, cancellation fees, credit cards, or prepaid menus required?",
        placeholder: "Parties 8+ and Valentine's Day need a card on file through OpenTable.",
        control: "long",
      },
      {
        id: "lateArrivalPolicy",
        label: "Late-arrival policy",
        prompt: "How long are tables held, and what should Vera say if someone is running late?",
        placeholder: "Tables are held for 15 minutes; staff confirmation needed after that.",
        control: "long",
      },
      {
        id: "noShowPolicy",
        label: "No-show and cancellation policy",
        prompt: "What should callers know about cancellations, no-shows, and fees?",
        placeholder: "Cancel by 2 PM day-of for standard reservations. Special events may have stricter rules.",
        control: "long",
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
      {
        id: "reservationChangePolicy",
        label: "Reservation changes and cancellations",
        prompt: "How should the host handle callers changing, canceling, or rescheduling reservations?",
        placeholder: "Collect name, date, time, party size, requested change, and send for staff confirmation.",
        control: "long",
      },
      {
        id: "waitlistPolicy",
        label: "Waitlist and walk-ins",
        prompt: "What should the host say about current waits, waitlists, and walk-in availability?",
        placeholder: "Walk-ins are welcome, but live waits change quickly. Staff confirms wait times at the door.",
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
        prompt: "Does the restaurant offer delivery, and how should the host handle app delivery issues?",
        placeholder: "Direct pickup only. Delivery through Uber Eats and DoorDash; app issues handled by the app.",
        control: "long",
      },
      {
        id: "lostAndFoundPolicy",
        label: "Lost and found",
        prompt: "What should the host collect when someone says they lost or left an item?",
        placeholder: "Collect item description, visit date/time, table or area, caller name, and callback number.",
        control: "long",
      },
      {
        id: "hiringPolicy",
        label: "Jobs and hiring",
        prompt: "What should the host say when someone asks about jobs, applications, or resumes?",
        placeholder: "Ask applicants to email careers@restaurant.com or stop by Tue-Thu 2-4 PM with a resume.",
        control: "long",
      },
      {
        id: "donationPressPolicy",
        label: "Donations, press, and partnerships",
        prompt: "What should happen when callers ask for donations, sponsorships, press, or partnerships?",
        placeholder: "Collect organization, request, deadline, contact info, and route to the owner by email.",
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
        id: "complaintPolicy",
        label: "Complaint and refund handling",
        prompt: "What should the host say and collect for complaints, refund requests, bad experiences, or missing items?",
        placeholder: "Apologize, collect name, callback, order or visit details, and promise manager review without guaranteeing a refund.",
        control: "long",
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
        id: "vendorCallPolicy",
        label: "Vendor and sales call handling",
        prompt: "What should the host collect from vendors, suppliers, sales reps, and marketing callers?",
        placeholder: "Collect company, reason for calling, contact name, phone, email, and route to owner without interrupting service.",
        control: "long",
      },
      {
        id: "humanHandoffPolicy",
        label: "Human handoff rules",
        prompt: "When someone asks for a person, what should the host promise and what details should it collect?",
        placeholder: "Offer a staff callback, collect name, phone, reason, and urgency. Do not promise immediate transfer during rush.",
        control: "long",
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
        id: "voiceGender",
        label: "Voice",
        prompt: "Which host voice should callers hear?",
        control: "select",
        required: true,
        options: ["Female - Eve", "Male - Michael"],
      },
      {
        id: "greeting",
        label: "Greeting",
        prompt: "What should callers hear first?",
        placeholder: "Hi, thank you for calling {restaurant_name}. How can I help you?",
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

type SectionCopyOverride = Partial<Pick<OnboardingSection, "assistantPrompt" | "eyebrow" | "outcome" | "title">>;
type FieldCopyOverride = Partial<Omit<OnboardingField, "businessTypes" | "control" | "id">>;

const businessSectionCopy: Partial<Record<BusinessType, Partial<Record<OnboardingStepId, SectionCopyOverride>>>> = {
  home_services: {
    basics: {
      title: "Business basics",
      assistantPrompt: "Let us capture the service area, dispatch rules, and details the AI needs before answering calls.",
      outcome: "Business identity, service area, escalation contact, and account owner details.",
    },
    menus: {
      title: "Services and pricing",
      eyebrow: "Service catalog",
      assistantPrompt: "Now we need the service brain: what you do, what you do not do, common add-ons, and price ranges.",
      outcome: "Services, estimates, emergency pricing, service-area rules, warranties, and out-of-scope requests.",
    },
    orders: {
      title: "Service request workflow",
      eyebrow: "Jobs",
      assistantPrompt: "Now let us decide how new service calls become staff follow-up, booking links, or quote requests.",
      outcome: "Lead capture rules, booking links, quote links, response estimates, payment rules, and routing.",
    },
    reservations: {
      title: "Appointments and estimates",
      eyebrow: "Scheduling",
      assistantPrompt: "Teach the AI what can be booked, what needs dispatch approval, and how emergencies are handled.",
      outcome: "Scheduling system, appointment rules, emergency thresholds, service windows, and staff-confirmed requests.",
    },
    policies: {
      title: "Customer policies",
      outcome: "Service area, safety, warranties, arrival rules, financing, jobs, vendor calls, and common FAQs.",
    },
    launch: {
      title: "Phone launch",
      outcome: "HostLine number, forwarding mode, test script, launch checklist, and dashboard handoff.",
    },
  },
  professional_services: {
    basics: {
      title: "Firm basics",
      outcome: "Firm identity, office context, escalation contact, and client-facing boundaries.",
    },
    menus: {
      title: "Services and intake",
      eyebrow: "Practice areas",
      outcome: "Service lines, intake rules, consultation links, document requirements, and client-fit rules.",
    },
    orders: {
      title: "Lead and intake workflow",
      eyebrow: "Client requests",
      outcome: "Lead capture, intake links, consultation links, callback rules, and staff routing.",
    },
    reservations: {
      title: "Consultations",
      eyebrow: "Scheduling",
      outcome: "Consultation booking, staff approval, availability windows, cancellation rules, and next steps.",
    },
    policies: {
      title: "Client policies",
      outcome: "Office hours, confidentiality boundaries, document handling, billing basics, and common FAQs.",
    },
  },
  retail: {
    basics: {
      title: "Shop basics",
      outcome: "Store identity, location, escalation contact, and staff handoff details.",
    },
    menus: {
      title: "Products and inventory",
      eyebrow: "Catalog",
      outcome: "Product categories, availability language, special orders, returns, and pickup rules.",
    },
    orders: {
      title: "Purchase and pickup workflow",
      eyebrow: "Orders",
      outcome: "Online store links, special-order requests, pickup timing, payment policy, and staff routing.",
    },
    reservations: {
      title: "Visits and appointments",
      eyebrow: "Booking",
      outcome: "Personal shopping, fittings, consultations, appointment links, and staff-confirmed requests.",
    },
    policies: {
      title: "Customer policies",
      outcome: "Parking, returns, exchanges, gift cards, product holds, warranties, and common FAQs.",
    },
  },
  salon_spa: {
    basics: {
      title: "Studio basics",
      outcome: "Studio identity, location, escalation contact, and front-desk details.",
    },
    menus: {
      title: "Services and pricing",
      eyebrow: "Service menu",
      outcome: "Service menu, durations, starting prices, add-ons, providers, packages, and contraindications.",
    },
    orders: {
      title: "Booking request workflow",
      eyebrow: "Clients",
      outcome: "Booking links, staff-confirmed requests, deposits, response estimates, and routing.",
    },
    reservations: {
      title: "Appointments",
      eyebrow: "Scheduling",
      outcome: "Scheduling system, service duration rules, provider requests, deposits, cancellation policy, and staff confirmation.",
    },
    policies: {
      title: "Client policies",
      outcome: "Parking, late arrivals, cancellations, deposits, allergies, accessibility, pets, children, and common FAQs.",
    },
  },
};

const homeServicesOrderOptions = [
  "Create service request for staff review",
  "Send booking link",
  "Send quote request link",
  "Create request and also offer booking link",
  "Do not handle service requests",
];

const genericSchedulingOptions = [
  "Send caller a booking link",
  "Create request for staff confirmation",
  "Save pending request in HostLine",
  "Take a message only",
  "Say appointments require staff confirmation",
];

const businessFieldOverrides: Partial<Record<BusinessType, Record<string, FieldCopyOverride>>> = {
  home_services: {
    restaurantName: {
      label: "Business name",
      prompt: "What business name should the AI use on calls and chats?",
      placeholder: "Harbor Plumbing",
    },
    concept: {
      label: "Services and specialties",
      prompt: "How would staff describe what the business does in one or two sentences?",
      placeholder: "Licensed plumbing company handling leaks, drains, water heaters, fixture installs, and emergency calls.",
    },
    primaryLocation: {
      label: "Office or service-area base",
      prompt: "What address or service area should customers hear?",
      placeholder: "Serving Greater Boston from Somerville, MA.",
    },
    menuUrl: {
      label: "Service catalog link",
      prompt: "Where can we fetch the most current service list?",
      placeholder: "https://harborplumbing.example/services",
    },
    menuUploadNotes: {
      label: "Uploaded files or notes",
      prompt: "List any service sheets, price books, FAQs, license docs, or intake forms staff will provide.",
      placeholder: "Service price sheet, emergency policy PDF, warranty notes, dispatch checklist.",
    },
    menuCategories: {
      label: "Services offered",
      prompt: "Which services should customers be able to ask about or request?",
      placeholder: "Leak repair, drains, toilets, water heaters, faucets, sump pumps, emergency service.",
    },
    modifiers: {
      label: "Job details to collect",
      prompt: "Which details help staff understand the job before calling back?",
      placeholder: "Location of issue, urgency, photos available, property type, shutoff status, access instructions.",
    },
    substitutionPolicy: {
      label: "Out-of-scope requests",
      prompt: "Which requests can the AI accept, flag for staff, or decline?",
      placeholder: "Gas line work, remodel bids, and commercial jobs need staff review before promising availability or price.",
    },
    timedPricing: {
      label: "Trip fees and emergency pricing",
      prompt: "What prices, fees, or availability change by time, day, distance, or emergency status?",
      placeholder: "Emergency surcharge after 6 PM and weekends. Free estimates for planned installs within 15 miles.",
    },
    drinkRules: {
      label: "Licenses, warranties, and safety rules",
      prompt: "What should the AI know about licenses, permits, warranties, and safety?",
      placeholder: "Licensed and insured. Do not advise unsafe DIY steps. Ask caller to shut off water if safe.",
    },
    takeOrders: {
      label: "Capture service requests",
      prompt: "Should the AI capture service requests for staff follow-up?",
    },
    orderHandlingMode: {
      label: "What the AI should do",
      prompt: "When a customer needs service, what should the AI do first?",
      options: homeServicesOrderOptions,
    },
    onlineOrderingUrl: {
      label: "Primary service request link",
      prompt: "If customers can submit service requests online, what link should the AI send?",
      placeholder: "https://harborplumbing.example/request",
    },
    defaultPickupEta: {
      label: "Default response ETA",
      prompt: "What follow-up estimate should the AI use when dispatch is not connected?",
      placeholder: "A dispatcher will call back within 15 minutes during business hours.",
    },
    orderDestination: {
      label: "Request destination",
      prompt: "Where should new service requests go first?",
      options: ["Staff review queue", "Dispatch board", "CRM integration", "Email or webhook"],
    },
    takeReservations: {
      label: "Handle appointment requests",
      prompt: "Should the AI answer scheduling questions or collect appointment requests?",
    },
    reservationSourceToday: {
      label: "Current scheduling workflow",
      prompt: "How does the business manage appointments today?",
      options: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Booking link", "Phone calls only", "Spreadsheet", "No formal system"],
    },
    reservationHandlingMode: {
      label: "What the AI should do",
      prompt: "When a customer asks for an appointment, what should the AI do first?",
      options: genericSchedulingOptions,
    },
    reservationProvider: {
      label: "Scheduling system",
      prompt: "Which scheduling system or link should we connect later?",
      options: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Booking link", "Manual requests only"],
    },
    reservationBookingUrl: {
      label: "Booking link",
      prompt: "If the AI should send a booking link, what URL should it use?",
      placeholder: "https://harborplumbing.example/book",
    },
    partyRules: {
      label: "Appointment rules",
      prompt: "Which appointment types can be requested automatically, and which need staff confirmation?",
      placeholder: "Routine service can be requested online. Emergency, commercial, and remodel jobs need dispatcher review.",
    },
    privateEvents: {
      label: "Commercial or larger projects",
      prompt: "What should happen when customers ask about larger jobs, remodels, or commercial work?",
      placeholder: "Collect scope, property type, timeline, budget range, and contact info for owner follow-up.",
    },
    waitlistPolicy: {
      label: "Urgent and emergency calls",
      prompt: "What should the AI say about emergencies, urgent calls, and response windows?",
      placeholder: "Active leaks get urgent callback. If there is flooding or safety risk, tell the caller to shut off water if safe.",
    },
    mainPhone: {
      label: "Business main line",
      prompt: "Which number do customers call today?",
    },
    assignedHostLineNumber: {
      prompt: "This is the number the business forwards calls to.",
    },
    firstTestCall: {
      placeholder: "Ask about emergency service, request a quote, ask service-area questions, then check dashboard.",
    },
  },
  professional_services: {
    restaurantName: { label: "Firm name", prompt: "What firm name should the AI use?", placeholder: "Northstar Advisory" },
    concept: { label: "Services and client fit", prompt: "How would staff describe the firm and who it helps?", placeholder: "Boutique advisory firm offering consultations, intake calls, and document review." },
    menuUrl: { label: "Services link", prompt: "Where can we fetch service or practice-area information?", placeholder: "https://northstar.example/services" },
    menuCategories: { label: "Service lines", prompt: "Which services should clients be able to ask about?", placeholder: "Consultations, document review, onboarding, billing questions, existing-client support." },
    modifiers: { label: "Intake details", prompt: "Which details should staff collect before follow-up?", placeholder: "Client status, matter type, deadline, contact info, conflict-check notes." },
    orderHandlingMode: { label: "What the AI should do", options: ["Create lead for staff review", "Send consultation booking link", "Send intake form", "Take a message only"] },
    onlineOrderingUrl: { label: "Primary client request link", prompt: "If clients can start online, what link should the AI send?", placeholder: "https://northstar.example/contact" },
    takeReservations: { label: "Handle consultations", prompt: "Should the AI answer scheduling questions or collect consultation requests?" },
    reservationBookingUrl: { label: "Consultation booking link", placeholder: "https://northstar.example/book" },
    reservationHandlingMode: { label: "What the AI should do", options: genericSchedulingOptions },
    reservationProvider: { label: "Scheduling system", options: ["Calendly", "Google Calendar", "Microsoft Bookings", "Booking link", "Manual requests only"] },
    partyRules: { label: "Consultation rules", placeholder: "New clients require conflict check. Existing clients can request callbacks." },
    privateEvents: { label: "Complex requests", placeholder: "Collect topic, deadline, organization, contact info, and route to the office team." },
  },
  retail: {
    restaurantName: { label: "Shop name", prompt: "What store name should the AI use?", placeholder: "Cedar & Finch" },
    concept: { label: "Products and positioning", prompt: "How would staff describe the shop?", placeholder: "Independent home goods shop with gifts, decor, special orders, and local pickup." },
    menuUrl: { label: "Catalog or store link", placeholder: "https://cedarfinch.example/shop" },
    menuCategories: { label: "Product categories", prompt: "Which product categories should customers ask about?", placeholder: "Gifts, candles, tableware, linens, furniture, special orders, gift cards." },
    modifiers: { label: "Product details to collect", placeholder: "Size, color, brand, SKU, pickup date, gift wrap, delivery preference." },
    orderHandlingMode: { label: "What the AI should do", options: ["Create request for staff review", "Send online store link", "Take a message only", "Do not handle orders"] },
    onlineOrderingUrl: { label: "Online store link", prompt: "If customers can shop online, what link should the AI send?", placeholder: "https://cedarfinch.example/shop" },
    takeReservations: { label: "Handle appointments", prompt: "Should the AI handle personal shopping, fitting, or consultation requests?" },
    reservationBookingUrl: { label: "Appointment link", placeholder: "https://cedarfinch.example/book" },
    partyRules: { label: "Appointment rules", placeholder: "Personal shopping and fittings need staff confirmation." },
    waitlistPolicy: { label: "Product holds and availability", placeholder: "Staff can hold in-stock items until close of next business day after confirmation." },
  },
  salon_spa: {
    restaurantName: { label: "Studio name", prompt: "What studio name should the AI use?", placeholder: "Luna Studio" },
    concept: { label: "Services and vibe", prompt: "How would staff describe the salon or spa?", placeholder: "Modern salon offering cuts, color, blowouts, facials, massage, and bridal services." },
    menuUrl: { label: "Service menu link", placeholder: "https://lunastudio.example/services" },
    menuCategories: { label: "Services offered", prompt: "Which services should clients ask about or book?", placeholder: "Haircuts, color, blowouts, facials, massage, waxing, bridal, packages." },
    modifiers: { label: "Service options", placeholder: "Provider preference, hair length, color history, add-ons, duration, first visit notes." },
    timedPricing: { label: "Timed pricing and promos", placeholder: "New-client facial promo weekdays. Bridal consultations require deposit." },
    drinkRules: { label: "Contraindications and product notes", placeholder: "Pregnancy massage limitations, skin sensitivities, patch tests, product allergies." },
    orderHandlingMode: { label: "What the AI should do", options: ["Create booking request for staff review", "Send booking link", "Take a message only", "Do not handle booking requests"] },
    onlineOrderingUrl: { label: "Booking or store link", prompt: "If clients can book or buy products online, what link should the AI send?", placeholder: "https://lunastudio.example/book" },
    takeReservations: { label: "Handle appointments", prompt: "Should the AI answer appointment questions or collect booking requests?" },
    reservationSourceToday: { label: "Current booking workflow", options: ["Boulevard", "Vagaro", "Square Appointments", "Mindbody", "Google Calendar", "Booking link", "Phone calls only"] },
    reservationHandlingMode: { label: "What the AI should do", options: genericSchedulingOptions },
    reservationProvider: { label: "Booking system", options: ["Boulevard", "Vagaro", "Square Appointments", "Mindbody", "Booking link", "Manual requests only"] },
    reservationBookingUrl: { label: "Booking link", placeholder: "https://lunastudio.example/book" },
    partyRules: { label: "Appointment rules", placeholder: "Color corrections, bridal parties, and first-time skin treatments need staff confirmation." },
    depositPolicy: { label: "Deposits and cancellation fees", placeholder: "Color services and bridal appointments require deposits. 24-hour cancellation policy." },
    waitlistPolicy: { label: "Waitlist and same-day appointments", placeholder: "Same-day appointments can be requested but staff confirms availability." },
  },
};

export function getBusinessOnboardingSections(value: OnboardingDraft | BusinessType | string | undefined) {
  const businessType = normalizeBusinessType(typeof value === "object" ? value.businessType : value);
  const sectionCopy = businessSectionCopy[businessType] ?? {};
  const fieldCopy = businessFieldOverrides[businessType] ?? {};

  return onboardingSections.map((section) => ({
    ...section,
    ...(sectionCopy[section.id] ?? {}),
    fields: section.fields
      .filter((field) => !field.businessTypes || field.businessTypes.includes(businessType))
      .map((field) => ({
        ...field,
        ...(fieldCopy[field.id] ?? {}),
      })),
  }));
}

export function getOnboardingBusinessTemplate(value: OnboardingDraft | BusinessType | string | undefined) {
  return getBusinessTemplate(typeof value === "object" ? value.businessType : value);
}

export const productionWorkstreams = [
  "Self-service auth, billing, organization, and location signup",
  "Conversational onboarding and multi-industry knowledge extraction",
  "Menu ingestion from PDFs, images, links, spreadsheets, and POS exports",
  "Twilio number provisioning, forwarding instructions, and live call routing",
  "Realtime voice latency tuning across Twilio, transcription, LLM, and ElevenLabs",
  "Supabase persistence, RLS, roles, audit logs, and admin workflows",
  "Staff-review queues for orders, reservations, appointments, quotes, and callbacks",
  "Link-first workflows for ordering, booking, quotes, intake forms, and menus",
  "Optional industry integrations later for POS, booking, CRM, and dispatch systems",
  "SMS confirmations, staff alerts, low-confidence review, and human handoff",
  "Analytics, call QA, transcript review, and launch-readiness monitoring",
  "Compliance, security, secrets, observability, deployment, and support tooling",
] as const;

export const sampleOnboardingDraft: OnboardingDraft = {
  assignedHostLineNumber: assignedDemoPhoneNumber,
  allergyPolicy: "Severe allergies require staff confirmation. Gluten-free crust is available, but cross-contact is possible.",
  businessType: "restaurant",
  callHandling: "After 3 rings",
  askSalesIntent: true,
  complaintPolicy:
    "Apologize, collect the caller name, callback number, order or visit details, and send to the manager. Do not guarantee refunds.",
  complaintsManagerPhone: "+1 (415) 555-0148",
  concept: "Neighborhood Italian restaurant with wood-fired pizza, handmade pasta, seasonal cocktails, and weekend brunch.",
  defaultPickupEta: "25 minutes",
  deliveryDriverPolicy: "Delivery drivers check in at the pickup shelf with the guest name and app name.",
  deliveryPolicy: "Direct pickup only. DoorDash and Uber Eats issues should start in the app, then staff can review the details.",
  donationPressPolicy: "Collect the organization, request, deadline, and contact info for owner review.",
  drinkRules:
    "Cocktails are dine-in only except sealed wine bottles where allowed. Non-alcoholic spritzes and espresso drinks are available. Last call is 30 minutes before close.",
  escalationPhone: "+1 (415) 555-0148",
  feesAndRules:
    "Corkage is $25 per bottle with a two-bottle limit. Cake plating is $2 per guest. Service animals only. Smart casual dress. Wheelchair accessible entrance and restroom.",
  firstTestCall: "Ask hours, place a pickup order, ask about Mother's Day reservations, then check dashboard.",
  forwardingMode: "Forward only unanswered calls",
  hiringPolicy: "Applicants can email a resume or stop by Tuesday through Thursday between 2 and 4 PM.",
  greeting: "Hi, thank you for calling {restaurant_name}. How can I help you?",
  hostName: "Vera",
  holidayExceptions: "Mother's Day brunch uses a special prix fixe menu and requires staff confirmation.",
  humanHandoffPolicy: "Collect the caller's name, phone, reason, and urgency, then send staff a callback task.",
  lostAndFoundPolicy: "Collect item description, visit date and time, where they sat, name, and callback number.",
  mainPhone: "+1 (415) 555-0148",
  menuCategories: "Starters, wood-fired pizza, pasta, dessert, cocktails, wine, beer, and NA drinks.",
  menuUploadNotes: "Dinner menu PDF, brunch photo menu, cocktail list spreadsheet, and current specials sheet.",
  menuUrl: "https://oliveandember.example/menu",
  modifiers: "Gluten-free crust +$4, light cheese, no anchovy, add chicken +$6.",
  substitutionPolicy:
    "Simple pizza substitutions can be noted when ingredients are already on the menu. Off-menu items, severe allergy changes, extra proteins, and price changes need staff confirmation before promising.",
  orderChangePolicy: "Collect the order name, phone number, requested change, and send staff for confirmation.",
  orderDestination: "Staff review queue",
  orderHandlingMode: "Capture order and also offer online ordering link",
  orderingCutoffs: "Kitchen stops new pickup orders 30 minutes before close. Pizza and pasta are unavailable after the kitchen closes.",
  onlineOrderingUrl: "https://oliveandember.example/order",
  parking: "Metered street parking on Valencia. Paid lot at 17th and Valencia.",
  autoConfirmPartyLimit: "6",
  depositPolicy: "Parties of 8 or more and special prix fixe holidays may require a card or deposit through staff or OpenTable.",
  partyRules: "Auto-confirm up to 6 with availability. Parties 8 or more need manager confirmation.",
  paymentPolicy: "Pay at pickup. No card numbers over the phone.",
  primaryLocation: "182 Valencia St, San Francisco, CA 94103",
  largePartyThreshold: "8 or more",
  lateArrivalPolicy: "Tables are held for 15 minutes. After that, staff confirms whether the table can still be seated.",
  noShowPolicy: "Standard reservations can be canceled same day. Special events and deposits may have stricter cancellation rules.",
  privateEvents: "Collect event date, guest count, budget range, dining style, contact name, phone, email, and preferred follow-up time.",
  regularHours: "Mon closed, Tue-Thu 5-10 PM, Fri 5-11 PM, Sat noon-11 PM, Sun noon-9 PM.",
  privateRoomPolicy: "Semi-private dining is available for 12-24 guests and always needs events manager confirmation.",
  reservationChangePolicy: "Collect reservation name, date, time, party size, requested change, and send to staff.",
  reservationAdvanceWindow: "Up to 60 days ahead.",
  reservationBookingUrl: "https://www.opentable.com/r/olive-and-ember",
  reservationCutoffRules: "Same-day reservations after 4 PM on Friday and Saturday need staff confirmation.",
  reservationHandlingMode: "Create request for staff confirmation",
  reservationMinNotice: "Same-day requests are okay, but staff confirms during busy services.",
  reservationProvider: "OpenTable",
  reservationSourceToday: "OpenTable",
  restaurantName: "Olive & Ember",
  salesManagerEmail: "owner@oliveandember.example",
  servicePeriods:
    "Dinner Tue-Fri 5 PM to close. Saturday and Sunday brunch noon to 2 PM. Saturday dinner 5 PM to close. Bar opens at 4 PM Tue-Fri.",
  smsConfirmations: true,
  specialsSchedule:
    "Tonight's specials rotate daily. Happy hour Tue-Fri 4-6 PM. Live jazz Thu 7-9 PM. Acoustic guitar Sun 5-7 PM.",
  specialReservationDays: "Mother's Day brunch uses a special prix fixe menu and requires staff confirmation.",
  seatingAreas: "Dining room, bar, patio, and chef counter. Patio and chef counter requests can be noted but are not guaranteed.",
  takeOrders: true,
  takeReservations: true,
  timedPricing:
    "Happy hour Tue-Fri 4-6 PM at the bar and patio: $9 spritzes, $8 house wine, $6 beer, and $10 margherita pizzettes. Brunch-only items are Sat-Sun noon-2 PM.",
  timezone: "America/Los_Angeles",
  tone: "Warm",
  upsellRules:
    "Suggest tiramisu or affogato with pasta orders, sparkling water with larger pickup orders, and no more than one upsell after the caller declines.",
  vendorCallPolicy: "Collect company, caller name, reason, phone, and email, then route to the owner.",
  voiceGender: "Female - Eve",
  waitlistPolicy: "Walk-ins are welcome, but live wait times change quickly and are confirmed at the door.",
  offerComplaintCallback: true,
  customFaqs:
    "Do you have live music? Do you have patio seating? What are tonight's specials? Do you sell gift cards? Can I bring a cake? Do you have vegan options? Where should delivery drivers go?",
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
