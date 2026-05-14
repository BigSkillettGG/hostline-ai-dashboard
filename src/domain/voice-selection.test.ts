import { describe, expect, it } from "vitest";
import {
  buildTwilioElevenLabsVoice,
  getSignalHostVoiceProfile,
  normalizeSignalHostVoiceGender,
  normalizeSignalHostVoiceProfileId,
  resolveSignalHostOpenAIVoice,
  resolveSignalHostVoiceId,
  signalHostVoiceRoster,
} from "./voice-selection";

describe("SignalHost voice selection", () => {
  it("offers the four named onboarding voices", () => {
    expect(signalHostVoiceRoster.map((profile) => profile.employeeName)).toEqual(["Vera", "Maya", "Marco", "Theo"]);
    expect(signalHostVoiceRoster.filter((profile) => profile.gender === "female")).toHaveLength(2);
    expect(signalHostVoiceRoster.filter((profile) => profile.gender === "male")).toHaveLength(2);
  });

  it("normalizes legacy and named voice choices", () => {
    expect(normalizeSignalHostVoiceGender("Female - Eve")).toBe("female");
    expect(normalizeSignalHostVoiceGender("Male - Michael")).toBe("male");
    expect(normalizeSignalHostVoiceGender("Theo")).toBe("male");
    expect(normalizeSignalHostVoiceGender(undefined)).toBe("female");
    expect(normalizeSignalHostVoiceProfileId("Female - Eve")).toBe("vera");
    expect(normalizeSignalHostVoiceProfileId("Male - Michael")).toBe("marco");
    expect(normalizeSignalHostVoiceProfileId("Maya - bright female")).toBe("maya");
  });

  it("resolves named OpenAI realtime voices", () => {
    expect(resolveSignalHostOpenAIVoice("vera")).toBe("marin");
    expect(resolveSignalHostOpenAIVoice("maya")).toBe("coral");
    expect(resolveSignalHostOpenAIVoice("marco")).toBe("cedar");
    expect(resolveSignalHostOpenAIVoice("theo")).toBe("verse");
    expect(resolveSignalHostOpenAIVoice("maya", { maya: "custom_voice" })).toBe("custom_voice");
    expect(getSignalHostVoiceProfile("Theo").employeeName).toBe("Theo");
  });

  it("keeps legacy Twilio ConversationRelay voice strings available for fallback paths", () => {
    expect(resolveSignalHostVoiceId("marco")).toBe("ljX1ZrXuDIIRVcmiVSyR");
    expect(buildTwilioElevenLabsVoice({ gender: "male", voiceProfileId: "marco" })).toBe(
      "ljX1ZrXuDIIRVcmiVSyR-flash_v2_5-0.95_0.35_0.85",
    );
  });
});
