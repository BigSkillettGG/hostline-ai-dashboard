export type HostlineVoiceGender = "female" | "male";

export interface HostlineVoiceProfile {
  label: string;
  shortLabel: string;
  voiceId: string;
}

export const hostlineVoiceProfiles: Record<HostlineVoiceGender, HostlineVoiceProfile> = {
  female: {
    label: "Female - Eve",
    shortLabel: "Eve",
    voiceId: "BZgkqPqms7Kj9ulSkVzn",
  },
  male: {
    label: "Male - Michael",
    shortLabel: "Michael",
    voiceId: "ljX1ZrXuDIIRVcmiVSyR",
  },
};

export function normalizeHostlineVoiceGender(value: unknown): HostlineVoiceGender {
  if (typeof value !== "string") return "female";

  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized.startsWith("male ") || normalized.includes("michael")) return "male";
  return "female";
}

export function resolveHostlineVoiceId(
  gender: HostlineVoiceGender,
  overrides: Partial<Record<HostlineVoiceGender, string>> = {},
) {
  return overrides[gender]?.trim() || hostlineVoiceProfiles[gender].voiceId;
}

export function buildTwilioElevenLabsVoice({
  gender,
  modelId = "flash_v2_5",
  overrides,
  similarityBoost = "0.85",
  speed = "0.95",
  stability = "0.35",
}: {
  gender: HostlineVoiceGender;
  modelId?: string;
  overrides?: Partial<Record<HostlineVoiceGender, string>>;
  similarityBoost?: string;
  speed?: string;
  stability?: string;
}) {
  return `${resolveHostlineVoiceId(gender, overrides)}-${modelId}-${speed}_${stability}_${similarityBoost}`;
}
