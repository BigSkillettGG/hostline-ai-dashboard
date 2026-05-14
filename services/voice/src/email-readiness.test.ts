import { describe, expect, it } from "vitest";
import { getEmailReadiness } from "./email-readiness";
import type { VoiceServiceEnv } from "./env";

const baseEnv: VoiceServiceEnv = {
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice",
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
  TWILIO_TTS_PROVIDER: "Google",
  TWILIO_TTS_VOICE: "en-US-Standard-H",
  VOICE_SERVICE_ALLOWED_ORIGIN: "*",
};

describe("email readiness", () => {
  it("builds exact inbound webhook setup details", () => {
    const readiness = getEmailReadiness({
      ...baseEnv,
      EMAIL_FROM: "SignalHost <hello@signalhost.ai>",
      EMAIL_PROVIDER: "resend",
      OWNER_EMAIL_INBOUND_ADDRESS: "updates@agents.signalhost.ai",
      PUBLIC_HTTP_BASE_URL: "https://hostline-voice.onrender.com/",
      RESEND_API_KEY: "re_test",
      RESEND_WEBHOOK_SECRET: "whsec_test",
      SUPABASE_DEMO_LOCATION_ID: "00000000-0000-4000-8000-000000000001",
      SUPABASE_SECRET_KEY: "service-role",
      SUPABASE_URL: "https://example.supabase.co",
    });

    expect(readiness.ready).toBe(true);
    expect(readiness.receivingDomain).toBe("agents.signalhost.ai");
    expect(readiness.webhookUrl).toBe("https://hostline-voice.onrender.com/resend/inbound-email");
    expect(readiness.setupSteps.join("\n")).toContain("updates@agents.signalhost.ai");
  });

  it("shows missing required email pieces", () => {
    const readiness = getEmailReadiness(baseEnv);

    expect(readiness.ready).toBe(false);
    expect(readiness.checks.filter((check) => check.required && !check.ready).map((check) => check.id)).toEqual([
      "public_http_base_url",
      "resend_api_key",
      "email_from",
      "resend_webhook_secret",
      "fallback_inbound_address",
      "owner_command_supabase",
    ]);
  });
});
