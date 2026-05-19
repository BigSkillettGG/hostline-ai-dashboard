import { describe, expect, it } from "vitest";
import { getVoiceServiceReadiness, loadEnv, type VoiceServiceEnv } from "./env";

const baseEnv: VoiceServiceEnv = {
  ELEVENLABS_MODEL_ID: "eleven_flash_v2_5",
  ELEVENLABS_OUTPUT_FORMAT: "mp3_44100_128",
  ELEVENLABS_VOICE_ID: "voice_1",
  ELEVENLABS_EVE_VOICE_ID: "eve",
  ELEVENLABS_MICHAEL_VOICE_ID: "michael",
  NODE_ENV: "production",
  OPENAI_MODEL: "gpt-5-mini",
  OPENAI_REPLY_TIMEOUT_MS: 4500,
  OPENAI_REALTIME_IDLE_TIMEOUT_MS: 9000,
  OPENAI_REALTIME_INTERRUPT_RESPONSE: false,
  OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
  OPENAI_REALTIME_SERVER_VAD_PREFIX_PADDING_MS: 250,
  OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: 550,
  OPENAI_REALTIME_SERVER_VAD_THRESHOLD: 0.72,
  OPENAI_REALTIME_TURN_DETECTION_MODE: "server_vad",
  OPENAI_REALTIME_TURN_EAGERNESS: "low",
  PORT: 8787,
  REQUIRE_TWILIO_SIGNATURE: true,
  TWILIO_API_BASE_URL: "https://api.twilio.com",
  TWILIO_DEFAULT_COUNTRY: "US",
  TWILIO_LANGUAGE: "en-US",
  TWILIO_SPEECH_TIMEOUT_MS: 1800,
  TWILIO_TRANSCRIPTION_PROVIDER: "Deepgram",
  TWILIO_TTS_PROVIDER: "ElevenLabs",
  TWILIO_TTS_VOICE: "voice",
  TWILIO_ELEVENLABS_MODEL_ID: "flash_v2_5",
  TWILIO_ELEVENLABS_SIMILARITY_BOOST: "0.8",
  TWILIO_ELEVENLABS_SPEED: "1.0",
  TWILIO_ELEVENLABS_STABILITY: "0.5",
  VOICE_SERVICE_ALLOWED_ORIGIN: "https://app.signalhost.ai",
};

describe("voice service readiness", () => {
  it("uses hardened OpenAI Realtime server VAD defaults", () => {
    const original = {
      OPENAI_REALTIME_SERVER_VAD_SILENCE_MS: process.env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS,
      OPENAI_REALTIME_SERVER_VAD_THRESHOLD: process.env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD,
      OPENAI_REALTIME_TURN_DETECTION_MODE: process.env.OPENAI_REALTIME_TURN_DETECTION_MODE,
    };
    delete process.env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS;
    delete process.env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD;
    delete process.env.OPENAI_REALTIME_TURN_DETECTION_MODE;

    try {
      const env = loadEnv();
      expect(env.OPENAI_REALTIME_TURN_DETECTION_MODE).toBe("semantic_vad");
      expect(env.OPENAI_REALTIME_SERVER_VAD_THRESHOLD).toBe(0.93);
      expect(env.OPENAI_REALTIME_SERVER_VAD_SILENCE_MS).toBe(1100);
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });

  it("requires production secrets and public URLs", () => {
    const readiness = getVoiceServiceReadiness(baseEnv);

    expect(readiness.productionReady).toBe(false);
    expect(readiness.checks.filter((check) => check.required && !check.ready).map((check) => check.id)).toEqual([
      "public_http_base_url",
      "public_ws_base_url",
      "dashboard_admin_auth",
      "supabase_service_role",
      "openai",
      "openai_realtime_sip",
      "twilio_credentials",
      "twilio_signatures",
    ]);
  });

  it("marks the service production-ready when required checks pass", () => {
    const readiness = getVoiceServiceReadiness({
      ...baseEnv,
      ELEVENLABS_API_KEY: "elevenlabs",
      OPENAI_API_KEY: "openai",
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
      PUBLIC_WS_BASE_URL: "wss://voice.signalhost.ai",
      SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
      SUPABASE_SECRET_KEY: "service-role",
      SUPABASE_URL: "https://example.supabase.co",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
    });

    expect(readiness.productionReady).toBe(true);
    expect(readiness.checks.find((check) => check.id === "address_validation")).toMatchObject({
      required: false,
      ready: false,
    });
  });

  it("flags wildcard CORS as not production-ready", () => {
    const readiness = getVoiceServiceReadiness({
      ...baseEnv,
      ELEVENLABS_API_KEY: "elevenlabs",
      OPENAI_API_KEY: "openai",
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
      PUBLIC_WS_BASE_URL: "wss://voice.signalhost.ai",
      SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
      SUPABASE_SECRET_KEY: "service-role",
      SUPABASE_URL: "https://example.supabase.co",
      TWILIO_ACCOUNT_SID: "AC123",
      TWILIO_AUTH_TOKEN: "token",
      VOICE_SERVICE_ALLOWED_ORIGIN: "*",
    });

    expect(readiness.productionReady).toBe(false);
    expect(readiness.checks.find((check) => check.id === "allowed_origin")).toMatchObject({ ready: false });
  });
});
