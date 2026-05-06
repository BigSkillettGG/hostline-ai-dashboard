import { afterEach, describe, expect, it, vi } from "vitest";
import { createPhoneNumberStore } from "./phone-number-store";
import type { VoiceServiceEnv } from "./env";

const env: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
  SUPABASE_SECRET_KEY: "sb_secret_test",
  SUPABASE_URL: "https://example.supabase.co",
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("phone number store", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists a provisioned Twilio number and updates the location", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const store = createPhoneNumberStore(env);

    await store.saveProvisionedNumber(
      {
        forwardingMode: "forward_unanswered",
        locationId: "00000000-0000-4000-8000-000000000002",
        phoneNumber: "+14155550199",
        restaurantMainLine: "+14155550148",
      },
      {
        capabilities: { sms: true, voice: true },
        phoneNumber: "+14155550199",
        providerSid: "PN123",
        status: "in-use",
        voiceWebhookUrl: "https://voice.hostline.test/twilio/voice?locationId=loc",
      },
    );

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://example.supabase.co/rest/v1/phone_numbers?on_conflict=provider,phone_number",
      expect.objectContaining({
        method: "POST",
      }),
    );
    expect(String(fetchMock.mock.calls[0]?.[1]?.body)).toContain('"provider_sid":"PN123"');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://example.supabase.co/rest/v1/locations?id=eq.00000000-0000-4000-8000-000000000002",
      expect.objectContaining({
        method: "PATCH",
      }),
    );
  });
});
