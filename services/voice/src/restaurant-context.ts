import type { HostlineVoiceGender } from "../../../src/domain/voice-selection";

export interface RestaurantVoiceContext {
  restaurantName: string;
  hostName: string;
  voiceGender: HostlineVoiceGender;
  timezone: string;
  greeting: string;
  defaultPickupEtaMinutes?: number;
  smsConfirmationsEnabled: boolean;
  faqs: RestaurantFaq[];
  knowledgeSections: RestaurantKnowledgeSection[];
  menuHighlights: string[];
  menuItems: RestaurantMenuItem[];
  policies: Record<string, string>;
}

export interface RestaurantFaq {
  question: string;
  answer: string;
}

export interface RestaurantKnowledgeSection {
  title: string;
  body: string;
}

export interface RestaurantMenuItem {
  name: string;
  priceCents: number;
  aliases?: string[];
  modifiers?: string[];
}

export const demoRestaurantContext: RestaurantVoiceContext = {
  restaurantName: "Olive & Ember",
  hostName: "Vera",
  voiceGender: "female",
  timezone: "America/Los_Angeles",
  greeting: "Hi, thanks for calling Olive and Ember. This is Vera. How can I help you today?",
  defaultPickupEtaMinutes: 25,
  smsConfirmationsEnabled: true,
  faqs: [
    {
      answer: "Yes, gift cards are available in person at the host stand.",
      question: "Do you sell gift cards?",
    },
    {
      answer: "Outside cakes are allowed with a small plating fee. The staff can confirm details for your party.",
      question: "Can I bring a cake?",
    },
    {
      answer: "Yes. Gluten-free crust is available for pizzas, and several dishes can be made vegetarian. Severe allergies need staff confirmation because cross-contact is possible.",
      question: "Do you have gluten-free or vegetarian options?",
    },
    {
      answer: "The restaurant is smart casual. There is no formal dress code.",
      question: "Is there a dress code?",
    },
    {
      answer: "The patio is first come, first served unless staff confirms it for a special reservation.",
      question: "Can I reserve the patio?",
    },
    {
      answer: "Live jazz is scheduled on Thursdays from 7 PM to 9 PM, and acoustic guitar is scheduled on Sundays from 5 PM to 7 PM.",
      question: "Do you have live music?",
    },
  ],
  knowledgeSections: [
    {
      body: "Private event and catering inquiries should be collected and sent to the events manager for follow-up.",
      title: "Private events",
    },
    {
      body: "Tonight's dinner specials are roasted branzino with lemon-caper butter, burrata with stone fruit and basil, and a mushroom risotto. Specials can sell out during service.",
      title: "Tonight's specials",
    },
    {
      body: "Happy hour runs Tuesday through Friday from 4 PM to 6 PM at the bar and patio only. It includes $9 spritzes, $8 house wine, $6 beer, and $10 margherita pizzettes.",
      title: "Happy hour",
    },
    {
      body: "Live jazz is scheduled Thursdays from 7 PM to 9 PM. Acoustic guitar is scheduled Sundays from 5 PM to 7 PM. Music is complimentary and seating is not guaranteed near the performers.",
      title: "Live music",
    },
    {
      body: "Weekend brunch runs Saturday and Sunday from noon to 2 PM with lemon ricotta pancakes, breakfast pizza, smoked salmon toast, mimosas, and espresso drinks.",
      title: "Brunch",
    },
    {
      body: "For delivery drivers, ask for the guest name and app name. Drivers should check the pickup shelf near the host stand and wait outside if the order is not ready.",
      title: "Delivery driver pickup",
    },
    {
      body: "Lost item calls should collect a description, visit date and time, where the guest sat, the caller name, and the best callback number. Staff reviews the lost-and-found drawer before calling back.",
      title: "Lost and found",
    },
  ],
  menuHighlights: [
    "Burrata",
    "Meatballs",
    "Margherita pizza",
    "Diavola pizza",
    "Funghi pizza",
    "Caesar salad",
    "Cacio e Pepe",
    "Roasted branzino",
    "Lemon ricotta pancakes",
    "House spritz",
    "Tiramisu",
  ],
  menuItems: [
    { name: "Burrata", priceCents: 1600, aliases: ["burrata", "burrata appetizer"], modifiers: ["Add prosciutto"] },
    { name: "Meatballs", priceCents: 1300, aliases: ["meatballs", "meatball appetizer"] },
    { name: "Margherita Pizza", priceCents: 1800, aliases: ["margherita", "margherita pizza"], modifiers: ["Light cheese", "Gluten-free crust"] },
    { name: "Diavola Pizza", priceCents: 2100, aliases: ["diavola", "diavola pizza"] },
    { name: "Funghi Pizza", priceCents: 2000, aliases: ["funghi", "mushroom pizza", "funghi pizza"], modifiers: ["Gluten-free crust"] },
    { name: "Caesar Salad", priceCents: 1400, aliases: ["caesar", "caesar salad"], modifiers: ["No anchovy", "Add chicken"] },
    { name: "Cacio e Pepe", priceCents: 2200, aliases: ["cacio e pepe", "cacio", "cheese and pepper pasta"] },
    { name: "Spaghetti Bolognese", priceCents: 2200, aliases: ["bolognese", "spaghetti bolognese"] },
    { name: "Lasagna", priceCents: 2400, aliases: ["lasagna"] },
    { name: "Roasted Branzino", priceCents: 3200, aliases: ["branzino", "roasted branzino", "fish special"] },
    { name: "Mushroom Risotto", priceCents: 2600, aliases: ["risotto", "mushroom risotto"] },
    { name: "Lemon Ricotta Pancakes", priceCents: 1700, aliases: ["pancakes", "lemon pancakes", "ricotta pancakes"] },
    { name: "Tiramisu", priceCents: 1100, aliases: ["tiramisu"] },
    { name: "Affogato", priceCents: 900, aliases: ["affogato"] },
    { name: "Sparkling Water", priceCents: 500, aliases: ["sparkling water"] },
    { name: "House Spritz", priceCents: 1400, aliases: ["spritz", "house spritz", "aperol spritz"] },
    { name: "Non-Alcoholic Spritz", priceCents: 1000, aliases: ["na spritz", "non alcoholic spritz", "mocktail"] },
    { name: "House Red Wine", priceCents: 1200, aliases: ["house red", "red wine"] },
    { name: "House White Wine", priceCents: 1200, aliases: ["house white", "white wine"] },
  ],
  policies: {
    hours: "Open Tuesday through Thursday 5 PM to 10 PM, Friday 5 PM to 11 PM, Saturday noon to 11 PM, Sunday noon to 9 PM, closed Monday.",
    location: "Olive and Ember is at 182 Valencia Street in San Francisco, near 17th Street.",
    pickup: "Pickup orders are pay at pickup. Typical wait is 20 to 30 minutes during peak hours.",
    reservations: "Reservations can be requested by phone. Parties up to 6 can usually be handled normally if availability exists. Parties of 8 or more need staff confirmation.",
    allergies: "Severe allergies require staff confirmation because cross-contact is possible.",
    parking: "Metered street parking is available nearby, with a paid lot at 17th and Valencia. The 16th Street BART station is about a 10-minute walk.",
    specials: "Tonight's specials are roasted branzino with lemon-caper butter, burrata with stone fruit and basil, and mushroom risotto. Specials can sell out.",
    music: "Live jazz is scheduled Thursdays from 7 PM to 9 PM, and acoustic guitar is scheduled Sundays from 5 PM to 7 PM.",
    "happy hour": "Happy hour runs Tuesday through Friday from 4 PM to 6 PM at the bar and patio only. It includes $9 spritzes, $8 house wine, $6 beer, and $10 margherita pizzettes.",
    brunch: "Weekend brunch is Saturday and Sunday from noon to 2 PM.",
    patio: "Patio seating is usually first come, first served. Staff can note patio requests but cannot guarantee them unless a manager confirms.",
    waitlist: "Walk-ins are welcome. Live wait times change quickly, so staff confirms waits at the door during service.",
    payment: "Pickup orders are pay at pickup. The host cannot take card numbers over the phone.",
    delivery: "Olive and Ember does not offer direct delivery. Delivery app issues should be handled through the app first, then staff can review details.",
    "delivery drivers": "Delivery drivers should check the pickup shelf near the host stand with the guest name and app name.",
    "order changes": "For pickup order changes or cancellations, collect the order name, callback number, and requested change, then flag staff before promising anything.",
    "reservation changes": "For reservation changes or cancellations, collect the name, date, time, party size, and requested change, then route to staff confirmation.",
    "lost and found": "For lost items, collect item description, visit date and time, where the guest sat, caller name, and callback number.",
    jobs: "Applicants can email careers@oliveandember.example or stop by Tuesday through Thursday between 2 PM and 4 PM with a resume.",
    vendors: "Vendor and sales calls should be summarized for the owner. Collect company, caller name, reason, phone, and email without interrupting service.",
    complaints: "For complaints, apologize, collect the caller name, callback number, order or visit details, and flag a manager. Do not promise refunds.",
    "private events": "Private events and catering inquiries should collect date, guest count, budget, contact info, and preferred follow-up time for the events manager.",
    "house rules": "Corkage is $25 per bottle with a two-bottle limit. Cake plating is $2 per guest. Service animals only. The main entrance and restroom are wheelchair accessible.",
  },
};

export function toSpokenRestaurantName(restaurantName: string) {
  return restaurantName
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*\+\s*/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}
