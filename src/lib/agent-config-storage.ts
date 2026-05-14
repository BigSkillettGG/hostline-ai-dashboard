import { defaultRestaurantAgentConfig, type RestaurantAgentConfig } from "@/domain/restaurant-config";
import {
  findSignalHostVoiceProfile,
  getSignalHostVoiceProfile,
  normalizeSignalHostVoiceGender,
  normalizeSignalHostVoiceProfileId,
} from "@/domain/voice-selection";

const storageKey = "signalhost:agent-config";

export function loadAgentConfigDraft(): RestaurantAgentConfig | null {
  if (typeof window === "undefined") return null;

  const rawConfig = window.localStorage.getItem(storageKey);
  if (!rawConfig) return null;

  try {
    const parsed = JSON.parse(rawConfig) as Partial<RestaurantAgentConfig>;
    const voiceProfile =
      [parsed.voiceProfileId, parsed.hostName, parsed.voiceGender]
        .map(findSignalHostVoiceProfile)
        .find(Boolean) ?? getSignalHostVoiceProfile(undefined);
    return {
      ...defaultRestaurantAgentConfig,
      ...parsed,
      hostName: voiceProfile.employeeName,
      voiceGender: normalizeSignalHostVoiceGender(voiceProfile.id),
      voiceProfileId: normalizeSignalHostVoiceProfileId(voiceProfile.id),
    };
  } catch {
    return null;
  }
}

export function saveAgentConfigDraft(config: RestaurantAgentConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(config));
}
