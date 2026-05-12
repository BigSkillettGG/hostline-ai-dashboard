// Mock data for HostLine AI — restaurant: "Olive & Ember"

export type CallIntent = "order" | "reservation" | "faq" | "hours" | "complaint" | "sales" | "other";
export type CallOutcome = "resolved" | "order_placed" | "reservation_booked" | "escalated" | "manager_alerted" | "message_taken" | "voicemail" | "missed" | "unknown";
export type CallStatus = "new" | "reviewed" | "needs_review" | "resolved";
export type TranscriptSpeaker = "agent" | "caller" | "staff";

export type EscalationType = "complaint" | "sales";
export type EscalationSeverity = "low" | "medium" | "high";
export type EscalationStatus = "pending_callback" | "callback_made" | "closed";
export type AlertChannel = "sms" | "email";

export interface CallEscalation {
  type: EscalationType;
  severity?: EscalationSeverity;
  summary: string;
  alertedAt: string;
  alertedTo: string[];
  channels: AlertChannel[];
  status: EscalationStatus;
  callerCallback?: boolean;
}

export interface Call {
  id: string;
  caller: string;
  phone: string;
  time: string; // ISO
  duration: number; // seconds
  intent: CallIntent;
  outcome: CallOutcome;
  confidence: number; // 0-100
  status: CallStatus;
  summary: string;
  transcript: { speaker: TranscriptSpeaker; text: string; t: string }[];
  recordingUrl?: string;
  orderId?: string;
  reservationId?: string;
  escalation?: CallEscalation;
}

export type OrderStatus = "new" | "accepted" | "in_progress" | "completed" | "canceled";
export type OrderDeliveryDestination = "staff_review" | "kitchen_tablet" | "printer" | "pos" | string;
export type OrderDeliveryStatus = "pending" | "sent" | "failed" | "not_configured";
export interface OrderItem {
  name: string;
  qty: number;
  price: number;
  modifiers?: string[];
  notes?: string;
}
export interface OrderDeliveryAttempt {
  id: string;
  destination: OrderDeliveryDestination;
  status: OrderDeliveryStatus;
  createdAt?: string;
  deliveredAt?: string;
  errorMessage?: string;
}
export interface Order {
  id: string;
  customer: string;
  phone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  etaMinutes: number;
  payAtPickup: boolean;
  createdAt: string;
  deliveryAttempts?: OrderDeliveryAttempt[];
  destination?: OrderDeliveryDestination;
  sourceCallId?: string;
  notes?: string;
}

export type ReservationStatus = "pending" | "confirmed" | "declined" | "seated" | "canceled";
export interface Reservation {
  id: string;
  guest: string;
  phone: string;
  partySize: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes?: string;
  status: ReservationStatus;
  source: "ai_host" | "web" | "walk_in";
  sourceCallId?: string;
  manual?: boolean;
  provider?: string;
  providerReservationId?: string;
  createdAt?: string;
}

export const restaurant = {
  name: "Olive & Ember",
  cuisine: "Italian · Wood-fired",
  timezone: "America/Los_Angeles",
  phone: "+1 (415) 555-0148",
  aiHostNumber: "+1 (415) 555-0199",
  address: "182 Valencia St, San Francisco, CA",
  hours: {
    Mon: "Closed",
    Tue: "5:00 PM – 10:00 PM",
    Wed: "5:00 PM – 10:00 PM",
    Thu: "5:00 PM – 10:00 PM",
    Fri: "5:00 PM – 11:00 PM",
    Sat: "12:00 PM – 11:00 PM",
    Sun: "12:00 PM – 9:00 PM",
  },
};

const now = new Date();
const iso = (mAgo: number) => new Date(now.getTime() - mAgo * 60_000).toISOString();

