import {
  businessModes,
  createTemporaryUpdate,
  type BusinessMode,
  type TemporaryBusinessUpdate,
  type TemporaryUpdateExpiration,
  type TemporaryUpdateType,
} from "@/domain/business-updates";

export interface BusinessLiveState {
  mode: BusinessMode;
  updatedAt: string;
  updates: TemporaryBusinessUpdate[];
}

export const businessLiveUpdatesEvent = "signalhost:business-live-state-changed";
export const businessLiveUpdatesStorageKey = "signalhost:business-live-state:v1";

export function createDefaultBusinessLiveUpdates(now = new Date()): TemporaryBusinessUpdate[] {
  return [
    createTemporaryUpdate({
      body: "Tonight's specials are roasted branzino, mushroom risotto, and burrata with stone fruit. Mention that specials can sell out.",
      expiration: "today_close",
      id: "demo-specials",
      now,
      title: "Tonight's specials",
      type: "special",
    }),
    createTemporaryUpdate({
      body: "If callers ask about patio seating tonight, say the patio is open but seating is first come, first served because of the weather.",
      expiration: "today_close",
      id: "demo-patio",
      now,
      title: "Patio seating note",
      type: "service_status",
    }),
  ];
}

export function loadBusinessLiveState(options: { defaultUpdates?: TemporaryBusinessUpdate[] } = {}): BusinessLiveState {
  const fallback = createFallbackState(options.defaultUpdates);
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(businessLiveUpdatesStorageKey);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<BusinessLiveState>;
    const hasStoredUpdates = Array.isArray(parsed.updates);

    return {
      mode: isBusinessMode(parsed.mode) ? parsed.mode : fallback.mode,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : fallback.updatedAt,
      updates: hasStoredUpdates ? parsed.updates!.filter(isTemporaryBusinessUpdate) : fallback.updates,
    };
  } catch {
    return fallback;
  }
}

export function saveBusinessLiveState(state: Pick<BusinessLiveState, "mode" | "updates"> & { updatedAt?: string }) {
  const next: BusinessLiveState = {
    mode: isBusinessMode(state.mode) ? state.mode : "normal",
    updatedAt: state.updatedAt ?? new Date().toISOString(),
    updates: state.updates.filter(isTemporaryBusinessUpdate),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(businessLiveUpdatesStorageKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent<BusinessLiveState>(businessLiveUpdatesEvent, { detail: next }));
  }

  return next;
}

function createFallbackState(defaultUpdates?: TemporaryBusinessUpdate[]): BusinessLiveState {
  return {
    mode: "normal",
    updatedAt: new Date().toISOString(),
    updates: defaultUpdates ?? createDefaultBusinessLiveUpdates(),
  };
}

function isBusinessMode(value: unknown): value is BusinessMode {
  return typeof value === "string" && businessModes.some((mode) => mode.id === value);
}

function isTemporaryBusinessUpdate(value: unknown): value is TemporaryBusinessUpdate {
  if (!value || typeof value !== "object") return false;
  const update = value as Partial<TemporaryBusinessUpdate>;

  return (
    typeof update.body === "string" &&
    typeof update.createdAt === "string" &&
    typeof update.expiration === "string" &&
    isTemporaryUpdateExpiration(update.expiration) &&
    typeof update.id === "string" &&
    typeof update.title === "string" &&
    typeof update.type === "string" &&
    isTemporaryUpdateType(update.type) &&
    (update.mode === undefined || isBusinessMode(update.mode)) &&
    (update.source === undefined || update.source === "dashboard" || update.source === "owner_text" || update.source === "staff")
  );
}

function isTemporaryUpdateExpiration(value: string): value is TemporaryUpdateExpiration {
  return value === "today_close" || value === "tomorrow_close" || value === "custom" || value === "until_cleared";
}

function isTemporaryUpdateType(value: string): value is TemporaryUpdateType {
  return (
    value === "closure" ||
    value === "event" ||
    value === "hours" ||
    value === "policy" ||
    value === "promotion" ||
    value === "service_status" ||
    value === "special" ||
    value === "staffing"
  );
}
