import { describe, expect, it } from "vitest";
import { getStripeBillingReadiness } from "./billing-readiness";
import type { VoiceServiceEnv } from "./env";

const baseEnv: VoiceServiceEnv = {
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_1",
  NODE_ENV: "production",
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
  REQUIRE_TWILIO_SIGNATURE: true,
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
  TWILIO_TTS_VOICE: "voice",
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("Stripe billing readiness", () => {
  it("reports the webhook URL, mode, and event list when configured", () => {
    const readiness = getStripeBillingReadiness({
      ...baseEnv,
      DASHBOARD_PUBLIC_URL: "https://app.signalhost.ai",
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
      STRIPE_SECRET_KEY: "sk_test_123",
      STRIPE_WEBHOOK_SECRET: "whsec_123",
      SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
      SUPABASE_SECRET_KEY: "service-role",
      SUPABASE_URL: "https://example.supabase.co",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.mode).toBe("test");
    expect(readiness.webhookUrl).toBe("https://voice.signalhost.ai/stripe/webhook");
    expect(readiness.returnUrls.successUrl).toBe("https://app.signalhost.ai/app/billing?checkout=success");
    expect(readiness.expectedWebhookEvents).toContain("checkout.session.completed");
    expect(readiness.expectedWebhookEvents).toContain("invoice.payment_failed");
  });

  it("keeps the billing test blocked until required setup is present", () => {
    const readiness = getStripeBillingReadiness(baseEnv);

    expect(readiness.ready).toBe(false);
    expect(readiness.checks.filter((check) => check.required && !check.ready).map((check) => check.id)).toEqual([
      "stripe_secret_key",
      "stripe_webhook_secret",
      "stripe_webhook_url",
      "supabase_billing_persistence",
    ]);
  });
});