export const calls: Call[] = [
  {
    id: "c_001", caller: "Sarah Chen", phone: "+1 (415) 555-0142",
    time: iso(8), duration: 142, intent: "order", outcome: "order_placed",
    confidence: 96, status: "resolved",
    summary: "Pickup order for 2 pizzas and a salad. ETA 25 minutes. Pay at pickup.",
    transcript: [
      { speaker: "agent", t: "00:00", text: "Hi, thank you for calling Olive & Ember. How can I help you?" },
      { speaker: "caller", t: "00:04", text: "Hi, I'd like to place a pickup order." },
      { speaker: "agent", t: "00:07", text: "Of course. What would you like to order?" },
      { speaker: "caller", t: "00:11", text: "A Margherita, a Diavola, and a Caesar salad." },
      { speaker: "agent", t: "00:18", text: "Got it. Any modifications?" },
      { speaker: "caller", t: "00:22", text: "Light cheese on the Margherita please." },
      { speaker: "agent", t: "00:25", text: "Perfect. Your order will be ready in about 25 minutes. Pay at pickup. What name is this for?" },
    ],
    orderId: "o_001",
  },
  {
    id: "c_002", caller: "Marcus Webb", phone: "+1 (510) 555-0177",
    time: iso(22), duration: 88, intent: "reservation", outcome: "reservation_booked",
    confidence: 92, status: "reviewed",
    summary: "Reservation for 4 on Friday 7:30 PM. Birthday — requested quiet table.",
    transcript: [
      { speaker: "agent", t: "00:00", text: "Hi, thank you for calling Olive & Ember. How can I help you?" },
      { speaker: "caller", t: "00:03", text: "I'd like to book a table for four on Friday." },
      { speaker: "agent", t: "00:07", text: "Great — what time works?" },
      { speaker: "caller", t: "00:10", text: "7:30 if possible. It's a birthday so somewhere quieter." },
    ],
    reservationId: "r_002",
  },
  {
    id: "c_003", caller: "Unknown", phone: "+1 (628) 555-0103",
    time: iso(45), duration: 36, intent: "faq", outcome: "resolved",
    confidence: 88, status: "reviewed",
    summary: "Caller asked about gluten-free pizza options.",
    transcript: [
      { speaker: "caller", t: "00:00", text: "Do you have gluten-free crust?" },
      { speaker: "agent", t: "00:02", text: "Yes — we offer a gluten-free crust on any pizza for $4 extra." },
    ],
  },
  {
    id: "c_004", caller: "Priya Patel", phone: "+1 (415) 555-0188",
    time: iso(70), duration: 210, intent: "order", outcome: "escalated",
    confidence: 62, status: "needs_review",
    summary: "Large catering inquiry for 30 people — escalated to manager.",
    transcript: [
      { speaker: "caller", t: "00:00", text: "I'd like to ask about catering for 30 guests." },
      { speaker: "agent", t: "00:04", text: "Catering for groups over 20 needs a manager. Let me text you back to confirm." },
    ],
  },
  {
    id: "c_005", caller: "Unknown", phone: "+1 (415) 555-0121",
    time: iso(95), duration: 12, intent: "hours", outcome: "resolved",
    confidence: 99, status: "resolved",
    summary: "Caller asked for tonight's hours. Answered: open until 10 PM.",
    transcript: [
      { speaker: "caller", t: "00:00", text: "What time do you close tonight?" },
      { speaker: "agent", t: "00:02", text: "We're open until 10 PM tonight." },
    ],
  },
  {
    id: "c_006", caller: "James O'Brien", phone: "+1 (415) 555-0166",
    time: iso(140), duration: 175, intent: "order", outcome: "order_placed",
    confidence: 94, status: "reviewed",
    summary: "Pickup order: pasta, tiramisu. Pay at pickup.",
    transcript: [], orderId: "o_002",
  },
  {
    id: "c_007", caller: "Unknown", phone: "+1 (415) 555-0144",
    time: iso(180), duration: 0, intent: "other", outcome: "missed",
    confidence: 0, status: "needs_review",
    summary: "Missed — caller hung up before agent answered.",
    transcript: [],
  },
  {
    id: "c_008", caller: "Lena Park", phone: "+1 (650) 555-0190",
    time: iso(220), duration: 156, intent: "reservation", outcome: "reservation_booked",
    confidence: 91, status: "reviewed",
    summary: "Reservation for 2, Sunday 6 PM.",
    transcript: [], reservationId: "r_001",
  },
  {
    id: "c_009", caller: "Diego Alvarez", phone: "+1 (415) 555-0155",
    time: iso(290), duration: 64, intent: "faq", outcome: "resolved",
    confidence: 90, status: "reviewed",
    summary: "Asked about parking. Confirmed street parking + paid lot at 17th & Valencia.",
    transcript: [],
  },
  {
    id: "c_010", caller: "Unknown", phone: "+1 (415) 555-0133",
    time: iso(360), duration: 0, intent: "other", outcome: "missed",
    confidence: 0, status: "needs_review",
    summary: "Missed call — no voicemail.",
    transcript: [],
  },
  {
    id: "c_011", caller: "Rachel Nguyen", phone: "+1 (415) 555-0177",
    time: iso(15), duration: 198, intent: "complaint", outcome: "manager_alerted",
    confidence: 84, status: "needs_review",
    summary: "Order arrived with wrong pizza and cold pasta. Caller upset; AI offered manager callback.",
    transcript: [
      { speaker: "caller", t: "00:00", text: "I'm really frustrated — my order was completely wrong and the pasta was cold." },
      { speaker: "agent", t: "00:05", text: "I'm so sorry to hear that. I'll let the manager know right away and they'll call you back shortly. Could you share what happened so I can pass it along?" },
      { speaker: "caller", t: "00:14", text: "I ordered a Margherita and got a Diavola, and the carbonara was cold by the time it arrived." },
      { speaker: "agent", t: "00:22", text: "Got it. The manager will reach out within the next few minutes. Thank you for letting us know." },
    ],
    escalation: {
      type: "complaint",
      severity: "high",
      summary: "Wrong pizza delivered (Diavola instead of Margherita) and pasta arrived cold. Order #o_001-ish. Caller wants a callback.",
      alertedAt: iso(14),
      alertedTo: ["Maria Lombardi (+1 415-555-0148)"],
      channels: ["sms"],
      status: "pending_callback",
      callerCallback: true,
    },
  },
  {
    id: "c_012", caller: "Acme Restaurant Supply", phone: "+1 (800) 555-0123",
    time: iso(55), duration: 92, intent: "sales", outcome: "message_taken",
    confidence: 90, status: "needs_review",
    summary: "Vendor sales call about restaurant equipment financing. Message taken for owner.",
    transcript: [
      { speaker: "caller", t: "00:00", text: "Hi, I'd like to speak to the manager about equipment financing programs." },
      { speaker: "agent", t: "00:04", text: "Happy to help. May I ask if this is a sales or vendor inquiry, or something else?" },
      { speaker: "caller", t: "00:08", text: "Yes, it's a sales call." },
      { speaker: "agent", t: "00:11", text: "Thanks. The manager isn't available to take sales calls live — I can take a message and email it over. What's the best way to reach you?" },
    ],
    escalation: {
      type: "sales",
      summary: "Acme Restaurant Supply offering equipment financing. Wants callback on +1 800-555-0123. Not urgent.",
      alertedAt: iso(54),
      alertedTo: ["owner@oliveandember.com"],
      channels: ["email"],
      status: "pending_callback",
    },
  },
  {
    id: "c_013", caller: "David Kim", phone: "+1 (415) 555-0118",
    time: iso(180), duration: 240, intent: "complaint", outcome: "manager_alerted",
    confidence: 88, status: "resolved",
    summary: "Birthday reservation seated 40 min late. Manager called back, comped dessert.",
    transcript: [],
    escalation: {
      type: "complaint",
      severity: "medium",
      summary: "Party of 6 birthday seated 40 minutes late on Saturday. Wants acknowledgment and a comp.",
      alertedAt: iso(178),
      alertedTo: ["Maria Lombardi (+1 415-555-0148)"],
      channels: ["sms", "email"],
      status: "callback_made",
      callerCallback: true,
    },
  },
  ...Array.from({ length: 30 }, (_, i) => ({
    id: `c_${100 + i}`,
    caller: ["Unknown", "Mike R.", "Anna L.", "Jordan K.", "Sam P."][i % 5],
    phone: `+1 (415) 555-0${200 + i}`,
    time: iso(420 + i * 27),
    duration: [40, 80, 120, 60, 200][i % 5],
    intent: (["faq", "order", "reservation", "hours", "other"] as CallIntent[])[i % 5],
    outcome: (["resolved", "order_placed", "reservation_booked", "resolved", "voicemail"] as CallOutcome[])[i % 5],
    confidence: 70 + (i * 7) % 30,
    status: (["resolved", "reviewed", "needs_review"] as CallStatus[])[i % 3],
    summary: "Sample interaction handled by AI host.",
    transcript: [],
  })),
];

