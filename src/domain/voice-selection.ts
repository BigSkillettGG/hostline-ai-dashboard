export type SignalHostVoiceGender = "female" | "male";
export type SignalHostVoiceProfileId = "marco" | "maya" | "theo" | "vera";
export type SignalHostOpenAIVoiceId = "cedar" | "coral" | "marin" | "verse";

export interface SignalHostVoiceProfile {
  description: string;
  employeeName: string;
  gender: SignalHostVoiceGender;
  id: SignalHostVoiceProfileId;
  label: string;
  openAIRealtimeVoice: SignalHostOpenAIVoiceId;
  shortLabel: string;
}

export const signalHostVoiceRoster: SignalHostVoiceProfile[] = [
  {
    description: "Warm, polished, and steady. Best default for restaurants, salons, and hospitality-heavy teams.",
    employeeName: "Vera",
    gender: "female",
    id: "vera",
    label: "Vera - warm female",
    openAIRealtimeVoice: "marin",
    shortLabel: "Vera",
  },
  {
    description: "Bright, friendly, and clear. Good for quick front-desk answers and upbeat service brands.",
    employeeName: "Maya",
    gender: "female",
    id: "maya",
    label: "Maya - bright female",
    openAIRealtimeVoice: "coral",
    shortLabel: "Maya",
  },
  {
    description: "Calm, confident, and conversational. Good for trades, dispatch, and professional service teams.",
    employeeName: "Marco",
    gender: "male",
    id: "marco",
    label: "Marco - calm male",
    openAIRealtimeVoice: "cedar",
    shortLabel: "Marco",
  },
  {
    description: "Crisp, measured, and reassuring. Good for urgent calls, estimates, and appointment-heavy workflows.",
    employeeName: "Theo",
    gender: "male",
    id: "theo",
    label: "Theo - crisp male",
    openAIRealtimeVoice: "verse",
    shortLabel: "Theo",
  },
];

export const signalHostVoiceProfilesById = Object.fromEntries(
  signalHostVoiceRoster.map((profile) => [profile.id, profile]),
) as Record<SignalHostVoiceProfileId, SignalHostVoiceProfile>;

export const signalHostVoiceProfiles: Record<SignalHostVoiceGender, SignalHostVoiceProfile> = {
  female: signalHostVoiceProfilesById.vera,
  male: signalHostVoiceProfilesById.marco,
};

export function normalizeSignalHostVoiceGender(value: unknown): SignalHostVoiceGender {
  const profile = signalHostVoiceProfilesById[normalizeSignalHostVoiceProfileId(value)];
  if (profile) return profile.gender;

  if (typeof value !== "string") return "female";

  const normalized = value.trim().toLowerCase();
  if (normalized === "male" || normalized.startsWith("male ") || normalized.includes("michael")) return "male";
  return "female";
}

export function normalizeSignalHostVoiceProfileId(value: unknown): SignalHostVoiceProfileId {
  return findSignalHostVoiceProfile(value)?.id ?? "vera";
}

export function findSignalHostVoiceProfile(value: unknown): SignalHostVoiceProfile | undefined {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, " ");
  if (normalized.includes("maya")) return signalHostVoiceProfilesById.maya;
  if (normalized.includes("marco") || normalized.includes("michael") || normalized === "male") {
    return signalHostVoiceProfilesById.marco;
  }
  if (normalized.includes("theo")) return signalHostVoiceProfilesById.theo;
  if (normalized.includes("vera") || normalized.includes("eve") || normalized === "female") {
    return signalHostVoiceProfilesById.vera;
  }
  return undefined;
}

export function getSignalHostVoiceProfile(value: unknown): SignalHostVoiceProfile {
  return signalHostVoiceProfilesById[normalizeSignalHostVoiceProfileId(value)];
}

export function resolveSignalHostVoiceId(
  voice: SignalHostVoiceGender | SignalHostVoiceProfileId,
  overrides: Partial<Record<SignalHostVoiceGender | SignalHostVoiceProfileId, string>> = {},
) {
  const profile = signalHostVoiceProfilesById[normalizeSignalHostVoiceProfileId(voice)];
  const gender = normalizeSignalHostVoiceGender(voice);
  const legacyVoiceId = gender === "male" ? "ljX1ZrXuDIIRVcmiVSyR" : "BZgkqPqms7Kj9ulSkVzn";
  return overrides[profile.id]?.trim() || overrides[gender]?.trim() || legacyVoiceId;
}

export function resolveSignalHostOpenAIVoice(
  voice: SignalHostVoiceGender | SignalHostVoiceProfileId | undefined,
  overrides: Partial<Record<SignalHostVoiceGender | SignalHostVoiceProfileId, string>> = {},
) {
  const profile = getSignalHostVoiceProfile(voice);
  const gender = profile.gender;
  return overrides[profile.id]?.trim() || overrides[gender]?.trim() || profile.openAIRealtimeVoice;
}

export function buildTwilioElevenLabsVoice({
  gender,
  modelId = "flash_v2_5",
  overrides,
  voiceProfileId,
  similarityBoost = "0.85",
  speed = "0.95",
  stability = "0.35",
}: {
  gender: SignalHostVoiceGender;
  modelId?: string;
  overrides?: Partial<Record<SignalHostVoiceGender | SignalHostVoiceProfileId, string>>;
  voiceProfileId?: SignalHostVoiceProfileId | string;
  similarityBoost?: string;
  speed?: string;
  stability?: string;
}) {
  return `${resolveSignalHostVoiceId(voiceProfileId ?? gender, overrides)}-${modelId}-${speed}_${stability}_${similarityBoost}`;
}
