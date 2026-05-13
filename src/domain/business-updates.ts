export type BusinessMode =
  | "normal"
  | "busy"
  | "after_hours"
  | "emergency"
  | "holiday"
  | "promo"
  | "staffing_shortage";

export type TemporaryUpdateType =
  | "closure"
  | "event"
  | "hours"
  | "policy"
  | "promotion"
  | "service_status"
  | "special"
  | "staffing";

export type TemporaryUpdateExpiration =
  | "today_close"
  | "tomorrow_close"
  | "custom"
  | "until_cleared";

export interface TemporaryBusinessUpdate {
  body: string;
  createdAt: string;
  expiresAt?: string;
  expiration: TemporaryUpdateExpiration;
  id: string;
  mode?: BusinessMode;
  source?: "dashboard" | "owner_text" | "staff";
  title: string;
  type: TemporaryUpdateType;
}

export interface BusinessModeConfig {
  description: string;
  id: BusinessMode;
  label: string;
  operatorCue: string;
  urgency: "low" | "normal" | "high" | "urgent";
}

export interface BusinessLiveContext {
  activeMode: BusinessModeConfig;
  activeUpdates: TemporaryBusinessUpdate[];
  expiredUpdates: TemporaryBusinessUpdate[];
  instructionBlock: string;
  nextExpiration?: string;
}

export const businessModes: BusinessModeConfig[] = [
  {
    description: "Default behavior for normal business conditions.",
    id: "normal",
    label: "Normal",
    operatorCue: "Answer normally using the permanent knowledge base and active temporary updates.",
    urgency: "normal",
  },
  {
    description: "High demand period. Keep answers concise and route important work cleanly.",
    id: "busy",
    label: "Busy",
    operatorCue: "Be concise, avoid long explanations, and prioritize orders, bookings, and urgent callbacks.",
    urgency: "high",
  },
  {
    description: "Business is closed or front desk is unavailable.",
    id: "after_hours",
    label: "After hours",
    operatorCue: "Capture requests, send approved links, and avoid promising same-day staff response unless configured.",
    urgency: "normal",
  },
  {
    description: "Urgent demand surge or safety-sensitive operating condition.",
    id: "emergency",
    label: "Emergency",
    operatorCue: "Triage urgent issues first, capture callback details, and escalate safety-sensitive requests.",
    urgency: "urgent",
  },
  {
    description: "Holiday hours, special menus, or unusual date-specific rules are active.",
    id: "holiday",
    label: "Holiday",
    operatorCue: "Use holiday-specific hours, menus, deposits, and availability before regular policies.",
    urgency: "high",
  },
  {
    description: "A promotion, special offer, or campaign should be mentioned when relevant.",
    id: "promo",
    label: "Promo",
    operatorCue: "Mention active promotions naturally when they match the caller's intent.",
    urgency: "normal",
  },
  {
    description: "The business is short staffed or running behind.",
    id: "staffing_shortage",
    label: "Staffing shortage",
    operatorCue: "Set expectations gently, capture requests, and avoid promising immediate staff availability.",
    urgency: "high",
  },
];

export const temporaryUpdateTypeLabels: Record<TemporaryUpdateType, string> = {
  closure: "Closure",
  event: "Event",
  hours: "Hours",
  policy: "Policy",
  promotion: "Promotion",
  service_status: "Service status",
  special: "Special",
  staffing: "Staffing",
};

export const expirationLabels: Record<TemporaryUpdateExpiration, string> = {
  custom: "Custom date/time",
  today_close: "Today only",
  tomorrow_close: "Through tomorrow",
  until_cleared: "Until cleared",
};

export function buildBusinessLiveContext({
  mode,
  now = new Date(),
  updates,
}: {
  mode: BusinessMode;
  now?: Date;
  updates: TemporaryBusinessUpdate[];
}): BusinessLiveContext {
  const activeMode = getBusinessMode(mode);
  const activeUpdates = updates
    .filter((update) => !isExpiredTemporaryUpdate(update, now) && (!update.mode || update.mode === mode))
    .sort(sortTemporaryUpdates);
  const expiredUpdates = updates
    .filter((update) => isExpiredTemporaryUpdate(update, now))
    .sort(sortTemporaryUpdates);
  const nextExpiration = activeUpdates
    .map((update) => update.expiresAt)
    .filter((value): value is string => Boolean(value))
    .sort((first, second) => new Date(first).getTime() - new Date(second).getTime())[0];

  return {
    activeMode,
    activeUpdates,
    expiredUpdates,
    instructionBlock: buildInstructionBlock(activeMode, activeUpdates),
    nextExpiration,
  };
}

