import { describe, expect, it } from "vitest";
import {
  buildTwilioElevenLabsVoice,
  normalizeSignalHostVoiceGender,
  resolveSignalHostVoiceId,
} from "./voice-selection";

describe("SignalHost voice selection", () => {
  it("normalizes the V1 voice choices", () => {
    expect(normalizeSignalHostVoiceGender("Female - Eve")).toBe("female");
    expect(normalizeSignalHostVoiceGender("Male - Michael")).toBe("male");
    expect(normalizeSignalHostVoiceGender(undefined)).toBe("female");
  });

  it("resolves Eve and Michael ElevenLabs voice IDs", () => {
    expect(resolveSignalHostVoiceId("female")).toBe("BZgkqPqms7Kj9ulSkVzn");
    expect(resolveSignalHostVoiceId("male")).toBe("ljX1ZrXuDIIRVcmiVSyR");
  });

  it("formats Twilio ConversationRelay voice strings", () => {
    expect(buildTwilioElevenLabsVoice({ gender: "male" })).toBe(
      "ljX1ZrXuDIIRVcmiVSyR-flash_v2_5-0.95_0.35_0.85",
    );
  });
});
