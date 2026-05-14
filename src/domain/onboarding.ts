import {
  businessTemplates,
  businessTypeOptions,
  getBusinessTemplate,
  normalizeBusinessType,
  type BusinessType,
} from "./business-templates";
import { signalHostVoiceRoster } from "./voice-selection";

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
  | "owner"
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
        id: "ownerName",
        label: "Owner or manager name",
        prompt: "Who should SignalHost treat as the trusted owner or manager for reports, alerts, and owner-assistant messages?",
        placeholder: "Maria Lombardi",
        control: "short",
        required: true,
      },
      {
        id: "ownerPhone",
        label: "Owner mobile phone",
        prompt: "Which mobile number can receive urgent alerts and verified owner-assistant text commands?",
        placeholder: "+1 (415) 555-0148",
        control: "short",
        required: true,
      },
      {
        id: "ownerEmail",
        label: "Owner email",
        prompt: "Where should SignalHost send daily reports, billing notices, and owner-assistant summaries?",
        placeholder: "owner@oliveandember.example",
        control: "short",
        required: true,
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
        businessTypes: ["electrical", "hvac", "plumbing", "roofing", "salon_barber"],
        id: "appointmentBookingUrl",
        label: "Appointment booking link",
        prompt: "If customers can book online, what link should the AI send?",
        placeholder: "https://business.example/book",
        control: "url",
      },
      {
        businessTypes: ["electrical", "hvac", "plumbing", "roofing"],
        id: "quoteRequestUrl",
        label: "Quote request link",
        prompt: "If customers can request an estimate online, what link should the AI send?",
        placeholder: "https://business.example/quote",
        control: "url",
      },
      {
        businessTypes: ["electrical", "hvac", "plumbing", "roofing", "salon_barber"],
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
          "Save pending request in SignalHost",
          "Confirm in SignalHost when rules allow",
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
    id: "owner",
    title: "Owner controls",
    eyebrow: "Reports & learning",
    assistantPrompt:
      "Now let us decide how SignalHost reports back, learns from corrections, follows up on opportunities, and knows which team members it can trust.",
    outcome: "Trusted contacts, permissions, alert routing, daily reports, learning loop, live updates, follow-up rules, QA, and value scoring.",
    fields: [
      {
        id: "additionalTrustedContacts",
        label: "Trusted team contacts",
        prompt: "Who else can receive alerts, review calls, answer questions, or teach SignalHost?",
        placeholder:
          "Alex Chen, general manager, +1 (415) 555-0171, alex@example.com, urgent alerts and call review; permanent knowledge needs owner approval.",
        control: "long",
      },
      {
        id: "alertPreferenceRules",
        label: "Alert rules",
        prompt: "Who should be notified for critical, high-value, normal, low-priority, and summary-only events?",
        placeholder:
          "Critical issues text owner and manager immediately. Private events/high-value leads text manager. Vendor calls appear in daily summary only.",
        control: "long",
        required: true,
      },
      {
        id: "ownerReportPreferences",
        label: "Owner reports",
        prompt: "When and where should SignalHost send daily and weekly summaries?",
        placeholder:
          "Daily report by email at 8:30 PM. Weekly report Monday at 8 AM. Urgent items text owner immediately.",
        control: "long",
        required: true,
      },
      {
        id: "unknownAnswerPolicy",
        label: "When SignalHost is not sure",
        prompt: "What should SignalHost say, collect, and promise when it does not know an answer?",
        placeholder:
          "Say it will check with the team, collect name and callback number, create a task, and never guess. Reply when staff provides the answer.",
        control: "long",
        required: true,
      },
      {
        id: "knowledgeApprovalPolicy",
        label: "Knowledge approval",
        prompt: "Who can turn a correction into permanent business knowledge?",
        control: "select",
        required: true,
        options: [
          "Owner approves permanent knowledge",
          "Managers can suggest, owner approves",
          "Trusted managers can save permanent knowledge",
          "SignalHost drafts only",
        ],
      },
      {
        id: "liveUpdateRules",
        label: "Temporary updates and modes",
        prompt: "Which updates can the owner or team give SignalHost for today, this week, emergencies, staffing, promos, or busy periods?",
        placeholder:
          "Daily specials expire at close. Closed dates expire after that date. Busy mode during Friday dinner means answer all overflow and avoid promising live waits.",
        control: "long",
      },
      {
        id: "followUpPolicy",
        label: "Follow-up rules",
        prompt: "Which callers should SignalHost follow up with, remind the owner about, or place in an approval queue?",
        placeholder:
          "Follow up on private events and catering the same day. Remind owner about open callbacks after 24 hours. Review requests require owner approval.",
        control: "long",
      },
      {
        id: "callReviewPolicy",
        label: "Call review and QA",
        prompt: "Which calls should the owner review first, and who may see transcripts or recordings?",
        placeholder:
          "Review first 20 calls, then all complaints, allergies, low-confidence answers, and high-value leads. Owner and managers can review recordings.",
        control: "long",
      },
      {
        id: "opportunityScoringRules",
        label: "High-value opportunities",
        prompt: "What should count as a valuable opportunity, urgent risk, or low-priority call for this business?",
        placeholder:
          "Private events, catering, large parties, and repeat guest issues are high value. Vendor sales calls are low priority. Complaints are high risk.",
        control: "long",
      },
    ],
  },
  {
    id: "voice",
    title: "Voice and behavior",
    eyebrow: "Host",
    assistantPrompt: "Now let us make the host sound like the restaurant and behave the way staff expect.",
    outcome: "Employee voice, tone, greeting, answer timing, text follow-ups, languages, and handoff rules.",
    fields: [
      {
        id: "voiceProfileId",
        label: "Who should answer?",
        prompt: "Choose the SignalHost employee voice callers will hear.",
        control: "select",
        required: true,
        options: signalHostVoiceRoster.map((profile) => ({ label: profile.label, value: profile.id })),
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
    assistantPrompt: "Last step: assign the SignalHost number, test the first call, and forward the restaurant line.",
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
        id: "phoneLineType",
        label: "Phone setup type",
        prompt: "What kind of phone system receives calls today?",
        control: "select",
        required: true,
        options: ["Mobile phone", "Landline or desk phone", "VoIP / phone system", "Not sure"],
      },
      {
        id: "phoneProvider",
        label: "Phone provider or carrier",
        prompt: "Who provides that number or phone system?",
        placeholder: "Verizon, AT&T, Comcast Business, Spectrum, RingCentral, Google Voice, not sure.",
        control: "short",
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
        id: "assignedSignalHostNumber",
        label: "SignalHost number",
        prompt: "This is the number the restaurant forwards calls to.",
        placeholder: assignedDemoPhoneNumber,
        control: "short",
        required: true,
      },
      {
        id: "websiteUrl",
        label: "Website URL",
        prompt: "Where should the website chat widget be installed?",
        placeholder: "https://oliveandember.example",
        control: "url",
      },
      {
        id: "websitePlatform",
        label: "Website platform",
        prompt: "Which website builder or CMS does the business use?",
        control: "select",
        options: ["WordPress", "Squarespace", "Wix", "Shopify", "Webflow", "Custom website", "Not sure"],
      },
      {
        id: "websiteAdminContact",
        label: "Website helper",
        prompt: "Who can add the website chat snippet if the owner cannot?",
        placeholder: "webmaster@example.com, agency contact, or owner does it.",
        control: "short",
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

const tradeSectionCopy: Partial<Record<OnboardingStepId, SectionCopyOverride>> = {
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
  owner: {
    title: "Owner controls",
    eyebrow: "Reports & learning",
    assistantPrompt: "Now let us decide how SignalHost reports, learns, follows up, and routes service opportunities.",
    outcome: "Trusted contacts, alert routing, reports, learning loop, follow-up rules, QA, and lead value scoring.",
  },
  voice: {
    title: "Voice and behavior",
    eyebrow: "Front desk",
    assistantPrompt: "Now let us make the AI sound like the business and behave the way staff expect.",
    outcome: "Host name, tone, greeting, answer timing, text follow-ups, languages, and handoff rules.",
  },
  launch: {
    title: "Phone launch",
    assistantPrompt: "Last step: assign the SignalHost number, test the first call, and forward the business line.",
    outcome: "SignalHost number, forwarding mode, test script, launch checklist, and dashboard handoff.",
  },
};

const businessSectionCopy: Partial<Record<BusinessType, Partial<Record<OnboardingStepId, SectionCopyOverride>>>> = {
  electrical: {
    ...tradeSectionCopy,
    menus: {
      ...tradeSectionCopy.menus,
      outcome: "Repairs, panels, EV chargers, generators, lighting, permits, safety escalation, and out-of-scope work.",
    },
  },
  hvac: {
    ...tradeSectionCopy,
    menus: {
      ...tradeSectionCopy.menus,
      outcome: "Heating, cooling, tune-ups, emergency service, equipment brands, warranties, financing, and out-of-scope work.",
    },
  },
  plumbing: {
    ...tradeSectionCopy,
    menus: {
      ...tradeSectionCopy.menus,
      outcome: "Leaks, drains, water heaters, fixtures, emergency service, trip fees, warranties, and out-of-scope requests.",
    },
  },
  roofing: {
    ...tradeSectionCopy,
    menus: {
      ...tradeSectionCopy.menus,
      outcome: "Roof repairs, replacements, inspections, gutters, storm damage, insurance context, photos, and emergency leaks.",
    },
    reservations: {
      ...tradeSectionCopy.reservations,
      title: "Inspections and estimates",
      outcome: "Inspection windows, estimate rules, storm lead priority, photo intake, and staff-confirmed requests.",
    },
  },
  salon_barber: {
    basics: {
      title: "Studio basics",
      outcome: "Studio identity, location, escalation contact, and front-desk details.",
    },
    menus: {
      title: "Services and pricing",
      eyebrow: "Service menu",
      outcome: "Services, durations, starting prices, add-ons, providers, packages, products, and contraindications.",
    },
    orders: {
      title: "Booking request workflow",
      eyebrow: "Clients",
      outcome: "Booking links, staff-confirmed requests, deposits, response estimates, product questions, and routing.",
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
    owner: {
      title: "Owner controls",
      eyebrow: "Reports & learning",
      assistantPrompt: "Now let us decide how SignalHost reports, learns, follows up, and routes client opportunities.",
      outcome: "Trusted contacts, alert routing, reports, learning loop, follow-up rules, QA, and client value scoring.",
    },
    voice: {
      title: "Voice and behavior",
      eyebrow: "Front desk",
      assistantPrompt: "Now let us make the AI sound like the studio and behave the way the front desk expects.",
      outcome: "Host name, tone, greeting, answer timing, text follow-ups, languages, and handoff rules.",
    },
  },
};

const tradeOrderOptions = [
  "Create service request for staff review",
  "Send booking link",
  "Send quote request link",
  "Create request and also offer booking link",
  "Do not handle service requests",
];

const genericSchedulingOptions = [
  "Send caller a booking link",
  "Create request for staff confirmation",
  "Save pending request in SignalHost",
  "Take a message only",
  "Say appointments require staff confirmation",
];

const tradeFieldOverrides: Record<string, FieldCopyOverride> = {
  restaurantName: {
    label: "Business name",
    prompt: "What business name should the AI use on calls and chats?",
    placeholder: "Harbor Plumbing",
  },
  concept: {
    label: "Services and specialties",
    prompt: "How would staff describe what the business does in one or two sentences?",
    placeholder: "Licensed home-service company handling urgent repairs, scheduled appointments, estimates, and maintenance.",
  },
  primaryLocation: {
    label: "Office or service-area base",
    prompt: "What address or service area should customers hear?",
    placeholder: "Serving Greater Boston from Somerville, MA.",
  },
  menuUrl: {
    label: "Service catalog link",
    prompt: "Where can we fetch the most current service list?",
    placeholder: "https://business.example/services",
  },
  menuUploadNotes: {
    label: "Uploaded files or notes",
    prompt: "List any service sheets, price books, FAQs, license docs, warranty notes, or intake forms staff will provide.",
    placeholder: "Service price sheet, emergency policy PDF, warranty notes, dispatch checklist.",
  },
  menuCategories: {
    label: "Services offered",
    prompt: "Which services should customers be able to ask about or request?",
    placeholder: "Emergency service, repairs, installations, inspections, maintenance, estimates, commercial work.",
  },
  modifiers: {
    label: "Job details to collect",
    prompt: "Which details help staff understand the job before calling back?",
    placeholder: "Address, urgency, photos available, property type, access instructions, equipment details, safety concerns.",
  },
  substitutionPolicy: {
    label: "Out-of-scope requests",
    prompt: "Which requests can the AI accept, flag for staff, or decline?",
    placeholder: "Jobs requiring permits, unsafe conditions, commercial work, or exact pricing need staff review before promising anything.",
  },
  timedPricing: {
    label: "Fees and emergency pricing",
    prompt: "What prices, fees, or availability change by time, day, distance, urgency, or project type?",
    placeholder: "Emergency surcharge after 6 PM and weekends. Free estimates for planned installs within 15 miles.",
  },
  drinkRules: {
    label: "Licenses, warranties, and safety rules",
    prompt: "What should the AI know about licenses, permits, warranties, and safety-sensitive advice?",
    placeholder: "Licensed and insured. Do not give unsafe DIY instructions. Escalate safety concerns to staff.",
  },
  regularHours: {
    label: "Office and service hours",
    prompt: "What are normal phone, dispatch, and service hours for each day?",
    placeholder: "Mon-Fri 8 AM-6 PM, Sat 9 AM-2 PM, Sun emergency calls only.",
  },
  servicePeriods: {
    label: "Service windows",
    prompt: "When do standard service, estimates, emergency coverage, and after-hours calls run?",
    placeholder: "Routine appointments Mon-Fri 9-5. Emergency calls after hours. Estimates Tue-Thu afternoons.",
  },
  specialsSchedule: {
    label: "Promotions and seasonal priorities",
    prompt: "Which seasonal promos, maintenance pushes, or high-priority services should the AI know?",
    placeholder: "Spring tune-up promo, winter emergency heat priority, free replacement estimates in service area.",
  },
  holidayExceptions: {
    label: "Holiday and storm coverage",
    prompt: "Which holidays, weather events, or blackout dates change availability or response promises?",
    placeholder: "Closed Thanksgiving and Christmas except emergencies. Storm-response queue after major weather events.",
  },
  orderingCutoffs: {
    label: "Dispatch cutoffs",
    prompt: "When should the AI stop offering same-day callbacks, appointments, estimates, or non-emergency requests?",
    placeholder: "Same-day routine requests before 3 PM. After 3 PM, staff confirms next available window.",
  },
  takeOrders: {
    label: "Capture service requests",
    prompt: "Should the AI capture service requests for staff follow-up?",
  },
  orderHandlingMode: {
    label: "What the AI should do",
    prompt: "When a customer needs service, what should the AI do first?",
    options: tradeOrderOptions,
  },
  onlineOrderingUrl: {
    label: "Primary service request link",
    prompt: "If customers can submit service requests online, what link should the AI send?",
    placeholder: "https://business.example/request",
  },
  defaultPickupEta: {
    label: "Default response ETA",
    prompt: "What follow-up estimate should the AI use when dispatch is not connected?",
    placeholder: "A dispatcher will call back within 15 minutes during business hours.",
  },
  paymentPolicy: {
    label: "Payment and estimate policy",
    prompt: "How should the AI explain trip fees, diagnostics, estimates, deposits, financing, and payment?",
    placeholder: "Diagnostic fee due at visit. Estimates for replacements are free. Financing available on approved credit.",
  },
  orderDestination: {
    label: "Request destination",
    prompt: "Where should new service requests go first?",
    options: ["Staff review queue", "Dispatch board", "CRM integration", "Email or webhook"],
  },
  orderChangePolicy: {
    label: "Existing jobs and changes",
    prompt: "What should the AI do if someone wants to change, cancel, or check an existing appointment or job?",
    placeholder: "Collect job name, address, phone, requested change, and urgency. Flag staff before promising anything.",
  },
  deliveryDriverPolicy: {
    label: "Technician arrival and access",
    prompt: "What should customers know about technician arrival windows, access, pets, gates, parking, and call-ahead rules?",
    placeholder: "Technician will call before arrival. Secure pets, clear access to equipment, and share gate codes if needed.",
  },
  upsellRules: {
    label: "Helpful suggestions",
    prompt: "What should the AI mention naturally without sounding salesy?",
    placeholder: "Mention maintenance plans after repair requests and financing after replacement estimate questions.",
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
    placeholder: "https://business.example/book",
  },
  partyRules: {
    label: "Appointment rules",
    prompt: "Which appointment types can be requested automatically, and which need staff confirmation?",
    placeholder: "Routine service can be requested online. Emergency, commercial, and complex jobs need dispatcher review.",
  },
  privateEvents: {
    label: "Large projects and commercial work",
    prompt: "What should happen when customers ask about larger projects, remodels, installations, or commercial work?",
    placeholder: "Collect scope, property type, timeline, budget range, photos, and contact info for owner follow-up.",
  },
  waitlistPolicy: {
    label: "Urgent and emergency calls",
    prompt: "What should the AI say about emergencies, urgent calls, and response windows?",
    placeholder: "Active leaks, no heat, sparking, or interior roof leaks get urgent callback. Safety risks are escalated.",
  },
  parking: {
    label: "Service area and directions",
    prompt: "What should customers know about your service area, office location, arrival expectations, or directions?",
    placeholder: "Serving Greater Boston within 25 miles. Office visits by appointment only. Technicians call before arrival.",
  },
  allergyPolicy: {
    label: "Safety-sensitive calls",
    prompt: "Which situations should the AI treat as urgent or unsafe, and what should it avoid saying?",
    placeholder: "Do not give DIY repair instructions for safety-sensitive issues. Escalate gas smell, flooding, sparking, or active leaks.",
  },
  deliveryPolicy: {
    label: "Service area and travel rules",
    prompt: "Where do you provide service, and what should the AI say about travel fees, out-of-area requests, or remote estimates?",
    placeholder: "Serve within 25 miles. Out-of-area requests go to staff review. Travel fees may apply beyond 15 miles.",
  },
  lostAndFoundPolicy: {
    label: "Existing job follow-up",
    prompt: "What should the AI collect when someone asks about an existing job, estimate, invoice, warranty, or technician visit?",
    placeholder: "Collect name, address, phone, job date, technician if known, and what they need changed or reviewed.",
  },
  hiringPolicy: {
    label: "Jobs and hiring",
    prompt: "What should the AI say when someone asks about careers, apprenticeships, subcontracting, or resumes?",
    placeholder: "Collect name, trade, license status, phone, email, and resume link; route to operations.",
  },
  donationPressPolicy: {
    label: "Partnerships, property managers, and press",
    prompt: "What should happen when callers ask about partnerships, property management accounts, sponsorships, or media?",
    placeholder: "Collect organization, request, deadline, contact info, and route to the owner or office manager.",
  },
  feesAndRules: {
    label: "Fees, warranties, and customer rules",
    prompt: "Which fees, warranty limits, pets/access rules, financing options, and customer responsibilities should the AI know?",
    placeholder: "Diagnostic fee, emergency surcharge, warranty terms, financing available, secure pets, clear access to work area.",
  },
  customFaqs: {
    label: "Custom FAQs",
    prompt: "What questions do staff answer over and over?",
    placeholder: "Do you offer emergency service? Are you licensed and insured? Do you finance replacements? What areas do you serve?",
  },
  complaintsManagerPhone: {
    label: "Manager phone for urgent issues",
    prompt: "Who should get a text when a caller is upset, reports damage, or describes an urgent safety issue?",
  },
  complaintPolicy: {
    label: "Complaint, damage, and refund handling",
    prompt: "What should the AI say and collect for complaints, property damage, missed appointments, bad experiences, or refund requests?",
    placeholder: "Apologize, collect name, address, callback, job details, and route for manager review without promising refunds.",
  },
  salesManagerEmail: {
    label: "Office email for vendor calls",
    prompt: "Where should we email summaries of vendor, supplier, and sales calls?",
    placeholder: "office@business.com",
  },
  vendorCallPolicy: {
    label: "Vendor and sales call handling",
    prompt: "What should the AI collect from suppliers, software reps, marketing callers, and salespeople?",
    placeholder: "Collect company, reason, contact name, phone, email, and route without interrupting dispatch.",
  },
  humanHandoffPolicy: {
    label: "Human callback rules",
    prompt: "When someone asks for a person, what should the AI promise and what details should it collect?",
    placeholder: "Offer a staff callback, collect name, phone, reason, urgency, and avoid promising immediate transfer.",
  },
  additionalTrustedContacts: {
    placeholder:
      "Jamie office manager, +1 (617) 555-0108, jamie@business.example, urgent alerts and task resolution. Field tech leads can suggest knowledge but need owner approval.",
  },
  alertPreferenceRules: {
    placeholder:
      "Emergencies and safety issues text owner plus dispatcher immediately. Quote/replacement leads text sales. Vendor calls stay in daily summary.",
  },
  ownerReportPreferences: {
    placeholder:
      "Daily report by email at 6 PM. Weekly pipeline report Monday morning. Urgent safety calls text owner and dispatcher immediately.",
  },
  unknownAnswerPolicy: {
    placeholder:
      "If not sure, collect the customer name, phone, address, question, and urgency, then create a callback task instead of guessing.",
  },
  liveUpdateRules: {
    placeholder:
      "Emergency mode during storms or heat waves. Closed holiday dates expire after the holiday. Booked-out notices expire on the date staff gives.",
  },
  followUpPolicy: {
    placeholder:
      "Quote requests get owner reminder after 24 hours. Booking links get one follow-up. Review requests require owner approval.",
  },
  callReviewPolicy: {
    placeholder:
      "Review first 20 calls, then all emergencies, complaints, low-confidence answers, and high-value estimate requests. Owner and managers can review recordings.",
  },
  opportunityScoringRules: {
    placeholder:
      "Emergency calls, replacements, estimates, maintenance plans, and commercial work are high value. Vendor calls and wrong numbers are low priority.",
  },
  smsConfirmations: {
    label: "Text follow-ups",
    prompt: "Should customers receive text confirmations for requests, appointments, quote links, or intake forms?",
  },
  mainPhone: {
    label: "Business main line",
    prompt: "Which number do customers call today?",
  },
  phoneLineType: {
    label: "Phone setup type",
    prompt: "What kind of phone system receives calls today?",
  },
  phoneProvider: {
    label: "Phone provider or carrier",
    prompt: "Who provides that number or phone system?",
    placeholder: "Verizon, AT&T, Comcast Business, Spectrum, RingCentral, Google Voice, not sure.",
  },
  assignedSignalHostNumber: {
    prompt: "This is the number the business forwards calls to.",
  },
  websiteUrl: {
    label: "Website URL",
    prompt: "Where should the website chat widget be installed?",
    placeholder: "https://business.example",
  },
  websitePlatform: {
    label: "Website platform",
    prompt: "Which website builder or CMS does the business use?",
  },
  websiteAdminContact: {
    label: "Website helper",
    prompt: "Who can add the website chat snippet if the owner cannot?",
    placeholder: "webmaster@business.example, agency contact, or owner does it.",
  },
  firstTestCall: {
    placeholder: "Ask about emergency service, request an estimate, ask service-area questions, then check dashboard.",
  },
};

const businessFieldOverrides: Partial<Record<BusinessType, Record<string, FieldCopyOverride>>> = {
  electrical: {
    ...tradeFieldOverrides,
    restaurantName: { ...tradeFieldOverrides.restaurantName, placeholder: "BrightWire Electric" },
    concept: {
      ...tradeFieldOverrides.concept,
      placeholder: "Licensed electrical contractor handling repairs, panels, EV chargers, generators, lighting, and emergency calls.",
    },
    menuCategories: {
      ...tradeFieldOverrides.menuCategories,
      placeholder: "Panel upgrades, outlets, lighting, EV chargers, generators, inspections, emergency electrical calls.",
    },
    modifiers: {
      ...tradeFieldOverrides.modifiers,
      placeholder: "Breaker issue, burning smell, sparking, outage scope, panel age, EV charger details, property type, photos.",
    },
    waitlistPolicy: {
      ...tradeFieldOverrides.waitlistPolicy,
      placeholder: "Burning smell, sparking, partial power loss, and safety concerns need urgent staff callback.",
    },
    reservationProvider: {
      ...tradeFieldOverrides.reservationProvider,
      options: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Booking link", "Manual requests only"],
    },
  },
  hvac: {
    ...tradeFieldOverrides,
    restaurantName: { ...tradeFieldOverrides.restaurantName, placeholder: "Summit Air" },
    concept: {
      ...tradeFieldOverrides.concept,
      placeholder: "HVAC company handling heating, cooling, tune-ups, emergency service, indoor air quality, and replacements.",
    },
    menuCategories: {
      ...tradeFieldOverrides.menuCategories,
      placeholder: "No heat, no AC, tune-ups, filters, indoor air quality, mini-splits, system replacement, maintenance plans.",
    },
    modifiers: {
      ...tradeFieldOverrides.modifiers,
      placeholder: "System type, brand, age, thermostat status, no-heat/no-AC urgency, membership status, photos.",
    },
    timedPricing: {
      ...tradeFieldOverrides.timedPricing,
      placeholder: "Emergency surcharge after 6 PM. Tune-up promos in spring and fall. Maintenance members get priority.",
    },
    waitlistPolicy: {
      ...tradeFieldOverrides.waitlistPolicy,
      placeholder: "No heat in freezing weather, no AC for vulnerable occupants, gas smell, and CO alarms need urgent escalation.",
    },
    reservationProvider: {
      ...tradeFieldOverrides.reservationProvider,
      options: ["ServiceTitan", "Housecall Pro", "Jobber", "Google Calendar", "Booking link", "Manual requests only"],
    },
  },
  plumbing: {
    ...tradeFieldOverrides,
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
      options: tradeOrderOptions,
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
    assignedSignalHostNumber: {
      prompt: "This is the number the business forwards calls to.",
    },
    firstTestCall: {
      placeholder: "Ask about emergency service, request a quote, ask service-area questions, then check dashboard.",
    },
  },
  roofing: {
    ...tradeFieldOverrides,
    restaurantName: { ...tradeFieldOverrides.restaurantName, placeholder: "RidgeLine Roofing" },
    concept: {
      ...tradeFieldOverrides.concept,
      placeholder: "Roofing company handling repairs, replacements, storm damage, inspections, gutters, skylights, and emergency tarping.",
    },
    menuCategories: {
      ...tradeFieldOverrides.menuCategories,
      placeholder: "Roof repair, replacement, storm damage, inspections, gutters, skylights, emergency tarping, commercial roofing.",
    },
    modifiers: {
      ...tradeFieldOverrides.modifiers,
      placeholder: "Roof type, leak location, storm date, insurance status, photos, age of roof, access notes, urgency.",
    },
    timedPricing: {
      ...tradeFieldOverrides.timedPricing,
      placeholder: "Emergency tarping fees, storm-response windows, inspection availability, financing, and deposit rules.",
    },
    partyRules: {
      ...tradeFieldOverrides.partyRules,
      label: "Inspection rules",
      placeholder: "Repair inspections can be requested. Storm damage, insurance, commercial, and active leaks need staff review.",
    },
    waitlistPolicy: {
      ...tradeFieldOverrides.waitlistPolicy,
      placeholder: "Interior leaks and storm damage get urgent callback. Unsafe roof access should never be encouraged.",
    },
    reservationProvider: {
      ...tradeFieldOverrides.reservationProvider,
      options: ["JobNimbus", "AccuLynx", "Jobber", "Google Calendar", "Booking link", "Manual requests only"],
    },
  },
  salon_barber: {
    restaurantName: { label: "Studio name", prompt: "What studio name should the AI use?", placeholder: "Luna Studio" },
    concept: { label: "Services and vibe", prompt: "How would staff describe the salon, barbershop, or studio?", placeholder: "Modern salon and barbershop offering cuts, color, blowouts, beard trims, treatments, and bridal services." },
    menuUrl: { label: "Service menu link", placeholder: "https://lunastudio.example/services" },
    menuCategories: { label: "Services offered", prompt: "Which services should clients ask about or book?", placeholder: "Haircuts, barber cuts, beard trims, color, blowouts, treatments, waxing, bridal, packages." },
    modifiers: { label: "Service options", prompt: "Which details should the AI collect before booking or staff follow-up?", placeholder: "Provider preference, hair length, color history, beard service, add-ons, duration, first visit notes." },
    timedPricing: { label: "Timed pricing and promos", placeholder: "New-client facial promo weekdays. Bridal consultations require deposit." },
    drinkRules: { label: "Contraindications and product notes", placeholder: "Color patch tests, skin sensitivities, allergies, product lines, pregnancy-safe services, barber sanitation rules." },
    regularHours: { label: "Studio hours", prompt: "What are normal front-desk and appointment hours for each day?", placeholder: "Tue-Fri 10 AM-7 PM, Sat 9 AM-5 PM, Sun-Mon closed." },
    servicePeriods: { label: "Service windows", prompt: "When do cuts, color, barber services, bridal consultations, and walk-ins run?", placeholder: "Color Tue-Sat by appointment. Barber walk-ins Tue-Thu. Bridal consultations weekday mornings." },
    specialsSchedule: { label: "Promos and special services", prompt: "Which seasonal promos, bridal days, product launches, or recurring events should clients hear about?", placeholder: "New-client color consultation promo, bridal trials on Fridays, product education night first Thursday." },
    holidayExceptions: { label: "Holiday and event hours", prompt: "Which holidays, weddings, photo-shoot days, or blackout dates change hours or booking rules?", placeholder: "Closed major holidays. Prom season Saturdays require deposits. Bridal parties need staff confirmation." },
    orderingCutoffs: { label: "Same-day booking cutoff", prompt: "When should the AI stop offering same-day appointment requests or waitlist promises?", placeholder: "Same-day requests after 3 PM are staff-confirmed only. Color services need consultation first." },
    takeOrders: { label: "Capture client requests", prompt: "Should the AI capture appointment, product, and front-desk requests for follow-up?" },
    orderHandlingMode: { label: "What the AI should do", options: ["Create booking request for staff review", "Send booking link", "Take a message only", "Do not handle booking requests"] },
    onlineOrderingUrl: { label: "Booking or store link", prompt: "If clients can book or buy products online, what link should the AI send?", placeholder: "https://lunastudio.example/book" },
    defaultPickupEta: { label: "Default response ETA", prompt: "What follow-up estimate should the AI use when the front desk is not connected?", placeholder: "The front desk will follow up during business hours, usually within 30 minutes." },
    paymentPolicy: { label: "Payment, deposit, and checkout policy", prompt: "How should the AI explain deposits, cancellation fees, product purchases, gift cards, and payment?", placeholder: "Deposits for color and bridal services. Gift cards online. Payment is handled in studio or through booking link." },
    orderDestination: { label: "Request destination", prompt: "Where should new client requests go first?", options: ["Staff review queue", "Front desk queue", "Booking system", "Email or webhook"] },
    orderChangePolicy: { label: "Appointment changes and cancellations", prompt: "What should the AI do when a client wants to change, cancel, or check an appointment?", placeholder: "Collect name, appointment date/time, provider, requested change, and route to front desk before promising availability." },
    deliveryDriverPolicy: { label: "Client arrival instructions", prompt: "What should clients know about arrival, parking, late policy, guests, children, and accessibility?", placeholder: "Check in at front desk. Ten-minute grace period. Street parking nearby. Service animals only." },
    upsellRules: { label: "Helpful suggestions", prompt: "What should the AI mention naturally without sounding pushy?", placeholder: "Mention consultations before complex color and product pickup after retail questions. Do not upsell after a client declines." },
    takeReservations: { label: "Handle appointments", prompt: "Should the AI answer appointment questions or collect booking requests?" },
    reservationSourceToday: { label: "Current booking workflow", options: ["Boulevard", "Vagaro", "Square Appointments", "Mindbody", "Google Calendar", "Booking link", "Phone calls only"] },
    reservationHandlingMode: { label: "What the AI should do", options: genericSchedulingOptions },
    reservationProvider: { label: "Booking system", options: ["Boulevard", "Vagaro", "Square Appointments", "Mindbody", "Booking link", "Manual requests only"] },
    reservationBookingUrl: { label: "Booking link", placeholder: "https://lunastudio.example/book" },
    partyRules: { label: "Appointment rules", placeholder: "Color corrections, bridal parties, first-time color, and complex barber designs need staff confirmation." },
    depositPolicy: { label: "Deposits and cancellation fees", placeholder: "Color services and bridal appointments require deposits. 24-hour cancellation policy." },
    waitlistPolicy: { label: "Waitlist and same-day appointments", placeholder: "Same-day appointments can be requested but staff confirms availability." },
    parking: {
      label: "Parking and arrival",
      prompt: "What should clients know about parking, entrance, check-in, late arrival, and accessibility?",
      placeholder: "Street parking nearby. Check in at the front desk. 10-minute grace period. Accessible entrance on Main Street.",
    },
    allergyPolicy: {
      label: "Allergies and sensitivities",
      prompt: "How should the AI handle product allergies, skin sensitivities, patch tests, and contraindications?",
      placeholder: "Flag product allergies and skin sensitivities for staff. Color services may require patch test.",
    },
    deliveryPolicy: {
      label: "Products and retail",
      prompt: "What should the AI say about product purchases, gift cards, pickups, returns, or retail availability?",
      placeholder: "Gift cards available online. Retail product availability is confirmed by front desk before holding.",
    },
    lostAndFoundPolicy: {
      label: "Lost and found",
      prompt: "What should the AI collect when a client says they left something behind?",
      placeholder: "Collect item description, appointment date/time, stylist or barber, and callback number.",
    },
    hiringPolicy: {
      label: "Jobs and booth rental",
      prompt: "What should the AI say about stylist, barber, apprentice, front-desk, or booth-rental inquiries?",
      placeholder: "Collect name, license status, portfolio link, phone, email, and preferred role.",
    },
    donationPressPolicy: {
      label: "Partnerships and events",
      prompt: "What should happen when callers ask about bridal partnerships, local events, donations, or press?",
      placeholder: "Collect event date, organization, request, contact info, and route to the owner.",
    },
    feesAndRules: {
      label: "Studio rules",
      prompt: "Which cancellation, no-show, deposit, children, pets, guest, and accessibility rules should the AI know?",
      placeholder: "24-hour cancellation policy. Deposits for color and bridal. Service animals only. Children by appointment.",
    },
    customFaqs: {
      label: "Custom FAQs",
      prompt: "What questions does the front desk answer over and over?",
      placeholder: "Can I book with a specific stylist? How much is balayage? Do you take walk-ins? Do you sell gift cards?",
    },
    complaintsManagerPhone: {
      label: "Manager phone for client issues",
      prompt: "Who should get a text when a client is upset, reports a service issue, or needs manager review?",
    },
    complaintPolicy: {
      label: "Complaint and redo handling",
      prompt: "What should the AI say and collect for service complaints, redo requests, refunds, or bad experiences?",
      placeholder: "Apologize, collect name, service date, provider, concern, photos if relevant, and manager callback request.",
    },
    salesManagerEmail: {
      label: "Owner email for vendor calls",
      prompt: "Where should we email summaries of product reps, sales calls, and partnership requests?",
      placeholder: "owner@lunastudio.example",
    },
    vendorCallPolicy: {
      label: "Vendor and sales call handling",
      prompt: "What should the AI collect from product reps, educators, software reps, and sales callers?",
      placeholder: "Collect company, line carried, reason, contact name, phone, email, and route to owner.",
    },
    humanHandoffPolicy: {
      label: "Human callback rules",
      prompt: "When someone asks for a person, what should the AI promise and what details should it collect?",
      placeholder: "Offer a front-desk callback, collect name, phone, reason, urgency, and avoid promising immediate transfer.",
    },
    alertPreferenceRules: {
      placeholder:
        "Client complaints, redo requests, bridal inquiries, and color corrections text owner or manager. Product reps and vendors stay in the daily summary.",
    },
    ownerReportPreferences: {
      placeholder:
        "Daily report after close by email. Weekly report Monday morning with appointment requests, missed leads, reviews, and unanswered questions.",
    },
    unknownAnswerPolicy: {
      placeholder:
        "If not sure about pricing, stylist availability, color safety, or products, collect the client details and create a front-desk callback task.",
    },
    liveUpdateRules: {
      placeholder:
        "Provider out sick expires tonight. Running 20 minutes behind expires at close. Prom or bridal availability stays active until the event date.",
    },
    followUpPolicy: {
      placeholder:
        "Color consultation, bridal, and first-time client requests get follow-up reminders. Review requests require owner approval.",
    },
    callReviewPolicy: {
      placeholder:
        "Review first 20 calls, all complaints, product allergy questions, color corrections, and bridal inquiries. Owner and manager can hear recordings.",
    },
    opportunityScoringRules: {
      placeholder:
        "Bridal parties, color corrections, new color clients, and recurring appointment requests are high value. Vendor calls are low priority.",
    },
    smsConfirmations: {
      label: "Text follow-ups",
      prompt: "Should clients receive text confirmations for appointment requests, booking links, waitlist notes, or intake forms?",
    },
    mainPhone: { label: "Business main line", prompt: "Which number do clients call today?" },
    websiteUrl: { label: "Website URL", placeholder: "https://lunastudio.example" },
    websiteAdminContact: { label: "Website helper", placeholder: "frontdesk@lunastudio.example or web agency contact." },
    assignedSignalHostNumber: { prompt: "This is the number the studio forwards calls to." },
    firstTestCall: { placeholder: "Ask for a same-day haircut, ask about color pricing, then check dashboard." },
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
  "Realtime voice latency tuning across OpenAI, Twilio, transcription, and tool calls",
  "Supabase persistence, RLS, roles, audit logs, and admin workflows",
  "Staff-review queues for orders, reservations, appointments, quotes, and callbacks",
  "Link-first workflows for ordering, booking, quotes, intake forms, and menus",
  "Owner assistant, trusted contacts, permissions, and command routing",
  "Temporary live knowledge, business modes, learning loop, and owner-approved follow-up",
  "Optional industry integrations later for POS, booking, CRM, and dispatch systems",
  "SMS confirmations, staff alerts, low-confidence review, and human handoff",
  "Analytics, call QA, transcript review, and launch-readiness monitoring",
  "Compliance, security, secrets, observability, deployment, and support tooling",
] as const;

export const sampleOnboardingDraft: OnboardingDraft = {
  assignedSignalHostNumber: assignedDemoPhoneNumber,
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
  phoneLineType: "Landline or desk phone",
  phoneProvider: "Comcast Business",
  additionalTrustedContacts:
    "Alex Chen, general manager, +1 (415) 555-0171, alex@oliveandember.example, can receive urgent alerts, resolve tasks, and suggest knowledge. Permanent knowledge needs owner approval.",
  alertPreferenceRules:
    "Critical complaints, severe allergy questions, private events, and large-party requests text owner and manager immediately. Vendor calls and basic FAQs stay in the daily summary.",
  ownerReportPreferences:
    "Daily report by email at 8:30 PM. Weekly opportunity report Monday at 8 AM. Urgent items text owner and manager immediately.",
  unknownAnswerPolicy:
    "If SignalHost is not sure, it should say it will check with the team, collect name and callback number, create a task, and never guess. Staff answers can become knowledge suggestions.",
  knowledgeApprovalPolicy: "Owner approves permanent knowledge",
  liveUpdateRules:
    "Daily specials expire at closing. Closures expire after the stated date. Busy mode during Friday and Saturday dinner answers overflow but does not promise live wait times.",
  followUpPolicy:
    "Private event and catering requests get same-day follow-up reminders. Booking and ordering links get one polite check-in if the customer provided a phone number. Review requests require owner approval.",
  callReviewPolicy:
    "Review the first 20 calls, then all complaints, severe allergies, low-confidence answers, private events, and calls marked high value. Owner and manager can access transcripts and recordings.",
  opportunityScoringRules:
    "Private events, catering, large parties, and repeat guest issues are high value. Complaints are high risk. Vendor sales calls are low priority.",
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
  ownerEmail: "maria@oliveandember.example",
  ownerName: "Maria Lombardi",
  ownerPhone: "+1 (415) 555-0148",
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
  voiceProfileId: "vera",
  voiceGender: "Vera - warm female",
  waitlistPolicy: "Walk-ins are welcome, but live wait times change quickly and are confirmed at the door.",
  websiteAdminContact: "webmaster@oliveandember.example",
  websitePlatform: "Squarespace",
  websiteUrl: "https://oliveandember.example",
  offerComplaintCallback: true,
  customFaqs:
    "Do you have live music? Do you have patio seating? What are tonight's specials? Do you sell gift cards? Can I bring a cake? Do you have vegan options? Where should delivery drivers go?",
};

const tradeOwnerControlDraft: OnboardingDraft = {
  additionalTrustedContacts:
    "Jamie office manager, +1 (617) 555-0108, jamie@business.example, can receive urgent alerts, resolve tasks, and suggest knowledge. Permanent knowledge needs owner approval.",
  alertPreferenceRules:
    "Emergencies and safety issues text owner plus dispatcher immediately. Quote and replacement leads text sales. Vendor calls and routine FAQs stay in the daily summary.",
  ownerReportPreferences:
    "Daily report by email at 6 PM. Weekly pipeline report Monday at 8 AM. Urgent safety calls text owner and dispatcher immediately.",
  unknownAnswerPolicy:
    "If SignalHost is not sure, collect the customer name, phone, address, question, and urgency, then create a callback task instead of guessing.",
  knowledgeApprovalPolicy: "Owner approves permanent knowledge",
  liveUpdateRules:
    "Emergency mode can be enabled during storms, heat waves, or staffing shortages. Closed dates expire after the holiday. Booked-out notices expire on the date staff gives.",
  followUpPolicy:
    "Quote requests get owner reminder after 24 hours. Booking links get one polite follow-up. Review requests require owner approval.",
  callReviewPolicy:
    "Review the first 20 calls, then all emergencies, complaints, low-confidence answers, and high-value estimate requests. Owner and managers can review recordings.",
  opportunityScoringRules:
    "Emergency calls, replacements, estimates, maintenance plans, and commercial work are high value. Vendor calls and wrong numbers are low priority.",
};

const businessSampleDraftOverrides: Partial<Record<BusinessType, OnboardingDraft>> = {
  electrical: {
    ...tradeOwnerControlDraft,
    allergyPolicy: "Burning smell, sparking, partial power loss, exposed wiring, shocks, and panel concerns require urgent staff callback. Do not give DIY electrical advice.",
    complaintPolicy: "Apologize, collect name, address, callback number, job details, photos if useful, and route to the operations manager without promising refunds.",
    concept: businessTemplates.electrical.defaultOffering,
    defaultPickupEta: "A dispatcher will call back within 15 minutes during business hours for urgent issues.",
    deliveryDriverPolicy: "Technician calls before arrival. Customer should clear access to the panel or work area, secure pets, and share gate or parking notes.",
    deliveryPolicy: "Serving within 25 miles. Out-of-area, commercial, and permit-heavy jobs go to staff review.",
    drinkRules: "Licensed and insured. Permit-sensitive work, panel issues, burning smells, sparking, and unsafe conditions need licensed staff review.",
    feesAndRules: "Diagnostic fee due at visit. Emergency surcharge may apply after hours. Financing available for larger projects on approved credit.",
    firstTestCall: "Ask about a sparking outlet, request an EV charger estimate, ask about service area, then check dashboard.",
    holidayExceptions: "Closed major holidays except emergency callbacks for safety-sensitive issues.",
    menuCategories: "Outlet repairs, breaker issues, panel upgrades, EV chargers, lighting, generators, inspections, emergency electrical calls.",
    menuUrl: "https://brightwire.example/services",
    modifiers: "Symptom, breaker/panel notes, burning smell or sparking, property type, access, photos, preferred window, and callback number.",
    onlineOrderingUrl: "https://brightwire.example/request",
    orderHandlingMode: "Create service request for staff review",
    parking: "Serving Greater Boston within 25 miles. Office visits by appointment only.",
    partyRules: "Routine appointments can be requested. Burning smell, sparking, panel problems, commercial work, and permit-sensitive jobs need staff confirmation.",
    paymentPolicy: "Diagnostic fee due at visit. Exact pricing is confirmed by staff or technician. Deposits may apply for larger installs.",
    phoneLineType: "VoIP / phone system",
    phoneProvider: "Jobber Voice",
    primaryLocation: "Serving Greater Boston from Somerville, MA.",
    quoteRequestUrl: "https://brightwire.example/estimate",
    regularHours: "Mon-Fri 8 AM-6 PM, Sat 9 AM-2 PM, Sun emergency calls only.",
    reservationBookingUrl: "https://brightwire.example/book",
    reservationHandlingMode: "Create request for staff confirmation",
    reservationProvider: "Jobber",
    reservationSourceToday: "Jobber",
    restaurantName: businessTemplates.electrical.defaultName,
    servicePeriods: "Routine service Mon-Fri 9-5. Estimates Tue-Thu afternoons. Safety-sensitive issues are urgent callbacks.",
    specialsSchedule: "EV charger estimates and generator consultations are priority leads.",
    takeOrders: true,
    takeReservations: true,
    timedPricing: "Emergency surcharge after 6 PM and weekends. Larger projects may require deposit and staff-written estimate.",
    waitlistPolicy: "Burning smells, sparking, shocks, exposed wiring, and partial power loss get urgent callback.",
    websitePlatform: "WordPress",
    websiteUrl: "https://brightwire.example",
  },
  hvac: {
    ...tradeOwnerControlDraft,
    allergyPolicy: "Gas smell, carbon monoxide alarms, no heat in freezing weather, and no AC for vulnerable occupants require urgent staff callback.",
    complaintPolicy: "Apologize, collect name, address, callback number, visit details, technician if known, and route to manager review.",
    concept: businessTemplates.hvac.defaultOffering,
    defaultPickupEta: "Dispatch will call back within 15 minutes during business hours for urgent no-heat or no-AC calls.",
    deliveryDriverPolicy: "Technician calls before arrival. Customer should clear access to indoor and outdoor equipment, filters, thermostat, and pets.",
    deliveryPolicy: "Serving within 30 miles. Out-of-area requests and commercial jobs go to staff review.",
    drinkRules: "Licensed and insured. Do not provide DIY gas, combustion, or electrical instructions. Escalate safety concerns.",
    feesAndRules: "Diagnostic fee may apply. Maintenance members receive priority scheduling. Financing available for replacements.",
    firstTestCall: "Ask about no heat tonight, request a tune-up, ask about maintenance plans, then check dashboard.",
    holidayExceptions: "Closed major holidays except urgent no-heat/no-AC callbacks.",
    menuCategories: "No heat, no AC, tune-ups, filters, indoor air quality, mini-splits, system replacement, maintenance plans.",
    menuUrl: "https://summitair.example/services",
    modifiers: "System type, brand, age, thermostat status, indoor/outdoor unit notes, urgency, membership status, and preferred window.",
    onlineOrderingUrl: "https://summitair.example/request",
    orderHandlingMode: "Create request and also offer booking link",
    parking: "Serving MetroWest and Greater Boston. Office visits by appointment only.",
    partyRules: "Tune-ups can use booking link. No heat, no AC, replacement estimates, gas smell, and commercial calls need dispatch review.",
    paymentPolicy: "Diagnostic fee due at visit unless covered by membership. Replacement estimates are staff-confirmed. Financing available.",
    phoneLineType: "VoIP / phone system",
    phoneProvider: "ServiceTitan Phones",
    primaryLocation: "Serving Greater Boston and MetroWest from Waltham, MA.",
    quoteRequestUrl: "https://summitair.example/estimate",
    regularHours: "Mon-Fri 8 AM-6 PM, Sat 9 AM-2 PM, emergency callbacks after hours.",
    reservationBookingUrl: "https://summitair.example/book",
    reservationHandlingMode: "Send caller a booking link",
    reservationProvider: "ServiceTitan",
    reservationSourceToday: "ServiceTitan",
    restaurantName: businessTemplates.hvac.defaultName,
    servicePeriods: "Tune-ups Mon-Fri, estimates Tue-Thu, emergency response after hours during extreme weather.",
    specialsSchedule: "Spring AC tune-up promo, fall heating tune-up promo, maintenance plan priority.",
    takeOrders: true,
    takeReservations: true,
    timedPricing: "Emergency surcharge after 6 PM and weekends. Maintenance members get priority and discounted diagnostics.",
    waitlistPolicy: "No heat during freezing weather, no AC for vulnerable occupants, gas smell, and CO alarms require urgent escalation.",
    websitePlatform: "WordPress",
    websiteUrl: "https://summitair.example",
  },
  plumbing: {
    ...tradeOwnerControlDraft,
    allergyPolicy: "Active flooding, sewer backup, gas line concerns, no water, and unsafe conditions require urgent staff callback. Suggest shutting off water only if safe.",
    complaintPolicy: "Apologize, collect name, address, callback number, job date, technician if known, and route to manager review.",
    concept: businessTemplates.plumbing.defaultOffering,
    defaultPickupEta: "A dispatcher will call back within 15 minutes during business hours for urgent leaks.",
    deliveryDriverPolicy: "Technician calls before arrival. Customer should clear access, secure pets, and know shutoff location if possible.",
    deliveryPolicy: "Serving within 25 miles. Out-of-area and commercial requests go to staff review.",
    drinkRules: "Licensed and insured. Do not give unsafe plumbing, gas, or sewer instructions. Escalate active flooding and gas concerns.",
    feesAndRules: "Diagnostic fee may apply. Emergency surcharge after hours. Written estimates for larger repairs and replacements.",
    firstTestCall: "Report water through a ceiling, ask about water heater replacement, ask service-area questions, then check dashboard.",
    holidayExceptions: "Closed major holidays except emergency leak and sewer callbacks.",
    menuCategories: "Leak repair, drain clearing, toilets, water heaters, faucets, sump pumps, sewer backups, emergency service.",
    menuUrl: "https://harborplumbing.example/services",
    modifiers: "Leak location, active flow, shutoff status, fixture type, property type, photos, access notes, and urgency.",
    onlineOrderingUrl: "https://harborplumbing.example/request",
    orderHandlingMode: "Create service request for staff review",
    parking: "Serving Greater Boston within 25 miles. Office visits by appointment only.",
    partyRules: "Routine repairs can be requested. Active flooding, sewer backups, gas line concerns, remodels, and commercial jobs need staff review.",
    paymentPolicy: "Diagnostic fee due at visit. Exact pricing is confirmed by staff or technician. Larger work may need written estimate.",
    phoneLineType: "Mobile phone",
    phoneProvider: "Verizon",
    primaryLocation: "Serving Greater Boston from Somerville, MA.",
    quoteRequestUrl: "https://harborplumbing.example/quote",
    regularHours: "Mon-Fri 8 AM-6 PM, Sat 9 AM-2 PM, emergency callbacks after hours.",
    reservationBookingUrl: "https://harborplumbing.example/book",
    reservationHandlingMode: "Create request for staff confirmation",
    reservationProvider: "Housecall Pro",
    reservationSourceToday: "Housecall Pro",
    restaurantName: businessTemplates.plumbing.defaultName,
    servicePeriods: "Routine appointments Mon-Fri. Emergency leak callbacks after hours. Estimates Tue-Thu afternoons.",
    specialsSchedule: "Water heater replacement estimates and sump pump checks are priority seasonal requests.",
    takeOrders: true,
    takeReservations: true,
    timedPricing: "Emergency surcharge after 6 PM and weekends. Free planned-install estimates within service area.",
    waitlistPolicy: "Active leaks, flooding, sewer backups, gas line concerns, and no water get urgent callback.",
    websitePlatform: "Wix",
    websiteUrl: "https://harborplumbing.example",
  },
  roofing: {
    ...tradeOwnerControlDraft,
    allergyPolicy: "Active interior leaks, ceiling bulges, unsafe roof access, storm damage, and emergency tarping requests require urgent staff callback.",
    complaintPolicy: "Apologize, collect name, property address, callback number, project details, photos if relevant, and route to manager review.",
    concept: businessTemplates.roofing.defaultOffering,
    defaultPickupEta: "The office will call back during business hours, with active leaks prioritized.",
    deliveryDriverPolicy: "Crew arrival depends on weather. Customer should provide access notes, gate codes, parking, roof photos, and interior leak location.",
    deliveryPolicy: "Serving residential and light commercial properties within 35 miles. Out-of-area jobs go to staff review.",
    drinkRules: "Licensed and insured. Do not encourage callers to climb roofs. Active leaks and unsafe conditions need staff review.",
    feesAndRules: "Inspection fees may apply by distance. Financing available for replacements. Warranty questions go to staff review.",
    firstTestCall: "Report storm damage and an active leak, request an inspection, ask about insurance, then check dashboard.",
    holidayExceptions: "Storm-response queues may override normal availability. Closed major holidays except urgent leak callbacks.",
    menuCategories: "Roof repair, replacement, storm damage, inspections, gutters, skylights, emergency tarping, commercial roofing.",
    menuUrl: "https://ridgelineroofing.example/services",
    modifiers: "Roof type, storm date, leak location, interior damage, insurance status, photos, access notes, and urgency.",
    onlineOrderingUrl: "https://ridgelineroofing.example/request",
    orderHandlingMode: "Create service request for staff review",
    parking: "Serving the North Shore and Greater Boston. Office visits by appointment only.",
    partyRules: "Repair inspections can be requested. Storm damage, insurance claims, commercial work, and active leaks need staff review.",
    paymentPolicy: "Inspection and estimate terms depend on project type. Deposits may apply after written proposal.",
    phoneLineType: "VoIP / phone system",
    phoneProvider: "RingCentral",
    primaryLocation: "Serving the North Shore and Greater Boston from Peabody, MA.",
    quoteRequestUrl: "https://ridgelineroofing.example/estimate",
    regularHours: "Mon-Fri 8 AM-5 PM, Sat by appointment, urgent storm callbacks after major weather.",
    reservationBookingUrl: "https://ridgelineroofing.example/inspection",
    reservationHandlingMode: "Create request for staff confirmation",
    reservationProvider: "JobNimbus",
    reservationSourceToday: "JobNimbus",
    restaurantName: businessTemplates.roofing.defaultName,
    servicePeriods: "Inspections Mon-Fri, storm follow-ups prioritized after weather events, commercial estimates by staff review.",
    specialsSchedule: "Spring roof inspections, gutter checks, storm-response priority after major weather.",
    takeOrders: true,
    takeReservations: true,
    timedPricing: "Emergency tarping and storm response may have separate fees. Financing available for replacements.",
    waitlistPolicy: "Active interior leaks and storm damage get urgent callback. Never advise a caller to climb onto the roof.",
    websitePlatform: "Webflow",
    websiteUrl: "https://ridgelineroofing.example",
  },
  salon_barber: {
    additionalTrustedContacts:
      "Avery front desk lead, +1 (617) 555-0115, avery@lunastudio.example, can receive client issue alerts, resolve tasks, and suggest knowledge. Permanent knowledge needs owner approval.",
    alertPreferenceRules:
      "Complaints, redo requests, bridal inquiries, and color corrections text owner or manager. Product reps and vendor calls stay in the daily summary.",
    ownerReportPreferences:
      "Daily report after close by email. Weekly report Monday morning with appointment requests, missed leads, reviews, and unanswered questions.",
    unknownAnswerPolicy:
      "If SignalHost is not sure about pricing, stylist availability, color safety, or products, collect client details and create a front-desk callback task.",
    knowledgeApprovalPolicy: "Owner approves permanent knowledge",
    liveUpdateRules:
      "Provider out sick expires tonight. Running 20 minutes behind expires at close. Prom or bridal availability stays active until the event date.",
    followUpPolicy:
      "Color consultation, bridal, and first-time client requests get follow-up reminders. Review requests require owner approval.",
    callReviewPolicy:
      "Review the first 20 calls, all complaints, product allergy questions, color corrections, and bridal inquiries. Owner and manager can hear recordings.",
    opportunityScoringRules:
      "Bridal parties, color corrections, new color clients, and recurring appointment requests are high value. Vendor calls are low priority.",
    allergyPolicy: "Product allergies, skin sensitivities, scalp irritation, pregnancy-sensitive services, and color reactions require staff review.",
    complaintPolicy: "Apologize, collect name, service date, provider, concern, photos if relevant, and route to manager review.",
    concept: businessTemplates.salon_barber.defaultOffering,
    defaultPickupEta: "The front desk will follow up during business hours, usually within 30 minutes.",
    deliveryDriverPolicy: "Clients should check in at the front desk. Ten-minute grace period. Street parking nearby. Service animals only.",
    deliveryPolicy: "Gift cards are available online. Product availability is confirmed by the front desk before holding items.",
    drinkRules: "Color services may require consultation or patch test. Product allergies and skin sensitivities should be flagged for staff.",
    feesAndRules: "Deposits for bridal and major color services. 24-hour cancellation policy. Children by appointment.",
    firstTestCall: "Ask for a same-day haircut, ask about balayage pricing, request a specific stylist, then check dashboard.",
    holidayExceptions: "Closed major holidays. Prom, wedding, and bridal-party dates may require deposits and staff confirmation.",
    menuCategories: "Haircuts, barber cuts, beard trims, color, balayage, blowouts, treatments, waxing, bridal, packages.",
    menuUrl: "https://lunastudio.example/services",
    modifiers: "Provider preference, hair length, color history, desired service, first visit notes, preferred day/time, and phone number.",
    onlineOrderingUrl: "https://lunastudio.example/book",
    orderHandlingMode: "Create booking request for staff review",
    parking: "Street parking nearby. Accessible entrance on Main Street. Check in at the front desk.",
    partyRules: "Simple haircuts can use booking link. Color corrections, bridal parties, first-time color, and complex designs need staff confirmation.",
    paymentPolicy: "Deposits may apply for color and bridal. Payment is handled in studio or through the booking link.",
    phoneLineType: "Landline or desk phone",
    phoneProvider: "Comcast Business",
    primaryLocation: "214 Main Street, Boston, MA 02116",
    regularHours: "Tue-Fri 10 AM-7 PM, Sat 9 AM-5 PM, Sun-Mon closed.",
    reservationBookingUrl: "https://lunastudio.example/book",
    reservationHandlingMode: "Send caller a booking link",
    reservationProvider: "Vagaro",
    reservationSourceToday: "Vagaro",
    restaurantName: businessTemplates.salon_barber.defaultName,
    servicePeriods: "Cuts Tue-Sat. Color by appointment. Bridal consultations weekday mornings. Barber walk-ins Tue-Thu.",
    specialsSchedule: "New-client consultation promo, bridal trials on Fridays, product education first Thursday.",
    takeOrders: true,
    takeReservations: true,
    timedPricing: "Starting prices vary by provider, length, and service complexity. Color and bridal may require deposits.",
    waitlistPolicy: "Same-day appointments can be requested but staff confirms availability.",
    websiteAdminContact: "frontdesk@lunastudio.example",
    websitePlatform: "Squarespace",
    websiteUrl: "https://lunastudio.example",
  },
};

export function createOnboardingDraftForBusiness(
  value: BusinessType | string | undefined,
  overrides: OnboardingDraft = {},
): OnboardingDraft {
  const businessType = normalizeBusinessType(value);
  const template = getBusinessTemplate(businessType);

  return {
    ...sampleOnboardingDraft,
    ...(businessSampleDraftOverrides[businessType] ?? {}),
    businessType,
    concept: template.defaultOffering,
    restaurantName: template.defaultName,
    ...overrides,
  };
}

export function calculateOnboardingProgress(
  draft: OnboardingDraft,
  sections: OnboardingSection[] = onboardingSections,
) {
  const requiredFields = sections.flatMap((section) => section.fields.filter((field) => field.required));
  const completedRequired = requiredFields.filter((field) => hasCompletedFieldValue(field.id, draft[field.id])).length;
  const missingBySection = sections.map((section) => ({
    id: section.id,
    missing: section.fields
      .filter((field) => field.required && !hasCompletedFieldValue(field.id, draft[field.id]))
      .map((field) => field.label),
  }));

  return {
    completedRequired,
    missingBySection,
    percent: requiredFields.length ? Math.round((completedRequired / requiredFields.length) * 100) : 100,
    totalRequired: requiredFields.length,
  };
}

function hasCompletedFieldValue(fieldId: string, value: OnboardingDraftValue) {
  if ((fieldId === "assignedSignalHostNumber" || fieldId === "assignedHostLineNumber") && value === assignedDemoPhoneNumber) {
    return false;
  }
  return hasDraftValue(value);
}

function hasDraftValue(value: OnboardingDraftValue) {
  if (typeof value === "boolean") return true;
  return typeof value === "string" && value.trim().length > 0;
}
