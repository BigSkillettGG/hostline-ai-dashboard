import { describe, expect, it } from "vitest";
import {
  buildTwilioElevenLabsVoice,
  normalizeHostlineVoiceGender,
  resolveHostlineVoiceId,
} from "./voice-selection";

describe("HostLine voice selection", () => {
  it("normalizes the V1 voice choices", () => {
    expect(normalizeHostlineVoiceGender("Female - Eve")).toBe("female");
    expect(normalizeHostlineVoiceGender("Male - Michael")).toBe("male");
    expect(normalizeHostlineVoiceGender(undefined)).toBe("female");
  });

  it("resolves Eve and Michael ElevenLabs voice IDs", () => {
    expect(resolveHostlineVoiceId("female")).toBe("BZgkqPqms7Kj9ulSkVzn");
    expect(resolveHostlineVoiceId("male")).toBe("ljX1ZrXuDIIRVcmiVSyR");
  });

  it("formats Twilio ConversationRelay voice strings", () => {
    expect(buildTwilioElevenLabsVoice({ gender: "male" })).toBe(
      "ljX1ZrXuDIIRVcmiVSyR-flash_v2_5-0.95_0.35_0.85",
    );
  });
});
