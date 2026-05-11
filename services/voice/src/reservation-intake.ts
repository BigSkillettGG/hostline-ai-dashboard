export interface CapturedReservationRequest {
  confidence: number;
  date: string;
  guestName?: string;
  notes?: string;
  partySize: number;
  time: string;
}

export interface CapturedReservationDetails {
  date?: string;
  guestName?: string;
  notes?: string;
  partySize?: number;
  time?: string;
}

export interface ReservationCaptureOptions {
  allowBarePartySize?: boolean;
  now?: Date;
  requireIntent?: boolean;
}

const reservationIntentPattern = /\b(reservation|reserve|book|booking|table)\b/i;
const numberWords: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};
const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const months: Record<string, number> = {
  apr: 3,
  april: 3,
  aug: 7,
  august: 7,
  dec: 11,
  december: 11,
  feb: 1,
  february: 1,
  jan: 0,
  january: 0,
  jul: 6,
  july: 6,
  jun: 5,
  june: 5,
  mar: 2,
  march: 2,
  may: 4,
  nov: 10,
  november: 10,
  oct: 9,
  october: 9,
  sep: 8,
  sept: 8,
  september: 8,
};

export function hasReservationIntent(utterance: string) {
  return reservationIntentPattern.test(utterance);
}

export function captureReservationRequest(
  utterance: string,
  options: ReservationCaptureOptions = {},
): CapturedReservationRequest | null {
  const details = captureReservationDetails(utterance, options);
  if (!details?.partySize || !details.date || !details.time) return null;

  const detailCount = [details.partySize, details.date, details.time, details.guestName, details.notes].filter(Boolean).length;

  return {
    confidence: Math.min(95, 45 + detailCount * 10),
    date: details.date,
    guestName: details.guestName,
    notes: details.notes,
    partySize: details.partySize,
    time: details.time,
  };
}

export function captureReservationDetails(
  utterance: string,
  options: ReservationCaptureOptions = {},
): CapturedReservationDetails | null {
  const requireIntent = options.requireIntent ?? true;
  if (requireIntent && !hasReservationIntent(utterance)) return null;

  const now = options.now ?? new Date();
  const details: CapturedReservationDetails = {
    date: captureDate(utterance, now),
    guestName: captureGuestName(utterance),
    notes: captureNotes(utterance),
    partySize: capturePartySize(utterance, options.allowBarePartySize),
    time: captureTime(utterance),
  };

  return hasAnyReservationDetail(details) ? details : null;
}

export function mergeReservationDetails(
  current: CapturedReservationDetails | undefined,
  update: CapturedReservationDetails | null,
): CapturedReservationDetails | undefined {
  if (!update) return current;
  return {
    ...current,
    ...removeUndefinedValues(update),
  };
}

export function completeReservationRequestFromDetails(
  details: CapturedReservationDetails | undefined,
): CapturedReservationRequest | null {
  if (!details?.partySize || !details.date || !details.time) return null;

  const detailCount = [details.partySize, details.date, details.time, details.guestName, details.notes].filter(Boolean).length;
  return {
    confidence: Math.min(95, 45 + detailCount * 10),
    date: details.date,
    guestName: details.guestName,
    notes: details.notes,
    partySize: details.partySize,
    time: details.time,
  };
}

function capturePartySize(utterance: string, allowBarePartySize = false) {
  if (allowBarePartySize) {
    const bareCount = utterance.match(/^\s*(?:just\s+)?(\d{1,2}|[a-z]+)(?:\s*(?:people|guests|persons|tops?))?\s*\.?\s*$/i);
    const value = bareCount?.[1] ? parseCount(bareCount[1]) : undefined;
    if (value && value <= 50) return value;
  }

  const patterns = [
    /\bparty\s+of\s+(\d{1,2}|[a-z]+)\b/i,
    /\btable\s+for\s+(\d{1,2}|[a-z]+)\b/i,
    /\bfor\s+(\d{1,2}|[a-z]+)\s+(?:people|guests|persons|tops?)\b/i,
    /\b(\d{1,2}|[a-z]+)\s+(?:people|guests|persons|tops?)\b/i,
  ];

  for (const pattern of patterns) {
    const match = utterance.match(pattern);
    const value = match?.[1] ? parseCount(match[1]) : undefined;
    if (value && value <= 50) return value;
  }

  return undefined;
}

