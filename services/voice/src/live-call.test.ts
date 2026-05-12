import { describe, expect, it } from "vitest";
import { buildLiveCallConfig } from "./live-call";
import type { VoiceServiceEnv } from "./env";

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

describe("live call config", () => {
  it("builds Twilio webhook URLs from public deployment origins", () => {
    const config = buildLiveCallConfig({
      ...baseEnv,
      PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai/",
      PUBLIC_WS_BASE_URL: "wss://voice.signalhost.ai/",
      SUPABASE_DEMO_LOCATION_ID: "00000000-0000-0000-0000-000000000001",
    });

    expect(config).toMatchObject({
      conversationRelayUrl: "wss://voice.signalhost.ai/twilio/conversation-relay",
      locationId: "00000000-0000-0000-0000-000000000001",
      ready: true,
      twilioSignatureRequired: true,
      actionUrl:
        "https://voice.signalhost.ai/twilio/conversation-ended?locationId=00000000-0000-0000-0000-000000000001",
      voiceWebhookUrl: "https://voice.signalhost.ai/twilio/voice?locationId=00000000-0000-0000-0000-000000000001",
    });
  });

  it("allows an explicit location id for test calls", () => {
    const config = buildLiveCallConfig(
      {
        ...baseEnv,
        PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai",
        PUBLIC_WS_BASE_URL: "wss://voice.signalhost.ai",
      },
      "loc_test",
    );

    expect(config.locationId).toBe("loc_test");
    expect(config.actionUrl).toBe("https://voice.signalhost.ai/twilio/conversation-ended?locationId=loc_test");
    expect(config.voiceWebhookUrl).toBe("https://voice.signalhost.ai/twilio/voice?locationId=loc_test");
  });

  it("is not ready until both HTTP and websocket origins exist", () => {
    expect(buildLiveCallConfig({ ...baseEnv, PUBLIC_HTTP_BASE_URL: "https://voice.signalhost.ai" }).ready).toBe(false);
    expect(buildLiveCallConfig({ ...baseEnv, PUBLIC_WS_BASE_URL: "wss://voice.signalhost.ai" }).ready).toBe(false);
  });
});