export const orders: Order[] = [
  {
    id: "o_001", customer: "Sarah Chen", phone: "+1 (415) 555-0142",
    items: [
      { name: "Margherita Pizza", qty: 1, price: 18, modifiers: ["Light cheese"] },
      { name: "Diavola Pizza", qty: 1, price: 21 },
      { name: "Caesar Salad", qty: 1, price: 14 },
    ],
    total: 53, status: "new", etaMinutes: 25, payAtPickup: true,
    createdAt: iso(8),
    deliveryAttempts: [
      { id: "od_001", destination: "staff_review", status: "sent", createdAt: iso(8), deliveredAt: iso(8) },
    ],
    destination: "staff_review",
    sourceCallId: "c_001",
  },
  {
    id: "o_002", customer: "James O'Brien", phone: "+1 (415) 555-0166",
    items: [
      { name: "Cacio e Pepe", qty: 2, price: 22 },
      { name: "Tiramisu", qty: 1, price: 11 },
    ],
    total: 55, status: "accepted", etaMinutes: 18, payAtPickup: true,
    createdAt: iso(140),
    deliveryAttempts: [
      { id: "od_002", destination: "staff_review", status: "sent", createdAt: iso(140), deliveredAt: iso(140) },
      { id: "od_003", destination: "printer", status: "sent", createdAt: iso(138), deliveredAt: iso(138) },
    ],
    destination: "printer",
    sourceCallId: "c_006",
  },
  {
    id: "o_003", customer: "Hana Liu", phone: "+1 (415) 555-0112",
    items: [
      { name: "Funghi Pizza", qty: 1, price: 22, modifiers: ["Add truffle oil (+$3)"] },
      { name: "Burrata", qty: 1, price: 16 },
    ],
    total: 41, status: "in_progress", etaMinutes: 8, payAtPickup: false,
    createdAt: iso(45),
  },
  {
    id: "o_004", customer: "Tom Reyes", phone: "+1 (415) 555-0119",
    items: [{ name: "Lasagna", qty: 1, price: 24 }],
    total: 24, status: "completed", etaMinutes: 0, payAtPickup: true,
    createdAt: iso(180),
  },
  {
    id: "o_005", customer: "Aisha Khan", phone: "+1 (415) 555-0125",
    items: [{ name: "Margherita Pizza", qty: 2, price: 18 }],
    total: 36, status: "completed", etaMinutes: 0, payAtPickup: false,
    createdAt: iso(240),
  },
  {
    id: "o_006", customer: "Ethan Wood", phone: "+1 (415) 555-0148",
    items: [{ name: "Spaghetti Bolognese", qty: 1, price: 22 }],
    total: 22, status: "canceled", etaMinutes: 0, payAtPickup: true,
    createdAt: iso(320), notes: "Customer canceled — wrong location.",
  },
  {
    id: "o_007", customer: "Maya Singh", phone: "+1 (415) 555-0173",
    items: [
      { name: "Diavola Pizza", qty: 1, price: 21 },
      { name: "House Red (glass)", qty: 2, price: 12 },
    ],
    total: 45, status: "new", etaMinutes: 30, payAtPickup: true,
    createdAt: iso(3),
  },
  {
    id: "o_008", customer: "Owen Davis", phone: "+1 (415) 555-0181",
    items: [{ name: "Caesar Salad", qty: 1, price: 14 }, { name: "Tiramisu", qty: 1, price: 11 }],
    total: 25, status: "accepted", etaMinutes: 15, payAtPickup: true,
    createdAt: iso(60),
  },
];

