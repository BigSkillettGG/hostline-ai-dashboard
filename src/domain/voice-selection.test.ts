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
    expect(signalHostVoiceRoster.map((profile) => profile.employeeName)).toEqual(["Ava", "Maya", "Miles", "Aiden"]);
    expect(signalHostVoiceRoster.map((profile) => profile.label).join(" ")).not.toMatch(/marin|coral|cedar|verse/i);
    expect(signalHostVoiceRoster.filter((profile) => profile.gender === "female")).toHaveLength(2);
    expect(signalHostVoiceRoster.filter((profile) => profile.gender === "male")).toHaveLength(2);
  });

  it("normalizes legacy and named voice choices", () => {
    expect(normalizeSignalHostVoiceGender("Female - Eve")).toBe("female");
    expect(normalizeSignalHostVoiceGender("Male - Michael")).toBe("male");
    expect(normalizeSignalHostVoiceGender("Aiden")).toBe("male");
    expect(normalizeSignalHostVoiceGender(undefined)).toBe("female");
    expect(normalizeSignalHostVoiceProfileId("Female - Eve")).toBe("ava");
    expect(normalizeSignalHostVoiceProfileId("Male - Michael")).toBe("miles");
    expect(normalizeSignalHostVoiceProfileId("Maya - bright female")).toBe("maya");
    expect(normalizeSignalHostVoiceProfileId("Vera - warm female")).toBe("ava");
    expect(normalizeSignalHostVoiceProfileId("Marco - calm male")).toBe("miles");
  });

  it("resolves named OpenAI realtime voices", () => {
    expect(resolveSignalHostOpenAIVoice("ava")).toBe("marin");
    expect(resolveSignalHostOpenAIVoice("maya")).toBe("coral");
    expect(resolveSignalHostOpenAIVoice("miles")).toBe("cedar");
    expect(resolveSignalHostOpenAIVoice("aiden")).toBe("verse");
    expect(resolveSignalHostOpenAIVoice("maya", { maya: "custom_voice" })).toBe("custom_voice");
    expect(getSignalHostVoiceProfile("Theo").employeeName).toBe("Aiden");
  });

  it("keeps legacy Twilio ConversationRelay voice strings available for fallback paths", () => {
    expect(resolveSignalHostVoiceId("miles")).toBe("ljX1ZrXuDIIRVcmiVSyR");
    expect(buildTwilioElevenLabsVoice({ gender: "male", voiceProfileId: "miles" })).toBe(
      "ljX1ZrXuDIIRVcmiVSyR-flash_v2_5-0.95_0.35_0.85",
    );
  });
});
