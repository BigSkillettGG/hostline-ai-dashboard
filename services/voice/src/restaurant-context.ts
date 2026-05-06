export interface RestaurantVoiceContext {
  restaurantName: string;
  hostName: string;
  timezone: string;
  greeting: string;
  defaultPickupEtaMinutes?: number;
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
  timezone: "America/Los_Angeles",
  greeting: "Thanks for calling Olive & Ember, this is Vera, the restaurant's virtual host. How can I help?",
  faqs: [
    {
      answer: "Yes, gift cards are available in person at the host stand.",
      question: "Do you sell gift cards?",
    },
    {
      answer: "Outside cakes are allowed with a small plating fee. The staff can confirm details for your party.",
      question: "Can I bring a cake?",
    },
  ],
  knowledgeSections: [
    {
      body: "Private event and catering inquiries should be collected and sent to the events manager for follow-up.",
      title: "Private events",
    },
  ],
  menuHighlights: [
    "Margherita pizza",
    "Diavola pizza",
    "Caesar salad",
    "Cacio e Pepe",
    "Tiramisu",
  ],
  menuItems: [
    { name: "Margherita Pizza", priceCents: 1800, aliases: ["margherita", "margherita pizza"], modifiers: ["Light cheese", "Gluten-free crust"] },
    { name: "Diavola Pizza", priceCents: 2100, aliases: ["diavola", "diavola pizza"] },
    { name: "Caesar Salad", priceCents: 1400, aliases: ["caesar", "caesar salad"], modifiers: ["No anchovy", "Add chicken"] },
    { name: "Cacio e Pepe", priceCents: 2200, aliases: ["cacio e pepe"] },
    { name: "Spaghetti Bolognese", priceCents: 2200, aliases: ["bolognese", "spaghetti bolognese"] },
    { name: "Lasagna", priceCents: 2400, aliases: ["lasagna"] },
    { name: "Tiramisu", priceCents: 1100, aliases: ["tiramisu"] },
    { name: "Sparkling Water", priceCents: 500, aliases: ["sparkling water"] },
  ],
  policies: {
    hours: "Open Tuesday through Thursday 5 PM to 10 PM, Friday 5 PM to 11 PM, Saturday noon to 11 PM, Sunday noon to 9 PM, closed Monday.",
    pickup: "Pickup orders are pay at pickup. Typical wait is 20 to 30 minutes during peak hours.",
    reservations: "Reservations can be requested by phone. Large parties need staff confirmation.",
    allergies: "Severe allergies require staff confirmation because cross-contact is possible.",
    parking: "Metered street parking is available nearby, with a paid lot at 17th and Valencia.",
  },
};