export const reservations: Reservation[] = [
  { id: "r_001", guest: "Lena Park", phone: "+1 (650) 555-0190", partySize: 2, date: "2026-05-04", time: "18:00", status: "confirmed", source: "ai_host", sourceCallId: "c_008" },
  { id: "r_002", guest: "Marcus Webb", phone: "+1 (510) 555-0177", partySize: 4, date: "2026-05-08", time: "19:30", notes: "Birthday — quiet table requested.", status: "confirmed", source: "ai_host", sourceCallId: "c_002" },
  { id: "r_003", guest: "Nina Rossi", phone: "+1 (415) 555-0102", partySize: 6, date: "2026-05-09", time: "20:00", notes: "Anniversary.", status: "pending", source: "ai_host", manual: true },
  { id: "r_004", guest: "Carlos M.", phone: "+1 (415) 555-0193", partySize: 3, date: "2026-05-05", time: "19:00", status: "confirmed", source: "web" },
  { id: "r_005", guest: "Riya Shah", phone: "+1 (415) 555-0118", partySize: 8, date: "2026-05-10", time: "18:30", notes: "Large party — requires confirmation.", status: "pending", source: "ai_host", manual: true },
  { id: "r_006", guest: "Tom Becker", phone: "+1 (415) 555-0141", partySize: 2, date: "2026-05-04", time: "20:30", status: "seated", source: "walk_in" },
  { id: "r_007", guest: "Eva Müller", phone: "+1 (415) 555-0156", partySize: 4, date: "2026-05-06", time: "19:00", status: "confirmed", source: "ai_host" },
  { id: "r_008", guest: "Henry Liu", phone: "+1 (415) 555-0163", partySize: 5, date: "2026-05-11", time: "19:30", notes: "Vegetarian options needed.", status: "pending", source: "ai_host", manual: true },
];

export interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  prepMinutes: number;
  available: boolean;
  modifiers?: string[];
  upsell?: string[];
}

export const menuCategories: { id: string; name: string; items: MenuItem[] }[] = [
  {
    id: "starters", name: "Starters",
    items: [
      { id: "m1", name: "Burrata", description: "Stracciatella, heirloom tomato, basil, olive oil", price: 16, prepMinutes: 6, available: true, upsell: ["Add prosciutto +$5"] },
      { id: "m2", name: "Caesar Salad", description: "Little gem, anchovy, parmesan, focaccia croutons", price: 14, prepMinutes: 5, available: true, modifiers: ["No anchovy", "Add chicken +$6"] },
      { id: "m3", name: "Meatballs", description: "Pork and beef, San Marzano sugo", price: 13, prepMinutes: 8, available: true },
    ],
  },
  {
    id: "pizza", name: "Wood-fired Pizza",
    items: [
      { id: "m4", name: "Margherita", description: "Tomato, fior di latte, basil", price: 18, prepMinutes: 10, available: true, modifiers: ["Light cheese", "Gluten-free crust +$4"], upsell: ["Add truffle oil +$3"] },
      { id: "m5", name: "Diavola", description: "Spicy salami, chili, mozzarella", price: 21, prepMinutes: 11, available: true },
      { id: "m6", name: "Funghi", description: "Mushroom medley, fontina, thyme", price: 22, prepMinutes: 11, available: true, upsell: ["Add truffle oil +$3"] },
      { id: "m7", name: "Quattro Formaggi", description: "Mozzarella, gorgonzola, fontina, parmesan", price: 23, prepMinutes: 11, available: false },
    ],
  },
  {
    id: "pasta", name: "Pasta",
    items: [
      { id: "m8", name: "Cacio e Pepe", description: "Tonnarelli, pecorino, black pepper", price: 22, prepMinutes: 9, available: true },
      { id: "m9", name: "Spaghetti Bolognese", description: "Slow-braised beef and pork ragù", price: 22, prepMinutes: 10, available: true },
      { id: "m10", name: "Lasagna", description: "Layered with béchamel and ragù", price: 24, prepMinutes: 12, available: true },
    ],
  },
  {
    id: "drinks", name: "Drinks",
    items: [
      { id: "m11", name: "House Red (glass)", price: 12, prepMinutes: 1, available: true },
      { id: "m12", name: "House White (glass)", price: 12, prepMinutes: 1, available: true },
      { id: "m13", name: "Sparkling Water", price: 5, prepMinutes: 1, available: true },
    ],
  },
  {
    id: "dessert", name: "Dessert",
    items: [
      { id: "m14", name: "Tiramisu", description: "Classic, made in-house", price: 11, prepMinutes: 3, available: true },
      { id: "m15", name: "Affogato", description: "Vanilla gelato, espresso", price: 9, prepMinutes: 3, available: true },
    ],
  },
];

