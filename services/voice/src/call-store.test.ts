import { afterEach, describe, expect, it, vi } from "vitest";
import { createCallStore } from "./call-store";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("Supabase call store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a call start and returns the Supabase call id", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ id: "call_uuid" }]), { status: 201 }),
    );
    const store = createCallStore(env);

    const result = await store.startCall({
      setup: {
        callSid: "CA123",
        from: "+15551234567",
        sessionId: "VX123",
        type: "setup",
      },
    });

    expect(result.callId).toBe("call_uuid");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/rest/v1/calls?on_conflict=external_call_sid&select=id",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sb_secret_test",
          Prefer: "return=representation,resolution=merge-duplicates",
        }),
      }),
    );
  });

  it("skips transcript writes until a call id exists", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    const store = createCallStore(env);

    await store.addTranscriptTurn({
      speaker: "caller",
      text: "Hello",
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
