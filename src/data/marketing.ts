export const testimonials = [
  {
    name: "Marco Rinaldi",
    title: "Owner",
    restaurant: "Trattoria Rinaldi",
    city: "Brooklyn, NY",
    quote:
      "We were missing 40+ calls a week during dinner. Vera caught every one. We added almost $9k of pickup orders our first month, and she paid for herself in three days.",
    initials: "MR",
  },
  {
    name: "Priya Shah",
    title: "GM",
    restaurant: "Curry House",
    city: "Austin, TX",
    quote:
      "My hosts can finally seat guests instead of holding the phone. Reservations went up 22% and our Yelp rating climbed because nobody waits on hold anymore.",
    initials: "PS",
  },
  {
    name: "Diego Alvarez",
    title: "Operator",
    restaurant: "Taqueria Norte (4 locations)",
    city: "San Diego, CA",
    quote:
      "Setup was a Tuesday afternoon. By Friday Vera was answering in Spanish and English across all four spots. I have not picked up the phone since.",
    initials: "DA",
  },
];

export const liveMetrics = [
  { value: "1.2M", label: "Calls answered" },
  { value: "340k", label: "Orders captured" },
  { value: "$14.6M", label: "Revenue recovered" },
  { value: "82,000", label: "Staff hours saved" },
];

export const integrations = [
  "Toast",
  "Square",
  "Clover",
  "OpenTable",
  "Resy",
  "Yelp Reservations",
  "Twilio",
  "Stripe",
  "Mailchimp",
  "Slack",
  "Google Business",
  "DoorDash",
];

export const comparisonRows = [
  { label: "Answers every call", signalhost: true, voicemail: false, ivr: true, human: true },
  { label: "Knows your menu", signalhost: true, voicemail: false, ivr: false, human: false },
  { label: "Takes pickup orders", signalhost: true, voicemail: false, ivr: false, human: true },
  { label: "Books reservations", signalhost: true, voicemail: false, ivr: false, human: true },
  { label: "Detects upset callers", signalhost: true, voicemail: false, ivr: false, human: true },
  { label: "Available 24 / 7 / 365", signalhost: true, voicemail: true, ivr: true, human: false },
  { label: "Cost per call", signalhost: "~$0.30", voicemail: "$0", ivr: "$0.10", human: "$1.50-$4" },
];

export const homeFaqs = [
  {
    q: "Will callers know they're talking to AI?",
    a: "The greeting is configurable. Vera can identify herself politely as a virtual host, but most callers care more that they get a fast, useful answer.",
  },
  {
    q: "How long does setup take?",
    a: "Most restaurants are live the same day. Forward your line, upload a menu or link to one, and answer the onboarding interview.",
  },
  {
    q: "What if Vera doesn't know the answer?",
    a: "She gracefully takes a message, alerts staff, and saves a transcript instead of making up an answer.",
  },
  {
    q: "Does it work for multiple locations?",
    a: "Yes. Each location gets its own number, menu, hours, and analytics, managed from one dashboard.",
  },
  {
    q: "Can I keep my current phone number?",
    a: "Absolutely. You can port it later or simply forward unanswered calls to your SignalHost number.",
  },
];

export const featureMatrix = {
  groups: [
    {
      title: "Calls",
      rows: [
        { label: "Included calls / mo", starter: "200", growth: "800", pro: "2,000" },
        { label: "Overage rate", starter: "$0.55", growth: "$0.40", pro: "$0.30" },
        { label: "24/7 answering", starter: true, growth: true, pro: true },
        { label: "Live call transfer", starter: false, growth: true, pro: true },
        { label: "Bilingual (EN + ES)", starter: false, growth: true, pro: true },
      ],
    },
    {
      title: "Orders & reservations",
      rows: [
        { label: "Reservation requests", starter: true, growth: true, pro: true },
        { label: "Pickup order taking", starter: false, growth: true, pro: true },
        { label: "Modifiers & specials", starter: false, growth: true, pro: true },
        { label: "OpenTable / Resy sync", starter: false, growth: false, pro: true },
      ],
    },
    {
      title: "Integrations & admin",
      rows: [
        { label: "Toast / Square POS", starter: false, growth: true, pro: true },
        { label: "Locations included", starter: "1", growth: "1", pro: "Up to 3" },
        { label: "Custom voice tuning", starter: false, growth: false, pro: true },
        { label: "API access", starter: false, growth: false, pro: true },
        { label: "Support", starter: "Email", growth: "Priority", pro: "Dedicated CSM" },
      ],
    },
  ],
};

export const addOns = [
  { name: "Extra location", price: "+$79 / mo", desc: "Separate number, menu, hours, and analytics." },
  { name: "Extra phone number", price: "+$9 / mo", desc: "Vanity or local number, ported or new." },
  { name: "Custom voice clone", price: "$199 one-time", desc: "Vera trained on your owner or host's actual voice." },
  { name: "Premium support", price: "+$49 / mo", desc: "1-hour response SLA, weekend coverage, Slack channel." },
];
