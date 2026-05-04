export interface RestaurantVoiceContext {
  restaurantName: string;
  hostName: string;
  timezone: string;
  greeting: string;
  menuHighlights: string[];
  policies: Record<string, string>;
}

export const demoRestaurantContext: RestaurantVoiceContext = {
  restaurantName: "Olive & Ember",
  hostName: "Vera",
  timezone: "America/Los_Angeles",
  greeting: "Thanks for calling Olive & Ember, this is Vera, the restaurant's virtual host. How can I help?",
  menuHighlights: [
    "Margherita pizza",
    "Diavola pizza",
    "Caesar salad",
    "Cacio e Pepe",
    "Tiramisu",
  ],
  policies: {
    hours: "Open Tuesday through Thursday 5 PM to 10 PM, Friday 5 PM to 11 PM, Saturday noon to 11 PM, Sunday noon to 9 PM, closed Monday.",
    pickup: "Pickup orders are pay at pickup. Typical wait is 20 to 30 minutes during peak hours.",
    reservations: "Reservations can be requested by phone. Large parties need staff confirmation.",
    allergies: "Severe allergies require staff confirmation because cross-contact is possible.",
    parking: "Metered street parking is available nearby, with a paid lot at 17th and Valencia.",
  },
};
