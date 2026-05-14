import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailDeliveryService } from "./email-delivery-service";
import type { VoiceServiceEnv } from "./env";

const baseEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_123",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "test",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: false,
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice_123-flash_v2_5-1.0_0.5_0.8",
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
} satisfies VoiceServiceEnv;

describe("email delivery service", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("is disabled until a provider key and from address are configured", async () => {
    const service = createEmailDeliveryService(baseEnv);

    expect(service.configured).toBe(false);
    await expect(
      service.sendEmail({
        subject: "Daily report",
        text: "Hello",
        to: "owner@example.com",
      }),
    ).rejects.toThrow("Email delivery provider is not configured");
  });

  it("sends email through Resend", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "email_123" }), { status: 200 }),
    );
    const service = createEmailDeliveryService({
      ...baseEnv,
      EMAIL_FROM: "SignalHost <reports@signalhost.ai>",
      RESEND_API_KEY: "re_test",
    });

    const result = await service.sendEmail({
      replyTo: "support@signalhost.ai",
      subject: "Daily report",
      text: "Hello",
      to: ["owner@example.com"],
    });

    expect(result).toEqual({ id: "email_123", provider: "resend", status: "sent" });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        body: expect.stringContaining('"from":"SignalHost <reports@signalhost.ai>"'),
        headers: expect.objectContaining({ Authorization: "Bearer re_test" }),
        method: "POST",
      }),
    );
  });
});