export const knowledgeSections = [
  { id: "hours", title: "Hours", body: "Tue-Thu 5-10 PM. Fri 5-11 PM. Sat 12-11 PM. Sun 12-9 PM. Closed Mon.", uses: 142 },
  { id: "location", title: "Location", body: "182 Valencia St, San Francisco, CA 94103.", uses: 88 },
  { id: "parking", title: "Parking", body: "Metered street parking on Valencia. Paid lot at 17th and Valencia. 16th Street BART is about a 10-minute walk.", uses: 41 },
  { id: "specials", title: "Tonight's specials", body: "Roasted branzino with lemon-caper butter, burrata with stone fruit and basil, and mushroom risotto. Specials can sell out.", uses: 73 },
  { id: "music", title: "Live music", body: "Live jazz Thursdays 7-9 PM. Acoustic guitar Sundays 5-7 PM. Music is complimentary and seating near performers is not guaranteed.", uses: 29 },
  { id: "happy-hour", title: "Happy hour", body: "Tue-Fri 4-6 PM at the bar and patio: $9 spritzes, $8 house wine, $6 beer, and $10 margherita pizzettes.", uses: 54 },
  { id: "brunch", title: "Weekend brunch", body: "Sat-Sun noon-2 PM with lemon ricotta pancakes, breakfast pizza, smoked salmon toast, mimosas, and espresso drinks.", uses: 37 },
  { id: "pickup", title: "Pickup policy", body: "Pickup orders are pay-at-pickup. Typical wait 20-30 minutes during peak. Kitchen stops pickup orders 30 minutes before close.", uses: 67 },
  { id: "delivery", title: "Delivery policy", body: "We do not offer direct delivery. Available via DoorDash and Uber Eats.", uses: 33 },
  { id: "drivers", title: "Delivery drivers", body: "Drivers check the pickup shelf near the host stand with the guest name and app name. Staff will help if the order is not ready.", uses: 24 },
  { id: "allergy", title: "Allergy policy", body: "We accommodate gluten-free and dairy-free where possible. Cross-contact is possible, so severe allergies require staff confirmation.", uses: 22 },
  { id: "large", title: "Large parties", body: "Parties of 8+ require manager confirmation; 20% gratuity added.", uses: 18 },
  { id: "private", title: "Private events", body: "Buyouts available Sun-Tue. Email events@oliveandember.com.", uses: 9 },
  { id: "waitlist", title: "Waitlist", body: "Walk-ins are welcome. Live wait times change quickly and are confirmed at the door during service.", uses: 31 },
  { id: "order-changes", title: "Order changes", body: "Collect the order name, callback number, requested change, and flag staff before promising any cancellation or remake.", uses: 15 },
  { id: "reservation-changes", title: "Reservation changes", body: "Collect the reservation name, date, time, party size, and requested change, then route it to staff confirmation.", uses: 17 },
  { id: "lost-found", title: "Lost and found", body: "Collect item description, visit date/time, seating area, caller name, and best callback number.", uses: 8 },
  { id: "jobs", title: "Jobs and hiring", body: "Applicants can email careers@oliveandember.example or stop by Tue-Thu 2-4 PM with a resume.", uses: 12 },
  { id: "vendors", title: "Vendor calls", body: "Collect company, caller name, reason, phone, and email. Route to owner without interrupting service.", uses: 6 },
  { id: "complaints", title: "Complaints", body: "Apologize, collect caller name, callback, order or visit details, and create an urgent manager task. Do not promise refunds.", uses: 14 },
  { id: "dress", title: "Dress code", body: "Smart casual. No formal dress code.", uses: 4 },
  { id: "access", title: "Accessibility", body: "Wheelchair accessible main entrance and restroom.", uses: 6 },
  { id: "gift", title: "Gift cards", body: "Available in-restaurant or via our website.", uses: 11 },
  { id: "fees", title: "Fees and house rules", body: "Corkage is $25 per bottle with a two-bottle limit. Cake plating is $2 per guest. Service animals only.", uses: 16 },
];

export const faqs = [
  { q: "Do you offer gluten-free crust?", a: "Yes, gluten-free crust is available on any pizza for $4." },
  { q: "Is there a corkage fee?", a: "Yes, $25 per bottle, limit 2 bottles." },
  { q: "Can I bring a cake?", a: "Yes, cake-cutting fee is $2 per guest." },
  { q: "What are tonight's specials?", a: "Roasted branzino, burrata with stone fruit, and mushroom risotto. Specials can sell out." },
  { q: "Do you have live music?", a: "Yes. Live jazz Thursdays 7-9 PM and acoustic guitar Sundays 5-7 PM." },
  { q: "Do you have happy hour?", a: "Yes. Tue-Fri 4-6 PM at the bar and patio." },
  { q: "Can I reserve patio seating?", a: "Staff can note the request, but patio seating is usually first come, first served." },
  { q: "Where should delivery drivers go?", a: "Drivers should check the pickup shelf near the host stand with the guest name and app name." },
  { q: "Are walk-ins welcome?", a: "Yes, walk-ins are welcome. Live waits are confirmed at the door." },
];