function captureDate(utterance: string, now: Date) {
  const normalized = utterance.toLowerCase();

  if (/\b(today|tonight)\b/.test(normalized)) return formatDate(now);
  if (/\btomorrow\b/.test(normalized)) return formatDate(addDays(now, 1));

  const numericDate = normalized.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (numericDate) {
    const month = Number(numericDate[1]) - 1;
    const day = Number(numericDate[2]);
    const year = normalizeYear(numericDate[3], now.getFullYear());
    return formatDate(rollForwardIfPast(new Date(year, month, day), now));
  }

  const monthDate = normalized.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  if (monthDate) {
    const month = months[monthDate[1]];
    const day = Number(monthDate[2]);
    return formatDate(rollForwardIfPast(new Date(now.getFullYear(), month, day), now));
  }

  const weekdayMatch = normalized.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (weekdayMatch) {
    const targetDay = weekdays.indexOf(weekdayMatch[2]);
    const nextModifier = Boolean(weekdayMatch[1]);
    let daysAhead = (targetDay - now.getDay() + 7) % 7;
    if (daysAhead === 0 || nextModifier) daysAhead += 7;
    return formatDate(addDays(now, daysAhead));
  }

  return undefined;
}

function captureTime(utterance: string) {
  const explicit = utterance.match(/\b(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if (explicit) {
    const hour = Number(explicit[1]);
    const minute = explicit[2] ? Number(explicit[2]) : 0;
    const period = explicit[3].toLowerCase().startsWith("p") ? "pm" : "am";
    return formatTime(hourTo24(hour, period), minute);
  }

  const implied = utterance.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/i);
  if (!implied) return undefined;

  const hour = Number(implied[1]);
  const minute = implied[2] ? Number(implied[2]) : 0;
  if (hour > 23 || minute > 59) return undefined;

  const restaurantDinnerHour = hour >= 1 && hour <= 11 ? hour + 12 : hour;
  return formatTime(restaurantDinnerHour, minute);
}

function captureGuestName(utterance: string) {
  const patterns = [
    /\bunder\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\bname(?:'s| is)?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
    /\bfor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  ];
  const blocked = new Set(["Today", "Tonight", "Tomorrow", "Friday", "Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"]);

  for (const pattern of patterns) {
    const name = utterance.match(pattern)?.[1]?.trim();
    if (name && !blocked.has(name.split(/\s+/)[0])) return name;
  }

  return undefined;
}

function captureNotes(utterance: string) {
  const notes = [
    [/\bbirthday\b/i, "Birthday"],
    [/\banniversary\b/i, "Anniversary"],
    [/\bpatio|outside|outdoor\b/i, "Outdoor seating requested"],
    [/\bquiet\b/i, "Quiet table requested"],
    [/\bhigh chair|highchair\b/i, "High chair requested"],
    [/\bwheelchair|accessible\b/i, "Accessibility note"],
    [/\ballerg/i, "Allergy note"],
  ]
    .filter(([pattern]) => (pattern as RegExp).test(utterance))
    .map(([, note]) => note as string);

  return notes.length ? notes.join("; ") : undefined;
}

function parseCount(value: string) {
  if (/^\d+$/.test(value)) return Number(value);
  return numberWords[value.toLowerCase()];
}

function normalizeYear(value: string | undefined, fallbackYear: number) {
  if (!value) return fallbackYear;
  const year = Number(value);
  return year < 100 ? 2000 + year : year;
}

function rollForwardIfPast(date: Date, now: Date) {
  if (date < startOfDay(now)) {
    return new Date(date.getFullYear() + 1, date.getMonth(), date.getDate());
  }
  return date;
}

function hourTo24(hour: number, period: "am" | "pm") {
  if (period === "am") return hour === 12 ? 0 : hour;
  return hour === 12 ? 12 : hour + 12;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTime(hour: number, minute: number) {
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return undefined;
  return `${pad(hour)}:${pad(minute)}`;
}

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function hasAnyReservationDetail(details: CapturedReservationDetails) {
  return Boolean(details.date || details.guestName || details.notes || details.partySize || details.time);
}

function removeUndefinedValues(details: CapturedReservationDetails) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined)) as CapturedReservationDetails;
}
