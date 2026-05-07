import { defaultRestaurantAgentConfig, type RestaurantAgentConfig } from "@/domain/restaurant-config";
import { normalizeHostlineVoiceGender } from "@/domain/voice-selection";

const storageKey = "hostline:agent-config";

export function loadAgentConfigDraft(): RestaurantAgentConfig | null {
  if (typeof window === "undefined") return null;

  const rawConfig = window.localStorage.getItem(storageKey);
  if (!rawConfig) return null;

  try {
    const parsed = JSON.parse(rawConfig) as Partial<RestaurantAgentConfig>;
    return {
      ...defaultRestaurantAgentConfig,
      ...parsed,
      voiceGender: normalizeHostlineVoiceGender(parsed.voiceGender ?? defaultRestaurantAgentConfig.voiceGender),
    };
  } catch {
    return null;
  }
}

export function saveAgentConfigDraft(config: RestaurantAgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(config));
}
