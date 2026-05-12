export type SignalHostVoiceGender = "female" | "male";

export interface SignalHostVoiceProfile {
  label: string;
  shortLabel: string;
  voiceId: string;
}

export const signalHostVoiceProfiles: Record<SignalHostVoiceGender, SignalHostVoiceProfile> = {
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

export function normalizeSignalHostVoiceGender(value: unknown): SignalHostVoiceGender {
  if (typeof value !== "string") return "female";

  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized.startsWith("male ") || normalized.includes("michael")) return "male";
  return "female";
}

export function resolveSignalHostVoiceId(
  gender: SignalHostVoiceGender,
  overrides: Partial<Record<SignalHostVoiceGender, string>> = {},
) {
  return overrides[gender]?.trim() || signalHostVoiceProfiles[gender].voiceId;
}

export function buildTwilioElevenLabsVoice({
  gender,
  modelId = "flash_v2_5",
  overrides,
  similarityBoost = "0.85",
  speed = "0.95",
  stability = "0.35",
}: {
  gender: SignalHostVoiceGender;
  modelId?: string;
  overrides?: Partial<Record<SignalHostVoiceGender, string>>;
  similarityBoost?: string;
  speed?: string;
  stability?: string;
}) {
  return `${resolveSignalHostVoiceId(gender, overrides)}-${modelId}-${speed}_${stability}_${similarityBoost}`;
}
