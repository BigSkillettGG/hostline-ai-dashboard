import { describe, expect, it } from "vitest";
import { buildElevenLabsPreviewVoiceSettings } from "./elevenlabs";

describe("ElevenLabs preview voice settings", () => {
  it("uses the same expressive tuning variables as live phone calls", () => {
    expect(
      buildElevenLabsPreviewVoiceSettings({
        TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.85",
        TWILIO_ELEVENLABS_SPEED: "0.95",
        TWILIO_ELEVENLABS_STABILITY: "0.35",
      }),
    ).toEqual({
      similarity_boost: 0.85,
      speed: 0.95,
      stability: 0.35,
    });
  });

  it("falls back to safe voice tuning if Render values are malformed", () => {
    expect(
      buildElevenLabsPreviewVoiceSettings({
        TWILIO_ELEVENLABS_SIMILARITY_BOOST: "nope",
        TWILIO_ELEVENLABS_SPEED: "way-too-fast",
        TWILIO_ELEVENLABS_STABILITY: "",
      }),
    ).toEqual({
      similarity_boost: 0.85,
      speed: 0.95,
      stability: 0.35,
    });
  });

  it("clamps voice tuning so typo values do not break previews", () => {
    expect(
      buildElevenLabsPreviewVoiceSettings({
        TWILIO_ELEVENLABS_SIMILARITY_BOOST: "4",
        TWILIO_ELEVENLABS_SPEED: "2",
        TWILIO_ELEVENLABS_STABILITY: "-1",
      }),
    ).toEqual({
      similarity_boost: 1,
      speed: 1.2,
      stability: 0,
    });
  });
});
