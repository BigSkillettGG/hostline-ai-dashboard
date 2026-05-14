import { describe, expect, it, vi } from "vitest";
import { createOpenAIVoicePreview } from "./openai-voice-preview";

describe("OpenAI voice previews", () => {
  it("uses the selected SignalHost employee's OpenAI voice", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        input: "Hi there",
        model: "gpt-4o-mini-tts",
        response_format: "mp3",
        voice: "coral",
      });
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg" },
        status: 200,
      });
    });
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;

    try {
      const preview = await createOpenAIVoicePreview({
        env: {
          OPENAI_API_KEY: "sk-test",
          OPENAI_REALTIME_AIDEN_VOICE: undefined,
          OPENAI_REALTIME_AVA_VOICE: undefined,
          OPENAI_REALTIME_FEMALE_VOICE: undefined,
          OPENAI_REALTIME_MALE_VOICE: undefined,
          OPENAI_REALTIME_MARCO_VOICE: undefined,
          OPENAI_REALTIME_MAYA_VOICE: undefined,
          OPENAI_REALTIME_MILES_VOICE: undefined,
          OPENAI_REALTIME_THEO_VOICE: undefined,
          OPENAI_REALTIME_VERA_VOICE: undefined,
          OPENAI_TTS_MODEL: "gpt-4o-mini-tts",
          OPENAI_TTS_RESPONSE_FORMAT: "mp3",
        },
        text: "Hi there",
        voiceProfileId: "maya",
      });

      expect(preview.contentType).toBe("audio/mpeg");
      expect(preview.audio).toBeInstanceOf(Buffer);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