export const integrations = [
  { id: "toast", name: "Toast", desc: "Primary target for pickup order injection.", status: "connected" as const, category: "POS", requiredEnv: ["TOAST_CLIENT_ID", "TOAST_CLIENT_SECRET", "TOAST_RESTAURANT_GUID"] },
  { id: "square", name: "Square", desc: "Send orders to Square for Restaurants.", status: "not_connected" as const, category: "POS", requiredEnv: ["SQUARE_ACCESS_TOKEN", "SQUARE_LOCATION_ID"] },
  { id: "clover", name: "Clover", desc: "Push orders to Clover merchants.", status: "not_connected" as const, category: "POS", requiredEnv: ["CLOVER_ACCESS_TOKEN", "CLOVER_MERCHANT_ID"] },
  { id: "opentable", name: "OpenTable", desc: "Primary target for reservation availability and booking.", status: "connected" as const, category: "Reservations", requiredEnv: ["OPENTABLE_CLIENT_ID", "OPENTABLE_CLIENT_SECRET", "OPENTABLE_RESTAURANT_ID"] },
  { id: "resy", name: "Resy", desc: "Sync reservations with Resy venues.", status: "needs_attention" as const, category: "Reservations", requiredEnv: ["RESY_API_KEY", "RESY_VENUE_ID"] },
  { id: "tock", name: "Tock", desc: "Send reservation and event bookings to Tock.", status: "not_connected" as const, category: "Reservations", requiredEnv: ["TOCK_API_KEY", "TOCK_BUSINESS_ID"] },
  { id: "sevenrooms", name: "SevenRooms", desc: "Guest profiles, reservations, and hospitality notes.", status: "not_connected" as const, category: "Reservations", requiredEnv: ["SEVENROOMS_CLIENT_ID", "SEVENROOMS_CLIENT_SECRET", "SEVENROOMS_VENUE_ID"] },
  { id: "yelp", name: "Yelp Guest Manager", desc: "Sync waitlist and reservation requests.", status: "not_connected" as const, category: "Reservations", requiredEnv: ["YELP_GUEST_MANAGER_API_KEY", "YELP_BUSINESS_ID"] },
  { id: "printer", name: "Receipt Printer", desc: "Auto-print order tickets for manual fallback.", status: "connected" as const, category: "Hardware" },
  { id: "kds", name: "Kitchen Tablet", desc: "Display manual review orders on a kitchen tablet.", status: "needs_attention" as const, category: "Hardware" },
  { id: "sms", name: "Guest Texts", desc: "Demo placeholder is active; real SMS waits for carrier registration.", status: "needs_attention" as const, category: "Messaging", requiredEnv: ["TWILIO_MESSAGING_SERVICE_SID or TWILIO_SMS_FROM_NUMBER"] },
];

export const users = [
  { id: "u1", name: "Maria Lombardi", email: "maria@oliveandember.com", role: "Owner", lastActive: "2 min ago" },
  { id: "u2", name: "Alex Tran", email: "alex@oliveandember.com", role: "Manager", lastActive: "1 hr ago" },
  { id: "u3", name: "Jordan Smith", email: "jordan@oliveandember.com", role: "Staff", lastActive: "Yesterday" },
];

// Hourly call volume for today (24 hours)
export const callVolumeByHour = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6, 5, 4, 6, 8, 12, 18, 22, 19, 14, 8, 3,
].map((v, h) => {
  const period = h < 12 ? "AM" : "PM";
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return { hour: `${display}${period}`, calls: v };
});

export const dashboardStats = {
  callsAnswered: { value: 87, delta: 12 },
  missedRecovered: { value: 9, delta: 3 },
  ordersCaptured: { value: 23, delta: 5 },
  reservationRequests: { value: 11, delta: -2 },
  revenueCaptured: { value: 1842, delta: 240 },
  complaints: { value: 3, delta: 1 },
  salesCalls: { value: 5, delta: 2 },
};

export const topIntents = [
  { name: "FAQ", value: 38 },
  { name: "Order", value: 27 },
  { name: "Reservation", value: 18 },
  { name: "Hours", value: 12 },
  { name: "Other", value: 5 },
];
