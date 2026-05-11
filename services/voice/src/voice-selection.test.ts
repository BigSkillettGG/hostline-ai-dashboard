import { describe, expect, it } from "vitest";
import { buildTwilioElevenLabsVoice } from "../../../src/domain/voice-selection";
import { resolveConversationRelayTtsVoice, resolvePreviewElevenLabsVoiceId } from "./voice-selection";

const env = {
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  TWILIO_TTS_PROVIDER: "ElevenLabs" as const,
  TWILIO_TTS_VOICE: "fallback",
};

describe("voice service selection", () => {
  it("uses the selected ElevenLabs voice for preview audio", () => {
    expect(resolvePreviewElevenLabsVoiceId(env, "female")).toBe("eve");
    expect(resolvePreviewElevenLabsVoiceId(env, "Male - Michael")).toBe("michael");
  });

  it("uses the selected ElevenLabs voice for ConversationRelay", () => {
    expect(resolveConversationRelayTtsVoice(env, { voiceGender: "female" })).toBe(
      "eve-flash_v2_5-1.0_0.5_0.8",
    );
    expect(resolveConversationRelayTtsVoice(env, { voiceGender: "male" })).toBe(
      "michael-flash_v2_5-1.0_0.5_0.8",
    );
  });

  it("keeps the explicit Twilio voice for non-ElevenLabs providers", () => {
    expect(
      resolveConversationRelayTtsVoice({ ...env, TWILIO_TTS_PROVIDER: "Google" }, { voiceGender: "male" }),
    ).toBe("fallback");
  });

  it("defaults new ElevenLabs live voices to the expressive phone tuning", () => {
    expect(buildTwilioElevenLabsVoice({ gender: "female" })).toBe(
      "BZgkqPqms7Kj9ulSkVzn-flash_v2_5-0.95_0.35_0.85",
    );
  });
});
