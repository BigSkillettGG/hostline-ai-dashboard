import {
  createTemporaryUpdate,
  getBusinessMode,
  type BusinessMode,
  type TemporaryBusinessUpdate,
  type TemporaryUpdateExpiration,
} from "@/domain/business-updates";

export type OwnerLiveCommand =
  | {
      confirmation: string;
      kind: "add_update";
      update: TemporaryBusinessUpdate;
    }
  | {
      confirmation: string;
      kind: "set_mode";
      mode: BusinessMode;
    };

export function parseOwnerLiveCommand(message: string, now = new Date()): OwnerLiveCommand | null {
  const text = normalizeWhitespace(message);
  if (!text) return null;

  const mode = parseModeCommand(text);
  if (mode) {
    const label = getBusinessMode(mode).label;
    return {
      confirmation: `Got it. ${label} mode is now active for live customer conversations.`,
      kind: "set_mode",
      mode,
    };
  }

  return (
    parseSpecialUpdate(text, now) ??
    parseClosureUpdate(text, now) ??
    parseRunningBehindUpdate(text, now) ??
    parseStaffingUpdate(text, now) ??
    parseBookedUpdate(text, now) ??
    parsePatioUpdate(text, now) ??
    parsePromotionUpdate(text, now)
  );
}

function parseModeCommand(text: string): BusinessMode | null {
  const lower = text.toLowerCase();
  const modeMatch = lower.match(
    /\b(?:set|switch|use|turn on|go into|put us in|put the business in)\s+(normal|busy|after[-\s]?hours|emergency|holiday|promo|promotion|staffing shortage|short staffed)\s+mode\b/,
  ) ?? lower.match(/\b(normal|busy|after[-\s]?hours|emergency|holiday|promo|promotion|staffing shortage)\s+mode\b/);
  if (!modeMatch) return null;

  return toBusinessMode(modeMatch[1]);
}

function parseSpecialUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const detail = extractDetail(text, [
    /\b(?:tonight'?s|today'?s)\s+specials?\s+(?:is|are|=|:)\s+(.+)$/i,
    /\bspecials?\s+(?:tonight|today)\s+(?:is|are|=|:)\s+(.+)$/i,
    /\b(?:set|add|update)\s+(?:tonight'?s|today'?s)?\s*specials?\s+(?:to|as|is|are|=|:)\s+(.+)$/i,
  ]);
  if (!detail) return null;

  const title = text.toLowerCase().includes("today") ? "Today's special" : "Tonight's special";
  const update = buildUpdate({
    body: `${title}: ${trimSentence(detail)}. Mention it naturally when callers ask about specials.`,
    expiration: "today_close",
    now,
    title,
    type: "special",
  });

  return {
    confirmation: `Got it. I added ${title.toLowerCase()} as a live update for today.`,
    kind: "add_update",
    update,
  };
}

function parseClosureUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\bclosed\b/.test(lower) && !/\bclosing\b/.test(lower)) return null;
  if (!/\b(today|tonight|tomorrow|temporarily|until|for)\b/.test(lower)) return null;

  const tomorrow = /\btomorrow\b/.test(lower);
  const today = /\b(today|tonight)\b/.test(lower);
  const title = tomorrow ? "Closed tomorrow" : today ? "Closed today" : "Temporary closure";
  const expiration: TemporaryUpdateExpiration = tomorrow ? "tomorrow_close" : today ? "today_close" : "until_cleared";
  const body = `Tell callers: ${trimSentence(text)}. Capture urgent requests and offer approved links or a callback instead of promising immediate service.`;
  const update = buildUpdate({
    body,
    expiration,
    mode: "holiday",
    now,
    title,
    type: "closure",
  });

  return {
    confirmation: `Got it. I added ${title.toLowerCase()} as a live closure update.`,
    kind: "add_update",
    update,
  };
}

function parseRunningBehindUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\b(running|about|behind|delay|delayed|backed up)\b/.test(lower)) return null;
  if (!/\bbehind|delay|delayed|backed up\b/.test(lower)) return null;

  const detail = trimSentence(text);
  const update = buildUpdate({
    body: `Tell callers the team is ${detail.toLowerCase().startsWith("we") ? detail.replace(/^we(?:'re| are)\s+/i, "") : detail}. Set expectations gently and avoid exact promises unless the caller asks for current timing.`,
    expiration: "today_close",
    mode: "staffing_shortage",
    now,
    title: "Running behind",
    type: "service_status",
  });

  return {
    confirmation: "Got it. I added the running-behind note for today.",
    kind: "add_update",
    update,
  };
}

function parseStaffingUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\b(out sick|short staffed|short-staffed|staffing shortage|understaffed|called out)\b/.test(lower)) return null;

  const update = buildUpdate({
    body: `Staffing update: ${trimSentence(text)}. Set expectations gently, route requests to approved links, and avoid promising immediate staff availability.`,
    expiration: "today_close",
    mode: "staffing_shortage",
    now,
    title: "Staffing update",
    type: "staffing",
  });

  return {
    confirmation: "Got it. I added that staffing update for today.",
    kind: "add_update",
    update,
  };
}

function parseBookedUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\b(fully booked|booked up|no availability|sold out)\b/.test(lower)) return null;

  const tomorrow = /\btomorrow\b/.test(lower);
  const update = buildUpdate({
    body: `Tell callers: ${trimSentence(text)}. Offer the approved booking link, waitlist, or callback path when helpful.`,
    expiration: tomorrow ? "tomorrow_close" : "today_close",
    now,
    title: tomorrow ? "Booked tomorrow" : "Booked tonight",
    type: "service_status",
  });

  return {
    confirmation: "Got it. I added the availability note.",
    kind: "add_update",
    update,
  };
}

function parsePatioUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\bpatio\b/.test(lower)) return null;
  if (!/\b(open|closed|first come|weather|available|unavailable|seating)\b/.test(lower)) return null;

  const update = buildUpdate({
    body: `Patio update: ${trimSentence(text)}. Use this when callers ask about outdoor seating.`,
    expiration: "today_close",
    now,
    title: "Patio update",
    type: "service_status",
  });

  return {
    confirmation: "Got it. I added the patio update for today.",
    kind: "add_update",
    update,
  };
}

function parsePromotionUpdate(text: string, now: Date): OwnerLiveCommand | null {
  const lower = text.toLowerCase();
  if (!/\b(happy hour|promotion|promo|discount|offer|deal)\b/.test(lower)) return null;
  if (!/\b(is|are|starts|runs|today|tonight|until|through|:)\b/.test(lower)) return null;

  const update = buildUpdate({
    body: `Promotion update: ${trimSentence(text)}. Mention this only when relevant to the caller's question or booking intent.`,
    expiration: /\buntil cleared|ongoing\b/.test(lower) ? "until_cleared" : "today_close",
    now,
    title: lower.includes("happy hour") ? "Happy hour update" : "Promotion update",
    type: "promotion",
  });

  return {
    confirmation: "Got it. I added that promotion as a live update.",
    kind: "add_update",
    update,
  };
}

function buildUpdate(input: {
  body: string;
  expiration: TemporaryUpdateExpiration;
  mode?: BusinessMode;
  now: Date;
  title: string;
  type: Parameters<typeof createTemporaryUpdate>[0]["type"];
}) {
  return createTemporaryUpdate({
    body: input.body,
    expiration: input.expiration,
    mode: input.mode,
    now: input.now,
    source: "owner_text",
    title: input.title,
    type: input.type,
  });
}

function extractDetail(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]?.trim()) return match[1].trim();
  }
  return "";
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function trimSentence(value: string) {
  return normalizeWhitespace(value).replace(/[.!?]+$/g, "");
}

function toBusinessMode(value: string): BusinessMode | null {
  const normalized = value.replace(/[-\s]+/g, "_");
  if (normalized === "normal") return "normal";
  if (normalized === "busy") return "busy";
  if (normalized === "after_hours") return "after_hours";
  if (normalized === "emergency") return "emergency";
  if (normalized === "holiday") return "holiday";
  if (normalized === "promo" || normalized === "promotion") return "promo";
  if (normalized === "staffing_shortage" || normalized === "short_staffed") return "staffing_shortage";
  return null;
}