export function createTemporaryUpdate(input: {
  body: string;
  createdAt?: string;
  customExpiresAt?: string;
  expiration: TemporaryUpdateExpiration;
  id?: string;
  mode?: BusinessMode;
  now?: Date;
  title: string;
  type: TemporaryUpdateType;
}): TemporaryBusinessUpdate {
  const now = input.now ?? new Date();
  return {
    body: input.body.trim(),
    createdAt: input.createdAt ?? now.toISOString(),
    expiresAt: resolveTemporaryUpdateExpiration({
      customExpiresAt: input.customExpiresAt,
      expiration: input.expiration,
      now,
    }),
    expiration: input.expiration,
    id: input.id ?? crypto.randomUUID(),
    mode: input.mode,
    source: "dashboard",
    title: input.title.trim(),
    type: input.type,
  };
}

export function resolveTemporaryUpdateExpiration({
  customExpiresAt,
  expiration,
  now = new Date(),
}: {
  customExpiresAt?: string;
  expiration: TemporaryUpdateExpiration;
  now?: Date;
}) {
  if (expiration === "until_cleared") return undefined;
  if (expiration === "custom") return customExpiresAt ? new Date(customExpiresAt).toISOString() : undefined;
  if (expiration === "today_close") return endOfLocalDay(now, 0).toISOString();
  return endOfLocalDay(now, 1).toISOString();
}

export function isExpiredTemporaryUpdate(update: Pick<TemporaryBusinessUpdate, "expiresAt">, now = new Date()) {
  if (!update.expiresAt) return false;
  return new Date(update.expiresAt).getTime() <= now.getTime();
}

export function getBusinessMode(mode: BusinessMode) {
  return businessModes.find((item) => item.id === mode) ?? businessModes[0];
}

export function summarizeLiveContext(context: BusinessLiveContext) {
  const updateCount = context.activeUpdates.length;
  const expiration = context.nextExpiration ? ` Next expiration: ${formatShortDateTime(context.nextExpiration)}.` : "";
  return `${context.activeMode.label} mode is active with ${updateCount} live update${updateCount === 1 ? "" : "s"}.${expiration}`;
}

function buildInstructionBlock(mode: BusinessModeConfig, updates: TemporaryBusinessUpdate[]) {
  const lines = [
    `Business mode: ${mode.label}`,
    `Mode instruction: ${mode.operatorCue}`,
  ];

  if (updates.length) {
    lines.push("Active temporary updates:");
    updates.forEach((update) => {
      const expiry = update.expiresAt ? ` Expires ${formatShortDateTime(update.expiresAt)}.` : " Active until cleared.";
      lines.push(`- ${temporaryUpdateTypeLabels[update.type]}: ${update.title}. ${update.body}${expiry}`);
    });
  } else {
    lines.push("Active temporary updates: none.");
  }

  return lines.join("\n");
}

function sortTemporaryUpdates(first: TemporaryBusinessUpdate, second: TemporaryBusinessUpdate) {
  const modeDelta = Number(Boolean(second.mode)) - Number(Boolean(first.mode));
  if (modeDelta) return modeDelta;

  const expiryA = first.expiresAt ? new Date(first.expiresAt).getTime() : Number.POSITIVE_INFINITY;
  const expiryB = second.expiresAt ? new Date(second.expiresAt).getTime() : Number.POSITIVE_INFINITY;
  if (expiryA !== expiryB) return expiryA - expiryB;

  return new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
}

function endOfLocalDay(now: Date, daysFromNow: number) {
  const date = new Date(now);
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatShortDateTime(value: string) {
  try {
    return new Intl.DateTimeFormat("en-US", {
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      month: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
