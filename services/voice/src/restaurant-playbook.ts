import type { StaffAlertKind } from "./notification-service";
import type { RestaurantVoiceContext } from "./restaurant-context";

export interface PhonePlaybookReply {
  staffAlertKind?: StaffAlertKind;
  scenario: string;
  text: string;
}

type PolicyKey =
  | "allergies"
  | "directions"
  | "dress_code"
  | "hours"
  | "parking"
  | "payment"
  | "pickup"
  | "reservations";

export function matchPhonePlaybookReply(
  utterance: string,
  context: RestaurantVoiceContext,
): PhonePlaybookReply | null {
  const normalized = normalize(utterance);
  if (!normalized) return null;

  if (/\b(wrong number|mistake|sorry wrong)\b/.test(normalized)) {
    return reply("wrong_number", `No problem. This is ${context.restaurantName}. Have a good night.`);
  }

  if (/\b(refund|wrong order|incorrect order|bad service|complaint|complain|food was cold|missing item|charged twice)\b/.test(normalized)) {
    return reply(
      "complaint",
      "I am sorry about that. I can flag this for a manager to review; what name and best callback number should I include?",
      "complaint",
    );
  }

  if (/\b(human|real person|staff|owner|manager|someone|call me back|callback|call back)\b/.test(normalized)) {
    return reply(
      "human_handoff",
      "I can flag this for staff follow-up. What name and best callback number should I include?",
      "handoff",
    );
  }

  if (/\b(sales|vendor|supplier|wholesale|marketing|advertising|seo|linen|produce|distributor|beer rep|wine rep)\b/.test(normalized)) {
    return reply(
      "vendor_sales",
      "Thanks. I can pass along the message; staff usually cannot take vendor or sales calls during service. What company and callback info should I include?",
      "sales",
    );
  }

  if (/\b(lost|left|forgot).{0,40}\b(wallet|phone|bag|purse|jacket|coat|keys|credit card|item)\b/.test(normalized)) {
    return reply(
      "lost_and_found",
      "I can flag that for staff. What item was lost, when were you in, and what number should they use if they find it?",
      "handoff",
    );
  }

  if (/\b(job|jobs|hiring|apply|application|resume|work there|employment)\b/.test(normalized)) {
    return reply(
      "employment",
      "For hiring, it is best to contact the restaurant outside peak service hours. I can also pass along your name, role of interest, and callback number.",
      "handoff",
    );
  }

  if (/\b(delivery driver|doordash driver|uber eats driver|grubhub driver|pickup for)\b/.test(normalized)) {
    return reply(
      "delivery_driver",
      "If you are a delivery driver, please check in at the host stand or pickup counter when you arrive with the guest name.",
    );
  }

  if (/\b(doordash|uber eats|grubhub|delivery app).{0,60}\b(missing|wrong|late|never arrived|never delivered|not delivered|refund)\b/.test(normalized)) {
    return reply(
      "delivery_issue",
      "I am sorry about that. For third-party delivery app issues, the fastest refund path is through the app, and I can flag the issue for staff review too.",
      "delivery_failure",
    );
  }

  if (/\b(cancel|change|modify|update|move|reschedule).{0,40}\b(order|reservation|table|booking)\b/.test(normalized)) {
    return reply(
      "change_or_cancel",
      "I can flag that for staff because changes and cancellations need confirmation. What name is it under, and what should be changed?",
      "handoff",
    );
  }

  if (/\b(allergy|allergic|allergen|celiac|gluten|peanut|nut|shellfish|dairy)\b/.test(normalized)) {
    return reply(
      "allergy",
      policy(context, "allergies") ??
        "I can note that for staff, but severe allergies need staff confirmation because cross-contact is possible. What allergy should I flag?",
      "low_confidence",
    );
  }

  if (/\b(cater|catering|private event|buyout|wedding|corporate event|banquet)\b/.test(normalized)) {
    return reply(
      "private_event",
      "I can send that to the events team. What date, party size, event type, and callback information should I include?",
      "low_confidence",
    );
  }

  if (/\b(large party|party of (?:[8-9]|[1-9][0-9])|group of (?:[8-9]|[1-9][0-9]))\b/.test(normalized)) {
    return reply(
      "large_party",
      "Large parties need staff confirmation. What date, time, party size, name, and callback number should I send over?",
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

  if (/\b(wait time|how long is the wait|waitlist|walk in|walk-in)\b/.test(normalized)) {
    return reply(
      "wait_time",
      "I do not have a live waitlist view yet. Walk-in wait times can change quickly, so staff can confirm when you arrive.",
    );
  }

  if (/\b(reservation|reserve|book a table|table for)\b/.test(normalized)) {
    return reply(
      "reservation",
      "I can help with a reservation request. What date, time, party size, and name should I send to the staff?",
    );
  }

  if (/\b(order status|is my order ready|how much longer|pickup ready)\b/.test(normalized)) {
    return reply(
      "order_status",
      "I do not have live kitchen status yet. I can flag staff to check; what name is the order under?",
      "handoff",
    );
  }

  if (/\b(hour|open|close|closing|tonight|today)\b/.test(normalized)) {
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

  if (/\b(pickup|takeout|take out|to go)\b/.test(normalized)) {
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

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

function compactPhoneReply(value: string) {
  if (value.length <= 320) return value;

  const compact = value.slice(0, 320);
  const lastSentence = Math.max(compact.lastIndexOf("."), compact.lastIndexOf("?"), compact.lastIndexOf("!"));
  return lastSentence > 120 ? compact.slice(0, lastSentence + 1) : `${compact.trim()}...`;
}
