import type { StaffAlertKind } from "./notification-service";
import type { RestaurantVoiceContext } from "./restaurant-context";
import { getRuntimeBusinessProfile } from "./business-runtime";

export interface PhonePlaybookReply {
  staffAlertKind?: StaffAlertKind;
  scenario: string;
  text: string;
}

type PolicyKey =
  | "allergies"
  | "complaints"
  | "delivery_drivers"
  | "delivery_issues"
  | "directions"
  | "donations_press"
  | "dress_code"
  | "employment"
  | "human_handoff"
  | "hours"
  | "lost_and_found"
  | "order_changes"
  | "parking"
  | "payment"
  | "pickup"
  | "private_events"
  | "reservation_changes"
  | "reservations"
  | "sales"
  | "specials"
  | "waitlist";

export function matchPhonePlaybookReply(
  utterance: string,
  context: RestaurantVoiceContext,
): PhonePlaybookReply | null {
  const normalized = normalize(utterance);
  if (!normalized) return null;
  const profile = getRuntimeBusinessProfile(context);
  const businessPossessive = profile.isRestaurant ? "restaurant's" : "business's";

  if (/\b(wrong number|mistake|sorry wrong)\b/.test(normalized)) {
    return reply("wrong_number", `No problem. This is ${context.restaurantName}. Have a good night.`);
  }

  if (/\b(refund|wrong order|incorrect order|bad service|complaint|complain|food was cold|missing item|charged twice)\b/.test(normalized)) {
    return reply(
      "complaint",
      policyBackedReply(
        context,
        "complaints",
        "I am sorry about that. I can flag this for a manager to review; what name and best callback number should I include?",
        `I am sorry about that. I will follow the ${businessPossessive} complaint process:`,
        "What name and callback number should I include?",
      ),
      "complaint",
    );
  }

  if (/\b(human|real person|staff|owner|manager|someone|call me back|callback|call back)\b/.test(normalized)) {
    return reply(
      "human_handoff",
      policyBackedReply(
        context,
        "human_handoff",
        "I can flag this for staff follow-up. What name and best callback number should I include?",
        "I can get that to staff. The handoff process is:",
        "What name, callback number, and reason should I include?",
      ),
      "handoff",
    );
  }

  if (/\b(sales|vendor|supplier|wholesale|marketing|advertising|seo|linen|produce|distributor|beer rep|wine rep)\b/.test(normalized)) {
    return reply(
      "vendor_sales",
      policyBackedReply(
        context,
        "sales",
        "Thanks. I can pass along the message; staff usually cannot take vendor or sales calls during service. What company and callback info should I include?",
        "Thanks. Staff's vendor call process is:",
        "What company and callback info should I include?",
      ),
      "sales",
    );
  }

  if (/\b(donation|sponsorship|press|media|partnership|partner with|collaboration)\b/.test(normalized)) {
    return reply(
      "donations_press",
      policyBackedReply(
        context,
        "donations_press",
        "I can pass that along for staff review. What organization, request, deadline, and callback info should I include?",
        `I can pass that along. The ${businessPossessive} process is:`,
        "What organization, request, deadline, and callback info should I include?",
      ),
      "handoff",
    );
  }

  if (/\b(lost|left|forgot).{0,40}\b(wallet|phone|bag|purse|jacket|coat|keys|credit card|item)\b/.test(normalized)) {
    return reply(
      "lost_and_found",
      policyBackedReply(
        context,
        "lost_and_found",
        "I can flag that for staff. What item was lost, when were you in, and what number should they use if they find it?",
        "I can flag that for staff. The lost-and-found process is:",
        "What item and callback number should I include?",
      ),
      "handoff",
    );
  }

  if (/\b(job|jobs|hiring|apply|application|resume|work there|employment)\b/.test(normalized)) {
    return reply(
      "employment",
      policyBackedReply(
        context,
        "employment",
        `For hiring, it is best to contact the ${profile.businessNoun} outside peak hours. I can also pass along your name, role of interest, and callback number.`,
        `For hiring, the ${businessPossessive} process is:`,
        "What role and callback number should I include?",
      ),
      "handoff",
    );
  }

  if (profile.isRestaurant && /\b(delivery driver|doordash driver|uber eats driver|grubhub driver|pickup for)\b/.test(normalized)) {
    return reply(
      "delivery_driver",
      policy(context, "delivery_drivers") ??
        "If you are a delivery driver, please check in at the host stand or pickup counter when you arrive with the guest name.",
    );
  }

  if (profile.isRestaurant && /\b(doordash|uber eats|grubhub|delivery app).{0,60}\b(missing|wrong|late|never arrived|never delivered|not delivered|refund)\b/.test(normalized)) {
    return reply(
      "delivery_issue",
      policyBackedReply(
        context,
        "delivery_issues",
        "I am sorry about that. For third-party delivery app issues, the fastest refund path is through the app, and I can flag the issue for staff review too.",
        "I am sorry about that. The delivery issue process is:",
        "What app, order name, issue, and callback number should I include?",
      ),
      "delivery_failure",
    );
  }

  if (/\b(cancel|change|modify|update|move|reschedule).{0,40}\b(order|reservation|table|booking|appointment|inspection|estimate|quote|service)\b/.test(normalized)) {
    const isReservationChange = /\b(reservation|table|booking)\b/.test(normalized);
    return reply(
      "change_or_cancel",
      policyBackedReply(
        context,
        isReservationChange || !profile.isRestaurant ? "reservation_changes" : "order_changes",
        `I can flag that for ${profile.staffNoun} because changes and cancellations need confirmation. What name is it under, and what should be changed?`,
        isReservationChange || !profile.isRestaurant
          ? `I can help get that ${profile.isRestaurant ? "reservation" : profile.appointmentNoun} change to staff. The process is:`
          : "I can help get that order change to staff. The process is:",
        "What name is it under, and what should be changed?",
      ),
      "handoff",
    );
  }

  if (/\b(allergy|allergic|allergen|celiac|gluten|peanut|nut|shellfish|dairy)\b/.test(normalized)) {
    const allergyPolicy = policy(context, "allergies");
    return reply(
      "allergy",
      allergyPolicy
        ? `${allergyPolicy} I can send this to staff for a callback; what name and best number should I include?`
        : "I can note that for staff, but severe allergies need staff confirmation because cross-contact is possible. What name, callback number, and allergy should I flag?",
      "low_confidence",
    );
  }

  if (profile.isRestaurant && /\b(cater|catering|private event|buyout|wedding|corporate event|banquet)\b/.test(normalized)) {
    return reply(
      "private_event",
      policyBackedReply(
        context,
        "private_events",
        "I can send that to the events team. What date, party size, event type, and callback information should I include?",
        "I can send that to the events team. The event inquiry process is:",
        "What date, party size, event type, and callback information should I include?",
      ),
      "low_confidence",
    );
  }

  if (profile.isRestaurant && /\b(large party|party of (?:[8-9]|[1-9][0-9])|group of (?:[8-9]|[1-9][0-9]))\b/.test(normalized)) {
    return reply(
      "large_party",
      policyBackedReply(
        context,
        "private_events",
        "Large parties need staff confirmation. What date, time, party size, name, and callback number should I send over?",
        "Large parties need staff confirmation. The restaurant's group process is:",
        "What date, party size, name, and callback number should I send over?",
      ),
      "reservation",
    );
  }

  if (/\b(credit card|card number|pay over the phone|payment link|prepay)\b/.test(normalized)) {
    return reply(
      "payment",
      policy(context, "payment") ??
        "Payment is pay at pickup for phone orders. I cannot take card numbers over the phone.",
    );
  }

  if (profile.isRestaurant && /\b(wait time|how long is the wait|waitlist|walk in|walk-in)\b/.test(normalized)) {
    return reply(
      "wait_time",
      policy(context, "waitlist") ??
        "I do not have a live waitlist view yet. Walk-in wait times can change quickly, so staff can confirm when you arrive.",
    );
  }

  if (/\b(special|specials|special menu|daily special|tonight's special|tonights special|happy hour|prix fixe|featured dish|features tonight|promotion|promo|seasonal)\b/.test(normalized)) {
    return reply(
      "specials",
      policy(context, "specials") ??
        profile.isRestaurant
          ? "I do not have tonight's specials in front of me yet. I can help with the regular menu, or staff can confirm current specials when you arrive."
          : `I do not have current promotions in front of me yet. I can collect your question for ${profile.staffNoun} follow-up if you want.`,
    );
  }

  if (profile.isRestaurant && /\b(reservation|reserve|book a table|table for)\b/.test(normalized)) {
    return reply(
      "reservation",
      policyBackedReply(
        context,
        "reservations",
        "I can help with a reservation request. What date, time, party size, and name should I send to the staff?",
        "I can help with a reservation request. The restaurant's reservation process is:",
        "What date, time, party size, and name should I send to staff?",
      ),
    );
  }

  if (profile.isRestaurant && /\b(order status|is my order ready|how much longer|pickup ready)\b/.test(normalized)) {
    return reply(
      "order_status",
      policyBackedReply(
        context,
        "order_changes",
        "I do not have live kitchen status yet. I can flag staff to check; what name is the order under?",
        "I can help get staff the order-status details. The process is:",
        "What name is the order under?",
      ),
      "handoff",
    );
  }

  if (!profile.isRestaurant && /\b(appointment|book|schedule|estimate|quote|inspection|service call|repair|install|consultation)\b/.test(normalized)) {
    return reply(
      "service_request",
      policyBackedReply(
        context,
        "reservations",
        `I can help collect that for ${profile.staffNoun}. What service do you need, what area are you in, and what is the best callback number?`,
        `I can help with that ${profile.appointmentNoun} request. The process is:`,
        "What service do you need, what area are you in, and what is the best callback number?",
      ),
    );
  }

  if (/\b(hour|hours|open|opened|close|closed|closing)\b/.test(normalized)) {
    const hours = policy(context, "hours");
    if (hours) return reply("hours", hours);
  }

  if (/\b(parking|park|garage|valet)\b/.test(normalized)) {
    const parking = policy(context, "parking");
    if (parking) return reply("parking", parking);
  }

  if (/\b(address|directions|where are you|where located|location)\b/.test(normalized)) {
    const directions = policy(context, "directions") ?? policy(context, "parking");
    if (directions) return reply("directions", directions);
  }

  if (/\b(dress code|what should i wear|formal|casual)\b/.test(normalized)) {
    const dressCode = policy(context, "dress_code");
    if (dressCode) return reply("dress_code", dressCode);
  }

  if (profile.isRestaurant && /\b(pickup|takeout|take out|to go)\b/.test(normalized)) {
    const pickup = policy(context, "pickup");
    if (pickup && !/\b(order|can i get|i want|i would like|i'd like)\b/.test(normalized)) {
      return reply("pickup_policy", pickup);
    }
  }

  return null;
}

function reply(scenario: string, text: string, staffAlertKind?: StaffAlertKind): PhonePlaybookReply {
  return {
    scenario,
    staffAlertKind,
    text: compactPhoneReply(text),
  };
}

function policy(context: RestaurantVoiceContext, key: PolicyKey) {
  const value = context.policies[key];
  return value?.trim() ? value.trim() : null;
}

function policyBackedReply(
  context: RestaurantVoiceContext,
  key: PolicyKey,
  fallback: string,
  prefix: string,
  suffix: string,
) {
  const value = policy(context, key);
  return value ? `${prefix} ${value} ${suffix}` : fallback;
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

function compactPhoneReply(value: string) {
  if (value.length <= 320) return value;

  const compact = value.slice(0, 320);
  const lastSentence = Math.max(compact.lastIndexOf("."), compact.lastIndexOf("?"), compact.lastIndexOf("!"));
  return lastSentence > 120 ? compact.slice(0, lastSentence + 1) : `${compact.trim()}...`;
}
