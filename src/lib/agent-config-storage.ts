import type { RestaurantAgentConfig } from "@/domain/restaurant-config";

const storageKey = "hostline:agent-config";

export function loadAgentConfigDraft(): RestaurantAgentConfig | null {
  if (typeof window === "undefined") return null;

  const rawConfig = window.localStorage.getItem(storageKey);
  if (!rawConfig) return null;

  try {
    return JSON.parse(rawConfig) as RestaurantAgentConfig;
  } catch {
    return null;
  }
}

export function saveAgentConfigDraft(config: RestaurantAgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(config));
}
